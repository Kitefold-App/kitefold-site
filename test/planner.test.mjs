import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBulk, previewText, batches, afterError, summarise, LIMITS } from '../src/lib/planner.js';

const page = (id, extra = {}) => ({ id: String(id), type: 'page', title: `Page ${id}`, status: 'current', ...extra });
const blog = (id, extra = {}) => ({ id: String(id), type: 'blogpost', title: `Blog ${id}`, status: 'current', ...extra });
const file = (id, extra = {}) => ({ id: String(id), type: 'attachment', title: `file-${id}.pdf`, status: 'current', ...extra });

test('add labels: skips items that already have them (when labels are known)', () => {
  const plan = planBulk('addLabels', [page(1, { labels: ['draft'] }), page(2, { labels: [] }), blog(3), file(4)], { labels: ['Draft'] });
  assert.deepEqual(plan.run.map((i) => i.id), ['2', '3', '4']);
  assert.deepEqual(plan.skipCounts, { 'already-has': 1 });
  assert.equal(plan.writes, 3);
  assert.deepEqual(plan.byType, { page: 2, blogpost: 1, attachment: 1 });
});

test('remove labels: skips archived items and items without the label', () => {
  const plan = planBulk('removeLabels', [page(1, { labels: ['a', 'b'] }), page(2, { labels: ['c'] }), page(3, { status: 'archived', labels: ['a'] }), page(4)], { labels: ['a', 'b'] });
  assert.deepEqual(plan.run.map((i) => i.id), ['1', '4']);
  assert.deepEqual(plan.skipCounts, { 'not-there': 1, archived: 1 });
  assert.equal(plan.writes, 4); // 2 labels on item 1 + both tried on item 4 (labels unknown)
});

test('rename or merge a label: add the new one, remove the old ones', () => {
  const items = [page(1, { labels: ['old'] }), page(2, { labels: ['old', 'new'] }), page(3, { labels: ['other'] }), page(4, { status: 'archived', labels: ['old'] }), blog(5, { labels: ['old2', 'old'] })];
  const plan = planBulk('renameLabel', items, { from: ['old', 'old2'], to: 'New' });
  assert.deepEqual(plan.run.map((i) => i.id), ['1', '2', '5']);
  assert.deepEqual(plan.skipCounts, { 'not-there': 1, archived: 1 });
  assert.equal(plan.writes, 2 + 1 + 3);
  assert.equal(plan.options.to, 'new');
  assert.throws(() => planBulk('renameLabel', items, { from: ['same'], to: 'same' }), /same as the old/);
  assert.throws(() => planBulk('renameLabel', items, { from: ['old'], to: 'two words' }), /without spaces/);
});

test('watch: pages and blog posts only, no status reads', () => {
  const plan = planBulk('watch', [page(1), blog(2), file(3)], { who: 'me' });
  assert.deepEqual(plan.run.map((i) => i.id), ['1', '2']);
  assert.deepEqual(plan.skipCounts, { 'wrong-type': 1 });
  assert.equal(plan.writes, 2);
  assert.match(previewText(plan), /Pages you already watch are left as they are/);
  assert.throws(() => planBulk('watch', [page(1)], { who: 'bad id!' }), /valid person/);
});

test('archive: pages only, one job for the run, at most 300', () => {
  const items = Array.from({ length: 320 }, (_, i) => page(i + 1));
  items.push(blog(999), page(1000, { status: 'archived' }));
  const plan = planBulk('archive', items);
  assert.equal(plan.run.length, LIMITS.archive);
  assert.equal(plan.waiting, 20);
  assert.equal(plan.writes, 1);
  assert.deepEqual(plan.skipCounts, { 'wrong-type': 1, 'already-archived': 1 });
});

test('limits, duplicates and the preview line', () => {
  const items = Array.from({ length: 520 }, (_, i) => page(i + 1));
  items.push(page(1)); // a duplicate tick
  const plan = planBulk('addLabels', items, { labels: ['x'] });
  assert.equal(plan.selected, 520);
  assert.equal(plan.run.length, 500);
  assert.equal(plan.waiting, 20);
  assert.equal(
    previewText(plan),
    'You selected 520 items: 520 pages. The first 500 run now; the other 20 can follow with "Continue with the next 500".'
  );
  const p2 = planBulk('addLabels', [page(1, { labels: ['x'] }), page(2)], { labels: ['x'] });
  assert.equal(previewText(p2), 'You selected 2 items: 2 pages. 1 already has the label and will be skipped.');
  const p3 = planBulk('removeLabels', [page(1, { labels: [] }), page(2, { labels: [] }), file(3, { status: 'archived', labels: ['x'] })], { labels: ['x'] });
  assert.equal(
    previewText(p3),
    "You selected 3 items: 2 pages, 1 attachment. 2 don't have the label and will be skipped. 1 is archived and will be skipped (Confluence won't change labels on archived content)."
  );
  assert.throws(() => planBulk('addLabels', [], { labels: [] }), /at least one label/);
  assert.throws(() => planBulk('delete', []), /Unknown action/);
});

test('batches go out 4 at a time', () => {
  assert.deepEqual(batches([1, 2, 3, 4, 5, 6, 7, 8, 9]), [[1, 2, 3, 4], [5, 6, 7, 8], [9]]);
  assert.deepEqual(batches([]), []);
});

test('after an error: quota holds, burst retries once, 5xx backs off, refusals stop', () => {
  const now = 1_000_000;
  assert.deepEqual(afterError({ status: 429, retryAfterSec: 30, reason: 'global-app-quota', now }), { hold: 'quota', untilMs: now + 30000 });
  assert.deepEqual(afterError({ status: 429, retryAfterSec: 2, attempt: 0, now }), { retryInMs: 2000 });
  assert.deepEqual(afterError({ status: 429, retryAfterSec: 2, attempt: 1, now }), { hold: 'busy', untilMs: now + 2000 });
  assert.deepEqual(afterError({ status: 503, attempt: 0 }), { retryInMs: 1000 });
  assert.deepEqual(afterError({ status: 500, attempt: 2 }), { retryInMs: 4000 });
  assert.deepEqual(afterError({ status: 502, attempt: 3 }), { result: 'failed' });
  assert.deepEqual(afterError({ status: 403 }), { result: 'refused' });
  assert.deepEqual(afterError({ status: 400 }), { result: 'failed' });
});

test('summarise counts each result', () => {
  assert.deepEqual(summarise([{ status: 'done' }, { status: 'done' }, { status: 'refused' }, { status: 'skipped' }, { status: 'odd' }]), {
    done: 2,
    skipped: 1,
    refused: 1,
    failed: 0,
  });
});
