/**
 * Mobile graph regression check at the two viewports that exposed the
 * original usability failures. This runs against the built app in Chromium so
 * CSS layout, d3 zoom and focus behaviour are tested together.
 *
 * Requires `dist/` and Playwright Chromium, like check-target-size.ts.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium, type Page } from 'playwright';

const PORT = 4323;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const MAX_BAR_HEIGHT = 104;
const MAX_PEEK_HEIGHT = 180;
const MIN_LABEL_HEIGHT = 12;
const MIN_TARGET_SIZE = 24;
const FOCUS_IDS = [
  'loki',
  'angrboda',
  'fenrir',
  'jormungandr',
  'odin',
  'thor',
  'heimdall',
  'tyr',
] as const;
const VIEWPORTS = [
  { label: '390×844', width: 390, height: 844 },
  { label: '320×568', width: 320, height: 568 },
] as const;

if (!existsSync('dist')) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

async function waitForServer(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry below while Astro starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${url} did not respond within ${timeoutMs}ms`);
}

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.graphRuntime === 'ready');
}

let server: ChildProcess | undefined;
let exitCode = 0;

try {
  server = spawn('npx', ['astro', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    env: { ...process.env, ASTRO_PREVIEW_BACKGROUND: '0' },
    stdio: 'pipe',
  });
  server.on('error', (error) => {
    console.error('Failed to start `astro preview`:', error);
    process.exit(1);
  });
  await waitForServer(`${BASE_URL}/`);

  const browser = await chromium.launch();
  const rows: string[] = [];
  const errors: string[] = [];

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${BASE_URL}/`);
      await ready(page);

      const initial = await page.evaluate((focusIds) => {
        const barElement = document.querySelector('[data-controls-bar]');
        const canvasElement = document.querySelector('[data-graph-canvas]');
        const barRect = barElement?.getBoundingClientRect();
        const canvasRect = canvasElement?.getBoundingClientRect();
        return {
          bar: barRect ? { height: barRect.height, width: barRect.width } : null,
          canvas: canvasRect ? { height: canvasRect.height, width: canvasRect.width } : null,
          drawerExpanded: document
            .querySelector('[data-controls-drawer-toggle]')
            ?.getAttribute('aria-expanded'),
          drawerDisplay: getComputedStyle(document.querySelector('[data-controls-drawer]')!)
            .display,
          nodes: focusIds.map((id) => {
            const node = document.querySelector(`[data-node="${id}"]`)!;
            const label = node.querySelector('text')!.getBoundingClientRect();
            const halo = node.querySelector('.node__halo')!.getBoundingClientRect();
            return {
              id,
              display: getComputedStyle(node).display,
              labelHeight: label.height,
              haloHeight: halo.height,
              haloWidth: halo.width,
            };
          }),
          visibleNonFocusCore: [
            ...document.querySelectorAll(
              '[data-graph-nodes] > [data-node]:not([data-mobile-focus])',
            ),
          ].filter((node) => getComputedStyle(node).display !== 'none').length,
        };
      }, FOCUS_IDS);

      check(
        errors,
        initial.bar !== null && initial.bar.height <= MAX_BAR_HEIGHT,
        viewport.label,
        `control bar is ${initial.bar?.height.toFixed(1) ?? 'missing'}px (≤ ${MAX_BAR_HEIGHT}px)`,
      );
      check(
        errors,
        initial.bar !== null &&
          initial.canvas !== null &&
          initial.bar.height <= initial.canvas.height * 0.25,
        viewport.label,
        'control bar occupies at most 25% of the canvas',
      );
      check(
        errors,
        initial.drawerExpanded === 'false' && initial.drawerDisplay === 'none',
        viewport.label,
        'display options start closed',
      );
      check(
        errors,
        initial.visibleNonFocusCore === 0,
        viewport.label,
        'non-focus core nodes are hidden initially',
      );
      for (const node of initial.nodes) {
        check(
          errors,
          node.display !== 'none',
          viewport.label,
          `${node.id} is visible in the mobile focus`,
        );
        check(
          errors,
          node.labelHeight >= MIN_LABEL_HEIGHT,
          viewport.label,
          `${node.id} label is ${node.labelHeight.toFixed(1)}px (≥ ${MIN_LABEL_HEIGHT}px)`,
        );
        check(
          errors,
          Math.min(node.haloWidth, node.haloHeight) >= MIN_TARGET_SIZE,
          viewport.label,
          `${node.id} target is ${node.haloWidth.toFixed(1)}×${node.haloHeight.toFixed(1)}px (≥ ${MIN_TARGET_SIZE}px)`,
        );
      }

      const drawerToggle = page.locator('[data-controls-drawer-toggle]');
      await drawerToggle.click();
      check(
        errors,
        (await drawerToggle.getAttribute('aria-expanded')) === 'true' &&
          (await page.locator('[data-controls-drawer]').isVisible()),
        viewport.label,
        'display options open',
      );
      await drawerToggle.press('Escape');
      check(
        errors,
        (await drawerToggle.getAttribute('aria-expanded')) === 'false' &&
          !(await page.locator('[data-controls-drawer]').isVisible()),
        viewport.label,
        'Escape closes display options',
      );

      await drawerToggle.click();
      const disputed = page.locator('[data-filter="disputed"]');
      await disputed.check();
      check(
        errors,
        new URL(page.url()).searchParams.get('disputed') === '1',
        viewport.label,
        'filter changes still sync to the URL',
      );
      await disputed.uncheck();
      await drawerToggle.press('Escape');

      const focusToggle = page.locator('[data-mobile-focus-toggle]');
      const urlBeforeCameraChange = page.url();
      await focusToggle.click();
      check(
        errors,
        (await page.locator('[data-graph]').getAttribute('data-mobile-overview')) !== null &&
          page.url() === urlBeforeCameraChange,
        viewport.label,
        'overview is camera-only and does not change the URL',
      );
      await focusToggle.click();

      const search = page.locator('[data-entity-search]');
      await search.fill('Loki');
      const results = page.locator('[data-search-results], #graph-search-results');
      const resultsBox = await results.boundingBox();
      check(
        errors,
        resultsBox !== null && resultsBox.height <= Math.min(viewport.height * 0.4, 288) + 1,
        viewport.label,
        'search results respect the 40svh/18rem height cap',
      );
      await page.locator('[data-search-id="loki"]').click();

      const selection = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-entity-panel]')!;
        return {
          panelHeight: panel.getBoundingClientRect().height,
          state: panel.dataset.sheetState,
          figureInert: document.querySelector<HTMLElement>('[data-graph-canvas]')!.inert,
          controlsInert: document.querySelector<HTMLElement>('[data-graph-controls]')!.inert,
          expandFocused: document.activeElement?.hasAttribute('data-panel-expand') ?? false,
          transform: document.querySelector('[data-graph-viewport]')?.getAttribute('transform'),
        };
      });
      check(
        errors,
        selection.state === 'peek' && selection.panelHeight <= MAX_PEEK_HEIGHT,
        viewport.label,
        `selected sheet starts at ${selection.panelHeight.toFixed(1)}px in peek state`,
      );
      check(
        errors,
        !selection.figureInert && !selection.controlsInert,
        viewport.label,
        'graph and controls remain non-inert',
      );
      check(
        errors,
        selection.expandFocused,
        viewport.label,
        'search selection moves focus to the sheet expand button',
      );

      const dragPoint = await page.evaluate(() => {
        const controls = document.querySelector('[data-controls-bar]')!.getBoundingClientRect();
        const panel = document.querySelector('[data-entity-panel]')!.getBoundingClientRect();
        const canvas = document.querySelector('[data-graph-canvas]')!.getBoundingClientRect();
        return {
          x: canvas.right - 36,
          y: controls.bottom + (panel.top - controls.bottom) / 2,
        };
      });
      await page.mouse.move(dragPoint.x, dragPoint.y);
      await page.mouse.down();
      await page.mouse.move(dragPoint.x - 64, dragPoint.y - 36, { steps: 4 });
      await page.mouse.up();
      const transformAfterDrag = await page
        .locator('[data-graph-viewport]')
        .getAttribute('transform');
      check(
        errors,
        transformAfterDrag !== selection.transform,
        viewport.label,
        'dragging changes the SVG transform while the sheet is open',
      );

      await page.locator('[data-panel-expand]').click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>('[data-entity-panel]')?.dataset.sheetState ===
          'expanded',
      );
      const expanded = await overlayMetrics(page);
      check(
        errors,
        expanded.state === 'expanded' &&
          expanded.panelHeight <= Math.min(viewport.height * 0.7, 576) + 1,
        viewport.label,
        'sheet expands within the 70svh/36rem ceiling',
      );
      check(
        errors,
        expanded.nodeTop >= expanded.controlsBottom && expanded.nodeBottom <= expanded.panelTop,
        viewport.label,
        'expanded framing keeps Loki between the top and bottom overlays',
      );

      await page.locator('[data-panel-expand]').click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>('[data-entity-panel]')?.dataset.sheetState ===
            'peek' &&
          document.querySelector('[data-entity-panel]')!.getBoundingClientRect().height <= 180,
      );
      const collapsed = await overlayMetrics(page);
      check(
        errors,
        collapsed.state === 'peek' && collapsed.panelHeight <= MAX_PEEK_HEIGHT,
        viewport.label,
        `sheet collapses to ${collapsed.state ?? 'missing'} at ${collapsed.panelHeight.toFixed(1)}px (≤ ${MAX_PEEK_HEIGHT}px)`,
      );
      check(
        errors,
        collapsed.nodeTop >= collapsed.controlsBottom && collapsed.nodeBottom <= collapsed.panelTop,
        viewport.label,
        'collapsed framing keeps Loki between the top and bottom overlays',
      );

      rows.push(`  ✓ ${viewport.label}: mobile focus, controls, sheet and pan exercised`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log('');
  for (const row of rows) console.log(row);
  if (errors.length > 0) {
    console.error(`\n  ${errors.length} mobile UX regression${errors.length === 1 ? '' : 's'}:`);
    for (const error of errors) console.error(`    ✗ ${error}`);
    console.error('');
    exitCode = 1;
  } else {
    console.log('\n  both mobile viewport regressions passed\n');
  }
} finally {
  server?.kill();
}

process.exit(exitCode);

function check(errors: string[], condition: boolean, viewport: string, description: string): void {
  if (!condition) errors.push(`[${viewport}] ${description}`);
}

async function overlayMetrics(page: Page): Promise<{
  controlsBottom: number;
  nodeBottom: number;
  nodeTop: number;
  panelHeight: number;
  panelTop: number;
  state: string | undefined;
}> {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-graph-canvas]')!.getBoundingClientRect();
    const controls = document.querySelector('[data-controls-bar]')!.getBoundingClientRect();
    const panel = document.querySelector('[data-entity-panel]')!.getBoundingClientRect();
    const node = document.querySelector('[data-node="loki"]')!.getBoundingClientRect();
    return {
      controlsBottom: controls.bottom - canvas.top,
      nodeBottom: node.bottom - canvas.top,
      nodeTop: node.top - canvas.top,
      panelHeight: panel.height,
      panelTop: panel.top - canvas.top,
      state: document.querySelector<HTMLElement>('[data-entity-panel]')?.dataset.sheetState,
    };
  });
}
