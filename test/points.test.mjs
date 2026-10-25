import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimate, settings, siteBudget, parseEntries, readHeaders, logLine, shouldLog, guard, mayRun, waitMessage, hourKey, HOUR_MS } from '../src/lib/points.js';

const near = (actual, expected, pct = 1) => assert.ok(Math.abs(actual - expected) <= (expected * pct) / 100, `${actual} vs ${expected}`);
const headers = (obj) => (name) => obj[name.toLowerCase()] ?? null;

test('estimates match the table in SPEC.md §1.12', () => {
  assert.equal(estimate('search'), 51);
  assert.equal(estimate('search', { rows: 50, people: 3 }), 57);
  assert.equal(estimate('macro'), 26);
  assert.equal(estimate('macro', { reused: true }), 0);
  assert.equal(estimate('picker', { kind: 'spaces' }), 11);
  assert.equal(estimate('picker', { kind: 'people' }), 21);
  assert.equal(estimate('spaceList', { spaces: 500 }), 201);
  assert.equal(estimate('selectAll'), 502);
  near(estimate('bulk', { items: 500 }), 1000);
  near(estimate('rename', { items: 500 }), 1000);
  assert.equal(estimate('archive', { items: 300 }), 312);
  near(estimate('csv'), 2010);
  assert.equal(estimate('csv', { rows: 50000 }), estimate('csv'));
  assert.equal(estimate('csv', { mode: 'relaxed', rows: 10000 }), 40 + 10000);
  assert.equal(estimate('adminCheck'), 2);
  assert.throws(() => estimate('teleport'), /No estimate/);
});

test('v1 limits and the relaxed option', () => {
  assert.deepEqual(settings(), { budget: 5000, csvRows: 2000, macroReuseMs: 300000 });
  assert.deepEqual(settings('relaxed'), { budget: 25000, csvRows: 10000, macroReuseMs: 0 });
  assert.equal(siteBudget(null), 5000);
  assert.equal(siteBudget({ policy: 'global-app-quota', q: 65000 }), 5000);
  assert.equal(siteBudget({ policy: 'tenant-app-quota', q: 40000 }), 10000);
  assert.equal(siteBudget({ policy: 'tenant-app-quota', q: 500000 }), 25000);
  assert.equal(siteBudget({ policy: 'tenant-app-quota', q: 8000 }), 5000);
});

test('header entries are parsed', () => {
  assert.deepEqual(parseEntries('"global-app-quota";q=65000;w=3600'), [{ name: 'global-app-quota', q: 65000, w: 3600 }]);
  assert.deepEqual(parseEntries('"a";r=1, "b";r=2;t=60'), [{ name: 'a', r: 1 }, { name: 'b', r: 2, t: 60 }]);
  assert.deepEqual(parseEntries(null), []);
});

test('both header prefixes are read; the unprefixed ones win', () => {
  const now = Date.UTC(2026, 9, 21, 14, 10);
  const beta = readHeaders(headers({ 'beta-ratelimit-policy': '"global-app-quota";q=65000;w=3600', 'beta-ratelimit': '"global-app-quota";t=3000' }), now);
  assert.equal(beta.prefix, 'beta');
  assert.equal(beta.q, 65000);
  assert.equal(beta.r, null);
  assert.equal(beta.resetAt, now + 3000 * 1000);
  const live = readHeaders(headers({ 'ratelimit-policy': '"global-app-quota";q=65000;w=3600', 'ratelimit': '"global-app-quota";r=9000;t=600', 'beta-ratelimit': '"global-app-quota";r=1;t=1' }), now);
  assert.equal(live.prefix, 'none');
  assert.equal(live.r, 9000);
  const mixed = readHeaders(headers({ 'ratelimit-policy': '"global-app-quota";q=65000;w=3600', 'beta-ratelimit': '"global-app-quota";t=60' }), now);
  assert.equal(mixed.prefix, 'mixed');
  const tenant = readHeaders(headers({ 'ratelimit-policy': '"tenant-app-quota";q=40000;w=3600' }), now);
  assert.equal(tenant.policy, 'tenant-app-quota');
  assert.equal(readHeaders(headers({}), now), null);
  assert.equal(readHeaders(() => { throw new Error('blocked'); }, now), null);
  const busy = readHeaders(headers({ 'retry-after': '20', 'ratelimit-reason': 'global-app-quota' }), now);
  assert.equal(busy.retryAfterSec, 20);
  assert.equal(busy.reason, 'global-app-quota');
});

test('log line and when to log', () => {
  const now = Date.UTC(2026, 9, 21, 14, 8);
  const seen = readHeaders(headers({ 'beta-ratelimit-policy': '"global-app-quota";q=65000;w=3600', 'beta-ratelimit': '"global-app-quota";t=3120' }), now);
  assert.equal(logLine(seen, now), 'ratelimit: prefix=beta policy=global-app-quota q=65000 w=3600 r=- t=3120 reason=-');
  assert.equal(logLine(null), 'ratelimit: no rate-limit headers visible');
  assert.equal(shouldLog(seen, null, 200, now), true);
  assert.equal(shouldLog(seen, now - 60000, 200, now), false); // same hour
  assert.equal(shouldLog(seen, now - HOUR_MS, 200, now), true); // last hour
  assert.equal(shouldLog(seen, now - 60000, 429, now), true);
  assert.equal(shouldLog({ ...seen, r: 100 }, now - 60000, 200, now), true);
});

test('pool guard: r pauses heavy actions, a quota 429 pauses everything', () => {
  const now = Date.UTC(2026, 9, 21, 14, 0);
  assert.deepEqual(guard(null, 200, now), { hold: null, until: null });
  const low = { r: 5000, resetAt: now + 600000 };
  assert.deepEqual(guard(low, 200, now), { hold: 'heavy', until: now + 600000 });
  assert.deepEqual(guard({ r: null, reason: 'global-app-quota', retryAfterSec: 90, resetAt: now + 600000 }, 429, now), { hold: 'all', until: now + 90000 });
  assert.deepEqual(guard({ r: null, reason: null, retryAfterSec: 2, resetAt: now + 600000 }, 429, now), { hold: null, until: null }); // a burst 429: retried once by the planner
});

test('the site budget: heavy actions reserve, light actions run until the hour is spent', () => {
  const now = Date.UTC(2026, 9, 21, 14, 30);
  const top = Date.UTC(2026, 9, 21, 15, 0);
  assert.deepEqual(mayRun({ used: 1000 }, 'csv', 2010, { now }), { ok: true, reserve: 2010 });
  assert.deepEqual(mayRun({ used: 2000, reserved: 2010 }, 'bulk', 1002, { now }), { ok: false, why: 'budget', heavy: true, retryAt: top, left: 990 });
  assert.deepEqual(mayRun({ used: 4990 }, 'search', 51, { now }), { ok: true, reserve: 0 });
  assert.deepEqual(mayRun({ used: 5000 }, 'search', 51, { now }), { ok: false, why: 'budget', heavy: false, retryAt: top, left: 0 });
  assert.deepEqual(mayRun({ used: 0, holdUntil: now + 1000, holdReason: 'heavy' }, 'search', 51, { now }), { ok: true, reserve: 0 });
  assert.equal(mayRun({ used: 0, holdUntil: now + 1000, holdReason: 'heavy' }, 'archive', 312, { now }).ok, false);
  assert.equal(mayRun({ used: 0, holdUntil: now + 1000, holdReason: 'all' }, 'search', 51, { now }).why, 'pool');
  assert.deepEqual(mayRun({ used: 9000 }, 'csv', 2010, { now, seen: { policy: 'tenant-app-quota', q: 60000 } }), { ok: true, reserve: 2010 });
});

test('wait messages and hour keys', () => {
  const at = Date.UTC(2026, 9, 21, 14, 0);
  assert.equal(waitMessage({ why: 'budget', heavy: true, retryAt: at }, 'UTC'), "Your site has used this hour's allowance for big actions. This can run at 14:00, or try fewer items.");
  assert.equal(waitMessage({ why: 'pool', heavy: false, retryAt: at }, 'Europe/London'), 'Confluence limits how often apps can search. Try again at 15:00.');
  assert.equal(hourKey(Date.UTC(2026, 0, 5, 7, 59)), 'pts:2026-01-05-07');
});
