export type SelectionAction = "add" | "remove" | "toggle";

export function applySelectionAction(
  current: ReadonlySet<number>,
  targets: Iterable<number>,
  action: SelectionAction,
) {
  const targetIds = [...targets];
  const next = new Set(current);
  const shouldAdd =
    action === "add" ||
    (action === "toggle" && targetIds.some((cellId) => !next.has(cellId)));

  for (const cellId of targetIds) {
    if (shouldAdd) next.add(cellId);
    else next.delete(cellId);
  }
  return next;
}
