import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArrangement,
  buildOrbitMap,
  supportClosure,
} from "../app/geometry.ts";

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
