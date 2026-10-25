// Platform rules (SPEC.md §1.10, §9): checks on the source files themselves, so a later patch can't quietly break them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git']);
function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (p) => relative(root, p).split('\\').join('/');
const source = files(join(root, 'src')).filter((p) => /\.(js|jsx|mjs)$/.test(p));

test("only src/admin-check.js may import Forge's product-API fetch (backend calls count against the shared pool)", () => {
  const offenders = source.filter((p) => rel(p) !== 'src/admin-check.js' && /from\s+['"]@forge\/api['"]|require\(\s*['"]@forge\/api['"]\s*\)/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(offenders.map(rel), []);
});

test('no outside calls: no fetch() to other sites and no egress in the manifest', () => {
  const manifest = readFileSync(join(root, 'manifest.yml'), 'utf8');
  assert.doesNotMatch(manifest, /^\s*external\s*:/m);
  for (const p of source) assert.doesNotMatch(readFileSync(p, 'utf8'), /\bfetch\s*\(\s*['"`]https?:/, rel(p));
});

// Names @forge/react really exports (read from its type declarations), so a screen can't import a component that
// doesn't exist at runtime (it would fail only when the page renders).
function forgeReactExports() {
  const base = join(root, 'node_modules', '@forge', 'react', 'out');
  const names = new Set();
  const seen = new Set();
  const read = (file) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/export\s+\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
      if (/^\s*type\b/.test(m[0].slice(6))) continue;
      for (const part of m[1].split(',')) {
        const p = part.trim();
        if (!p || p.startsWith('type ')) continue;
        const as = p.split(/\s+as\s+/);
        names.add((as[1] || as[0]).trim());
      }
    }
    for (const m of text.matchAll(/export\s+declare\s+(?:const|function|class)\s+(\w+)/g)) names.add(m[1]);
    for (const m of text.matchAll(/export\s+\*\s+from\s+'([^']+)'/g)) {
      const target = join(dirname(file), m[1]);
      read(existsSync(`${target}.d.ts`) ? `${target}.d.ts` : join(target, 'index.d.ts'));
    }
  };
  read(join(base, 'index.d.ts'));
  return names;
}

test('screens only import UI Kit components that exist', { skip: !existsSync(join(root, 'node_modules', '@forge', 'react')) && 'run npm install first' }, () => {
  const exported = forgeReactExports();
  assert.ok(exported.has('Heading') && exported.has('default'), 'could not read @forge/react exports');
  for (const p of source.filter((f) => /frontend/.test(f))) {
    const text = readFileSync(p, 'utf8');
    for (const m of text.matchAll(/import\s+(\w+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s+'@forge\/react'/g)) {
      for (const part of (m[2] || '').split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0];
        if (name) assert.ok(exported.has(name), `${rel(p)} imports ${name}, which @forge/react doesn't export`);
      }
    }
  }
});

// Tracked files carry no personal names or tool trailers (SPEC.md §2). Model names for Forge LLMs are allowed.
test('no personal names or tool trailers in the files that go into Git', () => {
  const word = ['cla', 'ude'].join('');
  const banned = [['yo', 'sh'], ['co-authored', '-by'], ['generated ', 'with']].map((p) => new RegExp(p.join(''), 'i'));
  const allowedLine = new RegExp(`${word}-(haiku|sonnet|opus)|${word} (haiku|sonnet|opus)|model:\\s*\\[?${word}|^\\s*-\\s*${word}\\s*$|just search|anthropic|forge llm`, 'i');
  const bad = [];
  for (const p of files(root)) {
    const r = rel(p);
    if (r === `${word.toUpperCase()}.md` || r === 'package-lock.json' || r === 'seed-summary.json' || /\.(png|jpg|zip)$/.test(r)) continue;
    readFileSync(p, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (banned.some((re) => re.test(line))) bad.push(`${r}:${i + 1}`);
        else if (new RegExp(word, 'i').test(line) && !allowedLine.test(line)) bad.push(`${r}:${i + 1}`);
      });
  }
  assert.deepEqual(bad, []);
});

test.todo('saved-search resolvers ignore any owner sent by the page (arrives with the saved-searches patch)');
