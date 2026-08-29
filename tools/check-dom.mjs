// CHECK 2 - every element the code writes to must exist in the page.
//
// Strict by construction: it asks the real document, and a missing element is
// reported as a failure. There is no forgiving wrapper anywhere in here.
//
//  Pass A (static)  - every literal id in the source is looked up with
//                     document.getElementById() and must not come back null.
//  Pass B (runtime) - document.getElementById / querySelector are instrumented
//                     before the page loads; any call that returns null while a
//                     bot actually plays the game is recorded with its stack.
//
// Usage: node tools/check-dom.mjs <file.html> [--lang he|en] [--steps 400]

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { play, progress, startCareer } from './bot.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/check-dom.mjs <file.html> [--lang en] [--steps N]'); process.exit(2); }
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const lang = argOf('--lang', 'he');
const steps = Number(argOf('--steps', '400'));

const src = readFileSync(file, 'utf8');

// Literal ids the code touches.
const ids = new Set();
for (const m of src.matchAll(/getElementById\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) ids.add(m[1]);
// Literal selectors the code touches.
const sels = new Set();
for (const m of src.matchAll(/querySelector(?:All)?\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) sels.add(m[1]);

const INSTRUMENT = `
window.__domMisses = [];
(function () {
  const gid = document.getElementById.bind(document);
  window.__rawGid = gid;
  window.__rawQs = document.querySelector.bind(document);
  const qs  = document.querySelector.bind(document);
  const qsa = document.querySelectorAll.bind(document);
  const note = (kind, arg) => {
    const st = (new Error().stack || '').split('\\n').slice(3, 6).join(' | ');
    window.__domMisses.push({ kind, arg, stack: st });
  };
  document.getElementById = function (id) {
    const el = gid(id);
    if (el === null) note('getElementById', id);
    return el;
  };
  document.querySelector = function (s) {
    const el = qs(s);
    if (el === null) note('querySelector', s);
    return el;
  };
  document.querySelectorAll = function (s) {
    const list = qsa(s);
    if (list.length === 0) note('querySelectorAll(empty)', s);
    return list;
  };
})();
`;

const b = await chromium.launch();
const ctx = await b.newContext();
await ctx.addInitScript(`try { localStorage.setItem('lang', ${JSON.stringify(lang)}); localStorage.setItem('language', ${JSON.stringify(lang)}); } catch (e) {}`);
await ctx.addInitScript(INSTRUMENT);
const page = await ctx.newPage();

const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.message || e)));

await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });

// --- Pass A, at load ---
const lookup = (list) => page.evaluate(({ ids, sels }) => ({
  missingIds: ids.filter(id => window.__rawGid(id) === null),
  missingSels: sels.filter(s => { try { return window.__rawQs(s) === null; } catch { return false; } }),
}), { ids: [...ids], sels: [...sels] });

const atLoad = await lookup();

await startCareer(page);
await page.waitForTimeout(60);
const afterStart = await lookup();

const played = await play(page, steps);
const where = await progress(page);

// Anything still missing after the game has been driven is genuinely absent.
const atEnd = await lookup();

const misses = await page.evaluate(() => window.__domMisses);
await b.close();

// Runtime misses collapsed per (kind, arg).
const byArg = new Map();
for (const m of misses) {
  const k = m.kind + ' ' + m.arg;
  if (!byArg.has(k)) byArg.set(k, { ...m, count: 0 });
  byArg.get(k).count++;
}

const staticMissing = atEnd.missingIds;
const staticMissingSels = atEnd.missingSels;
const runtime = [...byArg.values()].filter(m => !m.kind.startsWith('querySelectorAll'));

console.log(`file      : ${file}`);
console.log(`lang      : ${lang}`);
console.log(`literals  : ${ids.size} ids, ${sels.size} selectors`);
console.log(`bot       : ${JSON.stringify(played)}`);
console.log(`reached   : ${JSON.stringify(where)}`);
console.log('');

let problems = 0;

console.log('-- Pass A: literal ids/selectors not present in the document --');
if (!staticMissing.length && !staticMissingSels.length) {
  console.log('   0 problems');
} else {
  for (const id of staticMissing) {
    const everSeen = atLoad.missingIds.includes(id) && afterStart.missingIds.includes(id);
    console.log(`   MISSING id   #${id}${everSeen ? '' : ' (present earlier, gone now)'}`);
    problems++;
  }
  for (const s of staticMissingSels) { console.log(`   MISSING sel  ${s}`); problems++; }
}

console.log('');
console.log('-- Pass B: lookups that returned null while the game ran --');
if (!runtime.length) {
  console.log('   0 problems');
} else {
  for (const m of runtime.sort((a, z) => z.count - a.count)) {
    console.log(`   NULL x${m.count}  ${m.kind}("${m.arg}")`);
    if (m.stack) console.log(`            at ${m.stack}`);
    problems++;
  }
}

console.log('');
console.log('-- Uncaught page errors --');
if (!pageErrors.length) console.log('   0 problems');
else { for (const e of [...new Set(pageErrors)]) { console.log(`   ERROR ${e}`); problems++; } }

console.log('');
console.log(problems === 0 ? 'CHECK 2 (DOM): 0 problems' : `CHECK 2 (DOM): ${problems} problems`);
process.exit(problems === 0 ? 0 : 1);
