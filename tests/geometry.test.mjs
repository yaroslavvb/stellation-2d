import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArrangement,
  buildFacetting,
  buildFacettingDiagram,
  buildOrbitMap,
  facettingOptions,
  supportClosure,
} from "../app/geometry.ts";

function vertexDegrees(facetting) {
  const degrees = Array.from({ length: facetting.vertices.length }, () => 0);
  for (const edge of facetting.edges) {
    degrees[edge.vertexIds[0]] += 1;
    degrees[edge.vertexIds[1]] += 1;
  }
  return degrees;
}

test("pentagon produces the required core, five tips, and long-short-long diagram", () => {
  const arrangement = buildArrangement(5);
  assert.equal(arrangement.lines.length, 5);
  assert.equal(arrangement.cells.length, 6);
  assert.equal(arrangement.cells.filter((cell) => cell.layer === 0).length, 1);
  assert.equal(arrangement.cells.filter((cell) => cell.layer === 1).length, 5);
  assert.equal(arrangement.diagram.length, 3);

  const lengths = arrangement.diagram.map((segment) => segment.t1 - segment.t0);
  assert.ok(lengths[0] > lengths[1]);
  assert.ok(lengths[2] > lengths[1]);
  assert.ok(Math.abs(lengths[0] - lengths[2]) < 1e-8);

  const orbits = buildOrbitMap(arrangement, { family: "D", order: 5 }).orbits;
  assert.deepEqual(orbits.map((orbit) => orbit.cellIds.length), [1, 5]);
});

test("octagon C2 groups opposite cells and support closure reaches the core", () => {
  const arrangement = buildArrangement(8);
  const orbitMap = buildOrbitMap(arrangement, { family: "C", order: 2 });
  const outer = orbitMap.orbits.find(
    (orbit) => orbit.layer === Math.max(...orbitMap.orbits.map((candidate) => candidate.layer)),
  );
  assert.ok(outer);
  assert.equal(outer.cellIds.length, 2);

  const closure = supportClosure(arrangement, outer.cellIds);
  assert.ok(closure.has(arrangement.coreCellId));
  assert.ok(closure.size > outer.cellIds.length);
  for (const cellId of outer.cellIds) assert.ok(closure.has(cellId));
});

test("all retained cells are bounded and every support edge descends one layer", () => {
  for (const sides of [3, 4, 5, 6, 7, 8, 10, 12]) {
    const arrangement = buildArrangement(sides);
    assert.ok(arrangement.cells.length >= 1);
    for (const cell of arrangement.cells) {
      assert.ok(Number.isFinite(cell.area) && cell.area > 0);
      assert.ok(cell.vertices.length >= 3);
      for (const lower of cell.lower) {
        assert.equal(arrangement.cells[lower].layer, cell.layer - 1);
      }
    }
  }
});

test("every diagram has one central segment representing the original polygon edge", () => {
  for (let sides = 3; sides <= 18; sides += 1) {
    const arrangement = buildArrangement(sides);
    const edgeSegments = arrangement.diagram.filter(
      (segment) => segment.aboveCellId === arrangement.coreCellId,
    );
    assert.equal(edgeSegments.length, 1, `${sides}-gon`);
    assert.ok(edgeSegments[0].t0 < 0, `${sides}-gon left endpoint`);
    assert.ok(edgeSegments[0].t1 > 0, `${sides}-gon right endpoint`);
  }
});

test("pentagon step 2 is a pentagram using only five original degree-two vertices", () => {
  const arrangement = buildArrangement(5);
  const facetting = buildFacetting(arrangement, 2);

  assert.equal(facetting.vertices.length, 5);
  assert.deepEqual(facetting.vertices, arrangement.cells[arrangement.coreCellId].vertices);
  assert.equal(facetting.edges.length, 5);
  assert.equal(facetting.componentCount, 1);
  assert.deepEqual(facetting.cycles.map((cycle) => cycle.length), [5]);
  assert.deepEqual(vertexDegrees(facetting), [2, 2, 2, 2, 2]);
  assert.ok(facetting.chordLength > 0);
  assert.ok(Number.isFinite(facetting.extent) && facetting.extent > 0);

  // Pentagram crossings remain intersections of edges, not extra graph vertices.
  assert.ok(
    facetting.edges.every((edge) =>
      edge.vertexIds.every((vertexId) => vertexId >= 0 && vertexId < facetting.vertices.length),
    ),
  );
});

test("hexagon step 2 is a compound of two triangles", () => {
  const facetting = buildFacetting(buildArrangement(6), 2);
  assert.equal(facetting.edges.length, 6);
  assert.equal(facetting.componentCount, 2);
  assert.deepEqual(facetting.components.map((component) => component.vertexIds.length), [3, 3]);
  assert.deepEqual(vertexDegrees(facetting), [2, 2, 2, 2, 2, 2]);
});

test("octagon step 3 is one eight-vertex cycle", () => {
  const facetting = buildFacetting(buildArrangement(8), 3);
  assert.equal(facetting.edges.length, 8);
  assert.equal(facetting.componentCount, 1);
  assert.deepEqual(facetting.cycles.map((cycle) => cycle.length), [8]);
  assert.deepEqual(vertexDegrees(facetting), Array(8).fill(2));
});

test("decagon step 4 is a compound of two pentagons", () => {
  const facetting = buildFacetting(buildArrangement(10), 4);
  assert.equal(facetting.edges.length, 10);
  assert.equal(facetting.componentCount, 2);
  assert.deepEqual(facetting.components.map((component) => component.vertexIds.length), [5, 5]);
  assert.deepEqual(vertexDegrees(facetting), Array(10).fill(2));
});

test("facetting options omit open diameter matchings and reject diameter steps", () => {
  assert.deepEqual(facettingOptions(6).map((option) => option.step), [1, 2]);
  assert.throws(() => buildFacetting(buildArrangement(6), 3), /diameter/i);
  assert.throws(() => buildFacetting(buildArrangement(8), 4), /diameter/i);
});

test("facetting diagram gives symmetric point pairs on the reference-vertex cut", () => {
  const arrangement = buildArrangement(10);
  const diagram = buildFacettingDiagram(arrangement);

  assert.deepEqual(diagram.pairs.map((pair) => pair.step), [1, 2, 3, 4]);
  for (const pair of diagram.pairs) {
    const [negative, positive] = pair.points;
    assert.ok(negative.position < 0);
    assert.ok(positive.position > 0);
    assert.ok(Math.abs(negative.position + positive.position) < 1e-8);
    assert.deepEqual(
      new Set(pair.points.map((point) => point.targetVertexId)),
      new Set([
        (diagram.referenceVertexId - pair.step + arrangement.sides) % arrangement.sides,
        (diagram.referenceVertexId + pair.step) % arrangement.sides,
      ]),
    );
    for (const diagramPoint of pair.points) {
      const fromCutOrigin = {
        x: diagramPoint.point.x - diagram.cutOrigin.x,
        y: diagramPoint.point.y - diagram.cutOrigin.y,
      };
      const normalDistance =
        fromCutOrigin.x * diagram.cutNormal.x + fromCutOrigin.y * diagram.cutNormal.y;
      assert.ok(Math.abs(normalDistance) < 1e-8);
    }
  }
  assert.ok(Math.abs(diagram.extent[0] + diagram.extent[1]) < 1e-8);
});

test("triangles and squares have only the base facetting option", () => {
  assert.deepEqual(facettingOptions(3).map((option) => option.step), [1]);
  assert.deepEqual(facettingOptions(4).map((option) => option.step), [1]);
});
