/**
 * Regression check: every node-halo shape must clear a 24×24 CSS-pixel
 * minimum target size at 1440×900, 390×844 and 320×720.
 *
 * Runs against a built, served app with real Chromium layout rather than
 * recomputing the CSS cascade by hand, so a real layout regression can't
 * slip past a stale recomputation — the same drift risk CLAUDE.md flags for
 * the duplicated LINK_DISTANCE constants in scripts/build-graph.ts /
 * src/graph/simulation.ts. The per-node numeric floor for every
 * degree/neighbour-distance combination is already covered by
 * src/graph/geometry.test.ts; this check only confirms the browser box
 * model agrees with that math.
 *
 * There are only four distinct node shapes (nodeShapePath in
 * src/graph/geometry.ts), so this checks one representative per shape, each
 * via the route a reader actually sees it through. `odin` represents the
 * circle family in the mobile cold open. The mobile focus deliberately has no
 * world, artifact or form, so `midgard`, `mjolnir` and `mare` are measured in
 * their selected views, after runtime.ts re-fits the SVG to each neighbourhood.
 *
 * Requires `dist/` to already be built (`npm run build`) and the Playwright
 * Chromium browser installed (`npx playwright install chromium`).
 */
import { existsSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { startPreviewServer, type PreviewServer } from './preview-server.ts';

const PORT = 4322; // distinct from astro dev's 4321, so both can run at once locally
const BASE_URL = `http://127.0.0.1:${PORT}`;
const MIN_TARGET_PX = 24;

const VIEWPORTS = [
  { label: '1440×900', width: 1440, height: 900 },
  { label: '390×844', width: 390, height: 844 },
  { label: '320×720', width: 320, height: 720 },
] as const;

// One id per shape; otherwise arbitrary within each shape family.
const REPRESENTATIVE_NODES = [
  { id: 'odin', shape: 'circle (deity/human/being/event)', via: 'cold-open' },
  { id: 'midgard', shape: 'hexagon (world/place)', via: 'selected' },
  { id: 'mjolnir', shape: 'lozenge (artifact)', via: 'selected' },
  { id: 'mare', shape: 'double-ring (form)', via: 'selected' },
] as const;

if (!existsSync('dist')) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

async function ready(page: Page): Promise<void> {
  // Set by runtime.ts only after materializing the graph and resolving
  // ?selected= — a precise signal, unlike a networkidle heuristic.
  await page.waitForFunction(() => document.documentElement.dataset.graphRuntime === 'ready');
}

let server: PreviewServer | undefined;
let exitCode = 0;

try {
  server = await startPreviewServer(PORT);

  const browser = await chromium.launch();
  const rows: string[] = [];
  const errors: string[] = [];

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      // Skips runtime.ts's force-simulation warm-up so positions stay pinned
      // to the deterministic prerendered layout (see CLAUDE.md).
      await page.emulateMedia({ reducedMotion: 'reduce' });

      // Cold-open pass: one navigation covers every core representative.
      await page.goto(`${BASE_URL}/`);
      await ready(page);
      for (const node of REPRESENTATIVE_NODES.filter((n) => n.via === 'cold-open')) {
        const box = await page.locator(`g[data-node="${node.id}"] path.node__halo`).boundingBox();
        record(rows, errors, viewport.label, node, box);
      }

      // Selected pass: each non-core representative needs its own navigation.
      for (const node of REPRESENTATIVE_NODES.filter((n) => n.via === 'selected')) {
        await page.goto(`${BASE_URL}/?selected=${node.id}`);
        await ready(page);
        const box = await page.locator(`g[data-node="${node.id}"] path.node__halo`).boundingBox();
        record(rows, errors, viewport.label, node, box);
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log('');
  for (const row of rows) console.log(row);

  if (errors.length > 0) {
    console.error(`\n  ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
    for (const e of errors) console.error(`    ✗ ${e}`);
    console.error('');
    exitCode = 1;
  } else {
    console.log(
      `\n  all ${rows.length} shape × viewport combinations clear ${MIN_TARGET_PX}×${MIN_TARGET_PX} CSS px\n`,
    );
  }
} finally {
  await server?.stop();
}

process.exit(exitCode);

function record(
  rows: string[],
  errors: string[],
  viewportLabel: string,
  node: (typeof REPRESENTATIVE_NODES)[number],
  box: { width: number; height: number } | null,
): void {
  if (!box) {
    errors.push(
      `[${viewportLabel}] ${node.id} (${node.shape}) via ${node.via}: halo not found in the DOM`,
    );
    return;
  }
  const min = Math.min(box.width, box.height);
  const ok = min >= MIN_TARGET_PX;
  rows.push(
    `  ${ok ? '✓' : '✗'} ${viewportLabel.padEnd(10)} ${node.id.padEnd(10)} ${node.shape.padEnd(34)} via ${node.via.padEnd(9)} ${box.width.toFixed(1)}×${box.height.toFixed(1)} px  (≥ ${MIN_TARGET_PX}×${MIN_TARGET_PX})`,
  );
  if (!ok) {
    errors.push(
      `[${viewportLabel}] ${node.id} (${node.shape}) via ${node.via} measured ${box.width.toFixed(1)}×${box.height.toFixed(1)} px, below the ${MIN_TARGET_PX}×${MIN_TARGET_PX} floor.`,
    );
  }
}
