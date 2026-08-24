import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filterAnnouncementKey } from './filterAnnouncement.ts';

describe('filterAnnouncementKey', () => {
  it('reports no filter active for the default pair', () => {
    assert.equal(filterAnnouncementKey(false, false), 'filters.noneOnAnnounce');
  });

  it('reports disputed alone', () => {
    assert.equal(filterAnnouncementKey(true, false), 'filters.disputedOnAnnounce');
  });

  it('reports Ragnarök alone', () => {
    assert.equal(filterAnnouncementKey(false, true), 'filters.ragnarokOnAnnounce');
  });

  it('reports both together, regardless of which turned on more recently', () => {
    assert.equal(filterAnnouncementKey(true, true), 'filters.bothOnAnnounce');
  });
});
