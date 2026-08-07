"use client";

import {
  buildArrangement,
  buildOrbitMap,
  selectedBoundary,
  supportClosure,
  symmetryLabel,
  symmetryOptions,
  type Orbit,
  type Symmetry,
} from "./geometry";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ModifierState = {
  shift: boolean;
  remove: boolean;
};

type DragState = {
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  moved: number;
  cellId: number | null;
};

const LAYER_COLORS = [
  "#f4bd55",
  "#ef7d68",
  "#67c9c2",
  "#8da8ff",
  "#c18de3",
  "#91c56e",
  "#e6a45f",
  "#6fc4ec",
];

const EMPTY_MODIFIERS: ModifierState = { shift: false, remove: false };

function layerColor(layer: number) {
  return LAYER_COLORS[layer % LAYER_COLORS.length];
}

function setEquals(a: Set<number>, b: Set<number>) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function polygonPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${-point.y}`)
    .join(" ") + " Z";
}

function formatSelection(selected: Set<number>, orbitMap: ReturnType<typeof buildOrbitMap>) {
  const orbitIds = orbitMap.orbits
    .filter((orbit) => orbit.cellIds.every((cellId) => selected.has(cellId)))
    .map((orbit) => orbit.id);
  return `{${orbitIds.join(",")}}`;
}

function parseHash() {
  if (typeof window === "undefined") return null;
  const decoded = decodeURIComponent(window.location.hash.slice(1));
  const match = decoded.match(/^p(\d+)\/(C|D)(\d+)\/\{([\d,]*)\}$/i);
  if (!match) return null;
  const sides = Number(match[1]);
  const order = Number(match[3]);
  if (!Number.isInteger(sides) || sides < 3 || sides > 18 || sides % order !== 0) return null;
  return {
    sides,
    symmetry: { family: match[2].toUpperCase() as "C" | "D", order },
    orbitIds: match[4]
      ? match[4].split(",").map(Number).filter((value) => Number.isInteger(value))
      : [],
  };
}

function orbitName(orbit: Orbit) {
  return `L${orbit.layer} · O${orbit.id + 1}`;
}

function buildInvariantSet(
  cellIds: Iterable<number>,
  orbitMap: ReturnType<typeof buildOrbitMap>,
) {
  const result = new Set<number>();
  for (const cellId of cellIds) {
    const orbit = orbitMap.byCell.get(cellId);
    if (!orbit) continue;
    for (const member of orbit.cellIds) result.add(member);
  }
  return result;
}

export default function FacettingLab() {
  const [sides, setSides] = useState(5);
  const [symmetry, setSymmetry] = useState<Symmetry>({ family: "D", order: 5 });
  const arrangement = useMemo(() => buildArrangement(sides), [sides]);
  const orbitMap = useMemo(
    () => buildOrbitMap(arrangement, symmetry),
    [arrangement, symmetry],
  );

  const [selected, setSelected] = useState<Set<number>>(new Set([0]));
  const [past, setPast] = useState<Array<Set<number>>>([]);
  const [future, setFuture] = useState<Array<Set<number>>>([]);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [hoverSegment, setHoverSegment] = useState<number | null>(null);
  const [modifiers, setModifiers] = useState<ModifierState>(EMPTY_MODIFIERS);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("Core selected");
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [diagramView, setDiagramView] = useState({ center: 0, zoom: 1 });
  const viewDrag = useRef<DragState | null>(null);
  const diagramDrag = useRef<{ x: number; center: number; moved: number } | null>(null);
  const parsedHash = useRef<ReturnType<typeof parseHash>>(null);
  const hashReady = useRef(false);
  const previousSides = useRef(sides);

  const coreOrbit = orbitMap.byCell.get(arrangement.coreCellId);
  const maxLayer = Math.max(...arrangement.cells.map((cell) => cell.layer));
  const selectedBoundaryEdges = useMemo(
    () => selectedBoundary(arrangement, selected),
    [arrangement, selected],
  );
  const selectedArea = useMemo(
    () =>
      arrangement.cells.reduce(
        (area, cell) => area + (selected.has(cell.id) ? cell.area : 0),
        0,
      ),
    [arrangement, selected],
  );

  const highlightedCells = useMemo(() => {
    const result = new Set<number>();
    if (hoverCell !== null) {
      const orbit = orbitMap.byCell.get(hoverCell);
      for (const cellId of orbit?.cellIds ?? [hoverCell]) result.add(cellId);
    }
    if (hoverSegment !== null) {
      const segment = arrangement.diagram[hoverSegment];
      for (const cellId of [segment?.aboveCellId, segment?.belowCellId]) {
        if (cellId === null || cellId === undefined) continue;
        const orbit = orbitMap.byCell.get(cellId);
        for (const member of orbit?.cellIds ?? [cellId]) result.add(member);
      }
    }
    return result;
  }, [arrangement, hoverCell, hoverSegment, orbitMap]);

  const commit = useCallback(
    (nextOrUpdater: Set<number> | ((current: Set<number>) => Set<number>), message: string) => {
      setSelected((current) => {
        const next =
          typeof nextOrUpdater === "function" ? nextOrUpdater(current) : nextOrUpdater;
        next.add(arrangement.coreCellId);
        if (setEquals(current, next)) return current;
        setPast((items) => [...items.slice(-99), new Set(current)]);
        setFuture([]);
        setStatus(message);
        return next;
      });
    },
    [arrangement.coreCellId],
  );

  const orbitAction = useCallback(
    (orbit: Orbit, action: "add" | "remove" | "toggle", withSupport = false) => {
      let targets = new Set(orbit.cellIds);
      if (withSupport) {
        targets = buildInvariantSet(supportClosure(arrangement, targets), orbitMap);
      }
      const label = `${orbitName(orbit)}${withSupport ? " + lower cells" : ""}`;
      commit((current) => {
        const next = new Set(current);
        const shouldAdd = action === "add" || (action === "toggle" && [...targets].some((id) => !next.has(id)));
        for (const cellId of targets) {
          if (shouldAdd) next.add(cellId);
          else if (cellId !== arrangement.coreCellId) next.delete(cellId);
        }
        return next;
      }, `${shouldAddText(action, selected, targets)} ${label}`);
    },
    [arrangement, commit, orbitMap, selected],
  );

  const actOnCellTable = useCallback(
    (orbit: Orbit, event: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }) => {
      const remove = Boolean(event.ctrlKey || event.metaKey || event.altKey);
      if (event.shiftKey) orbitAction(orbit, "add", true);
      else if (remove) orbitAction(orbit, "remove", true);
      else orbitAction(orbit, "toggle", false);
    },
    [orbitAction],
  );

  useEffect(() => {
    const update = (event: KeyboardEvent) => {
      setModifiers({
        shift: event.shiftKey,
        remove: event.ctrlKey || event.metaKey || event.altKey,
      });
    };
    const clear = () => setModifiers(EMPTY_MODIFIERS);
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("blur", clear);
    };
  }, []);

  useEffect(() => {
    parsedHash.current = parseHash();
    if (parsedHash.current) {
      setSides(parsedHash.current.sides);
      setSymmetry(parsedHash.current.symmetry);
    } else {
      hashReady.current = true;
    }
  }, []);

  useEffect(() => {
    if (previousSides.current !== sides) {
      previousSides.current = sides;
      setSelected(new Set([arrangement.coreCellId]));
      setPast([]);
      setFuture([]);
      setView({ x: 0, y: 0, zoom: 1 });
      setDiagramView({ center: 0, zoom: 1 });
      setStatus(`${sides}-gon arrangement ready`);
    }
  }, [arrangement.coreCellId, sides]);

  useEffect(() => {
    if (!parsedHash.current || hashReady.current) return;
    if (
      parsedHash.current.sides !== sides ||
      parsedHash.current.symmetry.family !== symmetry.family ||
      parsedHash.current.symmetry.order !== symmetry.order
    ) return;
    const restored = new Set<number>([arrangement.coreCellId]);
    for (const orbitId of parsedHash.current.orbitIds) {
      for (const cellId of orbitMap.orbits[orbitId]?.cellIds ?? []) restored.add(cellId);
    }
    setSelected(restored);
    setStatus("Shared selection restored");
    hashReady.current = true;
  }, [arrangement.coreCellId, orbitMap, sides, symmetry]);

  useEffect(() => {
    if (!hashReady.current) return;
    const hash = `p${sides}/${symmetry.family}${symmetry.order}/${formatSelection(selected, orbitMap)}`;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
  }, [orbitMap, selected, sides, symmetry]);

  const changeSides = (nextSides: number) => {
    setSides(nextSides);
    setSymmetry({ family: "D", order: nextSides });
  };

  const changeSymmetry = (value: string) => {
    const match = value.match(/^(C|D)(\d+)$/);
    if (!match) return;
    const next = { family: match[1] as "C" | "D", order: Number(match[2]) };
    const nextOrbitMap = buildOrbitMap(arrangement, next);
    setSelected((current) => {
      const invariant = buildInvariantSet(current, nextOrbitMap);
      invariant.add(arrangement.coreCellId);
      return invariant;
    });
    setSymmetry(next);
    setStatus(`Cells regrouped under ${next.family}${next.order}`);
  };

  const spatialPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button === 2) return;
    const target = (event.target as Element).closest<SVGElement>("[data-cell-id]");
    viewDrag.current = {
      x: event.clientX,
      y: event.clientY,
      centerX: view.x,
      centerY: view.y,
      moved: 0,
      cellId: target ? Number(target.dataset.cellId) : null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const spatialPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = viewDrag.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (drag.moved < 3) return;
    const span = (arrangement.extent * 2.34) / view.zoom;
    const bounds = event.currentTarget.getBoundingClientRect();
    setView((current) => ({
      ...current,
      x: drag.centerX - (dx / bounds.width) * span,
      y: drag.centerY - (dy / bounds.height) * span,
    }));
  };

  const spatialPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = viewDrag.current;
    viewDrag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
    if (!drag || drag.moved >= 4 || drag.cellId === null) return;
    const orbit = orbitMap.byCell.get(drag.cellId);
    if (!orbit) return;
    if (event.shiftKey) orbitAction(orbit, "add", false);
    else if (event.ctrlKey || event.metaKey || event.altKey) orbitAction(orbit, "remove", false);
  };

  const spatialWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0014);
    setView((current) => ({ ...current, zoom: Math.min(8, Math.max(0.55, current.zoom * factor)) }));
  };

  const diagramPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    diagramDrag.current = { x: event.clientX, center: diagramView.center, moved: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const diagramPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = diagramDrag.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    if (drag.moved < 3) return;
    const baseSpan = arrangement.diagramExtent[1] - arrangement.diagramExtent[0];
    const bounds = event.currentTarget.getBoundingClientRect();
    setDiagramView((current) => ({
      ...current,
      center: drag.center - (dx / bounds.width) * (baseSpan / current.zoom),
    }));
  };

  const diagramPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    diagramDrag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
  };

  const diagramWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0014);
    setDiagramView((current) => ({
      ...current,
      zoom: Math.min(7, Math.max(1, current.zoom * factor)),
    }));
  };

  const actOnDiagram = (
    segmentId: number,
    event: React.MouseEvent<SVGRectElement> | React.KeyboardEvent<SVGRectElement>,
  ) => {
    const segment = arrangement.diagram[segmentId];
    const wantsBelow = event.ctrlKey || event.metaKey || event.altKey;
    const cellId = event.shiftKey
      ? segment.aboveCellId
      : wantsBelow
        ? segment.belowCellId
        : null;
    if (cellId === null) {
      if (event.shiftKey || wantsBelow) setStatus(`No bounded cell ${event.shiftKey ? "above" : "below"} this interval`);
      return;
    }
    const orbit = orbitMap.byCell.get(cellId);
    if (orbit) orbitAction(orbit, "toggle", false);
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [new Set(selected), ...items].slice(0, 100));
    setSelected(new Set(previous));
    setStatus("Undid last cell change");
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items.slice(-99), new Set(selected)]);
    setSelected(new Set(next));
    setStatus("Redid cell change");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setStatus("Copy was blocked; use the address bar to share this state");
    }
  };

  const viewSpan = (arrangement.extent * 2.34) / view.zoom;
  const viewBox = `${view.x - viewSpan / 2} ${view.y - viewSpan / 2} ${viewSpan} ${viewSpan}`;
  const lineRadius = arrangement.extent * 1.7;
  const baseDiagramSpan = Math.max(1e-6, arrangement.diagramExtent[1] - arrangement.diagramExtent[0]);
  const diagramSpan = (baseDiagramSpan * 1.14) / diagramView.zoom;
  const diagramCenter = diagramView.center || (arrangement.diagramExtent[0] + arrangement.diagramExtent[1]) / 2;
  const diagramViewBox = `${diagramCenter - diagramSpan / 2} 0 ${diagramSpan} 100`;
  const diagramStroke = diagramSpan / 480;

  return (
    <div className="facetting-app">
      <header className="app-header">
        <div className="brand" aria-label="Facetting 2D">
          <span className="brand-mark">◇</span>
          <span>Facetting</span>
          <b>2D</b>
        </div>
        <div className="header-stats" aria-label="Current arrangement statistics">
          <span><b>{sides}</b> lines</span>
          <span><b>{arrangement.cells.length}</b> bounded cells</span>
          <span><b>{maxLayer + 1}</b> layers</span>
          <span><b>{selectedArea.toFixed(2)}</b> area</span>
        </div>
        <div className="header-spacer" />
        <button className="ghost-button" onClick={copyLink} type="button">
          {copied ? "Link copied" : "Share state"}
        </button>
        <a
          className="ghost-button about-link"
          href="https://yaroslavvb.github.io/stellation/"
          target="_blank"
          rel="noreferrer"
        >
          3D original ↗
        </a>
      </header>

      <main className="app-main">
        <section className="stage" aria-label="Facetting views">
          <div className="view-panel spatial-panel">
            <div className="view-heading">
              <div>
                <span className="eyebrow">2D view</span>
                <h1>Extended sides, bounded cells</h1>
              </div>
              <div className="view-actions">
                <button type="button" onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>fit</button>
                <span>{Math.round(view.zoom * 100)}%</span>
              </div>
            </div>

            <svg
              className="spatial-canvas"
              viewBox={viewBox}
              role="img"
              aria-label={`${sides}-gon side-line arrangement with ${arrangement.cells.length} bounded cells`}
              onPointerDown={spatialPointerDown}
              onPointerMove={spatialPointerMove}
              onPointerUp={spatialPointerUp}
              onPointerCancel={() => { viewDrag.current = null; }}
              onContextMenu={(event) => event.preventDefault()}
              onWheel={spatialWheel}
              onDoubleClick={() => setView({ x: 0, y: 0, zoom: 1 })}
              onPointerLeave={() => { if (!viewDrag.current) setHoverCell(null); }}
            >
              <defs>
                <pattern id="micro-grid" width="0.2" height="0.2" patternUnits="userSpaceOnUse">
                  <path d="M 0.2 0 L 0 0 0 0.2" fill="none" stroke="rgba(255,255,255,.028)" strokeWidth="0.006" />
                </pattern>
                <filter id="selected-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="0.022" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <rect
                x={view.x - viewSpan / 2}
                y={view.y - viewSpan / 2}
                width={viewSpan}
                height={viewSpan}
                fill="url(#micro-grid)"
              />

              <g className="arrangement-lines" aria-hidden="true">
                {arrangement.lines.map((line) => {
                  const anchor = { x: line.normal.x, y: line.normal.y };
                  const a = {
                    x: anchor.x - line.direction.x * lineRadius,
                    y: -(anchor.y - line.direction.y * lineRadius),
                  };
                  const b = {
                    x: anchor.x + line.direction.x * lineRadius,
                    y: -(anchor.y + line.direction.y * lineRadius),
                  };
                  return <line key={line.index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
                })}
              </g>

              <g className="cell-polygons">
                {arrangement.cells.map((cell) => {
                  const isSelected = selected.has(cell.id);
                  const isHighlighted = highlightedCells.has(cell.id);
                  const orbit = orbitMap.byCell.get(cell.id);
                  const previewAdd = isHighlighted && modifiers.shift;
                  const previewRemove = isHighlighted && modifiers.remove;
                  return (
                    <path
                      key={cell.id}
                      data-cell-id={cell.id}
                      d={polygonPath(cell.vertices)}
                      className={[
                        "arrangement-cell",
                        isSelected ? "is-selected" : "",
                        isHighlighted ? "is-highlighted" : "",
                        previewAdd ? "preview-add" : "",
                        previewRemove ? "preview-remove" : "",
                      ].filter(Boolean).join(" ")}
                      fill={layerColor(cell.layer)}
                      style={{ "--cell-color": layerColor(cell.layer) } as React.CSSProperties}
                      onPointerEnter={() => setHoverCell(cell.id)}
                      onPointerLeave={() => { if (!viewDrag.current) setHoverCell(null); }}
                      aria-label={`${orbit ? orbitName(orbit) : `cell ${cell.id + 1}`}, layer ${cell.layer}${isSelected ? ", selected" : ""}`}
                    />
                  );
                })}
              </g>

              <g className="selected-boundary" aria-hidden="true" filter="url(#selected-glow)">
                {selectedBoundaryEdges.map((edge, index) => (
                  <line key={index} x1={edge.a.x} y1={-edge.a.y} x2={edge.b.x} y2={-edge.b.y} />
                ))}
              </g>

              <g className="cell-labels" aria-hidden="true">
                {arrangement.cells.map((cell) => {
                  const orbit = orbitMap.byCell.get(cell.id);
                  const show = highlightedCells.has(cell.id) || cell.id === arrangement.coreCellId;
                  if (!show || !orbit) return null;
                  return (
                    <text key={cell.id} x={cell.centroid.x} y={-cell.centroid.y}>
                      {cell.id === arrangement.coreCellId ? "core" : `O${orbit.id + 1}`}
                    </text>
                  );
                })}
              </g>
            </svg>

            <div className="gesture-strip">
              <span>drag to pan · wheel to zoom · double-click to fit</span>
              <span><kbd>shift</kbd> add orbit · <kbd>ctrl / ⌥</kbd> remove orbit</span>
            </div>
          </div>

          <div className="view-panel diagram-panel">
            <div className="view-heading compact">
              <div>
                <span className="eyebrow">1D view · side 1</span>
                <h2>Cells immediately above and below the line</h2>
              </div>
              <div className="diagram-legend" aria-label="Diagram side legend">
                <span><i className="upper-key" /> above</span>
                <span><i className="lower-key" /> below</span>
              </div>
            </div>

            <svg
              className="diagram-canvas"
              viewBox={diagramViewBox}
              preserveAspectRatio="none"
              role="img"
              aria-label="One-dimensional arrangement along the bottom side of the polygon"
              onPointerDown={diagramPointerDown}
              onPointerMove={diagramPointerMove}
              onPointerUp={diagramPointerUp}
              onPointerCancel={() => { diagramDrag.current = null; }}
              onWheel={diagramWheel}
              onDoubleClick={() => setDiagramView({ center: 0, zoom: 1 })}
              onPointerLeave={() => setHoverSegment(null)}
            >
              <line
                className="diagram-rail"
                x1={arrangement.diagramExtent[0]}
                x2={arrangement.diagramExtent[1]}
                y1="50"
                y2="50"
                strokeWidth={diagramStroke * 2.2}
              />
              {arrangement.diagram.map((segment) => {
                const upperCell = segment.aboveCellId === null ? null : arrangement.cells[segment.aboveCellId];
                const lowerCell = segment.belowCellId === null ? null : arrangement.cells[segment.belowCellId];
                const upperOrbit = upperCell ? orbitMap.byCell.get(upperCell.id) : null;
                const lowerOrbit = lowerCell ? orbitMap.byCell.get(lowerCell.id) : null;
                const upperSelected = upperCell ? selected.has(upperCell.id) : false;
                const lowerSelected = lowerCell ? selected.has(lowerCell.id) : false;
                const hovering =
                  hoverSegment === segment.id ||
                  [segment.aboveCellId, segment.belowCellId].some(
                    (cellId) => cellId !== null && highlightedCells.has(cellId),
                  );
                const upperPreview = hovering && modifiers.shift;
                const lowerPreview = hovering && modifiers.remove;
                const width = segment.t1 - segment.t0;
                return (
                  <g key={segment.id} className={hovering ? "diagram-segment is-hovered" : "diagram-segment"}>
                    <rect
                      className={`diagram-band upper ${upperSelected ? "is-selected" : ""} ${upperPreview ? "is-preview" : ""} ${upperCell ? "" : "is-empty"}`}
                      x={segment.t0}
                      y="9"
                      width={width}
                      height="36"
                      fill={upperCell ? layerColor(upperCell.layer) : "transparent"}
                    />
                    <rect
                      className={`diagram-band lower ${lowerSelected ? "is-selected" : ""} ${lowerPreview ? "is-preview" : ""} ${lowerCell ? "" : "is-empty"}`}
                      x={segment.t0}
                      y="55"
                      width={width}
                      height="36"
                      fill={lowerCell ? layerColor(lowerCell.layer) : "transparent"}
                    />
                    {upperOrbit && width > diagramSpan * 0.07 ? (
                      <text className="diagram-label" x={(segment.t0 + segment.t1) / 2} y="31">
                        O{upperOrbit.id + 1}
                      </text>
                    ) : null}
                    {lowerOrbit && width > diagramSpan * 0.07 ? (
                      <text className="diagram-label" x={(segment.t0 + segment.t1) / 2} y="78">
                        O{lowerOrbit.id + 1}
                      </text>
                    ) : null}
                    <line className="diagram-tick" x1={segment.t0} x2={segment.t0} y1="43" y2="57" strokeWidth={diagramStroke} />
                    {segment.id === arrangement.diagram.length - 1 ? (
                      <line className="diagram-tick" x1={segment.t1} x2={segment.t1} y1="43" y2="57" strokeWidth={diagramStroke} />
                    ) : null}
                    <rect
                      className="diagram-hit"
                      x={segment.t0}
                      y="4"
                      width={width}
                      height="92"
                      data-segment-id={segment.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Interval ${segment.id + 1}. Shift toggles ${upperOrbit ? orbitName(upperOrbit) : "no cell"} above. Control or Option toggles ${lowerOrbit ? orbitName(lowerOrbit) : "no cell"} below.`}
                      onPointerEnter={() => setHoverSegment(segment.id)}
                      onClick={(event) => actOnDiagram(segment.id, event)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (event.ctrlKey) actOnDiagram(segment.id, event);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          actOnDiagram(segment.id, event);
                        }
                      }}
                    />
                  </g>
                );
              })}
            </svg>
            <div className="gesture-strip diagram-help">
              <span>interval lengths are geometric, not evenly spaced</span>
              <span><kbd>shift</kbd> toggle above · <kbd>ctrl / ⌥</kbd> toggle below</span>
            </div>
          </div>

          <div className="status-bar" aria-live="polite">
            <span className="status-dot" />
            <span>{status}</span>
            <span className="status-selection">{formatSelection(selected, orbitMap)}</span>
          </div>
        </section>

        <aside className="control-panel" aria-label="Facetting controls">
          <section className="control-section setup-section">
            <div className="section-title">
              <span className="eyebrow">Construction</span>
              <span className="section-index">01</span>
            </div>
            <label className="field-row" htmlFor="polygon-sides">
              <span>Polygon</span>
              <select
                id="polygon-sides"
                value={sides}
                onChange={(event) => changeSides(Number(event.target.value))}
              >
                {Array.from({ length: 10 }, (_, index) => index + 3).map((count) => (
                  <option key={count} value={count}>{count}-gon</option>
                ))}
              </select>
            </label>
            <label className="field-row" htmlFor="symmetry-group">
              <span>Symmetry</span>
              <select
                id="symmetry-group"
                value={`${symmetry.family}${symmetry.order}`}
                onChange={(event) => changeSymmetry(event.target.value)}
              >
                {symmetryOptions(sides).map((option) => (
                  <option key={`${option.family}${option.order}`} value={`${option.family}${option.order}`}>
                    {symmetryLabel(option, sides)}
                  </option>
                ))}
              </select>
            </label>
            <p className="section-note">
              Every side is extended to a line. Only bounded regions remain; symmetry groups them into selectable orbits.
            </p>
          </section>

          <section className="control-section cells-section">
            <div className="section-title">
              <span className="eyebrow">Cells</span>
              <span className="section-index">02</span>
            </div>
            <div className="cell-toolbar">
              <button type="button" onClick={() => commit(new Set(coreOrbit?.cellIds ?? [arrangement.coreCellId]), "Core selected")}>core</button>
              <button
                type="button"
                onClick={() => {
                  const currentMax = Math.max(0, ...arrangement.cells.filter((cell) => selected.has(cell.id)).map((cell) => cell.layer));
                  const targetLayer = Math.min(maxLayer, currentMax + 1);
                  commit(new Set(arrangement.cells.filter((cell) => cell.layer <= targetLayer).map((cell) => cell.id)), `Layers 0–${targetLayer} selected`);
                }}
              >
                + layer
              </button>
              <button type="button" onClick={() => commit(new Set(arrangement.cells.map((cell) => cell.id)), "All bounded cells selected")}>all</button>
              <button type="button" onClick={undo} disabled={!past.length} aria-label="Undo">↶</button>
              <button type="button" onClick={redo} disabled={!future.length} aria-label="Redo">↷</button>
            </div>

            <div className="orbit-table" tabIndex={0} aria-label="Cell orbits by layer">
              {[...Array(maxLayer + 1)].map((_, reverseIndex) => {
                const layer = maxLayer - reverseIndex;
                const orbits = orbitMap.orbits.filter((orbit) => orbit.layer === layer);
                return (
                  <div className="orbit-row" key={layer}>
                    <div className="layer-label">
                      <b>L{layer}</b>
                      <span>{layer === 0 ? "core" : `shell ${layer}`}</span>
                    </div>
                    <div className="orbit-items">
                      {orbits.map((orbit) => {
                        const active = orbit.cellIds.every((cellId) => selected.has(cellId));
                        const highlighted = orbit.cellIds.some((cellId) => highlightedCells.has(cellId));
                        return (
                          <button
                            type="button"
                            key={orbit.id}
                            className={`orbit-button ${active ? "is-active" : ""} ${highlighted ? "is-highlighted" : ""}`}
                            style={{ "--orbit-color": layerColor(layer) } as React.CSSProperties}
                            onClick={(event) => actOnCellTable(orbit, event)}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              if (event.ctrlKey) actOnCellTable(orbit, event);
                            }}
                            onPointerEnter={() => setHoverCell(orbit.cellIds[0])}
                            onPointerLeave={() => setHoverCell(null)}
                            title={`${orbitName(orbit)} · ${orbit.cellIds.length} congruent ${orbit.cellIds.length === 1 ? "cell" : "cells"}`}
                          >
                            <span>O{orbit.id + 1}</span>
                            <small>×{orbit.cellIds.length}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="layer-legend">
              {[...Array(maxLayer + 1)].map((_, layer) => (
                <span key={layer}><i style={{ background: layerColor(layer) }} /> L{layer}</span>
              ))}
            </div>
            <ul className="key-guide">
              <li><kbd>click</kbd><span>toggle one symmetry orbit</span></li>
              <li><kbd>shift</kbd><span>add orbit + everything below it</span></li>
              <li><kbd>ctrl / ⌥</kbd><span>remove that same lower closure</span></li>
            </ul>
          </section>

          <section className="control-section explainer-section">
            <div className="section-title">
              <span className="eyebrow">Dimensional analogy</span>
              <span className="section-index">03</span>
            </div>
            <div className="analogy-grid">
              <span>3D polyhedron faces</span><b>→</b><span>2D polygon sides</span>
              <span>3D face planes</span><b>→</b><span>2D infinite lines</span>
              <span>2D diagram</span><b>→</b><span>1D segmented line</span>
            </div>
            <p className="section-note">
              Facetting a polygon here is the planar dual view of stellating a polyhedron: the same supporting lines, followed farther.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}

function shouldAddText(action: "add" | "remove" | "toggle", selected: Set<number>, targets: Set<number>) {
  if (action === "add") return "Added";
  if (action === "remove") return "Removed";
  return [...targets].some((id) => !selected.has(id)) ? "Added" : "Removed";
}
