import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bloodlineTrace,
  buildCore,
  buildIndex,
  locusKey,
  neighbourhood,
  ragnarokConnection,
  ragnarokOverlay,
  relatedByTag,
  relationsByFamily,
  searchEntities,
  structuralInsight,
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

describe('ragnarokConnection', () => {
  const overlay = ragnarokOverlay(index);

  it('returns null for an entity with no involvement in the cast', () => {
    assert.equal(ragnarokConnection(index, overlay, 'king'), null);
  });

  it('returns null for an unrelated sibling branch, despite sharing an ancestor with a combatant', () => {
    assert.equal(ragnarokConnection(index, overlay, 'heir'), null);
  });

  it('gives a combatant with no parent just its pairing edge', () => {
    const connection = ragnarokConnection(index, overlay, 'beast');
    assert.deepEqual([...connection!.nodeIds].sort(), ['beast', 'champion']);
    assert.deepEqual([...connection!.linkIds], ['champion--beast--slays']);
  });

  it("excludes an untagged pairing from a combatant's connection", () => {
    const connection = ragnarokConnection(index, overlay, 'beast');
    assert.ok(!connection!.linkIds.has('rogue--beast--slays'));
  });

  it('ascends a combatant through multiple generations of ancestors', () => {
    const connection = ragnarokConnection(index, overlay, 'champion');
    assert.deepEqual(
      [...connection!.nodeIds].sort(),
      ['ancestor', 'beast', 'champion', 'progenitor'],
    );
    assert.deepEqual(
      [...connection!.linkIds].sort(),
      [
        'champion--beast--slays',
        'ancestor--champion--parent_of',
        'progenitor--ancestor--parent_of',
      ].sort(),
    );
  });

  it("excludes a combatant's unrelated sibling from its ancestor walk", () => {
    const connection = ragnarokConnection(index, overlay, 'champion');
    assert.ok(!connection!.nodeIds.has('heir'));
    assert.ok(!connection!.linkIds.has('ancestor--heir--parent_of'));
  });

  it('descends a pure lineage node to its combatant and pairing', () => {
    const connection = ragnarokConnection(index, overlay, 'ancestor');
    assert.deepEqual([...connection!.nodeIds].sort(), ['ancestor', 'beast', 'champion']);
    assert.deepEqual(
      [...connection!.linkIds].sort(),
      ['ancestor--champion--parent_of', 'champion--beast--slays'].sort(),
    );
  });

  it('descends a more distant lineage node through the full chain', () => {
    const connection = ragnarokConnection(index, overlay, 'progenitor');
    assert.deepEqual(
      [...connection!.nodeIds].sort(),
      ['ancestor', 'beast', 'champion', 'progenitor'],
    );
    assert.deepEqual(
      [...connection!.linkIds].sort(),
      [
        'progenitor--ancestor--parent_of',
        'ancestor--champion--parent_of',
        'champion--beast--slays',
      ].sort(),
    );
  });
});

describe('structuralInsight', () => {
  const overlay = ragnarokOverlay(index);

  it('flags a pure lineage node as an indirect Ragnarök connection', () => {
    // ancestor also has a contradicted relation (see the fixture comment) —
    // this proves condition 1 outranks condition 2, not merely that it fires.
    assert.deepEqual(structuralInsight(index, overlay, 'ancestor'), { kind: 'ragnarok-indirect' });
  });

  it('does not flag a combatant that has its own direct death relation', () => {
    const insight = structuralInsight(index, overlay, 'champion');
    assert.notEqual(insight?.kind, 'ragnarok-indirect');
  });

  it('flags an entity with a contradicted relation', () => {
    assert.deepEqual(structuralInsight(index, overlay, 'claimant'), { kind: 'contradicted' });
  });

  it('flags an entity connected to a notable figure only by a shared tag', () => {
    assert.deepEqual(structuralInsight(index, overlay, 'queen'), {
      kind: 'tag-only',
      exampleName: 'Sendiboði',
    });
  });

  it('returns null when none of the conditions apply', () => {
    assert.equal(structuralInsight(index, overlay, 'smith'), null);
  });

  it('returns null for an unknown id', () => {
    assert.equal(structuralInsight(index, overlay, 'nobody'), null);
  });
});

describe('bloodlineTrace', () => {
  it('finds the chain from descendant to ancestor', () => {
    const trace = bloodlineTrace(index, 'champion', 'progenitor');
    assert.deepEqual(trace?.nodeIds, ['champion', 'ancestor', 'progenitor']);
    assert.deepEqual(trace?.linkIds, [
      'ancestor--champion--parent_of',
      'progenitor--ancestor--parent_of',
    ]);
  });

  it('returns the same path when the two ids are swapped', () => {
    const forward = bloodlineTrace(index, 'champion', 'progenitor');
    const backward = bloodlineTrace(index, 'progenitor', 'champion');
    assert.deepEqual(forward, backward);
  });

  it('returns null for unrelated nodes', () => {
    assert.equal(bloodlineTrace(index, 'champion', 'beast'), null);
  });

  it('returns null for a pair joined only by a non-parent_of relation', () => {
    assert.equal(bloodlineTrace(index, 'king', 'queen'), null);
  });

  it('returns null for the same node twice', () => {
    assert.equal(bloodlineTrace(index, 'champion', 'champion'), null);
  });

  it('returns null for an unknown id', () => {
    assert.equal(bloodlineTrace(index, 'champion', 'nobody'), null);
  });

  it("returns null for a common-ancestor pair, neither the other's ancestor", () => {
    assert.equal(bloodlineTrace(index, 'champion', 'heir'), null);
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
