import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function numericAttribute(tag, name) {
  const value = tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
  assert.notEqual(value, undefined, `${name} is present on ${tag}`);
  const number = Number(value);
  assert.equal(Number.isFinite(number), true, `${name} is numeric on ${tag}`);
  return number;
}

test("server-renders Stellation by default with both construction modes available", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Stellation &amp; Facetting 2D/);
  assert.match(html, /aria-label="Construction mode"/);
  assert.match(html, /aria-pressed="true">Stellation<\/button>/);
  assert.match(html, /aria-pressed="false">Facetting<\/button>/);
  assert.match(html, /id="theme-bootstrap"/);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.match(html, /aria-label="Theme: System"/);
  assert.match(html, /title="System theme · click for Light"/);
  assert.match(html, />◐<\/span>/);
  assert.match(html, /Supporting lines, stellation cells/);
  assert.match(html, /Cells immediately above and below the line/);
  assert.match(html, /<button type="button">clear<\/button>/);
  assert.match(html, /segments select cells · end rays select outermost · plane selects the field/);
  assert.doesNotMatch(html, /diagram-band/);
  assert.equal(html.match(/class="diagram-occupancy/g)?.length, 8);
  assert.equal(html.match(/data-diagram-track="above"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-track="below"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-track="outer"/g)?.length, 2);
  assert.equal(html.match(/data-occupied="true"/g)?.length, 1);
  assert.equal(html.match(/data-occupied="false"/g)?.length, 7);
  assert.equal(html.match(/data-diagram-side="above"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-side="below"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-action="above"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-action="below"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-action="outer"/g)?.length, 2);
  assert.equal(html.match(/data-diagram-action="plane"/g)?.length, 1);
  assert.equal(html.match(/class="diagram-hit/g)?.length, 6);
  assert.equal(html.match(/data-segment-id="0"/g)?.length, 3);
  assert.equal(html.match(/data-segment-id="1"/g)?.length, 3);
  assert.equal(html.match(/data-segment-id="2"/g)?.length, 2);
  assert.equal(html.match(/data-segment-id="3"/g)?.length, 1);
  assert.match(html, /role="group" aria-label="One-dimensional arrangement/);
  const diagramTargets = [...html.matchAll(/<rect\b(?=[^>]*\bdata-diagram-action="[^"]+")[^>]*>/g)].map(
    ([tag]) => tag,
  );
  assert.equal(diagramTargets.length, 9);
  for (const target of diagramTargets) {
    assert.match(target, /\bfocusable="false"/);
    assert.match(target, /\baria-hidden="true"/);
    assert.doesNotMatch(target, /\btabindex=/);
    assert.doesNotMatch(target, /\brole=/);
    assert.doesNotMatch(target, /\baria-pressed=/);
    assert.doesNotMatch(target, /\baria-label=/);
  }
  assert.equal(html.match(/data-diagram-outer="true"/g)?.length, 2);
  const planeTargets = diagramTargets.filter((tag) => /\bdata-diagram-plane="true"/.test(tag));
  assert.equal(planeTargets.length, 1, "one plane target covers the complete bounded line");
  const planeTarget = planeTargets[0];
  assert.match(planeTarget, /data-diagram-plane="true" focusable="false" aria-hidden="true"/);

  const stellationSvg = html.match(/<svg\b(?=[^>]*class="diagram-canvas stellation-diagram-canvas")(?=[^>]*aria-label="One-dimensional arrangement)[^>]*>/)?.[0] ?? "";
  assert.notEqual(stellationSvg, "", "the rendered stellation diagram exists");
  const viewBox = stellationSvg.match(/\bviewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number) ?? [];
  assert.equal(viewBox.length, 4);
  assert.equal(viewBox.every(Number.isFinite), true);

  const boundedRail = html.match(/<line\b(?=[^>]*class="diagram-rail above")[^>]*>/)?.[0] ?? "";
  assert.notEqual(boundedRail, "", "the bounded arrangement rail exists");
  const planeX = numericAttribute(planeTarget, "x");
  const planeY = numericAttribute(planeTarget, "y");
  const planeWidth = numericAttribute(planeTarget, "width");
  const planeHeight = numericAttribute(planeTarget, "height");
  const railStart = numericAttribute(boundedRail, "x1");
  const railEnd = numericAttribute(boundedRail, "x2");

  assert.ok(Math.abs(planeX - railStart) < 1e-9, "plane target begins at the bounded rail start");
  assert.ok(Math.abs(planeX + planeWidth - railEnd) < 1e-9, "plane target reaches the bounded rail end");
  assert.ok(Math.abs(planeY + planeHeight - (viewBox[1] + viewBox[3])) < 1e-9, "plane target reaches the true viewBox bottom");
  assert.match(html, /class="spatial-canvas" data-outermost-selected="false" data-plane-selected="false"/);
  assert.match(html, /class="outermost-region-layer" aria-hidden="true"/);
  assert.equal(html.match(/class="outermost-region"/g)?.length, 5);
  assert.match(html, /data-layer-number="1" aria-label="Toggle every cell in layer 1" aria-pressed="false"/);
  assert.match(html, /data-layer-number="0" aria-label="Toggle every cell in layer 0" aria-pressed="true"/);
  assert.match(html, /<kbd>layer #<\/kbd><span>toggle the whole layer<\/span>/);
  assert.match(html, /aria-label="Cells per orbit color legend"/);
  assert.match(html, /data-orbit-size="5"/);
  assert.match(html, /role="group" aria-label="Cell orbits by layer"/);
  assert.match(html, /aria-label="L0 · O1: toggle 1 congruent cell"/);
  assert.match(html, /Stellation correspondence/);
  assert.match(html, /<b>5<\/b> lines/);
  assert.match(html, /<b>6<\/b> bounded cells/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});
