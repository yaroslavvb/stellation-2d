export type SelectionAction = "add" | "remove" | "toggle";

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
