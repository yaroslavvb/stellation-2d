import assert from "node:assert/strict";
import test from "node:test";
import { buildOrbitCardinalityPalette } from "../app/orbit-palette.ts";

test("builds a stable cardinality legend from sorted distinct orbit sizes", () => {
  const palette = buildOrbitCardinalityPalette([5, 1, 5, 2, 1]);
  assert.deepEqual([...palette.keys()], [1, 2, 5]);
  assert.equal(new Set(palette.values()).size, 3);
  assert.match(palette.get(1) ?? "", /^rgb\(/);
});

test("ignores invalid cardinalities", () => {
  assert.deepEqual(
    [...buildOrbitCardinalityPalette([0, -1, 1.5, 3]).keys()],
    [3],
  );
});
