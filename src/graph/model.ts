/**
 * Queries over the compiled graph. Pure functions and plain maps — no DOM, no
 * d3 — so the Astro build, the browser runtime and any future test can all use
 * the same logic to answer the same questions.
 */
import { isDeathRelation } from './geometry.ts';
import type {
  GraphData,
  GraphLink,
  GraphNode,
  RelationFamily,
  Source,
  SourceRef,
} from './types.ts';

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

/**
 * `neighbourhood()` narrowed to kinship — the default selection view is a
 * household, not every consultation or possession. Falls back to the full
 * neighbourhood when there's no kinship, so an artifact or place never
 * highlights nothing.
 */
export const coreNeighbourhood = (index: GraphIndex, id: string) => {
  const nodes = new Set<string>([id]);
  const links = new Set<string>();
  for (const link of index.incident.get(id) ?? []) {
    if (link.family !== 'kinship') continue;
    links.add(link.id);
    nodes.add(link.from);
    nodes.add(link.to);
  }
  return links.size > 0 ? { nodes, links } : neighbourhood(index, id);
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
    'counsel',
    'social',
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

/** Search canonical names, source spellings and stable ids without making accents mandatory. */
export const normalizeEntityQuery = (value: string): string =>
  value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').trim();

export const searchEntities = (data: Pick<GraphData, 'nodes'>, query: string, limit = 8) => {
  const needle = normalizeEntityQuery(query);
  if (!needle) return [];

  return data.nodes
    .flatMap((node) => {
      const fields = [node.id, node.names.non, node.names.anglicized, ...(node.aliases ?? [])].map(
        normalizeEntityQuery,
      );
      const score = fields.reduce(
        (best, field) =>
          Math.min(
            best,
            field === needle ? 0 : field.startsWith(needle) ? 1 : field.includes(needle) ? 2 : 3,
          ),
        3,
      );
      return score < 3 ? [{ node, score }] : [];
    })
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.node.coreRank - b.node.coreRank ||
        a.node.id.localeCompare(b.node.id),
    )
    .slice(0, limit)
    .map(({ node }) => node);
};

/** `parent_of` links where `id` is the child, i.e. one generation up from `id`. */
const parentLinksOf = (index: GraphIndex, id: string): GraphLink[] =>
  (index.incident.get(id) ?? []).filter((link) => link.type === 'parent_of' && link.to === id);

export interface RagnarokOverlay {
  /** Death-relation edges between two entities tagged `ragnarok-participant`. */
  pairingLinkIds: Set<string>;
  /** Endpoints of those edges. */
  combatantIds: Set<string>;
  /** Ancestors of combatants, reached by walking `parent_of` upward. */
  lineageNodeIds: Set<string>;
  /** The `parent_of` edges used to reach them. */
  lineageLinkIds: Set<string>;
  /** id -> hops to the nearest combatant via `parent_of`. Combatants are 0. */
  lineageDepth: Map<string, number>;
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
  const lineageDepth = new Map<string, number>();
  for (const id of combatantIds) lineageDepth.set(id, 0);
  // Multi-source BFS (every combatant starts at depth 0) so "nearest
  // combatant" is actually nearest, not an artifact of traversal order.
  const queue = [...combatantIds];
  while (queue.length) {
    const id = queue.shift()!;
    const depth = lineageDepth.get(id)!;
    for (const link of parentLinksOf(index, id)) {
      // A combatant who is also another combatant's ancestor must stay a
      // combatant only, not also gain a (bogus) lineage depth.
      if (lineageNodeIds.has(link.from) || combatantIds.has(link.from)) continue;
      lineageNodeIds.add(link.from);
      lineageLinkIds.add(link.id);
      lineageDepth.set(link.from, depth + 1);
      queue.push(link.from);
    }
  }

  return { pairingLinkIds, combatantIds, lineageNodeIds, lineageLinkIds, lineageDepth };
};

export interface RagnarokConnection {
  nodeIds: Set<string>;
  linkIds: Set<string>;
  /** Hops from this node to the nearest combat pairing (0 for a combatant). */
  nodeDepth: Map<string, number>;
  /** Hops from this link's endpoints to the nearest combat pairing (0 for a pairing edge). */
  linkDepth: Map<string, number>;
}

/**
 * The Ragnarök thread through `id`, even without a death relation of its
 * own: a combatant's pairing edge(s) plus its ascending `parent_of` chain,
 * or a pure lineage node's descending chain down to the combatant(s) it
 * produced (pulling in their pairing edges too). Both walks are restricted
 * to `overlay.lineageLinkIds` — the same edges `ragnarokOverlay` itself
 * recognises — so an unrelated sibling branch can't leak in. `null` outside
 * the cast.
 */
export const ragnarokConnection = (
  index: GraphIndex,
  overlay: RagnarokOverlay,
  id: string,
): RagnarokConnection | null => {
  const isCombatant = overlay.combatantIds.has(id);
  const isLineage = overlay.lineageNodeIds.has(id);
  if (!isCombatant && !isLineage) return null;

  const nodeIds = new Set<string>();
  const linkIds = new Set<string>();
  const nodeDepth = new Map<string, number>();
  const linkDepth = new Map<string, number>();
  // Every node reachable here is already in overlay.lineageDepth, so no
  // fallback is needed for the `!` below.
  const addNode = (nodeId: string) => {
    nodeIds.add(nodeId);
    nodeDepth.set(nodeId, overlay.lineageDepth.get(nodeId)!);
  };
  const addLink = (linkId: string, from: string, to: string) => {
    linkIds.add(linkId);
    linkDepth.set(linkId, Math.min(nodeDepth.get(from)!, nodeDepth.get(to)!));
  };
  addNode(id);

  const addPairingsOf = (combatantId: string) => {
    for (const link of index.incident.get(combatantId) ?? []) {
      if (!overlay.pairingLinkIds.has(link.id)) continue;
      addNode(link.from);
      addNode(link.to);
      addLink(link.id, link.from, link.to);
    }
  };

  if (isCombatant) {
    addPairingsOf(id);
    // Ascend through parent_of within the lineage.
    const visited = new Set<string>([id]);
    const queue = [id];
    while (queue.length) {
      const cur = queue.pop()!;
      for (const link of index.incident.get(cur) ?? []) {
        if (link.type !== 'parent_of' || link.to !== cur) continue;
        if (!overlay.lineageLinkIds.has(link.id)) continue;
        if (visited.has(link.from)) continue;
        visited.add(link.from);
        addNode(link.from);
        addLink(link.id, link.from, cur);
        queue.push(link.from);
      }
    }
  } else {
    // Descend through parent_of within the lineage, pulling in any combatant reached.
    const visited = new Set<string>([id]);
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift()!;
      if (overlay.combatantIds.has(cur)) addPairingsOf(cur);
      for (const link of index.incident.get(cur) ?? []) {
        if (link.type !== 'parent_of' || link.from !== cur) continue;
        if (!overlay.lineageLinkIds.has(link.id)) continue;
        if (visited.has(link.to)) continue;
        visited.add(link.to);
        addNode(link.to);
        addLink(link.id, cur, link.to);
        queue.push(link.to);
      }
    }
  }

  return { nodeIds, linkIds, nodeDepth, linkDepth };
};

export type StructuralInsight =
  | { kind: 'ragnarok-indirect'; hops: number }
  | { kind: 'contradicted' }
  | { kind: 'tag-only'; exampleName: string };

/**
 * The single most surprising structural fact about `id`, in priority order —
 * first match wins, at most one shown. Mirrors `panel.insight.*` in i18n; the
 * `kind` → string mapping lives in runtime.ts, not here.
 */
export const structuralInsight = (
  index: GraphIndex,
  overlay: RagnarokOverlay,
  id: string,
): StructuralInsight | null => {
  const inCast = overlay.combatantIds.has(id) || overlay.lineageNodeIds.has(id);
  if (inCast) {
    const hasDirectDeathEdge = (index.incident.get(id) ?? []).some((link) =>
      isDeathRelation(link.type),
    );
    if (!hasDirectDeathEdge) {
      return { kind: 'ragnarok-indirect', hops: overlay.lineageDepth.get(id) ?? 0 };
    }
  }

  const hasContradiction = (index.incident.get(id) ?? []).some(
    (link) => (link.contradicts?.length ?? 0) > 0,
  );
  if (hasContradiction) return { kind: 'contradicted' };

  const tagOnly = relatedByTag(index, id, 1);
  if (tagOnly.length > 0) return { kind: 'tag-only', exampleName: tagOnly[0]!.node.names.non };

  return null;
};

export interface BloodlineTrace {
  /** Descendant → ancestor, inclusive. */
  nodeIds: string[];
  /** The `parent_of` edges joining them, in the same order as `nodeIds`. */
  linkIds: string[];
}

/**
 * BFS upward from `descendantId` along `parent_of` edges toward `ancestorId`.
 * BFS, not DFS, so the shortest chain wins when more than one route exists.
 */
const walkUpward = (
  index: GraphIndex,
  descendantId: string,
  ancestorId: string,
): BloodlineTrace | null => {
  const prev = new Map<string, { child: string; linkId: string }>();
  const visited = new Set<string>([descendantId]);
  const queue = [descendantId];

  while (queue.length) {
    const id = queue.shift()!;
    if (id === ancestorId) {
      const nodeIds = [id];
      const linkIds: string[] = [];
      let cursor = id;
      while (cursor !== descendantId) {
        const step = prev.get(cursor)!;
        linkIds.push(step.linkId);
        nodeIds.push(step.child);
        cursor = step.child;
      }
      return { nodeIds: nodeIds.reverse(), linkIds: linkIds.reverse() };
    }
    for (const link of parentLinksOf(index, id)) {
      if (visited.has(link.from)) continue;
      visited.add(link.from);
      prev.set(link.from, { child: id, linkId: link.id });
      queue.push(link.from);
    }
  }
  return null;
};

/**
 * The shortest `parent_of` chain between two figures, in whichever direction
 * one is an ancestor of the other — "follow the bloodline" from the panel.
 *
 * Deliberately returns `null` for a shared-ancestor pair (siblings, cousins):
 * the feature's "ending on the ancestor" semantics only make sense for a
 * straight-line descent, not a fork.
 */
export const bloodlineTrace = (
  index: GraphIndex,
  aId: string,
  bId: string,
): BloodlineTrace | null => {
  if (aId === bId) return null;
  if (!index.nodeById.has(aId) || !index.nodeById.has(bId)) return null;
  return walkUpward(index, aId, bId) ?? walkUpward(index, bId, aId);
};

const boundsFor = (nodes: GraphNode[], pad = 60): [number, number, number, number] => {
  if (nodes.length === 0) return [0, 0, 0, 0];
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  return [
    Math.floor(Math.min(...xs) - pad),
    Math.floor(Math.min(...ys) - pad),
    Math.ceil(Math.max(...xs) + pad),
    Math.ceil(Math.max(...ys) + pad),
  ];
};

export const MOBILE_FOCUS_NODE_IDS = [
  'loki',
  'angrboda',
  'fenrir',
  'jormungandr',
  'odin',
  'thor',
  'heimdall',
  'tyr',
] as const;

/**
 * The deliberately small mobile cold open. Stable ids make this a product
 * decision rather than an accident of degree ranking as the corpus grows.
 */
export const buildMobileFocus = (
  data: Pick<GraphData, 'nodes' | 'links'>,
  ids: readonly string[] = MOBILE_FOCUS_NODE_IDS,
): GraphData['mobileFocus'] => {
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const missing = ids.filter((id) => !nodeById.has(id));
  if (missing.length > 0)
    throw new Error(`mobile focus references unknown nodes: ${missing.join(', ')}`);

  const wanted = new Set(ids);
  return {
    nodeIds: [...ids],
    linkIds: data.links
      .filter((link) => wanted.has(link.from) && wanted.has(link.to))
      .map((link) => link.id)
      .sort(),
    bounds: boundsFor(ids.map((id) => nodeById.get(id)!)),
  };
};

/**
 * The cold-open slice: the Ragnarǫk argument first, then the highest-degree
 * figures until the graph reaches the fixed legibility limit.
 */
export const buildCore = (
  data: Pick<GraphData, 'nodes' | 'links' | 'sources' | 'tagIndex'>,
  limit = 36,
): GraphData['core'] => {
  const provisional: GraphData = {
    version: 4,
    generatedAt: '',
    nodes: data.nodes,
    links: data.links,
    sources: data.sources,
    tagIndex: data.tagIndex,
    bounds: [0, 0, 0, 0],
    core: { nodeIds: [], linkIds: [], bounds: [0, 0, 0, 0] },
    mobileFocus: { nodeIds: [], linkIds: [], bounds: [0, 0, 0, 0] },
  };
  const overlay = ragnarokOverlay(buildIndex(provisional));
  const ids = new Set([...overlay.combatantIds, ...overlay.lineageNodeIds]);
  const ranked = [...data.nodes].sort(
    (a, b) => a.coreRank - b.coreRank || a.id.localeCompare(b.id),
  );
  for (const node of ranked) {
    if (ids.size >= limit) break;
    ids.add(node.id);
  }

  const nodeIds = ranked.filter((node) => ids.has(node.id)).map((node) => node.id);
  const linkIds = data.links
    .filter((link) => ids.has(link.from) && ids.has(link.to))
    .map((link) => link.id)
    .sort();
  return {
    nodeIds,
    linkIds,
    bounds: boundsFor(data.nodes.filter((node) => ids.has(node.id))),
  };
};

/** Bounds for a runtime-selected set, using the same padding as the compiler. */
export const boundsForNodeIds = (index: GraphIndex, ids: ReadonlySet<string>) =>
  boundsFor([...ids].flatMap((id) => (index.nodeById.get(id) ? [index.nodeById.get(id)!] : [])));

/** The smallest box containing both `a` and `b`. */
export const unionBounds = (
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
): [number, number, number, number] => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
];

/**
 * `bounds`, unless it exceeds `maxSpan` on either axis, in which case a
 * `maxSpan`-sized box centred on `center`. Keeps incidental highlighting from
 * forcing an illegible zoom-out — content stays rendered and reachable, only
 * the initial framing is bounded.
 */
export const clampBoundsAroundPoint = (
  bounds: readonly [number, number, number, number],
  center: readonly [number, number],
  maxSpan: number,
): readonly [number, number, number, number] => {
  const width = bounds[2] - bounds[0];
  const height = bounds[3] - bounds[1];
  if (width <= maxSpan && height <= maxSpan) return bounds;
  const half = maxSpan / 2;
  return [center[0] - half, center[1] - half, center[0] + half, center[1] + half];
};

// Ceiling on nearFraction + farFraction combined, so 1/(1 - total) can't
// blow up — far above any real overlay proportion.
const MAX_OVERLAY_FRACTION = 0.9;

/**
 * `bounds`, widened on `axis` so the content clears an opaque overlay
 * covering `nearFraction` of the near (left/top) side and/or `farFraction`
 * of the far (right/bottom) side, once fit into a `canvasWidth`×
 * `canvasHeight` viewport via `xMidYMid meet` (see `viewBoxOf`). Pass 0 for
 * whichever side has no overlay.
 *
 * Resolve both fractions in one call, not two sequential ones — fitting into
 * the canvas picks a single scale for the whole axis, so a second widening
 * on the same axis rescales it and erodes the margin the first one promised.
 *
 * `aspectForcingSpan` additionally grows the span until the box's own aspect
 * ratio matches the canvas's: `xMidYMid meet` centres whichever axis has
 * slack, so a box that's proportionally shorter on `axis` than the canvas
 * would otherwise have any widening split across both edges, halving the
 * intended margin.
 */
export const padForOverlay = (
  bounds: readonly [number, number, number, number],
  axis: 'x' | 'y',
  nearFraction: number,
  farFraction: number,
  canvasWidth: number,
  canvasHeight: number,
): readonly [number, number, number, number] => {
  let nearF = Number.isFinite(nearFraction) && nearFraction > 0 ? nearFraction : 0;
  let farF = Number.isFinite(farFraction) && farFraction > 0 ? farFraction : 0;
  if (nearF === 0 && farF === 0) return bounds;
  if (!(canvasWidth > 0) || !(canvasHeight > 0)) return bounds;

  const total = nearF + farF;
  if (total > MAX_OVERLAY_FRACTION) {
    const scale = MAX_OVERLAY_FRACTION / total;
    nearF *= scale;
    farF *= scale;
  }

  const [x0, y0, x1, y1] = bounds;
  const contentW = x1 - x0;
  const contentH = y1 - y0;

  const size = axis === 'x' ? contentW : contentH;
  const crossSize = axis === 'x' ? contentH : contentW;
  const canvasSize = axis === 'x' ? canvasWidth : canvasHeight;
  const canvasCross = axis === 'x' ? canvasHeight : canvasWidth;

  const directSpan = size / (1 - nearF - farF);
  const aspectForcingSpan = crossSize * (canvasSize / canvasCross);
  const span = Math.max(directSpan, aspectForcingSpan, size);
  const extraNear = nearF * span;

  if (axis === 'x') {
    const newX0 = x0 - extraNear;
    return [newX0, y0, newX0 + span, y1];
  }
  const newY0 = y0 - extraNear;
  return [x0, newY0, x1, newY0 + span];
};

/** Renders a citation's locus with the unit its work counts in. */
export const locusKey = (
  index: GraphIndex,
  ref: SourceRef | string,
): 'sources.chapter' | 'sources.stanza' | 'sources.page' => {
  const work = typeof ref === 'string' ? ref : ref.work;
  const unit = typeof ref === 'string' ? undefined : ref.unit;
  const resolved = unit ?? index.sourceById.get(work)?.locusUnit ?? 'chapter';
  return `sources.${resolved}`;
};
