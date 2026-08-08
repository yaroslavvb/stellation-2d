import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SHARE_STATE,
  formatShareHash,
  parseShareHash,
} from "../app/share-state.ts";

test("defines and formats the Stellation default", () => {
  assert.deepEqual(DEFAULT_SHARE_STATE, {
    mode: "stellation",
    sides: 5,
    symmetry: { family: "D", order: 5 },
    orbitIds: [0],
    planeSelected: false,
    facetStep: 1,
  });
  assert.equal(
    formatShareHash(DEFAULT_SHARE_STATE),
    "#v=2&mode=stellation&n=5&sym=D5&st=0&fa=1",
  );
});

test("accepts legacy hashes as Stellation state", () => {
  assert.deepEqual(parseShareHash("#p5/D5/{2,0,2}"), {
    mode: "stellation",
    sides: 5,
    symmetry: { family: "D", order: 5 },
    orbitIds: [0, 2],
    planeSelected: false,
    facetStep: 1,
  });
  assert.deepEqual(parseShareHash("#p5%2FC5%2F%7B%7D"), {
    mode: "stellation",
    sides: 5,
    symmetry: { family: "C", order: 5 },
    orbitIds: [],
    planeSelected: false,
    facetStep: 1,
  });
});

test("round-trips both terminology modes through canonical v2 hashes", () => {
  const states = [
    {
      mode: "stellation",
      sides: 8,
      symmetry: { family: "C", order: 2 },
      orbitIds: [0, 3, 9],
      planeSelected: false,
      facetStep: 3,
    },
    {
      mode: "facetting",
      sides: 5,
      symmetry: { family: "D", order: 5 },
      orbitIds: [0, 2],
      planeSelected: true,
      facetStep: 2,
    },
  ];

  for (const state of states) {
    assert.deepEqual(parseShareHash(formatShareHash(state)), state);
  }
});

test("round-trips a completely empty stellation selection", () => {
  const state = {
    mode: "stellation",
    sides: 5,
    symmetry: { family: "D", order: 5 },
    orbitIds: [],
    planeSelected: false,
    facetStep: 1,
  };

  assert.equal(
    formatShareHash(state),
    "#v=2&mode=stellation&n=5&sym=D5&st=&fa=1",
  );
  assert.deepEqual(parseShareHash(formatShareHash(state)), state);
});

test("round-trips the optional entire-plane selection", () => {
  const state = {
    mode: "stellation",
    sides: 5,
    symmetry: { family: "D", order: 5 },
    orbitIds: [0],
    planeSelected: true,
    facetStep: 1,
  };

  assert.equal(
    formatShareHash(state),
    "#v=2&mode=stellation&n=5&sym=D5&st=0&pl=1&fa=1",
  );
  assert.deepEqual(parseShareHash(formatShareHash(state)), state);
});

test("rejects invalid shared geometry and malformed input safely", () => {
  for (const hash of [
    "",
    "#v=1&mode=stellation&n=5&sym=D5&st=0&fa=1",
    "#v=2&mode=unknown&n=5&sym=D5&st=0&fa=1",
    "#v=2&mode=stellation&n=2&sym=D2&st=0&fa=1",
    "#v=2&mode=stellation&n=19&sym=D19&st=0&fa=1",
    "#v=2&mode=stellation&n=6&sym=D4&st=0&fa=1",
    "#v=2&mode=stellation&n=6&sym=D0&st=0&fa=1",
    "#p5/D2/{0}",
    "#p5/D5/%E0%A4%A",
  ]) {
    assert.equal(parseShareHash(hash), null, hash);
  }
});

test("defaults missing or malformed mode-specific fields without discarding shared geometry", () => {
  assert.deepEqual(parseShareHash("#v=2&n=8&sym=C2&st=4&fa=3"), {
    mode: "stellation",
    sides: 8,
    symmetry: { family: "C", order: 2 },
    orbitIds: [4],
    planeSelected: false,
    facetStep: 3,
  });

  for (const hash of [
    "#v=2&mode=facetting&n=5&sym=D5&fa=2",
    "#v=2&mode=facetting&n=5&sym=D5&st=-1&fa=2",
    "#v=2&mode=facetting&n=5&sym=D5&st=0,,2&fa=2",
  ]) {
    assert.deepEqual(parseShareHash(hash), {
      mode: "facetting",
      sides: 5,
      symmetry: { family: "D", order: 5 },
      orbitIds: [0],
      planeSelected: false,
      facetStep: 2,
    });
  }
});

test("resets only an invalid or missing facet step to one", () => {
  const prefix = "#v=2&mode=facetting&n=5&sym=C5&st=0,2";
  for (const suffix of ["", "&fa=0", "&fa=3", "&fa=nope", "&fa=1.5"]) {
    assert.deepEqual(parseShareHash(`${prefix}${suffix}`), {
      mode: "facetting",
      sides: 5,
      symmetry: { family: "C", order: 5 },
      orbitIds: [0, 2],
      planeSelected: false,
      facetStep: 1,
    });
  }

  assert.equal(
    formatShareHash({
      mode: "facetting",
      sides: 5,
      symmetry: { family: "C", order: 5 },
      orbitIds: [0, 2],
      planeSelected: false,
      facetStep: 99,
    }),
    "#v=2&mode=facetting&n=5&sym=C5&st=0,2&fa=1",
  );
});

test("formats fields canonically and deduplicates sorted orbit ids", () => {
  assert.equal(
    formatShareHash({
      mode: "facetting",
      sides: 10,
      symmetry: { family: "D", order: 2 },
      orbitIds: [7, 2, 7, 0, 2],
      planeSelected: false,
      facetStep: 4,
    }),
    "#v=2&mode=facetting&n=10&sym=D2&st=0,2,7&fa=4",
  );
});
