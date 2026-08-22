/**
 * Locale registry. Astro's i18n config in astro.config.mjs must stay in step
 * with LOCALES — the check script asserts it.
 */

export const LOCALES = ['en', 'ja', 'is', 'nb', 'sv', 'da', 'fi'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/**
 * How complete each locale is, and what `npm run i18n:check` demands of it.
 *
 * - `source`   — `en`. Defines the key structure everything else is measured against.
 * - `complete` — must have every key `en` has. Missing keys fail the build.
 * - `partial`  — may be missing keys, but may not invent keys of its own, and
 *                may not ship an empty string for a key it claims to have.
 * - `planned`  — no locale directory yet. Routing knows about it; nothing else does.
 *
 * `ja` shipped as `partial` at first, deliberately: a placeholder locale
 * proves nothing, while a real one that is genuinely incomplete exercises the
 * fallback chain, the font loading, the `lang` attribute and the hreflang
 * alternates the way a future translator will actually hit them. It is now
 * `complete`.
 */
export type LocaleStatus = 'source' | 'complete' | 'partial' | 'planned';

export const LOCALE_STATUS: Record<Locale, LocaleStatus> = {
  en: 'source',
  ja: 'complete',
  is: 'complete',
  nb: 'complete',
  sv: 'partial',
  da: 'planned',
  fi: 'complete',
};

/**
 * Endonyms — each language's name for itself. These are data, not translations,
 * for the same reason `names.non` is: they do not change with the surrounding
 * locale. A language switcher that renders "Japanese" to an English reader and
 * "日本語" to a Japanese one is a worse language switcher.
 */
export const LOCALE_ENDONYMS: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  is: 'Íslenska',
  nb: 'Norsk bokmål',
  sv: 'Svenska',
  da: 'Dansk',
  fi: 'Suomi',
};

/** All target locales are LTR. The attribute is emitted explicitly regardless. */
export const LOCALE_DIR: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ja: 'ltr',
  is: 'ltr',
  nb: 'ltr',
  sv: 'ltr',
  da: 'ltr',
  fi: 'ltr',
};

/** Locales that have at least some content, and therefore routes. */
export const ACTIVE_LOCALES = LOCALES.filter((l) => LOCALE_STATUS[l] !== 'planned');

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);
