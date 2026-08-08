import assert from "node:assert/strict";
import test from "node:test";
import {
  applySelectionAction,
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
