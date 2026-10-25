// Bulk-run planner (SPEC.md §3.4). Pure functions, tested in test/planner.test.mjs.
//
// Bulk actions run in the browser, as the viewer, so Confluence itself refuses anything the viewer can't do. The
// planner only decides what to try: the preview counts, what is skipped and why, the per-run limit, the order, the
// batches, and how to retry. Nothing here calls Confluence.
//
// An item is { id, type: 'page' | 'blogpost' | 'attachment', title, status: 'current' | 'archived', labels?: [...] }.
// `labels` is only known when the Labels column was loaded; without it nothing is skipped as "already has it", and
// Confluence's own answer decides (adding a label twice or removing one that isn't there is harmless).

export const LIMITS = { addLabels: 500, removeLabels: 500, renameLabel: 500, watch: 500, unwatch: 500, archive: 300 };
export const CONCURRENCY = 4;

const TYPES_FOR = {
  addLabels: ['page', 'blogpost', 'attachment'],
  removeLabels: ['page', 'blogpost', 'attachment'],
  renameLabel: ['page', 'blogpost', 'attachment'],
  watch: ['page', 'blogpost'],
  unwatch: ['page', 'blogpost'],
  archive: ['page'],
};

// Preview wording for each skip reason, given how many items it applies to.
const one = (c, a, b) => (c === 1 ? a : b);
export const SKIP_REASONS = {
  'wrong-type': (c) => `${c.toLocaleString('en-GB')} ${one(c, "doesn't", "don't")} fit this action and won't be changed.`,
  'already-has': (c) => `${c.toLocaleString('en-GB')} already ${one(c, 'has', 'have')} the label and will be skipped.`,
  'not-there': (c) => `${c.toLocaleString('en-GB')} ${one(c, "doesn't", "don't")} have the label and will be skipped.`,
  archived: (c) => `${c.toLocaleString('en-GB')} ${one(c, 'is', 'are')} archived and will be skipped (Confluence won't change labels on archived content).`,
  'already-archived': (c) => `${c.toLocaleString('en-GB')} ${one(c, 'is', 'are')} already archived and will be skipped.`,
};

const norm = (l) => String(l).trim().toLowerCase();

// What one item needs for this action: { writes, skip } (skip is a reason key or null).
function itemPlan(action, item, opts) {
  if (!TYPES_FOR[action].includes(item.type)) return { skip: 'wrong-type', writes: 0 };
  const known = Array.isArray(item.labels) ? new Set(item.labels.map(norm)) : null;
  switch (action) {
    case 'addLabels': {
      const want = opts.labels.map(norm);
      if (known && want.every((l) => known.has(l))) return { skip: 'already-has', writes: 0 };
      return { skip: null, writes: 1 }; // one POST adds them all
    }
    case 'removeLabels': {
      if (item.status === 'archived') return { skip: 'archived', writes: 0 };
      const there = known ? opts.labels.map(norm).filter((l) => known.has(l)) : opts.labels.map(norm);
      if (!there.length) return { skip: 'not-there', writes: 0 };
      return { skip: null, writes: there.length }; // one DELETE per label
    }
    case 'renameLabel': {
      if (item.status === 'archived') return { skip: 'archived', writes: 0 };
      const from = opts.from.map(norm);
      const there = known ? from.filter((l) => known.has(l)) : from;
      if (known && !there.length) return { skip: 'not-there', writes: 0 };
      const addNew = known && known.has(norm(opts.to)) ? 0 : 1;
      return { skip: null, writes: addNew + there.length };
    }
    case 'archive':
      if (item.status === 'archived') return { skip: 'already-archived', writes: 0 };
      return { skip: null, writes: 0 }; // counted once per run below
    default: // watch, unwatch: no status reads (SPEC.md §1.12), so never skipped
      return { skip: null, writes: 1 };
  }
}

function checkOptions(action, opts) {
  if (!LIMITS[action]) throw new Error(`Unknown action ${action}`);
  if (action === 'addLabels' || action === 'removeLabels') {
    const labels = (opts.labels || []).map(norm).filter(Boolean);
    if (!labels.length) throw new Error('Choose at least one label');
    if (labels.some((l) => /\s/.test(l))) throw new Error("Labels can't contain spaces");
    return { labels: [...new Set(labels)] };
  }
  if (action === 'renameLabel') {
    const from = [...new Set((opts.from || []).map(norm).filter(Boolean))];
    const to = norm(opts.to || '');
    if (!from.length) throw new Error('Choose the label to rename (or several to merge)');
    if (!to || /\s/.test(to)) throw new Error('Type the new label name, without spaces');
    if (from.length === 1 && from[0] === to) throw new Error('The new name is the same as the old one');
    return { from: from.filter((l) => l !== to), to };
  }
  if ((action === 'watch' || action === 'unwatch') && opts.who && opts.who !== 'me' && !/^[A-Za-z0-9:_-]{1,128}$/.test(opts.who)) {
    throw new Error('Not a valid person');
  }
  return { who: opts.who || 'me' };
}

// The preview and the run list. Items beyond the limit wait for "Continue with the next N" (the search is re-run,
// so items already done drop out).
export function planBulk(action, items, options = {}) {
  const opts = checkOptions(action, options);
  const limit = LIMITS[action];
  const seen = new Set();
  const run = [];
  const skipped = [];
  let waiting = 0;
  let writes = 0;
  const byType = { page: 0, blogpost: 0, attachment: 0 };
  for (const item of items || []) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    if (byType[item.type] !== undefined) byType[item.type]++;
    const p = itemPlan(action, item, opts);
    if (p.skip) {
      skipped.push({ item, reason: p.skip });
      continue;
    }
    if (run.length >= limit) {
      waiting++;
      continue;
    }
    run.push(item);
    writes += p.writes;
  }
  if (action === 'archive' && run.length) writes = 1; // one archive job for the whole run
  const skipCounts = {};
  for (const s of skipped) skipCounts[s.reason] = (skipCounts[s.reason] || 0) + 1;
  return { action, options: opts, selected: seen.size, byType, run, skipped, skipCounts, waiting, limit, writes };
}

// One line for the preview, e.g. "You selected 412 items: 380 pages, 32 blog posts. 37 already have the label."
export function previewText(plan) {
  const names = { page: ['page', 'pages'], blogpost: ['blog post', 'blog posts'], attachment: ['attachment', 'attachments'] };
  const n = (count, [one, many]) => `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;
  const kinds = Object.entries(plan.byType)
    .filter(([, c]) => c)
    .map(([t, c]) => n(c, names[t]));
  let text = `You selected ${n(plan.selected, ['item', 'items'])}${kinds.length ? `: ${kinds.join(', ')}` : ''}.`;
  for (const [reason, count] of Object.entries(plan.skipCounts)) text += ` ${SKIP_REASONS[reason](count)}`;
  if (plan.waiting) text += ` The first ${plan.limit.toLocaleString('en-GB')} run now; the other ${plan.waiting.toLocaleString('en-GB')} can follow with "Continue with the next ${plan.limit}".`;
  if (plan.action === 'watch' || plan.action === 'unwatch') text += ' Pages you already watch are left as they are.';
  return text;
}

// Splits the run into groups that go out together (4 at a time, SPEC.md §3.4).
export function batches(list, size = CONCURRENCY) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// What to do after a failed call (SPEC.md §1.12, §3.4). attempt counts from 0 (the first retry decision).
//   { retryInMs }          wait, then try the same item again
//   { hold: 'quota', untilMs } the shared pool is out: stop the run, keep its place, show when it can continue
//   { result }             give up on this item: 'refused' or 'failed'
// A 429 with RateLimit-Reason naming a quota (the hourly pool) holds everything; any other 429 is a burst limit and
// is retried once after Retry-After. 5xx gets up to 3 tries with backoff. 401/403/404 mean Confluence refused it.
export function afterError({ status, retryAfterSec, reason, attempt = 0, now = Date.now() }) {
  const wait = Math.max(1, Number(retryAfterSec) || 5) * 1000;
  if (status === 429) {
    if (reason && /quota/i.test(reason)) return { hold: 'quota', untilMs: now + wait };
    return attempt < 1 ? { retryInMs: wait } : { hold: 'busy', untilMs: now + wait };
  }
  if (status >= 500) return attempt < 3 ? { retryInMs: 1000 * 2 ** attempt } : { result: 'failed' };
  if (status === 401 || status === 403 || status === 404) return { result: 'refused' };
  return { result: 'failed' };
}

// Totals for the results summary line.
export function summarise(results) {
  const out = { done: 0, skipped: 0, refused: 0, failed: 0 };
  for (const r of results || []) if (out[r.status] !== undefined) out[r.status]++;
  return out;
}
