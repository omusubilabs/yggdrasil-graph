import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LOCALES } from './config.ts';
import { hasKey, localeFromPath, localePath, sourceKeys, t, useTranslations } from './index.ts';

describe('t', () => {
  it('returns the locale-specific string when the key exists there', () => {
    assert.equal(t('ja', 'nav.home'), 'グラフ');
    assert.equal(t('en', 'nav.home'), 'Graph');
  });

  it('falls back to the source locale for a key the target locale is missing', () => {
    // 'da' is a planned locale with no bundle at all (see BUNDLES in
    // index.ts), so every key falls back to en regardless of how complete
    // the translated locales are.
    assert.equal(t('da', 'nav.home'), t('en', 'nav.home'));
  });

  it('returns the key itself when it resolves nowhere', () => {
    assert.equal(t('en', 'totally.nonexistent.key'), 'totally.nonexistent.key');
  });

  it('interpolates a placeholder from params', () => {
    assert.equal(t('en', 'nav.languageCurrent', { name: 'English' }), 'Current language: English');
  });

  it('leaves a placeholder untouched when params is omitted entirely', () => {
    assert.equal(t('en', 'nav.languageCurrent'), 'Current language: {name}');
  });

  it('leaves a placeholder untouched when params does not supply it', () => {
    assert.equal(t('en', 'nav.languageCurrent', { other: 'x' }), 'Current language: {name}');
  });
});

describe('hasKey', () => {
  it('is true for a key that resolves', () => {
    assert.ok(hasKey('en', 'nav.home'));
    assert.ok(hasKey('ja', 'nav.home'));
  });

  it('is false for a key that does not exist in that locale', () => {
    assert.equal(hasKey('en', 'totally.nonexistent.key'), false);
  });
});

describe('useTranslations', () => {
  it('binds t, .locale and .has to one locale', () => {
    const jaT = useTranslations('ja');
    assert.equal(jaT('nav.home'), t('ja', 'nav.home'));
    assert.equal(jaT.locale, 'ja');
    assert.equal(jaT.has('nav.home'), hasKey('ja', 'nav.home'));
  });
});

describe('sourceKeys', () => {
  it('returns the en key set, sorted', () => {
    const keys = sourceKeys();
    assert.deepEqual(keys, [...keys].sort());
    assert.ok(keys.includes('nav.home'));
  });
});

describe('localeFromPath', () => {
  it('reads a valid locale prefix', () => {
    assert.equal(localeFromPath('/ja/entity/loki'), 'ja');
  });

  it('defaults to en with no prefix', () => {
    assert.equal(localeFromPath('/entity/loki'), 'en');
    assert.equal(localeFromPath('/'), 'en');
  });

  it('defaults to en for an unrecognized prefix', () => {
    assert.equal(localeFromPath('/xx/entity/loki'), 'en');
  });
});

describe('localePath', () => {
  it('does not prefix the default locale', () => {
    assert.equal(localePath('en', '/entity/loki'), '/entity/loki');
    assert.equal(localePath('en', '/'), '/');
  });

  it('prefixes every other locale', () => {
    assert.equal(localePath('ja', '/entity/loki'), '/ja/entity/loki');
    assert.equal(localePath('ja', '/'), '/ja');
  });

  it('collapses redundant leading and trailing slashes', () => {
    assert.equal(localePath('en', '///entity/loki///'), '/entity/loki');
  });

  it('round-trips through localeFromPath for every registered locale, including a planned one', () => {
    for (const locale of LOCALES) {
      assert.equal(localeFromPath(localePath(locale, '/entity/loki')), locale);
    }
  });
});
