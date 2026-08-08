export type DiagramSide = "above" | "below";
export type DiagramAction = DiagramSide | "plane";

export type DiagramNeighbors = {
  aboveCellId: number | null;
  belowCellId: number | null;
};

export const DIAGRAM_DRAG_THRESHOLD_PX = 5;

export function diagramCellForSide(
  segment: DiagramNeighbors,
  side: DiagramSide,
) {
  return side === "above" ? segment.aboveCellId : segment.belowCellId;
}

export function isDiagramDrag(deltaX: number, deltaY: number) {
  return Math.hypot(deltaX, deltaY) >= DIAGRAM_DRAG_THRESHOLD_PX;
}

export function diagramViewportPosition(
  position: number,
  start: number,
  span: number,
  viewportWidth = 1000,
) {
  if (!(span > 0)) throw new RangeError("Diagram span must be positive.");
  return ((position - start) / span) * viewportWidth;
}

export function diagramSpanAtZoom(baseSpan: number, zoom: number) {
  if (!(baseSpan > 0) || !(zoom > 0)) {
    throw new RangeError("Diagram span and zoom must be positive.");
  }
  return baseSpan / zoom;
}

export function diagramSpanForMatchingSpatialScale(
  spatialSpan: number,
  spatialWidth: number,
  spatialHeight: number,
  diagramWidth: number,
  diagramZoom = 1,
) {
  if (
    !(spatialSpan > 0) ||
    !(spatialWidth > 0) ||
    !(spatialHeight > 0) ||
    !(diagramWidth > 0) ||
    !(diagramZoom > 0)
  ) {
    throw new RangeError("View spans, dimensions, and zoom must be positive.");
  }

  const spatialPixelsPerUnit = Math.min(spatialWidth, spatialHeight) / spatialSpan;
  return diagramWidth / (spatialPixelsPerUnit * diagramZoom);
}

export function spatialLengthInDiagramUnits(
  length: number,
  spatialSpan: number,
  spatialWidth: number,
  spatialHeight: number,
  diagramWidth: number,
  diagramViewportWidth = 1000,
) {
  if (
    !Number.isFinite(length) ||
    !Number.isFinite(spatialSpan) ||
    !Number.isFinite(spatialWidth) ||
    !Number.isFinite(spatialHeight) ||
    !Number.isFinite(diagramWidth) ||
    !Number.isFinite(diagramViewportWidth) ||
    !(length >= 0) ||
    !(spatialSpan > 0) ||
    !(spatialWidth > 0) ||
    !(spatialHeight > 0) ||
    !(diagramWidth > 0) ||
    !(diagramViewportWidth > 0)
  ) {
    throw new RangeError("Length, spans, and dimensions must be finite and non-negative.");
  }

  const spatialPixelsPerUnit = Math.min(spatialWidth, spatialHeight) / spatialSpan;
  return length * spatialPixelsPerUnit * (diagramViewportWidth / diagramWidth);
}
