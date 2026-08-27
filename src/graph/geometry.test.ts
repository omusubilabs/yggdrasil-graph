import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEATH_RELATION_TYPES,
  ECHO_MID_MAX_DEPTH,
  ECHO_NEAR_MAX_DEPTH,
  echoDepthClass,
  edgePath,
  haloRadius,
  isDeathRelation,
  labelOffset,
  labelSize,
  linkClassNames,
  nearestNeighbourDistance,
  nodeClassNames,
  nodeRadius,
  nodeShapePath,
  trimToRim,
  viewBoxOf,
} from './geometry.ts';
import type { GraphNode } from './types.ts';
import { sampleGraph } from './fixtures/sample-graph.ts';

const findNode = (id: string) => sampleGraph.nodes.find((n) => n.id === id)!;
const findLink = (id: string) => sampleGraph.links.find((l) => l.id === id)!;

/** A bare node for pure geometry tests, where only id/x/y/degree/type matter. */
const at = (
  id: string,
  x: number,
  y: number,
  degree = 0,
  type: GraphNode['type'] = 'being',
): GraphNode => ({
  id,
  type,
  classes: [],
  names: { non: id, anglicized: id },
  attestations: [],
  tags: [],
  x,
  y,
  degree,
  coreRank: 0,
});

describe('isDeathRelation', () => {
  it('is true for every DEATH_RELATION_TYPES entry', () => {
    for (const type of DEATH_RELATION_TYPES) assert.ok(isDeathRelation(type));
  });

  it('is false for a non-death conflict type', () => {
    assert.equal(isDeathRelation('maims'), false);
  });

  it('is false for a type from another family', () => {
    assert.equal(isDeathRelation('owns'), false);
  });
});

describe('echoDepthClass', () => {
  it('is near at depth 0 and at the near/mid boundary', () => {
    assert.equal(echoDepthClass(0), 'is-echo-near');
    assert.equal(echoDepthClass(ECHO_NEAR_MAX_DEPTH), 'is-echo-near');
  });

  it('is mid just past the near boundary and at the mid/far boundary', () => {
    assert.equal(echoDepthClass(ECHO_NEAR_MAX_DEPTH + 1), 'is-echo-mid');
    assert.equal(echoDepthClass(ECHO_MID_MAX_DEPTH), 'is-echo-mid');
  });

  it('is far past the mid boundary, however deep the chain goes', () => {
    assert.equal(echoDepthClass(ECHO_MID_MAX_DEPTH + 1), 'is-echo-far');
    assert.equal(echoDepthClass(13), 'is-echo-far');
  });
});

describe('nodeRadius', () => {
  it('is 5.5 at degree 0', () => {
    assert.equal(nodeRadius(0), 5.5);
  });

  it('is 8.6 at degree 1', () => {
    assert.equal(nodeRadius(1), 8.6);
  });

  it('rounds to one decimal at a non-terminating degree', () => {
    assert.equal(nodeRadius(2), 9.9);
  });
});

describe('labelOffset', () => {
  it('is nodeRadius plus 11', () => {
    assert.equal(labelOffset(0), nodeRadius(0) + 11);
    assert.equal(labelOffset(1), nodeRadius(1) + 11);
  });
});

describe('nearestNeighbourDistance', () => {
  it('finds the closest other node on one axis', () => {
    const target = at('a', 0, 0);
    const others = [target, at('b', 10, 0), at('c', 30, 0)];
    assert.equal(nearestNeighbourDistance(target, others), 10);
  });

  it('finds the true minimum even when the closest pair is not array-adjacent', () => {
    const target = at('a', 0, 0);
    const others = [at('far', 100, 0), target, at('near', 3, 4)];
    assert.equal(nearestNeighbourDistance(target, others), 5);
  });

  it('is Infinity when no other node exists', () => {
    const target = at('a', 0, 0);
    assert.equal(nearestNeighbourDistance(target, [target]), Infinity);
  });
});

describe('haloRadius', () => {
  it('is nodeRadius plus the pad for an isolated degree-0 node', () => {
    const target = at('a', 0, 0);
    const others = [target, at('far', 10_000, 0)];
    assert.equal(haloRadius(target, others), 30);
  });

  it('floors to the minimum radius for an isolated low-degree node', () => {
    const target = at('a', 0, 0, 1);
    const others = [target, at('far', 10_000, 0)];
    assert.equal(haloRadius(target, others), 30);
  });

  it('clamps to half the distance to a close neighbour', () => {
    const target = at('a', 0, 0);
    const others = [target, at('close', 20, 0)];
    assert.equal(haloRadius(target, others), 10);
  });

  it('never shrinks below the node’s own ink radius', () => {
    const target = at('a', 0, 0);
    const others = [target, at('touching', 8, 0)];
    assert.equal(haloRadius(target, others), nodeRadius(0));
  });

  it('widens a hexagon halo so its narrower vertical span still clears the floor a circle gets directly', () => {
    const target = at('midgard', 0, 0, 0, 'world');
    const others = [target, at('far', 10_000, 0)];
    const r = haloRadius(target, others);
    // Hexagon's vertical half-span is r·sin(60°), not r, so r must overshoot 30.
    const verticalHalfSpan = r * Math.sin(Math.PI / 3);
    assert.ok(
      verticalHalfSpan >= 30 - 0.05, // tolerate haloRadius's one-decimal rounding
      `expected hexagon vertical half-span >= 30, got ${verticalHalfSpan}`,
    );
  });

  it('cross-checks the hexagon floor against the actual rendered path, not just the formula', () => {
    const target = at('midgard', 0, 0, 0, 'world');
    const others = [target, at('far', 10_000, 0)];
    const r = haloRadius(target, others);
    const d = nodeShapePath('world', r);
    const ys = [...d.matchAll(/-?\d+\.?\d*,(-?\d+\.?\d*)/g)].map((m) => Number(m[1]));
    assert.ok(Math.max(...ys) >= 30 - 0.05);
  });

  it('leaves circle-family, form and lozenge shapes at the same floor as before the shape-aware fix', () => {
    for (const type of ['deity', 'human', 'being', 'event', 'form', 'artifact'] as const) {
      const target = at('a', 0, 0, 0, type);
      const others = [target, at('far', 10_000, 0)];
      assert.equal(haloRadius(target, others), 30);
    }
  });

  it('still clamps a hexagon halo to half the neighbour distance, same as a circle', () => {
    const target = at('midgard', 0, 0, 0, 'world');
    const others = [target, at('close', 20, 0)];
    assert.equal(haloRadius(target, others), 10);
  });
});

describe('edgePath', () => {
  it('draws a straight line when curve is 0', () => {
    assert.equal(edgePath(0, 0, 10, 0, 0), 'M0,0L10,0');
  });

  it('bows through a computed control point when curve is nonzero', () => {
    assert.equal(edgePath(0, 0, 10, 0, 1), 'M0,0Q5,1.6 10,0');
  });

  it('mirrors the bow when curve flips sign', () => {
    const positive = edgePath(0, 0, 10, 0, 1);
    const negative = edgePath(0, 0, 10, 0, -1);
    assert.equal(positive, 'M0,0Q5,1.6 10,0');
    assert.equal(negative, 'M0,0Q5,-1.6 10,0');
  });

  it('stays finite for a zero-length edge', () => {
    const path = edgePath(5, 5, 5, 5, 1);
    assert.equal(path, 'M5,5Q5,5 5,5');
    assert.doesNotMatch(path, /NaN|Infinity/);
  });

  it('clamps the bow to 46 units on a long edge', () => {
    assert.equal(edgePath(0, 0, 1000, 0, 1), 'M0,0Q500,46 1000,0');
  });
});

describe('trimToRim', () => {
  it('stops short of the target by radius + 3.5', () => {
    assert.deepEqual(trimToRim(0, 0, 10, 0, 2), [4.5, 0]);
  });

  it('clamps to the start point when the target is closer than radius + 3.5', () => {
    assert.deepEqual(trimToRim(0, 0, 1, 0, 10), [0, 0]);
  });
});

describe('nodeShapePath', () => {
  it('draws a lozenge for an artifact', () => {
    assert.equal(nodeShapePath('artifact', 10), 'M0,-12.5L10,0L0,12.5L-10,0Z');
  });

  it('draws the same hexagon for world and place', () => {
    assert.equal(nodeShapePath('world', 10), nodeShapePath('place', 10));
    assert.equal(nodeShapePath('world', 10), 'M10,0L5,8.66L-5,8.66L-10,0L-5,-8.66L5,-8.66Z');
  });

  it('draws a form as a stable double circle distinct from a person', () => {
    assert.equal(
      nodeShapePath('form', 10),
      'M-10,0a10,10 0 1,0 20,0a10,10 0 1,0 -20,0ZM-4.6,0a4.6,4.6 0 1,0 9.2,0a4.6,4.6 0 1,0 -9.2,0Z',
    );
    assert.notEqual(nodeShapePath('form', 10), nodeShapePath('being', 10));
  });

  it('draws a circle arc for every other type', () => {
    assert.equal(nodeShapePath('deity', 10), 'M-10,0a10,10 0 1,0 20,0a10,10 0 1,0 -20,0Z');
    assert.equal(nodeShapePath('being', 10), nodeShapePath('deity', 10));
    assert.equal(nodeShapePath('event', 10), nodeShapePath('deity', 10));
  });
});

describe('labelSize', () => {
  it('is 14 up to coreRank 7', () => {
    assert.equal(labelSize(0), 14);
    assert.equal(labelSize(7), 14);
  });

  it('is 12 from coreRank 8 to 19', () => {
    assert.equal(labelSize(8), 12);
    assert.equal(labelSize(19), 12);
  });

  it('is 10.5 from coreRank 20', () => {
    assert.equal(labelSize(20), 10.5);
  });
});

describe('nodeClassNames', () => {
  it('lists the node and type classes plus one is- class per entry', () => {
    assert.equal(nodeClassNames(findNode('king')), 'node node--human is-humans');
  });

  it('adds nothing extra when classes is empty', () => {
    const bare = { ...findNode('king'), classes: [] };
    assert.equal(nodeClassNames(bare), 'node node--human');
  });
});

describe('linkClassNames', () => {
  it('adds is-death for a death relation', () => {
    assert.equal(
      linkClassNames(findLink('wolf--serpent--slays')),
      'edge edge--conflict is-attested is-death',
    );
  });

  it('omits is-death for a non-death relation, with no stray whitespace', () => {
    assert.equal(
      linkClassNames(findLink('smith--blade--owns')),
      'edge edge--possession is-attested',
    );
  });
});

describe('viewBoxOf', () => {
  it('turns bounds into width/height, not raw coordinates', () => {
    assert.equal(viewBoxOf([-50, -30, 60, 40]), '-50 -30 110 70');
  });
});
