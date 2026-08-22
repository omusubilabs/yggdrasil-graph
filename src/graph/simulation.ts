/**
 * The live force simulation.
 *
 * This module is imported dynamically, and only when motion is allowed. It is
 * the heaviest thing the application loads, and it is never on the critical
 * path: the layout it produces already exists in the markup, computed at build
 * time by scripts/build-graph.ts. What this adds is the gentle continuous
 * settling described in the brief, and the ability to drag a figure and watch
 * its family follow.
 *
 * It therefore starts from the baked positions with a low alpha rather than
 * from scratch. Re-solving the layout in the browser would make the graph
 * visibly rearrange itself the moment the chunk arrived — the opposite of a
 * cold open.
 */
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import { edgePath, nodeRadius, trimToRim } from './geometry.ts';
import type { GraphIndex } from './model.ts';
import type { RelationFamily } from './types.ts';

interface SimNode extends SimulationNodeDatum {
  id: string;
  degree: number;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  id: string;
  family: RelationFamily;
  directed: boolean;
  curve: number;
}

/** Must match LINK_DISTANCE in scripts/build-graph.ts, or the graph drifts. */
const LINK_DISTANCE: Record<RelationFamily, number> = {
  kinship: 70,
  counsel: 110,
  conflict: 190,
  possession: 60,
  location: 130,
  transformation: 90,
};

export interface AnimateOptions {
  svg: SVGSVGElement;
  index: GraphIndex;
  nodeEls: Map<string, SVGGraphicsElement>;
  edgeEls: Map<string, SVGPathElement>;
}

export function animate({
  index,
  nodeEls,
  edgeEls,
}: AnimateOptions): Simulation<SimNode, undefined> {
  const nodes: SimNode[] = index.data.nodes.map((n) => ({
    id: n.id,
    degree: n.degree,
    x: n.x,
    y: n.y,
    vx: 0,
    vy: 0,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const links: SimLink[] = index.data.links.map((l) => ({
    id: l.id,
    source: l.from,
    target: l.to,
    family: l.family,
    directed: l.directed,
    curve: l.curve,
  }));

  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance((l) => LINK_DISTANCE[l.family])
        .strength(0.35),
    )
    .force(
      'charge',
      forceManyBody<SimNode>().strength((d) => -330 - d.degree * 30),
    )
    .force(
      'collide',
      forceCollide<SimNode>().radius((d) => nodeRadius(d.degree) + 20),
    )
    .force('x', forceX(0).strength(0.026))
    .force('y', forceY(0).strength(0.085))
    // Start almost cold. The layout is already correct; this is a settle, not a
    // solve. alphaMin is high enough that it stops within a couple of seconds
    // and then costs nothing until someone drags something.
    .alpha(0.12)
    .alphaMin(0.02)
    .alphaDecay(0.03)
    .on('tick', paint);

  function paint() {
    for (const node of nodes) {
      nodeEls
        .get(node.id)
        ?.setAttribute('transform', `translate(${round(node.x)},${round(node.y)})`);
    }
    for (const link of links) {
      const element = edgeEls.get(link.id);
      if (!element) continue;
      const from = link.source as SimNode;
      const to = link.target as SimNode;
      const [x1, y1] = [from.x ?? 0, from.y ?? 0];
      const [tx, ty] = [to.x ?? 0, to.y ?? 0];
      const [x2, y2] = link.directed ? trimToRim(x1, y1, tx, ty, nodeRadius(to.degree)) : [tx, ty];
      element.setAttribute('d', edgePath(x1, y1, x2, y2, link.curve));
    }
  }

  // Dragging a figure and watching its household follow is the cheapest way to
  // make the structure feel like structure rather than decoration.
  for (const [id, element] of nodeEls) {
    const node = byId.get(id);
    if (!node) continue;
    select(element).call(
      drag<SVGGraphicsElement, unknown>()
        .on('start', () => {
          simulation.alphaTarget(0.18).restart();
          node.fx = node.x;
          node.fy = node.y;
        })
        .on('drag', (event: { dx: number; dy: number }) => {
          node.fx = (node.fx ?? 0) + event.dx;
          node.fy = (node.fy ?? 0) + event.dy;
        })
        .on('end', () => {
          simulation.alphaTarget(0);
          node.fx = null;
          node.fy = null;
        }),
    );
  }

  return simulation;
}

const round = (n: number | undefined) => Math.round((n ?? 0) * 10) / 10;
