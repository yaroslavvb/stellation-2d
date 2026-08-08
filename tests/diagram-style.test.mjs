import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("diagram gives upper and lower rails and occupancy tracks identical styling", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const component = await readFile(new URL("../app/PolygonLab.tsx", import.meta.url), "utf8");
  const rail = css.match(/\.diagram-rail\s*\{([^}]*)\}/)?.[1] ?? "";
  const legendTracks = css.match(/\.diagram-legend \.upper-key,\s*\.diagram-legend \.lower-key\s*\{([^}]*)\}/)?.[1] ?? "";
  const legendColors = css.match(/\.upper-key,\s*\.lower-key\s*\{([^}]*)\}/)?.[1] ?? "";
  const occupancy = css.match(/\.diagram-occupancy\s*\{([^}]*)\}/)?.[1] ?? "";
  const occupied = css.match(/\.diagram-occupancy\.is-occupied\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(rail, /stroke:\s*var\(--text\)\s*;/);
  assert.match(rail, /stroke-width:\s*4px\s*;/);
  assert.match(rail, /stroke-linecap:\s*butt\s*;/);
  assert.match(rail, /opacity:\s*0\.24\s*;/);
  assert.doesNotMatch(css, /\.diagram-rail\.(?:above|below)\s*\{/);

  assert.match(legendTracks, /height:\s*4px\s*;/);
  assert.match(legendColors, /background:\s*var\(--upper\)\s*;/);

  assert.match(occupancy, /--diagram-track-color:\s*var\(--upper\)\s*;/);
  assert.match(occupancy, /stroke:\s*var\(--diagram-track-color\)\s*;/);
  assert.match(occupancy, /stroke-width:\s*4px\s*;/);
  assert.match(occupancy, /stroke-linecap:\s*butt\s*;/);
  assert.match(occupancy, /stroke-dasharray:\s*4px 5px\s*;/);
  assert.match(occupancy, /opacity:\s*0\.3\s*;/);
  assert.doesNotMatch(css, /\.diagram-occupancy\.(?:above|below|outermost)\s*\{/);
  assert.match(occupied, /stroke-dasharray:\s*none\s*;/);
  assert.match(occupied, /opacity:\s*1\s*;/);

  const outerColorOverride = 'style={{ "--diagram-track-color": outermostColor } as React.CSSProperties}';
  assert.equal(component.split(outerColorOverride).length - 1, 1, "only the outermost ray overrides the shared track color");
  assert.match(component, /"outermost",[\s\S]*?data-diagram-track="outer"[\s\S]*?style=\{\{ "--diagram-track-color": outermostColor \} as React\.CSSProperties\}/);
  assert.match(component, /data-occupied=\{upperSelected\}/);
  assert.match(component, /data-occupied=\{lowerSelected\}/);
  assert.doesNotMatch(component, /const boundaryCell = upperSelected !== lowerSelected/);
});

test("diagram pointer targets stay invisible and cannot draw a focus frame", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const hit = css.match(/\.diagram-hit\s*\{([^}]*)\}/)?.[1] ?? "";
  const empty = css.match(/\.diagram-hit\.is-empty\s*\{([^}]*)\}/)?.[1] ?? "";
  const focusRule = css.match(/(\.diagram-canvas \[data-diagram-action\],[^{]*)\{([^}]*)\}/);
  const focusSelectors = focusRule?.[1] ?? "";
  const focus = focusRule?.[2] ?? "";
  const occupiedPreview = css.match(/\.diagram-occupancy\.is-occupied\.is-preview\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(hit, /fill:\s*transparent\s*;/);
  assert.match(hit, /stroke:\s*none\s*;/);
  assert.match(hit, /outline:\s*none\s*;/);
  assert.match(hit, /cursor:\s*pointer\s*;/);
  assert.match(empty, /pointer-events:\s*none\s*;/);
  assert.match(focusSelectors, /\.diagram-canvas \[data-diagram-action\]:focus/);
  assert.match(focusSelectors, /\.diagram-canvas \[data-diagram-action\]:focus-visible/);
  assert.match(focus, /outline:\s*0\s*!important\s*;/);
  assert.match(focus, /outline-offset:\s*0\s*!important\s*;/);
  assert.match(focus, /box-shadow:\s*none\s*!important\s*;/);
  assert.match(focus, /-webkit-tap-highlight-color:\s*transparent\s*;/);
  assert.doesNotMatch(focus, /(?:^|\s)(?:fill|stroke|stroke-width):/m);
  assert.match(occupiedPreview, /stroke:\s*color-mix\(in srgb, var\(--diagram-track-color\) 74%, var\(--text\)\)\s*;/);
});

test("production CSS retains the hardened diagram focus guard", async () => {
  const assetDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = (await readdir(assetDirectory)).filter((file) => file.endsWith(".css"));
  assert.ok(files.length > 0, "the production build emits a CSS asset");
  const css = (await Promise.all(files.map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  const focus = css.match(/\.diagram-canvas \[data-diagram-action\],[^{]*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(focus, /outline:\s*0\s*!important/);
  assert.match(focus, /outline-offset:\s*0\s*!important/);
  assert.match(focus, /box-shadow:\s*none\s*!important/);
  assert.match(focus, /-webkit-tap-highlight-color:\s*transparent/);
});

test("the plane control colors the field without drawing a selection box", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const selectedPlane = css.match(/\.spatial-canvas\.is-plane-selected\s*\{([^}]*)\}/)?.[1] ?? "";
  const planeHit = css.match(/\.diagram-plane-hit\s*\{([^}]*)\}/)?.[1] ?? "";
  const focus = css.match(/\.diagram-canvas \[data-diagram-action\],[^{]*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(selectedPlane, /background-color:\s*color-mix\(in srgb, var\(--lower\) 13%, transparent\)\s*;/);
  assert.match(planeHit, /fill:\s*transparent\s*;/);
  assert.match(planeHit, /stroke:\s*none\s*;/);
  assert.match(planeHit, /cursor:\s*pointer\s*;/);
  assert.match(focus, /outline:\s*0\s*!important\s*;/);
  assert.doesNotMatch(focus, /(?:^|\s)(?:fill|stroke|stroke-width):/m);
});

test("outermost cells use frame-free end rays and fill-only spatial wedges", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const component = await readFile(new URL("../app/PolygonLab.tsx", import.meta.url), "utf8");
  const outerRegions = css.match(/\.outermost-region\s*\{([^}]*)\}/)?.[1] ?? "";
  const outerHit = css.match(/\.diagram-outer-hit\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(outerRegions, /stroke:\s*none\s*;/);
  assert.match(outerRegions, /pointer-events:\s*none\s*;/);
  assert.match(outerHit, /fill:\s*transparent\s*;/);
  assert.match(outerHit, /stroke:\s*none\s*;/);
  assert.match(outerHit, /outline:\s*none\s*;/);
  assert.match(component, /if \(target && action\) \{[\s\S]*event\.preventDefault\(\);[\s\S]*activeElement\.blur\(\);/);
  assert.doesNotMatch(component, /className="diagram-(?:band|selection-box)/);
});

test("every diagram target clears its hover preview on pointer leave", async () => {
  const component = await readFile(new URL("../app/PolygonLab.tsx", import.meta.url), "utf8");
  const markers = [
    'className="diagram-outer-hit"',
    'className={`diagram-hit above',
    'className={`diagram-hit below',
    'className="diagram-plane-hit"',
  ];

  for (const marker of markers) {
    const targetStart = component.indexOf(marker);
    assert.notEqual(targetStart, -1, `${marker} target exists`);
    const targetEnd = component.indexOf("/>", targetStart);
    const target = component.slice(targetStart, targetEnd);
    const enterStart = component.indexOf("onPointerEnter", targetStart);
    const leaveStart = component.indexOf("onPointerLeave", targetStart);
    assert.ok(enterStart > targetStart && enterStart < targetEnd, `${marker} has pointer-enter preview`);
    assert.ok(leaveStart > targetStart && leaveStart < targetEnd, `${marker} has pointer-leave cleanup`);
    assert.match(target, /focusable="false"/, `${marker} is structurally unfocusable`);
    assert.match(target, /aria-hidden="true"/, `${marker} is excluded from keyboard semantics`);
    assert.doesNotMatch(target, /\btabIndex=/, `${marker} has no tab stop`);
    assert.doesNotMatch(target, /\brole=/, `${marker} has no focusable button role`);
    assert.doesNotMatch(target, /\baria-pressed=/, `${marker} has no pressed button state`);
    assert.doesNotMatch(target, /\bonFocus=/, `${marker} has no SVG focus handler`);
    assert.doesNotMatch(target, /\bonBlur=/, `${marker} has no SVG blur handler`);
    assert.doesNotMatch(target, /\bonKeyDown=/, `${marker} has no keyboard activation handler`);
    assert.doesNotMatch(target, /\bonClick=/, `${marker} has no click-created SVG focus path`);
    const cleanup = component.slice(leaveStart, targetEnd);
    assert.match(cleanup, /setHoverSegment\(null\)/, `${marker} clears interval hover`);
    assert.match(cleanup, /setHoverDiagramSide\(null\)/, `${marker} clears side hover`);
    assert.match(cleanup, /setHoverOutermost\(null\)/, `${marker} clears outer hover`);
    assert.match(cleanup, /setHoverPlane\(false\)/, `${marker} clears plane hover`);
  }
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
