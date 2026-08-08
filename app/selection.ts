export type SelectionAction = "add" | "remove" | "toggle";

export const PLANE_SELECTION_ID = -1;
const OUTERMOST_SELECTION_ID_BASE = -2;

export function outermostSelectionId(cellId: number) {
  if (!Number.isSafeInteger(cellId) || cellId < 0) {
    throw new RangeError("Outermost cell id must be a non-negative integer.");
  }
  return OUTERMOST_SELECTION_ID_BASE - cellId;
}

export function outermostCellId(selectionId: number) {
  if (!Number.isSafeInteger(selectionId) || selectionId > OUTERMOST_SELECTION_ID_BASE) {
    return null;
  }
  return OUTERMOST_SELECTION_ID_BASE - selectionId;
}

export function toggleActionForTargets(
  current: ReadonlySet<number>,
  targets: Iterable<number>,
): Exclude<SelectionAction, "toggle"> {
  return [...targets].every((cellId) => current.has(cellId)) ? "remove" : "add";
}

export function applySelectionAction(
  current: ReadonlySet<number>,
  targets: Iterable<number>,
  action: SelectionAction,
) {
  const targetIds = [...targets];
  const next = new Set(current);
  const shouldAdd =
    action === "add" ||
    (action === "toggle" && toggleActionForTargets(next, targetIds) === "add");

  for (const cellId of targetIds) {
    if (shouldAdd) next.add(cellId);
    else next.delete(cellId);
  }
  return next;
}
