// CQL helpers for the search page and the macro (SPEC.md §3.1, §3.2). Pure functions, tested in test/cql.test.mjs.
//
// The builder keeps a small state object and writes CQL from it. buildCql(state) always writes the same clauses in the
// same order, so builderFromCql() can read that CQL back. Anything else (CQL typed or edited by hand) reads back as
// null: the builder switches off for that query and the CQL box is used as typed (one way, like Jira's basic/advanced).
//
// Builder state (every field optional):
//   spaces:      ['QB1', 'QB2']                        space keys
//   types:       ['page', 'blogpost', 'attachment']
//   labels:      ['draft'], labelMode: 'any' | 'all' | 'none'
//   creator:     'me' | '<accountId>'                  'me' becomes currentUser()
//   contributor: 'me' | '<accountId>'
//   created:     { preset: 'last7' | 'last30' | 'last90' | 'older6m' | 'older12m' } | { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
//   modified:    same as created
//   title:       words the title contains
//   text:        words the content contains
//   ancestor:    '12345'                                 page id ("under page")
//   orderBy:     { field: 'lastmodified' | 'created' | 'title', dir: 'asc' | 'desc' }

export const TYPES = ['page', 'blogpost', 'attachment'];
export const LABEL_MODES = ['any', 'all', 'none'];
export const DATE_PRESETS = {
  last7: { op: '>=', amount: '-7d' },
  last30: { op: '>=', amount: '-30d' },
  last90: { op: '>=', amount: '-90d' },
  older6m: { op: '<', amount: '-6M' },
  older12m: { op: '<', amount: '-12M' },
};
// Fields the builder can sort by. Other columns show no sort control (SPEC.md §3.1; the full list is checked in the
// API check, §12.3).
export const SORT_FIELDS = ['lastmodified', 'created', 'title'];

const ACCOUNT_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const SPACE_KEY = /^~?[A-Za-z0-9_-]{1,255}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// A CQL string literal: double quotes, with backslashes and double quotes escaped.
export function quote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// The reverse of quote() for one literal (with its quotes). Returns null if it isn't a single quoted literal.
export function unquote(literal) {
  const m = /^"((?:[^"\\]|\\.)*)"$/.exec(String(literal).trim());
  return m ? m[1].replace(/\\(.)/g, '$1') : null;
}

const uniq = (list) => [...new Set((list || []).map((s) => String(s).trim()).filter(Boolean))];

function nextDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function prevDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
const validDay = (day) => DAY.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;

function person(field, who) {
  if (!who) return null;
  if (who === 'me') return `${field} = currentUser()`;
  if (!ACCOUNT_ID.test(who)) throw new Error(`Not a valid person for ${field}`);
  return `${field} = ${quote(who)}`;
}

function dateClauses(field, value) {
  if (!value) return [];
  if (value.preset) {
    const p = DATE_PRESETS[value.preset];
    if (!p) throw new Error(`Unknown date preset ${value.preset}`);
    return [`${field} ${p.op} now(${quote(p.amount)})`];
  }
  const out = [];
  if (value.from) {
    if (!validDay(value.from)) throw new Error(`${field}: "from" must be a date like 2026-10-01`);
    out.push(`${field} >= ${quote(value.from)}`);
  }
  if (value.to) {
    if (!validDay(value.to)) throw new Error(`${field}: "to" must be a date like 2026-10-31`);
    if (value.from && value.to < value.from) throw new Error(`${field}: "to" is before "from"`);
    out.push(`${field} < ${quote(nextDay(value.to))}`); // the whole "to" day is included
  }
  return out;
}

// Builder state → CQL. Throws an Error with a plain message for invalid input (shown under the builder).
export function buildCql(state = {}) {
  const clauses = [];
  const spaces = uniq(state.spaces);
  for (const k of spaces) if (!SPACE_KEY.test(k)) throw new Error(`"${k}" isn't a space key`);
  if (spaces.length === 1) clauses.push(`space = ${quote(spaces[0])}`);
  else if (spaces.length > 1) clauses.push(`space in (${spaces.map(quote).join(', ')})`);

  const types = uniq(state.types);
  for (const t of types) if (!TYPES.includes(t)) throw new Error(`Unknown type ${t}`);
  if (types.length === 1) clauses.push(`type = ${types[0]}`);
  else if (types.length > 1) clauses.push(`type in (${types.join(', ')})`);

  const labels = uniq(state.labels).map((l) => l.toLowerCase());
  const mode = state.labelMode || 'any';
  if (!LABEL_MODES.includes(mode)) throw new Error(`Unknown label mode ${mode}`);
  for (const l of labels) if (/\s/.test(l)) throw new Error(`Labels can't contain spaces ("${l}")`);
  if (labels.length) {
    if (mode === 'none') clauses.push(labels.length === 1 ? `label != ${quote(labels[0])}` : `label not in (${labels.map(quote).join(', ')})`);
    else if (mode === 'all' && labels.length > 1) for (const l of labels) clauses.push(`label = ${quote(l)}`);
    else clauses.push(labels.length === 1 ? `label = ${quote(labels[0])}` : `label in (${labels.map(quote).join(', ')})`);
  }

  const c = person('creator', state.creator);
  if (c) clauses.push(c);
  const co = person('contributor', state.contributor);
  if (co) clauses.push(co);
  clauses.push(...dateClauses('created', state.created));
  clauses.push(...dateClauses('lastmodified', state.modified));

  const title = String(state.title || '').trim();
  if (title) clauses.push(`title ~ ${quote(title)}`);
  const text = String(state.text || '').trim();
  if (text) clauses.push(`text ~ ${quote(text)}`);
  if (state.ancestor) {
    if (!/^\d{1,20}$/.test(String(state.ancestor))) throw new Error('"Under page" needs a page id');
    clauses.push(`ancestor = ${state.ancestor}`);
  }

  if (!clauses.length) throw new Error('Choose at least one filter');
  let cql = clauses.join(' AND ');
  if (state.orderBy) {
    const { field, dir = 'desc' } = state.orderBy;
    if (!SORT_FIELDS.includes(field)) throw new Error(`Can't sort by ${field}`);
    if (!['asc', 'desc'].includes(dir)) throw new Error(`Unknown sort direction ${dir}`);
    cql += ` order by ${field} ${dir}`;
  }
  return cql;
}

// Splits CQL into top-level parts at a separator (case-insensitive), ignoring anything inside quotes or brackets.
function splitTop(cql, sep) {
  const parts = [];
  let depth = 0;
  let inQ = false;
  let start = 0;
  const s = cql;
  const re = new RegExp(`^${sep}`, 'i');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '\\') i++;
      else if (ch === '"') inQ = false;
      continue;
    }
    if (ch === '"') inQ = true;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0) {
      const m = re.exec(s.slice(i));
      if (m && m[0].length) {
        parts.push(s.slice(start, i));
        i += m[0].length - 1;
        start = i + 1;
      }
    }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim());
}

// A list of quoted literals inside brackets: ("a", "b") → ['a', 'b']; null if it isn't one.
function literalList(inner) {
  const items = splitTop(inner, ',\\s*');
  const out = items.map(unquote);
  return out.every((x) => x !== null) ? out : null;
}

// CQL → builder state, for CQL that buildCql() wrote. Returns null for anything else.
export function builderFromCql(cql) {
  if (typeof cql !== 'string' || !cql.trim()) return null;
  let body = cql.trim();
  const state = {};
  const ob = /\s+order\s+by\s+(\w+)\s+(asc|desc)\s*$/i.exec(body);
  if (ob) {
    if (!SORT_FIELDS.includes(ob[1].toLowerCase())) return null;
    state.orderBy = { field: ob[1].toLowerCase(), dir: ob[2].toLowerCase() };
    body = body.slice(0, ob.index);
  }
  const allLabels = [];
  const dates = { created: {}, lastmodified: {} };
  for (const clause of splitTop(body, '\\s+AND\\s+')) {
    let m;
    if ((m = /^space\s*=\s*("(?:[^"\\]|\\.)*")$/i.exec(clause))) {
      if (state.spaces) return null;
      state.spaces = [unquote(m[1])];
    } else if ((m = /^space\s+in\s*\((.*)\)$/i.exec(clause))) {
      if (state.spaces) return null;
      const list = literalList(m[1]);
      if (!list) return null;
      state.spaces = list;
    } else if ((m = /^type\s*=\s*(\w+)$/i.exec(clause))) {
      if (state.types || !TYPES.includes(m[1])) return null;
      state.types = [m[1]];
    } else if ((m = /^type\s+in\s*\(([\w\s,]+)\)$/i.exec(clause))) {
      if (state.types) return null;
      const list = m[1].split(',').map((t) => t.trim());
      if (!list.every((t) => TYPES.includes(t))) return null;
      state.types = list;
    } else if ((m = /^label\s*=\s*("(?:[^"\\]|\\.)*")$/i.exec(clause))) {
      allLabels.push(unquote(m[1]));
    } else if ((m = /^label\s+in\s*\((.*)\)$/i.exec(clause))) {
      if (state.labels) return null;
      const list = literalList(m[1]);
      if (!list) return null;
      state.labels = list;
      state.labelMode = 'any';
    } else if ((m = /^label\s+not\s+in\s*\((.*)\)$/i.exec(clause))) {
      if (state.labels) return null;
      const list = literalList(m[1]);
      if (!list) return null;
      state.labels = list;
      state.labelMode = 'none';
    } else if ((m = /^label\s*!=\s*("(?:[^"\\]|\\.)*")$/i.exec(clause))) {
      if (state.labels) return null;
      state.labels = [unquote(m[1])];
      state.labelMode = 'none';
    } else if ((m = /^(creator|contributor)\s*=\s*(currentUser\(\)|"(?:[^"\\]|\\.)*")$/i.exec(clause))) {
      const field = m[1].toLowerCase();
      if (state[field]) return null;
      state[field] = /^currentUser/i.test(m[2]) ? 'me' : unquote(m[2]);
    } else if ((m = /^(created|lastmodified)\s*(>=|<)\s*now\(("[^"]*")\)$/i.exec(clause))) {
      const field = m[1].toLowerCase();
      const amount = unquote(m[3]);
      const preset = Object.keys(DATE_PRESETS).find((k) => DATE_PRESETS[k].op === m[2] && DATE_PRESETS[k].amount === amount);
      if (!preset || Object.keys(dates[field]).length) return null;
      dates[field] = { preset };
    } else if ((m = /^(created|lastmodified)\s*(>=|<)\s*("\d{4}-\d{2}-\d{2}")$/i.exec(clause))) {
      const field = m[1].toLowerCase();
      const day = unquote(m[3]);
      if (dates[field].preset) return null;
      if (m[2] === '>=') {
        if (dates[field].from) return null;
        dates[field].from = day;
      } else {
        if (dates[field].to) return null;
        dates[field].to = prevDay(day);
      }
    } else if ((m = /^title\s*~\s*("(?:[^"\\]|\\.)*")$/i.exec(clause))) {
      if (state.title) return null;
      state.title = unquote(m[1]);
    } else if ((m = /^text\s*~\s*("(?:[^"\\]|\\.)*")$/i.exec(clause))) {
      if (state.text) return null;
      state.text = unquote(m[1]);
    } else if ((m = /^ancestor\s*=\s*(\d{1,20})$/i.exec(clause))) {
      if (state.ancestor) return null;
      state.ancestor = m[1];
    } else {
      return null;
    }
  }
  if (allLabels.length) {
    if (state.labels) return null;
    state.labels = allLabels;
    state.labelMode = allLabels.length > 1 ? 'all' : 'any';
  }
  if (Object.keys(dates.created).length) state.created = dates.created;
  if (Object.keys(dates.lastmodified).length) state.modified = dates.lastmodified;
  // Only accept it if writing it again gives the same CQL (so the builder never silently changes a query).
  try {
    return buildCql(state) === cql.trim() ? state : null;
  } catch {
    return null;
  }
}

// Placeholders (SPEC.md §3.1, §3.2): CQL Search's pageId() and spaceKey(), and our thisPage() and thisSpace(). In the
// macro they become the page holding the macro and its space; on the search page there is no current page, so they
// are refused. Text inside quotes is never changed. currentUser() is native CQL and is left alone.
const PLACEHOLDER = /\b(pageId|thisPage|spaceKey|thisSpace)\s*\(\s*\)/gi;

export function findPlaceholders(cql) {
  const found = [];
  forEachOutsideQuotes(cql, (chunk, quoted) => {
    if (quoted) return;
    for (const m of chunk.matchAll(PLACEHOLDER)) found.push(`${m[1]}()`);
  });
  return [...new Set(found)];
}

export function replacePlaceholders(cql, where) {
  const found = findPlaceholders(cql);
  if (!found.length) return { cql };
  if (!where) {
    return { error: `${found.join(' and ')} only work in the Query results macro, where there is a current page. Remove ${found.length > 1 ? 'them' : 'it'} here, or use the space or page itself.` };
  }
  const pageId = String(where.pageId || '');
  const spaceKey = String(where.spaceKey || '');
  if (!/^\d{1,20}$/.test(pageId) || !SPACE_KEY.test(spaceKey)) return { error: "This page's id or space couldn't be read, so pageId() and spaceKey() can't be filled in." };
  let out = '';
  forEachOutsideQuotes(cql, (chunk, quoted) => {
    out += quoted
      ? chunk
      : chunk.replace(PLACEHOLDER, (_, name) => (/page/i.test(name) ? pageId : quote(spaceKey)));
  });
  return { cql: out };
}

// Calls fn(chunk, isQuoted) for each run of the text, quoted literals (with their quotes) separately.
function forEachOutsideQuotes(cql, fn) {
  const s = String(cql);
  let i = 0;
  let start = 0;
  while (i < s.length) {
    if (s[i] === '"') {
      if (i > start) fn(s.slice(start, i), false);
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j += s[j] === '\\' ? 2 : 1;
      fn(s.slice(i, j + 1), true);
      i = j + 1;
      start = i;
    } else i++;
  }
  if (start < s.length) fn(s.slice(start), false);
}
