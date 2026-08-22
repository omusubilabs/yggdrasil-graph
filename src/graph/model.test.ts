import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCore,
  buildIndex,
  locusKey,
  neighbourhood,
  ragnarokOverlay,
  relatedByTag,
  relationsByFamily,
  searchEntities,
} from './model.ts';
import { sampleGraph } from './fixtures/sample-graph.ts';
import type { GraphNode } from './types.ts';

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
      ['aide', 'bridge', 'confidant', 'envoy', 'gate', 'mentor', 'shape'].sort(),
    );
    assert.equal(links.size, 8);
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
      ['kinship', 'counsel', 'social', 'location', 'transformation'],
    );
  });

  it('exposes service as outgoing on the servant and incoming on the served figure', () => {
    const [, servant] = relationsByFamily(index, 'envoy').find(([f]) => f === 'social')!;
    const [, served] = relationsByFamily(index, 'aide').find(([f]) => f === 'social')!;
    assert.deepEqual(
      servant.map((view) => [view.link.type, view.outgoing, view.other?.id]),
      [['serves', true, 'aide']],
    );
    assert.deepEqual(
      served.map((view) => [view.link.type, view.outgoing, view.other?.id]),
      [['serves', false, 'envoy']],
    );
  });

  it('exposes a symmetric hostage exchange from both endpoints', () => {
    const [, watcher] = relationsByFamily(index, 'watcher').find(([f]) => f === 'social')!;
    const [, confidant] = relationsByFamily(index, 'confidant').find(([f]) => f === 'social')!;
    assert.deepEqual(
      watcher.map((view) => [view.link.type, view.link.directed, view.other?.id]),
      [['hostage_exchanged_for', false, 'confidant']],
    );
    assert.deepEqual(
      confidant
        .filter((view) => view.link.type === 'hostage_exchanged_for')
        .map((view) => [view.link.type, view.link.directed, view.other?.id]),
      [['hostage_exchanged_for', false, 'watcher']],
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

  it('exposes a transformation as outgoing on the actor and incoming on the form', () => {
    const [, outgoing] = relationsByFamily(index, 'envoy').find(([f]) => f === 'transformation')!;
    const [, incoming] = relationsByFamily(index, 'shape').find(([f]) => f === 'transformation')!;
    assert.deepEqual(
      outgoing.map((view) => [view.link.type, view.outgoing, view.other?.id]),
      [['becomes', true, 'shape']],
    );
    assert.deepEqual(
      incoming.map((view) => [view.link.type, view.outgoing, view.other?.id]),
      [['becomes', false, 'envoy']],
    );
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

describe('searchEntities', () => {
  it('matches ids, canonical names and aliases without requiring accents', () => {
    assert.equal(searchEntities(sampleGraph, 'kongr')[0]?.id, 'king');
    assert.equal(searchEntities(sampleGraph, 'sovereign')[0]?.id, 'king');
    assert.equal(searchEntities(sampleGraph, 'queen')[0]?.id, 'queen');
  });

  it('orders exact matches before prefixes and substrings', () => {
    const results = searchEntities(sampleGraph, 'king');
    assert.equal(results[0]?.id, 'king');
  });

  it('returns at most eight results', () => {
    assert.ok(searchEntities(sampleGraph, 'e').length <= 8);
  });
});

describe('ragnarokOverlay', () => {
  const overlay = ragnarokOverlay(index);

  it('counts a death relation as a terminal pairing only when both ends are tagged', () => {
    assert.ok(overlay.pairingLinkIds.has('champion--beast--slays'));
    assert.ok(!overlay.pairingLinkIds.has('rogue--beast--slays'));
  });

  it('collects both endpoints of a pairing as combatants', () => {
    assert.ok(overlay.combatantIds.has('champion'));
    assert.ok(overlay.combatantIds.has('beast'));
    assert.ok(!overlay.combatantIds.has('rogue'));
  });

  it('walks parent_of upward through multiple generations', () => {
    assert.deepEqual([...overlay.lineageNodeIds].sort(), ['ancestor', 'progenitor']);
    assert.deepEqual(
      [...overlay.lineageLinkIds].sort(),
      ['ancestor--champion--parent_of', 'progenitor--ancestor--parent_of'].sort(),
    );
  });

  it('produces no lineage for a combatant with no parent_of edge', () => {
    // beast has no parent_of edge at all; it must not appear as anyone's ancestor.
    assert.ok(!overlay.lineageNodeIds.has('beast'));
  });

  it('still counts beast as a combatant via its tagged pairing, despite the excluded one', () => {
    assert.ok(overlay.combatantIds.has('beast'));
  });
});

describe('buildCore', () => {
  it('fills a 400-node graph to the fixed limit deterministically', () => {
    const nodes: GraphNode[] = Array.from({ length: 400 }, (_, coreRank) => ({
      id: `human-${String(coreRank).padStart(3, '0')}`,
      type: 'human',
      classes: ['humans'],
      names: { non: `Maðr ${coreRank}`, anglicized: `Human ${coreRank}` },
      attestations: [],
      tags: [],
      x: coreRank,
      y: coreRank % 20,
      degree: 400 - coreRank,
      coreRank,
    }));
    const data = { nodes, links: [], sources: [], tagIndex: {} };
    const first = buildCore(data);
    const second = buildCore(data);
    assert.equal(first.nodeIds.length, 36);
    assert.deepEqual(first, second);
    assert.deepEqual(first.nodeIds.slice(0, 3), ['human-000', 'human-001', 'human-002']);
  });

  it('keeps the full Ragnarǫk pairing and lineage even above a smaller limit', () => {
    const core = buildCore(sampleGraph, 2);
    assert.deepEqual(
      new Set(core.nodeIds),
      new Set(['champion', 'beast', 'ancestor', 'progenitor']),
    );
  });

  it('only includes links whose endpoints are both in the core', () => {
    const core = buildCore(sampleGraph, 2);
    const ids = new Set(core.nodeIds);
    for (const id of core.linkIds) {
      const link = index.linkById.get(id)!;
      assert.ok(ids.has(link.from));
      assert.ok(ids.has(link.to));
    }
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

  it('uses an explicit page override for embedded prose', () => {
    assert.equal(
      locusKey(index, { work: 'song-of-crowns', locus: '332-336', unit: 'page' }),
      'sources.page',
    );
  });
});
