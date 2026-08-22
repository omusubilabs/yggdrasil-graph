import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeUrlState, encodeUrlState, type UrlState } from './urlState.ts';

const DEFAULT: UrlState = { selected: null, disputed: false, ragnarok: false };

describe('encodeUrlState', () => {
  it('is empty for the default state', () => {
    assert.equal(encodeUrlState(DEFAULT), '');
  });

  it('encodes selected alone', () => {
    assert.equal(encodeUrlState({ ...DEFAULT, selected: 'odin' }), '?selected=odin');
  });

  it('encodes disputed alone', () => {
    assert.equal(encodeUrlState({ ...DEFAULT, disputed: true }), '?disputed=1');
  });

  it('encodes ragnarok alone', () => {
    assert.equal(encodeUrlState({ ...DEFAULT, ragnarok: true }), '?ragnarok=1');
  });

  it('encodes all three in a fixed order', () => {
    assert.equal(
      encodeUrlState({ selected: 'odin', disputed: true, ragnarok: true }),
      '?selected=odin&disputed=1&ragnarok=1',
    );
  });
});

describe('decodeUrlState', () => {
  it('defaults every field for an empty string', () => {
    assert.deepEqual(decodeUrlState(''), DEFAULT);
  });

  it('accepts a search string with or without a leading "?"', () => {
    assert.deepEqual(decodeUrlState('selected=odin'), decodeUrlState('?selected=odin'));
  });

  it('only treats an exact "1" as true', () => {
    assert.equal(decodeUrlState('?disputed=yes').disputed, false);
    assert.equal(decodeUrlState('?disputed=true').disputed, false);
    assert.equal(decodeUrlState('?disputed=0').disputed, false);
    assert.equal(decodeUrlState('?disputed=1').disputed, true);
  });

  it('ignores unknown params without throwing', () => {
    assert.deepEqual(decodeUrlState('?foo=bar'), DEFAULT);
  });

  it('decodes an empty selected value to an empty string, not null', () => {
    assert.equal(decodeUrlState('?selected=').selected, '');
  });
});

describe('encodeUrlState / decodeUrlState round-trip', () => {
  const cases: UrlState[] = [
    DEFAULT,
    { selected: 'odin', disputed: false, ragnarok: false },
    { selected: null, disputed: true, ragnarok: false },
    { selected: null, disputed: false, ragnarok: true },
    { selected: 'loki', disputed: true, ragnarok: true },
  ];

  for (const state of cases) {
    it(`round-trips ${JSON.stringify(state)}`, () => {
      assert.deepEqual(decodeUrlState(encodeUrlState(state)), state);
    });
  }
});
