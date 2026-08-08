import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("active diagram intervals use the rail's exact stroke width without a halo", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const rail = css.match(/\.diagram-rail\s*\{([^}]*)\}/)?.[1] ?? "";
  const interval = css.match(/\.diagram-interval\s*\{([^}]*)\}/)?.[1] ?? "";
  const boundary = css.match(/\.diagram-interval\.is-boundary\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(rail, /stroke-width:\s*4\s*;/);
  assert.match(interval, /stroke-width:\s*4\s*;/);
  assert.doesNotMatch(boundary, /stroke-width|drop-shadow/);
});

test("facetting link radios suppress browser outline artifacts", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const focusedPair = css.match(/\.facet-link-pair:focus-visible\s*\{([^}]*)\}/)?.[1] ?? "";
  const focusRow = css.match(/\.facet-link-pair:focus-visible \.facet-link-row\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(focusedPair, /outline:\s*none\s*;/);
  assert.match(focusRow, /stroke:\s*var\(--cyan\)\s*;/);
});

test("uses the canonical Stellation palette foundations and layer sequence", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const token of [
    "--bg: #0b0d11",
    "--panel: #12151c",
    "--text: #e6e9f0",
    "--gold: #f5b942",
    "--cyan: #6fa8ff",
    "--layer-0: #fac252",
    "--layer-11: #b38c73",
  ]) {
    assert.match(css, new RegExp(token));
  }
});
