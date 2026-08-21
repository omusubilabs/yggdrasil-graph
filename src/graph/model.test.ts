import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildIndex, locusKey, neighbourhood, relatedByTag, relationsByFamily } from './model.ts';
import { sampleGraph } from './fixtures/sample-graph.ts';

const index = buildIndex(sampleGraph);

describe('buildIndex', () => {
  it('indexes every node, link and source by id', () => {
    assert.equal(index.nodeById.size, sampleGraph.nodes.length);
    assert.equal(index.linkById.size, sampleGraph.links.length);
    assert.equal(index.sourceById.size, sampleGraph.sources.length);
  });

  it('registers a link on both endpoints, in both directions', () => {
    const kingLinks = index.incident.get('king') ?? [];
    const queenLinks = index.incident.get('queen') ?? [];
    assert.equal(kingLinks.length, 1);
    assert.equal(queenLinks.length, 1);
    assert.equal(kingLinks[0]?.id, queenLinks[0]?.id);
  });

  it('registers both edges of a parallel pair on each endpoint', () => {
    const wolfLinks = index.incident.get('wolf') ?? [];
    const serpentLinks = index.incident.get('serpent') ?? [];
    assert.equal(wolfLinks.length, 2);
    assert.equal(serpentLinks.length, 2);
    assert.deepEqual(
      new Set(wolfLinks.map((l) => l.id)),
      new Set(['wolf--serpent--slays', 'serpent--wolf--slays']),
    );
  });

  it('leaves an entity with no relations absent from incident and neighbours', () => {
    assert.equal(index.incident.get('loner'), undefined);
    assert.equal(index.neighbours.get('loner'), undefined);
  });

  it('keeps neighbours symmetric', () => {
    assert.ok(index.neighbours.get('king')?.has('queen'));
    assert.ok(index.neighbours.get('queen')?.has('king'));
  });

  it('collapses a parallel pair to one neighbour despite two links', () => {
    assert.equal(index.neighbours.get('wolf')?.size, 1);
    assert.ok(index.neighbours.get('wolf')?.has('serpent'));
  });
});

describe('neighbourhood', () => {
  it('includes the origin even when it has no relations', () => {
    const { nodes, links } = neighbourhood(index, 'loner');
    assert.deepEqual([...nodes], ['loner']);
    assert.equal(links.size, 0);
  });

  it('is one hop: nodes and links come only from directly incident links', () => {
    const { nodes, links } = neighbourhood(index, 'envoy');
    assert.deepEqual(
      [...nodes].sort(),
      ['aide', 'bridge', 'confidant', 'envoy', 'gate', 'mentor'].sort(),
    );
    assert.equal(links.size, 5);
  });

  it('counts a parallel pair as two links but two nodes, not three', () => {
    const { nodes, links } = neighbourhood(index, 'wolf');
    assert.deepEqual([...nodes].sort(), ['serpent', 'wolf']);
    assert.equal(links.size, 2);
  });
});

describe('relationsByFamily', () => {
  it('returns only families the entity participates in, in FAMILY_ORDER', () => {
    const grouped = relationsByFamily(index, 'envoy');
    assert.deepEqual(
      grouped.map(([family]) => family),
      ['kinship', 'location'],
    );
  });

  it('sorts outgoing before incoming, then by type, then by the other name', () => {
    const [, kinship] = relationsByFamily(index, 'envoy').find(([f]) => f === 'kinship')!;
    assert.deepEqual(
      kinship.map((v) => [v.link.type, v.outgoing, v.other?.id]),
      [
        ['blood_brother_of', true, 'confidant'],
        ['fosters', true, 'aide'],
        ['fosters', false, 'mentor'],
      ],
    );
  });

  it('breaks ties within a type by the other entity name', () => {
    const [, location] = relationsByFamily(index, 'envoy').find(([f]) => f === 'location')!;
    assert.deepEqual(
      location.map((v) => v.other?.id),
      ['bridge', 'gate'],
    );
  });

  it('returns an empty list for an id with no incident links', () => {
    assert.deepEqual(relationsByFamily(index, 'loner'), []);
  });
});

describe('relatedByTag', () => {
  it('ranks entities sharing more tags above entities sharing fewer', () => {
    const related = relatedByTag(index, 'queen');
    assert.deepEqual(
      related.map((r) => r.node.id),
      ['envoy', 'watcher'],
    );
    assert.equal(related[0]?.tags.length, 2);
    assert.equal(related[1]?.tags.length, 1);
  });

  it('excludes an adjacent entity even when it shares a tag', () => {
    const related = relatedByTag(index, 'queen');
    assert.ok(!related.some((r) => r.node.id === 'king'));
  });

  it('truncates to the given limit', () => {
    const related = relatedByTag(index, 'queen', 1);
    assert.deepEqual(
      related.map((r) => r.node.id),
      ['envoy'],
    );
  });

  it('returns nothing for an entity with no tags', () => {
    assert.deepEqual(relatedByTag(index, 'loner'), []);
  });

  it('returns nothing for an unknown id', () => {
    assert.deepEqual(relatedByTag(index, 'nobody'), []);
  });
});

describe('locusKey', () => {
  it('reads sources.stanza for a stanza-numbered work', () => {
    assert.equal(locusKey(index, 'song-of-crowns'), 'sources.stanza');
  });

  it('reads sources.chapter for a chapter-numbered work', () => {
    assert.equal(locusKey(index, 'chronicle-of-halls'), 'sources.chapter');
  });

  it('defaults to sources.chapter when locusUnit is unset', () => {
    assert.equal(locusKey(index, 'untitled-fragment'), 'sources.chapter');
  });

  it('defaults to sources.chapter for an unknown work', () => {
    assert.equal(locusKey(index, 'nonexistent-work'), 'sources.chapter');
  });
});
