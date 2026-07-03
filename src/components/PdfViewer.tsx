/* eslint-disable no-empty, react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/immutability */
import { memo, useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import PlanoEngine from "../lib/PlanoEngine/PlanoEngine";
import { NETS } from "../lib/PlanoEngine/PlanoState";
import { matLongName } from "../constants";
import { useProject } from "../context/ProjectContext";
import { usePlans } from "../context/PlansContext";
import { writeSanDrawingSync, writeHydroDrawingSync } from "../utils/drawingSync";
import { loadFromStorage, saveToStorage, saveTrazosToDB, loadTrazosFromDB } from "../services/storageService";
import { GAS_ACC_KEY, APARATOS_BY_TRAMO_KEY, HYDRO_DATA_STORAGE_KEY } from "../constants/storage-keys";
import PdfViewerToolbar, { STATUS } from "./pdfViewer/PdfViewerToolbar";
import PdfCanvas from "./pdfViewer/PdfCanvas";
import PdfViewerNetworkBar from "./pdfViewer/PdfViewerNetworkBar";
import { usePdfAutoSave } from "./pdfViewer/usePdfAutoSave";
import { usePdfViewerEngine } from "./pdfViewer/PdfViewerEngineInit";
import PdfViewerSidebarRight from "./pdfViewer/PdfViewerSidebarRight";
import PdfViewerDialogs from "./pdfViewer/PdfViewerDialogs";
import { usePdfViewerActions } from "./pdfViewer/PdfViewerActions";



interface PdfViewerProps {
  files: any[];
  activeIndex: number;
  onSelectPlan: (idx: number) => void;
  onAddPlan: () => void;
  onRemovePlan: (idx: number) => void;
  pisos?: any[];
  planos?: any[];
  activeNetworks: Set<string>;
}

const mainContainerStyle: CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
  background: "#111317", border: "1px solid #3a494a", overflow: "hidden",
};
const leftSidebarStyle: CSSProperties = {
  width: 165, flexShrink: 0, display: "flex", flexDirection: "column",
  background: "#14161a", borderRight: "1px solid #3a494a",
  overflowY: "auto", overflowX: "hidden",
};
const rightSidebarStyle: CSSProperties = {
  width: 210, flexShrink: 0, display: "flex", flexDirection: "column",
  background: "#14161a", borderLeft: "1px solid #3a494a",
  overflowY: "auto", overflowX: "hidden",
  transition: 'opacity 0.2s',
};

function PdfViewer_({ files, activeIndex, onSelectPlan, pisos=[], planos=[], activeNetworks }: PdfViewerProps) {
  const { mats } = useProject();
  const planosCtx = usePlans();
  const plansRef = useRef(planosCtx.plans);
  plansRef.current = planosCtx.plans;
  const [scale, setScale] = useState(1);
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 1024);
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth < 1024);

  const dynamicLeftStyle = useMemo(() => ({
    ...leftSidebarStyle,
    width: leftCollapsed ? 0 : 165,
    borderRight: leftCollapsed ? "none" : "1px solid #3a494a",
    overflow: leftCollapsed ? "hidden" : "auto",
    transition: "width 0.2s ease, border-right 0.2s ease",
  }), [leftCollapsed]);

  const dynamicRightStyle = useMemo(() => ({
    ...rightSidebarStyle,
    width: rightCollapsed ? 0 : 210,
    borderLeft: rightCollapsed ? "none" : "1px solid #3a494a",
    overflow: rightCollapsed ? "hidden" : "auto",
    transition: "width 0.2s ease, border-left 0.2s ease",
  }), [rightCollapsed]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState('sel');
  const [activeNet, setActiveNet] = useState(() => {
    if (activeNetworks && activeNetworks.size > 0) {
      if (activeNetworks.has("af")) return "af";
      return Array.from(activeNetworks)[0];
    }
    try {
      const saved = localStorage.getItem('active_nets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(id => id !== 'ep' && id !== 'bom');
          if (valid.length > 0) {
            if (parsed.includes("af")) return "af";
            return valid[0];
          }
        }
      }
    } catch {
      // ignore
    }
    return "af";
  });

  useEffect(() => {
    if (activeNetworks && activeNetworks.size > 0 && !activeNetworks.has(activeNet)) {
      setActiveNet(Array.from(activeNetworks)[0]);
    }
  }, [activeNetworks, activeNet]);

  const [tipoTramo, setTipoTramo] = useState(() => {
    try { return sessionStorage.getItem('civilflow_visor_tipoTramo') || 'ramal'; }
    catch (_) { return 'ramal'; }
  });
  const [padreTributarioId, setPadreTributarioId] = useState<string | null>(null);
  const [snapOn, setSnapOn] = useState(() => {
    try {
      const v = sessionStorage.getItem('civilflow_visor_snapOn');
      return v !== null ? v === 'true' : true;
    } catch (_) { return true; }
  });
  const [scaleM, setScaleM] = useState("0.5");
  const [selectedNivel, setSelectedNivel] = useState<number | null>(null);
  const [hiddenNets, setHiddenNets] = useState<Set<string>>(new Set());
  const [lockedNets, setLockedNets] = useState<Set<string>>(new Set());

  const [selElement, setSelElement] = useState<Record<string, any> | null>(null);
  const [drawnElements, setDrawnElements] = useState<any[]>([]);
  const [diamSel, setDiamSel] = useState<Record<string, string>>({});
  const [gasMatSel, setGasMatSel] = useState<Record<string, string>>({});
  const [pendSel, setPendSel] = useState<Record<string, number>>({});
  const [pendInput, setPendInput] = useState('');
  const [textOverlay, setTextOverlay] = useState<{ x: number; y: number; value: string; cb: (text: string) => void } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const activeNetRef = useRef(activeNet);
  activeNetRef.current = activeNet;

  const [lowerFloorsRamales, setLowerFloorsRamales] = useState<Array<{ planId: string; planName: string; npt: number; ramales: any[]; bajantes: any[] }>>([]);

  useEffect(() => {
    if (!selElement || !(selElement.tipo === 'bajante' || selElement.tipo === 'montante')) return;
    const currentFloor = pisos.find(p => p.n === selectedNivel);
    const currentNpt = currentFloor ? currentFloor.npt : Infinity;

    const relevantPlans = planosCtx.plans.filter((plan: any) => {
      const pF = pisos.find(p => String(p.n) === String(plan.nivel));
      return pF && pF.npt <= currentNpt;
    });

    const results = relevantPlans.map((plan: any) => {
      const pF = pisos.find(p => String(p.n) === String(plan.nivel))!;
      let ramales: any[] = [];
      let bajantes: any[] = [];
      if (plan.id === currentIdRef.current) {
        ramales = engineRef.current?.ramales?.filter((r: any) => r.tipo !== 'tributario' && r.net === (selElement.net || activeNet)) || [];
        bajantes = engineRef.current?.bajantes?.filter((b: any) => b.net === (selElement.net || activeNet)) || [];
      } else {
        const raw = localStorage.getItem('civilflow_trazos_' + plan.id);
        if (raw) {
          try {
            const data = JSON.parse(raw);
            ramales = (data.ramales || []).filter((r: any) => r.tipo !== 'tributario' && r.net === (selElement.net || activeNet));
            bajantes = (data.bajantes || []).filter((b: any) => b.net === (selElement.net || activeNet));
          } catch {
            // ignore
          }
        }
      }
      return { planId: plan.id, planName: plan.name, npt: pF.npt, ramales, bajantes };
    });

    results.sort((a, b) => b.npt - a.npt);
    setLowerFloorsRamales(results);
  }, [selElement?.id, selectedNivel, pisos, planosCtx.plans, activeNet]);

  useEffect(() => { try { sessionStorage.setItem('civilflow_visor_tool', tool); } catch (_) {} }, [tool]);
  useEffect(() => { try { sessionStorage.setItem('civilflow_visor_tipoTramo', tipoTramo); } catch (_) {} }, [tipoTramo]);
  useEffect(() => { try { sessionStorage.setItem('civilflow_visor_snapOn', String(snapOn)); } catch (_) {} }, [snapOn]);

  useEffect(() => {
    if (selectedNivel !== null) {
      const plano = planos.find(p => p.nivel === selectedNivel && p.status === 'confirmed');
      if (plano && plano.scale) {
        const derived = String(plano.scale / 100);
        if (['0.5', '0.75', '1', '1.25', '2'].includes(derived)) {
          setScaleM(derived);
          if (engineRef.current) engineRef.current.setScaleM(derived);
        }
      }
    }
  }, [selectedNivel, planos]);

  useEffect(() => {
    if (selElement?.net) {
      setActiveNet(selElement.net);
    }
    if (selElement?.id) {
      if (engineRef.current && engineRef.current.tool !== 'sel') {
        engineRef.current.setTool('sel');
      }
      if (tool !== 'sel') {
        setTool('sel');
      }
    }
  }, [selElement]);

  const currentFile = files[activeIndex]?.file;
  const currentId = files[activeIndex]?.id;
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;

  useEffect(() => {
    if (currentId == null) return;
    const pl = planos.find(p => p.id === currentId);
    if (pl && (pl.nivel ?? null) !== (selectedNivel ?? null)) {
      setSelectedNivel(pl.nivel ?? null);
    }
  }, [currentId, planos]);

  const cwRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Engine callbacks (defined before usePdfViewerEngine, no engineRef needed) ──

  const loadTrazosForPlan = useCallback(async (eng: PlanoEngine, resolvedId: string): Promise<boolean> => {
    const tryLoad = (id: string): any => {
      const key = `trazos_${id}`;
      const saved = loadFromStorage(key, null);
      return saved || null;
    };
    const localData = tryLoad(resolvedId);

    let initiallyLoaded = false;
    if (localData) {
      const workStr = typeof localData === 'string' ? localData : JSON.stringify(localData);
      eng.loadWork(workStr);
      initiallyLoaded = true;
      requestAnimationFrame(() => { eng.render(); });
    }

    try {
      const dbData = await loadTrazosFromDB(resolvedId);

      if (dbData) {
        const dbTs = Number(dbData.ts || 0);
        const localTs = Number(localData?.ts || 0);

        if (dbTs > localTs || !localData) {
          const workStr = typeof dbData === 'string' ? dbData : JSON.stringify(dbData);
          eng.loadWork(workStr);
          if (!localData || dbTs > localTs) {
            saveToStorage(`trazos_${resolvedId}`, dbData);
          }
          requestAnimationFrame(() => { eng.render(); });
          initiallyLoaded = true;

          const loadedNet = eng.activeNet || activeNetRef.current || 'af';
          const sm = eng.scaleM;
          setActiveNet(loadedNet);
          if (sm != null) setScaleM(String(sm));
        } else if (localTs > dbTs && localData) {
          saveTrazosToDB(resolvedId, localData);
        }
      } else if (localData) {
        saveTrazosToDB(resolvedId, localData);
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('[LOAD] Supabase error/sync error:', e);
    }

    return initiallyLoaded;
  }, []);

  const onDirtyHandler = useCallback((eng: PlanoEngine) => {
    setDrawnElements(eng.getElementsByNet(activeNetRef.current || 'af'));

    if (eng.selId) {
      const sel = eng.getSelected();
      if (sel) {
        const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = sel as any;
        setSelElement(rest);
      }
    }

    if (loadingPlanRef.current) return;
    try {
      const id = eng._loadedPlanId || currentIdRef.current || 'work';
      if (id) {
        const work = eng.saveWork() as any;
        work.ts = Date.now();
        saveToStorage(`trazos_${id}`, work);
        if (id !== 'work') {
          saveToStorage('last_tracos_id', id);
          saveTrazosToDB(id, work);
        }
      }
    } catch (_) {}
    try { writeSanDrawingSync(plansRef.current); } catch (_) {}
    try { writeHydroDrawingSync(plansRef.current); } catch (_) {}
  }, []);

  const onDeleteHandler = useCallback((ids: string[]) => {
    const cleanStore = (key: string) => {
      const store = loadFromStorage(key, {}) as Record<string, any>;
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
    try { writeSanDrawingSync(plansRef.current); } catch (_) {}
    try { writeHydroDrawingSync(plansRef.current); } catch (_) {}
  }, [plansRef]);

  const onRequestTextCb = useCallback((x: number, y: number, cb: (text: string) => void) => {
    setTextOverlay({ x, y, value: '', cb });
    setTimeout(() => textInputRef.current?.focus(), 50);
  }, []);

  // ── Dialog state registration ──

  const contextMenuCbRef = useRef<any>(null);
  const setConfirmStateRef = useRef<React.Dispatch<React.SetStateAction<any>>>(() => {});
  const setAlertDialogStateRef = useRef<React.Dispatch<React.SetStateAction<any>>>(() => {});

  const onRegisterContextMenu = useCallback((cb: any) => { contextMenuCbRef.current = cb; }, []);
  const onRegisterSetConfirmState = useCallback((setter: any) => { setConfirmStateRef.current = setter; }, []);
  const onRegisterSetAlertDialogState = useCallback((setter: any) => { setAlertDialogStateRef.current = setter; }, []);

  const safeSetConfirmState = useCallback((state: any) => { setConfirmStateRef.current(state); }, []);
  const safeSetAlertDialogState = useCallback((state: any) => { setAlertDialogStateRef.current(state); }, []);

  const onAlert = useCallback((title: string, msg: string) => {
    safeSetAlertDialogState({ isOpen: true, title, message: msg });
  }, [safeSetAlertDialogState]);

  // ── Engine init ──

  const {
    engineRef,
    engineReady,
    loadingPlanRef,
  } = usePdfViewerEngine({
    currentFile,
    currentId,
    currentIdRef,
    activeNetRef,
    cwRef,
    drawCanvasRef,
    pdfCanvasRef,
    onStatus: () => {},
    onDirty: onDirtyHandler,
    onSelect: setSelElement,
    onDelete: onDeleteHandler,
    onToolChange: setTool,
    onRequestText: onRequestTextCb,
    onAlert,
    loadTrazosForPlan,
    setActiveNet,
    setScaleM,
    setLoading,
    setError,
    scale,
  });

  // ── Register context menu with engine ──

  useEffect(() => {
    if (engineRef.current && engineReady) {
      engineRef.current.onContextMenu(contextMenuCbRef.current);
    }
  }, [engineReady, engineRef]);

  useEffect(() => {
    if (engineRef.current) {
      (engineRef.current as any).activeNetworks = activeNetworks;
    }
  }, [activeNetworks, engineRef.current]);

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
        const work = eng.saveWork() as any;
        work.ts = Date.now();
        saveToStorage(`trazos_${prevId}`, work);
        eng._dirty = false;
      }
    }

    const resolvedId = currentIdRef.current || currentId || '';
    if (!resolvedId) { loadingPlanRef.current = false; return; }
    eng._loadedPlanId = resolvedId;

    loadingPlanRef.current = true;
    (async () => {
      try {
        const loaded = await loadTrazosForPlan(eng, resolvedId);
        const currentRefId = currentIdRef.current || 'work';
        if (resolvedId !== currentRefId) { loadingPlanRef.current = false; return; }

        if (loaded) {
          const fallbackNet = activeNetworks && activeNetworks.size > 0 && !activeNetworks.has("af")
            ? Array.from(activeNetworks)[0]
            : (activeNetRef.current || 'af');
          const loadedNet = eng.activeNet || fallbackNet;
          const sm = eng.scaleM;
          setActiveNet(loadedNet);
          if (sm != null) setScaleM(String(sm));
          requestAnimationFrame(() => { loadingPlanRef.current = false; if (engineRef.current) engineRef.current.render(); });
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
      } catch (e) { if (import.meta.env.DEV) console.error('[LOAD] error', e); loadingPlanRef.current = false; }
    })();

    try { writeSanDrawingSync(plansRef.current); } catch (_) {}
    try { writeHydroDrawingSync(plansRef.current); } catch (_) {}
  }, [currentId, engineReady]);

  useEffect(() => {
    if (!engineRef.current) return;
    if (loadingPlanRef.current) return;
    const els = engineRef.current.getElementsByNet(activeNet);
    if (els.length > 0 && selElement?.net !== activeNet) {
      setSelElement(els[els.length - 1]);
    } else if (els.length === 0) {
      setSelElement(null);
    }
  }, [activeNet]);

  useEffect(() => {
    try { writeSanDrawingSync(plansRef.current); } catch { /* ignore */ }
    try { writeHydroDrawingSync(plansRef.current); } catch { /* ignore */ }
  }, [planosCtx.plans, currentId, activeNet]);

  useEffect(() => {
    const handler = () => {
      try { writeSanDrawingSync(plansRef.current); } catch { /* ignore */ }
      try { writeHydroDrawingSync(plansRef.current); } catch { /* ignore */ }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [planosCtx.plans]);

  const [liveActiveNets, setLiveActiveNets] = useState<Set<string> | null>(() => {
    try {
      const saved = loadFromStorage('active_nets', null);
      if (saved && Array.isArray(saved)) return new Set(saved);
    } catch {
      // ignore
    }
    return null;
  });

  useEffect(() => {
    const refresh = () => {
      try {
        const saved = loadFromStorage('active_nets', null);
        setLiveActiveNets(saved && Array.isArray(saved) ? new Set(saved) : null);
      } catch (_) {
        setLiveActiveNets(null);
      }
    };
    window.addEventListener('civilflow_nets_changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('civilflow_nets_changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const finalVisibleNets = useMemo(() => {
    const excludeEquipment = (nets: any[]) => nets.filter((n: any) => n.id !== 'ep' && n.id !== 'bom');
    const getNets = () => {
      if (activeNetworks && activeNetworks.size > 0) return excludeEquipment(NETS.filter(n => activeNetworks.has(n.id)));
      if (liveActiveNets) return excludeEquipment(NETS.filter(n => liveActiveNets.has(n.id)));
      return excludeEquipment(NETS);
    };
    return getNets();
  }, [activeNetworks, liveActiveNets]);

  const { saveStatus, doSave, autoSaveTimerRef } = usePdfAutoSave(engineRef, currentIdRef, planosCtx.plans);

  // ── UI Actions (needs engineRef from usePdfViewerEngine) ──

  const actions = usePdfViewerActions({
    engineRef,
    activeNet,
    selElement,
    setSelElement,
    setConfirmState: safeSetConfirmState,
    setScale,
    setSnapOn,
    pisos,
    selectedNivel,
    tool,
    tipoTramo,
    snapOn,
    scaleM,
    mats,
    diamSel,
    gasMatSel,
    pendSel,
    hiddenNets,
    lockedNets,
    autoSaveTimerRef,
    doSave,
    scale,
    cwRef,
    setHiddenNets,
    setLockedNets,
  });

  useEffect(() => { actions.syncEngine(); }, [actions.syncEngine]);

  useEffect(() => {
    if (finalVisibleNets.length === 0) return;
    if (!finalVisibleNets.some((n: any) => n.id === activeNet)) {
      setActiveNet(finalVisibleNets[0].id);
    }
    setHiddenNets(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const id of [...next]) {
        if (!finalVisibleNets.some(n => n.id === id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [finalVisibleNets, activeNet]);

  useEffect(() => {
    setPadreTributarioId(null);
    if (engineRef.current)   engineRef.current!.setPadreTributario(null as any);
  }, [activeNet, tipoTramo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'g') { setSnapOn(p => !p); e.preventDefault(); }
      if (e.key.toLowerCase() === 'c') { setTool('cont'); e.preventDefault(); }
      if (e.key.toLowerCase() === 'h') { setTool('calent'); e.preventDefault(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (engineRef.current) {
          const eng = engineRef.current;
          if (eng.multiSel && eng.multiSel.length > 0) {
            eng.deleteSelected(eng.multiSel);
            eng.multiSel = [];
          } else if (eng.selId) {
            eng.deleteSelected();
          }
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setTool]);

  useEffect(() => {
    if (!engineRef.current) return;
    setDrawnElements(engineRef.current.getElementsByNet(activeNet));
  }, [selElement, activeNet]);

  useEffect(() => {
    const c = drawCanvasRef.current;
    if (c) {
      c.style.cursor = tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair';
    }
  }, [tool]);

  useEffect(() => {
    if (selElement && selElement.net === activeNet && engineRef.current) {
      if (selElement.diametro) {
        setDiamSel(prev => ({ ...prev, [activeNet]: selElement.diametro }));
      }
      if (selElement.pendiente !== undefined) {
        setPendSel(prev => ({ ...prev, [activeNet]: selElement.pendiente }));
        setPendInput(selElement.pendiente > 0 ? String(selElement.pendiente) : '');
      }
      engineRef.current.render();
    } else if (!selElement) {
      const p = pendSel[activeNet];
      setPendInput(p !== undefined && p > 0 ? String(p) : '');
    }
  }, [selElement?.id, activeNet]);

  const rightSidebarOpacity = useMemo(() => ({
    opacity: (tool === 'sel' && !selElement) ? 0.35 : 1,
    pointerEvents: (tool === 'sel' && !selElement) ? ('none' as const) : ('auto' as const),
    transition: 'opacity 0.2s',
  }), [tool, selElement]);

  const scaleText = useMemo(() => {
    const planoAsoc = planos.find(p => p.nivel === selectedNivel && p.status === 'confirmed');
    if (planoAsoc && planoAsoc.scale) return <span>1:{planoAsoc.scale}</span>;
    const map: Record<string, string> = {'0.5':'1:50','0.75':'1:75','1.0':'1:100','1.25':'1:125','2.0':'1:200'};
    return <span>{map[scaleM] || '1:100'}</span>;
  }, [selectedNivel, planos, scaleM]);

  return (
    <div style={mainContainerStyle}>
      <PdfViewerNetworkBar
        nets={finalVisibleNets}
        activeNet={activeNet}
        hiddenNets={hiddenNets}
        lockedNets={lockedNets}
        onSelectNet={setActiveNet}
        onToggleHidden={actions.handleToggleHidden}
        onToggleLocked={actions.handleToggleLocked}
      />

      <div style={{flex:1,display:"flex",minHeight:0,position:"relative",minWidth:0}}>

      <div className="visor-sidebar" style={dynamicLeftStyle}>
        <h2 style={{position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}}>Panel de capas</h2>
        <div style={{
          height: 3, flexShrink: 0, transition: 'background .3s',
          background: STATUS[saveStatus]?.color || STATUS.error.color,
        }} />
        <PdfViewerToolbar
          tool={tool}
          snapOn={snapOn}
          activeNet={activeNet}
          currentFile={currentFile}
          saveStatus={saveStatus}
          onSelectTool={setTool}
           onSnapToggle={actions.handleSnapToggle}
          onFit={actions.handleFit}
          onSave={actions.handleSave}
          onUndo={actions.handleUndo}
          onClear={actions.handleClear}
          engineRef={engineRef}
          currentIdRef={currentIdRef}
          currentId={currentId}
          plansRef={plansRef}
        />
      </div>

      <div style={{position:'relative',flex:1,display:'flex',minHeight:0,minWidth:0}}>
        <h2 style={{position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}}>Visor de planos</h2>
      <PdfCanvas
          cwRef={cwRef}
          containerRef={containerRef}
          pdfCanvasRef={pdfCanvasRef}
          drawCanvasRef={drawCanvasRef}
          currentFile={currentFile}
          error={error as any}
          loading={loading}
          selectedNivel={selectedNivel}
          pisos={pisos}
          planos={planos}
          tool={tool}
          snapOn={snapOn}
      />
      </div>

      <PdfViewerDialogs
        engineRef={engineRef}
        selElement={selElement}
        setSelElement={setSelElement}
        selectedNivel={selectedNivel}
        pisos={pisos}
        lowerFloorsRamales={lowerFloorsRamales}
        planosCtx={planosCtx}
        mats={mats}
        activeNet={activeNet}
        setDiamSel={setDiamSel}
        textOverlay={textOverlay}
        setTextOverlay={setTextOverlay}
        textInputRef={textInputRef}
        onRegisterContextMenu={onRegisterContextMenu}
        onRegisterSetConfirmState={onRegisterSetConfirmState}
        onRegisterSetAlertDialogState={onRegisterSetAlertDialogState}
      />

      <PdfViewerSidebarRight
        dynamicRightStyle={dynamicRightStyle}
        selectedNivel={selectedNivel}
        onSelectNivel={(v, idx) => {
          setSelectedNivel(v);
          if (idx >= 0 && onSelectPlan) onSelectPlan(idx);
        }}
        pisos={pisos}
        planos={planos}
        rightSidebarOpacity={rightSidebarOpacity}
        tipoTramo={tipoTramo}
        setTipoTramo={setTipoTramo}
        padreTributarioId={padreTributarioId}
        setPadreTributarioId={setPadreTributarioId}
        drawnElements={drawnElements}
        engineRef={engineRef}
        selElement={selElement}
        activeNet={activeNet}
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
        handleUpdateSel={actions.handleUpdateSel}
        handleRotateLabel={actions.handleRotateLabel}
        lowerFloorsRamales={lowerFloorsRamales}
        planosCtx={planosCtx}
        scaleText={scaleText}
        currentId={currentId}
        currentIdRef={currentIdRef}
        finalVisibleNets={finalVisibleNets}
      />

      {/* Left Sidebar Toggle Button */}
      <button
        onClick={() => setLeftCollapsed(!leftCollapsed)}
        style={{
          position: "absolute",
          left: leftCollapsed ? 0 : 165,
          top: 0,
          zIndex: 40,
          width: 16,
          height: 24,
          background: "#14161a",
          border: "1px solid #3a494a",
          borderLeft: leftCollapsed ? "1px solid #3a494a" : "none",
          borderRadius: "0 0 3px 0",
          color: "#849495",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          fontSize: 8,
          transition: "left 0.2s ease",
        }}
        title={leftCollapsed ? "Expandir barra izquierda" : "Colapsar barra izquierda"}
        aria-label={leftCollapsed ? "Expandir barra izquierda" : "Colapsar barra izquierda"}
      >
        {leftCollapsed ? "▶" : "◀"}
      </button>

      {/* Right Sidebar Toggle Button */}
      <button
        onClick={() => setRightCollapsed(!rightCollapsed)}
        style={{
          position: "absolute",
          right: rightCollapsed ? 0 : 210,
          top: 0,
          zIndex: 40,
          width: 16,
          height: 24,
          background: "#14161a",
          border: "1px solid #3a494a",
          borderRight: rightCollapsed ? "1px solid #3a494a" : "none",
          borderRadius: "0 0 0 3px",
          color: "#849495",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          fontSize: 8,
          transition: "right 0.2s ease",
        }}
        title={rightCollapsed ? "Expandir barra derecha" : "Colapsar barra derecha"}
        aria-label={rightCollapsed ? "Expandir barra derecha" : "Colapsar barra derecha"}
      >
        {rightCollapsed ? "◀" : "▶"}
      </button>

      </div>

    </div>
  );
}

const PdfViewer = memo(PdfViewer_);
export default PdfViewer;
