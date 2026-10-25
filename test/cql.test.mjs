import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, unquote, buildCql, builderFromCql, findPlaceholders, replacePlaceholders } from '../src/lib/cql.js';

test('quote escapes quotes and backslashes, unquote reverses it', () => {
  assert.equal(quote('plain'), '"plain"');
  assert.equal(quote('say "hi"'), '"say \\"hi\\""');
  assert.equal(quote('C:\\temp'), '"C:\\\\temp"');
  for (const s of ['plain', 'say "hi"', 'C:\\temp', 'a\\"b', '']) assert.equal(unquote(quote(s)), s);
  assert.equal(unquote('"open'), null);
  assert.equal(unquote('"a" "b"'), null);
});

test('buildCql writes each filter in a fixed order', () => {
  assert.equal(buildCql({ spaces: ['QB1'] }), 'space = "QB1"');
  assert.equal(buildCql({ spaces: ['QB1', 'QB2', 'QB1'], types: ['page', 'blogpost'] }), 'space in ("QB1", "QB2") AND type in (page, blogpost)');
  assert.equal(buildCql({ types: ['attachment'], labels: ['Draft'] }), 'type = attachment AND label = "draft"');
  assert.equal(buildCql({ labels: ['a', 'b'], labelMode: 'any' }), 'label in ("a", "b")');
  assert.equal(buildCql({ labels: ['a', 'b'], labelMode: 'all' }), 'label = "a" AND label = "b"');
  assert.equal(buildCql({ labels: ['a'], labelMode: 'none' }), 'label != "a"');
  assert.equal(buildCql({ labels: ['a', 'b'], labelMode: 'none' }), 'label not in ("a", "b")');
  assert.equal(buildCql({ creator: 'me', contributor: '557058:abc-123' }), 'creator = currentUser() AND contributor = "557058:abc-123"');
  assert.equal(buildCql({ created: { preset: 'last30' }, modified: { preset: 'older12m' } }), 'created >= now("-30d") AND lastmodified < now("-12M")');
  assert.equal(buildCql({ modified: { from: '2026-10-01', to: '2026-10-31' } }), 'lastmodified >= "2026-10-01" AND lastmodified < "2026-11-01"');
  assert.equal(buildCql({ title: 'on "boarding"', text: 'HR' }), 'title ~ "on \\"boarding\\"" AND text ~ "HR"');
  assert.equal(buildCql({ ancestor: '98765', orderBy: { field: 'title', dir: 'asc' } }), 'ancestor = 98765 order by title asc');
});

test('buildCql refuses bad input with a plain message', () => {
  assert.throws(() => buildCql({}), /at least one filter/);
  assert.throws(() => buildCql({ spaces: ['QB 1'] }), /isn't a space key/);
  assert.throws(() => buildCql({ types: ['comment'] }), /Unknown type/);
  assert.throws(() => buildCql({ labels: ['two words'] }), /can't contain spaces/);
  assert.throws(() => buildCql({ creator: 'x" OR space = "PROD' }), /valid person/);
  assert.throws(() => buildCql({ created: { from: '2026-02-30' } }), /date like/);
  assert.throws(() => buildCql({ created: { from: '2026-10-02', to: '2026-10-01' } }), /before/);
  assert.throws(() => buildCql({ ancestor: '12 OR 1=1' }), /page id/);
  assert.throws(() => buildCql({ spaces: ['QB1'], orderBy: { field: 'labels' } }), /sort by/);
});

test('builder state survives a round trip through CQL', () => {
  const states = [
    { spaces: ['QB1'] },
    { spaces: ['QB1', 'QB2'], types: ['page'], labels: ['draft', 'review'], labelMode: 'all' },
    { types: ['page', 'blogpost', 'attachment'], labels: ['old'], labelMode: 'none', creator: 'me' },
    { contributor: '557058:abc-123', created: { preset: 'last7' }, modified: { from: '2026-01-01', to: '2026-03-31' } },
    { title: 'say "hi" AND bye', text: 'a AND b', ancestor: '123', orderBy: { field: 'lastmodified', dir: 'desc' } },
    { spaces: ['~557058abc'], labels: ['x', 'y'], labelMode: 'none', created: { to: '2025-12-31' } },
  ];
  for (const s of states) {
    const cql = buildCql(s);
    const back = builderFromCql(cql);
    assert.ok(back, `read back: ${cql}`);
    assert.equal(buildCql(back), cql);
  }
});

test('hand-written CQL switches the builder off', () => {
  for (const cql of [
    'space = "QB1" OR space = "QB2"',
    'space = QB1',
    'type = page AND (label = "a" OR label = "b")',
    'created > now("-7d")',
    'creator = currentUser() AND creator = "x"',
    'title ~ "a" AND title ~ "b"',
    'space = "QB1" order by labels desc',
    'macro = toc',
    '',
  ]) {
    assert.equal(builderFromCql(cql), null, cql);
  }
});

test('placeholders are found outside quotes only', () => {
  assert.deepEqual(findPlaceholders('ancestor = pageId() AND space = spaceKey()'), ['pageId()', 'spaceKey()']);
  assert.deepEqual(findPlaceholders('title ~ "pageId()"'), []);
  assert.deepEqual(findPlaceholders('creator = currentUser()'), []);
});

test('placeholders are filled in the macro and refused on the search page', () => {
  const where = { pageId: '4242', spaceKey: 'QB1' };
  assert.deepEqual(replacePlaceholders('ancestor = pageId() AND space = spaceKey()', where), { cql: 'ancestor = 4242 AND space = "QB1"' });
  assert.deepEqual(replacePlaceholders('parent = thisPage() AND space = thisSpace() AND title ~ "spaceKey()"', where), {
    cql: 'parent = 4242 AND space = "QB1" AND title ~ "spaceKey()"',
  });
  assert.deepEqual(replacePlaceholders('space = "QB1"', null), { cql: 'space = "QB1"' });
  assert.match(replacePlaceholders('ancestor = pageId()', null).error, /only work in the Query results macro/);
  assert.match(replacePlaceholders('ancestor = pageId()', { pageId: 'x', spaceKey: 'QB1' }).error, /couldn't be read/);
});
