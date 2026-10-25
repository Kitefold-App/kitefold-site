#!/usr/bin/env node
// Seeds a Confluence Cloud DEV site with test data for Query & Bulk Actions (SPEC.md §9).
// Not part of the Forge app. Never run it against a customer or work site.
//
// It only ever creates content in spaces QB1 to QB3. It never reads or changes any other space, so the showcase
// spaces (PROD, MKTG, CS) and the other apps' spaces (KF*, LH*) are untouched. QBSEC and QBSHOW are made by hand.
//
// Usage (PowerShell):
//   $env:CONF_SITE="https://kitefold-dev.atlassian.net"
//   $env:CONF_EMAIL="hello@kitefold.app"
//   $env:CONF_TOKEN="<plain API token, revoke it afterwards>"
//   node scripts/seed-qb.mjs [--pages 1000] [--blogs 100] [--dry-run] [--relabel]
// Optional second author (a demo account that can add pages to QB1-QB3): set CONF_EMAIL2 and CONF_TOKEN2 too, and
// every 5th page and blog post is created as that person (for the creator and contributor filters).
//
// Defaults: 3 spaces x (1,000 pages + 100 blog posts) = 3,000 pages and 300 blog posts, plus a few attachments.
// Titles are fixed ("QB2 page 0042"), so running it again skips what already exists and carries on where it
// stopped. Labels are added when a page is created; --relabel adds them again to pages that already exist.
// It writes seed-summary.json: the counts the app should find (per label, per space and per type).

import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : def;
};
const DRY = args.includes('--dry-run');
const RELABEL = args.includes('--relabel');
const N_PAGES = Math.min(Math.max(flag('pages', 1000), 10), 2000);
const N_BLOGS = Math.min(Math.max(flag('blogs', 100), 0), 500);

const SPACES = [
  ['QB1', 'Query test 1 (QB)'],
  ['QB2', 'Query test 2 (QB)'],
  ['QB3', 'Query test 3 (QB)'],
];
for (const [key] of SPACES) if (!/^QB[1-3]$/.test(key)) throw new Error(`Refusing to touch space ${key}`);

const site = (process.env.CONF_SITE || '').replace(/\/+$/, '');
const authors = [
  { email: process.env.CONF_EMAIL, token: process.env.CONF_TOKEN },
  { email: process.env.CONF_EMAIL2, token: process.env.CONF_TOKEN2 },
].filter((a) => a.email && a.token);
if (!DRY && (!site || !authors.length)) {
  console.error('Set CONF_SITE, CONF_EMAIL and CONF_TOKEN (or use --dry-run).');
  process.exit(1);
}
if (!DRY && !/^https:\/\/[a-z0-9-]+\.atlassian\.net$/i.test(site)) {
  console.error('CONF_SITE should look like https://your-dev-site.atlassian.net');
  process.exit(1);
}
const TWO_AUTHORS = authors.length > 1;
const authHeader = (a) => 'Basic ' + Buffer.from(`${a.email}:${a.token}`).toString('base64');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, body, { author = 0, headers = {} } = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const isForm = body instanceof FormData;
    const res = await fetch(`${site}${path}`, {
      method,
      headers: { Authorization: authHeader(authors[author]), Accept: 'application/json', ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    if (res.status === 429 || res.status === 503) {
      const wait = Number(res.headers.get('retry-after') || 5 * (attempt + 1)) * 1000;
      console.warn(`\nBusy (${res.status}), waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
    await sleep(80); // stay well under the rate limits
    return text ? JSON.parse(text) : null;
  }
  throw new Error(`${method} ${path} kept hitting rate limits`);
}

// ---------- the plan (deterministic, computed before anything is created) ----------

const pad = (n, w = 4) => String(n).padStart(w, '0');
const TEAMS = ['team-hr', 'team-it', 'team-sales'];

// Labels for page i. needs-review is on about 1 in 4 pages (750+ items with the blog posts: the rename test needs
// two runs of 500); how-to and howto are the near-duplicates for the merge test.
function pageLabels(i) {
  const out = [];
  if (i % 4 === 1) out.push('needs-review');
  if (i % 10 === 0) out.push('draft');
  if (i % 25 === 3) out.push('how-to');
  if (i % 25 === 8) out.push('howto');
  if (i % 50 === 7) out.push('archive-me');
  if (i % 7 < 3 && i % 2 === 0) out.push(TEAMS[i % 7]);
  return out;
}
function blogLabels(j) {
  const out = ['news'];
  if (j % 4 === 1) out.push('needs-review');
  if (j % 25 === 3) out.push('how-to');
  return out;
}
const hasWord = (i) => i % 20 === 5; // body contains "onboarding" (for text ~ tests)
const fileOn = (i) => i % 100 === 42; // a small attachment, labelled file-test

function plan() {
  const items = []; // {kind, key, i, title, parentTitle, body, labels, author, file}
  for (const [key] of SPACES) {
    for (let i = 1; i <= N_PAGES; i++) {
      const word = hasWord(i) ? ' Covers onboarding steps for new starters.' : '';
      items.push({
        kind: 'page',
        key,
        i,
        title: `${key} page ${pad(i)}`,
        parentTitle: i <= 20 ? null : `${key} page ${pad(Math.floor((i - 1) / 10))}`, // a page tree
        body: `<p>Seeded test page ${i} in ${key}. Not real content.${word}</p>`,
        labels: pageLabels(i),
        author: TWO_AUTHORS && i % 5 === 0 ? 1 : 0,
        file: fileOn(i) ? { name: `qb-file-${i}.txt`, labels: ['file-test'] } : null,
      });
    }
    for (let j = 1; j <= N_BLOGS; j++) {
      items.push({
        kind: 'blogpost',
        key,
        i: j,
        title: `${key} news ${pad(j, 3)}`,
        body: `<p>Seeded blog post ${j} in ${key}. Not real content.${hasWord(j) ? ' Onboarding news.' : ''}</p>`,
        labels: blogLabels(j),
        author: TWO_AUTHORS && j % 5 === 0 ? 1 : 0,
        file: null,
      });
    }
  }
  return items;
}

function summarise(items) {
  const blank = () => ({ page: 0, blogpost: 0, attachment: 0, total: 0 });
  const labels = {};
  const perSpace = {};
  const add = (label, key, type) => {
    labels[label] ??= { ...blank(), perSpace: {} };
    labels[label][type]++;
    labels[label].total++;
    labels[label].perSpace[key] = (labels[label].perSpace[key] || 0) + 1;
  };
  let onboarding = 0;
  let bySecond = 0;
  for (const it of items) {
    perSpace[it.key] ??= blank();
    perSpace[it.key][it.kind]++;
    perSpace[it.key].total++;
    for (const l of it.labels) add(l, it.key, it.kind);
    if (it.file) {
      perSpace[it.key].attachment++;
      perSpace[it.key].total++;
      for (const l of it.file.labels) add(l, it.key, 'attachment');
    }
    if (hasWord(it.i)) onboarding++;
    if (it.author === 1) bySecond++;
  }
  const totals = Object.values(perSpace).reduce((a, s) => ({ page: a.page + s.page, blogpost: a.blogpost + s.blogpost, attachment: a.attachment + s.attachment, total: a.total + s.total }), blank());
  return { totals, perSpace, labels, textOnboarding: onboarding, createdBySecondAuthor: bySecond };
}

// ---------- creating it ----------

async function ensureSpace(key, name) {
  const found = await call('GET', `/wiki/api/v2/spaces?keys=${encodeURIComponent(key)}`);
  if (found.results?.length) return found.results[0];
  console.log(`Creating space ${key}`);
  await call('POST', '/wiki/rest/api/space', { key, name, description: { plain: { value: 'Test data for Kitefold Query & Bulk Actions. Safe to delete.', representation: 'plain' } } });
  const again = await call('GET', `/wiki/api/v2/spaces?keys=${encodeURIComponent(key)}`);
  return again.results[0];
}

async function existing(spaceId, kind) {
  const byTitle = new Map();
  let path = `/wiki/api/v2/spaces/${spaceId}/${kind === 'page' ? 'pages' : 'blogposts'}?limit=250&status=current`;
  while (path) {
    const r = await call('GET', path);
    for (const p of r.results || []) byTitle.set(p.title, p.id);
    path = r._links?.next || null;
  }
  return byTitle;
}

const addLabels = (id, labels) => (labels.length ? call('POST', `/wiki/rest/api/content/${id}/label`, labels.map((name) => ({ prefix: 'global', name }))) : null);

async function addFile(pageId, file) {
  const have = await call('GET', `/wiki/api/v2/pages/${pageId}/attachments?limit=50`);
  let att = (have.results || []).find((a) => a.title === file.name);
  if (!att) {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(`Kitefold query test file ${file.name}. This file is test data.\n`)]), file.name);
    form.append('minorEdit', 'true');
    const r = await call('POST', `/wiki/rest/api/content/${pageId}/child/attachment`, form, { headers: { 'X-Atlassian-Token': 'no-check' } });
    att = r.results?.[0];
  }
  if (att) await addLabels(att.id, file.labels);
}

async function main() {
  const items = plan();
  const out = {
    createdAt: new Date().toISOString(),
    site: DRY ? '(dry run)' : site,
    spaces: SPACES.map(([k]) => k),
    twoAuthors: TWO_AUTHORS,
    expected: summarise(items),
    notes: [
      'Space homepages are not counted.',
      'Labels are lower case. how-to and howto are the pair to merge; needs-review is the one to rename (two runs of 500).',
      'Everything here is new, so date filters only match "today" ranges (SPEC.md §9).',
    ],
  };

  if (DRY) {
    console.log('Dry run: nothing created.');
    console.log(JSON.stringify(out.expected.totals, null, 2));
    for (const [l, c] of Object.entries(out.expected.labels)) console.log(`${l}: ${c.total}`);
    writeFileSync('seed-summary.json', JSON.stringify({ ...out, dryRun: true }, null, 2));
    console.log('Wrote seed-summary.json (dry run).');
    return;
  }

  let created = 0;
  let skipped = 0;
  let files = 0;
  for (const [key, name] of SPACES) {
    const space = await ensureSpace(key, name);
    const ids = { page: await existing(space.id, 'page'), blogpost: await existing(space.id, 'blogpost') };
    for (const it of items.filter((x) => x.key === key)) {
      let id = ids[it.kind].get(it.title);
      const isNew = !id;
      if (isNew) {
        const body = { spaceId: space.id, status: 'current', title: it.title, body: { representation: 'storage', value: it.body } };
        if (it.kind === 'page') body.parentId = (it.parentTitle && ids.page.get(it.parentTitle)) || space.homepageId;
        const r = await call('POST', `/wiki/api/v2/${it.kind === 'page' ? 'pages' : 'blogposts'}`, body, { author: it.author });
        id = r.id;
        ids[it.kind].set(it.title, id);
        created++;
      } else skipped++;
      if (isNew || RELABEL) await addLabels(id, it.labels);
      if (it.file && (isNew || RELABEL)) {
        await addFile(id, it.file);
        files++;
      }
      if ((created + skipped) % 50 === 0) process.stdout.write(`\r${key}: ${created} created, ${skipped} already there, ${files} files   `);
    }
    console.log(`\n${key} done`);
  }
  writeFileSync('seed-summary.json', JSON.stringify(out, null, 2));
  console.log(`\nFinished: ${created} pages and blog posts created, ${skipped} already existed, ${files} files added.`);
  console.log('Wrote seed-summary.json with the counts the app should find.');
  console.log('Now revoke the API token(s) you used for this script.');
}

main().catch((e) => {
  console.error('\n' + e.message);
  console.error('Run the same command again to carry on where it stopped (add --relabel if labels were interrupted).');
  process.exit(1);
});
