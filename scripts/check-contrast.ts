/**
 * Asserts that --ink-faded and --verdigris keep a deliberate safety margin
 * above the WCAG AA 4.5:1 floor for normal text, against every vellum
 * surface they can sit on, in both supported states (default and
 * prefers-contrast: more). The binding case is --vellum-deep, not the page
 * background.
 *
 * Also asserts that the --class-* graph-node hues clear the WCAG 1.4.11
 * non-text 3:1 floor against every vellum surface. These tokens are only ever
 * used as SVG fill/stroke, never text, so 3:1 is the rule that applies to
 * them, not the 4.5:1 text floor above.
 *
 * Reads hex values straight out of tokens.css/global.css rather than
 * duplicating them here, so this can't silently drift out of sync with the
 * tokens it protects.
 */
import { readFileSync } from 'node:fs';

// A round, clearly deliberate ~11% margin over the 4.5:1 AA floor for normal
// text — not tuned to be the smallest value that happens to pass today.
const MIN_CONTRAST = 5.0;

// The WCAG 1.4.11 floor for non-text graphical objects (node fill/stroke).
const MIN_CONTRAST_NONTEXT = 3.0;

// verdigris-deep (link hover) is real text and already clears the margin, so
// it's a free regression guard to include.
const FG_TOKENS = ['ink-faded', 'verdigris', 'verdigris-deep'] as const;
const BG_TOKENS = ['vellum', 'vellum-deep', 'vellum-pale'] as const;

const CLASS_TOKENS = [
  'class-aesir',
  'class-vanir',
  'class-jotnar',
  'class-humans',
  'class-beings',
  'class-worlds',
  'class-artifacts',
] as const;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const VAR_RE = /^var\(--([\w-]+)\)$/;

function relativeLuminance(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lighter = Math.max(relativeLuminance(hexA), relativeLuminance(hexB));
  const darker = Math.min(relativeLuminance(hexA), relativeLuminance(hexB));
  return (lighter + 0.05) / (darker + 0.05);
}

function extractHexTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(match[1]!, match[2]!);
  }
  return tokens;
}

/** Raw, unresolved `--name: value;` pairs from the more-contrast block — values may be hex, `var(--other)`, or unrelated (e.g. color-mix()). */
function extractMoreContrastOverrides(css: string): Map<string, string> {
  const overrides = new Map<string, string>();
  const block = css.match(/@media \(prefers-contrast: more\)\s*{\s*:root\s*{([\s\S]*?)}\s*}/);
  if (!block) return overrides;
  for (const match of block[1]!.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    overrides.set(match[1]!, match[2]!.trim());
  }
  return overrides;
}

function resolveHex(
  name: string,
  base: Map<string, string>,
  overrides: Map<string, string>,
  seen = new Set<string>(),
): string | undefined {
  if (seen.has(name)) return undefined; // cyclic var() chain
  seen.add(name);

  const raw = overrides.get(name);
  if (raw !== undefined) {
    if (HEX_RE.test(raw)) return raw;
    const varMatch = raw.match(VAR_RE);
    if (varMatch) return resolveHex(varMatch[1]!, base, overrides, seen);
    return undefined; // e.g. color-mix(...) — not a token this check needs
  }
  return base.get(name);
}

const tokensCss = readFileSync('src/styles/tokens.css', 'utf8');
const globalCss = readFileSync('src/styles/global.css', 'utf8');

const baseTokens = extractHexTokens(tokensCss);
const moreOverrides = extractMoreContrastOverrides(globalCss);

const errors: string[] = [];
const rows: string[] = [];

const states: Array<{ label: string; resolve: (name: string) => string | undefined }> = [
  { label: 'default', resolve: (name) => baseTokens.get(name) },
  { label: 'more-contrast', resolve: (name) => resolveHex(name, baseTokens, moreOverrides) },
];

for (const state of states) {
  for (const fg of FG_TOKENS) {
    const fgHex = state.resolve(fg);
    if (!fgHex) {
      errors.push(`[${state.label}] --${fg} not found — has it been renamed or removed?`);
      continue;
    }
    for (const bg of BG_TOKENS) {
      const bgHex = state.resolve(bg);
      if (!bgHex) {
        errors.push(`[${state.label}] --${bg} not found — has it been renamed or removed?`);
        continue;
      }
      const ratio = contrastRatio(fgHex, bgHex);
      const ok = ratio >= MIN_CONTRAST;
      const pair = `--${fg} on --${bg}`;
      rows.push(
        `  ${ok ? '✓' : '✗'} ${state.label.padEnd(14)} ${pair.padEnd(28)} ${fgHex} / ${bgHex}  ${ratio.toFixed(3)}:1  (≥ ${MIN_CONTRAST}:1)`,
      );
      if (!ok) {
        errors.push(
          `[${state.label}] ${pair} is only ${ratio.toFixed(3)}:1, below the ${MIN_CONTRAST}:1 safety margin (${fgHex} on ${bgHex}).`,
        );
      }
    }
  }
}

for (const fg of CLASS_TOKENS) {
  const fgHex = baseTokens.get(fg);
  if (!fgHex) {
    errors.push(`--${fg} not found — has it been renamed or removed?`);
    continue;
  }
  for (const bg of BG_TOKENS) {
    const bgHex = baseTokens.get(bg);
    if (!bgHex) {
      errors.push(`--${bg} not found — has it been renamed or removed?`);
      continue;
    }
    const ratio = contrastRatio(fgHex, bgHex);
    const ok = ratio >= MIN_CONTRAST_NONTEXT;
    const pair = `--${fg} on --${bg}`;
    rows.push(
      `  ${ok ? '✓' : '✗'} ${'non-text'.padEnd(14)} ${pair.padEnd(28)} ${fgHex} / ${bgHex}  ${ratio.toFixed(3)}:1  (≥ ${MIN_CONTRAST_NONTEXT}:1)`,
    );
    if (!ok) {
      errors.push(
        `[non-text] ${pair} is only ${ratio.toFixed(3)}:1, below the ${MIN_CONTRAST_NONTEXT}:1 non-text floor (${fgHex} on ${bgHex}).`,
      );
    }
  }
}

console.log('');
for (const row of rows) console.log(row);

if (errors.length > 0) {
  console.error(`\n  ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.error(`    ✗ ${e}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\n  all ${rows.length} combinations clear their floor (${MIN_CONTRAST}:1 text, ${MIN_CONTRAST_NONTEXT}:1 non-text)\n`,
);
