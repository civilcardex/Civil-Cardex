/* eslint-disable no-empty */
import { memo, useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import PlanoEngine, {
  type ElementItem,
  type ToolType,
  type TramoType,
} from '../lib/PlanoEngine/PlanoEngine';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import type { PlanoElement, PlanoNet, PlanoBajante } from '../lib/PlanoEngine/PlanoState';
import type { Piso } from './useWorkAreaState';
import type { PlanItem } from '../context/PlansContext';
import { matLongName, pisoLbl, GAS, DEFAULT_PENDIENTE_PCT } from '../constants';
import { useProject } from '../context/ProjectContext';
import { usePlans } from '../context/PlansContext';
import { writeSanDrawingSync, writeHydroDrawingSync } from '../utils/drawingSync';
import { bumpHidroAccesorio } from '../utils/syncExtremeAccessory';
import {
  loadFromStorage,
  saveToStorage,
  saveTrazosToDB,
  loadTrazosFromDB,
} from '../services/storageService';
import type { PlanTrazos } from '../services/storageService';
import {
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  ACTIVE_NETS_KEY,
  VISOR_TOOL_KEY,
  VISOR_TIPO_TRAMO_KEY,
  VISOR_SNAP_ON_KEY,
  NETS_CHANGED_EVENT,
  TRAZOS_PREFIX,
  LAST_TRAZOS_ID_KEY,
} from '../constants/storage-keys';
import { devError } from '../../../utils/devError';
import PdfViewerToolbar, { STATUS } from './pdfViewer/PdfViewerToolbar';
import PdfCanvas from './pdfViewer/PdfCanvas';
import PdfViewerNetworkBar from './pdfViewer/PdfViewerNetworkBar';
import { usePdfAutoSave } from './pdfViewer/usePdfAutoSave';
import { usePdfViewerEngine } from './pdfViewer/PdfViewerEngineInit';
import TextInputOverlay from './pdfViewer/TextInputOverlay';
import CrossFloorGhostPanel from './pdfViewer/CrossFloorGhostPanel';
import type { CrossFloorGhost } from '../utils/associateBajanteAcrossFloors';
import DrawingElementContextMenu, {
  type ContextMenuState,
  type LowerFloorRamales,
} from './pdfViewer/DrawingElementContextMenu';
import ConfirmDialog from './pdfViewer/ConfirmDialog';
import AlertDialog from './pdfViewer/AlertDialog';
import AccesorioModal from './pdfViewer/AccesorioModal';
import TipoTramoSelector from './pdfViewer/TipoTramoSelector';
import TramoEditor from './pdfViewer/TramoEditor';
import BajanteAsociacion from './pdfViewer/BajanteAsociacion';
import PdfViewerDrawnElements from './pdfViewer/PdfViewerDrawnElements';
import { CopyFromPlanPanel } from './pdfViewer/CopyFromPlanPanel';
import AparatosPanel from './FixturesPanel';
const PdfViewer_SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
const PdfViewer_S4: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
};
const PdfViewer_S5: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 40,
  width: 16,
  height: 24,
  background: '#14161a',
  border: '1px solid #3a494a',
  color: '#22c55e',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  fontSize: 12,
} as const;
const PdfViewer_EMPTY_PISOS: Piso[] = [];
// Collapsed left sidebar keeps a narrow icon strip (tools + snap + actions) instead of vanishing
// to 0 — matches the toolbar's own collapsed rendering in PdfViewerToolbar.tsx.
const LEFT_COLLAPSED_WIDTH = 44;

// Structural probe of a PlanoElement union: lets code sniff `tipo`/`net`/`diametro`/`pendiente`
// (present on some element kinds, absent on others) without narrowing via the exported type
// guards at every access site.
type ProbedElement = PlanoElement & {
  tipo?: string;
  net?: string;
  diametro?: string;
  pendiente?: number;
};

interface PdfViewerProps {
  files: Array<{ id: number; file: File }>;
  activeIndex: number;
  onSelectPlan: (idx: number) => void;
  onAddPlan: () => void;
  onRemovePlan: (idx: number) => void;
  pisos?: Piso[];
  planos?: PlanItem[];
  activeNetworks: Set<string>;
}

const mainContainerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  background: '#111317',
  border: '1px solid #3a494a',
  overflow: 'hidden',
};
const leftSidebarStyle: CSSProperties = {
  width: 180,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: '#14161a',
  borderRight: '1px solid #3a494a',
  overflowY: 'auto',
  overflowX: 'hidden',
};
const rightSidebarStyle: CSSProperties = {
  width: 210,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: '#14161a',
  borderLeft: '1px solid #3a494a',
  overflowY: 'auto',
  overflowX: 'hidden',
  transition: 'opacity 0.2s',
};

function PdfViewer_({
  files,
  activeIndex,
  onSelectPlan,
  pisos = PdfViewer_EMPTY_PISOS,
  planos = [],
  activeNetworks,
}: PdfViewerProps) {
  const navigate = useNavigate();
  const { mats } = useProject();
  const planosCtx = usePlans();
  const plansRef = useRef(planosCtx.plans);
  plansRef.current = planosCtx.plans;
  const syncDrawings = useCallback(() => {
    try {
      writeSanDrawingSync(plansRef.current);
    } catch {}
    try {
      writeHydroDrawingSync(plansRef.current);
    } catch {}
  }, []);
  const [scale, setScale] = useState(1);
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 1024);
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth < 1024);

  const dynamicLeftStyle: CSSProperties = useMemo(
    () => ({
      ...leftSidebarStyle,
      width: leftCollapsed ? LEFT_COLLAPSED_WIDTH : 180,
      borderRight: '1px solid #3a494a',
      overflowX: 'hidden',
      overflowY: 'auto',
      scrollbarGutter: 'stable',
      transition: 'width 0.2s ease, border-right 0.2s ease',
    }),
    [leftCollapsed],
  );

  const dynamicRightStyle: CSSProperties = useMemo(
    () => ({
      ...rightSidebarStyle,
      width: rightCollapsed ? 0 : 210,
      borderLeft: rightCollapsed ? 'none' : '1px solid #3a494a',
      overflow: rightCollapsed ? 'hidden' : 'auto',
      transition: 'width 0.2s ease, border-left 0.2s ease',
    }),
    [rightCollapsed],
  );

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState('sel');
  const [activeNet, setActiveNet] = useState(() => {
    if (activeNetworks && activeNetworks.size > 0) {
      if (activeNetworks.has('af')) return 'af';
      return Array.from(activeNetworks)[0];
    }
    try {
      const parsed = loadFromStorage<string[] | null>(ACTIVE_NETS_KEY, null);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((id) => id !== 'ep' && id !== 'bom');
        if (valid.length > 0) {
          if (parsed.includes('af')) return 'af';
          return valid[0];
        }
      }
    } catch {}
    return 'af';
  });

  useEffect(() => {
    if (activeNetworks && activeNetworks.size > 0 && !activeNetworks.has(activeNet)) {
      setActiveNet(Array.from(activeNetworks)[0]);
    }
  }, [activeNetworks, activeNet]);

  const [tipoTramo, setTipoTramo] = useState(() => {
    try {
      return sessionStorage.getItem(VISOR_TIPO_TRAMO_KEY) || 'ramal';
    } catch {
      return 'ramal';
    }
  });
  const [padreTributarioId, setPadreTributarioId] = useState<string | null>(null);
  const [snapOn, setSnapOn] = useState(() => {
    try {
      const v = sessionStorage.getItem(VISOR_SNAP_ON_KEY);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });
  const [scaleM, setScaleM] = useState('0.5');
  const [selectedNivel, setSelectedNivel] = useState<number | null>(null);
  const [hiddenNets, setHiddenNets] = useState<Set<string>>(new Set());
  const [lockedNets, setLockedNets] = useState<Set<string>>(new Set());

  const [selElement, setSelElement] = useState<ProbedElement | null>(null);
  const [selectedCrossFloorGhost, setSelectedCrossFloorGhost] = useState<CrossFloorGhost | null>(
    null,
  );
  const [drawnElements, setDrawnElements] = useState<ElementItem[]>([]);
  const [diamSel, setDiamSel] = useState<Record<string, string>>({});
  const [gasMatSel, setGasMatSel] = useState<Record<string, string>>({});
  const [pendSel, setPendSel] = useState<Record<string, number>>({});
  const [pendInput, setPendInput] = useState('');
  const [textOverlay, setTextOverlay] = useState<{
    x: number;
    y: number;
    value: string;
    cb: (text: string) => void;
  } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const activeNetRef = useRef(activeNet);
  activeNetRef.current = activeNet;

  const currentFile = files[activeIndex]?.file;
  const currentId = files[activeIndex]?.id;
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;

  const engineRef = useRef<PlanoEngine | null>(null);
  const loadingPlanRef = useRef(false);
  const cwRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [lowerFloorsRamales, setLowerFloorsRamales] = useState<LowerFloorRamales[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!selElement || !(selElement.tipo === 'bajante' || selElement.tipo === 'montante')) {
      setLowerFloorsRamales([]);
      return;
    }
    // Coerce to String, same as the plan-matching lookup below — selectedNivel and piso.n don't
    // always agree on number-vs-string, and a strict === miss here silently made currentFloor
    // undefined, falling back to Infinity: harmless on its own, but inconsistent with whichever
    // OTHER lookup in this function DOES resolve correctly, making the dropdown's floor list
    // flip between right and empty depending on which comparison happened to line up that time.
    const currentFloor = pisos.find((p) => String(p.n) === String(selectedNivel));
    // Number() coercion — npt is typed number|string (LevelsCard stores a string mid-edit) and an
    // older saved project can still have a stringified npt on disk; a bare `<=` on two strings is
    // lexicographic ("9.00" > "30.00"), silently dropping genuinely-lower floors from the list.
    const currentNpt = currentFloor ? Number(currentFloor.npt) : Infinity;
    const relevantPlans = planosCtx.plans.filter((plan) => {
      const pF = pisos.find((p) => String(p.n) === String(plan.nivel));
      return pF && Number(pF.npt) <= currentNpt;
    });
    // Only real floor-spanning risers (bajante/montante) belong in the "Destino" dropdown —
    // contador/calentador/red_publica are point fixtures, not trunk lines a pipe cascades
    // down into. Ramales aren't offered either: the association models a riser continuing
    // down into the NEXT riser below, cascading floor by floor.
    const isRiser = (b: PlanoBajante) =>
      b.tipo !== 'contador' && b.tipo !== 'calentador' && b.tipo !== 'red_publica';

    // Resolve every plan SYNCHRONOUSLY first (live engine for the current floor, localStorage for
    // the rest) and show that immediately — the dropdown must never sit empty just because one
    // slow DB fetch hasn't resolved yet. Only plans with genuinely nothing cached locally get an
    // async DB fallback, merged in as each one individually resolves (not awaited as a single
    // Promise.all) so a later effect re-run (selecting a different element) only cancels its OWN
    // still-pending fetches instead of discarding every plan's already-correct sync result.
    const syncResults = relevantPlans.map((plan) => {
      const pF = pisos.find((p) => String(p.n) === String(plan.nivel))!;
      let bajantes: PlanoBajante[] = [];
      let needsDbFallback = false;
      if (plan.id === currentIdRef.current) {
        bajantes =
          engineRef.current?.bajantes?.filter(
            (b) => b.net === (selElement.net || activeNet) && isRiser(b),
          ) || [];
      } else {
        // Must go through the same civilflow_-prefixed accessor everything else uses
        // (storageService.ts's saveToStorage/loadFromStorage) — a raw localStorage.getItem here
        // was missing that prefix entirely, so it always read a key nothing ever wrote to and
        // silently fell through to the DB fetch below on every single call.
        const data = loadFromStorage<{ bajantes?: PlanoBajante[] } | null>(
          TRAZOS_PREFIX + plan.id,
          null,
        );
        needsDbFallback = !data?.bajantes?.length;
        bajantes = (data?.bajantes || []).filter(
          (b: PlanoBajante) => b.net === (selElement.net || activeNet) && isRiser(b),
        );
      }
      return {
        planId: plan.id,
        planName: plan.name,
        npt: pF.npt,
        bajantes,
        needsDbFallback,
        isCurrent: plan.id === currentIdRef.current,
      };
    });
    syncResults.sort((a, b) => Number(b.npt) - Number(a.npt));
    setLowerFloorsRamales(syncResults.map(({ needsDbFallback: _n, ...rest }) => rest));

    // Local storage only has whatever this browser actually loaded/saved this floor as — a floor
    // last edited on another device, or before a local cache clear, has nothing here yet even
    // though its bajantes genuinely exist in the cloud. Fall back to the DB the same way
    // loadTrazosForPlan already does for the currently loaded plan, per plan that needs it,
    // merging each result in as it resolves instead of blocking the whole list on the slowest one.
    for (const plan of relevantPlans) {
      const sync = syncResults.find((r) => r.planId === plan.id);
      if (!sync?.needsDbFallback) continue;
      (async () => {
        try {
          const dbData = await loadTrazosFromDB(String(plan.id));
          if (cancelled || !dbData) return;
          const data =
            typeof dbData === 'string'
              ? JSON.parse(dbData)
              : (dbData as { bajantes?: PlanoBajante[] });
          const bajantes = (data?.bajantes || []).filter(
            (b: PlanoBajante) => b.net === (selElement.net || activeNet) && isRiser(b),
          );
          if (bajantes.length === 0) return;
          setLowerFloorsRamales((prev) =>
            prev.map((r) => (r.planId === plan.id ? { ...r, bajantes } : r)),
          );
        } catch {
          /* ignore */
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [selElement, selectedNivel, pisos, planosCtx.plans, activeNet]);

  useEffect(() => {
    try {
      sessionStorage.setItem(VISOR_TOOL_KEY, tool);
    } catch {}
  }, [tool]);
  useEffect(() => {
    try {
      sessionStorage.setItem(VISOR_TIPO_TRAMO_KEY, tipoTramo);
    } catch {}
  }, [tipoTramo]);
  useEffect(() => {
    try {
      sessionStorage.setItem(VISOR_SNAP_ON_KEY, String(snapOn));
    } catch {}
  }, [snapOn]);

  useEffect(() => {
    if (selectedNivel !== null) {
      const plano = planos.find((p) => p.nivel === selectedNivel && p.status === 'confirmed');
      if (plano && plano.scale) {
        const derived = String(plano.scale / 100);
        if (['0.5', '0.75', '1', '1.25', '2'].includes(derived)) {
          setScaleM(derived);
          if (engineRef.current) engineRef.current.setScaleM(derived);
        }
      }
      const dScale = plano && plano.definedScale ? plano.definedScale : 0;
      if (engineRef.current) engineRef.current.setDefinedScaleM(dScale);
    }
  }, [selectedNivel, planos]);

  useEffect(() => {
    if (selElement?.net) setActiveNet(selElement.net);
    if (selElement?.id) {
      if (engineRef.current && engineRef.current.tool !== 'sel') engineRef.current.setTool('sel');
      if (tool !== 'sel') setTool('sel');
    }
  }, [selElement]);

  useEffect(() => {
    if (currentId == null) return;
    const pl = planos.find((p) => p.id === currentId);
    if (pl && (pl.nivel ?? null) !== (selectedNivel ?? null)) {
      setSelectedNivel(pl.nivel ?? null);
    }
  }, [currentId, planos]);

  const loadTrazosForPlan = useCallback(
    async (eng: PlanoEngine, resolvedId: string | number): Promise<boolean> => {
      const tryLoad = (id: string | number): PlanTrazos | string | null => {
        const key = `trazos_${id}`;
        const saved = loadFromStorage<PlanTrazos | string | null>(key, null);
        return saved || null;
      };
      const localData = tryLoad(resolvedId);
      let initiallyLoaded = false;
      if (localData) {
        const workStr = typeof localData === 'string' ? localData : JSON.stringify(localData);
        eng.loadWork(workStr);
        initiallyLoaded = true;
        requestAnimationFrame(() => {
          eng.render();
        });
      }
      try {
        const dbData = await loadTrazosFromDB(String(resolvedId));
        if (dbData) {
          const dbTs = Number(dbData.ts || 0);
          const localTs = Number((typeof localData === 'string' ? null : localData)?.ts || 0);
          if (dbTs > localTs || !localData) {
            const workStr = typeof dbData === 'string' ? dbData : JSON.stringify(dbData);
            eng.loadWork(workStr);
            if (!localData || dbTs > localTs) saveToStorage(`trazos_${resolvedId}`, dbData);
            requestAnimationFrame(() => {
              eng.render();
            });
            initiallyLoaded = true;
            const loadedNet = eng.activeNet || activeNetRef.current || 'af';
            const sm = eng.scaleM;
            setActiveNet(loadedNet);
            if (sm != null) setScaleM(String(sm));
          } else if (localTs > dbTs && localData) {
            saveTrazosToDB(String(resolvedId), localData);
          }
        } else if (localData) {
          saveTrazosToDB(String(resolvedId), localData);
        }
      } catch (e) {
        devError('[LOAD] Supabase error/sync error:', e);
      }
      return initiallyLoaded;
    },
    [],
  );

  const markDirtyRef = useRef<() => void>(() => {});

  const onDirtyHandler = useCallback((eng: PlanoEngine) => {
    markDirtyRef.current();
    setDrawnElements(eng.getElementsByNet(activeNetRef.current || 'af'));
    if (eng.selId) {
      const sel = eng.getSelected();
      if (sel) {
        const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = sel as unknown as Record<
          string,
          unknown
        >;
        setSelElement(rest as unknown as ProbedElement);
      }
    }
    setSelectedCrossFloorGhost(eng.getSelectedGhost());
    if (loadingPlanRef.current) return;
    try {
      const id = eng._loadedPlanId || currentIdRef.current || 'work';
      if (id) {
        const work = eng.saveWork();
        work.ts = Date.now();
        saveToStorage(TRAZOS_PREFIX + String(id), work);
        if (id !== 'work') {
          saveToStorage(LAST_TRAZOS_ID_KEY, id);
          saveTrazosToDB(String(id), work);
        }
      }
    } catch {}
    syncDrawings();
  }, []);

  const onDeleteHandler = useCallback(
    (ids: string[]) => {
      const cleanStore = (key: string) => {
        const store = loadFromStorage(key, {}) as Record<string, unknown>;
        let changed = false;
        for (const k of Object.keys(store)) {
          for (const id of ids) {
            if (k.includes(id)) {
              delete store[k];
              changed = true;
              break;
            }
          }
        }
        if (changed) saveToStorage(key, store);
      };
      cleanStore(GAS_ACC_KEY);
      cleanStore(APARATOS_BY_TRAMO_KEY);
      cleanStore(HYDRO_DATA_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('aparatos-clear', { detail: { ids } }));
      syncDrawings();
    },
    [plansRef, syncDrawings],
  );

  const onRequestTextCb = useCallback((x: number, y: number, cb: (text: string) => void) => {
    setTextOverlay({ x, y, value: '', cb });
    const t = setTimeout(() => textInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // ── Dialog state ──
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [alertDialogState, setAlertDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });
  const [accesorioModal, setAccesorioModal] = useState<{
    isOpen: boolean;
    ramalId: string;
    angleDeg: number;
    junctionIndex: number;
    point: number[];
    net: string;
    isTee?: boolean;
  }>({
    isOpen: false,
    ramalId: '',
    angleDeg: 0,
    junctionIndex: 0,
    point: [],
    net: '',
    isTee: false,
  });

  const contextMenuCbRef = useRef<
    | ((
        bajante: PlanoElement,
        x: number,
        y: number,
        isGhostClick?: boolean,
        ramalEndpoint?: { idx: number; x: number; y: number } | null,
        midRamalHit?: { segmentIdx: number; x: number; y: number } | null,
      ) => void)
    | null
  >(null);
  const onContextMenuCb = useCallback(
    (
      bajante: PlanoElement,
      x: number,
      y: number,
      isGhostClick?: boolean,
      ramalEndpoint?: { idx: number; x: number; y: number } | null,
      midRamalHit?: { segmentIdx: number; x: number; y: number } | null,
    ) => {
      setContextMenuState({
        visible: true,
        x,
        y,
        element: bajante,
        isGhostClick,
        ramalEndpoint,
        midRamalHit,
      });
    },
    [],
  );
  contextMenuCbRef.current = onContextMenuCb;

  // ── Engine init ──
  const { engineReady } = usePdfViewerEngine({
    currentFile,
    currentId,
    currentIdRef,
    activeNetRef,
    cwRef,
    drawCanvasRef,
    pdfCanvasRef,
    onStatus: () => {},
    onDirty: onDirtyHandler,
    onSelect: (el) => setSelElement(el as ProbedElement | null),
    onDelete: onDeleteHandler,
    onToolChange: setTool,
    onRequestText: onRequestTextCb,
    onAlert: (title: string, msg: string) => {
      setAlertDialogState({ isOpen: true, title, message: msg });
    },
    onAccesorioModal: (data) => {
      setAccesorioModal({
        isOpen: true,
        ramalId: data.ramalId,
        angleDeg: data.angleDeg,
        junctionIndex: data.junctionIndex,
        point: data.point,
        net: data.net,
        isTee: data.isTee,
      });
    },
    loadTrazosForPlan,
    setActiveNet,
    setScaleM,
    setLoading,
    setError,
    scale,
    engineRef: engineRef as React.MutableRefObject<PlanoEngine | null>,
    loadingPlanRef,
  });

  // Handler for accesorio modal selection - updates the ramal accesory in engine + hidroData
  const onAccesorioSelected = useCallback(
    (ramalId: string, point: number[], _net: string, accId: string) => {
      const eng = engineRef.current;
      if (!eng) return;
      const r = eng.ramales.find((r) => r.id === ramalId);
      if (!r || !r.pts?.length) return;
      // Locate the junction by POSITION on the target ramal (ramalId is now always the ramal that
      // was already there before the connecting one was drawn — its own pts array may have no
      // relation whatsoever to whatever index the triggering ramal's endpoint had).
      const TOL = 0.5;
      let junctionIndex = r.pts.findIndex(
        ([px, py]) => Math.hypot(px - point[0], py - point[1]) < TOL,
      );
      if (junctionIndex === -1) {
        // A true tee onto a straight run has no vertex at the junction at all (the connecting
        // ramal's endpoint touches the middle of a segment) — insert one, splitting that segment,
        // same as the existing mid-body accessory/montante insertion pattern elsewhere.
        let segIdx = -1;
        for (let i = 0; i < r.pts.length - 1; i++) {
          const [ax, ay] = r.pts[i],
            [bx, by] = r.pts[i + 1];
          const dx = bx - ax,
            dy = by - ay;
          const lenSq = dx * dx + dy * dy;
          if (lenSq < 0.0001) continue;
          const t = ((point[0] - ax) * dx + (point[1] - ay) * dy) / lenSq;
          if (t < 0.02 || t > 0.98) continue;
          const projX = ax + t * dx,
            projY = ay + t * dy;
          if (Math.hypot(point[0] - projX, point[1] - projY) < TOL) {
            segIdx = i;
            break;
          }
        }
        if (segIdx === -1) {
          junctionIndex = 0;
        } else {
          const newIdx = segIdx + 1;
          const newPts = [...r.pts];
          newPts.splice(newIdx, 0, [point[0], point[1]]);
          const shiftedAccMed: Record<string, string> = {};
          if (r.accMed) {
            for (const [key, val] of Object.entries(r.accMed)) {
              const m = key.match(/^accMed(\d+)$/);
              if (!m) continue;
              const idx = parseInt(m[1], 10);
              shiftedAccMed[`accMed${idx >= newIdx ? idx + 1 : idx}`] = val;
            }
          }
          r.pts = newPts;
          r.accMed = shiftedAccMed;
          junctionIndex = newIdx;
        }
      }
      const isIni = junctionIndex === 0;
      const isFin = junctionIndex === r.pts.length - 1;
      if (isIni) {
        r.accesorioInicio = accId;
      } else if (isFin) {
        r.accesorioFin = accId;
      } else {
        if (!r.accMed) r.accMed = {};
        r.accMed[`accMed${junctionIndex}`] = accId;
      }
      eng._markDirty();

      // Sync to hidroData so the sidebar accessories count increments
      try {
        const planId = eng._loadedPlanId;
        if (planId) {
          bumpHidroAccesorio(_net, accId, 1, ramalId, planId);
        }
      } catch {
        /* ignore */
      }
      eng.render();
      // Trigger sidebar refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aparatos-clear'));
        setSelElement({ ...r });
      }
    },
    [engineRef, planosCtx.plans],
  );

  useEffect(() => {
    if (engineRef.current && engineReady && contextMenuCbRef.current)
      engineRef.current.onContextMenu(contextMenuCbRef.current);
  }, [engineReady, engineRef]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.activeNetworks = activeNetworks;
  }, [activeNetworks, engineReady]);

  useEffect(() => {
    if (!engineRef.current || !engineReady) return;
    const eng = engineRef.current;
    const prevId = eng._loadedPlanId;
    if (prevId && prevId !== currentId) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (!loadingPlanRef.current && eng._dirty) {
        const work = eng.saveWork();
        work.ts = Date.now();
        saveToStorage(`trazos_${prevId}`, work);
        eng._dirty = false;
      }
    }
    const resolvedId = currentIdRef.current || currentId || '';
    if (!resolvedId) {
      loadingPlanRef.current = false;
      return;
    }
    eng._loadedPlanId = resolvedId;
    loadingPlanRef.current = true;
    (async () => {
      try {
        const loaded = await loadTrazosForPlan(eng, resolvedId);
        const currentRefId = currentIdRef.current || 'work';
        if (resolvedId !== currentRefId) {
          loadingPlanRef.current = false;
          return;
        }
        if (loaded) {
          const fallbackNet =
            activeNetworks && activeNetworks.size > 0 && !activeNetworks.has('af')
              ? Array.from(activeNetworks)[0]
              : activeNetRef.current || 'af';
          const loadedNet = eng.activeNet || fallbackNet;
          const sm = eng.scaleM;
          setActiveNet(loadedNet);
          if (sm != null) setScaleM(String(sm));
          requestAnimationFrame(() => {
            loadingPlanRef.current = false;
            if (engineRef.current) engineRef.current.render();
          });
        } else if (currentId) {
          eng.ramales = [];
          eng.bajantes = [];
          eng.areas = [];
          eng.dims = [];
          eng.textAnnots = [];
          eng.selId = null;
          eng.activeRamal = null;
          eng.activeArea = null;
          eng.setActiveNet(activeNetRef.current);
          eng.render();
          loadingPlanRef.current = false;
        }
      } catch (e) {
        devError('[LOAD] error', e);
        loadingPlanRef.current = false;
      }
    })();
    syncDrawings();
  }, [currentId, engineReady, syncDrawings]);

  const prevActiveNetForSel = useRef(activeNet);
  if (activeNet !== prevActiveNetForSel.current) {
    prevActiveNetForSel.current = activeNet;
    if (engineRef.current && !loadingPlanRef.current) {
      const els = engineRef.current.getElementsByNet(activeNet);
      if (els.length > 0 && selElement?.net !== activeNet)
        setSelElement(els[els.length - 1] as unknown as ProbedElement);
      else if (els.length === 0) setSelElement(null);
    }
  }

  useEffect(() => {
    syncDrawings();
  }, [planosCtx.plans, currentId, activeNet, syncDrawings]);
  useEffect(() => {
    window.addEventListener('storage', syncDrawings);
    return () => window.removeEventListener('storage', syncDrawings);
  }, [syncDrawings]);

  const [liveActiveNets, setLiveActiveNets] = useState<Set<string> | null>(() => {
    try {
      const saved = loadFromStorage(ACTIVE_NETS_KEY, null);
      if (saved && Array.isArray(saved)) return new Set(saved);
    } catch {}
    return null;
  });

  useEffect(() => {
    const refresh = () => {
      try {
        const saved = loadFromStorage(ACTIVE_NETS_KEY, null);
        setLiveActiveNets(saved && Array.isArray(saved) ? new Set(saved) : null);
      } catch {
        setLiveActiveNets(null);
      }
    };
    window.addEventListener(NETS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(NETS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const finalVisibleNets = useMemo(() => {
    const excludeEquipment = (nets: PlanoNet[]) =>
      nets.filter((n) => n.id !== 'ep' && n.id !== 'bom' && n.id !== 'recolectora');
    const getNets = () => {
      if (activeNetworks && activeNetworks.size > 0)
        return excludeEquipment(NETS.filter((n) => activeNetworks.has(n.id)));
      if (liveActiveNets) return excludeEquipment(NETS.filter((n) => liveActiveNets.has(n.id)));
      return excludeEquipment(NETS);
    };
    return getNets();
  }, [activeNetworks, liveActiveNets]);

  const { saveStatus, doSave, autoSaveTimerRef, markDirty } = usePdfAutoSave(
    engineRef,
    currentIdRef,
    planosCtx.plans,
  );
  markDirtyRef.current = markDirty;
  // ── Inline actions ──
  const syncEngine = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setTool(tool as ToolType);
    eng.setActiveNet(activeNet);
    eng.setTipoTramo(tipoTramo as TramoType);
    eng.setSnap(snapOn);
    eng.setScaleM(scaleM);
    const floorObj = pisos.find((p) => p.n === selectedNivel);
    eng.nivelActual = floorObj
      ? { ...floorObj, label: pisoLbl(floorObj.n), npt: Number(floorObj.npt) }
      : null;
    eng.nptLevels = pisos.map((p) => ({ label: pisoLbl(p.n), npt: Number(p.npt) }));
    const matName =
      activeNet === 'gas'
        ? gasMatSel[activeNet] || GAS[0]?.mat || ''
        : (mats?.[activeNet] && mats[activeNet][0]?.val) || '';
    const d =
      activeNet === 'gas'
        ? diamSel[activeNet] || GAS[0]?.rows[0]?.dn || ''
        : diamSel[activeNet] || '';
    const p =
      activeNet === 'san' || activeNet === 'll'
        ? pendSel[activeNet] !== undefined
          ? pendSel[activeNet]
          : DEFAULT_PENDIENTE_PCT
        : 0;
    eng.setRamalDefaults({ material: matName, diametro: d, pendiente: p });
  }, [
    tool,
    activeNet,
    tipoTramo,
    snapOn,
    scaleM,
    mats,
    diamSel,
    pendSel,
    selectedNivel,
    pisos,
    gasMatSel,
    engineRef,
  ]);

  const handleUndo = useCallback(() => {
    if (engineRef.current) engineRef.current.undoLast();
  }, [engineRef]);
  const handleRedo = useCallback(() => {
    if (engineRef.current) engineRef.current.redoLast();
  }, [engineRef]);
  const handleFit = useCallback(() => {
    const eng = engineRef.current;
    const cw = cwRef.current;
    if (!eng || !cw || !eng.pageW || !eng.pageH) return;
    const pad = 16;
    const availW = cw.clientWidth - pad * 2;
    const availH = cw.clientHeight - pad * 2;
    const sc = Math.min(availW / eng.pageW, availH / eng.pageH);
    eng.zoom = sc;
    eng.offX = (eng.pageW * (1 - sc)) / 2;
    eng.offY = (cw.clientHeight - eng.pageH * sc) / 2;
    eng.render();
    const newScale = Math.max(1, Math.ceil(sc));
    if (newScale !== scale) setScale(newScale);
  }, [engineRef, cwRef, scale, setScale]);

  const handleClear = useCallback(() => {
    if (!engineRef.current) return;
    const netId = activeNet;
    const netName = NETS.find((n) => n.id === netId)?.name || netId;
    setConfirmState({
      isOpen: true,
      title: 'Limpiar red',
      message: `¿Deseas eliminar todo el trazado de la red activa (${netName})? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        engineRef.current?.clearNet(netId);
        setSelElement(null);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, [engineRef, activeNet, setSelElement]);

  const handleSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    doSave();
  }, [autoSaveTimerRef, doSave]);
  const handleSnapToggle = useCallback(() => setSnapOn((prev) => !prev), [setSnapOn]);
  const handleRotateLabel = useCallback(() => {
    if (engineRef.current) engineRef.current.rotateLabelSnap();
  }, [engineRef]);
  const handleUpdateSel = useCallback(
    (field: string, value: unknown) => {
      if (!engineRef.current || !selElement) return;
      const fields = { [field]: value };
      engineRef.current.updateSelected(fields);
      setSelElement({ ...selElement, [field]: fields[field] });
      engineRef.current.render();
    },
    [engineRef, selElement, setSelElement],
  );

  const handleToggleHidden = useCallback(
    (id: string) => {
      const next = new Set(hiddenNets);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setHiddenNets(next);
      if (engineRef.current) engineRef.current.setNetHidden(id, next.has(id));
    },
    [hiddenNets, setHiddenNets, engineRef],
  );

  const handleToggleLocked = useCallback(
    (id: string) => {
      const next = new Set(lockedNets);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setLockedNets(next);
      if (engineRef.current) engineRef.current.setNetLocked(id, next.has(id));
    },
    [lockedNets, setLockedNets, engineRef],
  );

  useEffect(() => {
    syncEngine();
  }, [syncEngine]);

  useEffect(() => {
    if (finalVisibleNets.length === 0) return;
    if (!finalVisibleNets.some((n) => n.id === activeNet)) setActiveNet(finalVisibleNets[0].id);
    setHiddenNets((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of [...next]) {
        if (!finalVisibleNets.some((n) => n.id === id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [finalVisibleNets, activeNet]);

  const prevResetKey = useRef('');
  const resetKey = activeNet + '|' + tipoTramo;
  if (resetKey !== prevResetKey.current) {
    prevResetKey.current = resetKey;
    setPadreTributarioId(null);
    if (engineRef.current) engineRef.current.setPadreTributario(null);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA'
      )
        return;
      if (e.key.toLowerCase() === 'g') {
        setSnapOn((p) => !p);
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'c') {
        setTool('cont');
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'h') {
        setTool('calent');
        e.preventDefault();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (engineRef.current) {
          const eng = engineRef.current;
          if (eng.multiSel && eng.multiSel.length > 0) {
            eng.deleteSelected(eng.multiSel);
            eng.multiSel = [];
          } else if (eng.selId) eng.deleteSelected();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setTool]);

  const prevSelId = useRef(selElement?.id);
  const prevActiveNetForDiam = useRef(activeNet);
  if (selElement?.id !== prevSelId.current || activeNet !== prevActiveNetForDiam.current) {
    prevSelId.current = selElement?.id;
    prevActiveNetForDiam.current = activeNet;
    if (engineRef.current && selElement && selElement.net === activeNet) {
      const diametro = selElement.diametro;
      if (diametro) setDiamSel((prev) => ({ ...prev, [activeNet]: diametro }));
      const pendiente = selElement.pendiente;
      if (pendiente !== undefined) {
        setPendSel((prev) => ({ ...prev, [activeNet]: pendiente }));
        setPendInput(pendiente > 0 ? String(pendiente) : '');
      }
    } else if (!selElement) {
      setDiamSel((prev) => (prev[activeNet] ? { ...prev, [activeNet]: '' } : prev));
      // Mirror the actual default used at ramal-creation time (setRamalDefaults / syncEngine)
      // so the field doesn't show blank while a new san/ll ramal would in fact be drawn at 2%.
      const fallback =
        activeNet === 'san' || activeNet === 'll' ? DEFAULT_PENDIENTE_PCT : undefined;
      const p = pendSel[activeNet] !== undefined ? pendSel[activeNet] : fallback;
      setPendInput(p !== undefined && p > 0 ? String(p) : '');
    }
  }
  const prevSelIdForRender = useRef(selElement?.id);
  if (selElement?.id !== prevSelIdForRender.current) {
    prevSelIdForRender.current = selElement?.id;
    engineRef.current?.render();
  }
  const prevSelForDrawn = useRef(selElement);
  const prevActiveForDrawn = useRef(activeNet);
  if (selElement !== prevSelForDrawn.current || activeNet !== prevActiveForDrawn.current) {
    prevSelForDrawn.current = selElement;
    prevActiveForDrawn.current = activeNet;
    if (engineRef.current) setDrawnElements(engineRef.current.getElementsByNet(activeNet));
  }
  useEffect(() => {
    const c = drawCanvasRef.current;
    if (c) c.style.cursor = tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair';
  }, [tool]);

  const rightSidebarOpacity = useMemo(
    () => ({
      opacity: !selElement ? 0.35 : 1,
      pointerEvents: !selElement ? ('none' as const) : ('auto' as const),
      transition: 'opacity 0.2s',
    }),
    [selElement],
  );

  const scaleText = useMemo(() => {
    const planoAsoc = planos.find((p) => p.nivel === selectedNivel && p.status === 'confirmed');
    if (planoAsoc && planoAsoc.scale) return <span>1:{planoAsoc.scale}</span>;
    const map: Record<string, string> = {
      '0.5': '1:50',
      '0.75': '1:75',
      '1.0': '1:100',
      '1.25': '1:125',
      '2.0': '1:200',
    };
    return <span>{map[scaleM] || '1:100'}</span>;
  }, [selectedNivel, planos, scaleM]);

  const planoAsocInfo = useMemo(() => {
    if (selectedNivel === null) return null;
    const planoAsoc = planos.find((p) => p.nivel === selectedNivel && p.status === 'confirmed');
    if (!planoAsoc) return null;
    return (
      <div
        style={{
          marginTop: 8,
          padding: '6px 10px',
          background: '#1e2024',
          borderRadius: 3,
          border: '1px solid rgba(0,220,229,.2)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: '#00dce5',
            fontFamily: "'Geist',monospace",
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          📄 {planoAsoc.name}
        </div>
        <div
          style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", marginTop: 2 }}
        >
          Escala 1:{planoAsoc.scale}
        </div>
      </div>
    );
  }, [selectedNivel, planos]);

  return (
    <div style={mainContainerStyle}>
      <PdfViewerNetworkBar
        nets={finalVisibleNets}
        activeNet={activeNet}
        hiddenNets={hiddenNets}
        lockedNets={lockedNets}
        onSelectNet={setActiveNet}
        onToggleHidden={handleToggleHidden}
        onToggleLocked={handleToggleLocked}
        scaleText={scaleText}
        onClose={() => {
          handleSave();
          navigate('/civilflowareatrabajo');
        }}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', minWidth: 0 }}>
        <div className="visor-sidebar" style={dynamicLeftStyle}>
          <h2 style={PdfViewer_SR_ONLY}>Panel de capas</h2>
          <div
            style={{
              height: 3,
              flexShrink: 0,
              transition: 'background .3s',
              background: STATUS[saveStatus]?.color || STATUS.error.color,
            }}
          />
          <PdfViewerToolbar
            tool={tool}
            snapOn={snapOn}
            activeNet={activeNet}
            currentFile={currentFile}
            saveStatus={saveStatus}
            collapsed={leftCollapsed}
            onSelectTool={setTool}
            onSnapToggle={handleSnapToggle}
            onFit={handleFit}
            onSave={handleSave}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
          />
        </div>

        <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
          <h2 style={PdfViewer_SR_ONLY}>Visor de planos</h2>
          <PdfCanvas
            cwRef={cwRef}
            containerRef={containerRef}
            pdfCanvasRef={pdfCanvasRef}
            drawCanvasRef={drawCanvasRef}
            currentFile={currentFile}
            error={error}
            loading={loading}
            selectedNivel={selectedNivel}
            pisos={pisos}
            planos={planos}
            tool={tool}
            snapOn={snapOn}
          />
        </div>

        {/* Dialogs */}
        <TextInputOverlay
          textOverlay={textOverlay}
          setTextOverlay={setTextOverlay}
          textInputRef={textInputRef}
        />
        <DrawingElementContextMenu
          contextMenuState={contextMenuState}
          setContextMenuState={setContextMenuState}
          selectedNivel={selectedNivel}
          pisos={pisos}
          engineRef={engineRef}
          selElement={selElement as PlanoElement | null}
          setSelElement={setSelElement}
          lowerFloorsRamales={lowerFloorsRamales}
          planosCtx={planosCtx}
          mats={mats}
          activeNet={activeNet}
          setDiamSel={setDiamSel}
          triggerConfirm={(title, message, onConfirm, confirmLabel) => {
            setConfirmState({
              isOpen: true,
              title,
              message,
              confirmLabel,
              onConfirm: () => {
                onConfirm();
                setConfirmState((prev) => ({ ...prev, isOpen: false }));
              },
            });
          }}
        />
        <ConfirmDialog confirmState={confirmState} setConfirmState={setConfirmState} />
        <CrossFloorGhostPanel
          ghost={selectedCrossFloorGhost}
          engineRef={engineRef}
          onClose={() => {
            setSelectedCrossFloorGhost(null);
            if (engineRef.current) {
              engineRef.current.selectedGhostId = null;
              engineRef.current.render();
            }
          }}
        />
        <AlertDialog
          alertDialogState={alertDialogState}
          setAlertDialogState={setAlertDialogState}
        />
        <AccesorioModal
          modalState={accesorioModal}
          onClose={() => setAccesorioModal((prev) => ({ ...prev, isOpen: false }))}
          onSelect={onAccesorioSelected}
        />

        {/* Sidebar Right */}
        <div className="visor-sidebar-right" style={dynamicRightStyle}>
          <h2 style={PdfViewer_SR_ONLY}>Panel de edición</h2>
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
            <div
              style={{
                fontFamily: "'Geist',monospace",
                fontSize: 12,
                color: '#849495',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Nivel
            </div>
            <select
              aria-label="Seleccionar nivel"
              value={selectedNivel ?? ''}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                const idx =
                  v !== null
                    ? planos.findIndex((p) => p.nivel === v && p.status === 'confirmed')
                    : -1;
                setSelectedNivel(v);
                if (idx >= 0 && onSelectPlan) onSelectPlan(idx);
              }}
              style={PdfViewer_S4}
            >
              <option value="">— Seleccionar piso —</option>
              {pisos
                .toSorted((a, b) => b.n - a.n)
                .map((s) => {
                  const tienePlano = planos.some(
                    (p) => p.nivel === s.n && p.status === 'confirmed',
                  );
                  return (
                    <option key={s.id} value={s.n}>
                      {tienePlano ? '🟢 ' : ''}
                      {pisoLbl(s.n)} ({s.npt} m)
                    </option>
                  );
                })}
            </select>
            {planoAsocInfo}
          </div>

          <CopyFromPlanPanel
            engineRef={engineRef}
            currentId={currentId}
            currentIdRef={currentIdRef}
            planosCtx={planosCtx}
            pisos={pisos}
            visibleNets={finalVisibleNets}
          />

          <TipoTramoSelector
            tipoTramo={tipoTramo}
            setTipoTramo={setTipoTramo}
            padreTributarioId={padreTributarioId}
            setPadreTributarioId={setPadreTributarioId}
            drawnElements={drawnElements}
            engineRef={engineRef}
          />

          <div style={rightSidebarOpacity}>
            <TramoEditor
              selElement={selElement as PlanoElement | null}
              activeNet={activeNet}
              engineRef={engineRef}
              diamSel={diamSel}
              gasMatSel={gasMatSel}
              pendSel={pendSel}
              pendInput={pendInput}
              mats={mats}
              matLongName={matLongName}
              setDiamSel={setDiamSel}
              setGasMatSel={setGasMatSel}
              setPendSel={setPendSel}
              setPendInput={setPendInput}
              setSelElement={setSelElement}
              handleUpdateSel={handleUpdateSel}
              handleRotateLabel={handleRotateLabel}
              plans={planosCtx.plans}
              pisos={pisos}
            />

            <BajanteAsociacion
              selElement={selElement}
              setSelElement={setSelElement}
              selectedNivel={selectedNivel}
              pisoLbl={pisoLbl}
              lowerFloorsRamales={lowerFloorsRamales}
              planosCtx={planosCtx}
              engineRef={engineRef}
              triggerConfirm={(title, message, onConfirm) => {
                setConfirmState({
                  isOpen: true,
                  title,
                  message,
                  onConfirm: () => {
                    onConfirm();
                    setConfirmState((prev) => ({ ...prev, isOpen: false }));
                  },
                });
              }}
            />

            {!(
              selElement &&
              (selElement.tipo === 'bajante' ||
                selElement.tipo === 'montante' ||
                selElement.tipo === 'area' ||
                selElement.id?.startsWith('AR'))
            ) && <AparatosPanel activeNet={activeNet} selElement={selElement} planId={currentId} />}

            <PdfViewerDrawnElements
              drawnElements={drawnElements}
              activeNet={activeNet}
              selElement={selElement}
              engineRef={engineRef}
            />

            <div style={{ flex: 1 }} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          style={{
            ...PdfViewer_S5,
            left: leftCollapsed ? LEFT_COLLAPSED_WIDTH : 180,
            borderLeft: '1px solid #3a494a',
            borderRadius: 3,
            transition: 'left 0.2s ease',
          }}
          title={leftCollapsed ? 'Expandir barra izquierda' : 'Colapsar barra izquierda'}
          aria-label={leftCollapsed ? 'Expandir barra izquierda' : 'Colapsar barra izquierda'}
        >
          {leftCollapsed ? '▶' : '◀'}
        </button>

        <button
          type="button"
          onClick={() => setRightCollapsed(!rightCollapsed)}
          style={{
            ...PdfViewer_S5,
            right: rightCollapsed ? 0 : 210,
            borderRight: rightCollapsed ? '1px solid #3a494a' : 'none',
            borderRadius: 3,
            transition: 'right 0.2s ease',
          }}
          title={rightCollapsed ? 'Expandir barra derecha' : 'Colapsar barra derecha'}
          aria-label={rightCollapsed ? 'Expandir barra derecha' : 'Colapsar barra derecha'}
        >
          {rightCollapsed ? '◀' : '▶'}
        </button>
      </div>
    </div>
  );
}

const PdfViewer = memo(PdfViewer_);
export default PdfViewer;
