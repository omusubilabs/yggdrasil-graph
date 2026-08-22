/**
 * The vocabulary of the dataset, mirrored from data/schema/*.json.
 *
 * These types are the single source of truth for both the build scripts and
 * the browser runtime. If you change data/schema/, change this file in the
 * same commit — the schemas catch bad data, these types catch bad code, and
 * they only work together.
 */

export const ENTITY_TYPES = [
  'deity',
  'human',
  'being',
  'world',
  'artifact',
  'place',
  'event',
  'form',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_CLASSES = [
  'aesir',
  'vanir',
  'jotnar',
  'humans',
  'beings',
  'worlds',
  'artifacts',
] as const;
export type EntityClass = (typeof ENTITY_CLASSES)[number];

export const CERTAINTIES = ['attested', 'implied', 'variant', 'disputed', 'unverified'] as const;
export type Certainty = (typeof CERTAINTIES)[number];

/**
 * Relation families map one-to-one onto the files in data/relations/. A type
 * belongs to exactly one family, and the validator rejects a `slays` that
 * turns up in kinship.json — otherwise the files stop meaning anything and
 * reviewing a data PR gets much harder.
 */
export const RELATION_FAMILIES = {
  kinship: ['parent_of', 'sibling_of', 'married_to', 'consort_of', 'blood_brother_of', 'fosters'],
  counsel: ['consults', 'wisdom_contest_with'],
  social: ['serves', 'hostage_exchanged_for'],
  conflict: ['slays', 'causes_death_of', 'maims', 'binds', 'devours', 'destroys'],
  possession: ['owns'],
  location: ['guards', 'dwells_in', 'rules', 'encircles', 'root_reaches', 'raised_in'],
  transformation: ['becomes'],
} as const satisfies Record<string, readonly string[]>;

export type RelationFamily = keyof typeof RELATION_FAMILIES;
export type RelationType = (typeof RELATION_FAMILIES)[RelationFamily][number];

/** Relation types with no inherent direction; `directed` must be false. */
export const SYMMETRIC_TYPES: readonly RelationType[] = [
  'married_to',
  'sibling_of',
  'consort_of',
  'blood_brother_of',
  'wisdom_contest_with',
  'hostage_exchanged_for',
];

export interface Entity {
  id: string;
  type: EntityType;
  classes: EntityClass[];
  names: { non: string; anglicized: string };
  /** Alternative names and edition spellings. Historical data, never localized. */
  aliases?: string[];
  attestations: string[];
  tags: string[];
}

export interface SourceRef {
  work: string;
  locus: string;
  /** Overrides the work's default unit for embedded, unnumbered prose. */
  unit?: 'chapter' | 'stanza' | 'page';
}

export interface Relation {
  id: string;
  from: string;
  to: string;
  type: RelationType;
  directed: boolean;
  certainty: Certainty;
  sources: SourceRef[];
  contradicts?: string[];
}

export interface Source {
  id: string;
  kind: 'collection' | 'work';
  partOf?: string;
  titles: { non: string; en: string };
  date: string;
  locusUnit?: 'chapter' | 'stanza' | 'page';
  translation?: {
    translator: string;
    year: number;
    title: string;
    publisher?: string;
    rights: 'public-domain';
  };
  url?: string;
}

/** A node as it appears in the compiled graph, with its baked-in layout position. */
export interface GraphNode extends Entity {
  /** Precomputed x from the build-time force pass, in layout units. */
  x: number;
  /** Precomputed y from the build-time force pass, in layout units. */
  y: number;
  /** Count of incident relations; drives node radius. */
  degree: number;
  /**
   * Rank by degree, 0 = most connected. The default view shows the first ~30.
   * With 36 seeded entities that is nearly everything, but the dataset is
   * headed for 300–400 and the cold open must stay legible when it gets there.
   */
  coreRank: number;
}

export interface GraphLink extends Relation {
  family: RelationFamily;
  /**
   * Signed curvature for the rendered edge, in units of arc offset.
   *
   * Several pairs carry more than one relation — Þórr and Jǫrmungandr kill each
   * other, so there are two `slays` edges between them, and Týr and Garmr do the
   * same. Drawn straight they would sit exactly on top of one another and the
   * reciprocity would be invisible, which is the single most interesting fact
   * about those pairs. Computed once at build time so the prerendered SVG and
   * the hydrated one agree to the pixel.
   */
  curve: number;
}

export interface GraphData {
  /** Bumped whenever the compiled shape changes, so a stale cached copy is detectable. */
  version: number;
  generatedAt: string;
  nodes: GraphNode[];
  links: GraphLink[];
  sources: Source[];
  /** tag -> entity ids, precomputed so the client never has to scan all nodes. */
  tagIndex: Record<string, string[]>;
  /** Extent of the baked layout: [minX, minY, maxX, maxY]. */
  bounds: [number, number, number, number];
  /** The thesis-led cold-open slice rendered before the lazy payload arrives. */
  core: {
    nodeIds: string[];
    linkIds: string[];
    bounds: [number, number, number, number];
  };
}
