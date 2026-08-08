import assert from "node:assert/strict";
import test from "node:test";
import {
  diagramCellForSide,
  diagramSpanAtZoom,
  diagramSpanForMatchingSpatialScale,
  diagramViewportPosition,
  isDiagramDrag,
} from "../app/diagram-interaction.ts";
import { buildArrangement, buildFacetting } from "../app/geometry.ts";

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

test("matches spatial zoom exactly in the corresponding diagram interval", () => {
  const arrangement = buildArrangement(5);
  const baseSpatialSpan = arrangement.extent * 2.34;
  const spatialWidth = 1600;
  const spatialHeight = 700;
  const diagramWidth = 1600;
  const center = (arrangement.diagramExtent[0] + arrangement.diagramExtent[1]) / 2;
  const coreSegment = arrangement.diagram.find(
    (segment) =>
      segment.aboveCellId === arrangement.coreCellId ||
      segment.belowCellId === arrangement.coreCellId,
  );
  assert.ok(coreSegment);

  const intervalPixels = (spatialZoom, diagramZoom = 1) => {
    const spatialSpan = baseSpatialSpan / spatialZoom;
    const diagramSpan = diagramSpanForMatchingSpatialScale(
      spatialSpan,
      spatialWidth,
      spatialHeight,
      diagramWidth,
      diagramZoom,
    );
    const start = center - diagramSpan / 2;
    return (
      diagramViewportPosition(coreSegment.t1, start, diagramSpan, diagramWidth) -
      diagramViewportPosition(coreSegment.t0, start, diagramSpan, diagramWidth)
    );
  };

  const basePixels = intervalPixels(1);
  for (const spatialZoom of [0.55, 1, 2, 4, 8]) {
    const spatialSpan = baseSpatialSpan / spatialZoom;
    const polygonSidePixels =
      buildFacetting(arrangement, 1).chordLength *
      (Math.min(spatialWidth, spatialHeight) / spatialSpan);
    const diagramPixels = intervalPixels(spatialZoom);

    assert.ok(Math.abs(diagramPixels - polygonSidePixels) < 1e-8);
    assert.ok(Math.abs(diagramPixels / basePixels - spatialZoom) < 1e-8);
  }

  assert.ok(Math.abs(intervalPixels(2, 1.5) / basePixels - 3) < 1e-8);
});

test("scales standalone and fallback diagram spans with spatial zoom", () => {
  for (const zoom of [0.55, 1, 2, 4, 8]) {
    assert.equal(diagramSpanAtZoom(24, zoom), 24 / zoom);
  }
  assert.equal(diagramSpanAtZoom(24, 2 * 1.5), 8);
});
