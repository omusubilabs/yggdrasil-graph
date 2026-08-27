/**
 * Geometry shared by the prerendered SVG and the browser runtime.
 *
 * Both sides must agree exactly. The page ships a settled layout as real markup
 * so it is legible before any script runs; the runtime then takes that same
 * markup over. If the two computed a radius or an arc differently, the graph
 * would visibly jump at the moment of hydration, which is the one thing a cold
 * open cannot do. So neither side owns these functions — this file does.
 */
import type { GraphLink, GraphNode, RelationType } from './types.ts';

/**
 * Relations that end a life. These are the only edges permitted to use
 * --minium, the reserved red. Everything else is ink.
 */
export const DEATH_RELATION_TYPES: readonly RelationType[] = [
  'slays',
  'causes_death_of',
  'devours',
  'destroys',
];

export const isDeathRelation = (type: RelationType) => DEATH_RELATION_TYPES.includes(type);

/**
 * Depth tiers for the Ragnarök echo, in hops from the nearest combat pairing.
 * Three discrete steps rather than a continuous scale, since depths cluster
 * at 1-2 hops with a long sparse tail — nobody could perceive hop 8 vs 11.
 */
export const ECHO_NEAR_MAX_DEPTH = 2;
export const ECHO_MID_MAX_DEPTH = 5;

export const echoDepthClass = (depth: number): 'is-echo-near' | 'is-echo-mid' | 'is-echo-far' =>
  depth <= ECHO_NEAR_MAX_DEPTH
    ? 'is-echo-near'
    : depth <= ECHO_MID_MAX_DEPTH
      ? 'is-echo-mid'
      : 'is-echo-far';

/** Radius grows with degree, but sub-linearly, so Óðinn does not swallow the page. */
export const nodeRadius = (degree: number): number =>
  Math.round((5.5 + Math.sqrt(degree) * 3.1) * 10) / 10;

/** Where the label sits relative to the node centre. */
export const labelOffset = (degree: number): number => nodeRadius(degree) + 11;

/** Distance in viewBox units from `node` to its closest other node, by position. */
export const nearestNeighbourDistance = (
  node: GraphNode,
  allNodes: readonly GraphNode[],
): number => {
  let min = Infinity;
  for (const other of allNodes) {
    if (other.id === node.id) continue;
    const d = Math.hypot(other.x - node.x, other.y - node.y);
    if (d < min) min = d;
  }
  return min;
};

/**
 * How far a node's invisible hit-area ring extends past its ink mark, tuned
 * to clear a 24×24 CSS-pixel target at every supported viewport. Clamped
 * against the *full* node set, not just the cold-open core, so a halo never
 * overlaps a neighbour that search or "show all" later reveals.
 */
const HALO_PAD = 12;
const HALO_MIN_RADIUS = 30;

/**
 * The 30-unit floor above is a radius, and every shape but the hexagon has a
 * half-span equal to that radius in every direction. The hexagon's vertical
 * half-span is only r·sin(60°) ≈ 0.866r, so it alone needs its target
 * radius scaled up to still clear the floor vertically.
 */
const HALO_SHAPE_FACTOR: Partial<Record<GraphNode['type'], number>> = {
  world: Math.sqrt(3) / 2,
  place: Math.sqrt(3) / 2,
};

export const haloRadius = (node: GraphNode, allNodes: readonly GraphNode[]): number => {
  const r = nodeRadius(node.degree);
  const target = Math.max(r + HALO_PAD, HALO_MIN_RADIUS);
  const shaped = target / (HALO_SHAPE_FACTOR[node.type] ?? 1);
  const cap = nearestNeighbourDistance(node, allNodes) / 2;
  return round(Math.max(r, Math.min(shaped, cap)));
};

/**
 * The `d` of an edge. `curve` is the signed fan offset baked in at build time;
 * zero draws a straight line.
 */
export const edgePath = (x1: number, y1: number, x2: number, y2: number, curve: number): string => {
  if (curve === 0) return `M${round(x1)},${round(y1)}L${round(x2)},${round(y2)}`;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy) || 1;
  // Offset the control point perpendicular to the line, scaled by length so
  // short edges bow gently and long ones bow enough to separate.
  const bow = curve * Math.min(distance * 0.16, 46);
  const mx = (x1 + x2) / 2 - (dy / distance) * bow;
  const my = (y1 + y2) / 2 + (dx / distance) * bow;
  return `M${round(x1)},${round(y1)}Q${round(mx)},${round(my)} ${round(x2)},${round(y2)}`;
};

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Stop the edge short of the target node so an arrowhead lands on the rim
 * rather than under the circle. Returns the endpoint to draw to.
 */
export const trimToRim = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
): [number, number] => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy) || 1;
  const t = Math.max(0, (distance - radius - 3.5) / distance);
  return [round(x1 + dx * t), round(y1 + dy * t)];
};

/**
 * Node outline as a path.
 *
 * Shape carries `type` and hue carries `class`, so the two never have to be
 * read from the same channel. Every node also has a visible text label, so
 * identity never depends on colour at all.
 */
export const nodeShapePath = (type: GraphNode['type'], r: number): string => {
  const p = (n: number) => Math.round(n * 100) / 100;
  const circle = (radius: number) =>
    `M${p(-radius)},0a${p(radius)},${p(radius)} 0 1,0 ${p(radius * 2)},0a${p(radius)},${p(radius)} 0 1,0 ${p(-radius * 2)},0Z`;
  switch (type) {
    case 'artifact':
      // A lozenge, like a gemstone set into the page.
      return `M0,${p(-r * 1.25)}L${p(r)},0L0,${p(r * 1.25)}L${p(-r)},0Z`;
    case 'world':
    case 'place': {
      // A hexagon: flat-topped, so worlds read as ground rather than as figures.
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i;
        return `${p(r * Math.cos(a))},${p(r * Math.sin(a))}`;
      });
      return `M${pts.join('L')}Z`;
    }
    case 'form':
      // Two concentric subpaths with even-odd fill make a ring: still round
      // enough to read as a living shape, but visibly not another person.
      return `${circle(r)}${circle(r * 0.46)}`;
    default:
      return circle(r);
  }
};

/** Label size in viewBox units. The best-connected figures are named larger. */
export const labelSize = (coreRank: number): number =>
  coreRank < 8 ? 14 : coreRank < 20 ? 12 : 10.5;

/** Class list for a node, so CSS carries colour and shape rather than inline style. */
export const nodeClassNames = (node: GraphNode): string =>
  ['node', `node--${node.type}`, ...node.classes.map((c) => `is-${c}`)].join(' ');

export const linkClassNames = (link: GraphLink): string =>
  [
    'edge',
    `edge--${link.family}`,
    `is-${link.certainty}`,
    isDeathRelation(link.type) ? 'is-death' : null,
  ]
    .filter(Boolean)
    .join(' ');

/** The viewBox string for a set of bounds. */
export const viewBoxOf = (bounds: readonly [number, number, number, number]): string =>
  `${bounds[0]} ${bounds[1]} ${bounds[2] - bounds[0]} ${bounds[3] - bounds[1]}`;
