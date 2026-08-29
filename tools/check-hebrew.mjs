// CHECK 1 - in English mode, not a single Hebrew letter is left on screen.
//
// It drives a full career in English and, after every step, scans everything the
// player can actually see: visible text nodes, user-facing attributes
// (placeholder, title, alt, value, aria-label), <option> labels and the document
// title. Any Hebrew letter is a failure, reported with the element path and the
// offending snippet.
//
// Usage: node tools/check-hebrew.mjs <file.html> [--lang en] [--steps 900]

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { play, progress, startCareer } from './bot.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/check-hebrew.mjs <file.html> [--lang en] [--steps N]'); process.exit(2); }
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const lang = argOf('--lang', 'en');
const steps = Number(argOf('--steps', '900'));
const limit = Number(argOf('--report', '60'));

const SCAN = `(${function scan() {
  // Hebrew letters (block + presentation forms). Punctuation-only is not a letter.
  const HEB = /[א-תׯ-״יִ-ﭏ]/;
  const out = [];
  const seen = new Set();
  const path = (el) => {
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && parts.length < 6) {
      parts.unshift(n.id ? '#' + n.id : n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/)[0] : ''));
      if (n.id) break;
      n = n.parentElement;
    }
    return parts.join('>');
  };
  const visible = (el) => {
    if (!el) return false;
    if (el.nodeType !== 1) return visible(el.parentElement);
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    return true;
  };
  const add = (where, kind, text) => {
    const key = kind + '|' + where + '|' + text;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ where, kind, text });
  };

  if (HEB.test(document.title)) add('<title>', 'title', document.title);
  if (document.documentElement.lang && /^he/i.test(document.documentElement.lang)) add('<html>', 'lang-attr', document.documentElement.lang);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue;
    if (!t || !HEB.test(t)) continue;
    const p = n.parentElement;
    if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) continue;
    if (!visible(p)) continue;
    add(path(p), 'text', t.trim().slice(0, 120));
  }

  for (const el of document.querySelectorAll('[placeholder],[title],[alt],[aria-label],[value]')) {
    for (const a of ['placeholder', 'title', 'alt', 'aria-label', 'value']) {
      const v = el.getAttribute(a);
      if (v && HEB.test(v) && visible(el)) add(path(el), '@' + a, v.slice(0, 120));
    }
  }
  for (const o of document.querySelectorAll('option')) {
    const v = (o.textContent || '') + ' ' + (o.value || '');
    if (HEB.test(v) && visible(o.parentElement)) add(path(o.parentElement), 'option', (o.textContent || '').trim().slice(0, 120));
  }
  return out;
}})()`;

const b = await chromium.launch();
const ctx = await b.newContext();
await ctx.addInitScript(`try { localStorage.setItem('lang', ${JSON.stringify(lang)}); localStorage.setItem('language', ${JSON.stringify(lang)}); } catch (e) {}`);
const page = await ctx.newPage();
await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });

const found = new Map();
const collect = async (phase) => {
  let hits = [];
  try { hits = await page.evaluate(SCAN); } catch { return; }
  for (const h of hits) {
    const key = h.kind + '|' + h.where + '|' + h.text;
    if (!found.has(key)) found.set(key, { ...h, phase, count: 0 });
    found.get(key).count++;
  }
};

await collect('create screen');

// Try to switch language through the UI too, in case the page ignores localStorage.
await page.evaluate(() => {
  const el = document.querySelector('[data-lang-switch], #lang-switch, #lang-toggle, .lang-switch');
  if (el) el.click();
  if (typeof window.setLang === 'function') window.setLang('en');
});
await collect('after lang switch');

await startCareer(page);
await page.waitForTimeout(80);
await collect('career start');

// Scan continuously while playing, so modals get caught while they are open.
const seen = { modal: 0, next: 0, other: 0, wait: 0, stuck: 0 };
let stuckRun = 0;
for (let i = 0; i < steps; i++) {
  await collect('in game');
  let what;
  try { const { step } = await import('./bot.mjs'); what = await step(page, Math.random()); }
  catch { break; }
  seen[what] = (seen[what] || 0) + 1;
  if (what === 'stuck') { if (++stuckRun > 20) break; } else stuckRun = 0;
  await page.waitForTimeout(what === 'wait' || what === 'stuck' ? 120 : 8);
}
await collect('end of run');

// Open every side panel too - those are easy to forget.
await page.evaluate(() => {
  for (const fn of ['toggleHistoryPanel', 'toggleTablePanel', 'toggleEuropeTablePanel', 'toggleTitlesPanel', 'toggleCareerStats', 'toggleTryoutRoster']) {
    if (typeof window[fn] === 'function') { try { window[fn](); } catch (e) {} }
  }
});
await page.waitForTimeout(80);
await collect('panels open');

const where = await progress(page);
await b.close();

const hits = [...found.values()];
console.log(`file      : ${file}`);
console.log(`lang      : ${lang}`);
console.log(`bot       : ${JSON.stringify(seen)}`);
console.log(`reached   : ${JSON.stringify(where)}`);
console.log('');
if (!hits.length) {
  console.log('CHECK 1 (Hebrew in English mode): 0 problems');
  process.exit(0);
}
console.log(`-- Hebrew still visible in ${lang} mode --`);
for (const h of hits.slice(0, limit)) {
  console.log(`   [${h.kind}] ${h.where}  (first seen: ${h.phase})`);
  console.log(`       ${JSON.stringify(h.text)}`);
}
if (hits.length > limit) console.log(`   ... and ${hits.length - limit} more`);
console.log('');
console.log(`CHECK 1 (Hebrew in English mode): ${hits.length} problems`);
process.exit(1);
