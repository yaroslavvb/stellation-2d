import assert from "node:assert/strict";
import test from "node:test";
import {
  diagramCellForSide,
  diagramViewportPosition,
  isDiagramDrag,
} from "../app/diagram-interaction.ts";
import { buildArrangement } from "../app/geometry.ts";

test("maps direct diagram hit regions to their adjacent cells", () => {
  const segment = { aboveCellId: 7, belowCellId: 11 };
  assert.equal(diagramCellForSide(segment, "above"), 7);
  assert.equal(diagramCellForSide(segment, "below"), 11);
  assert.equal(
    diagramCellForSide({ aboveCellId: 2, belowCellId: null }, "below"),
    null,
  );
});

test("uses one drag threshold for horizontal and vertical movement", () => {
  assert.equal(isDiagramDrag(3, 3), false);
  assert.equal(isDiagramDrag(5, 0), true);
  assert.equal(isDiagramDrag(0, -5), true);
});

test("maps every geometric interval to exactly shared viewport endpoints", () => {
  const arrangement = buildArrangement(5);
  const baseSpan = arrangement.diagramExtent[1] - arrangement.diagramExtent[0];
  const span = baseSpan * 1.14;
  const center = (arrangement.diagramExtent[0] + arrangement.diagramExtent[1]) / 2;
  const start = center - span / 2;
  const mapped = arrangement.diagram.map((segment) => ({
    x0: diagramViewportPosition(segment.t0, start, span),
    x1: diagramViewportPosition(segment.t1, start, span),
  }));

  for (let index = 0; index + 1 < mapped.length; index += 1) {
    assert.equal(mapped[index].x1, mapped[index + 1].x0);
  }
  assert.ok(mapped.every(({ x0, x1 }) => x1 > x0));
});
