/* eslint-disable no-empty */
import { memo, useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import PlanoEngine, {
  type ElementItem,
  type ToolType,
  type TramoType,
} from '../lib/PlanoEngine/PlanoEngine';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import type { PlanoElement } from '../lib/PlanoEngine/PlanoState';
import { aparatoEnExtremoInvalido } from '../lib/PlanoEngine/PlanoEngineDrawing';
import type { Piso } from '../lib/shared/projectTypes';
import type { PlanItem } from '../context/PlansContext';
import { matLongName, pisoLbl, DEFAULT_PENDIENTE_PCT } from '../constants';
import { useProject } from '../context/ProjectContext';
import { usePlans } from '../context/PlansContext';
import { writeSanDrawingSync, writeHydroDrawingSync } from '../utils/drawingSync';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import {
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  ACTIVE_NETS_KEY,
  TRAZOS_PREFIX,
  LAST_TRAZOS_ID_KEY,
  PDF_HIDDEN_NETS_KEY,
  PDF_LOCKED_NETS_KEY,
} from '../constants/storage-keys';
import PdfViewerToolbar, { STATUS } from './pdfViewer/PdfViewerToolbar';
import PdfCanvas from './pdfViewer/PdfCanvas';
import PdfViewerNetworkBar from './pdfViewer/PdfViewerNetworkBar';
import { usePdfAutoSave } from './pdfViewer/usePdfAutoSave';
import { usePdfViewerEngine } from './pdfViewer/PdfViewerEngineInit';
import TextInputOverlay from './pdfViewer/TextInputOverlay';
import DrawingElementContextMenu from './pdfViewer/drawingElementContextMenu';
import type { ContextMenuState } from './pdfViewer/drawingElementContextMenu/context';
import ConfirmDialog from './pdfViewer/ConfirmDialog';
import AccesorioModal from './pdfViewer/AccesorioModal';
import TipoTramoSelector from './pdfViewer/TipoTramoSelector';
import TramoEditor from './pdfViewer/tramoEditor';
import BajanteAsociacion from './pdfViewer/BajanteAsociacion';
import PdfViewerDrawnElements from './pdfViewer/PdfViewerDrawnElements';
import { CopyFromPlanPanel } from './pdfViewer/CopyFromPlanPanel';
import AparatosPanel from './FixturesPanel';
import { validateBeforeClose } from './pdfViewer/closeValidation';
import { applyAccesorioPlacement } from './pdfViewer/accesorioPlacement';
import { useSessionVisorPrefs } from './pdfViewer/useSessionVisorPrefs';
import { useNetColorsInit } from './pdfViewer/useNetColorsInit';
import { useActiveNetsVisibility } from './pdfViewer/useActiveNetsVisibility';
import { useFloorRamales } from './pdfViewer/useFloorRamales';
import { useTrazosLoader } from './pdfViewer/useTrazosLoader';
import { usePlanoLoadSwitch } from './pdfViewer/usePlanoLoadSwitch';
import { useKeyboardShortcuts } from './pdfViewer/useKeyboardShortcuts';
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
// Barra izquierda colapsada conserva una franja estrecha de iconos (herramientas + snap +
// acciones) en vez de desaparecer a 0 — coherente con el render colapsado de la propia
// toolbar en PdfViewerToolbar.tsx.
const LEFT_COLLAPSED_WIDTH = 44;

// Sonda estructural de la unión PlanoElement: permite leer `tipo`/`net`/`diametro`/`pendiente`
// (presentes en unos tipos de elemento, ausentes en otros) sin repetir narrowing con los
// type guards exportados en cada punto de acceso.
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
  onReady?: () => void;
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
  onReady,
}: PdfViewerProps) {
  const navigate = useNavigate();
  const { mats } = useProject();
  const planosCtx = usePlans();
  const plansRef = useRef(planosCtx.plans);
  useEffect(() => {
    plansRef.current = planosCtx.plans;
  }, [planosCtx.plans]);
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
  const { tool, setTool, tipoTramo, setTipoTramo, snapOn, setSnapOn, gridOn, setGridOn } =
    useSessionVisorPrefs();
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

  const [scaleM, setScaleM] = useState('0.5');
  const [selectedNivel, setSelectedNivel] = useState<number | null>(null);
  const syncedNivelForIdRef = useRef<string | number | null>(null);
  const [hiddenNets, setHiddenNets] = useState<Set<string>>(() => {
    try {
      const saved = loadFromStorage<string[] | null>(PDF_HIDDEN_NETS_KEY, null);
      if (saved) return new Set(saved);
    } catch {
      /* ignore */
    }
    return new Set();
  });
  const [lockedNets, setLockedNets] = useState<Set<string>>(() => {
    try {
      const saved = loadFromStorage<string[] | null>(PDF_LOCKED_NETS_KEY, null);
      if (saved) return new Set(saved);
    } catch {
      /* ignore */
    }
    return new Set();
  });

  const [selElement, setSelElement] = useState<ProbedElement | null>(null);
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
  useEffect(() => {
    activeNetRef.current = activeNet;
  }, [activeNet]);
  const activeNetworksRef = useRef(activeNetworks);
  useEffect(() => {
    activeNetworksRef.current = activeNetworks;
  }, [activeNetworks]);

  const currentFile = files[activeIndex]?.file;
  const currentId = files[activeIndex]?.id;
  const currentIdRef = useRef(currentId);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  const engineRef = useRef<PlanoEngine | null>(null);
  const loadingPlanRef = useRef(false);
  const cwRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const { lowerFloorsRamales, upperFloorGroup } = useFloorRamales({
    selElement,
    selectedNivel,
    pisos,
    plans: planosCtx.plans,
    activeNet,
    engineRef,
    currentIdRef,
  });

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
      // Seleccionar la propia línea guía (para su menú contextual de rotar/crear-ramal) no debe
      // sacar al usuario del modo guía — de lo contrario la barra lateral bloqueada reaparece en
      // cuanto interactúa con algo mientras la herramienta está activa.
      if (
        engineRef.current &&
        engineRef.current.tool !== 'sel' &&
        engineRef.current.tool !== 'guide'
      )
        engineRef.current.setTool('sel');
      if (tool !== 'sel' && tool !== 'guide') setTool('sel');
    }
  }, [selElement, tool, setTool]);

  useEffect(() => {
    if (currentId == null) return;
    if (syncedNivelForIdRef.current === currentId) return;
    syncedNivelForIdRef.current = currentId;
    const pl = planos.find((p) => p.id === currentId);
    if (pl && (pl.nivel ?? null) !== (selectedNivel ?? null)) {
      setSelectedNivel(pl.nivel ?? null);
    }
  }, [currentId, planos, selectedNivel]);

  const loadTrazosForPlan = useTrazosLoader({ activeNetRef, setActiveNet, setScaleM });

  const markDirtyRef = useRef<() => void>(() => {});

  // Ítem 2 (rev 2): dedupe de la alerta de estado inviable — el ramal se alerta UNA vez por
  // sesión mientras siga inválido (se rehabilita al corregirse).
  const aparatoFlowAlertedRef = useRef<Set<string>>(new Set());

  const { saveStatus, doSave, autoSaveTimerRef, markDirty } = usePdfAutoSave(
    engineRef,
    currentIdRef,
    planosCtx.plans,
  );
  useEffect(() => {
    markDirtyRef.current = markDirty;
  }, [markDirty]);

  const onDirtyHandler = useCallback(
    (eng: PlanoEngine) => {
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
          // ponytail: single source of truth — sync diamSel immediately so panel & menu dropdowns reflect new diametro without reselection
          const d = (rest as unknown as { diametro?: string }).diametro;
          if (d)
            setDiamSel((prev) => ({
              ...prev,
              [(eng.activeNet || activeNetRef.current || 'af') as string]: d,
            }));
        }
      }
      if (loadingPlanRef.current) return;
      // Ítem 2 (rev 5): un aparato es inviable si su extremo está conectado a la red (T/Y/bajante)
      // o si el flujo va en contra de ese extremo (apunta a la conexión, no al extremo libre).
      // Llega por datos persistidos o por empalmes posteriores al asignar. Se alerta una vez
      // por ramal; al corregirse el estado, el ramal se rehabilita.
      for (const r of eng.ramales) {
        if (aparatoEnExtremoInvalido(eng.ramales, eng.bajantes || [], r)) {
          if (!aparatoFlowAlertedRef.current.has(r.id)) {
            aparatoFlowAlertedRef.current.add(r.id);
            // eslint-disable-next-line no-console
            console.warn('[aparato-flow] inválido canal', r.id, r.label, r.net);
            eng.triggerAlert(
              'Aparato no permitido',
              `El ramal ${r.label || r.id} tiene un aparato en un extremo inválido: está conectado a la red (T/Y/bajante) o el flujo va en su contra. El aparato solo va en el extremo libre hacia el que apunta el flujo. Quita el aparato, invierte la dirección del ramal o muévelo al extremo correcto.`,
            );
          }
        } else {
          aparatoFlowAlertedRef.current.delete(r.id);
        }
      }
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
    },
    [syncDrawings],
  );

  const onDeleteHandler = useCallback(
    (ids: string[]) => {
      const cleanStore = (key: string) => {
        const store = loadFromStorage(key, {}) as Record<string, unknown>;
        let changed = false;
        // Ids actuales tras el borrado+renumerado (el nuevo RS1 ya existe en engine)
        const currentIds = new Set([
          ...(engineRef.current?.ramales.map((r) => r.id) ?? []),
          ...(engineRef.current?.bajantes.map((b) => b.id) ?? []),
          ...(engineRef.current?.ramales.map((r) => r.label) ?? []),
        ]);
        for (const k of Object.keys(store)) {
          const segs = k.split('_');
          const idInKey = segs[1] ?? '';
          for (const id of ids) {
            const isExact = idInKey === id;
            const isTributaryOfDeleted = idInKey.startsWith('T') && idInKey.endsWith(id);
            if ((isExact || isTributaryOfDeleted) && !currentIds.has(idInKey)) {
              // No borrar si el nuevo ramal renumerado ocupa ese mismo id (ej. RS2→RS1)
              // currentIds contiene el nuevo RS1, así que no se borra
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
    [syncDrawings],
  );

  const onRequestTextCb = useCallback((x: number, y: number, cb: (text: string) => void) => {
    setTextOverlay({ x, y, value: '', cb });
    const t = setTimeout(() => textInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // ── Estado de diálogos ──
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
  // ponytail: keep context menu snapshot in sync with engine source of truth for diametro/material etc.
  useEffect(() => {
    if (!contextMenuState?.visible || !contextMenuState.element) return;
    const eng = engineRef.current;
    if (!eng) return;
    const eid = (contextMenuState.element as { id?: string }).id;
    if (!eid) return;
    const fresh =
      eng.ramales.find((r) => r.id === eid) ||
      eng.bajantes.find((b) => b.id === eid) ||
      eng.textAnnots.find((t) => t.id === eid) ||
      eng.areas.find((a) => a.id === eid) ||
      eng.guideLines.find((g) => g.id === eid);
    if (!fresh) return;
    const snap = contextMenuState.element as unknown as Record<string, unknown>;
    const live = fresh as unknown as Record<string, unknown>;
    if (
      snap.diametro !== live.diametro ||
      snap.material !== live.material ||
      snap.accesorioInicio !== live.accesorioInicio ||
      snap.accesorioFin !== live.accesorioFin ||
      snap.aparatoInicio !== live.aparatoInicio ||
      snap.aparatoFin !== live.aparatoFin
    ) {
      setContextMenuState((prev) =>
        prev ? { ...prev, element: { ...fresh } as unknown as typeof prev.element } : null,
      );
    }
  }, [selElement, contextMenuState?.visible, contextMenuState?.element]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [accesorioModal, setAccesorioModal] = useState<{
    isOpen: boolean;
    ramalId: string;
    ramalLabel: string;
    angleDeg: number;
    junctionIndex: number;
    point: number[];
    net: string;
    isTee?: boolean;
  }>({
    isOpen: false,
    ramalId: '',
    ramalLabel: '',
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
  useEffect(() => {
    contextMenuCbRef.current = onContextMenuCb;
  }, [onContextMenuCb]);

  // ── Inicialización del motor ──
  const noopStatus = useCallback(() => {}, []);
  const onSelectHandler = useCallback((el: Record<string, unknown> | null) => {
    setSelElement(el as ProbedElement | null);
  }, []);
  const onAlertHandler = useCallback((title: string, msg: string) => {
    window.dispatchEvent(
      new CustomEvent('civilflow_diametro_validation', { detail: { title, message: msg } }),
    );
  }, []);
  const onAccesorioModalHandler = useCallback(
    (data: {
      ramalId: string;
      angleDeg: number;
      junctionIndex: number;
      point: number[];
      net: string;
      isTee?: boolean;
    }) => {
      // `ramalId` es el id interno crudo (p. ej. el `T${Date.now()}` de un tributario) — nunca
      // pensado para mostrarse. El modal debe mostrar la etiqueta real del ramal (RAF1, T3, ...),
      // igual que en el resto de la UI.
      const target = engineRef.current?.ramales.find((r) => r.id === data.ramalId);
      setAccesorioModal({
        isOpen: true,
        ramalId: data.ramalId,
        ramalLabel: target?.label || data.ramalId,
        angleDeg: data.angleDeg,
        junctionIndex: data.junctionIndex,
        point: data.point,
        net: data.net,
        isTee: data.isTee,
      });
    },
    [],
  );
  const { engineReady } = usePdfViewerEngine({
    currentFile,
    currentId,
    currentIdRef,
    activeNetRef,
    cwRef,
    drawCanvasRef,
    pdfCanvasRef,
    onStatus: noopStatus,
    onDirty: onDirtyHandler,
    onSelect: onSelectHandler,
    onDelete: onDeleteHandler,
    onToolChange: setTool,
    onRequestText: onRequestTextCb,
    onAlert: onAlertHandler,
    onAccesorioModal: onAccesorioModalHandler,
    loadTrazosForPlan,
    setActiveNet,
    setScaleM,
    setLoading,
    setError,
    onReady,
    scale,
    engineRef: engineRef as React.MutableRefObject<PlanoEngine | null>,
    loadingPlanRef,
  });

  // Handler de la selección en el modal de accesorios — actualiza el accesorio del ramal en el
  // motor + hidroData
  const onAccesorioSelected = useCallback(
    (ramalId: string, point: number[], _net: string, accId: string) => {
      const eng = engineRef.current;
      if (!eng) return;
      const updated = applyAccesorioPlacement(eng, ramalId, point, accId, onAlertHandler);
      if (updated && typeof window !== 'undefined') {
        // Refrescar la barra lateral
        window.dispatchEvent(new CustomEvent('aparatos-clear'));
        setSelElement({ ...updated });
      }
    },
    [onAlertHandler],
  );

  useEffect(() => {
    if (engineRef.current && engineReady && contextMenuCbRef.current)
      engineRef.current.onContextMenu(contextMenuCbRef.current);
  }, [engineReady, engineRef]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.activeNetworks = activeNetworks;
  }, [activeNetworks, engineReady]);

  useNetColorsInit();

  usePlanoLoadSwitch({
    engineRef,
    engineReady,
    currentId,
    currentIdRef,
    loadTrazosForPlan,
    syncDrawings,
    autoSaveTimerRef,
    loadingPlanRef,
    activeNetRef,
    activeNetworksRef,
    setActiveNet,
    setScaleM,
  });

  const prevActiveNetForSel = useRef(activeNet);
  useEffect(() => {
    if (activeNet === prevActiveNetForSel.current) return;
    prevActiveNetForSel.current = activeNet;
    if (engineRef.current && !loadingPlanRef.current) {
      // Al cambiar de red, una selección de OTRA red se limpia — nunca se auto-selecciona un
      // elemento de la red nueva (antes se precargaba el ÚLTIMO ramal de la red, que en AF era
      // el tramo auto-creado por el split de la tee: el sidebar mostraba ese ramal "seleccionado"
      // sin que el usuario tocara nada, y volvía a aparecer tras deseleccionar).
      const eng = engineRef.current;
      const sel = eng.getSelected() as { net?: string } | null;
      if (sel && sel.net !== activeNet) {
        eng.selId = null;
        eng._emitSelect(null);
        eng.render();
      }
    }
  }, [activeNet]);

  useEffect(() => {
    syncDrawings();
  }, [planosCtx.plans, currentId, activeNet, syncDrawings]);
  useEffect(() => {
    window.addEventListener('storage', syncDrawings);
    return () => window.removeEventListener('storage', syncDrawings);
  }, [syncDrawings]);
  // Nota: el listener `civilflow_diametro_validation` vive en GlobalAlertDialogProvider en la
  // raíz de la app — permanece montado entre cambios de ruta para que las ediciones de la tabla
  // de diseño siempre muestren su alerta, no solo cuando el visor de PDF está en pantalla.

  const { finalVisibleNets, recolectoraActive } = useActiveNetsVisibility(activeNetworks);

  // ── Acciones en línea ──
  const syncEngine = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setTool(tool as ToolType);
    eng.setActiveNet(activeNet);
    eng.setTipoTramo(tipoTramo as TramoType);
    eng.setSnap(snapOn);
    eng.setGridMode(gridOn);
    eng.setScaleM(scaleM);
    const floorObj = pisos.find((p) => p.n === selectedNivel);
    eng.nivelActual = floorObj
      ? { ...floorObj, label: pisoLbl(floorObj.n), npt: Number(floorObj.npt) }
      : null;
    eng.nptLevels = pisos.map((p) => ({ label: pisoLbl(p.n), npt: Number(p.npt) }));
    // Gas tiene varias opciones reales de material (según MATERIALES_POR_RED) — a diferencia de
    // las redes de un solo material, NO debe pre-rellenar un default silenciosamente; el usuario
    // tiene que elegir uno activamente, igual que haría cualquier otra red multimaterial si
    // tuviera más de una opción canónica.
    const matName =
      activeNet === 'gas'
        ? gasMatSel[activeNet] || ''
        : (mats?.[activeNet] && mats[activeNet][0]?.val) || '';
    // Fix issue #3: tributario no hereda diámetro 4" por defecto — solo inodoro lo requiere
    const dRaw = activeNet === 'gas' ? diamSel[activeNet] || '' : diamSel[activeNet] || '';
    const d = tipoTramo === 'tributario' ? '' : dRaw;
    const p = activeNet === 'san' || activeNet === 'll' ? DEFAULT_PENDIENTE_PCT : 0;
    eng.setRamalDefaults({ material: matName, diametro: d, pendiente: p });
  }, [
    tool,
    activeNet,
    tipoTramo,
    snapOn,
    gridOn,
    scaleM,
    mats,
    diamSel,
    selectedNivel,
    pisos,
    gasMatSel,
    engineRef,
  ]);

  // El Ctrl+Z de teclado lo maneja el propio engine (keydown en document) — este listener
  // limpia las copias congeladas de la UI (menú contextual/panel) tras cada undo/redo.
  useEffect(() => {
    const clearFrozenUi = () => {
      setSelElement(null);
      setContextMenuState(null);
    };
    window.addEventListener('civilflow_undone', clearFrozenUi);
    return () => window.removeEventListener('civilflow_undone', clearFrozenUi);
  }, []);

  const handleUndo = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.undoLast();
      // El menú contextual y el panel muestran COPIAS congeladas del elemento — tras revertir
      // hay que cerrarlas o el usuario sigue viendo el aparato/accesorio que el undo ya quitó.
      setSelElement(null);
      setContextMenuState(null);
    }
  }, [engineRef]);
  const handleRedo = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.redoLast();
      setSelElement(null);
      setContextMenuState(null);
    }
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

  const handleClearGuides = useCallback(() => {
    if (!engineRef.current) return;
    setConfirmState({
      isOpen: true,
      title: 'Borrar líneas guía',
      message:
        '¿Deseas eliminar todas las líneas guía de todos los pisos? Esta acción no se puede deshacer.',
      onConfirm: () => {
        const eng = engineRef.current;
        if (eng) {
          eng.guideLines = [];
          eng.selId = null;
          eng.render();
          eng._markDirty();
        }
        setSelElement(null);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, [engineRef, setSelElement]);

  const handleSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    doSave();
  }, [autoSaveTimerRef, doSave]);
  const handleSnapToggle = useCallback(() => setSnapOn((prev) => !prev), [setSnapOn]);
  const handleGridToggle = useCallback(() => setGridOn((prev) => !prev), [setGridOn]);
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
      saveToStorage(PDF_HIDDEN_NETS_KEY, [...next]);
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
      saveToStorage(PDF_LOCKED_NETS_KEY, [...next]);
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
  useEffect(() => {
    if (resetKey === prevResetKey.current) return;
    prevResetKey.current = resetKey;
    if (engineRef.current) engineRef.current.setPadreTributario(null);
  }, [resetKey]);

  useKeyboardShortcuts({ setSnapOn, setTool, activeNet, recolectoraActive, engineRef });

  const prevSelId = useRef(selElement?.id);
  const prevActiveNetForDiam = useRef(activeNet);
  useEffect(() => {
    if (selElement?.id === prevSelId.current && activeNet === prevActiveNetForDiam.current) return;
    prevSelId.current = selElement?.id;
    prevActiveNetForDiam.current = activeNet;
    if (engineRef.current && selElement && selElement.net === activeNet) {
      const diametro = selElement.diametro;
      if (diametro) setDiamSel((prev) => ({ ...prev, [activeNet]: diametro }));
      const pendiente = selElement.pendiente;
      if (pendiente !== undefined) {
        // Ítem 4 (fix): solo reflejar la pendiente del ramal seleccionado en el INPUT de
        // display — NO la copiamos a pendSel, porque pendSel es el default que DEFAULT_PENDIENTE_PCT
        // (2%) quiere para ramales nuevos, y llevarla aquí hacía que un ramal viejo con 3%
        // contaminara el default de los siguientes. El default de creación es siempre 2% salvo
        // que el usuario escriba otra en el input.
        setPendInput(pendiente > 0 ? String(pendiente) : '');
      }
    } else if (!selElement) {
      setDiamSel((prev) => (prev[activeNet] ? { ...prev, [activeNet]: '' } : prev));
      // Espejo del default real usado al crear el ramal (setRamalDefaults / syncEngine) para que
      // el campo no aparezca vacío cuando un ramal san/ll nuevo se dibujaría de hecho al 2%.
      const fallback =
        activeNet === 'san' || activeNet === 'll' ? DEFAULT_PENDIENTE_PCT : undefined;
      const p = pendSel[activeNet] !== undefined ? pendSel[activeNet] : fallback;
      setPendInput(p !== undefined && p > 0 ? String(p) : '');
    }
  }, [activeNet, pendSel, selElement]);
  const prevSelIdForRender = useRef(selElement?.id);
  useEffect(() => {
    if (selElement?.id === prevSelIdForRender.current) return;
    prevSelIdForRender.current = selElement?.id;
    engineRef.current?.render();
  }, [selElement?.id]);
  const prevSelForDrawn = useRef(selElement);
  const prevActiveForDrawn = useRef(activeNet);
  useEffect(() => {
    if (selElement === prevSelForDrawn.current && activeNet === prevActiveForDrawn.current) return;
    prevSelForDrawn.current = selElement;
    prevActiveForDrawn.current = activeNet;
    if (engineRef.current) setDrawnElements(engineRef.current.getElementsByNet(activeNet));
  }, [activeNet, selElement]);
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
          const eng = engineRef.current;
          if (eng && !validateBeforeClose(eng, planos, onAlertHandler)) return;
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
            gridOn={gridOn}
            activeNet={activeNet}
            currentFile={currentFile}
            saveStatus={saveStatus}
            collapsed={leftCollapsed}
            recolectoraActive={recolectoraActive}
            onSelectTool={setTool}
            onSnapToggle={handleSnapToggle}
            onGridToggle={handleGridToggle}
            onFit={handleFit}
            onSave={handleSave}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            onClearGuides={handleClearGuides}
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

        {/* Diálogos */}
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
          upperFloorGroup={upperFloorGroup}
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
        <AccesorioModal
          modalState={accesorioModal}
          onClose={() => setAccesorioModal((prev) => ({ ...prev, isOpen: false }))}
          onSelect={onAccesorioSelected}
        />

        {/* Barra lateral derecha */}
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

          <TipoTramoSelector tipoTramo={tipoTramo} setTipoTramo={setTipoTramo} />

          {tool !== 'guide' && (
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
                upperFloorGroup={upperFloorGroup}
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
                (selElement.tipo === 'montante' ||
                  selElement.tipo === 'area' ||
                  selElement.id?.startsWith('AR') ||
                  selElement.id?.startsWith('GL'))
              ) && (
                <AparatosPanel
                  activeNet={activeNet}
                  selElement={selElement}
                  setSelElement={setSelElement}
                  planId={currentId}
                  engineRef={engineRef}
                />
              )}

              <PdfViewerDrawnElements
                drawnElements={drawnElements}
                activeNet={activeNet}
                selElement={selElement}
                engineRef={engineRef}
              />

              <div style={{ flex: 1 }} />
            </div>
          )}
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
