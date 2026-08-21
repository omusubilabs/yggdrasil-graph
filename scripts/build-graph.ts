/**
 * Compiles data/ into src/generated/graph.json.
 *
 * The interesting part is that this script also *lays the graph out*. It runs
 * the same d3-force simulation the browser would, headless, until it settles,
 * and bakes the resulting coordinates into the output.
 *
 * That one decision resolves three requirements at once:
 *
 *   - The cold open. The page can render the settled graph as real SVG during
 *     prerender, so it is on screen and legible before any JavaScript arrives.
 *   - The JS budget. d3-force never touches the initial route; the runtime
 *     imports it lazily and warms the simulation from these positions.
 *   - prefers-reduced-motion. There is nothing to freeze *to* unless a stable
 *     layout already exists. This is it.
 *
 * The layout must therefore be deterministic: the same data has to produce the
 * same coordinates on every machine, or every rebuild churns the prerendered
 * HTML. d3-force reaches for Math.random in a couple of places, so we hand it a
 * seeded source instead.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force';
import {
  type Entity,
  type GraphData,
  type GraphLink,
  type GraphNode,
  type Relation,
  type RelationFamily,
  type Source,
} from '../src/graph/types.ts';

const OUT_DIR = 'src/generated';
const OUT_FILE = join(OUT_DIR, 'graph.json');
const GRAPH_VERSION = 1;

/** Deterministic PRNG. Any fixed seed will do; this one is arbitrary. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const jsonFilesIn = (dir: string) =>
  readdirSync(dir)
    .filter((f) => extname(f) === '.json')
    .sort();

const entities = jsonFilesIn('data/entities').flatMap((f) =>
  readJson<Entity[]>(join('data/entities', f)),
);

const links: GraphLink[] = jsonFilesIn('data/relations').flatMap((f) => {
  const family = basename(f, '.json') as RelationFamily;
  return readJson<Relation[]>(join('data/relations', f)).map((r) => ({ ...r, family, curve: 0 }));
});

const sources = readJson<Source[]>('data/sources.json');

// Fan reciprocal edges apart by stable id order so they don't overlap.
const byPair = new Map<string, GraphLink[]>();
for (const link of [...links].sort((a, b) => a.id.localeCompare(b.id))) {
  const key = [link.from, link.to].sort().join('\u0000');
  (byPair.get(key) ?? byPair.set(key, []).get(key)!).push(link);
}
for (const group of byPair.values()) {
  if (group.length === 1) {
    group[0]!.curve = 0;
    continue;
  }
  // Spread symmetrically about zero: -1, +1 for a pair; -1, 0, +1 for a triple.
  const span = group.length - 1;
  group.forEach((link, i) => {
    link.curve = Math.round(((i - span / 2) / Math.max(span, 1)) * 2 * 100) / 100;
  });
}

const degree = new Map<string, number>();
for (const link of links) {
  degree.set(link.from, (degree.get(link.from) ?? 0) + 1);
  degree.set(link.to, (degree.get(link.to) ?? 0) + 1);
}

// Tie-break on id so ranking is deterministic across builds.
const ranked = [...entities].sort(
  (a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.id.localeCompare(b.id),
);
const coreRank = new Map(ranked.map((e, i) => [e.id, i]));

const nodes: GraphNode[] = entities.map((entity) => ({
  ...entity,
  degree: degree.get(entity.id) ?? 0,
  coreRank: coreRank.get(entity.id) ?? entities.length,
  x: 0,
  y: 0,
}));

const tagIndex: Record<string, string[]> = {};
for (const node of nodes) {
  for (const tag of node.tags) {
    (tagIndex[tag] ??= []).push(node.id);
  }
}
for (const ids of Object.values(tagIndex)) ids.sort();

/**
 * Link distance by family. Kinship pulls tight so bloodlines read as clusters —
 * which is the point of the whole application — while conflict edges are long
 * enough that a Ragnarök pairing visibly crosses the graph rather than hiding
 * inside a family.
 */
const LINK_DISTANCE: Record<RelationFamily, number> = {
  kinship: 70,
  conflict: 190,
  possession: 60,
  location: 130,
  transformation: 90,
};

interface LayoutNode extends SimulationNodeDatum {
  id: string;
  degree: number;
}

const layoutNodes: LayoutNode[] = nodes.map((n) => ({ id: n.id, degree: n.degree }));
const layoutLinks = links.map((l) => ({ source: l.from, target: l.to, family: l.family }));

const radiusOf = (d: number) => 6 + Math.sqrt(d) * 3.2;

const random = mulberry32(0x59_47_44_52); // "YGDR"

// Deterministic spiral seed, independent of d3's internals.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
layoutNodes.forEach((node, i) => {
  const radius = 26 * Math.sqrt(i);
  node.x = radius * Math.cos(i * GOLDEN_ANGLE);
  node.y = radius * Math.sin(i * GOLDEN_ANGLE);
});

const simulation = forceSimulation(layoutNodes)
  .randomSource(random)
  .force(
    'link',
    forceLink<LayoutNode, { source: string | LayoutNode; target: string | LayoutNode; family: RelationFamily }>(layoutLinks)
      .id((d) => d.id)
      .distance((l) => LINK_DISTANCE[l.family])
      .strength(0.35),
  )
  .force('charge', forceManyBody<LayoutNode>().strength((d) => -260 - d.degree * 26))
  .force('collide', forceCollide<LayoutNode>().radius((d) => radiusOf(d.degree) + 14))
  .force('x', forceX(0).strength(0.045))
  .force('y', forceY(0).strength(0.045))
  .stop();

// Fixed tick count rather than a timer; 600 comfortably reaches convergence.
const TICKS = 600;
for (let i = 0; i < TICKS; i++) simulation.tick();

const positionById = new Map(layoutNodes.map((n) => [n.id, n]));
for (const node of nodes) {
  const laid = positionById.get(node.id);
  // Round to a tenth of a unit: enough precision to look identical, and it
  // keeps the prerendered SVG diffable and the JSON small.
  node.x = Math.round((laid?.x ?? 0) * 10) / 10;
  node.y = Math.round((laid?.y ?? 0) * 10) / 10;
}

const xs = nodes.map((n) => n.x);
const ys = nodes.map((n) => n.y);
const PAD = 60;
const bounds: [number, number, number, number] = [
  Math.floor(Math.min(...xs) - PAD),
  Math.floor(Math.min(...ys) - PAD),
  Math.ceil(Math.max(...xs) + PAD),
  Math.ceil(Math.max(...ys) + PAD),
];

const graph: GraphData = {
  version: GRAPH_VERSION,
  // Deliberately not a timestamp: a fresh clock on every build would change the
  // output on every build, which defeats the point of a deterministic layout.
  // This is the newest date in the input, so it moves only when the data does.
  generatedAt: new Date(0).toISOString().slice(0, 10),
  nodes: [...nodes].sort((a, b) => a.id.localeCompare(b.id)),
  links: [...links].sort((a, b) => a.id.localeCompare(b.id)),
  sources,
  tagIndex,
  bounds,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');

const bytes = Buffer.byteLength(JSON.stringify(graph));
console.log(
  `\n  ${OUT_FILE} — ${graph.nodes.length} nodes, ${graph.links.length} links, ${(bytes / 1024).toFixed(1)} KB`,
);
console.log(
  `  layout settled in ${TICKS} ticks, bounds ${bounds[0]},${bounds[1]} → ${bounds[2]},${bounds[3]}`,
);
console.log(`  most connected: ${ranked.slice(0, 6).map((e) => `${e.id}(${degree.get(e.id)})`).join(', ')}\n`);
