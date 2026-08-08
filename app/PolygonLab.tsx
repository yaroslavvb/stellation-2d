"use client";

import {
  buildArrangement,
  buildFacetting,
  buildFacettingDiagram,
  buildOrbitMap,
  facettingOptions,
  selectedBoundary,
  supportClosure,
  symmetryLabel,
  symmetryOptions,
  type Orbit,
  type FacettingOption,
  type Symmetry,
} from "./geometry";
import {
  formatShareHash,
  parseShareHash,
  type LabMode,
} from "./share-state";
import {
  diagramSpanAtZoom,
  diagramSpanForMatchingSpatialScale,
  diagramViewportPosition,
  diagramCellForSide,
  isDiagramDrag,
  type DiagramSide,
} from "./diagram-interaction";
import { applySelectionAction, toggleActionForTargets } from "./selection";
import { buildOrbitCardinalityPalette } from "./orbit-palette";
import {
  DEFAULT_THEME_PREFERENCE,
  nextThemePreference,
  normalizeThemePreference,
  resolveTheme,
  storedThemePreference,
  themePreferenceFromStorageChange,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  THEME_COLORS,
  type ThemePreference,
} from "./theme";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type ModifierState = {
  shift: boolean;
  remove: boolean;
};

type SelectionModifierEvent = {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
};

type DragState = {
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  moved: number;
  cellId: number | null;
};

type ViewState = { x: number; y: number; zoom: number };

type ViewDimensions = {
  spatialWidth: number;
  spatialHeight: number;
  diagramWidth: number;
};

function freshViews(): Record<LabMode, ViewState> {
  return {
    stellation: { x: 0, y: 0, zoom: 1 },
    facetting: { x: 0, y: 0, zoom: 1 },
  };
}

const LAYER_COLORS = [
  "var(--layer-0)",
  "var(--layer-1)",
  "var(--layer-2)",
  "var(--layer-3)",
  "var(--layer-4)",
  "var(--layer-5)",
  "var(--layer-6)",
  "var(--layer-7)",
  "var(--layer-8)",
  "var(--layer-9)",
  "var(--layer-10)",
  "var(--layer-11)",
];

const EMPTY_MODIFIERS: ModifierState = { shift: false, remove: false };
const THEME_GLYPHS: Record<ThemePreference, string> = {
  system: "◐",
  light: "○",
  dark: "●",
};
const THEME_LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};
const THEME_CHANGE_EVENT = "stellation-theme-change";

function applyThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") return;
  const systemDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia(THEME_MEDIA_QUERY).matches;
  const resolved = resolveTheme(preference, systemDark);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePref = storedThemePreference(preference);
  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolved]);
}

function getThemePreferenceSnapshot() {
  if (typeof document === "undefined") return DEFAULT_THEME_PREFERENCE;
  const attribute = document.documentElement.dataset.themePref;
  if (attribute) return normalizeThemePreference(attribute);
  try {
    return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

function getThemePreferenceServerSnapshot() {
  return DEFAULT_THEME_PREFERENCE;
}

function subscribeThemePreference(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  applyThemePreference(getThemePreferenceSnapshot());
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia(THEME_MEDIA_QUERY)
      : null;
  const handleSystemChange = () => {
    if (getThemePreferenceSnapshot() !== "system") return;
    applyThemePreference("system");
    onStoreChange();
  };
  const handleStorage = (event: StorageEvent) => {
    const next = themePreferenceFromStorageChange(event.key, event.newValue);
    if (!next) return;
    applyThemePreference(next);
    onStoreChange();
  };
  media?.addEventListener("change", handleSystemChange);
  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => {
    media?.removeEventListener("change", handleSystemChange);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function selectThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, storedThemePreference(preference));
  } catch {
    // The active theme still changes for this page when persistence is blocked.
  }
  applyThemePreference(preference);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function layerColor(layer: number) {
  return LAYER_COLORS[layer % LAYER_COLORS.length];
}

function facetSymbol(sides: number, step: number) {
  return `{${sides}/${step}}`;
}

function facetDescription(option: FacettingOption) {
  if (option.step === 1) return "base polygon";
  if (option.componentCount === 1) return "one star circuit";
  return `${option.componentCount}-circuit compound`;
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

function selectedOrbitIds(selected: Set<number>, orbitMap: ReturnType<typeof buildOrbitMap>) {
  return orbitMap.orbits
    .filter((orbit) => orbit.cellIds.every((cellId) => selected.has(cellId)))
    .map((orbit) => orbit.id);
}

function formatSelection(selected: Set<number>, orbitMap: ReturnType<typeof buildOrbitMap>) {
  const orbitIds = selectedOrbitIds(selected, orbitMap);
  return `{${orbitIds.join(",")}}`;
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

export default function PolygonLab() {
  const [mode, setMode] = useState<LabMode>("stellation");
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
  const [facetStep, setFacetStep] = useState(1);
  const [facetPast, setFacetPast] = useState<number[]>([]);
  const [facetFuture, setFacetFuture] = useState<number[]>([]);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [hoverLayer, setHoverLayer] = useState<number | null>(null);
  const [hoverSegment, setHoverSegment] = useState<number | null>(null);
  const [hoverDiagramSide, setHoverDiagramSide] = useState<DiagramSide | null>(null);
  const [hoverFacetStep, setHoverFacetStep] = useState<number | null>(null);
  const [modifiers, setModifiers] = useState<ModifierState>(EMPTY_MODIFIERS);
  const [copied, setCopied] = useState(false);
  const themePreference = useSyncExternalStore(
    subscribeThemePreference,
    getThemePreferenceSnapshot,
    getThemePreferenceServerSnapshot,
  );
  const [status, setStatus] = useState("Core selected");
  const [views, setViews] = useState<Record<LabMode, ViewState>>(freshViews);
  const view = views[mode];
  const setView = useCallback(
    (nextOrUpdater: ViewState | ((current: ViewState) => ViewState)) => {
      setViews((current) => ({
        ...current,
        [mode]:
          typeof nextOrUpdater === "function"
            ? nextOrUpdater(current[mode])
            : nextOrUpdater,
      }));
    },
    [mode],
  );
  const [diagramView, setDiagramView] = useState({ center: 0, zoom: 1 });
  const resetSpatialAndDiagramView = useCallback(() => {
    setView({ x: 0, y: 0, zoom: 1 });
    if (mode === "stellation") setDiagramView({ center: 0, zoom: 1 });
  }, [mode, setView]);
  const [viewDimensions, setViewDimensions] = useState<ViewDimensions | null>(null);
  const spatialPanelRef = useRef<HTMLDivElement>(null);
  const diagramPanelRef = useRef<HTMLDivElement>(null);
  const viewDrag = useRef<DragState | null>(null);
  const diagramDrag = useRef<{
    x: number;
    y: number;
    center: number;
    span: number;
    pointerId: number;
    dragged: boolean;
    segmentId: number | null;
    side: DiagramSide | null;
  } | null>(null);
  const parsedHash = useRef<ReturnType<typeof parseShareHash>>(null);
  const hashReady = useRef(false);
  const skipHashWrite = useRef(false);
  const previousSides = useRef(sides);

  const facetOptions = useMemo(() => facettingOptions(sides), [sides]);
  const activeFacetStep = facetOptions.some((option) => option.step === facetStep)
    ? facetStep
    : 1;
  const facetting = useMemo(
    () => buildFacetting(arrangement, activeFacetStep),
    [activeFacetStep, arrangement],
  );
  const facetDiagram = useMemo(
    () => buildFacettingDiagram(arrangement),
    [arrangement],
  );
  const previewFacetting = useMemo(
    () =>
      hoverFacetStep !== null && hoverFacetStep !== activeFacetStep
        ? buildFacetting(arrangement, hoverFacetStep)
        : null,
    [activeFacetStep, arrangement, hoverFacetStep],
  );

  const coreOrbit = orbitMap.byCell.get(arrangement.coreCellId);
  const orbitCardinalityPalette = useMemo(
    () => buildOrbitCardinalityPalette(orbitMap.orbits.map((orbit) => orbit.cellIds.length)),
    [orbitMap.orbits],
  );
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
    if (hoverLayer !== null) {
      for (const cell of arrangement.cells) {
        if (cell.layer === hoverLayer) result.add(cell.id);
      }
    }
    if (hoverCell !== null) {
      const orbit = orbitMap.byCell.get(hoverCell);
      for (const cellId of orbit?.cellIds ?? [hoverCell]) result.add(cellId);
    }
    if (hoverSegment !== null && hoverDiagramSide !== null) {
      const segment = arrangement.diagram[hoverSegment];
      if (segment) {
        const cellId = diagramCellForSide(segment, hoverDiagramSide);
        if (cellId !== null) {
          const orbit = orbitMap.byCell.get(cellId);
          for (const member of orbit?.cellIds ?? [cellId]) result.add(member);
        }
      }
    }
    return result;
  }, [arrangement, hoverCell, hoverDiagramSide, hoverLayer, hoverSegment, orbitMap]);

  const commit = useCallback(
    (nextOrUpdater: Set<number> | ((current: Set<number>) => Set<number>), message: string) => {
      setSelected((current) => {
        const next =
          typeof nextOrUpdater === "function" ? nextOrUpdater(current) : nextOrUpdater;
        if (setEquals(current, next)) return current;
        setPast((items) => [...items.slice(-99), new Set(current)]);
        setFuture([]);
        setStatus(message);
        return next;
      });
    },
    [],
  );

  const orbitAction = useCallback(
    (orbit: Orbit, action: "add" | "remove" | "toggle") => {
      const targets = new Set(orbit.cellIds);
      commit((current) => {
        return applySelectionAction(current, targets, action);
      }, `${shouldAddText(action, selected, targets)} ${orbitName(orbit)}`);
    },
    [commit, selected],
  );

  const actOnCellsTableTarget = useCallback(
    (targetCellIds: Iterable<number>, label: string, event: SelectionModifierEvent) => {
      const targets = new Set(targetCellIds);
      const withSupport = Boolean(
        event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
      );
      const affected = withSupport
        ? buildInvariantSet(supportClosure(arrangement, targets), orbitMap)
        : targets;
      commit((current) => {
        const action = toggleActionForTargets(current, targets);
        return applySelectionAction(current, affected, action);
      }, `${label}${withSupport ? " + lower support" : ""} toggled`);
    },
    [arrangement, commit, orbitMap],
  );

  const actOnCellTable = useCallback(
    (orbit: Orbit, event: SelectionModifierEvent) => {
      actOnCellsTableTarget(orbit.cellIds, orbitName(orbit), event);
    },
    [actOnCellsTableTarget],
  );

  const actOnLayer = useCallback(
    (layer: number, event: SelectionModifierEvent) => {
      const layerCellIds = arrangement.cells
        .filter((cell) => cell.layer === layer)
        .map((cell) => cell.id);
      actOnCellsTableTarget(layerCellIds, `Layer ${layer}`, event);
    },
    [actOnCellsTableTarget, arrangement.cells],
  );

  const commitFacet = useCallback(
    (nextStep: number, message: string) => {
      if (nextStep === facetStep || !facetOptions.some((option) => option.step === nextStep)) return;
      setFacetPast((items) => [...items.slice(-99), facetStep]);
      setFacetFuture([]);
      setFacetStep(nextStep);
      setStatus(message);
    },
    [facetOptions, facetStep],
  );

  const moveFacetRadio = useCallback(
    (
      event: React.KeyboardEvent<SVGElement | HTMLButtonElement>,
      currentStep: number,
      surface: "diagram" | "controls",
    ) => {
      const currentIndex = facetOptions.findIndex((option) => option.step === currentStep);
      if (currentIndex < 0 || facetOptions.length < 2) return false;
      let nextIndex: number | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % facetOptions.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + facetOptions.length) % facetOptions.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = facetOptions.length - 1;
      }
      if (nextIndex === null) return false;

      event.preventDefault();
      const option = facetOptions[nextIndex];
      commitFacet(
        option.step,
        `Selected ${facetSymbol(sides, option.step)} · ${facetDescription(option)}`,
      );
      requestAnimationFrame(() => {
        const target = document.querySelector(
          `[data-facet-radio="${surface}"][data-facet-step="${option.step}"]`,
        ) as HTMLElement | null;
        target?.focus();
      });
      return true;
    },
    [commitFacet, facetOptions, sides],
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
    const measure = () => {
      const spatialPanel = spatialPanelRef.current;
      const diagramPanel = diagramPanelRef.current;
      if (!spatialPanel || !diagramPanel) return;

      const spatialBounds = spatialPanel.getBoundingClientRect();
      const diagramBounds = diagramPanel.getBoundingClientRect();
      if (
        !(spatialBounds.width > 0) ||
        !(spatialBounds.height > 0) ||
        !(diagramBounds.width > 0)
      ) return;

      const next = {
        spatialWidth: spatialBounds.width,
        spatialHeight: spatialBounds.height,
        diagramWidth: diagramBounds.width,
      };
      setViewDimensions((current) =>
        current &&
        current.spatialWidth === next.spatialWidth &&
        current.spatialHeight === next.spatialHeight &&
        current.diagramWidth === next.diagramWidth
          ? current
          : next,
      );
    };

    measure();
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(measure);
    if (spatialPanelRef.current) observer?.observe(spatialPanelRef.current);
    if (diagramPanelRef.current) observer?.observe(diagramPanelRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    parsedHash.current = parseShareHash(window.location.hash);
    if (parsedHash.current) {
      setMode(parsedHash.current.mode);
      setSides(parsedHash.current.sides);
      setSymmetry(parsedHash.current.symmetry);
      setFacetStep(parsedHash.current.facetStep);
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
      setViews(freshViews());
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
    const restored = new Set<number>();
    for (const orbitId of parsedHash.current.orbitIds) {
      for (const cellId of orbitMap.orbits[orbitId]?.cellIds ?? []) restored.add(cellId);
    }
    setSelected(restored);
    setStatus(
      parsedHash.current.mode === "facetting"
        ? `${facetSymbol(sides, parsedHash.current.facetStep)} facetting restored`
        : "Shared stellation restored",
    );
    skipHashWrite.current = true;
    hashReady.current = true;
  }, [orbitMap, sides, symmetry]);

  useEffect(() => {
    if (!hashReady.current) return;
    if (skipHashWrite.current) {
      skipHashWrite.current = false;
      return;
    }
    const hash = formatShareHash({
      mode,
      sides,
      symmetry,
      orbitIds: selectedOrbitIds(selected, orbitMap),
      facetStep: activeFacetStep,
    });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  }, [activeFacetStep, mode, orbitMap, selected, sides, symmetry]);

  const changeSides = (nextSides: number) => {
    setSides(nextSides);
    setSymmetry({ family: "D", order: nextSides });
    setFacetStep(1);
    setFacetPast([]);
    setFacetFuture([]);
    setHoverLayer(null);
    setHoverSegment(null);
    setHoverDiagramSide(null);
    setHoverFacetStep(null);
  };

  const changeMode = (nextMode: LabMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setHoverCell(null);
    setHoverLayer(null);
    setHoverSegment(null);
    setHoverDiagramSide(null);
    setHoverFacetStep(null);
    setStatus(
      nextMode === "stellation"
        ? "Stellation mode · extend sides and select cells"
        : `Facetting mode · ${facetSymbol(sides, activeFacetStep)} uses the original vertices`,
    );
  };

  const changeSymmetry = (value: string) => {
    const match = value.match(/^(C|D)(\d+)$/);
    if (!match) return;
    const next = { family: match[1] as "C" | "D", order: Number(match[2]) };
    const nextOrbitMap = buildOrbitMap(arrangement, next);
    setSelected((current) => {
      return buildInvariantSet(current, nextOrbitMap);
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
    const span = (spatialExtent * 2.34) / view.zoom;
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
    if (event.shiftKey) orbitAction(orbit, "add");
    else if (event.ctrlKey || event.metaKey || event.altKey) orbitAction(orbit, "remove");
  };

  const spatialWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0014);
    setView((current) => ({ ...current, zoom: Math.min(8, Math.max(0.55, current.zoom * factor)) }));
  };

  const diagramPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button === 2) return;
    const target = (event.target as Element).closest<SVGElement>("[data-diagram-side]");
    const side = target?.dataset.diagramSide;
    diagramDrag.current = {
      x: event.clientX,
      y: event.clientY,
      center: diagramCenter,
      span: diagramSpan,
      pointerId: event.pointerId,
      dragged: false,
      segmentId: target ? Number(target.dataset.segmentId) : null,
      side: side === "above" || side === "below" ? side : null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const diagramPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = diagramDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.dragged && !isDiagramDrag(dx, dy)) return;
    drag.dragged = true;
    const bounds = event.currentTarget.getBoundingClientRect();
    setDiagramView((current) => ({
      ...current,
      center: drag.center - (dx / bounds.width) * drag.span,
    }));
  };

  const diagramPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = diagramDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    diagramDrag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
    if (drag.dragged || drag.segmentId === null || drag.side === null) return;
    actOnDiagram(drag.segmentId, drag.side);
  };

  const diagramWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0014);
    setDiagramView((current) => ({
      ...current,
      zoom: Math.min(7, Math.max(1, current.zoom * factor)),
    }));
  };

  const actOnDiagram = (segmentId: number, side: DiagramSide) => {
    const segment = arrangement.diagram[segmentId];
    const cellId = diagramCellForSide(segment, side);
    if (cellId === null) {
      setStatus(`No bounded cell ${side} this interval`);
      return;
    }
    const orbit = orbitMap.byCell.get(cellId);
    if (orbit) orbitAction(orbit, "toggle");
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

  const undoFacet = () => {
    const previous = facetPast[facetPast.length - 1];
    if (previous === undefined) return;
    setFacetPast((items) => items.slice(0, -1));
    setFacetFuture((items) => [facetStep, ...items].slice(0, 100));
    setFacetStep(previous);
    setStatus(`Restored ${facetSymbol(sides, previous)}`);
  };

  const redoFacet = () => {
    const next = facetFuture[0];
    if (next === undefined) return;
    setFacetFuture((items) => items.slice(1));
    setFacetPast((items) => [...items.slice(-99), facetStep]);
    setFacetStep(next);
    setStatus(`Restored ${facetSymbol(sides, next)}`);
  };

  const copyLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.hash = formatShareHash({
        mode,
        sides,
        symmetry,
        orbitIds: selectedOrbitIds(selected, orbitMap),
        facetStep: activeFacetStep,
      });
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setStatus("Copy was blocked; use the address bar to share this state");
    }
  };

  const cycleTheme = () => {
    selectThemePreference(nextThemePreference(themePreference));
  };

  const spatialExtent = mode === "stellation" ? arrangement.extent : facetting.extent * 1.16;
  const viewSpan = (spatialExtent * 2.34) / view.zoom;
  const viewBox = `${view.x - viewSpan / 2} ${view.y - viewSpan / 2} ${viewSpan} ${viewSpan}`;
  const lineRadius = arrangement.extent * 1.7;
  const baseDiagramSpan = Math.max(1e-6, arrangement.diagramExtent[1] - arrangement.diagramExtent[0]);
  const diagramSpan = viewDimensions
    ? diagramSpanForMatchingSpatialScale(
        viewSpan,
        viewDimensions.spatialWidth,
        viewDimensions.spatialHeight,
        viewDimensions.diagramWidth,
        diagramView.zoom,
      )
    : diagramSpanAtZoom(baseDiagramSpan * 1.14, view.zoom * diagramView.zoom);
  const diagramCenter = diagramView.center || (arrangement.diagramExtent[0] + arrangement.diagramExtent[1]) / 2;
  const diagramStart = diagramCenter - diagramSpan / 2;
  const diagramX = (position: number) => diagramViewportPosition(position, diagramStart, diagramSpan);
  const diagramViewBox = "0 0 1000 100";
  const facetDiagramSpan = diagramSpanAtZoom(
    Math.max(1e-6, facetDiagram.extent[1] - facetDiagram.extent[0]) * 1.28,
    view.zoom,
  );
  const facetDiagramCenter = (facetDiagram.extent[0] + facetDiagram.extent[1]) / 2;
  const facetDiagramViewBox = `${facetDiagramCenter - facetDiagramSpan / 2} 0 ${facetDiagramSpan} 100`;
  const activeFacetIndex = facetOptions.findIndex((option) => option.step === activeFacetStep);

  return (
    <div className="polygon-app" data-mode={mode}>
      <header className="app-header">
        <div className="brand" aria-label={`${mode === "stellation" ? "Stellation" : "Facetting"} 2D`}>
          <span className="brand-mark">◇</span>
          <span>{mode === "stellation" ? "Stellation" : "Facetting"}</span>
          <b>2D</b>
        </div>
        <div className="mode-toggle" role="group" aria-label="Construction mode">
          <button type="button" aria-pressed={mode === "stellation"} onClick={() => changeMode("stellation")}>Stellation</button>
          <button type="button" aria-pressed={mode === "facetting"} onClick={() => changeMode("facetting")}>Facetting</button>
        </div>
        <div className="header-stats" aria-label={`Current ${mode} statistics`}>
          {mode === "stellation" ? (
            <>
              <span><b>{sides}</b> lines</span>
              <span><b>{arrangement.cells.length}</b> bounded cells</span>
              <span><b>{maxLayer + 1}</b> layers</span>
              <span><b>{selectedArea.toFixed(2)}</b> area</span>
            </>
          ) : (
            <>
              <span><b>{sides}</b> original vertices</span>
              <span><b>{facetting.edges.length}</b> edges</span>
              <span><b>{facetting.componentCount}</b> {facetting.componentCount === 1 ? "circuit" : "circuits"}</span>
              <span><b>{facetting.verticesPerComponent}</b> vertices / circuit</span>
            </>
          )}
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
        <button
          className="ghost-button theme-button"
          type="button"
          aria-label={`Theme: ${THEME_LABELS[themePreference]}`}
          title={`${THEME_LABELS[themePreference]} theme · click for ${THEME_LABELS[nextThemePreference(themePreference)]}`}
          onClick={cycleTheme}
        >
          <span aria-hidden="true">{THEME_GLYPHS[themePreference]}</span>
        </button>
      </header>

      <main className="app-main">
        <section className="stage" aria-label={`${mode === "stellation" ? "Stellation" : "Facetting"} views`}>
          <div ref={spatialPanelRef} className="view-panel spatial-panel">
            <div className="view-heading">
              <div>
                <span className="eyebrow">2D {mode}</span>
                <h1>{mode === "stellation" ? "Supporting lines, stellation cells" : "Original vertices, new edge circuit"}</h1>
              </div>
              <div className="view-actions">
                <button type="button" onClick={resetSpatialAndDiagramView}>fit</button>
                <span>{Math.round(view.zoom * 100)}%</span>
              </div>
            </div>

            <svg
              className="spatial-canvas"
              viewBox={viewBox}
              role="img"
              aria-label={
                mode === "stellation"
                  ? `${sides}-gon side-line arrangement with ${arrangement.cells.length} bounded cells`
                  : `${facetSymbol(sides, activeFacetStep)} facetting with ${facetting.edges.length} edges on ${sides} original vertices`
              }
              onPointerDown={spatialPointerDown}
              onPointerMove={spatialPointerMove}
              onPointerUp={spatialPointerUp}
              onPointerCancel={() => { viewDrag.current = null; }}
              onContextMenu={(event) => event.preventDefault()}
              onWheel={spatialWheel}
              onDoubleClick={resetSpatialAndDiagramView}
              onPointerLeave={() => { if (!viewDrag.current) setHoverCell(null); }}
            >
              <defs>
                <pattern id="micro-grid" width="0.2" height="0.2" patternUnits="userSpaceOnUse">
                  <path d="M 0.2 0 L 0 0 0 0.2" fill="none" stroke="var(--grid-stroke)" strokeWidth="0.006" />
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

              {mode === "stellation" ? (
                <>
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
                </>
              ) : (
                <>
                  <path className="source-polygon" d={polygonPath(facetting.vertices)} aria-hidden="true" />
                  {previewFacetting ? (
                    <g className="facetting-preview" aria-hidden="true">
                      {previewFacetting.edges.map((edge) => (
                        <line
                          key={edge.id}
                          className="facetting-edge"
                          x1={edge.points[0].x}
                          y1={-edge.points[0].y}
                          x2={edge.points[1].x}
                          y2={-edge.points[1].y}
                          style={{ "--facet-color": layerColor(previewFacetting.step - 1) } as React.CSSProperties}
                        />
                      ))}
                    </g>
                  ) : null}
                  <g className="facetting-edges" filter="url(#selected-glow)">
                    {facetting.edges.map((edge) => (
                      <line
                        key={edge.id}
                        className="facetting-edge"
                        x1={edge.points[0].x}
                        y1={-edge.points[0].y}
                        x2={edge.points[1].x}
                        y2={-edge.points[1].y}
                        style={{ "--facet-color": layerColor(activeFacetStep - 1 + edge.componentId) } as React.CSSProperties}
                      />
                    ))}
                  </g>
                  <g className="source-vertices">
                    {facetting.vertices.map((point, vertexId) => (
                      <g key={vertexId}>
                        <circle className="source-vertex" cx={point.x} cy={-point.y} r={facetting.extent * 0.028} />
                        <text className="source-vertex-label" x={point.x * 1.09} y={-point.y * 1.09}>{vertexId + 1}</text>
                      </g>
                    ))}
                  </g>
                </>
              )}
            </svg>

            <div className="gesture-strip">
              <span>drag to pan · wheel to zoom · double-click to fit</span>
              <span>
                {mode === "stellation" ? (
                  <><kbd>shift</kbd> add orbit · <kbd>ctrl / ⌥</kbd> remove orbit</>
                ) : (
                  <>crossings are not vertices · choose a circuit below</>
                )}
              </span>
            </div>
          </div>

          <div ref={diagramPanelRef} className="view-panel diagram-panel">
            <div className="view-heading compact">
              <div>
                <span className="eyebrow">
                  {mode === "stellation" ? "1D view · side 1" : "1D facetting diagram · vertex 1"}
                </span>
                <h2>
                  {mode === "stellation"
                    ? "Cells immediately above and below the line"
                    : "Paired chord choices through the reference cut"}
                </h2>
              </div>
              {mode === "stellation" ? (
                <div className="diagram-legend" aria-label="Diagram side legend">
                  <span><i className="upper-key" /> above</span>
                  <span><i className="lower-key" /> below</span>
                </div>
              ) : (
                <div className="diagram-legend" aria-label="Facetting point legend">
                  <span><i className="upper-key" /> selected pair</span>
                  <span><i className="lower-key" /> candidate pairs</span>
                </div>
              )}
            </div>

            {mode === "stellation" ? (
              <svg
              className="diagram-canvas"
              viewBox={diagramViewBox}
              preserveAspectRatio="none"
              role="group"
              aria-label="One-dimensional arrangement along the bottom side of the polygon"
              onPointerDown={diagramPointerDown}
              onPointerMove={diagramPointerMove}
              onPointerUp={diagramPointerUp}
              onPointerCancel={(event) => {
                if (diagramDrag.current?.pointerId === event.pointerId) diagramDrag.current = null;
              }}
              onLostPointerCapture={(event) => {
                if (diagramDrag.current?.pointerId === event.pointerId) diagramDrag.current = null;
              }}
              onWheel={diagramWheel}
              onDoubleClick={() => setDiagramView({ center: 0, zoom: 1 })}
              onPointerLeave={() => {
                setHoverSegment(null);
                setHoverDiagramSide(null);
              }}
            >
              <line
                className="diagram-rail"
                x1={diagramX(arrangement.diagramExtent[0])}
                x2={diagramX(arrangement.diagramExtent[1])}
                y1="50"
                y2="50"
              />
              {arrangement.diagram.map((segment) => {
                const upperCell = segment.aboveCellId === null ? null : arrangement.cells[segment.aboveCellId];
                const lowerCell = segment.belowCellId === null ? null : arrangement.cells[segment.belowCellId];
                const upperOrbit = upperCell ? orbitMap.byCell.get(upperCell.id) : null;
                const lowerOrbit = lowerCell ? orbitMap.byCell.get(lowerCell.id) : null;
                const upperSelected = upperCell ? selected.has(upperCell.id) : false;
                const lowerSelected = lowerCell ? selected.has(lowerCell.id) : false;
                const hovering = hoverSegment === segment.id;
                const previewSide = hovering ? hoverDiagramSide : null;
                const previewCell = previewSide === "above" ? upperCell : previewSide === "below" ? lowerCell : null;
                const previewing = previewCell !== null;
                const boundaryCell = upperSelected !== lowerSelected
                  ? upperSelected
                    ? upperCell
                    : lowerCell
                  : null;
                const x0 = diagramX(segment.t0);
                const x1 = diagramX(segment.t1);
                const width = x1 - x0;
                return (
                  <g key={segment.id} className={hovering ? "diagram-segment is-hovered" : "diagram-segment"}>
                    <line
                      className={`diagram-interval ${boundaryCell ? "is-boundary" : "is-internal"} ${previewing ? "is-preview" : ""}`}
                      x1={x0}
                      x2={x1}
                      y1="50"
                      y2="50"
                      stroke={
                        previewing
                          ? previewSide === "above"
                            ? "var(--upper)"
                            : "var(--lower)"
                          : boundaryCell
                            ? layerColor(boundaryCell.layer)
                            : undefined
                      }
                    />
                    {upperOrbit && width > 70 ? (
                      <text className="diagram-label" x={(x0 + x1) / 2} y="29">
                        O{upperOrbit.id + 1}
                      </text>
                    ) : null}
                    {lowerOrbit && width > 70 ? (
                      <text className="diagram-label" x={(x0 + x1) / 2} y="72">
                        O{lowerOrbit.id + 1}
                      </text>
                    ) : null}
                    <line className="diagram-tick" x1={x0} x2={x0} y1="44" y2="56" />
                    {segment.id === arrangement.diagram.length - 1 ? (
                      <line className="diagram-tick" x1={x1} x2={x1} y1="44" y2="56" />
                    ) : null}
                    <rect
                      className={`diagram-hit above ${upperCell ? "" : "is-empty"}`}
                      x={x0}
                      y="4"
                      width={width}
                      height="46"
                      data-segment-id={segment.id}
                      data-diagram-side="above"
                      tabIndex={upperCell ? 0 : -1}
                      role={upperCell ? "button" : undefined}
                      aria-disabled={!upperCell}
                      aria-pressed={upperCell ? upperSelected : undefined}
                      aria-label={`Interval ${segment.id + 1} above. Toggle ${upperOrbit ? orbitName(upperOrbit) : "no bounded cell"}.`}
                      onPointerEnter={() => {
                        setHoverSegment(segment.id);
                        setHoverDiagramSide("above");
                      }}
                      onFocus={() => {
                        setHoverSegment(segment.id);
                        setHoverDiagramSide("above");
                      }}
                      onBlur={() => {
                        setHoverSegment(null);
                        setHoverDiagramSide(null);
                      }}
                      onContextMenu={(event) => event.preventDefault()}
                      onClick={(event) => {
                        if (event.detail === 0 && upperCell) actOnDiagram(segment.id, "above");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          actOnDiagram(segment.id, "above");
                        }
                      }}
                    />
                    <rect
                      className={`diagram-hit below ${lowerCell ? "" : "is-empty"}`}
                      x={x0}
                      y="50"
                      width={width}
                      height="46"
                      data-segment-id={segment.id}
                      data-diagram-side="below"
                      tabIndex={lowerCell ? 0 : -1}
                      role={lowerCell ? "button" : undefined}
                      aria-disabled={!lowerCell}
                      aria-pressed={lowerCell ? lowerSelected : undefined}
                      aria-label={`Interval ${segment.id + 1} below. Toggle ${lowerOrbit ? orbitName(lowerOrbit) : "no bounded cell"}.`}
                      onPointerEnter={() => {
                        setHoverSegment(segment.id);
                        setHoverDiagramSide("below");
                      }}
                      onFocus={() => {
                        setHoverSegment(segment.id);
                        setHoverDiagramSide("below");
                      }}
                      onBlur={() => {
                        setHoverSegment(null);
                        setHoverDiagramSide(null);
                      }}
                      onContextMenu={(event) => event.preventDefault()}
                      onClick={(event) => {
                        if (event.detail === 0 && lowerCell) actOnDiagram(segment.id, "below");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          actOnDiagram(segment.id, "below");
                        }
                      }}
                    />
                  </g>
                );
              })}
              </svg>
            ) : (
              <svg
                className="diagram-canvas facet-diagram-canvas"
                viewBox={facetDiagramViewBox}
                preserveAspectRatio="none"
                role="radiogroup"
                aria-label={`Facetting diagram at vertex 1 with ${facetDiagram.pairs.length} valid chord-step pairs`}
                onPointerLeave={() => setHoverFacetStep(null)}
              >
                <line
                  className="facet-diagram-axis"
                  x1={facetDiagram.extent[0]}
                  x2={facetDiagram.extent[1]}
                  y1="50"
                  y2="50"
                />
                <line
                  className="facet-diagram-center"
                  x1="0"
                  x2="0"
                  y1="31"
                  y2="69"
                />
                {facetDiagram.pairs.map((pair) => {
                  const option = facetOptions.find((candidate) => candidate.step === pair.step);
                  if (!option) return null;
                  const selectedPair = pair.step === activeFacetStep;
                  const hoveredPair = pair.step === hoverFacetStep;
                  const color = layerColor(pair.step - 1);
                  const pointRadius = facetDiagramSpan * 0.0075;
                  return (
                    <g
                      key={pair.step}
                      className={`facet-point-pair ${selectedPair ? "is-selected" : ""} ${hoveredPair ? "is-hovered" : ""}`}
                      style={{ "--facet-color": color } as React.CSSProperties}
                      tabIndex={selectedPair ? 0 : -1}
                      role="radio"
                      aria-checked={selectedPair}
                      data-facet-radio="diagram"
                      data-facet-step={pair.step}
                      aria-label={`${facetSymbol(sides, pair.step)}, ${facetDescription(option)}`}
                      onPointerEnter={() => setHoverFacetStep(pair.step)}
                      onPointerLeave={() => setHoverFacetStep(null)}
                      onClick={() => commitFacet(pair.step, `Selected ${facetSymbol(sides, pair.step)} · ${facetDescription(option)}`)}
                      onKeyDown={(event) => {
                        if (moveFacetRadio(event, pair.step, "diagram")) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          commitFacet(pair.step, `Selected ${facetSymbol(sides, pair.step)} · ${facetDescription(option)}`);
                        }
                      }}
                    >
                      {pair.points.map((point, pointIndex) => (
                        <g key={point.targetVertexId}>
                          <ellipse
                            className="facet-point"
                            cx={point.position}
                            cy="50"
                            rx={pointRadius}
                            ry="4.2"
                          />
                          <ellipse
                            className="facet-point-hit"
                            cx={point.position}
                            cy="50"
                            rx={pointRadius * 3.2}
                            ry="18"
                          />
                          <text
                            className="facet-point-label"
                            x={point.position}
                            y={pointIndex === 0 ? 31 : 74}
                          >
                            k{pair.step}
                          </text>
                        </g>
                      ))}
                    </g>
                  );
                })}
              </svg>
            )}
            <div className="gesture-strip diagram-help">
              <span>
                {mode === "stellation"
                  ? "interval lengths are geometric, not evenly spaced"
                  : "each pair marks the two incident chords at vertex 1"}
              </span>
              <span>
                {mode === "stellation" ? (
                  <>click above or below the line to toggle that cell</>
                ) : (
                  <>click a pair to choose the complete closed circuit</>
                )}
              </span>
            </div>
          </div>

          <div className="status-bar" aria-live="polite">
            <span className="status-dot" />
            <span>{status}</span>
            <span className="status-selection">
              {mode === "stellation" ? formatSelection(selected, orbitMap) : facetSymbol(sides, activeFacetStep)}
            </span>
          </div>
        </section>

        <aside className="control-panel" aria-label={`${mode === "stellation" ? "Stellation" : "Facetting"} controls`}>
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
            {mode === "stellation" ? (
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
            ) : (
              <div className="field-row">
                <span>Symmetry</span>
                <output className="field-value">D{sides} · complete circuit orbit</output>
              </div>
            )}
            <p className="section-note">
              {mode === "stellation"
                ? "Extending every side creates the polygon's stellation arrangement. Its bounded cells are grouped into selectable symmetry orbits."
                : "Facetting never adds or moves a vertex. Choose one complete connection-step orbit; its chords close into a circuit or compound."}
            </p>
          </section>

          {mode === "stellation" ? (
            <section className="control-section cells-section">
            <div className="section-title">
              <span className="eyebrow">Cells</span>
              <span className="section-index">02</span>
            </div>
            <div className="cell-toolbar stellation-toolbar">
              <button type="button" onClick={() => commit(new Set(coreOrbit?.cellIds ?? [arrangement.coreCellId]), "Core selected")}>core</button>
              <button
                type="button"
                onClick={() => {
                  const currentMax = Math.max(-1, ...arrangement.cells.filter((cell) => selected.has(cell.id)).map((cell) => cell.layer));
                  const targetLayer = Math.min(maxLayer, currentMax + 1);
                  commit(new Set(arrangement.cells.filter((cell) => cell.layer <= targetLayer).map((cell) => cell.id)), `Layers 0–${targetLayer} selected`);
                }}
              >
                + layer
              </button>
              <button type="button" onClick={() => commit(new Set(arrangement.cells.map((cell) => cell.id)), "All bounded cells selected")}>all</button>
              <button type="button" onClick={() => commit(new Set(), "Selection cleared")}>clear</button>
              <button type="button" onClick={undo} disabled={!past.length} aria-label="Undo">↶</button>
              <button type="button" onClick={redo} disabled={!future.length} aria-label="Redo">↷</button>
            </div>

            <div className="orbit-table" role="group" aria-label="Cell orbits by layer">
              {[...Array(maxLayer + 1)].map((_, reverseIndex) => {
                const layer = maxLayer - reverseIndex;
                const orbits = orbitMap.orbits.filter((orbit) => orbit.layer === layer);
                const layerCellIds = arrangement.cells
                  .filter((cell) => cell.layer === layer)
                  .map((cell) => cell.id);
                const layerActive = layerCellIds.every((cellId) => selected.has(cellId));
                const layerPartial = !layerActive && layerCellIds.some((cellId) => selected.has(cellId));
                return (
                  <div className="orbit-row" key={layer}>
                    <button
                      type="button"
                      className={`layer-button ${layerActive ? "is-active" : ""} ${layerPartial ? "is-partial" : ""}`}
                      data-layer-number={layer}
                      aria-label={`Toggle every cell in layer ${layer}`}
                      aria-pressed={layerActive ? true : layerPartial ? "mixed" : false}
                      onClick={(event) => actOnLayer(layer, event)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (event.ctrlKey) actOnLayer(layer, event);
                      }}
                      onPointerEnter={() => setHoverLayer(layer)}
                      onPointerLeave={() => setHoverLayer(null)}
                      onFocus={() => setHoverLayer(layer)}
                      onBlur={() => setHoverLayer(null)}
                      title={`Layer ${layer} · click the number to toggle the whole layer`}
                    >
                      <span aria-hidden="true">{layer}</span>
                    </button>
                    <div className="orbit-items">
                      {orbits.map((orbit) => {
                        const active = orbit.cellIds.every((cellId) => selected.has(cellId));
                        const highlighted = orbit.cellIds.some((cellId) => highlightedCells.has(cellId));
                        const cardinalityColor = orbitCardinalityPalette.get(orbit.cellIds.length) ?? "var(--dim)";
                        return (
                          <button
                            type="button"
                            key={orbit.id}
                            className={`orbit-button ${active ? "is-active" : ""} ${highlighted ? "is-highlighted" : ""}`}
                            style={{ "--orbit-color": cardinalityColor } as React.CSSProperties}
                            data-orbit-size={orbit.cellIds.length}
                            aria-pressed={active}
                            aria-label={`${orbitName(orbit)}: toggle ${orbit.cellIds.length} congruent ${orbit.cellIds.length === 1 ? "cell" : "cells"}`}
                            onClick={(event) => actOnCellTable(orbit, event)}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              if (event.ctrlKey) actOnCellTable(orbit, event);
                            }}
                            onPointerEnter={() => setHoverCell(orbit.cellIds[0])}
                            onPointerLeave={() => setHoverCell(null)}
                            onFocus={() => setHoverCell(orbit.cellIds[0])}
                            onBlur={() => setHoverCell(null)}
                            title={`${orbitName(orbit)} · ${orbit.cellIds.length} congruent ${orbit.cellIds.length === 1 ? "cell" : "cells"}`}
                          >
                            <span>O{orbit.id + 1}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="orbit-size-legend" aria-label="Cells per orbit color legend">
              <b>cells per orbit</b>
              {[...orbitCardinalityPalette].map(([count, color]) => (
                <span key={count}><i style={{ background: color }} /> {count}</span>
              ))}
            </div>
            <ul className="key-guide">
              <li><kbd>layer #</kbd><span>toggle the whole layer</span></li>
              <li><kbd>click</kbd><span>toggle one symmetry orbit</span></li>
              <li><kbd>shift / ctrl</kbd><span>toggle target + lower support</span></li>
            </ul>
            </section>
          ) : (
            <section className="control-section facets-section">
              <div className="section-title">
                <span className="eyebrow">Facet circuits</span>
                <span className="section-index">02</span>
              </div>
              <div className="cell-toolbar">
                <button
                  type="button"
                  onClick={() => commitFacet(1, `Selected ${facetSymbol(sides, 1)} · base polygon`)}
                  disabled={activeFacetStep === 1}
                >
                  base
                </button>
                <button
                  type="button"
                  disabled={activeFacetIndex <= 0}
                  onClick={() => {
                    const option = facetOptions[activeFacetIndex - 1];
                    if (option) commitFacet(option.step, `Selected ${facetSymbol(sides, option.step)} · ${facetDescription(option)}`);
                  }}
                >
                  ‹ step
                </button>
                <button
                  type="button"
                  disabled={activeFacetIndex < 0 || activeFacetIndex >= facetOptions.length - 1}
                  onClick={() => {
                    const option = facetOptions[activeFacetIndex + 1];
                    if (option) commitFacet(option.step, `Selected ${facetSymbol(sides, option.step)} · ${facetDescription(option)}`);
                  }}
                >
                  step ›
                </button>
                <button type="button" onClick={undoFacet} disabled={!facetPast.length} aria-label="Undo facetting step">↶</button>
                <button type="button" onClick={redoFacet} disabled={!facetFuture.length} aria-label="Redo facetting step">↷</button>
              </div>

              <div className="facet-options" role="radiogroup" aria-label="Connection step">
                {facetOptions.map((option) => {
                  const active = option.step === activeFacetStep;
                  return (
                    <button
                      key={option.step}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      tabIndex={active ? 0 : -1}
                      data-facet-radio="controls"
                      data-facet-step={option.step}
                      className="facet-option"
                      style={{ "--facet-color": layerColor(option.step - 1) } as React.CSSProperties}
                      onPointerEnter={() => setHoverFacetStep(option.step)}
                      onPointerLeave={() => setHoverFacetStep(null)}
                      onClick={() => commitFacet(option.step, `Selected ${facetSymbol(sides, option.step)} · ${facetDescription(option)}`)}
                      onKeyDown={(event) => { moveFacetRadio(event, option.step, "controls"); }}
                    >
                      <b>{facetSymbol(sides, option.step)}</b>
                      <span>
                        step {option.step} · {facetDescription(option)} · {sides} edges
                      </span>
                    </button>
                  );
                })}
              </div>

              {sides % 2 === 0 ? (
                <p className="degenerate-note">
                  Step {sides / 2} is omitted: opposite-vertex diameters have degree 1 and do not close into polygonal circuits.
                </p>
              ) : null}
              <ul className="key-guide">
                <li><kbd>click</kbd><span>choose one complete chord-step orbit</span></li>
                <li><kbd>D{sides}</kbd><span>every original vertex has degree 2</span></li>
                <li><kbd>×</kbd><span>crossings are not added as vertices</span></li>
              </ul>
            </section>
          )}

          <section className="control-section explainer-section">
            <div className="section-title">
              <span className="eyebrow">
                {mode === "stellation" ? "Stellation correspondence" : "Facetting by reciprocity"}
              </span>
              <span className="section-index">03</span>
            </div>
            <div className="analogy-grid">
              {mode === "stellation" ? (
                <>
                  <span>3D polyhedron faces</span><b>→</b><span>2D polygon sides</span>
                  <span>3D face planes</span><b>→</b><span>2D infinite lines</span>
                  <span>2D diagram</span><b>→</b><span>1D segmented line</span>
                </>
              ) : (
                <>
                  <span>fixed source vertices</span><b>→</b><span>chord endpoints</span>
                  <span>connection step k</span><b>→</b><span>closed {"{n/k}"} circuit</span>
                  <span>chord crossings</span><b>→</b><span>not vertices</span>
                </>
              )}
            </div>
            <p className="section-note">
              {mode === "stellation"
                ? "This is the original stellation construction reduced by one dimension: supporting lines continue beyond the core polygon and bound selectable stellation cells."
                : "Stellation and facetting are polar-dual constructions, but they are not the same mesh. Here the source polygon's vertices stay fixed while its edge circuit changes."}
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
