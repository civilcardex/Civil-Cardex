/* eslint-disable no-empty */
/**
 * Orquestador del visor de planos: monta el motor (usePdfViewerEngine) y conecta las piezas
 * extraídas en components/pdfViewer/ — persistencia (useViewerPersistence), puente motor↔React
 * (useEngineBridge), menú contextual (useViewerMenus), undo/fit (useViewerShortcuts) y el DOM
 * (ViewerStage). El ORDEN de los efectos de este archivo es el mismo que cuando era el monolito:
 * no reordenar sin repro de visor (la cámara, el re-base de escala y el ciclo de guardado
 * dependen de esa secuencia).
 *
 * Ejemplo: el usuario traza un ramal → el motor emite onDirty → useViewerPersistence marca
 * sucio y persiste el snapshot; 1.5 s después el autosave sube a BD y la franja del toolbar
 * pasa a "Guardado".
 */
import { memo, useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { usePlanoLoadSwitch } from './pdfViewer/usePlanoLoadSwitch.ts';
import { useViewerResponsive } from './pdfViewer/useViewerResponsive.ts';
import { leerPlansMeta, planCalibrado } from '../utils/plansMeta.ts';
import { decideEscalaPorDefectoDelPlan } from '../utils/loadDiagnostics.ts';
import { escalaDeDoc } from '../utils/planScale.ts';
import { useNavigate } from 'react-router-dom';
import PlanoEngine, { type ElementItem } from '../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoElement } from '../lib/PlanoEngine/PlanoState.ts';
import type { Piso } from '../lib/shared/projectTypes.ts';
import type { PlanItem } from '../context/PlansContext.tsx';
import { DEFAULT_PENDIENTE_PCT } from '../constants';
import { useProject } from '../context/ProjectContext.tsx';
import { usePlans } from '../context/PlansContext.tsx';
import {
  writeSanDrawingSync,
  writeHydroDrawingSync,
  setSyncLoadedLiveIds,
} from '../utils/drawingSync.ts';
import { loadFromStorage, getActiveProyectoId } from '../services/storageService.ts';
import { ACTIVE_NETS_KEY } from '../constants/storage-keys.ts';
import { emitAparatosClear, EV_STORAGE } from '../utils/fixtureEvents.ts';

import { useNetVisibilityState } from './pdfViewer/useNetVisibilityState.ts';
import { useViewerDialogs } from './pdfViewer/useViewerDialogs.ts';
import { useViewerToolbarActions } from './pdfViewer/useViewerToolbarActions.ts';
import { validateBeforeClose } from './pdfViewer/closeValidation.ts';
export { validateBeforeClose };
import { sleep } from './shared/sequentialLoad.ts';
import { usePdfViewerEngine } from './pdfViewer/PdfViewerEngineInit.ts';
import { prefetchAllTrazos } from '../utils/prefetchStrokes.ts';
import { applyAccesorioPlacement } from './pdfViewer/fittingPlacement.ts';
import { useSessionVisorPrefs } from './pdfViewer/useSessionViewerPrefs.ts';
import { useNetColorsInit } from './pdfViewer/useNetColorsInit.ts';
import { useActiveNetsVisibility } from './pdfViewer/useActiveNetsVisibility.ts';
import { useFloorRamales } from './pdfViewer/useFloorRamales.ts';
import { useTrazosLoader } from './pdfViewer/useStrokesLoader.ts';
import { useKeyboardShortcuts } from './pdfViewer/useKeyboardShortcuts.ts';
import { useViewerPersistence } from './pdfViewer/useViewerPersistence.ts';
import { useEngineBridge } from './pdfViewer/useEngineBridge.ts';
import { useViewerMenus } from './pdfViewer/useViewerMenus.ts';
import { useViewerShortcuts } from './pdfViewer/useViewerShortcuts.ts';
import ViewerStage, { LEFT_COLLAPSED_WIDTH } from './pdfViewer/ViewerStage.tsx';

const PdfViewer_EMPTY_PISOS: Piso[] = [];

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
  /** Avisa a la página si el visor ya pintó (lámina + trazos + cámara en sitio). */
  onLoadingChange?: (loading: boolean) => void;
  activeIndex: number;
  onSelectPlan: (idx: number) => void;
  onAddPlan: () => void;
  onRemovePlan: (idx: number) => void;
  pisos?: Piso[];
  planos?: PlanItem[];
  activeNetworks: Set<string>;
  onReady?: () => void;
}

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
  onLoadingChange,
}: PdfViewerProps) {
  const navigate = useNavigate();
  const { mats } = useProject();
  const planosCtx = usePlans();
  const plansRef = useRef(planosCtx.plans);
  useEffect(() => {
    plansRef.current = planosCtx.plans;
  }, [planosCtx.plans]);
  const syncDrawings = useCallback(() => {
    // Guard del GC: los ids VIVOS del engine del piso cargado — sin esto, una caché local
    // vieja del piso activo hacía que el GC borrara claves de aparatos/hidro existentes
    // (orig. usuario: recargar reseteaba las UDs del piso 2 a 0).
    const eng = engineRef.current;
    if (eng?._loadedPlanId) {
      setSyncLoadedLiveIds(String(eng._loadedPlanId), [
        ...eng.ramales.flatMap((r) => [r.id, r.label].filter(Boolean) as string[]),
        ...eng.bajantes.flatMap((b) => [b.id, b.code].filter(Boolean) as string[]),
        ...eng.areas.flatMap((a) => [a.id, a.label].filter(Boolean) as string[]),
      ]);
    }
    try {
      writeSanDrawingSync(plansRef.current);
    } catch {}
    try {
      writeHydroDrawingSync(plansRef.current);
    } catch {}
  }, []);
  const [scale] = useState(1);
  // Estado responsive del visor centralizado (umbrales 768/1024 + colapso al cruzar 1024).
  const { isMobile, isNarrow, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed } =
    useViewerResponsive();

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
  // El overlay de página espera a este aviso: el spinner vive hasta que el visor pintó de verdad.
  const onLoadingChangeRef = useRef(onLoadingChange);
  onLoadingChangeRef.current = onLoadingChange;
  useEffect(() => {
    onLoadingChangeRef.current?.(loading);
  }, [loading]);
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
  // Escala única del proyecto: scale/100 del plan calibrado con calGlobal (fuente de verdad
  // para el re-base de pisos que calibraron a mano — incidente cotas distintas por piso).
  const escalaGlobalRef = useRef<number | null>(null);
  useEffect(() => {
    // Fuente ESTABLE: plans_meta en storage (su orden no cambia entre sesiones). El array
    // `planos` se reconstruye distinto según local/nube y el "primer calGlobal" cambiaba
    // de piso entre sesiones → el re-base movía toda la geometría (orig. usuario 2026-10-15).
    try {
      const meta = leerPlansMeta();
      const g = meta.find((m) => m.calGlobal === true && m.origen && m.scale);
      escalaGlobalRef.current = g ? g.scale / 100 : null;
      return;
    } catch {
      /* sin storage: fallback al array */
    }
    const g = planos.find((p) => p.calGlobal === true && p.origen && p.scale);
    escalaGlobalRef.current = g ? g.scale / 100 : null;
  }, [planos]);
  const [selectedNivel, setSelectedNivel] = useState<number | null>(null);
  const syncedNivelForIdRef = useRef<string | number | null>(null);

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
  const cerrandoRef = useRef(false);
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
      // Solo pisos SIN calibración: el set estándar pisaba el scaleM calibrado que vino en
      // los trazos (y el autosave lo persistía pisado — normalización de copias corrupta).
      let calibrado = false;
      try {
        const meta = leerPlansMeta();
        calibrado = plano ? planCalibrado(meta, plano.id) : false;
      } catch {
        /* sin meta: comportamiento previo */
      }
      // Y además: la escala por defecto del plano SOLO se aplica a un piso SIN dibujo.
      // Si el piso ya tiene doc (escala propia) o elementos cargados, su escala manda: pisarla
      // dejaba las cotas leiendo en otra escala y los elementos corridos (orig. usuario: al
      // reingresar, "los elementos aparecen desplazados y las cotas leen menos").
      const eng = engineRef.current;
      const planIdCargado = eng?._loadedPlanId ?? currentIdRef.current ?? null;
      const escalaDoc = planIdCargado != null ? escalaDeDoc(planIdCargado) : null;
      const tieneContenido = !!(
        eng &&
        eng.ramales.length +
          eng.bajantes.length +
          eng.areas.length +
          eng.dims.length +
          eng.textAnnots.length >
          0
      );
      const escalaPlan = plano && plano.scale ? plano.scale / 100 : null;
      if (!calibrado && decideEscalaPorDefectoDelPlan({ escalaDoc, tieneContenido, escalaPlan })) {
        const derived = String(escalaPlan);
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

  const loadTrazosForPlan = useTrazosLoader({
    activeNetRef,
    setActiveNet,
    setScaleM,
    escalaGlobalRef,
  });

  // ── Persistencia: autosave 1.5s, snapshot en cada onDirty, sweep, franja de error de guardado.
  // (useSaveStatusBanner vivía tras el efecto de syncEngine; sus 4 listeners son de eventos
  // globales asíncronos y sin co-oyentes en el visor: registrarlos antes no cambia nada.)
  const { onDirtyHandler, saveStatus, doSave, autoSaveTimerRef, suprimirPorBorrado, bdError } =
    useViewerPersistence({
      engineRef,
      currentIdRef,
      loadingPlanRef,
      activeNetRef,
      syncDrawings,
      plans: planosCtx.plans,
      setDrawnElements,
      setSelElement,
      setDiamSel,
    });

  // ── Puente motor↔React: handlers que el motor invoca + syncEngine (elecciones UI → motor).
  const { onDeleteHandler, noopStatus, onSelectHandler, onAlertHandler, syncEngine } =
    useEngineBridge({
      engineRef,
      syncDrawings,
      suprimirPorBorrado,
      setSelElement,
      tool,
      activeNet,
      tipoTramo,
      snapOn,
      gridOn,
      scaleM,
      setScaleM,
      mats,
      diamSel,
      gasMatSel,
      selectedNivel,
      pisos,
    });

  const onRequestTextCb = useCallback((x: number, y: number, cb: (text: string) => void) => {
    setTextOverlay({ x, y, value: '', cb });
    const t = setTimeout(() => textInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // ── Estado del menú contextual (clic derecho) ──
  const { contextMenuState, setContextMenuState, contextMenuCbRef } = useViewerMenus({
    engineRef,
    selElement,
  });

  const {
    confirmState,
    setConfirmState,
    accesorioModal,
    setAccesorioModal,
    onAccesorioModalHandler,
    triggerConfirm,
  } = useViewerDialogs(engineRef as React.RefObject<PlanoEngine | null>);

  // Grosor de líneas (slider bajo la barra de redes): factor multiplicador de todos los
  // lineWidth del dibujo, persistido por plano (cf_planos.line_width vía serializeWork).
  const [lineWidthScale, setLineWidthScale] = useState(1);
  const { engineReady, hayRasterEnVuelo } = usePdfViewerEngine({
    currentFile,
    files,
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
        emitAparatosClear();
        setSelElement({ ...updated });
      }
    },
    [onAlertHandler],
  );

  useEffect(() => {
    const v = engineRef.current?.lineWidthScale;
    if (v && v > 0) setLineWidthScale(v);
  }, [engineReady, engineRef]);
  useEffect(() => {
    if (engineRef.current && engineReady && contextMenuCbRef.current)
      engineRef.current.onContextMenu(contextMenuCbRef.current);
    // contextMenuCbRef añadido: ref estable (identidad fija) — sin cambio de conducta.
  }, [engineReady, engineRef, contextMenuCbRef]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.activeNetworks = activeNetworks;
  }, [activeNetworks, engineReady]);

  useNetColorsInit();

  // Cambio de PISO en vuelo: velo translúcido sobre el canvas (el overlay grande solo corre
  // en la primera entrada). Estado espejo de loadingPlanRef — lo pide usePlanoLoadSwitch.
  const [cambioPiso, setCambioPiso] = useState(false);
  const handleCambioPiso = useCallback((v: boolean) => setCambioPiso(v), []);

  usePlanoLoadSwitch({
    engineRef,
    engineReady,
    currentId,
    currentIdRef,
    loadTrazosForPlan,
    syncDrawings,
    autoSaveTimerRef,
    loadingPlanRef,
    onCambioPiso: handleCambioPiso,
    hayRasterEnVuelo,
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
        eng.scheduleRender();
      }
    }
  }, [activeNet]);

  useEffect(() => {
    syncDrawings();
  }, [planosCtx.plans, currentId, activeNet, syncDrawings]);
  useEffect(() => {
    window.addEventListener(EV_STORAGE, syncDrawings);
    return () => window.removeEventListener(EV_STORAGE, syncDrawings);
  }, [syncDrawings]);
  // Nota: el listener `civilflow_diametro_validation` vive en GlobalAlertDialogProvider en la
  // raíz de la app — permanece montado entre cambios de ruta para que las ediciones de la tabla
  // de diseño siempre muestren su alerta, no solo cuando el visor de PDF está en pantalla.

  const { finalVisibleNets, recolectoraActive, rejillasActive } =
    useActiveNetsVisibility(activeNetworks);

  const { handleUndo, handleRedo, handleFit, handleRotateLabel } = useViewerShortcuts({
    engineRef,
    setSelElement,
    setContextMenuState,
  });

  const { handleClear, handleClearGuides, handleSave, handleSnapToggle, handleGridToggle } =
    useViewerToolbarActions({
      engineRef: engineRef as React.RefObject<PlanoEngine | null>,
      activeNet,
      setSelElement: setSelElement as (el: ProbedElement | null) => void,
      triggerConfirm,
      doSave,
      autoSaveTimerRef,
      setSnapOn,
      setGridOn,
    });

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

  // Redes ocultas/bloqueadas: estado + persistencia + toggles + restore + prune viven en
  // pdfViewer/useNetVisibilityState (preferencia de dispositivo, no datos del proyecto).
  const { hiddenNets, lockedNets, handleToggleHidden, handleToggleLocked, handleSelectNet } =
    useNetVisibilityState({
      engineRef,
      engineReady,
      finalVisibleNets,
      activeNet,
      setActiveNet,
    });

  useEffect(() => {
    syncEngine();
  }, [syncEngine]);

  const prevResetKey = useRef('');
  const resetKey = activeNet + '|' + tipoTramo;
  useEffect(() => {
    if (resetKey === prevResetKey.current) return;
    prevResetKey.current = resetKey;
    if (engineRef.current) engineRef.current.setPadreTributario(null);
  }, [resetKey]);

  useKeyboardShortcuts({ setSnapOn, setTool, setTipoTramo, setGridOn, engineRef });

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
    engineRef.current?.scheduleRender();
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

  // COTA seleccionada (orig. usuario): sin paneles — la cota no tiene datos hidráulicos
  // ni aparatos; se ocultan TramoEditor y AparatosPanel.
  const esCotaSel = (() => {
    const sel = selElement as { id?: string; tipo?: string } | null;
    return !!sel && !sel.tipo && String(sel.id ?? '').startsWith('D');
  })();
  // Área de sector del módulo Rejillas (NTC 3631): rejillas activa + área dibujada con la
  // pestaña Gas — habilita aparatos de gasodomésticos en el panel derecho.
  const esAreaRejillas =
    !!selElement &&
    rejillasActive &&
    !!selElement.id?.startsWith('AR') &&
    (selElement as { net?: string }).net === 'gas';
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
    if (planoAsoc && planoAsoc.scale) return <span>1:{Math.round(planoAsoc.scale)}</span>;
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
          Escala 1:{Math.round(planoAsoc.scale)}
        </div>
      </div>
    );
  }, [selectedNivel, planos]);

  // Cierre del visor (antes closure inline del onClose de la barra de redes): mismo cuerpo.
  // Deps = todo lo que el cuerpo lee por render (planos/handleSave cambian juntos al refrescar).
  const handleCerrarVisor = useCallback(() => {
    // Idempotente: el doble click no re-dispara el flujo. El prefetch que asegura la
    // caché de TODOS los pisos tiene tope de 4s — una red colgada no bloquea el cierre
    // para siempre (valida con la caché que haya, igual que si el prefetch fallara).
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;
    void (async () => {
      try {
        await Promise.race([prefetchAllTrazos(planos), sleep(4000)]);
      } catch {
        /* validar con la caché que haya */
      }
      const eng = engineRef.current;
      if (eng && !validateBeforeClose(eng, planos, onAlertHandler)) {
        cerrandoRef.current = false;
        return;
      }
      handleSave();
      // Volver con el proyecto en la URL (orig. usuario: se perdía el /:proyectoId).
      {
        const pid = getActiveProyectoId();
        navigate(pid ? `/civilflowareatrabajo/${pid}` : '/civilflowareatrabajo');
      }
    })();
  }, [planos, onAlertHandler, handleSave, navigate]);

  return (
    <ViewerStage
      finalVisibleNets={finalVisibleNets}
      activeNet={activeNet}
      hiddenNets={hiddenNets}
      lockedNets={lockedNets}
      handleSelectNet={handleSelectNet}
      handleToggleHidden={handleToggleHidden}
      handleToggleLocked={handleToggleLocked}
      scaleText={scaleText}
      onCloseNetworkBar={handleCerrarVisor}
      lineWidthScale={lineWidthScale}
      setLineWidthScale={setLineWidthScale}
      isMobile={isMobile}
      isNarrow={isNarrow}
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      setLeftCollapsed={setLeftCollapsed}
      setRightCollapsed={setRightCollapsed}
      dynamicLeftStyle={dynamicLeftStyle}
      dynamicRightStyle={dynamicRightStyle}
      saveStatus={saveStatus}
      bdError={bdError}
      tool={tool}
      tipoTramo={tipoTramo}
      setTipoTramo={setTipoTramo}
      snapOn={snapOn}
      gridOn={gridOn}
      setTool={setTool}
      currentFile={currentFile}
      recolectoraActive={recolectoraActive}
      handleSnapToggle={handleSnapToggle}
      handleGridToggle={handleGridToggle}
      handleFit={handleFit}
      handleSave={handleSave}
      handleUndo={handleUndo}
      handleRedo={handleRedo}
      handleClear={handleClear}
      handleClearGuides={handleClearGuides}
      engineRef={engineRef}
      cwRef={cwRef}
      containerRef={containerRef}
      pdfCanvasRef={pdfCanvasRef}
      drawCanvasRef={drawCanvasRef}
      error={error}
      loading={loading}
      cambioPiso={cambioPiso}
      selectedNivel={selectedNivel}
      pisos={pisos}
      planos={planos}
      textOverlay={textOverlay}
      setTextOverlay={setTextOverlay}
      textInputRef={textInputRef}
      contextMenuState={contextMenuState}
      setContextMenuState={setContextMenuState}
      selElement={selElement}
      setSelElement={setSelElement}
      lowerFloorsRamales={lowerFloorsRamales}
      upperFloorGroup={upperFloorGroup}
      planosCtx={planosCtx}
      mats={mats}
      setDiamSel={setDiamSel}
      triggerConfirm={triggerConfirm}
      confirmState={confirmState}
      setConfirmState={setConfirmState}
      accesorioModal={accesorioModal}
      setAccesorioModal={setAccesorioModal}
      onAccesorioSelected={onAccesorioSelected}
      rightSidebarOpacity={rightSidebarOpacity}
      rejillasActive={rejillasActive}
      esCotaSel={esCotaSel}
      esAreaRejillas={esAreaRejillas}
      currentId={currentId}
      currentIdRef={currentIdRef}
      setSelectedNivel={setSelectedNivel}
      onSelectPlan={onSelectPlan}
      planoAsocInfo={planoAsocInfo}
      diamSel={diamSel}
      gasMatSel={gasMatSel}
      setGasMatSel={setGasMatSel}
      pendSel={pendSel}
      setPendSel={setPendSel}
      pendInput={pendInput}
      setPendInput={setPendInput}
      handleUpdateSel={handleUpdateSel}
      handleRotateLabel={handleRotateLabel}
      loadingPlanRef={loadingPlanRef}
      drawnElements={drawnElements}
    />
  );
}

const PdfViewer = memo(PdfViewer_);
export default PdfViewer;
