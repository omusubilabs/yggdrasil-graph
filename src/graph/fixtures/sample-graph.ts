/**
 * A small synthetic `GraphData` for unit tests. Deliberately not the real
 * dataset: adding entity #37 to data/ must never break a test that only cares
 * about `model.ts`'s logic, and these tests should run without a build step.
 *
 * Names are invented, not mythological, so a reader never mistakes the
 * fixture for real content that needs a citation.
 */
import type { GraphData, GraphLink, GraphNode, Source } from '../types.ts';

const node = (
  partial: Omit<GraphNode, 'x' | 'y' | 'degree' | 'coreRank'>,
  i: number,
): GraphNode => ({
  ...partial,
  x: i * 10,
  y: i * 10,
  degree: 0,
  coreRank: i,
});

const link = (partial: Omit<GraphLink, 'id' | 'curve'>): GraphLink => ({
  ...partial,
  id: `${partial.from}--${partial.to}--${partial.type}`,
  curve: 0,
});

const nodes: GraphNode[] = [
  // Married pair: adjacent to each other, both tagged "ruler". Queen also
  // carries "ragnarok-participant", used below to test relatedByTag's
  // tag-count ranking.
  node(
    {
      id: 'king',
      type: 'human',
      classes: ['humans'],
      names: { non: 'Kóngr', anglicized: 'King' },
      aliases: ['Sovereign'],
      attestations: [],
      tags: ['ruler'],
    },
    0,
  ),
  node(
    {
      id: 'queen',
      type: 'deity',
      classes: ['aesir'],
      names: { non: 'Dróttning', anglicized: 'Queen' },
      attestations: [],
      tags: ['ruler', 'ragnarok-participant'],
    },
    1,
  ),
  // Shares both of queen's tags but is NOT adjacent to her — relatedByTag
  // should surface this one, ranked above watcher.
  node(
    {
      id: 'envoy',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Sendiboði', anglicized: 'Envoy' },
      attestations: [],
      tags: ['ruler', 'ragnarok-participant'],
    },
    2,
  ),
  // Shares only "ruler" with queen, and is also not adjacent to her —
  // ranks below envoy in relatedByTag(queen).
  node(
    {
      id: 'watcher',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Vörðr', anglicized: 'Watcher' },
      attestations: [],
      tags: ['ruler'],
    },
    3,
  ),
  // envoy's household, used to exercise relationsByFamily's sort: two
  // outgoing kinship links of different types (tests the type tiebreak),
  // one incoming kinship link (tests outgoing-before-incoming), and two
  // outgoing location links to different-named others (tests the name
  // tiebreak).
  node(
    {
      id: 'confidant',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Trúnaðarvinur', anglicized: 'Confidant' },
      attestations: [],
      tags: [],
    },
    4,
  ),
  node(
    {
      id: 'aide',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Aðstoðarmaður', anglicized: 'Aide' },
      attestations: [],
      tags: [],
    },
    5,
  ),
  node(
    {
      id: 'mentor',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Leiðbeinandi', anglicized: 'Mentor' },
      attestations: [],
      tags: [],
    },
    6,
  ),
  node(
    {
      id: 'bridge',
      type: 'place',
      classes: ['worlds'],
      names: { non: 'Brú', anglicized: 'Bridge' },
      attestations: [],
      tags: [],
    },
    7,
  ),
  node(
    {
      id: 'gate',
      type: 'place',
      classes: ['worlds'],
      names: { non: 'Hlið', anglicized: 'Gate' },
      attestations: [],
      tags: [],
    },
    8,
  ),
  // A pair that kills each other — two parallel "slays" edges, mirroring
  // Þórr and Jǫrmungandr, to test that both directions register as distinct
  // incident links rather than collapsing into one.
  node(
    {
      id: 'wolf',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Úlfr', anglicized: 'Wolf' },
      attestations: [],
      tags: ['predator'],
    },
    9,
  ),
  node(
    {
      id: 'serpent',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Ormr', anglicized: 'Serpent' },
      attestations: [],
      tags: ['predator'],
    },
    10,
  ),
  // A simple single-link pair for the plain-case possession/neighbourhood
  // tests.
  node(
    {
      id: 'smith',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Smiðr', anglicized: 'Smith' },
      attestations: [],
      tags: ['craftsman'],
    },
    11,
  ),
  node(
    {
      id: 'blade',
      type: 'artifact',
      classes: ['artifacts'],
      names: { non: 'Sax', anglicized: 'Blade' },
      attestations: [],
      tags: [],
    },
    12,
  ),
  // No relations, no tags — the defensive case for buildIndex/neighbourhood.
  node(
    {
      id: 'loner',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Einfari', anglicized: 'Loner' },
      attestations: [],
      tags: [],
    },
    13,
  ),
  // A small, isolated subgraph for ragnarokOverlay, kept off every other node
  // so it can't perturb the incident/neighbourhood counts asserted elsewhere.
  node(
    {
      id: 'champion',
      type: 'deity',
      classes: ['aesir'],
      names: { non: 'Kappi', anglicized: 'Champion' },
      attestations: [],
      tags: ['ragnarok-participant'],
    },
    14,
  ),
  node(
    {
      id: 'beast',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Dýr', anglicized: 'Beast' },
      attestations: [],
      tags: ['ragnarok-participant'],
    },
    15,
  ),
  // Untagged, so its kill of beast must NOT count as a terminal pairing.
  node(
    {
      id: 'rogue',
      type: 'being',
      classes: ['beings'],
      names: { non: 'Útlagi', anglicized: 'Rogue' },
      attestations: [],
      tags: [],
    },
    16,
  ),
  // champion's parent and grandparent, to exercise the multi-hop lineage walk.
  node(
    {
      id: 'ancestor',
      type: 'deity',
      classes: ['aesir'],
      names: { non: 'Forfaðir', anglicized: 'Ancestor' },
      attestations: [],
      tags: [],
    },
    17,
  ),
  node(
    {
      id: 'progenitor',
      type: 'deity',
      classes: ['aesir'],
      names: { non: 'Ættfaðir', anglicized: 'Progenitor' },
      attestations: [],
      tags: [],
    },
    18,
  ),
  // A form node, used to prove that transformation relations participate in
  // the same neighbourhood and relation grouping model as every other edge.
  node(
    {
      id: 'shape',
      type: 'form',
      classes: ['beings'],
      names: { non: 'Hamr', anglicized: 'Shape' },
      attestations: [],
      tags: [],
    },
    19,
  ),
];

const links: GraphLink[] = [
  link({
    from: 'king',
    to: 'queen',
    type: 'married_to',
    directed: false,
    certainty: 'attested',
    sources: [{ work: 'song-of-crowns', locus: '1' }],
    family: 'kinship',
  }),
  link({
    from: 'envoy',
    to: 'confidant',
    type: 'blood_brother_of',
    directed: false,
    certainty: 'attested',
    sources: [{ work: 'song-of-crowns', locus: '2' }],
    family: 'kinship',
  }),
  link({
    from: 'envoy',
    to: 'aide',
    type: 'fosters',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'song-of-crowns', locus: '3' }],
    family: 'kinship',
  }),
  link({
    from: 'mentor',
    to: 'envoy',
    type: 'fosters',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'song-of-crowns', locus: '4' }],
    family: 'kinship',
  }),
  link({
    from: 'envoy',
    to: 'mentor',
    type: 'consults',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'song-of-crowns', locus: '5' }],
    family: 'counsel',
  }),
  link({
    from: 'envoy',
    to: 'aide',
    type: 'serves',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'song-of-crowns', locus: '3' }],
    family: 'social',
  }),
  link({
    from: 'watcher',
    to: 'confidant',
    type: 'hostage_exchanged_for',
    directed: false,
    certainty: 'attested',
    sources: [{ work: 'song-of-crowns', locus: '2' }],
    family: 'social',
  }),
  link({
    from: 'envoy',
    to: 'bridge',
    type: 'guards',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'chronicle-of-halls', locus: '1' }],
    family: 'location',
  }),
  link({
    from: 'envoy',
    to: 'gate',
    type: 'guards',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'chronicle-of-halls', locus: '2' }],
    family: 'location',
  }),
  link({
    from: 'wolf',
    to: 'serpent',
    type: 'slays',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'chronicle-of-halls', locus: '3' }],
    family: 'conflict',
  }),
  link({
    from: 'serpent',
    to: 'wolf',
    type: 'slays',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'chronicle-of-halls', locus: '4' }],
    family: 'conflict',
  }),
  link({
    from: 'smith',
    to: 'blade',
    type: 'owns',
    directed: true,
    certainty: 'attested',
    sources: [],
    family: 'possession',
  }),
  link({
    from: 'champion',
    to: 'beast',
    type: 'slays',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'chronicle-of-halls', locus: '5' }],
    family: 'conflict',
  }),
  // rogue is untagged, so this must be excluded from the terminal pairings.
  link({
    from: 'rogue',
    to: 'beast',
    type: 'slays',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'chronicle-of-halls', locus: '6' }],
    family: 'conflict',
  }),
  link({
    from: 'ancestor',
    to: 'champion',
    type: 'parent_of',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'song-of-crowns', locus: '5' }],
    family: 'kinship',
  }),
  link({
    from: 'progenitor',
    to: 'ancestor',
    type: 'parent_of',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'song-of-crowns', locus: '6' }],
    family: 'kinship',
  }),
  link({
    from: 'envoy',
    to: 'shape',
    type: 'becomes',
    directed: true,
    certainty: 'attested',
    sources: [{ work: 'chronicle-of-halls', locus: '7' }],
    family: 'transformation',
  }),
];

const sources: Source[] = [
  {
    id: 'song-of-crowns',
    kind: 'work',
    titles: { non: 'Kórunalag', en: 'Song of Crowns' },
    date: 'undated',
    locusUnit: 'stanza',
  },
  {
    id: 'chronicle-of-halls',
    kind: 'work',
    titles: { non: 'Hallasaga', en: 'Chronicle of Halls' },
    date: 'undated',
    locusUnit: 'chapter',
  },
  // No locusUnit at all — exercises locusKey's default-to-chapter fallback.
  {
    id: 'untitled-fragment',
    kind: 'work',
    titles: { non: 'Ónefnt brot', en: 'Untitled Fragment' },
    date: 'undated',
  },
];

// champion and beast also carry "ragnarok-participant" but are deliberately
// left out of this index — ragnarokOverlay() reads tags directly, not this
// map, and adding them here would surface them in relatedByTag(queen)'s
// results and break that describe block's fixed expectations.
const tagIndex: Record<string, string[]> = {
  ruler: ['king', 'queen', 'envoy', 'watcher'],
  'ragnarok-participant': ['queen', 'envoy'],
  predator: ['wolf', 'serpent'],
  craftsman: ['smith'],
};

export const sampleGraph: GraphData = {
  version: 3,
  generatedAt: '2026-01-01T00:00:00.000Z',
  nodes,
  links,
  sources,
  tagIndex,
  bounds: [0, 0, 130, 130],
  core: {
    nodeIds: nodes.map((node) => node.id),
    linkIds: links.map((entry) => entry.id),
    bounds: [0, 0, 130, 130],
  },
};
