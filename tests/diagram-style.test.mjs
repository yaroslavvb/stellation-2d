import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("diagram uses independent solid upper and lower occupancy tracks", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const component = await readFile(new URL("../app/PolygonLab.tsx", import.meta.url), "utf8");
  const upperRail = css.match(/\.diagram-rail\.above\s*\{([^}]*)\}/)?.[1] ?? "";
  const lowerRail = css.match(/\.diagram-rail\.below\s*\{([^}]*)\}/)?.[1] ?? "";
  const occupancy = css.match(/\.diagram-occupancy\s*\{([^}]*)\}/)?.[1] ?? "";
  const lower = css.match(/\.diagram-occupancy\.below\s*\{([^}]*)\}/)?.[1] ?? "";
  const occupied = css.match(/\.diagram-occupancy\.is-occupied\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(upperRail, /stroke-width:\s*4px\s*;/);
  assert.match(lowerRail, /stroke-width:\s*2px\s*;/);
  assert.match(occupancy, /stroke-width:\s*4px\s*;/);
  assert.match(occupancy, /stroke-dasharray:\s*4px 5px\s*;/);
  assert.match(lower, /stroke-width:\s*2px\s*;/);
  assert.match(occupied, /stroke-dasharray:\s*none\s*;/);
  assert.match(occupied, /opacity:\s*1\s*;/);
  assert.match(component, /data-occupied=\{upperSelected\}/);
  assert.match(component, /data-occupied=\{lowerSelected\}/);
  assert.doesNotMatch(component, /const boundaryCell = upperSelected !== lowerSelected/);
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

test("facetting diagram text keeps natural proportions and a clear type hierarchy", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const component = await readFile(new URL("../app/PolygonLab.tsx", import.meta.url), "utf8");
  const symbol = css.match(/\.facet-link-symbol\s*\{([^}]*)\}/)?.[1] ?? "";
  const node = css.match(/\.facet-link-node-label\s*\{([^}]*)\}/)?.[1] ?? "";
  const description = css.match(/^\.facet-link-description\s*\{(\s*fill:[^}]*)\}/m)?.[1] ?? "";
  const legend = css.match(/\.diagram-legend\s*\{([^}]*)\}/)?.[1] ?? "";
  const diagramLabel = css.match(/\.diagram-label\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(component, /diagramHeight:\s*diagramBounds\.height/);
  assert.match(component, /const diagramViewBox = `0 0 \$\{diagramViewportWidth\} \$\{diagramViewportHeight\}`/);
  assert.match(component, /const diagramY = \(position: number\) => \(position \/ 100\) \* diagramViewportHeight/);
  assert.match(component, /viewBox=\{`0 0 \$\{facetLinkViewportWidth\} \$\{facetLinkViewportHeight\}`\}/);
  assert.match(component, /const rowSpan = facetLinkViewportHeight \/ Math\.max\(1, facetLinks\.length\)/);
  assert.match(symbol, /font:\s*600 10px\/1 var\(--mono\)\s*;/);
  assert.match(node, /font:\s*650 9px\/1 var\(--sans\)\s*;/);
  assert.match(node, /font-variant-numeric:\s*tabular-nums\s*;/);
  assert.match(description, /font:\s*500 10px\/1\.2 var\(--sans\)\s*;/);
  assert.match(legend, /font:\s*500 10\.5px\/1\.2 var\(--sans\)\s*;/);
  assert.match(diagramLabel, /font:\s*600 10px\/1 var\(--sans\)\s*;/);
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
