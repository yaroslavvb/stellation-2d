import assert from "node:assert/strict";
import test from "node:test";
import { diagramSideForModifiers } from "../app/diagram-interaction.ts";

test("maps diagram modifiers to the reference-app above/below convention", () => {
  assert.equal(diagramSideForModifiers({}), null);
  assert.equal(diagramSideForModifiers({ shiftKey: true }), "below");
  assert.equal(diagramSideForModifiers({ ctrlKey: true }), "above");
  assert.equal(diagramSideForModifiers({ metaKey: true }), "above");
  assert.equal(diagramSideForModifiers({ altKey: true }), "above");
});

test("Shift takes precedence when multiple diagram modifiers are held", () => {
  assert.equal(
    diagramSideForModifiers({ shiftKey: true, ctrlKey: true, altKey: true }),
    "below",
  );
});
