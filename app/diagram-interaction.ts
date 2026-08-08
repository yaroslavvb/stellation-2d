export type DiagramSide = "above" | "below";

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
