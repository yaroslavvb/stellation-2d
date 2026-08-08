import assert from "node:assert/strict";
import test from "node:test";
import {
  applySelectionAction,
  outermostCellId,
  outermostSelectionId,
  PLANE_SELECTION_ID,
  toggleActionForTargets,
} from "../app/selection.ts";

test("the core orbit can be toggled all the way off", () => {
  const selected = applySelectionAction(new Set([0]), [0], "toggle");
  assert.deepEqual([...selected], []);
});

test("whole-layer toggles complete partial layers and clear full layers", () => {
  const layer = [3, 4, 5];
  assert.equal(toggleActionForTargets(new Set([3]), layer), "add");
  assert.equal(toggleActionForTargets(new Set(layer), layer), "remove");

  const completed = applySelectionAction(new Set([3]), layer, "toggle");
  assert.deepEqual([...completed], layer);
  assert.deepEqual([...applySelectionAction(completed, layer, "toggle")], []);
});

test("selection actions add, remove, and toggle complete target orbits", () => {
  assert.deepEqual(
    [...applySelectionAction(new Set([0]), [1, 2], "add")],
    [0, 1, 2],
  );
  assert.deepEqual(
    [...applySelectionAction(new Set([0, 1, 2]), [0, 1], "remove")],
    [2],
  );
  assert.deepEqual(
    [...applySelectionAction(new Set([0, 1]), [1, 2], "toggle")],
    [0, 1, 2],
  );
});

test("the plane selection toggles independently of bounded cells", () => {
  const selected = applySelectionAction(
    new Set([0, 2]),
    [PLANE_SELECTION_ID],
    "toggle",
  );
  assert.deepEqual([...selected], [0, 2, PLANE_SELECTION_ID]);
  assert.deepEqual(
    [...applySelectionAction(selected, [PLANE_SELECTION_ID], "toggle")],
    [0, 2],
  );
});

test("outermost cells have distinct reversible selection ids", () => {
  const ids = [0, 1, 7, 128].map(outermostSelectionId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((selectionId) => selectionId < PLANE_SELECTION_ID));
  assert.deepEqual(ids.map(outermostCellId), [0, 1, 7, 128]);
  assert.equal(outermostCellId(PLANE_SELECTION_ID), null);
  assert.equal(outermostCellId(0), null);
  assert.throws(() => outermostSelectionId(-1), /non-negative integer/);
  assert.throws(() => outermostSelectionId(1.5), /non-negative integer/);
});

test("outermost orbit selections toggle independently of the plane and bounded cells", () => {
  const outerOrbit = [outermostSelectionId(0), outermostSelectionId(3)];
  const otherOuterCell = outermostSelectionId(1);
  const selected = applySelectionAction(
    new Set([0, PLANE_SELECTION_ID, otherOuterCell]),
    outerOrbit,
    "toggle",
  );
  assert.deepEqual(
    [...selected],
    [0, PLANE_SELECTION_ID, otherOuterCell, ...outerOrbit],
  );
  assert.deepEqual(
    [...applySelectionAction(selected, outerOrbit, "toggle")],
    [0, PLANE_SELECTION_ID, otherOuterCell],
  );
});
