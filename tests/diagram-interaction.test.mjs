import assert from "node:assert/strict";
import test from "node:test";
import {
  DIAGRAM_HIT_BANDS,
  DIAGRAM_LABEL_Y,
  diagramCellForSide,
  diagramSpanAtZoom,
  diagramSpanForMatchingSpatialScale,
  diagramViewportPosition,
  isDiagramDrag,
  spatialLengthInDiagramUnits,
} from "../app/diagram-interaction.ts";
import { buildArrangement, buildFacetting } from "../app/geometry.ts";

test("keeps the lower-cell and plane pointer bands distinct and usable", () => {
  const contains = (band, position) =>
    position >= band.start && position < band.end;
  const above = DIAGRAM_HIT_BANDS.above;
  const lower = DIAGRAM_HIT_BANDS.below;
  const plane = DIAGRAM_HIT_BANDS.plane;

  assert.equal(above.end, lower.start, "above and lower bands are adjacent");
  assert.ok(lower.start < lower.end);
  assert.ok(plane.start < plane.end);
  assert.equal(lower.end, plane.start, "lower and plane bands are adjacent");
  assert.equal(
    Math.max(lower.start, plane.start) < Math.min(lower.end, plane.end),
    false,
    "lower and plane bands do not overlap",
  );

  assert.equal(contains(lower, DIAGRAM_LABEL_Y.below), true);
  assert.ok(
    lower.end - DIAGRAM_LABEL_Y.below >= 10,
    "the lower-cell target extends meaningfully below its label",
  );
  assert.equal(contains(plane, DIAGRAM_LABEL_Y.plane), true);

  assert.equal(contains(lower, 80), true, "a click below O2 still selects O2");
  assert.equal(contains(plane, 80), false);
  assert.equal(contains(lower, 89), false);
  assert.equal(contains(plane, 89), true, "a click on the plane label selects the plane");
});

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

test("maps facetting chord lengths into the diagram at the spatial pixel scale", () => {
  const diagramUnits = spatialLengthInDiagramUnits(
    1.5,
    6,
    1600,
    700,
    1600,
  );
  const diagramPixels = diagramUnits * (1600 / 1000);
  const spatialPixels = 1.5 * (700 / 6);

  assert.ok(Math.abs(diagramPixels - spatialPixels) < 1e-10);

  const zoomedUnits = spatialLengthInDiagramUnits(
    1.5,
    6 / 2,
    1600,
    700,
    1600,
  );
  assert.ok(Math.abs(zoomedUnits / diagramUnits - 2) < 1e-10);
});
