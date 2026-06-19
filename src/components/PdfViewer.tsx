import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import PlanoEngine, { NETS } from "../lib/PlanoEngine";
import { pisoLbl, matLongName, GAS, DIAM_BAN, DIAM_BY_MAT } from "../constants";
import { useProject } from "../context/ProjectContext";
import { usePlans } from "../context/PlansContext";
import { writeSanDrawingSync, writeHydroDrawingSync } from "../utils/drawingSync";
import { loadFromStorage, saveToStorage, saveTrazosToDB, loadTrazosFromDB } from "../services/storageService";
import { APARATOS_BY_TRAMO_KEY, HYDRO_DATA_STORAGE_KEY, GAS_ACC_KEY } from "../constants/storage-keys";
import AparatosPanel from "./FixturesPanel";
import PdfViewerToolbar from "./pdfViewer/PdfViewerToolbar";
import PdfCanvas from "./pdfViewer/PdfCanvas";
import TramoEditor, { DIAM_DEFAULT_BY_NET } from "./pdfViewer/TramoEditor";
import PdfViewerNetworkBar from "./pdfViewer/PdfViewerNetworkBar";
import { usePdfAutoSave } from "./pdfViewer/usePdfAutoSave";
import { usePdfViewerEngine } from "./pdfViewer/PdfViewerEngineInit";
import PdfViewerDrawnElements from "./pdfViewer/PdfViewerDrawnElements";

const TIPOS_TRAMO = [
  { id: "ramal", label: "Ramal" },
  { id: "tributario", label: "Tributario" },
];


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

export default function PdfViewer({ files, activeIndex, onSelectPlan, onAddPlan, onRemovePlan, pisos=[], planos=[], activeNetworks }: PdfViewerProps) {
  const { mats } = useProject();
  const planosCtx = usePlans();
  const plansRef = useRef(planosCtx.plans);
  plansRef.current = planosCtx.plans;
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
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
    } catch (_) {}
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
  const [statusMsg, setStatusMsg] = useState("Seleccionar");
  const [selElement, setSelElement] = useState<Record<string, any> | null>(null);
  const [drawnElements, setDrawnElements] = useState<any[]>([]);
  const [diamSel, setDiamSel] = useState<Record<string, string>>({});
  const [gasMatSel, setGasMatSel] = useState<Record<string, string>>({});
  const [pendSel, setPendSel] = useState<Record<string, number>>({});
  const [pendInput, setPendInput] = useState('');
  const [textOverlay, setTextOverlay] = useState<{ x: number; y: number; value: string; cb: (text: string) => void } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const activeNetRef = useRef(activeNet);
  activeNetRef.current = activeNet;

  const [lowerFloorsRamales, setLowerFloorsRamales] = useState<Array<{ planId: string; planName: string; npt: number; ramales: any[] }>>([]);

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
      if (plan.id === currentIdRef.current) {
        ramales = engineRef.current?.ramales?.filter((r: any) => r.tipo !== 'tributario' && r.net === (selElement.net || activeNet)) || [];
      } else {
        const raw = localStorage.getItem('civilflow_trazos_' + plan.id);
        if (raw) {
          try {
            const data = JSON.parse(raw);
            ramales = (data.ramales || []).filter((r: any) => r.tipo !== 'tributario' && r.net === (selElement.net || activeNet));
          } catch (_) {}
        }
      }
      return { planId: plan.id, planName: plan.name, npt: pF.npt, ramales };
    });

    results.sort((a, b) => b.npt - a.npt);
    setLowerFloorsRamales(results);
  }, [selElement?.id, selectedNivel, pisos, planosCtx.plans, activeNet]);

  useEffect(() => { try { sessionStorage.setItem('civilflow_visor_tool', tool); } catch (_) {} }, [tool]);
  useEffect(() => { try { sessionStorage.setItem('civilflow_visor_tipoTramo', tipoTramo); } catch (_) {} }, [tipoTramo]);
  useEffect(() => { try { sessionStorage.setItem('civilflow_visor_snapOn', String(snapOn)); } catch (_) {} }, [snapOn]);

  const [contextMenuState, setContextMenuState] = useState<{ visible: boolean; x: number; y: number; bajante: any; isGhostClick?: boolean; ramalEndpoint?: { idx: number; x: number; y: number } | null } | null>(null);
  const [confirmState, setConfirmState] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  const onContextMenuCb = useCallback((bajante: any, x: number, y: number, isGhostClick?: boolean, ramalEndpoint?: { idx: number; x: number; y: number } | null) => {
    setContextMenuState({ visible: true, x, y, bajante, isGhostClick, ramalEndpoint });
  }, []);

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
    if (pageNumber < 1) return;
    setPageNumber(1);
  }, [currentId]);

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
    const idSet = new Set(ids);
    const cleanStore = (key: string, suffix: boolean) => {
      const store = loadFromStorage(key, {}) as Record<string, any>;
      let changed = false;
      for (const k of Object.keys(store)) {
        const match = suffix ? k.split('_').pop() : k;
        if (match && idSet.has(match)) {
          delete store[k];
          changed = true;
        }
      }
      if (changed) saveToStorage(key, store);
    };
    cleanStore(APARATOS_BY_TRAMO_KEY, true);
    cleanStore(HYDRO_DATA_STORAGE_KEY, true);
    cleanStore(GAS_ACC_KEY, false);
    window.dispatchEvent(new CustomEvent('aparatos-clear', { detail: { ids } }));
  }, []);

  const onRequestTextCb = useCallback((x: number, y: number, cb: (text: string) => void) => {
    setTextOverlay({ x, y, value: '', cb });
    setTimeout(() => textInputRef.current?.focus(), 50);
  }, []);

  const {
    engineRef,
    numPages,
    engineReady,
    renderPage,
    mountId,
    loadingPlanRef,
  } = usePdfViewerEngine({
    currentFile,
    currentId,
    currentIdRef,
    activeNetRef,
    cwRef,
    drawCanvasRef,
    pdfCanvasRef,
    onStatus: setStatusMsg,
    onDirty: onDirtyHandler,
    onSelect: setSelElement,
    onDelete: onDeleteHandler,
    onToolChange: setTool,
    onRequestText: onRequestTextCb,
    loadTrazosForPlan,
    setActiveNet,
    setScaleM,
    setLoading,
    setError,
    scale,
  });

  useEffect(() => {
    if (engineRef.current && engineReady) {
      engineRef.current.onContextMenu(onContextMenuCb);
    }
  }, [engineReady, onContextMenuCb]);

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
    try { writeSanDrawingSync(plansRef.current); } catch (_) {}
    try { writeHydroDrawingSync(plansRef.current); } catch (_) {}
  }, [planosCtx.plans, currentId, activeNet]);

  useEffect(() => {
    const handler = () => {
      try { writeSanDrawingSync(plansRef.current); } catch (_) {}
      try { writeHydroDrawingSync(plansRef.current); } catch (_) {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [planosCtx.plans]);

  const [liveActiveNets, setLiveActiveNets] = useState<Set<string> | null>(() => {
    try {
      const saved = loadFromStorage('active_nets', null);
      if (saved && Array.isArray(saved)) return new Set(saved);
    } catch (_) {}
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
    const base = getNets();
    const hasSan = base.some((n: any) => n.id === 'san');
    if (hasSan) {
      const vent = NETS.find((n: any) => n.id === 'vent');
      if (vent && !base.some((n: any) => n.id === 'vent')) base.push(vent);
    }
    return base.filter((n: any) => n.id !== 'vent' || hasSan);
  }, [activeNetworks, liveActiveNets]);

  const { saveStatus, doSave, autoSaveTimerRef } = usePdfAutoSave(engineRef, currentIdRef, planosCtx.plans);

  const syncEngine = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setTool(tool as any);
    eng.setActiveNet(activeNet);
    eng.setTipoTramo(tipoTramo as any);
    eng.setSnap(snapOn);
    eng.setScaleM(scaleM);
    const floorObj = pisos.find(p => p.n === selectedNivel);
    eng.nivelActual = floorObj ? { ...floorObj, label: pisoLbl(floorObj.n) } : null;
    eng.nptLevels = pisos.map(p => ({ label: pisoLbl(p.n), npt: p.npt }));
    const matName = activeNet === 'gas'
      ? (gasMatSel[activeNet] || GAS[0]?.mat || '')
      : (mats?.[activeNet] && mats[activeNet][0]?.val) || '';
    const d = activeNet === 'gas'
      ? (diamSel[activeNet] || GAS[0]?.rows[0]?.dn || '')
      : (diamSel[activeNet] || DIAM_DEFAULT_BY_NET[activeNet] || '');
    const p = (activeNet === 'san' || activeNet === 'll') ? (pendSel[activeNet] !== undefined ? pendSel[activeNet] : 2.0) : 0;
    eng.setRamalDefaults({ material: matName, diametro: d, pendiente: p });
  }, [tool, activeNet, tipoTramo, snapOn, scaleM, mats, diamSel, pendSel, selectedNivel, pisos]);

  useEffect(() => { syncEngine(); }, [syncEngine]);

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
  }, []);

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

  const goToPage = useCallback((target: number) => {
    if (target < 1 || target > numPages) return;
    setPageNumber(target);
    mountId.current += 1;
    renderPage(target, scale, mountId.current);
  }, [numPages, scale, renderPage, mountId]);

  const handleUndo = useCallback(() => {
    if (engineRef.current) engineRef.current.undoLast();
  }, []);

  const handleFit = useCallback(() => {
    const eng = engineRef.current;
    const cw = cwRef.current;
    if (!eng || !cw || !eng.pageW || !eng.pageH) return;
    const pad = 16;
    const availW = cw.clientWidth - pad * 2;
    const availH = cw.clientHeight - pad * 2;
    const sc = Math.min(availW / eng.pageW, availH / eng.pageH);
    eng.zoom = sc;
    eng.offX = eng.pageW * (1 - sc) / 2;
    eng.offY = (cw.clientHeight - eng.pageH * sc) / 2;
    eng.render();
    const newScale = Math.max(1, Math.ceil(sc));
    if (newScale !== scale) setScale(newScale);
  }, [scale]);

  const handleClear = useCallback(() => {
    if (!engineRef.current) return;
    const netId = activeNet;
    const netName = NETS.find(n => n.id === netId)?.name || netId;
    setConfirmState({
      isOpen: true,
      title: 'Limpiar red',
      message: `¿Deseas eliminar todo el trazado de la red activa (${netName})? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        engineRef.current!.clearNet(netId);
        setSelElement(null);
        setConfirmState(prev => ({...prev, isOpen: false}));
      }
    });
  }, [activeNet]);

  const handleSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    doSave();
  }, [doSave]);

  const handleLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engineRef.current) return;
    const reader = new FileReader();
    reader.onload = () => engineRef.current!.loadWork(reader.result as string);
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleRotateLabel = useCallback(() => {
    if (engineRef.current) engineRef.current.rotateLabelSnap();
  }, []);

  const handleDelete = useCallback(() => {
    if (!engineRef.current || !selElement) return;
    const sel = selElement as any;
    let label = 'el elemento';
    if (sel.type === 'ramal' && sel.ramal) label = `el ramal R${sel.ramal.id.slice(-4).toUpperCase()}`;
    else if (sel.type === 'bajante' && sel.bajante) label = `el bajante ${sel.bajante.id}`;
    
    setConfirmState({
      isOpen: true,
      title: 'Eliminar elemento',
      message: `¿Deseas eliminar ${label}?`,
      onConfirm: () => {
        engineRef.current!.deleteSelected();
        setSelElement(null);
        setConfirmState(prev => ({...prev, isOpen: false}));
      }
    });
  }, [selElement]);

  const handleUpdateSel = useCallback((field: string, value: any) => {
    if (!engineRef.current || !selElement) return;
    engineRef.current.updateSelected({ [field]: value });
    setSelElement({ ...selElement, [field]: value });
    engineRef.current.render();
  }, [selElement]);

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

  const netObj = NETS.find(n => n.id === activeNet);

  const handleToggleHidden = useCallback((id: string) => {
    const next = new Set(hiddenNets);
    if (next.has(id)) next.delete(id); else next.add(id);
    setHiddenNets(next);
    if (engineRef.current) engineRef.current.setNetHidden(id, next.has(id));
  }, [hiddenNets]);

  const handleToggleLocked = useCallback((id: string) => {
    const next = new Set(lockedNets);
    if (next.has(id)) next.delete(id); else next.add(id);
    setLockedNets(next);
    if (engineRef.current) engineRef.current.setNetLocked(id, next.has(id));
  }, [lockedNets]);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
      background: "#111317", border: "1px solid #3a494a", overflow: "hidden",
    }}>
      {/* Network toolbar — horizontal strip above canvas */}
      <PdfViewerNetworkBar
        nets={finalVisibleNets}
        activeNet={activeNet}
        hiddenNets={hiddenNets}
        lockedNets={lockedNets}
        onSelectNet={setActiveNet}
        onToggleHidden={handleToggleHidden}
        onToggleLocked={handleToggleLocked}
      />

      {/* Main area: sidebar + canvas */}
      <div style={{flex:1,display:"flex",minHeight:0}}>

      {/* Sidebar: Herramientas + Acciones */}
      <div className="visor-sidebar" style={{
        width: 165, flexShrink: 0, display: "flex", flexDirection: "column",
        background: "#14161a", borderRight: "1px solid #3a494a",
        overflowY: "auto", overflowX: "hidden",
      }}>
        <div style={{
          height: 3, flexShrink: 0, transition: 'background .3s',
          background: saveStatus === 'saved' ? '#22c55e'
            : saveStatus === 'saving' ? '#3b82f6'
            : '#ef4444',
        }} />
        <PdfViewerToolbar
          tool={tool}
          snapOn={snapOn}
          activeNet={activeNet}
          currentFile={currentFile}
          saveStatus={saveStatus}
          onSelectTool={setTool}
          onSnapToggle={() => setSnapOn(!snapOn)}
          onFit={handleFit}
          onSave={handleSave}
          onUndo={handleUndo}
          onClear={handleClear}
          engineRef={engineRef}
          currentIdRef={currentIdRef}
          currentId={currentId}
          plansRef={plansRef}
        />
      </div>

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
        onSelectPlan={onSelectPlan}
      />

      {/* Text input overlay */}
      {textOverlay && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(17,19,23,0.5)',
        }} onClick={() => { textOverlay.cb(''); setTextOverlay(null); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1a1c20', border: '2px solid #4D8FF7', borderRadius: 8,
            padding: '16px 20px', boxShadow: '0 8px 32px rgba(77,143,247,0.25)',
            display: 'flex', flexDirection: 'column', gap: 10, minWidth: 280,
          }}>
            <div style={{ fontSize: 11, color: '#849495', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>Texto</div>
            <input
              ref={textInputRef}
              value={textOverlay.value}
              onChange={e => setTextOverlay({ ...textOverlay, value: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  textOverlay.cb(textOverlay.value);
                  setTextOverlay(null);
                } else if (e.key === 'Escape') {
                  textOverlay.cb('');
                  setTextOverlay(null);
                }
              }}
              placeholder="Escribe el texto..."
              style={{
                width: '100%', padding: '8px 12px', background: '#0d0f12',
                border: '1px solid #3a494a', borderRadius: 4,
                color: '#e2e2e8', fontSize: 14, fontFamily: "'Geist',monospace",
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { textOverlay.cb(''); setTextOverlay(null); }} style={{
                padding: '5px 14px', background: 'transparent', border: '1px solid #3a494a',
                borderRadius: 4, color: '#849495', fontSize: 11, fontFamily: "'Geist',monospace",
                cursor: 'pointer',
              }}>Cancelar</button>
              <button onClick={() => { textOverlay.cb(textOverlay.value); setTextOverlay(null); }} style={{
                padding: '5px 14px', background: '#4D8FF7', border: '1px solid #4D8FF7',
                borderRadius: 4, color: '#fff', fontSize: 11, fontFamily: "'Geist',monospace",
                cursor: 'pointer', fontWeight: 600,
              }}>Aceptar</button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu overlay for Bajantes */}
      {contextMenuState && contextMenuState.visible && (
        <>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100
          }} onClick={() => setContextMenuState(null)} onContextMenu={(e) => e.preventDefault()} />
          <div style={{
            position: 'absolute', left: contextMenuState.x, top: contextMenuState.y, zIndex: 101,
            background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)', padding: '4px', minWidth: 180, maxWidth: 320,
            display: 'flex', flexDirection: 'column', gap: 2,
          }} onContextMenu={(e) => e.preventDefault()}>
            {((contextMenuState.bajante.tipo === 'bajante' || contextMenuState.bajante.tipo === 'montante' || contextMenuState.bajante.id?.startsWith('B')) && !contextMenuState.bajante.pts) ? (
              <>
                {(() => {
                  const isGhost = contextMenuState.isGhostClick || false;
                  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                  const gd = contextMenuState.bajante.ghostData?.[currentGhostLabel];
                  const ghostDir = isGhost ? (gd && gd.direccion !== undefined ? gd.direccion : contextMenuState.bajante.direccion) : contextMenuState.bajante.direccion;
                  const ghostDNom = isGhost ? (gd && gd.dNominal !== undefined ? gd.dNominal : contextMenuState.bajante.dNominal) : contextMenuState.bajante.dNominal;

                  const updateGhostField = (field: string, val: string) => {
                    if (!engineRef.current) return;
                    const gd = { ...(contextMenuState.bajante.ghostData || {}) };
                    const cd = { ...(gd[currentGhostLabel] || {}) };
                    (cd as any)[field] = val;
                    gd[currentGhostLabel] = cd;
                    engineRef.current.updateElementById(contextMenuState.bajante.id, { ghostData: gd });
                    const fresh = engineRef.current.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                    if (fresh) {
                      setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                      if (selElement?.id === contextMenuState.bajante.id) {
                        setSelElement({ ...selElement, ghostData: gd });
                      }
                    }
                  };

                  return (<>
                <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Dirección de flujo
                </div>
                {(isGhost ? ['Sube', 'Baja', 'Continua'] : ['Sube', 'Baja', 'Continua', 'Desplazamiento']).map(opt => (
              <button
                key={opt}
                 onClick={() => {
                    if (engineRef.current) {
                      if (isGhost && opt !== 'Desplazamiento') {
                        updateGhostField('direccion', opt.toLowerCase());
                        engineRef.current.render();
                        return;
                      }
                     const currentNpt = pisos.find(p => p.n === selectedNivel)?.npt || 0;
                    const allNpts = pisos.map(p => p.npt).sort((a,b) => a-b);
                    const maxNpt = allNpts[allNpts.length - 1] || 0;
                    const minNpt = allNpts[0] || 0;
                    let updates: any = {};
                    
                    if (opt === 'Sube') {
                      const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                      const currentDesp = { ...(contextMenuState.bajante.desplazamientos || {}) };
                      updates = { direccion: 'sube', nptBase: currentNpt, nptCima: maxNpt, desplazamientos: currentDesp };
                    } else if (opt === 'Baja') {
                      const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                      const currentDesp = { ...(contextMenuState.bajante.desplazamientos || {}) };
                      updates = { direccion: 'baja', nptBase: minNpt, nptCima: currentNpt, desplazamientos: currentDesp };
                    } else if (opt === 'Continua') {
                      const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                      const currentDesp = { ...(contextMenuState.bajante.desplazamientos || {}) };
                      updates = { direccion: 'continua', desplazamientos: currentDesp };
                    } else if (opt === 'Desplazamiento') {
                      const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                      if (lvl) {
                        const currentDesp = contextMenuState.bajante.desplazamientos || {};
                        updates = {
                          direccion: undefined,
                          desplazamientos: {
                            ...currentDesp,
                            [lvl]: { 
                              dx: currentDesp[lvl]?.dx ?? 2, 
                              dy: currentDesp[lvl]?.dy ?? 0,
                              Ldesvio: currentDesp[lvl]?.Ldesvio
                            }
                          }
                        };
                      }
                    }
                    if (Object.keys(updates).length > 0) {
                      engineRef.current.updateElementById(contextMenuState.bajante.id, updates);
                      const fresh = engineRef.current.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                      if (fresh) {
                        setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                      }
                      if (selElement?.id === contextMenuState.bajante.id) {
                        setSelElement({ ...selElement, ...updates });
                      }
                    }
                  }
                }}
                style={{
                  background: 'transparent', border: 'none', color: '#e2e2e8', padding: '6px 8px',
                  textAlign: 'left', fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer',
                  borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#2563eb33'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ color: opt === 'Sube' ? '#00dce5' : opt === 'Baja' ? '#F04545' : '#FFEB3B' }}>
                  {opt === 'Sube' ? '⬆' : opt === 'Baja' ? '⬇' : opt === 'Continua' ? '➜' : '➡'}
                </div>
                {opt}
              </button>
            ))}
            </>);
            })()}

            {!contextMenuState.isGhostClick ? (
              <div style={{ display: 'flex', gap: 6, padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
                {/* Destino */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Destino</div>
                  <select value={contextMenuState.bajante.descargaEnId || ''}
                    onChange={e => {
                      const v = e.target.value || null;
                      engineRef.current?.updateElementById(contextMenuState.bajante.id, { descargaEnId: v });
                      const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                      if (fresh) setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                      if (selElement?.id === contextMenuState.bajante.id) {
                        setSelElement({ ...selElement, descargaEnId: v });
                      }
                    }}
                    style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                    <option value="">— Sin destino —</option>
                    {lowerFloorsRamales.map(group => {
                      const plano = planosCtx.plans.find((pl: any) => pl.id === group.planId);
                      const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
                      return (
                        <optgroup key={group.planId} label={pLabel + (group.ramales.length === 0 ? ' (sin ramales)' : '')}>
                          {group.ramales.length > 0 ? group.ramales.map((r: any) => (
                            <option key={`${group.planId}|${r.id}`} value={`${group.planId}|${r.id}`}>
                              {r.label || r.id}
                            </option>
                          )) : (
                            <option value="" disabled>— Sin ramales disponibles —</option>
                          )}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
                {/* Diámetro */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Diámetro</div>
                  <select value={(() => {
                    const dIsGhost = contextMenuState.isGhostClick || false;
                    const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                    const gd = contextMenuState.bajante.ghostData?.[dGhostLabel];
                    return dIsGhost ? (gd && gd.dNominal !== undefined ? gd.dNominal : (contextMenuState.bajante.dNominal || '')) : (contextMenuState.bajante.dNominal || '');
                  })()}
                    onChange={e => {
                      const val = e.target.value;
                      const dIsGhost = contextMenuState.isGhostClick || false;
                      if (dIsGhost && engineRef.current) {
                        const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                        const gd2 = { ...(contextMenuState.bajante.ghostData || {}) };
                        const cd = { ...(gd2[dGhostLabel] || {}) };
                        cd.dNominal = val;
                        gd2[dGhostLabel] = cd;
                        engineRef.current?.updateElementById(contextMenuState.bajante.id, { ghostData: gd2 });
                        const fresh = engineRef.current.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                        if (fresh) {
                          setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                          if (selElement?.id === contextMenuState.bajante.id) {
                            setSelElement({ ...selElement, ghostData: gd2 });
                          }
                        }
                      } else {
                        engineRef.current?.updateElementById(contextMenuState.bajante.id, { dNominal: val });
                        setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, dNominal: val } } : null);
                        if (selElement?.id === contextMenuState.bajante.id) {
                          setSelElement({ ...selElement, dNominal: val });
                        }
                      }
                    }}
                    style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                    <option value="">—</option>
                    {DIAM_BAN.map(d => (
                      <option key={d.pulg} value={d.nom}>{d.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              /* Ghost click - Diameter only */
              <div style={{ marginTop: 4, padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
                <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Diámetro</div>
                <select value={(() => {
                  const dIsGhost = contextMenuState.isGhostClick || false;
                  const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                  const gd = contextMenuState.bajante.ghostData?.[dGhostLabel];
                  return dIsGhost ? (gd && gd.dNominal !== undefined ? gd.dNominal : (contextMenuState.bajante.dNominal || '')) : (contextMenuState.bajante.dNominal || '');
                })()}
                  onChange={e => {
                    const val = e.target.value;
                    const dIsGhost = contextMenuState.isGhostClick || false;
                    if (dIsGhost && engineRef.current) {
                      const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                      const gd2 = { ...(contextMenuState.bajante.ghostData || {}) };
                      const cd = { ...(gd2[dGhostLabel] || {}) };
                      cd.dNominal = val;
                      gd2[dGhostLabel] = cd;
                      engineRef.current?.updateElementById(contextMenuState.bajante.id, { ghostData: gd2 });
                      const fresh = engineRef.current.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                      if (fresh) {
                        setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                        if (selElement?.id === contextMenuState.bajante.id) {
                          setSelElement({ ...selElement, ghostData: gd2 });
                        }
                      }
                    } else {
                      engineRef.current?.updateElementById(contextMenuState.bajante.id, { dNominal: val });
                      setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, dNominal: val } } : null);
                      if (selElement?.id === contextMenuState.bajante.id) {
                        setSelElement({ ...selElement, dNominal: val });
                      }
                    }
                  }}
                  style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                  <option value="">—</option>
                  {DIAM_BAN.map(d => (
                    <option key={d.pulg} value={d.nom}>{d.nom}</option>
                  ))}
                </select>
              </div>
            )}
            
            {!contextMenuState.isGhostClick && (
              <button
                onClick={() => {
                  if (engineRef.current) {
                    const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                    const isFantasma = contextMenuState.bajante.isFantasma;
                    const updates: any = { isFantasma: !isFantasma };
                    if (!isFantasma && lvl) {
                      const currentDesp = { ...(contextMenuState.bajante.desplazamientos || {}) };
                      if (!currentDesp[lvl]) {
                        currentDesp[lvl] = { dx: 2, dy: 0 };
                        updates.desplazamientos = currentDesp;
                      }
                    }
                    engineRef.current.updateElementById(contextMenuState.bajante.id, updates);
                    const fresh = engineRef.current.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                    if (fresh) {
                      setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                    }
                    engineRef.current.render();
                  }
                }}
                style={{
                  background: 'transparent', border: 'none', color: '#e2e2e8', padding: '6px 8px',
                  textAlign: 'left', fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer',
                  borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6,
                  marginTop: 4, borderTop: '1px solid #3a494a'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#2563eb33'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {contextMenuState.bajante.isFantasma ? 'Desactivar bajante de desplazamiento' : 'Activar bajante de desplazamiento'}
              </button>
            )}

            {/* Show Area and Ramales selector side-by-side if not ghost */}
            {!contextMenuState.isGhostClick && (
              <div style={{
                display: 'flex',
                flexDirection: activeNet === 'san' ? 'row' : 'column',
                gap: 6,
                padding: '4px 8px',
                borderTop: '1px solid #3a494a',
                marginTop: 4
              }}>
                {/* Area */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Área asociada</div>
                  <select value={contextMenuState.bajante.area_m2 || ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      engineRef.current?.updateElementById(contextMenuState.bajante.id, { area_m2: val });
                      setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, area_m2: val } } : null);
                      if (selElement?.id === contextMenuState.bajante.id) {
                        setSelElement({ ...selElement, area_m2: val });
                      }
                    }}
                    style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                    <option value="">— Sin área —</option>
                    {(engineRef.current?.areas || []).map((a: any) => (
                      <option key={a.id} value={a.areaM2}>{a.label} · {a.areaM2} m²</option>
                    ))}
                  </select>
                </div>

                {/* Ramales asociados */}
                {activeNet === 'san' && (
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ramales asociados</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 }}>
                      {(() => {
                        const bajRamales = (engineRef.current?.ramales || []).filter((r: any) => r.net === 'san' && r.tipo !== 'tributario');
                        if (bajRamales.length === 0) return <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 2' }}>Sin ramales</div>;
                        const recibidos = (contextMenuState.bajante.recibeDeIds || []) as string[];
                        return bajRamales.map((r: any) => (
                          <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                            <input type="checkbox" checked={recibidos.includes(r.id)}
                              onChange={e => {
                                const newRecibe = e.target.checked
                                  ? [...recibidos, r.id]
                                  : recibidos.filter(id => id !== r.id);
                                engineRef.current?.updateElementById(contextMenuState.bajante.id, { recibeDeIds: newRecibe });
                                setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, recibeDeIds: newRecibe } } : null);
                                if (selElement?.id === contextMenuState.bajante.id) {
                                  setSelElement({ ...selElement, recibeDeIds: newRecibe });
                                }
                              }}
                              style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label || r.id}</span>
                          </label>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
            </>
            ) : contextMenuState.bajante.id?.startsWith('AR') ? (
              <>
                <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Asociar Bajante
                </div>
                <div style={{ padding: '0 8px 8px' }}>
                  <select
                    value={(engineRef.current?.bajantes || []).find((b:any) => b.area_m2 === contextMenuState.bajante.areaM2)?.id || ''}
                    onChange={e => {
                      const bajanteId = e.target.value;
                      (engineRef.current?.bajantes || []).forEach((b:any) => {
                        if (b.area_m2 === contextMenuState.bajante.areaM2) {
                          engineRef.current?.updateElementById(b.id, { area_m2: 0 });
                        }
                      });
                      if (bajanteId) {
                        engineRef.current?.updateElementById(bajanteId, { area_m2: contextMenuState.bajante.areaM2 });
                      }
                      engineRef.current?.render();
                      setContextMenuState(null);
                    }}
                    style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                    <option value="">— Sin bajante —</option>
                    {(engineRef.current?.bajantes || []).filter((b: any) => b.net === contextMenuState.bajante.net).map((b: any) => (
                      <option key={b.id} value={b.id}>{b.code || b.id}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : contextMenuState.bajante.pts ? (
              <>
                {contextMenuState.ramalEndpoint && (() => {
                  const supNets = ['san', 'll', 'vent', 'af', 'ac', 'gas', 'rci', 'rec'];
                  if (!supNets.includes(contextMenuState.bajante.net)) return null;
                  const ep = contextMenuState.ramalEndpoint;
                  const netDef = NETS.find((n: any) => n.id === contextMenuState.bajante.net);
                  const bmLabel = netDef?.bmType === 'bajante' ? 'bajante' : 'montante';
                  return (
                    <div style={{ padding: '4px 8px' }}>
                      <button onClick={() => {
                        const eng = engineRef.current;
                        if (!eng) return;
                        const cnt = eng.bajantes.filter((b: any) => b.net === contextMenuState.bajante.net).length + 1;
                        const id = (netDef?.bmPfx || 'B') + cnt;
                        eng.bajantes.push({
                          id, net: contextMenuState.bajante.net,
                          tipo: bmLabel,
                          code: id,
                          x: ep.x, y: ep.y,
                          pisoBase: '', pisoCima: '',
                          nptBase: 0, nptCima: 0, hVert: 0,
                          dNominal: '0', recibeDeIds: [contextMenuState.bajante.id], alimentaIds: [], descargaEnId: null,
                          ucAcum: 0, ucExtra: 0, area_m2: 0,
                          desplazamientos: {},
                          lblOffX: 0, lblOffY: 0, labelAngle: 0,
                          labelX: ep.x, labelY: ep.y + 20,
                        });
                        eng.selId = id;
                        eng._isGhostSel = false;
                        eng._emitSelect(eng.bajantes[eng.bajantes.length - 1]);
                        eng.render();
                        eng._markDirty();
                        setContextMenuState(null);
                      }} style={{
                        width: '100%', padding: '6px 8px', cursor: 'pointer',
                        background: '#1e2024', border: '1px dashed #00dce5', borderRadius: 4,
                        color: '#00dce5', fontSize: 11, fontFamily: "'Geist',monospace",
                        textAlign: 'center', fontWeight: 600,
                      }}>+ Crear {bmLabel}</button>
                    </div>
                  );
                })()}
                <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Diámetro de ramal
                </div>
                {(() => {
                  const isGas = contextMenuState.bajante.net === 'gas';
                  const matList = mats?.[contextMenuState.bajante.net] || [];
                  const matShort = contextMenuState.bajante.material || matList[0]?.val || '—';
                  const diamList = isGas ? (GAS[0]?.rows.map(r => ({n: r.dn})) || []) : (DIAM_BY_MAT[matShort] || []);
                  
                  return (
                    <div style={{ padding: '0 8px 8px' }}>
                      <select
                        value={contextMenuState.bajante.diametro || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (engineRef.current) {
                            engineRef.current.updateElementById(contextMenuState.bajante.id, { diametro: val });
                            setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, diametro: val } } : null);
                            if (selElement?.id === contextMenuState.bajante.id) {
                              setSelElement({ ...selElement, diametro: val });
                            }
                            if (activeNet === contextMenuState.bajante.net) {
                              setDiamSel(prev => ({ ...prev, [activeNet]: val }));
                            }
                            engineRef.current.render();
                          }
                        }}
                        style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
                      >
                        <option value="">— Sin diámetro —</option>
                        {diamList.map((d: any) => (
                          <option key={d.n} value={d.n}>{d.n}</option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
              </>
            ) : null}
          </div>
        </>
      )}

      {/* Right sidebar: Piso, ¿Qué voy a dibujar?, Tramo, Escala */}
      <div className="visor-sidebar-right" style={{
        width: 210, flexShrink: 0, display: "flex", flexDirection: "column",
        background: "#14161a", borderLeft: "1px solid #3a494a",
        overflowY: "auto", overflowX: "hidden",
        transition: 'opacity 0.2s',
      }}>
        {/* Nivel — always enabled */}
        <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Nivel</div>
          <select value={selectedNivel??''} onChange={e=>{
            const v=e.target.value?Number(e.target.value):null;
            setSelectedNivel(v);
            if (v !== null) {
              const idx = planos.findIndex(p => p.nivel === v && p.status === 'confirmed');
              if (idx >= 0 && onSelectPlan) onSelectPlan(idx);
            }
          }}
            style={{width:'100%',padding:"5px 8px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:12,fontFamily:"'Geist',monospace",cursor:'pointer'}}>
            <option value="">— Seleccionar piso —</option>
            {[...pisos].sort((a,b)=>b.n-a.n).map(s=>{
              const tienePlano=planos.some(p=>p.nivel===s.n&&p.status==='confirmed');
              return <option key={s.id} value={s.n}>{tienePlano?'🟢 ':''}{pisoLbl(s.n)} ({s.npt} m)</option>;
            })}
          </select>
          {selectedNivel!==null&&(()=>{
            const planoAsoc=planos.find(p=>p.nivel===selectedNivel&&p.status==='confirmed');
            if(!planoAsoc)return null;
            return(
              <div style={{marginTop:8,padding:'6px 10px',background:'#1e2024',borderRadius:3,border:'1px solid rgba(0,220,229,.2)'}}>
                <div style={{fontSize:11,color:'#00dce5',fontFamily:"'Geist',monospace",fontWeight:600,display:'flex',alignItems:'center',gap:4}}>📄 {planoAsoc.name}</div>
                <div style={{fontSize:10,color:'#6b8cae',fontFamily:"'Geist',monospace",marginTop:2}}>Escala 1:{planoAsoc.scale}</div>
              </div>
            );
          })()}
        </div>

        {/* Rest of sidebar — blocked when selecting without element selected */}
        <div style={{
          opacity: (tool === 'sel' && !selElement) ? 0.35 : 1,
          pointerEvents: (tool === 'sel' && !selElement) ? 'none' : 'auto',
          transition: 'opacity 0.2s',
        }}>

        <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>¿Qué voy a dibujar?</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {TIPOS_TRAMO.map(tp=>(
              <button key={tp.id} onClick={()=>setTipoTramo(tp.id)}
                style={{
                  padding:"7px 10px", background:tipoTramo===tp.id?"#2563EB22":"#1e2024",
                  border:`1px solid ${tipoTramo===tp.id?"#2563EB":"#3a494a"}`,
                  borderRadius:"3px", cursor:"pointer", width:"100%",
                  display:"flex", flexDirection:"column", gap:2, alignItems:"flex-start",
                  transition:"all .12s",
                }}>
                <div style={{fontSize:11,fontWeight:600,color:tipoTramo===tp.id?"#2563EB":"#b9caca",fontFamily:"'Geist',monospace"}}>
                  {tp.id==='ramal'?'📏 Ramal principal':tp.id==='tributario'?'🔀 Tributario':tp.label}
                </div>
                <div style={{fontSize:9,color:"#6b8cae",fontFamily:"'Geist',monospace",textAlign:"left"}}>
                  {tp.id==='ramal'?'Trazos principales de la red activa':tp.id==='tributario'?'Ramificaciones que conectan al ramal principal':''}
                </div>
              </button>
            ))}
          </div>
          {tipoTramo === 'tributario' && (
            <div style={{marginTop:8,padding:'8px 10px',background:padreTributarioId?'rgba(37,99,235,.12)':'#1e2024',border:`1px solid ${padreTributarioId?'#2563EB':'#3a494a'}`,borderRadius:3}}>
              <div style={{fontSize:9,color:'#849495',fontFamily:"'Geist',monospace",textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Padre (ramal asignado)</div>
              <select value={padreTributarioId||''}
                onChange={e=>{
                  const v=e.target.value||null;
                  setPadreTributarioId(v);
                   if (engineRef.current) engineRef.current.setPadreTributario(v as any);
                }}
                style={{width:'100%',padding:'5px 8px',background:'#1a1c20',border:'1px solid #3a494a',borderRadius:3,color:padreTributarioId?'#2563EB':'#6b8cae',fontSize:11,fontFamily:"'Geist',monospace",cursor:'pointer'}}>
                <option value="">— Seleccionar ramal padre —</option>
                {drawnElements.filter(el=>el.type==='ramal'&&el.tipo==='ramal').map(el=>(
                  <option key={el.id} value={el.id}>{el.label}{el.totalL?` · ${typeof el.totalL==='number'?el.totalL.toFixed(2):el.totalL}m`:''}</option>
                ))}
              </select>
              {drawnElements.filter(el=>el.type==='ramal'&&el.tipo==='ramal').length===0 && (
                <div style={{fontSize:10,color:'#ffb4ab',fontFamily:"'Geist',monospace",marginTop:6,lineHeight:1.4}}>
                  No hay ramales principales en esta red. Dibuja primero un ramal antes de crear tributarios.
                </div>
              )}
              {padreTributarioId && (
                <div style={{fontSize:9,color:'#6b8cae',fontFamily:"'Geist',monospace",marginTop:4,lineHeight:1.4}}>
                  El primer punto se conectará automáticamente al ramal seleccionado.
                </div>
              )}
            </div>
          )}
        </div>

        <TramoEditor
          selElement={selElement}
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
          handleDelete={handleDelete}
        />

        {/* Bajante/Montante association */}
        {selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante') && !engineRef.current?._isGhostSel && (
        <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a", opacity: 1, pointerEvents: 'auto' }}>
            <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
              Asociación de bajante
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 8, color: '#6b8cae', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: .5 }}>Origen (piso actual)</div>
                <div style={{ padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#6b8cae", fontSize: 10, fontFamily: "'Geist',monospace" }}>
                  {selectedNivel !== null ? pisoLbl(selectedNivel) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: '#6b8cae', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: .5 }}>Destino</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <select value={selElement.descargaEnId || ''}
                    onChange={e => {
                      const v = e.target.value || null;
                      if (engineRef.current) {
                        engineRef.current.updateSelected({ descargaEnId: v });
                        setSelElement({ ...selElement, descargaEnId: v });
                      }
                    }}
                    style={{ flex: 1, padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                    <option value="">— Sin destino —</option>
                    {lowerFloorsRamales.map(group => {
                      const plano = planosCtx.plans.find((pl: any) => pl.id === group.planId);
                      const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
                      return (
                        <optgroup key={group.planId} label={pLabel + (group.ramales.length === 0 ? ' (sin ramales)' : '')}>
                          {group.ramales.length > 0 ? group.ramales.map((r: any) => (
                            <option key={`${group.planId}|${r.id}`} value={`${group.planId}|${r.id}`}>
                              {r.label || r.id}
                            </option>
                          )) : (
                            <option value="" disabled>— Sin ramales disponibles —</option>
                          )}
                        </optgroup>
                      );
                    })}
                  </select>
                  {selElement.descargaEnId && (
                    <button onClick={() => {
                      if (engineRef.current) {
                        engineRef.current.updateSelected({ descargaEnId: null });
                        setSelElement({ ...selElement, descargaEnId: null });
                      }
                    }}
                      style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 10 }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Escala</div>
          <div style={{padding:"5px 8px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:12,fontFamily:"'Geist',monospace"}}>
            {(() => {
              const planoAsoc = planos.find(p => p.nivel === selectedNivel && p.status === 'confirmed');
              if (planoAsoc && planoAsoc.scale) return <span>1:{planoAsoc.scale}</span>;
              const map: Record<string, string> = {'0.5':'1:50','0.75':'1:75','1.0':'1:100','1.25':'1:125','2.0':'1:200'};
              return <span>{map[scaleM] || '1:100'}</span>;
            })()}
          </div>
        </div>

        {!(selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante' || selElement.tipo === 'area' || selElement.id?.startsWith('AR'))) && (
        <AparatosPanel activeNet={activeNet} selElement={selElement} />
        )}

        <PdfViewerDrawnElements
          drawnElements={drawnElements}
          activeNet={activeNet}
          selElement={selElement}
          engineRef={engineRef}
        />

        <div style={{flex:1}}/>
      </div>
      </div>
      
      {confirmState.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg2)', padding: '20px', borderRadius: 'var(--r)', minWidth: 320, maxWidth: 400, border: '1px solid var(--line)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ef5350', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 20 }}>⚠</span> {confirmState.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 20, lineHeight: 1.5 }}>
              {confirmState.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setConfirmState(prev => ({...prev, isOpen: false}))} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--txt)', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Cancelar</button>
              <button onClick={confirmState.onConfirm} style={{ padding: '6px 12px', background: '#ef5350', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}
