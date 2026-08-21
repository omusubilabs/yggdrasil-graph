#!/usr/bin/env node
/**
 * Reports the gzipped JavaScript weight of the initial route and fails if it
 * exceeds the project's budget.
 *
 * "Initial route" means exactly what the browser must download to render and
 * interact with `/`: the module scripts the HTML references directly, plus
 * anything it modulepreloads. Chunks that are only reached through a dynamic
 * `import()` — the force simulation and the graph data — are reported
 * separately and deliberately do not count against the budget. That split is
 * the whole point of the lazy-loading architecture; see CLAUDE.md.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';

const DIST = resolve('dist');
const BUDGET_BYTES = 150 * 1024;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

try {
  await stat(DIST);
} catch {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const html = await readFile(join(DIST, 'index.html'), 'utf8');

// Anything the entry HTML pulls in eagerly.
const eager = new Set();
for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)) eager.add(m[1]);
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)) eager.add(m[1]);

const allJs = (await walk(DIST)).filter((f) => f.endsWith('.js'));
const eagerPaths = [...eager].map((href) => join(DIST, href.replace(/^\//, '')));
const eagerSet = new Set(eagerPaths);
const lazyPaths = allJs.filter((f) => !eagerSet.has(f));

let eagerTotal = 0;
const rows = [];
for (const p of eagerPaths) {
  const gz = gzipSync(await readFile(p)).length;
  eagerTotal += gz;
  rows.push([p.slice(DIST.length + 1), gz]);
}

let lazyTotal = 0;
const lazyRows = [];
for (const p of lazyPaths) {
  const gz = gzipSync(await readFile(p)).length;
  lazyTotal += gz;
  lazyRows.push([p.slice(DIST.length + 1), gz]);
}

rows.sort((a, b) => b[1] - a[1]);
lazyRows.sort((a, b) => b[1] - a[1]);

console.log('Initial route (/) — eagerly loaded JavaScript, gzipped:');
if (rows.length === 0) console.log('  (none — the route ships zero eager JS)');
for (const [name, gz] of rows) console.log(`  ${kb(gz).padStart(9)}  ${name}`);
console.log(`  ${'—'.repeat(9)}`);
console.log(`  ${kb(eagerTotal).padStart(9)}  total   (budget ${kb(BUDGET_BYTES)})`);

console.log('\nLazy chunks — fetched on demand, outside the budget:');
if (lazyRows.length === 0) console.log('  (none)');
for (const [name, gz] of lazyRows) console.log(`  ${kb(gz).padStart(9)}  ${name}`);
console.log(`  ${'—'.repeat(9)}`);
console.log(`  ${kb(lazyTotal).padStart(9)}  total`);

if (eagerTotal > BUDGET_BYTES) {
  console.error(`\nFAIL: initial route is ${kb(eagerTotal)} gzipped, over the ${kb(BUDGET_BYTES)} budget.`);
  process.exit(1);
}
console.log(`\nOK: initial route is within budget (${kb(BUDGET_BYTES - eagerTotal)} to spare).`);
