/**
 * Queries over the compiled graph. Pure functions and plain maps — no DOM, no
 * d3 — so the Astro build, the browser runtime and any future test can all use
 * the same logic to answer the same questions.
 */
import { isDeathRelation } from './geometry.ts';
import type { GraphData, GraphLink, GraphNode, RelationFamily, Source } from './types.ts';

export interface GraphIndex {
  data: GraphData;
  nodeById: Map<string, GraphNode>;
  linkById: Map<string, GraphLink>;
  sourceById: Map<string, Source>;
  /** entity id -> every relation it takes part in, either end. */
  incident: Map<string, GraphLink[]>;
  /** entity id -> the ids of everything one hop away. */
  neighbours: Map<string, Set<string>>;
}

export const buildIndex = (data: GraphData): GraphIndex => {
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const linkById = new Map(data.links.map((l) => [l.id, l]));
  const sourceById = new Map(data.sources.map((s) => [s.id, s]));
  const incident = new Map<string, GraphLink[]>();
  const neighbours = new Map<string, Set<string>>();

  for (const link of data.links) {
    for (const [self, other] of [
      [link.from, link.to],
      [link.to, link.from],
    ] as const) {
      (incident.get(self) ?? incident.set(self, []).get(self)!).push(link);
      (neighbours.get(self) ?? neighbours.set(self, new Set()).get(self)!).add(other);
    }
  }

  return { data, nodeById, linkById, sourceById, incident, neighbours };
};

/**
 * Everything within one hop of `id`, including `id` itself.
 *
 * One hop is the right depth on purpose. Two hops from Óðinn is most of the
 * graph and tells you nothing; one hop is a household, a feud, or a bloodline,
 * which is the unit the reader is actually looking for.
 */
export const neighbourhood = (index: GraphIndex, id: string) => {
  const nodes = new Set<string>([id]);
  const links = new Set<string>();
  for (const link of index.incident.get(id) ?? []) {
    links.add(link.id);
    nodes.add(link.from);
    nodes.add(link.to);
  }
  return { nodes, links };
};

export interface RelationView {
  link: GraphLink;
  /** The entity at the other end, from the point of view of the selected one. */
  other: GraphNode | undefined;
  /**
   * Whether the selected entity is the subject. `parent_of` reads very
   * differently depending on which end you are standing at, so the panel needs
   * to know which label to use — "Parent of" or "Child of".
   */
  outgoing: boolean;
}

/** Relations grouped by family, in a stable order, ready to render. */
export const relationsByFamily = (
  index: GraphIndex,
  id: string,
): Array<[RelationFamily, RelationView[]]> => {
  const grouped = new Map<RelationFamily, RelationView[]>();
  for (const link of index.incident.get(id) ?? []) {
    const outgoing = link.from === id;
    const otherId = outgoing ? link.to : link.from;
    const view: RelationView = { link, other: index.nodeById.get(otherId), outgoing };
    (grouped.get(link.family) ?? grouped.set(link.family, []).get(link.family)!).push(view);
  }

  const FAMILY_ORDER: RelationFamily[] = [
    'kinship',
    'conflict',
    'possession',
    'location',
    'transformation',
  ];

  return FAMILY_ORDER.filter((f) => grouped.has(f)).map((family) => [
    family,
    grouped
      .get(family)!
      .sort(
        (a, b) =>
          Number(b.outgoing) - Number(a.outgoing) ||
          a.link.type.localeCompare(b.link.type) ||
          (a.other?.names.anglicized ?? '').localeCompare(b.other?.names.anglicized ?? ''),
      ),
  ]);
};

/** Entities that share a tag with `id` but are NOT adjacent to it — suggests where to go next when the graph edges don't. */
export const relatedByTag = (index: GraphIndex, id: string, limit = 6) => {
  const self = index.nodeById.get(id);
  if (!self) return [];
  const adjacent = index.neighbours.get(id) ?? new Set<string>();
  const shared = new Map<string, { node: GraphNode; tags: string[] }>();

  for (const tag of self.tags) {
    for (const otherId of index.data.tagIndex[tag] ?? []) {
      if (otherId === id || adjacent.has(otherId)) continue;
      const node = index.nodeById.get(otherId);
      if (!node) continue;
      const entry = shared.get(otherId) ?? { node, tags: [] };
      entry.tags.push(tag);
      shared.set(otherId, entry);
    }
  }

  return [...shared.values()]
    .sort((a, b) => b.tags.length - a.tags.length || a.node.id.localeCompare(b.node.id))
    .slice(0, limit);
};

export interface RagnarokOverlay {
  /** Death-relation edges between two entities tagged `ragnarok-participant`. */
  pairingLinkIds: Set<string>;
  /** Endpoints of those edges. */
  combatantIds: Set<string>;
  /** Ancestors of combatants, reached by walking `parent_of` upward. */
  lineageNodeIds: Set<string>;
  /** The `parent_of` edges used to reach them. */
  lineageLinkIds: Set<string>;
}

/**
 * The Ragnarök overlay's selection: which combat pairings count as "terminal",
 * and the bloodlines that produced each combatant.
 *
 * A death relation only counts if both ends are tagged `ragnarok-participant`
 * — that's what keeps pre-Ragnarök deaths like Höðr slaying Baldr out of the
 * result (both are tagged `ragnarok-survivor`, not `ragnarok-participant`).
 */
export const ragnarokOverlay = (index: GraphIndex): RagnarokOverlay => {
  const pairingLinkIds = new Set<string>();
  const combatantIds = new Set<string>();

  for (const link of index.data.links) {
    if (!isDeathRelation(link.type)) continue;
    const from = index.nodeById.get(link.from);
    const to = index.nodeById.get(link.to);
    if (!from?.tags.includes('ragnarok-participant')) continue;
    if (!to?.tags.includes('ragnarok-participant')) continue;
    pairingLinkIds.add(link.id);
    combatantIds.add(link.from);
    combatantIds.add(link.to);
  }

  const lineageNodeIds = new Set<string>();
  const lineageLinkIds = new Set<string>();
  const queue = [...combatantIds];
  while (queue.length) {
    const id = queue.pop()!;
    for (const link of index.incident.get(id) ?? []) {
      if (link.type !== 'parent_of' || link.to !== id) continue; // walk upward only
      if (lineageNodeIds.has(link.from)) continue;
      lineageNodeIds.add(link.from);
      lineageLinkIds.add(link.id);
      queue.push(link.from);
    }
  }

  return { pairingLinkIds, combatantIds, lineageNodeIds, lineageLinkIds };
};

/** Renders a citation's locus with the unit its work counts in. */
export const locusKey = (index: GraphIndex, work: string): 'sources.chapter' | 'sources.stanza' =>
  index.sourceById.get(work)?.locusUnit === 'stanza' ? 'sources.stanza' : 'sources.chapter';
