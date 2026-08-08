export type LabMode = "stellation" | "facetting";

export type ShareState = {
  mode: LabMode;
  sides: number;
  symmetry: {
    family: "C" | "D";
    order: number;
  };
  orbitIds: number[];
  planeSelected: boolean;
  facetStep: number;
};

export const DEFAULT_SHARE_STATE: ShareState = {
  mode: "stellation",
  sides: 5,
  symmetry: { family: "D", order: 5 },
  orbitIds: [0],
  planeSelected: false,
  facetStep: 1,
};

const MIN_SIDES = 3;
const MAX_SIDES = 18;

function parseUnsignedInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function validSides(value: number | null): value is number {
  return value !== null && value >= MIN_SIDES && value <= MAX_SIDES;
}

function validMode(value: string | null): value is LabMode {
  return value === "stellation" || value === "facetting";
}

function parseSymmetry(
  value: string | null,
  sides: number,
): ShareState["symmetry"] | null {
  const match = value?.match(/^(C|D)(\d+)$/i);
  if (!match) return null;

  const order = parseUnsignedInteger(match[2]);
  if (order === null || order < 1 || sides % order !== 0) return null;

  return {
    family: match[1].toUpperCase() as "C" | "D",
    order,
  };
}

function parseOrbitIds(value: string | null): number[] | null {
  if (value === null) return null;
  if (value === "") return [];

  const unique = new Set<number>();
  for (const token of value.split(",")) {
    const orbitId = parseUnsignedInteger(token);
    if (orbitId === null) return null;
    unique.add(orbitId);
  }
  return [...unique].sort((a, b) => a - b);
}

function normalizeOrbitIds(values: number[]): number[] | null {
  const unique = new Set<number>();
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    unique.add(value);
  }
  return [...unique].sort((a, b) => a - b);
}

function normalizeFacetStep(value: unknown, sides: number): number {
  const maximum = Math.floor((sides - 1) / 2);
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= maximum
    ? value
    : 1;
}

function parseV2Hash(value: string): ShareState | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(value);
  } catch {
    return null;
  }

  if (params.get("v") !== "2") return null;

  const rawMode = params.get("mode");
  const mode = rawMode === null ? "stellation" : rawMode;
  const sides = parseUnsignedInteger(params.get("n"));
  if (!validMode(mode) || !validSides(sides)) return null;

  const symmetry = parseSymmetry(params.get("sym"), sides);
  const orbitIds = parseOrbitIds(params.get("st")) ?? [0];
  if (!symmetry) return null;

  const rawFacetStep = parseUnsignedInteger(params.get("fa"));
  return {
    mode,
    sides,
    symmetry,
    orbitIds,
    planeSelected: params.get("pl") === "1",
    facetStep: normalizeFacetStep(rawFacetStep, sides),
  };
}

function parseLegacyHash(value: string): ShareState | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  const match = decoded.match(/^p(\d+)\/(C|D)(\d+)\/\{([\d,]*)\}$/i);
  if (!match) return null;

  const sides = parseUnsignedInteger(match[1]);
  if (!validSides(sides)) return null;

  const symmetry = parseSymmetry(`${match[2]}${match[3]}`, sides);
  const orbitIds = parseOrbitIds(match[4]);
  if (!symmetry || !orbitIds) return null;

  return {
    mode: "stellation",
    sides,
    symmetry,
    orbitIds,
    planeSelected: false,
    facetStep: 1,
  };
}

export function parseShareHash(hash: string): ShareState | null {
  if (typeof hash !== "string") return null;
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!value) return null;

  return value.startsWith("v=") ? parseV2Hash(value) : parseLegacyHash(value);
}

export function formatShareHash(state: ShareState): string {
  if (!validMode(state.mode) || !validSides(state.sides)) {
    throw new RangeError("Share state has an invalid mode or polygon side count.");
  }

  const symmetry = parseSymmetry(
    `${state.symmetry?.family ?? ""}${state.symmetry?.order ?? ""}`,
    state.sides,
  );
  const orbitIds = Array.isArray(state.orbitIds)
    ? normalizeOrbitIds(state.orbitIds)
    : null;
  if (!symmetry || !orbitIds) {
    throw new RangeError("Share state has invalid symmetry or orbit identifiers.");
  }

  const facetStep = normalizeFacetStep(state.facetStep, state.sides);
  const fields = [
    "#v=2",
    `mode=${state.mode}`,
    `n=${state.sides}`,
    `sym=${symmetry.family}${symmetry.order}`,
    `st=${orbitIds.join(",")}`,
  ];
  if (state.planeSelected) fields.push("pl=1");
  fields.push(`fa=${facetStep}`);
  return fields.join("&");
}
