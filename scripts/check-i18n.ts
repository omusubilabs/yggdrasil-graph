/**
 * Compares every locale's key set against the source locale and fails on drift.
 *
 * `en` defines the structure. What that means for a given locale depends on its
 * declared status in src/i18n/config.ts:
 *
 *   complete — must have every key `en` has. A missing key is a build failure.
 *   partial  — may be missing keys. May NOT add keys of its own, and may not
 *              ship an empty string for a key it claims to have.
 *   planned  — must have no locale directory at all yet.
 *
 * The asymmetry matters. Missing keys are a known, measured debt that the
 * fallback chain handles gracefully. Extra keys are a different thing entirely:
 * they are either a typo or a string that exists in one language and nowhere
 * else, and both silently rot.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, LOCALE_STATUS, DEFAULT_LOCALE, type Locale } from '../src/i18n/config.ts';

const LOCALES_DIR = 'src/i18n/locales';
const errors: string[] = [];
const notes: string[] = [];

const flatten = (input: unknown, prefix = '', out: Map<string, string> = new Map()) => {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (typeof input === 'string') {
    out.set(prefix, input);
  }
  return out;
};

const loadLocale = (locale: Locale) => {
  const dir = join(LOCALES_DIR, locale);
  if (!existsSync(dir)) return null;
  const merged = new Map<string, string>();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  for (const file of files) {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const [key, value] of flatten(parsed)) {
      if (merged.has(key))
        errors.push(`${locale}: key "${key}" is defined twice, in ${file} and an earlier file`);
      merged.set(key, value);
    }
  }
  return { files, keys: merged };
};

const source = loadLocale(DEFAULT_LOCALE);
if (!source) {
  console.error(
    `\n  the source locale "${DEFAULT_LOCALE}" has no files. Nothing to check against.\n`,
  );
  process.exit(1);
}

// Placeholders must survive translation, or interpolation silently drops data.
const placeholdersIn = (value: string) =>
  new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!));

for (const locale of LOCALES) {
  const status = LOCALE_STATUS[locale];
  const loaded = loadLocale(locale);

  if (status === 'planned') {
    if (loaded) {
      errors.push(
        `${locale}: is declared "planned" but has files in ${LOCALES_DIR}/${locale}. Promote it to "partial" in src/i18n/config.ts.`,
      );
    } else {
      notes.push(`${locale} — planned, no files yet`);
    }
    continue;
  }

  if (!loaded) {
    errors.push(`${locale}: is declared "${status}" but ${LOCALES_DIR}/${locale} does not exist.`);
    continue;
  }

  const missing = [...source.keys.keys()].filter((k) => !loaded.keys.has(k));
  const extra = [...loaded.keys.keys()].filter((k) => !source.keys.has(k));

  for (const key of extra) {
    errors.push(
      `${locale}: has key "${key}", which does not exist in "${DEFAULT_LOCALE}". Add it to the source locale first, or remove it.`,
    );
  }

  for (const [key, value] of loaded.keys) {
    if (value.trim() === '') {
      errors.push(
        `${locale}: key "${key}" is an empty string. Omit the key instead — the fallback will use "${DEFAULT_LOCALE}".`,
      );
    }
    const expected = placeholdersIn(source.keys.get(key) ?? '');
    const actual = placeholdersIn(value);
    for (const name of expected) {
      if (!actual.has(name)) {
        errors.push(
          `${locale}: key "${key}" drops the placeholder {${name}} that "${DEFAULT_LOCALE}" defines.`,
        );
      }
    }
    for (const name of actual) {
      if (!expected.has(name)) {
        errors.push(
          `${locale}: key "${key}" introduces the placeholder {${name}}, which "${DEFAULT_LOCALE}" does not provide.`,
        );
      }
    }
  }

  if (status === 'complete' && missing.length > 0) {
    for (const key of missing.slice(0, 20)) {
      errors.push(`${locale}: is declared "complete" but is missing "${key}".`);
    }
    if (missing.length > 20) {
      errors.push(`${locale}: …and ${missing.length - 20} more missing keys.`);
    }
  }

  const coverage = ((loaded.keys.size / source.keys.size) * 100).toFixed(1);
  const label = locale === DEFAULT_LOCALE ? 'source' : status;
  notes.push(
    `${locale} — ${label}, ${loaded.keys.size}/${source.keys.size} keys (${coverage}%)${
      missing.length > 0 && status === 'partial'
        ? `, ${missing.length} falling back to ${DEFAULT_LOCALE}`
        : ''
    }`,
  );
}

// astro.config.mjs and src/i18n/config.ts must agree, or a locale can have
// translations and no route, or a route and no translations.
const astroConfig = readFileSync('astro.config.mjs', 'utf8');
const declared = astroConfig.match(/locales:\s*\[([^\]]+)\]/)?.[1];
if (!declared) {
  errors.push('astro.config.mjs: could not find an i18n `locales` array to cross-check.');
} else {
  const inAstro = [...declared.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]!);
  const inConfig = [...LOCALES];
  if (inAstro.join(',') !== inConfig.join(',')) {
    errors.push(
      `astro.config.mjs declares locales [${inAstro.join(', ')}] but src/i18n/config.ts declares [${inConfig.join(', ')}]. They must match exactly, in the same order.`,
    );
  }
}

console.log('');
for (const note of notes) console.log(`  ${note}`);

if (errors.length > 0) {
  console.error(`\n  ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.error(`    ✗ ${e}`);
  console.error('');
  process.exit(1);
}
console.log('\n  locales are in step.\n');
