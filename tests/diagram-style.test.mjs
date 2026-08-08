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

test("diagram focus uses a subtle side-aware outline", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const hit = css.match(/\.diagram-hit\s*\{([^}]*)\}/)?.[1] ?? "";
  const below = css.match(/\.diagram-hit\.below\s*\{([^}]*)\}/)?.[1] ?? "";
  const focus = css.match(/\.diagram-hit:focus-visible\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(hit, /--diagram-focus-color:\s*var\(--upper\)\s*;/);
  assert.match(below, /--diagram-focus-color:\s*var\(--lower\)\s*;/);
  assert.match(focus, /fill:\s*color-mix\(in srgb, var\(--diagram-focus-color\) 4%, transparent\)\s*;/);
  assert.match(focus, /stroke:\s*color-mix\(in srgb, var\(--diagram-focus-color\) 48%, var\(--line-strong\)\)\s*;/);
  assert.match(focus, /stroke-width:\s*1px\s*;/);
  assert.doesNotMatch(focus, /stroke:\s*var\(--cyan\)/);
});

test("facetting link radios suppress browser outline artifacts", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const focusedPair = css.match(/\.facet-link-pair:focus-visible\s*\{([^}]*)\}/)?.[1] ?? "";
  const focusRow = css.match(/\.facet-link-pair:focus-visible \.facet-link-row\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(focusedPair, /outline:\s*none\s*;/);
  assert.match(focusRow, /stroke:\s*var\(--cyan\)\s*;/);
});

test("facetting circuits use visible screen-space strokes", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const component = await readFile(new URL("../app/PolygonLab.tsx", import.meta.url), "utf8");
  const sourcePolygon = css.match(/\.source-polygon\s*\{([^}]*)\}/)?.[1] ?? "";
  const edge = css.match(/\.facetting-edges \.facetting-edge\s*\{([^}]*)\}/)?.[1] ?? "";
  const preview = css.match(/\.facetting-preview \.facetting-edge\s*\{([^}]*)\}/)?.[1] ?? "";
  const vertex = css.match(/\.source-vertex\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(edge, /stroke:\s*color-mix\(in srgb, var\(--facet-color\) 64%, var\(--text\)\)\s*;/);
  assert.match(edge, /stroke-width:\s*3px\s*;/);
  assert.match(edge, /opacity:\s*1\s*;/);
  assert.match(edge, /filter:\s*none\s*;/);
  assert.match(preview, /stroke-width:\s*2px\s*;/);
  assert.match(preview, /opacity:\s*0\.62\s*;/);
  assert.match(sourcePolygon, /stroke-width:\s*1\.25px\s*;/);
  assert.match(vertex, /stroke-width:\s*1\.5px\s*;/);
  assert.match(component, /<g className="facetting-edges">/);
  assert.doesNotMatch(component, /className="facetting-edges"[^>]*filter=/);
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
