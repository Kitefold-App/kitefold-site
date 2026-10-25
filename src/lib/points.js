// The points budget (SPEC.md §1.12). Pure functions, tested in test/points.test.mjs.
//
// Confluence limits apps by API points per hour: 1 point a request, plus 1 for each page, blog post, space or file it
// returns and 2 for each user, group or permission; a write is 1 (Atlassian, ECOHELP-175732, 20 Oct 2026). By default
// the whole app has ONE pool of 65,000 points an hour shared by every customer site. Atlassian couldn't say whether
// calls made from the browser count, so this app is designed as if every call counts: each site gets its own hourly
// budget, heavy actions reserve their estimate first, and the pool guard pauses when the headers say the pool is low.
//
// Headers (developer.atlassian.com/cloud/confluence/rate-limiting; read both prefixes, the unprefixed ones win):
//   RateLimit-Policy: "global-app-quota";q=65000;w=3600     (or Beta-RateLimit-Policy)
//   RateLimit: "global-app-quota";r=11000;t=600              (or Beta-RateLimit; r only appears after ~80% use)
//   RateLimit-Reason (on a 429), Retry-After, X-RateLimit-* (per-second burst limits, logged only)
// "tenant-app-quota" means a per-site pool (Tier 2, which Atlassian assigns itself and never gives on request).

export const HOUR_MS = 60 * 60 * 1000;
export const POOL = 65000;

export const MODES = {
  standard: { budget: 5000, csvRows: 2000, macroReuseMs: 5 * 60 * 1000 },
  relaxed: { budget: 25000, csvRows: 10000, macroReuseMs: 0 }, // only if Atlassian says browser calls are free
};
export const LIMITS = 'standard';
export const settings = (mode = LIMITS) => MODES[mode] || MODES.standard;

export const PAGE_SIZE = 250; // results per search call when walking every result (Select all, CSV)
export const REPORT_EVERY = 200; // light actions report what they spent every 200 points
export const HEAVY = ['csv', 'selectAll', 'bulk', 'rename', 'archive'];
const ARCHIVE_POLLS = 9; // archive job status checks, about one every few seconds

const walk = (n) => Math.ceil(Math.max(0, n) / PAGE_SIZE) + Math.max(0, n); // calls + one point per result

// Points an action is expected to cost (SPEC.md §1.12 table).
export function estimate(action, o = {}) {
  switch (action) {
    case 'search':
      return 1 + (o.rows ?? 50) + 2 * (o.people ?? 0);
    case 'macro':
      return o.reused ? 0 : 1 + (o.rows ?? 25) + 2 * (o.people ?? 0);
    case 'picker':
      return 1 + (o.kind === 'people' ? 2 : 1) * (o.results ?? 10);
    case 'spaceList':
      return 1 + Math.min(o.spaces ?? 200, 200);
    case 'selectAll':
      return walk(Math.min(o.items ?? 500, 500));
    case 'bulk': // find the items, then one write each (labels, watch)
    case 'rename':
      return walk(o.items ?? 500) + (o.writes ?? o.items ?? 500);
    case 'archive':
      return walk(o.items ?? 300) + 1 + ARCHIVE_POLLS;
    case 'csv':
      return walk(Math.min(o.rows ?? settings(o.mode).csvRows, settings(o.mode).csvRows));
    case 'adminCheck':
      return 2;
    default:
      throw new Error(`No estimate for ${action}`);
  }
}

export const hourKey = (now = Date.now()) => {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `pts:${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${p(d.getUTCHours())}`;
};
export const nextHour = (now) => (Math.floor(now / HOUR_MS) + 1) * HOUR_MS;

// The site's budget for this hour: 5,000 by default; a quarter of a per-site pool (at most 25,000) once Confluence
// shows one (app 2's rule).
export function siteBudget(seen, mode = LIMITS) {
  const base = settings(mode).budget;
  if (seen && seen.policy === 'tenant-app-quota' && Number.isFinite(seen.q)) return Math.max(base, Math.min(25000, Math.floor(seen.q / 4)));
  return base;
}

// Structured header entries: '"global-app-quota";q=65000;w=3600, "other";q=10' → [{name, q, w}, ...]
export function parseEntries(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((part) => {
      const bits = part.split(';').map((b) => b.trim());
      const name = bits.shift().replace(/^"|"$/g, '');
      const e = { name };
      for (const b of bits) {
        const [k, v] = b.split('=');
        if (k) e[k.trim()] = Number(v);
      }
      return e;
    })
    .filter((e) => e.name);
}

const POLICIES = ['global-app-quota', 'tenant-app-quota'];

// What one response says. get(name) returns a header value or null, case-insensitive (like fetch's Headers).
// Returns null when there are no rate-limit headers at all (the browser may not be allowed to see them, §12.6).
export function readHeaders(get, now = Date.now()) {
  const h = (n) => {
    try {
      const v = get(n);
      return v === undefined || v === '' ? null : v;
    } catch {
      return null;
    }
  };
  const pick = (name) => {
    const live = parseEntries(h(name)).filter((e) => POLICIES.includes(e.name));
    if (live.length) return { list: live, prefix: 'none' };
    const beta = parseEntries(h(`beta-${name}`)).filter((e) => POLICIES.includes(e.name));
    if (beta.length) return { list: beta, prefix: 'beta' };
    return { list: [], prefix: null };
  };
  const pol = pick('ratelimit-policy');
  const st = pick('ratelimit');
  const reason = h('ratelimit-reason');
  const retryAfter = h('retry-after');
  const burst = { limit: h('x-ratelimit-limit'), remaining: h('x-ratelimit-remaining'), nearLimit: h('x-ratelimit-nearlimit') };
  if (!pol.list.length && !st.list.length && !reason && !retryAfter && !burst.limit && !burst.nearLimit) return null;
  const s = st.list.find((e) => Number.isFinite(e.r)) || st.list[0] || {};
  const name = s.name || pol.list[0]?.name || null;
  const p = pol.list.find((e) => e.name === name) || pol.list[0] || {};
  const prefixes = new Set([pol.prefix, st.prefix].filter(Boolean));
  return {
    at: now,
    prefix: prefixes.size === 2 ? 'mixed' : [...prefixes][0] || null,
    policy: name,
    q: Number.isFinite(p.q) ? p.q : null,
    w: Number.isFinite(p.w) ? p.w : null,
    r: Number.isFinite(s.r) ? s.r : null,
    resetAt: Number.isFinite(s.t) ? now + s.t * 1000 : nextHour(now),
    reason,
    retryAfterSec: retryAfter !== null && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) : null,
    burst,
  };
}

// One log line, e.g. "ratelimit: prefix=beta policy=global-app-quota q=65000 w=3600 r=- t=3120 reason=-". No user data.
export function logLine(seen, now = Date.now()) {
  if (!seen) return 'ratelimit: no rate-limit headers visible';
  const v = (x) => (x === null || x === undefined ? '-' : x);
  const t = seen.resetAt ? Math.max(0, Math.round((seen.resetAt - now) / 1000)) : null;
  return `ratelimit: prefix=${v(seen.prefix)} policy=${v(seen.policy)} q=${v(seen.q)} w=${v(seen.w)} r=${v(seen.r)} t=${v(t)} reason=${v(seen.reason)}`;
}

// Log it now? At most once per site per hour, but every time r, a near-limit flag or a 429 shows up.
export function shouldLog(seen, lastLoggedAt, status, now = Date.now()) {
  if (status === 429) return true;
  if (seen && (seen.r !== null || seen.burst?.nearLimit === 'true')) return true;
  return !lastLoggedAt || Math.floor(lastLoggedAt / HOUR_MS) !== Math.floor(now / HOUR_MS);
}

// The pool guard: given the latest signal, what may run now.
//   hold.heavy: heavy actions wait until hold.until (points left are showing: the pool is ~80% used)
//   hold.all:   everything waits (a quota 429)
export function guard(seen, status, now = Date.now()) {
  if (status === 429 && seen?.reason && /quota/i.test(seen.reason)) {
    const until = seen.retryAfterSec ? now + seen.retryAfterSec * 1000 : seen.resetAt || nextHour(now);
    return { hold: 'all', until };
  }
  if (seen && seen.r !== null && seen.resetAt > now) return { hold: 'heavy', until: seen.resetAt };
  return { hold: null, until: null };
}

// The site's hourly record (`pts:<hour>` in Forge storage): { used, reserved, holdUntil, holdReason, policy, q }.
// May this action start? Heavy actions reserve their estimate; light ones only need the hour not to be spent or held.
export function mayRun(record, action, cost, { now = Date.now(), seen = null, mode = LIMITS } = {}) {
  const rec = record || {};
  const budget = siteBudget(seen, mode);
  const heavy = HEAVY.includes(action);
  const until = nextHour(now);
  if (rec.holdUntil && rec.holdUntil > now) {
    if (rec.holdReason === 'all' || heavy) return { ok: false, why: 'pool', heavy, retryAt: rec.holdUntil };
  }
  const spent = (rec.used || 0) + (rec.reserved || 0);
  if (heavy) {
    if (spent + cost > budget) return { ok: false, why: 'budget', heavy, retryAt: until, left: Math.max(0, budget - spent) };
    return { ok: true, reserve: cost };
  }
  if (spent >= budget) return { ok: false, why: 'budget', heavy, retryAt: until, left: 0 };
  return { ok: true, reserve: 0 };
}

// The message shown when an action has to wait. Times are in the viewer's own time zone (HH:MM).
export function waitMessage(decision, timeZone) {
  const at = new Date(decision.retryAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
  if (decision.why === 'budget' && decision.heavy) return `Your site has used this hour's allowance for big actions. This can run at ${at}, or try fewer items.`;
  return `Confluence limits how often apps can search. Try again at ${at}.`;
}
