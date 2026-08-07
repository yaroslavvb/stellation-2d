export type DiagramSide = "above" | "below";

export type DiagramModifierKeys = {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
};

export function diagramSideForModifiers(
  modifiers: DiagramModifierKeys,
): DiagramSide | null {
  if (modifiers.shiftKey) return "below";
  if (modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey) return "above";
  return null;
}
