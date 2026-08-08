export type Point = { x: number; y: number };

export type ArrangementLine = {
  index: number;
  normal: Point;
  direction: Point;
  offset: number;
  angle: number;
};

export type ArrangementCell = {
  id: number;
  vertices: Point[];
  vertexIds: number[];
  centroid: Point;
  area: number;
  layer: number;
  lower: number[];
  upper: number[];
};

export type DiagramSegment = {
  id: number;
  t0: number;
  t1: number;
  aboveCellId: number | null;
  belowCellId: number | null;
};

export type Arrangement = {
  sides: number;
  lines: ArrangementLine[];
  cells: ArrangementCell[];
  diagram: DiagramSegment[];
  extent: number;
  diagramExtent: [number, number];
  coreCellId: number;
};

export type ClipBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type OutermostRegion = {
  id: number;
  vertices: Point[];
};

export type Symmetry = {
  family: "C" | "D";
  order: number;
};

export type Orbit = {
  id: number;
  layer: number;
  cellIds: number[];
};

export type OrbitMap = {
  orbits: Orbit[];
  byCell: Map<number, Orbit>;
};

export type FacettingOption = {
  step: number;
  componentCount: number;
  verticesPerComponent: number;
  reducedStep: number;
};

export type FacettingEdge = {
  id: number;
  componentId: number;
  vertexIds: [number, number];
  points: [Point, Point];
  length: number;
};

export type FacettingComponent = {
  id: number;
  vertexIds: number[];
  edgeIds: number[];
};

export type FacettingResult = {
  sides: number;
  step: number;
  vertices: Point[];
  edges: FacettingEdge[];
  cycles: number[][];
  components: FacettingComponent[];
  componentCount: number;
  verticesPerComponent: number;
  chordLength: number;
  extent: number;
};

export type FacettingDiagramPoint = {
  step: number;
  targetVertexId: number;
  position: number;
  point: Point;
};

export type FacettingDiagramPair = {
  step: number;
  points: [FacettingDiagramPoint, FacettingDiagramPoint];
};

export type FacettingDiagram = {
  referenceVertexId: number;
  referenceVertex: Point;
  cutOrigin: Point;
  cutNormal: Point;
  cutDirection: Point;
  pairs: FacettingDiagramPair[];
  extent: [number, number];
};

const EPS = 1e-8;
const KEY_SCALE = 1e8;

function cross(a: Point, b: Point) {
  return a.x * b.y - a.y * b.x;
}

function distance2(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function distance(a: Point, b: Point) {
  return Math.sqrt(distance2(a, b));
}

function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y;
}

function greatestCommonDivisor(a: number, b: number) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

function pointKey(point: Point) {
  return `${Math.round(point.x * KEY_SCALE)},${Math.round(point.y * KEY_SCALE)}`;
}

function edgeKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function signedArea(points: Point[]) {
  let twiceArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twiceArea += a.x * b.y - a.y * b.x;
  }
  return twiceArea / 2;
}

function polygonCentroid(points: Point[], area = signedArea(points)): Point {
  let x = 0;
  let y = 0;
  let factorSum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const factor = a.x * b.y - b.x * a.y;
    factorSum += factor;
    x += (a.x + b.x) * factor;
    y += (a.y + b.y) * factor;
  }
  if (Math.abs(area) < EPS || Math.abs(factorSum) < EPS) {
    const sum = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 },
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
  }
  return { x: x / (3 * factorSum), y: y / (3 * factorSum) };
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function intersectLines(a: ArrangementLine, b: ArrangementLine): Point | null {
  const determinant = cross(a.normal, b.normal);
  if (Math.abs(determinant) < EPS) return null;
  return {
    x: (a.offset * b.normal.y - a.normal.y * b.offset) / determinant,
    y: (a.normal.x * b.offset - a.offset * b.normal.x) / determinant,
  };
}

function angularOrder(vertices: Point[], origin: number, neighbors: number[]) {
  return [...neighbors].sort((a, b) => {
    const pa = vertices[a];
    const pb = vertices[b];
    const o = vertices[origin];
    return Math.atan2(pa.y - o.y, pa.x - o.x) - Math.atan2(pb.y - o.y, pb.x - o.x);
  });
}

function rotate(point: Point, angle: number): Point {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
}

function transform(point: Point, symmetry: Symmetry, step: number, reflected: boolean) {
  const source = reflected ? { x: -point.x, y: point.y } : point;
  return rotate(source, (Math.PI * 2 * step) / symmetry.order);
}

function divisors(value: number) {
  const result: number[] = [];
  for (let divisor = 1; divisor <= value; divisor += 1) {
    if (value % divisor === 0) result.push(divisor);
  }
  return result.sort((a, b) => b - a);
}

export function symmetryOptions(sides: number): Symmetry[] {
  return divisors(sides).flatMap((order) => [
    { family: "D" as const, order },
    { family: "C" as const, order },
  ]);
}

export function symmetryLabel(symmetry: Symmetry, sides: number) {
  const full = symmetry.order === sides;
  const description =
    symmetry.family === "D"
      ? full
        ? "full dihedral"
        : "rotations + mirrors"
      : full
        ? "rotations"
        : symmetry.order === 1
          ? "individual cells"
          : "rotation subgroup";
  return `${symmetry.family}${symmetry.order} · ${description}`;
}

export function facettingOptions(sides: number): FacettingOption[] {
  if (!Number.isInteger(sides) || sides < 3) {
    throw new Error("Polygon side count must be an integer of at least 3.");
  }

  return Array.from({ length: Math.floor((sides - 1) / 2) }, (_, index) => {
    const step = index + 1;
    const componentCount = greatestCommonDivisor(sides, step);
    return {
      step,
      componentCount,
      verticesPerComponent: sides / componentCount,
      reducedStep: step / componentCount,
    };
  });
}

function coreVertices(arrangement: Arrangement) {
  const core = arrangement.cells[arrangement.coreCellId];
  if (!core || core.vertices.length !== arrangement.sides) {
    throw new Error("The arrangement core is not the expected regular polygon.");
  }

  const vertices = core.vertices.map((point) => ({ ...point }));
  const area = signedArea(vertices);
  if (Math.abs(area) < EPS) throw new Error("The arrangement core polygon is degenerate.");
  if (area < 0) vertices.reverse();
  return vertices;
}

export function buildFacetting(arrangement: Arrangement, step: number): FacettingResult {
  const { sides } = arrangement;
  if (sides % 2 === 0 && step === sides / 2) {
    throw new Error("The diameter step does not form closed polygonal cycles.");
  }

  const option = facettingOptions(sides).find((candidate) => candidate.step === step);
  if (!option || !Number.isInteger(step)) {
    throw new Error(`Facetting step must be an integer from 1 to ${Math.floor((sides - 1) / 2)}.`);
  }

  const vertices = coreVertices(arrangement);
  const edges: FacettingEdge[] = [];
  const cycles: number[][] = [];
  const components: FacettingComponent[] = [];

  for (let componentId = 0; componentId < option.componentCount; componentId += 1) {
    const vertexIds: number[] = [];
    let vertexId = componentId;
    do {
      vertexIds.push(vertexId);
      vertexId = (vertexId + step) % sides;
    } while (vertexId !== componentId);

    const edgeIds: number[] = [];
    for (let index = 0; index < vertexIds.length; index += 1) {
      const fromVertexId = vertexIds[index];
      const toVertexId = vertexIds[(index + 1) % vertexIds.length];
      const edge: FacettingEdge = {
        id: edges.length,
        componentId,
        vertexIds: [fromVertexId, toVertexId],
        points: [vertices[fromVertexId], vertices[toVertexId]],
        length: distance(vertices[fromVertexId], vertices[toVertexId]),
      };
      edges.push(edge);
      edgeIds.push(edge.id);
    }

    cycles.push([...vertexIds]);
    components.push({ id: componentId, vertexIds, edgeIds });
  }

  const chordLength = edges[0]?.length ?? 0;
  const extent = Math.max(
    1,
    ...vertices.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)]),
  );

  return {
    sides,
    step,
    vertices,
    edges,
    cycles,
    components,
    componentCount: option.componentCount,
    verticesPerComponent: option.verticesPerComponent,
    chordLength,
    extent,
  };
}

export function buildFacettingDiagram(
  arrangement: Arrangement,
  referenceVertexId = 0,
): FacettingDiagram {
  const vertices = coreVertices(arrangement);
  const { sides } = arrangement;
  if (
    !Number.isInteger(referenceVertexId) ||
    referenceVertexId < 0 ||
    referenceVertexId >= sides
  ) {
    throw new Error(`Reference vertex must be an integer from 0 to ${sides - 1}.`);
  }

  const center = polygonCentroid(vertices);
  const referenceVertex = vertices[referenceVertexId];
  const radial = {
    x: referenceVertex.x - center.x,
    y: referenceVertex.y - center.y,
  };
  const radialLength = Math.hypot(radial.x, radial.y);
  if (radialLength < EPS) throw new Error("The reference vertex has no radial direction.");

  const cutNormal = { x: radial.x / radialLength, y: radial.y / radialLength };
  const cutDirection = { x: -cutNormal.y, y: cutNormal.x };
  const relativeToCenter = (point: Point) => ({ x: point.x - center.x, y: point.y - center.y });
  const referenceProjection = dot(relativeToCenter(referenceVertex), cutNormal);
  const nearestOtherProjection = Math.max(
    ...vertices
      .filter((_, vertexId) => vertexId !== referenceVertexId)
      .map((point) => dot(relativeToCenter(point), cutNormal)),
  );
  const cutProjection = (referenceProjection + nearestOtherProjection) / 2;
  const cutOrigin = {
    x: center.x + cutNormal.x * cutProjection,
    y: center.y + cutNormal.y * cutProjection,
  };

  const diagramPoint = (step: number, targetVertexId: number): FacettingDiagramPoint => {
    const target = vertices[targetVertexId];
    const chord = {
      x: target.x - referenceVertex.x,
      y: target.y - referenceVertex.y,
    };
    const denominator = dot(chord, cutNormal);
    if (Math.abs(denominator) < EPS) {
      throw new Error("A candidate chord is parallel to the facetting diagram cut.");
    }
    const scale = (cutProjection - referenceProjection) / denominator;
    const point = {
      x: referenceVertex.x + chord.x * scale,
      y: referenceVertex.y + chord.y * scale,
    };
    return {
      step,
      targetVertexId,
      position: dot({ x: point.x - cutOrigin.x, y: point.y - cutOrigin.y }, cutDirection),
      point,
    };
  };

  const pairs = facettingOptions(sides).map(({ step }) => {
    const previous = (referenceVertexId - step + sides) % sides;
    const next = (referenceVertexId + step) % sides;
    const points = [diagramPoint(step, previous), diagramPoint(step, next)].sort(
      (a, b) => a.position - b.position,
    ) as [FacettingDiagramPoint, FacettingDiagramPoint];
    return { step, points };
  });
  const positions = pairs.flatMap((pair) => pair.points.map((point) => point.position));

  return {
    referenceVertexId,
    referenceVertex,
    cutOrigin,
    cutNormal,
    cutDirection,
    pairs,
    extent: [Math.min(...positions), Math.max(...positions)],
  };
}

export function buildArrangement(sides: number): Arrangement {
  if (!Number.isInteger(sides) || sides < 3 || sides > 18) {
    throw new Error("Polygon side count must be an integer from 3 to 18.");
  }

  const lines: ArrangementLine[] = Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / sides;
    const normal = { x: Math.cos(angle), y: Math.sin(angle) };
    return {
      index,
      normal,
      direction: { x: -normal.y, y: normal.x },
      offset: 1,
      angle,
    };
  });

  const vertices: Point[] = [];
  const vertexByKey = new Map<string, number>();
  const verticesOnLine: Array<Array<{ id: number; t: number }>> = Array.from(
    { length: sides },
    () => [],
  );

  const internVertex = (point: Point) => {
    const key = pointKey(point);
    const existing = vertexByKey.get(key);
    if (existing !== undefined) return existing;
    const id = vertices.length;
    vertices.push(point);
    vertexByKey.set(key, id);
    return id;
  };

  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const point = intersectLines(lines[i], lines[j]);
      if (!point) continue;
      const id = internVertex(point);
      const ti = point.x * lines[i].direction.x + point.y * lines[i].direction.y;
      const tj = point.x * lines[j].direction.x + point.y * lines[j].direction.y;
      verticesOnLine[i].push({ id, t: ti });
      verticesOnLine[j].push({ id, t: tj });
    }
  }

  for (const points of verticesOnLine) {
    points.sort((a, b) => a.t - b.t);
    for (let index = points.length - 1; index > 0; index -= 1) {
      if (points[index].id === points[index - 1].id) points.splice(index, 1);
    }
  }

  const adjacency = new Map<number, Set<number>>();
  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  };

  for (const points of verticesOnLine) {
    for (let index = 0; index + 1 < points.length; index += 1) {
      addEdge(points[index].id, points[index + 1].id);
    }
  }

  const orderedNeighbors = new Map<number, number[]>();
  for (const [vertexId, neighbors] of adjacency) {
    orderedNeighbors.set(vertexId, angularOrder(vertices, vertexId, [...neighbors]));
  }

  const visited = new Set<string>();
  const rawFaces: Array<{
    vertexIds: number[];
    vertices: Point[];
    centroid: Point;
    area: number;
    layer: number;
  }> = [];

  for (const [start, neighbors] of adjacency) {
    for (const next of neighbors) {
      const directedKey = `${start}>${next}`;
      if (visited.has(directedKey)) continue;

      const cycle: number[] = [];
      let from = start;
      let to = next;
      let closed = false;

      for (let guard = 0; guard < Math.max(16, vertices.length * 6); guard += 1) {
        const key = `${from}>${to}`;
        if (visited.has(key)) break;
        visited.add(key);
        cycle.push(from);

        const around = orderedNeighbors.get(to) ?? [];
        const reverseIndex = around.indexOf(from);
        if (reverseIndex < 0 || around.length === 0) break;
        const following = around[(reverseIndex - 1 + around.length) % around.length];
        from = to;
        to = following;

        if (from === start && to === next) {
          closed = true;
          break;
        }
      }

      if (!closed || cycle.length < 3) continue;
      const polygon = cycle.map((vertexId) => vertices[vertexId]);
      const area = signedArea(polygon);
      if (area <= EPS) continue;
      const centroid = polygonCentroid(polygon, area);
      const layer = lines.reduce(
        (count, line) =>
          count +
          (centroid.x * line.normal.x + centroid.y * line.normal.y > line.offset + 1e-7
            ? 1
            : 0),
        0,
      );
      rawFaces.push({ vertexIds: cycle, vertices: polygon, centroid, area, layer });
    }
  }

  rawFaces.sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer;
    const angleA = Math.atan2(a.centroid.y, a.centroid.x);
    const angleB = Math.atan2(b.centroid.y, b.centroid.x);
    if (Math.abs(angleA - angleB) > EPS) return angleA - angleB;
    const radiusA = a.centroid.x ** 2 + a.centroid.y ** 2;
    const radiusB = b.centroid.x ** 2 + b.centroid.y ** 2;
    if (Math.abs(radiusA - radiusB) > EPS) return radiusA - radiusB;
    return a.area - b.area;
  });

  const cells: ArrangementCell[] = rawFaces.map((face, id) => ({
    id,
    vertices: face.vertices,
    vertexIds: face.vertexIds,
    centroid: face.centroid,
    area: face.area,
    layer: face.layer,
    lower: [],
    upper: [],
  }));

  const edgeCells = new Map<string, number[]>();
  for (const cell of cells) {
    for (let index = 0; index < cell.vertexIds.length; index += 1) {
      const key = edgeKey(
        cell.vertexIds[index],
        cell.vertexIds[(index + 1) % cell.vertexIds.length],
      );
      const owners = edgeCells.get(key) ?? [];
      owners.push(cell.id);
      edgeCells.set(key, owners);
    }
  }

  for (const owners of edgeCells.values()) {
    if (owners.length !== 2) continue;
    const a = cells[owners[0]];
    const b = cells[owners[1]];
    if (a.layer === b.layer) continue;
    const lower = a.layer < b.layer ? a : b;
    const upper = a.layer < b.layer ? b : a;
    lower.upper.push(upper.id);
    upper.lower.push(lower.id);
  }

  for (const cell of cells) {
    cell.lower = [...new Set(cell.lower)].sort((a, b) => a - b);
    cell.upper = [...new Set(cell.upper)].sort((a, b) => a - b);
  }

  const core = cells.find((cell) => cell.layer === 0);
  if (!core) throw new Error("The line arrangement did not produce a bounded core cell.");

  const findCell = (point: Point) =>
    cells.find((cell) => pointInPolygon(point, cell.vertices))?.id ?? null;

  const referenceLine = lines[0];
  const diagramPoints = verticesOnLine[0];
  const diagram: DiagramSegment[] = [];
  for (let index = 0; index + 1 < diagramPoints.length; index += 1) {
    const t0 = diagramPoints[index].t;
    const t1 = diagramPoints[index + 1].t;
    if (t1 - t0 < EPS) continue;
    const t = (t0 + t1) / 2;
    const midpoint = {
      x: referenceLine.normal.x * referenceLine.offset + referenceLine.direction.x * t,
      y: referenceLine.normal.y * referenceLine.offset + referenceLine.direction.y * t,
    };
    const delta = Math.min(1e-4, Math.max(1e-6, (t1 - t0) * 1e-4));
    const above = {
      x: midpoint.x - referenceLine.normal.x * delta,
      y: midpoint.y - referenceLine.normal.y * delta,
    };
    const below = {
      x: midpoint.x + referenceLine.normal.x * delta,
      y: midpoint.y + referenceLine.normal.y * delta,
    };
    diagram.push({
      id: diagram.length,
      t0,
      t1,
      aboveCellId: findCell(above),
      belowCellId: findCell(below),
    });
  }

  const extent = Math.max(
    1,
    ...cells.flatMap((cell) => cell.vertices.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)])),
  );
  const diagramExtent: [number, number] = diagram.length
    ? [diagram[0].t0, diagram[diagram.length - 1].t1]
    : [-1, 1];

  return {
    sides,
    lines,
    cells,
    diagram,
    extent,
    diagramExtent,
    coreCellId: core.id,
  };
}

function clipPolygonToLineSide(
  polygon: Point[],
  line: ArrangementLine,
  keepOutside: boolean,
) {
  if (polygon.length === 0) return polygon;
  const signedDistance = (point: Point) => dot(point, line.normal) - line.offset;
  const contains = (distanceFromLine: number) =>
    keepOutside ? distanceFromLine >= -EPS : distanceFromLine <= EPS;
  const clipped: Point[] = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const startDistance = signedDistance(start);
    const endDistance = signedDistance(end);
    const startInside = contains(startDistance);
    const endInside = contains(endDistance);

    if (startInside) clipped.push(start);
    if (startInside === endInside) continue;

    const denominator = startDistance - endDistance;
    if (Math.abs(denominator) < EPS) continue;
    const amount = startDistance / denominator;
    clipped.push({
      x: start.x + (end.x - start.x) * amount,
      y: start.y + (end.y - start.y) * amount,
    });
  }

  return clipped;
}

/**
 * Clip the symmetry-complete outermost unbounded cell family to a finite view.
 * The family has one wedge per side, each outside a cyclic run of ceil(n / 2)
 * supporting half-spaces. Keeping these synthetic cells separate preserves the
 * bounded-cell counts and area calculations used by the rest of the app.
 */
export function outermostCellRegions(
  arrangement: Arrangement,
  bounds: ClipBounds,
) {
  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxY) ||
    bounds.maxX <= bounds.minX ||
    bounds.maxY <= bounds.minY
  ) {
    throw new RangeError("Outermost-cell clip bounds must be finite and non-empty.");
  }

  const rectangle = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  const outsideRunLength = Math.ceil(arrangement.sides / 2);
  const regions: OutermostRegion[] = [];

  for (let runStart = 0; runStart < arrangement.sides; runStart += 1) {
    let region = rectangle;
    for (let lineIndex = 0; lineIndex < arrangement.lines.length; lineIndex += 1) {
      const relativeIndex =
        (lineIndex - runStart + arrangement.sides) % arrangement.sides;
      region = clipPolygonToLineSide(
        region,
        arrangement.lines[lineIndex],
        relativeIndex < outsideRunLength,
      );
      if (region.length < 3) break;
    }
    if (region.length >= 3 && Math.abs(signedArea(region)) > EPS) {
      regions.push({ id: runStart, vertices: region });
    }
  }

  return regions;
}

export function buildOutermostOrbitMap(
  arrangement: Arrangement,
  symmetry: Symmetry,
): OrbitMap {
  const outsideRunLength = Math.ceil(arrangement.sides / 2);
  const directions = Array.from({ length: arrangement.sides }, (_, runStart) => {
    const sum = { x: 0, y: 0 };
    for (let offset = 0; offset < outsideRunLength; offset += 1) {
      const normal = arrangement.lines[(runStart + offset) % arrangement.sides].normal;
      sum.x += normal.x;
      sum.y += normal.y;
    }
    const magnitude = Math.hypot(sum.x, sum.y);
    return { x: sum.x / magnitude, y: sum.y / magnitude };
  });
  const parent = directions.map((_, id) => id);
  const find = (id: number): number => {
    if (parent[id] !== id) parent[id] = find(parent[id]);
    return parent[id];
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
  };
  const closestDirection = (point: Point) => {
    let bestId = 0;
    let bestAlignment = Number.NEGATIVE_INFINITY;
    for (let id = 0; id < directions.length; id += 1) {
      const alignment = dot(point, directions[id]);
      if (alignment > bestAlignment) {
        bestId = id;
        bestAlignment = alignment;
      }
    }
    return bestId;
  };

  for (let cellId = 0; cellId < directions.length; cellId += 1) {
    for (let step = 0; step < symmetry.order; step += 1) {
      union(cellId, closestDirection(transform(directions[cellId], symmetry, step, false)));
      if (symmetry.family === "D") {
        union(cellId, closestDirection(transform(directions[cellId], symmetry, step, true)));
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let cellId = 0; cellId < directions.length; cellId += 1) {
    const root = find(cellId);
    const members = groups.get(root) ?? [];
    members.push(cellId);
    groups.set(root, members);
  }
  const orbits = [...groups.values()]
    .sort((a, b) => a[0] - b[0])
    .map((cellIds, id) => ({ id, layer: outsideRunLength, cellIds }));
  const byCell = new Map<number, Orbit>();
  for (const orbit of orbits) {
    for (const cellId of orbit.cellIds) byCell.set(cellId, orbit);
  }
  return { orbits, byCell };
}

export function buildOrbitMap(arrangement: Arrangement, symmetry: Symmetry): OrbitMap {
  const parent = arrangement.cells.map((cell) => cell.id);
  const find = (id: number): number => {
    if (parent[id] !== id) parent[id] = find(parent[id]);
    return parent[id];
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
  };

  const closestCell = (point: Point) => {
    let best = arrangement.cells[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const cell of arrangement.cells) {
      const candidate = distance2(point, cell.centroid);
      if (candidate < bestDistance) {
        best = cell;
        bestDistance = candidate;
      }
    }
    return bestDistance < 1e-8 * Math.max(1, arrangement.extent ** 2) ? best.id : null;
  };

  for (const cell of arrangement.cells) {
    for (let step = 0; step < symmetry.order; step += 1) {
      const rotated = closestCell(transform(cell.centroid, symmetry, step, false));
      if (rotated !== null) union(cell.id, rotated);
      if (symmetry.family === "D") {
        const mirrored = closestCell(transform(cell.centroid, symmetry, step, true));
        if (mirrored !== null) union(cell.id, mirrored);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (const cell of arrangement.cells) {
    const root = find(cell.id);
    const members = groups.get(root) ?? [];
    members.push(cell.id);
    groups.set(root, members);
  }

  const orbits = [...groups.values()]
    .map((cellIds) => ({
      id: -1,
      layer: Math.min(...cellIds.map((cellId) => arrangement.cells[cellId].layer)),
      cellIds: cellIds.sort((a, b) => a - b),
    }))
    .sort((a, b) => a.layer - b.layer || a.cellIds[0] - b.cellIds[0])
    .map((orbit, id) => ({ ...orbit, id }));

  const byCell = new Map<number, Orbit>();
  for (const orbit of orbits) {
    for (const cellId of orbit.cellIds) byCell.set(cellId, orbit);
  }
  return { orbits, byCell };
}

export function supportClosure(arrangement: Arrangement, seeds: Iterable<number>) {
  const closure = new Set<number>();
  const stack = [...seeds];
  while (stack.length) {
    const id = stack.pop();
    if (id === undefined || closure.has(id)) continue;
    closure.add(id);
    for (const lower of arrangement.cells[id].lower) stack.push(lower);
  }
  return closure;
}

export function selectedBoundary(arrangement: Arrangement, selected: Set<number>) {
  const edges = new Map<string, { a: Point; b: Point; count: number }>();
  for (const cellId of selected) {
    const cell = arrangement.cells[cellId];
    if (!cell) continue;
    for (let index = 0; index < cell.vertices.length; index += 1) {
      const a = cell.vertices[index];
      const b = cell.vertices[(index + 1) % cell.vertices.length];
      const key = edgeKey(cell.vertexIds[index], cell.vertexIds[(index + 1) % cell.vertexIds.length]);
      const edge = edges.get(key);
      if (edge) edge.count += 1;
      else edges.set(key, { a, b, count: 1 });
    }
  }
  return [...edges.values()].filter((edge) => edge.count === 1);
}
