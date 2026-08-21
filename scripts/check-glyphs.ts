/**
 * Asserts that every font face this site ships can actually draw Old Norse.
 *
 * The brief said to verify this rather than assume it, and the verification
 * immediately earned its keep: IBM Plex Mono, the obvious choice for the
 * citation apparatus, has no ǫ or Ǫ — which rules it out of a project whose
 * subject matter includes Vǫluspá, Mjǫllnir, Jǫrmungandr, Hǫðr and Skǫll.
 * Source Code Pro is here because it passed this check and Plex did not.
 *
 * This opens the shipped binaries and reads their character map. It is not
 * checking a `unicode-range` declaration, which only says which subset file a
 * browser should fetch and promises nothing about what is inside it.
 *
 * Note that þ ð æ ø live in Latin-1 Supplement and therefore in the `latin`
 * subset, while ǫ ę ǿ are Latin Extended-B and live in `latin-ext`. A face is
 * only sound if the union of the subsets we load covers everything.
 */
import * as fontkit from 'fontkit';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * Everything the dataset can put on screen: the Old Norse orthography from the
 * brief, plus the capitals and the ligatures that turn up in normalized forms.
 */
const REQUIRED = [...'þðæøǫęǿáéíóúýÞÐÆØǪÁÉÍÓÚÝǽœÆßÖöäåÅÄ'];

interface FaceSpec {
  /** Human name, for the report. */
  label: string;
  /** npm package directory under node_modules. */
  pkg: string;
  /** File-name prefix inside the package's files/ directory. */
  slug: string;
  /** Subsets we actually load. Their union must cover REQUIRED. */
  subsets: string[];
  /** Every weight/style combination the stylesheet declares. */
  faces: string[];
}

/**
 * The faces this site loads. Keep in step with src/styles/fonts.css — the
 * cross-check at the bottom of this file fails the build if an @fontsource
 * import appears in src/ that is not listed here.
 */
const MANIFEST: FaceSpec[] = [
  {
    label: 'Alegreya (display, entity names)',
    pkg: '@fontsource/alegreya',
    slug: 'alegreya',
    subsets: ['latin', 'latin-ext'],
    faces: ['400-normal', '400-italic', '500-normal', '700-normal'],
  },
  {
    label: 'Inter Variable (interface chrome)',
    pkg: '@fontsource-variable/inter',
    slug: 'inter',
    subsets: ['latin', 'latin-ext'],
    faces: ['wght-normal', 'wght-italic'],
  },
  {
    label: 'Source Code Pro (ids, loci, citations)',
    pkg: '@fontsource/source-code-pro',
    slug: 'source-code-pro',
    subsets: ['latin', 'latin-ext'],
    faces: ['400-normal', '600-normal'],
  },
];

/**
 * ja checks kana/kanji only, not Latin Extended-B — it loads behind the Latin
 * faces on /ja/ routes. Coverage is the union of ~124 sliced unicode-range
 * files, not one file per subset.
 */
const JAPANESE = {
  label: 'Noto Sans JP Variable (ja routes only)',
  pkg: '@fontsource-variable/noto-sans-jp',
  filePattern: /^noto-sans-jp-\d+-wght-normal\.woff2$/,
  required: [...'あアぁー一神話巨人世界典拠語関係詳細戻選択巨古ノルド'],
};

const errors: string[] = [];
const rows: string[] = [];

const openFont = async (path: string): Promise<number[] | null> => {
  try {
    return (await fontkit.open(path)).characterSet;
  } catch {
    return null;
  }
};

const checkFace = async (spec: FaceSpec, required: string[]) => {
  const dir = join('node_modules', spec.pkg, 'files');
  if (!existsSync(dir)) {
    errors.push(`${spec.label}: ${spec.pkg} is not installed. Run npm ci.`);
    return;
  }
  const available = readdirSync(dir);

  for (const face of spec.faces) {
    const covered = new Set<number>();
    const found: string[] = [];

    for (const subset of spec.subsets) {
      // Prefer .woff2 (what ships) and fall back to .woff (same cmap).
      const candidates = [`${spec.slug}-${subset}-${face}.woff2`, `${spec.slug}-${subset}-${face}.woff`];
      const file = candidates.find((f) => available.includes(f));
      if (!file) {
        errors.push(`${spec.label}: no file for subset "${subset}" at weight/style "${face}". Expected one of ${candidates.join(' or ')} in ${dir}.`);
        continue;
      }
      const chars = await openFont(join(dir, file));
      if (!chars) {
        errors.push(`${spec.label}: ${file} could not be parsed.`);
        continue;
      }
      found.push(subset);
      for (const cp of chars) covered.add(cp);
    }

    const missing = required.filter((ch) => !covered.has(ch.codePointAt(0)!));
    if (missing.length > 0) {
      errors.push(
        `${spec.label} @ ${face}: cannot draw ${missing.join(' ')}. ` +
          `Every face this site loads must render the full Old Norse orthography — pick a different family rather than hoping the fallback catches it.`,
      );
    }
    rows.push(
      `  ${missing.length === 0 ? '✓' : '✗'} ${spec.label.padEnd(38)} ${face.padEnd(12)} ${String(covered.size).padStart(5)} codepoints  [${found.join(' + ')}]`,
    );
  }
};

for (const spec of MANIFEST) await checkFace(spec, REQUIRED);

{
  const dir = join('node_modules', JAPANESE.pkg, 'files');
  if (!existsSync(dir)) {
    errors.push(`${JAPANESE.label}: ${JAPANESE.pkg} is not installed. Run npm ci.`);
  } else {
    const slices = readdirSync(dir).filter((f) => JAPANESE.filePattern.test(f));
    const covered = new Set<number>();
    for (const file of slices) {
      for (const cp of (await openFont(join(dir, file))) ?? []) covered.add(cp);
    }
    const missing = JAPANESE.required.filter((ch) => !covered.has(ch.codePointAt(0)!));
    if (slices.length === 0) {
      errors.push(`${JAPANESE.label}: no slice files matched ${JAPANESE.filePattern}. The package layout has changed.`);
    }
    if (missing.length > 0) {
      errors.push(`${JAPANESE.label}: cannot draw ${missing.join(' ')} across its ${slices.length} slices.`);
    }
    rows.push(
      `  ${missing.length === 0 && slices.length > 0 ? '✓' : '✗'} ${JAPANESE.label.padEnd(38)} ${'wght'.padEnd(12)} ${String(covered.size).padStart(5)} codepoints  [${slices.length} slices]`,
    );
  }
}

const walk = (dir: string): string[] => {
  let out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (['.astro', '.ts', '.css'].includes(extname(full))) out.push(full);
  }
  return out;
};

const declared = new Set([...MANIFEST.map((s) => s.pkg), JAPANESE.pkg]);
const imported = new Set<string>();
for (const file of walk('src')) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/['"](@fontsource(?:-variable)?\/[a-z0-9-]+)\//g)) {
    imported.add(match[1]!);
  }
}
for (const pkg of imported) {
  if (!declared.has(pkg)) {
    errors.push(`${pkg} is imported somewhere in src/ but is not in this script's MANIFEST, so its glyph coverage is unchecked. Add it.`);
  }
}
for (const pkg of declared) {
  if (imported.size > 0 && !imported.has(pkg)) {
    errors.push(`${pkg} is in the MANIFEST but nothing in src/ imports it. Remove it from the manifest or from package.json.`);
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
console.log(`\n  every shipped face draws ${REQUIRED.join('')}\n`);
