/**
 * Translation lookup.
 *
 * Every user-facing string in this application comes through `t()`. Components
 * must never contain a literal — `npm run check:strings` fails the build if one
 * appears, because a hardcoded string is invisible to translators until someone
 * notices it untranslated in production.
 *
 * Lookup falls back to the source locale key by key, not file by file, so a
 * partial locale renders its own strings where it has them and English where it
 * does not, rather than falling off a cliff.
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from './config.ts';

import enUi from './locales/en/ui.json' with { type: 'json' };
import enEntities from './locales/en/entities.json' with { type: 'json' };
import enRelations from './locales/en/relations.json' with { type: 'json' };
import jaUi from './locales/ja/ui.json' with { type: 'json' };
import jaEntities from './locales/ja/entities.json' with { type: 'json' };
import jaRelations from './locales/ja/relations.json' with { type: 'json' };
import fiUi from './locales/fi/ui.json' with { type: 'json' };

type Dict = Record<string, unknown>;

/**
 * Bundles are assembled statically rather than by glob so that a missing locale
 * file is a type error at build time instead of an empty object at runtime.
 */
const BUNDLES: Partial<Record<Locale, Dict[]>> = {
  en: [enUi as Dict, enEntities as Dict, enRelations as Dict],
  ja: [jaUi as Dict, jaEntities as Dict, jaRelations as Dict],
  fi: [fiUi as Dict],
};

const flatten = (input: Dict, prefix = '', out: Record<string, string> = {}) => {
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Dict, path, out);
    } else if (typeof value === 'string') {
      out[path] = value;
    }
  }
  return out;
};

const TABLES = new Map<Locale, Record<string, string>>();
const tableFor = (locale: Locale): Record<string, string> => {
  const cached = TABLES.get(locale);
  if (cached) return cached;
  const merged: Record<string, string> = {};
  for (const bundle of BUNDLES[locale] ?? []) Object.assign(merged, flatten(bundle));
  TABLES.set(locale, merged);
  return merged;
};

export const hasKey = (locale: Locale, key: string): boolean => key in tableFor(locale);

/**
 * Look up `key`, interpolating `{name}` placeholders from `params`.
 *
 * A key that resolves nowhere returns the key itself. That is loud enough to
 * spot in review and in a screenshot, and it never renders a blank where a
 * sentence should be.
 */
export const t = (
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string => {
  const raw = tableFor(locale)[key] ?? tableFor(DEFAULT_LOCALE)[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
};

/** A translator bound to one locale, so components read `t('panel.title')`. */
export const useTranslations = (locale: Locale) => {
  const bound = (key: string, params?: Record<string, string | number>) => t(locale, key, params);
  bound.locale = locale;
  bound.has = (key: string) => hasKey(locale, key);
  return bound;
};

export type Translate = ReturnType<typeof useTranslations>;

/** Every key the source locale defines. Used by the i18n checker and tests. */
export const sourceKeys = (): string[] => Object.keys(tableFor(DEFAULT_LOCALE)).sort();

/**
 * The locale segment of a URL path, or the default when there is none.
 * `/ja/entity/loki` → `ja`; `/entity/loki` → `en`.
 */
export const localeFromPath = (pathname: string): Locale => {
  const first = pathname.split('/').filter(Boolean)[0];
  return first && isLocale(first) ? first : DEFAULT_LOCALE;
};

/**
 * Build a path for `locale`. English lives at the root because
 * `prefixDefaultLocale` is false; every other locale is prefixed.
 */
export const localePath = (locale: Locale, path = '/'): string => {
  const clean = `/${path.replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/';
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;
};

export { DEFAULT_LOCALE, isLocale };
export type { Locale };
