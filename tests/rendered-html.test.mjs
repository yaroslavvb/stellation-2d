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
  assert.match(html, /click a segment for its cell · click plane below the polygon edge/);
  assert.doesNotMatch(html, /diagram-band/);
  assert.equal(html.match(/class="diagram-occupancy/g)?.length, 6);
  assert.equal(html.match(/data-diagram-track="above"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-track="below"/g)?.length, 3);
  assert.equal(html.match(/data-occupied="true"/g)?.length, 1);
  assert.equal(html.match(/data-occupied="false"/g)?.length, 5);
  assert.equal(html.match(/data-diagram-side="above"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-side="below"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-action="above"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-action="below"/g)?.length, 3);
  assert.equal(html.match(/data-diagram-action="plane"/g)?.length, 1);
  assert.equal(html.match(/class="diagram-hit/g)?.length, 6);
  assert.equal(html.match(/data-segment-id="0"/g)?.length, 2);
  assert.equal(html.match(/data-segment-id="1"/g)?.length, 3);
  assert.equal(html.match(/data-segment-id="2"/g)?.length, 2);
  assert.match(html, /role="group" aria-label="One-dimensional arrangement/);
  assert.equal(html.match(/aria-pressed="(?:true|false)" aria-label="Interval/g)?.length, 4);
  assert.match(html, /data-diagram-plane="true" tabindex="0" role="button" aria-pressed="false" aria-label="Below the polygon edge. Toggle entire plane."/);
  assert.match(html, /class="spatial-canvas" data-plane-selected="false"/);
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
