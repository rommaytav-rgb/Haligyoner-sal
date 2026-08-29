// Byte-for-byte integrity of the embedded base64 symbols (team logos etc.).
//
// Extracts every data: URI payload from both files, hashes each one, and
// compares the two multisets. Any added, removed, reordered-away or altered
// blob is reported. Nothing here rewrites anything - it only reads.
//
// Usage: node tools/check-assets.mjs <before.html> <after.html>

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [before, after] = process.argv.slice(2);
if (!before || !after) { console.error('usage: node tools/check-assets.mjs <before.html> <after.html>'); process.exit(2); }

const RE = /data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)/gi;

function extract(file) {
  const src = readFileSync(file, 'utf8');
  const list = [];
  for (const m of src.matchAll(RE)) {
    const mime = m[1];
    const payload = m[2].replace(/\s+/g, '');
    list.push({
      mime,
      len: payload.length,
      sha: createHash('sha256').update(Buffer.from(payload, 'base64')).digest('hex'),
    });
  }
  return list;
}

const A = extract(before);
const B = extract(after);

const tally = (list) => {
  const m = new Map();
  for (const x of list) {
    const k = x.mime + ':' + x.sha;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};
const ta = tally(A), tb = tally(B);

const problems = [];
for (const [k, n] of ta) {
  const got = tb.get(k) || 0;
  if (got !== n) problems.push(`  count changed  ${k.slice(0, 60)}...  before=${n} after=${got}`);
}
for (const [k, n] of tb) if (!ta.has(k)) problems.push(`  NEW blob       ${k.slice(0, 60)}...  x${n}`);
if (A.length !== B.length) problems.unshift(`  total count    before=${A.length} after=${B.length}`);

// Order matters too: a reshuffle would still swap which logo a team gets.
let orderOk = A.length === B.length;
if (orderOk) for (let i = 0; i < A.length; i++) if (A[i].sha !== B[i].sha || A[i].mime !== B[i].mime) { problems.push(`  order/content differs at index ${i}`); orderOk = false; break; }

console.log(`before : ${before}  (${A.length} data URIs)`);
console.log(`after  : ${after}  (${B.length} data URIs)`);
console.log('');
if (!problems.length) {
  console.log(`ASSETS: 0 problems - all ${A.length} embedded symbols are byte-identical and in the same order`);
  process.exit(0);
}
console.log('-- embedded asset differences --');
for (const p of problems.slice(0, 40)) console.log(p);
if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
console.log('');
console.log(`ASSETS: ${problems.length} problems`);
process.exit(1);
