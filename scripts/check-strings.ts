/**
 * Fails the build when a user-facing string is hardcoded in the source.
 *
 * A literal in a component is invisible to translators until somebody notices
 * it sitting in English in the middle of a Japanese page. This catches them at
 * the point they are written instead.
 *
 * What counts as user-facing:
 *   - text nodes in .astro templates, outside tags, {expressions}, <style>,
 *     <script> and comments;
 *   - static values of attributes a person can perceive: aria-label, alt,
 *     title, placeholder and friends;
 *   - in .ts, assignments to textContent / innerText / title / ariaLabel, and
 *     setAttribute() calls targeting a perceivable attribute.
 *
 * Escape hatch, for the genuine exceptions — a separator glyph, a lang code, an
 * Old Norse name that is data rather than translatable text:
 *
 *     <!-- i18n-ignore --> in .astro, or // i18n-ignore in .ts
 *
 * on the same line or the line before. Use it rarely and say why next to it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOTS = ['src/components', 'src/pages', 'src/layouts', 'src/graph'];

/** Attributes whose value a person reads or hears. */
const PERCEIVABLE_ATTRS = [
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
  'alt',
  'title',
  'placeholder',
  'download',
];

/** Two or more letters in a row, including the Latin Extended ranges. */
const LOOKS_LIKE_PROSE = /[A-Za-zÀ-ɏḀ-ỿ]{2,}/;

const IGNORE = /i18n-ignore/;

interface Finding {
  file: string;
  line: number;
  text: string;
  why: string;
}

const findings: Finding[] = [];

const walk = (dir: string): string[] => {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (['.astro', '.ts'].includes(extname(full))) out.push(full);
  }
  return out;
};

const lineOf = (source: string, index: number) => source.slice(0, index).split('\n').length;

const isIgnored = (lines: string[], line: number) =>
  IGNORE.test(lines[line - 1] ?? '') || IGNORE.test(lines[line - 2] ?? '');

/**
 * Walk an .astro template, tracking whether we are inside a tag or inside a
 * `{...}` expression, and collect the text that falls outside both. A real
 * parser would be more correct; this is deliberately simple enough to read,
 * and errs towards reporting rather than staying quiet.
 */
const scanAstroTemplate = (template: string, offset: number, file: string, lines: string[]) => {
  let i = 0;
  let inTag = false;
  let braces = 0;
  let quote: string | null = null;
  let run = '';
  let runStart = 0;

  const flushRun = () => {
    const text = run.trim();
    if (text && LOOKS_LIKE_PROSE.test(text) && !text.startsWith('&')) {
      const line = lineOf(template, runStart) + offset;
      if (!isIgnored(lines, line)) {
        findings.push({ file, line, text: text.slice(0, 70), why: 'text node in a template' });
      }
    }
    run = '';
  };

  while (i < template.length) {
    const char = template[i]!;

    if (inTag && quote) {
      if (char === quote) quote = null;
      i++;
      continue;
    }
    if (inTag && (char === '"' || char === "'")) {
      quote = char;
      i++;
      continue;
    }
    if (!inTag && braces === 0 && char === '<') {
      flushRun();
      inTag = true;
      i++;
      continue;
    }
    if (inTag && char === '>') {
      inTag = false;
      i++;
      runStart = i;
      continue;
    }
    if (!inTag && char === '{') {
      flushRun();
      braces++;
      i++;
      continue;
    }
    if (!inTag && char === '}' && braces > 0) {
      braces--;
      i++;
      runStart = i;
      continue;
    }
    if (!inTag && braces === 0) {
      if (run === '') runStart = i;
      run += char;
    }
    i++;
  }
  flushRun();
};

const stripBlocks = (source: string) =>
  source
    .replace(/<style[\s\S]*?<\/style>/gi, (m) => ' '.repeat(m.length))
    .replace(/<script[\s\S]*?<\/script>/gi, (m) => ' '.repeat(m.length))
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));

const scanAttributes = (source: string, file: string, lines: string[]) => {
  const attrPattern = new RegExp(`\\b(${PERCEIVABLE_ATTRS.join('|')})\\s*=\\s*("([^"]*)"|'([^']*)')`, 'g');
  for (const match of source.matchAll(attrPattern)) {
    const value = match[3] ?? match[4] ?? '';
    if (!LOOKS_LIKE_PROSE.test(value)) continue;
    const line = lineOf(source, match.index);
    if (isIgnored(lines, line)) continue;
    findings.push({
      file,
      line,
      text: `${match[1]}="${value.slice(0, 60)}"`,
      why: 'perceivable attribute with a static value',
    });
  }
};

const scanScript = (source: string, file: string, lines: string[]) => {
  const assignment = /\.(textContent|innerText|innerHTML|title|ariaLabel)\s*=\s*(["'`])((?:(?!\2)[\s\S])*)\2/g;
  for (const match of source.matchAll(assignment)) {
    const value = match[3] ?? '';
    if (!LOOKS_LIKE_PROSE.test(value) || value.includes('${')) continue;
    const line = lineOf(source, match.index);
    if (isIgnored(lines, line)) continue;
    findings.push({ file, line, text: `.${match[1]} = ${match[2]}${value.slice(0, 60)}…`, why: 'assigned to a perceivable DOM property' });
  }

  const setAttr = new RegExp(`setAttribute\\(\\s*["'\`](${PERCEIVABLE_ATTRS.join('|')})["'\`]\\s*,\\s*(["'\`])((?:(?!\\2)[\\s\\S])*)\\2`, 'g');
  for (const match of source.matchAll(setAttr)) {
    const value = match[3] ?? '';
    if (!LOOKS_LIKE_PROSE.test(value) || value.includes('${')) continue;
    const line = lineOf(source, match.index);
    if (isIgnored(lines, line)) continue;
    findings.push({ file, line, text: `setAttribute('${match[1]}', '${value.slice(0, 50)}')`, why: 'perceivable attribute set from a literal' });
  }
};

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const source = readFileSync(path, 'utf8');
    const lines = source.split('\n');
    const file = relative(process.cwd(), path);

    if (extname(path) === '.astro') {
      // Astro frontmatter is code, not template. Blank it out but keep the
      // line count so reported line numbers stay correct.
      const fence = source.indexOf('\n---', 3);
      const hasFrontmatter = source.startsWith('---') && fence !== -1;
      const templateStart = hasFrontmatter ? fence + 4 : 0;
      const frontmatter = source.slice(0, templateStart);
      const template = stripBlocks(source.slice(templateStart));
      const offset = frontmatter.split('\n').length - 1;

      scanAstroTemplate(template, offset, file, lines);
      scanAttributes(template, file, lines);
      scanScript(frontmatter, file, lines);
    } else {
      scanScript(source, file, lines);
      scanAttributes(source, file, lines);
    }
  }
}

console.log('');
if (findings.length === 0) {
  console.log(`  no hardcoded user-facing strings in ${ROOTS.join(', ')}.\n`);
  process.exit(0);
}

console.error(`  ${findings.length} hardcoded user-facing string${findings.length === 1 ? '' : 's'}:\n`);
for (const f of findings) {
  console.error(`    ✗ ${f.file}:${f.line}`);
  console.error(`        ${f.text}`);
  console.error(`        ${f.why} — route it through t() from src/i18n\n`);
}
console.error('  If a string genuinely is not translatable — a glyph, a language code, an');
console.error('  Old Norse name from the dataset — mark it with an i18n-ignore comment and');
console.error('  say why on the same line.\n');
process.exit(1);
