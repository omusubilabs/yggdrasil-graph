import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildIndex } from './model.ts';
import { buildEntityJsonLd } from './structured-data.ts';
import { sampleGraph } from './fixtures/sample-graph.ts';
import type { GraphData, GraphLink, GraphNode, Source } from './types.ts';

const index = buildIndex(sampleGraph);

const jsonLdFor = (id: string) =>
  buildEntityJsonLd({
    index,
    id,
    url: `https://example.test/entity/${id}`,
    name: index.nodeById.get(id)!.names.anglicized,
    alternateName: index.nodeById.get(id)!.names.non,
    inLanguage: 'en',
  });

describe('buildEntityJsonLd: @type mapping', () => {
  it('maps deity to Thing', () => {
    assert.equal(jsonLdFor('king')['@type'], 'Thing');
  });

  it('maps place to Place', () => {
    assert.equal(jsonLdFor('bridge')['@type'], 'Place');
    assert.equal(jsonLdFor('gate')['@type'], 'Place');
  });

  it('maps artifact to Thing', () => {
    assert.equal(jsonLdFor('blade')['@type'], 'Thing');
  });
});

describe('buildEntityJsonLd: name fields', () => {
  it('omits alternateName when it equals name', () => {
    const jsonLd = buildEntityJsonLd({
      index,
      id: 'king',
      url: 'https://example.test/entity/king',
      name: 'King',
      alternateName: 'King',
      inLanguage: 'en',
    });
    assert.equal('alternateName' in jsonLd, false);
  });

  it('includes alternateName when it differs from name', () => {
    const jsonLd = jsonLdFor('king');
    assert.equal(jsonLd.name, 'King');
    assert.equal(jsonLd.alternateName, 'Kóngr');
  });

  it('omits description when undefined', () => {
    const jsonLd = jsonLdFor('king');
    assert.equal('description' in jsonLd, false);
  });

  it('includes description when provided', () => {
    const jsonLd = buildEntityJsonLd({
      index,
      id: 'king',
      url: 'https://example.test/entity/king',
      name: 'King',
      description: 'A ruler.',
      inLanguage: 'en',
    });
    assert.equal(jsonLd.description, 'A ruler.');
  });
});

describe('buildEntityJsonLd: citation', () => {
  it('dedupes and formats sourced relations in incident order', () => {
    const jsonLd = jsonLdFor('envoy');
    assert.deepEqual(jsonLd.citation, [
      'Song of Crowns 2',
      'Song of Crowns 3',
      'Song of Crowns 4',
      'Song of Crowns 5',
      'Chronicle of Halls 1',
      'Chronicle of Halls 2',
    ]);
  });

  it('omits citation entirely when the only relation is unsourced', () => {
    const jsonLd = jsonLdFor('blade');
    assert.equal('citation' in jsonLd, false);
  });
});

describe('buildEntityJsonLd: certainty filter', () => {
  const node = (partial: Omit<GraphNode, 'x' | 'y' | 'degree' | 'coreRank'>): GraphNode => ({
    ...partial,
    x: 0,
    y: 0,
    degree: 0,
    coreRank: 0,
  });
  const link = (partial: Omit<GraphLink, 'id' | 'curve'>): GraphLink => ({
    ...partial,
    id: `${partial.from}--${partial.to}--${partial.type}`,
    curve: 0,
  });

  const sources: Source[] = [
    { id: 'reliable-work', kind: 'work', titles: { non: 'Áreiðanlegt', en: 'Reliable Work' }, date: 'undated' },
    { id: 'shaky-work', kind: 'work', titles: { non: 'Vafasamt', en: 'Shaky Work' }, date: 'undated' },
  ];

  const graph: GraphData = {
    version: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      node({
        id: 'alpha',
        type: 'deity',
        classes: ['aesir'],
        names: { non: 'Alfa', anglicized: 'Alpha' },
        attestations: [],
        tags: [],
      }),
      node({
        id: 'beta',
        type: 'deity',
        classes: ['aesir'],
        names: { non: 'Beta', anglicized: 'Beta' },
        attestations: [],
        tags: [],
      }),
      node({
        id: 'gamma',
        type: 'deity',
        classes: ['aesir'],
        names: { non: 'Gamma', anglicized: 'Gamma' },
        attestations: [],
        tags: [],
      }),
    ],
    links: [
      link({
        from: 'alpha',
        to: 'beta',
        type: 'married_to',
        directed: false,
        certainty: 'attested',
        sources: [{ work: 'reliable-work', locus: '1' }],
        family: 'kinship',
      }),
      link({
        from: 'alpha',
        to: 'gamma',
        type: 'sibling_of',
        directed: false,
        certainty: 'disputed',
        sources: [{ work: 'shaky-work', locus: '9' }],
        family: 'kinship',
      }),
    ],
    sources,
    tagIndex: {},
    bounds: [0, 0, 0, 0],
  };

  const certaintyIndex = buildIndex(graph);

  it('includes citations from attested relations', () => {
    const jsonLd = buildEntityJsonLd({
      index: certaintyIndex,
      id: 'alpha',
      url: 'https://example.test/entity/alpha',
      name: 'Alpha',
      inLanguage: 'en',
    });
    assert.ok(jsonLd.citation?.includes('Reliable Work 1'));
  });

  it('excludes citations from disputed relations', () => {
    const jsonLd = buildEntityJsonLd({
      index: certaintyIndex,
      id: 'alpha',
      url: 'https://example.test/entity/alpha',
      name: 'Alpha',
      inLanguage: 'en',
    });
    assert.ok(!jsonLd.citation?.includes('Shaky Work 9'));
    assert.equal(jsonLd.citation?.length, 1);
  });
});
