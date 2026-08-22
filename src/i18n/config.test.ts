import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACTIVE_LOCALES,
  isLocale,
  LOCALE_DIR,
  LOCALE_ENDONYMS,
  LOCALE_STATUS,
  LOCALES,
} from './config.ts';

describe('ACTIVE_LOCALES', () => {
  it('excludes every locale still marked planned', () => {
    assert.deepEqual([...ACTIVE_LOCALES].sort(), ['en', 'fi', 'is', 'ja', 'nb']);
  });
});

describe('isLocale', () => {
  it('accepts every registered locale', () => {
    for (const locale of LOCALES) assert.ok(isLocale(locale));
  });

  it('rejects a string that is not a registered locale', () => {
    assert.equal(isLocale('xx'), false);
    assert.equal(isLocale(''), false);
  });
});

describe('locale registry consistency', () => {
  it('gives LOCALE_STATUS, LOCALE_ENDONYMS and LOCALE_DIR an entry for every locale', () => {
    for (const locale of LOCALES) {
      assert.ok(locale in LOCALE_STATUS, `LOCALE_STATUS missing ${locale}`);
      assert.ok(locale in LOCALE_ENDONYMS, `LOCALE_ENDONYMS missing ${locale}`);
      assert.ok(locale in LOCALE_DIR, `LOCALE_DIR missing ${locale}`);
    }
  });

  it('carries no entries beyond the registered locales', () => {
    assert.deepEqual(Object.keys(LOCALE_STATUS).sort(), [...LOCALES].sort());
    assert.deepEqual(Object.keys(LOCALE_ENDONYMS).sort(), [...LOCALES].sort());
    assert.deepEqual(Object.keys(LOCALE_DIR).sort(), [...LOCALES].sort());
  });
});
