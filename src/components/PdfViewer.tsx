/* eslint-disable no-empty */
import { memo, useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import PlanoEngine from "../lib/PlanoEngine/PlanoEngine";
import { NETS } from "../lib/PlanoEngine/PlanoState";
import { matLongName, pisoLbl, GAS, DEFAULT_PENDIENTE_PCT } from "../constants";
import { useProject } from "../context/ProjectContext";
import { usePlans } from "../context/PlansContext";
import { writeSanDrawingSync, writeHydroDrawingSync } from "../utils/drawingSync";
import { bumpHidroAccesorio } from "../utils/syncExtremeAccessory";
import { loadFromStorage, saveToStorage, saveTrazosToDB, loadTrazosFromDB } from "../services/storageService";
import { GAS_ACC_KEY, APARATOS_BY_TRAMO_KEY, HYDRO_DATA_STORAGE_KEY } from "../constants/storage-keys";
import PdfViewerToolbar, { STATUS } from "./pdfViewer/PdfViewerToolbar";
import PdfCanvas from "./pdfViewer/PdfCanvas";
import PdfViewerNetworkBar from "./pdfViewer/PdfViewerNetworkBar";
import { usePdfAutoSave } from "./pdfViewer/usePdfAutoSave";
import { usePdfViewerEngine } from "./pdfViewer/PdfViewerEngineInit";
import TextInputOverlay from "./pdfViewer/TextInputOverlay";
import DrawingElementContextMenu from "./pdfViewer/DrawingElementContextMenu";
import { type ContextMenuState } from "./pdfViewer/DrawingElementContextMenuContext";
import ConfirmDialog from "./pdfViewer/ConfirmDialog";
import AlertDialog from "./pdfViewer/AlertDialog";
import AccesorioModal from "./pdfViewer/AccesorioModal";
import TipoTramoSelector from "./pdfViewer/TipoTramoSelector";
import TramoEditor from "./pdfViewer/TramoEditor";
import BajanteAsociacion from "./pdfViewer/BajanteAsociacion";
import PdfViewerDrawnElements from "./pdfViewer/PdfViewerDrawnElements";
import { CopyFromPlanPanel } from "./pdfViewer/CopyFromPlanPanel";
import AparatosPanel from "./FixturesPanel";
const PdfViewer_S1: React.CSSProperties = { position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const PdfViewer_S2: React.CSSProperties = { position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const PdfViewer_S3: React.CSSProperties = { position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const PdfViewer_S4: React.CSSProperties = { width:'100%',padding:"5px 8px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:12,fontFamily:"'Geist',monospace",cursor:'pointer' };
const PdfViewer_S5: React.CSSProperties = { position:"absolute",top:0,zIndex:40,width:16,height:24,background:"#14161a",border:"1px solid #3a494a",color:"#849495",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,fontSize:12 } as const;
const PdfViewer_EMPTY_PISOS: any[] = [];


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
  width: 180, flexShrink: 0, display: "flex", flexDirection: "column",
  background: "#14161a", borderRight: "1px solid #3a494a",
  overflowY: "auto", overflowX: "hidden",
};
const rightSidebarStyle: CSSProperties = {
  width: 210, flexShrink: 0, display: "flex", flexDirection: "column",
  background: "#14161a", borderLeft: "1px solid #3a494a",
  overflowY: "auto", overflowX: "hidden",
  transition: 'opacity 0.2s',
};

function PdfViewer_({ files, activeIndex, onSelectPlan, pisos=PdfViewer_EMPTY_PISOS, planos=[], activeNetworks }: PdfViewerProps) {
  const navigate = useNavigate();
  const { mats } = useProject();
  const planosCtx = usePlans();
  const plansRef = useRef(planosCtx.plans);
  plansRef.current = planosCtx.plans;
  const [scale, setScale] = useState(1);
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 1024);
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth < 1024);

  const dynamicLeftStyle: CSSProperties = useMemo(() => ({
    ...leftSidebarStyle,
    width: leftCollapsed ? 0 : 180,
    borderRight: leftCollapsed ? "none" : "1px solid #3a494a",
    overflowX: "hidden",
    overflowY: leftCollapsed ? "hidden" : "auto",
    scrollbarGutter: "stable",
    transition: "width 0.2s ease, border-right 0.2s ease",
  }), [leftCollapsed]);

  const dynamicRightStyle: CSSProperties = useMemo(() => ({
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
    } catch {}
    return "af";
  });

  useEffect(() => {
    if (activeNetworks && activeNetworks.size > 0 && !activeNetworks.has(activeNet)) {
      setActiveNet(Array.from(activeNetworks)[0]);
    }
  }, [activeNetworks, activeNet]);

  const [tipoTramo, setTipoTramo] = useState(() => {
    try { return sessionStorage.getItem('civilflow_visor_tipoTramo') || 'ramal'; }
    catch { return 'ramal'; }
  });
  const [padreTributarioId, setPadreTributarioId] = useState<string | null>(null);
  const [snapOn, setSnapOn] = useState(() => {
    try {
      const v = sessionStorage.getItem('civilflow_visor_snapOn');
      return v !== null ? v === 'true' : true;
    } catch { return true; }
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

  const lowerFloorsRamales = useMemo(() => {
    if (!selElement || !(selElement.tipo === 'bajante' || selElement.tipo === 'montante')) return [];
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
          } catch {}
        }
      }
      return { planId: plan.id, planName: plan.name, npt: pF.npt, ramales, bajantes };
    });
    results.sort((a, b) => b.npt - a.npt);
    return results;
  }, [selElement?.id, selectedNivel, pisos, planosCtx.plans, activeNet]);

  useEffect(() => { try { sessionStorage.setItem('civilflow_visor_tool', tool); } catch {} }, [tool]);
  useEffect(() => { try { sessionStorage.setItem('civilflow_visor_tipoTramo', tipoTramo); } catch {} }, [tipoTramo]);
  useEffect(() => { try { sessionStorage.setItem('civilflow_visor_snapOn', String(snapOn)); } catch {} }, [snapOn]);

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
    const pl = planos.find(p => p.id === currentId);
    if (pl && (pl.nivel ?? null) !== (selectedNivel ?? null)) {
      setSelectedNivel(pl.nivel ?? null);
    }
  }, [currentId, planos]);

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
          if (!localData || dbTs > localTs) saveToStorage(`trazos_${resolvedId}`, dbData);
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
    } catch {}
    try { writeSanDrawingSync(plansRef.current); } catch {}
    try { writeHydroDrawingSync(plansRef.current); } catch {}
  }, []);

  const onDeleteHandler = useCallback((ids: string[]) => {
    const cleanStore = (key: string) => {
      const store = loadFromStorage(key, {}) as Record<string, any>;
      let changed = false;
      for (const k of Object.keys(store)) {
        for (const id of ids) {
          if (k.includes(id)) { delete store[k]; changed = true; break; }
        }
      }
      if (changed) saveToStorage(key, store);
    };
    cleanStore(GAS_ACC_KEY);
    cleanStore(APARATOS_BY_TRAMO_KEY);
    cleanStore(HYDRO_DATA_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('aparatos-clear', { detail: { ids } }));
    try { writeSanDrawingSync(plansRef.current); } catch {}
    try { writeHydroDrawingSync(plansRef.current); } catch {}
  }, [plansRef]);

  const onRequestTextCb = useCallback((x: number, y: number, cb: (text: string) => void) => {
    setTextOverlay({ x, y, value: '', cb });
    setTimeout(() => textInputRef.current?.focus(), 50);
  }, []);

  // ── Dialog state ──
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
  const [confirmState, setConfirmState] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});
  const [alertDialogState, setAlertDialogState] = useState<{isOpen: boolean; title: string; message: string}>({isOpen: false, title: '', message: ''});
  const [accesorioModal, setAccesorioModal] = useState<{isOpen: boolean; ramalId: string; angleDeg: number; junctionIndex: number; net: string; isTee?: boolean}>({isOpen: false, ramalId: '', angleDeg: 0, junctionIndex: 0, net: '', isTee: false});

  const contextMenuCbRef = useRef<any>(null);
  const onContextMenuCb = useCallback((bajante: any, x: number, y: number, isGhostClick?: boolean, ramalEndpoint?: any, midRamalHit?: { segmentIdx: number; x: number; y: number } | null) => {
    setContextMenuState({ visible: true, x, y, element: bajante, isGhostClick, ramalEndpoint, midRamalHit });
  }, []);
  contextMenuCbRef.current = onContextMenuCb;

  // ── Engine init ──
  const { engineReady } = usePdfViewerEngine({
    currentFile, currentId, currentIdRef, activeNetRef, cwRef, drawCanvasRef, pdfCanvasRef,
    onStatus: () => {}, onDirty: onDirtyHandler, onSelect: setSelElement, onDelete: onDeleteHandler,
    onToolChange: setTool, onRequestText: onRequestTextCb, onAlert: (title: string, msg: string) => {
      setAlertDialogState({ isOpen: true, title, message: msg });
    }, onAccesorioModal: (data) => {
      setAccesorioModal({ isOpen: true, ramalId: data.ramalId, angleDeg: data.angleDeg, junctionIndex: data.junctionIndex, net: data.net, isTee: data.isTee });
    }, loadTrazosForPlan, setActiveNet, setScaleM, setLoading, setError, scale,
    engineRef: engineRef as React.MutableRefObject<PlanoEngine | null>,
    loadingPlanRef,
  });

  // Handler for accesorio modal selection - updates the ramal accesory in engine + hidroData
  const onAccesorioSelected = useCallback((ramalId: string, junctionIndex: number, _net: string, accId: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    const r = eng.ramales.find(r => r.id === ramalId);
    if (!r) return;
    // Save the accessory at the junction point (junction 0 = ini, last = fin)
    const isIni = junctionIndex === 0;
    const isFin = junctionIndex === r.pts.length - 1;
    if (isIni) {
      (r as any).accesorioInicio = accId;
    } else if (isFin) {
      (r as any).accesorioFin = accId;
    } else {
      (r as any)[`accMed${junctionIndex}`] = accId;
    }
    eng._markDirty();

    // Sync to hidroData so the sidebar accessories count increments
    try {
      const planId = eng._loadedPlanId;
      if (planId) {
        bumpHidroAccesorio(_net, accId, 1, ramalId, planId);
      }
    } catch { /* ignore */ }
    eng.render();
    // Trigger sidebar refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aparatos-clear'));
      setSelElement({ ...(r as any) });
    }
  }, [engineRef, planosCtx.plans]);

  useEffect(() => {
    if (engineRef.current && engineReady) engineRef.current.onContextMenu(contextMenuCbRef.current);
  }, [engineReady, engineRef]);

  useEffect(() => {
    if (engineRef.current) (engineRef.current as any).activeNetworks = activeNetworks;
  }, [activeNetworks, engineReady]);

  useEffect(() => {
    if (!engineRef.current || !engineReady) return;
    const eng = engineRef.current;
    const prevId = eng._loadedPlanId;
    if (prevId && prevId !== currentId) {
      if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
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
            ? Array.from(activeNetworks)[0] : (activeNetRef.current || 'af');
          const loadedNet = eng.activeNet || fallbackNet;
          const sm = eng.scaleM;
          setActiveNet(loadedNet);
          if (sm != null) setScaleM(String(sm));
          requestAnimationFrame(() => { loadingPlanRef.current = false; if (engineRef.current) engineRef.current.render(); });
        } else if (currentId) {
          eng.ramales = []; eng.bajantes = []; eng.areas = []; eng.dims = []; eng.textAnnots = [];
          eng.selId = null; eng.activeRamal = null; eng.activeArea = null;
          eng.setActiveNet(activeNetRef.current);
          eng.render();
          loadingPlanRef.current = false;
        }
      } catch (e) { if (import.meta.env.DEV) console.error('[LOAD] error', e); loadingPlanRef.current = false; }
    })();
    try { writeSanDrawingSync(plansRef.current); } catch {}
    try { writeHydroDrawingSync(plansRef.current); } catch {}
  }, [currentId, engineReady]);

  const prevActiveNetForSel = useRef(activeNet);
  if (activeNet !== prevActiveNetForSel.current) {
    prevActiveNetForSel.current = activeNet;
    if (engineRef.current && !loadingPlanRef.current) {
      const els = engineRef.current.getElementsByNet(activeNet);
      if (els.length > 0 && selElement?.net !== activeNet) setSelElement(els[els.length - 1]);
      else if (els.length === 0) setSelElement(null);
    }
  }

  useEffect(() => { try { writeSanDrawingSync(plansRef.current); } catch {} try { writeHydroDrawingSync(plansRef.current); } catch {} }, [planosCtx.plans, currentId, activeNet]);
  useEffect(() => {
    const handler = () => { try { writeSanDrawingSync(plansRef.current); } catch {} try { writeHydroDrawingSync(plansRef.current); } catch {} };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [planosCtx.plans]);

  const [liveActiveNets, setLiveActiveNets] = useState<Set<string> | null>(() => {
    try { const saved = loadFromStorage('active_nets', null); if (saved && Array.isArray(saved)) return new Set(saved); } catch {}
    return null;
  });

  useEffect(() => {
    const refresh = () => {
      try { const saved = loadFromStorage('active_nets', null); setLiveActiveNets(saved && Array.isArray(saved) ? new Set(saved) : null); } catch { setLiveActiveNets(null); }
    };
    window.addEventListener('civilflow_nets_changed', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('civilflow_nets_changed', refresh); window.removeEventListener('storage', refresh); };
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

  // ── Inline actions (was usePdfViewerActions) ──
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
      : (diamSel[activeNet] || '');
    const p = (activeNet === 'san' || activeNet === 'll') ? (pendSel[activeNet] !== undefined ? pendSel[activeNet] : DEFAULT_PENDIENTE_PCT) : 0;
    eng.setRamalDefaults({ material: matName, diametro: d, pendiente: p });
  }, [tool, activeNet, tipoTramo, snapOn, scaleM, mats, diamSel, pendSel, selectedNivel, pisos, gasMatSel, engineRef]);

  const handleUndo = useCallback(() => { if (engineRef.current) engineRef.current.undoLast(); }, [engineRef]);
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
  }, [engineRef, cwRef, scale, setScale]);

  const handleClear = useCallback(() => {
    if (!engineRef.current) return;
    const netId = activeNet;
    const netName = NETS.find(n => n.id === netId)?.name || netId;
    setConfirmState({
      isOpen: true, title: 'Limpiar red',
      message: `¿Deseas eliminar todo el trazado de la red activa (${netName})? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        engineRef.current?.clearNet(netId);
        setSelElement(null);
        setConfirmState((prev: any) => ({...prev, isOpen: false}));
      }
    });
  }, [engineRef, activeNet, setSelElement]);

  const handleSave = useCallback(() => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); doSave(); }, [autoSaveTimerRef, doSave]);
  const handleSnapToggle = useCallback(() => setSnapOn(prev => !prev), [setSnapOn]);
  const handleRotateLabel = useCallback(() => { if (engineRef.current) engineRef.current.rotateLabelSnap(); }, [engineRef]);
  const handleUpdateSel = useCallback((field: string, value: any) => {
    if (!engineRef.current || !selElement) return;
    const fields = { [field]: value };
    engineRef.current.updateSelected(fields);
    setSelElement({ ...selElement, [field]: fields[field] });
    engineRef.current.render();
  }, [engineRef, selElement, setSelElement]);

  const handleToggleHidden = useCallback((id: string) => {
    const next = new Set(hiddenNets);
    if (next.has(id)) next.delete(id); else next.add(id);
    setHiddenNets(next);
    if (engineRef.current) engineRef.current.setNetHidden(id, next.has(id));
  }, [hiddenNets, setHiddenNets, engineRef]);

  const handleToggleLocked = useCallback((id: string) => {
    const next = new Set(lockedNets);
    if (next.has(id)) next.delete(id); else next.add(id);
    setLockedNets(next);
    if (engineRef.current) engineRef.current.setNetLocked(id, next.has(id));
  }, [lockedNets, setLockedNets, engineRef]);

  useEffect(() => { syncEngine(); }, [syncEngine]);

  useEffect(() => {
    if (finalVisibleNets.length === 0) return;
    if (!finalVisibleNets.some((n: any) => n.id === activeNet)) setActiveNet(finalVisibleNets[0].id);
    setHiddenNets(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const id of [...next]) { if (!finalVisibleNets.some(n => n.id === id)) { next.delete(id); changed = true; } }
      return changed ? next : prev;
    });
  }, [finalVisibleNets, activeNet]);

  const prevResetKey = useRef('');
  const resetKey = activeNet + '|' + tipoTramo;
  if (resetKey !== prevResetKey.current) {
    prevResetKey.current = resetKey;
    setPadreTributarioId(null);
    if (engineRef.current) engineRef.current.setPadreTributario(null as any);
  }

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
          if (eng.multiSel && eng.multiSel.length > 0) { eng.deleteSelected(eng.multiSel); eng.multiSel = []; }
          else if (eng.selId) eng.deleteSelected();
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
      if (selElement.diametro) setDiamSel(prev => ({ ...prev, [activeNet]: selElement.diametro }));
      if (selElement.pendiente !== undefined) {
        setPendSel(prev => ({ ...prev, [activeNet]: selElement.pendiente }));
        setPendInput(selElement.pendiente > 0 ? String(selElement.pendiente) : '');
      }
    } else if (!selElement) {
      // Mirror the actual default used at ramal-creation time (setRamalDefaults / syncEngine)
      // so the field doesn't show blank while a new san/ll ramal would in fact be drawn at 2%.
      const fallback = (activeNet === 'san' || activeNet === 'll') ? DEFAULT_PENDIENTE_PCT : undefined;
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
  useEffect(() => { const c = drawCanvasRef.current; if (c) c.style.cursor = tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair'; }, [tool]);

  const rightSidebarOpacity = useMemo(() => ({
    opacity: (!selElement) ? 0.35 : 1,
    pointerEvents: (!selElement) ? ('none' as const) : ('auto' as const),
    transition: 'opacity 0.2s',
  }), [selElement]);

  const scaleText = useMemo(() => {
    const planoAsoc = planos.find(p => p.nivel === selectedNivel && p.status === 'confirmed');
    if (planoAsoc && planoAsoc.scale) return <span>1:{planoAsoc.scale}</span>;
    const map: Record<string, string> = {'0.5':'1:50','0.75':'1:75','1.0':'1:100','1.25':'1:125','2.0':'1:200'};
    return <span>{map[scaleM] || '1:100'}</span>;
  }, [selectedNivel, planos, scaleM]);

  const planoAsocInfo = useMemo(() => {
    if (selectedNivel === null) return null;
    const planoAsoc = planos.find(p => p.nivel === selectedNivel && p.status === 'confirmed');
    if (!planoAsoc) return null;
    return (
      <div style={{marginTop:8,padding:'6px 10px',background:'#1e2024',borderRadius:3,border:'1px solid rgba(0,220,229,.2)'}}>
        <div style={{fontSize: 12,color:'#00dce5',fontFamily:"'Geist',monospace",fontWeight:600,display:'flex',alignItems:'center',gap:4}}>📄 {planoAsoc.name}</div>
        <div style={{fontSize: 12,color:'#6b8cae',fontFamily:"'Geist',monospace",marginTop:2}}>Escala 1:{planoAsoc.scale}</div>
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

      <div style={{flex:1,display:"flex",minHeight:0,position:"relative",minWidth:0}}>

      <div className="visor-sidebar" style={dynamicLeftStyle}>
        <h2 style={PdfViewer_S1}>Panel de capas</h2>
        <div style={{height:3,flexShrink:0,transition:'background .3s',background:STATUS[saveStatus]?.color || STATUS.error.color}} />
        <PdfViewerToolbar
          tool={tool} snapOn={snapOn} activeNet={activeNet} currentFile={currentFile}
          saveStatus={saveStatus} onSelectTool={setTool} onSnapToggle={handleSnapToggle}
          onFit={handleFit} onSave={handleSave} onUndo={handleUndo} onClear={handleClear}
        />
      </div>

      <div style={{position:'relative',flex:1,display:'flex',minHeight:0,minWidth:0}}>
        <h2 style={PdfViewer_S2}>Visor de planos</h2>
        <PdfCanvas
          cwRef={cwRef} containerRef={containerRef} pdfCanvasRef={pdfCanvasRef} drawCanvasRef={drawCanvasRef}
          currentFile={currentFile} error={error as any} loading={loading}
          selectedNivel={selectedNivel} pisos={pisos} planos={planos} tool={tool} snapOn={snapOn}
        />
      </div>

      {/* Dialogs (was PdfViewerDialogs) */}
      <TextInputOverlay textOverlay={textOverlay} setTextOverlay={setTextOverlay} textInputRef={textInputRef} />
      <DrawingElementContextMenu
        contextMenuState={contextMenuState} setContextMenuState={setContextMenuState}
        selectedNivel={selectedNivel} pisos={pisos} engineRef={engineRef}
        selElement={selElement} setSelElement={setSelElement}
        lowerFloorsRamales={lowerFloorsRamales} planosCtx={planosCtx}
        mats={mats} activeNet={activeNet} setDiamSel={setDiamSel}
      />
      <ConfirmDialog confirmState={confirmState} setConfirmState={setConfirmState} />
      <AlertDialog alertDialogState={alertDialogState} setAlertDialogState={setAlertDialogState} />
      <AccesorioModal
        modalState={accesorioModal}
        onClose={() => setAccesorioModal(prev => ({ ...prev, isOpen: false }))}
        onSelect={onAccesorioSelected}
      />

      {/* Sidebar Right (was PdfViewerSidebarRight) */}
      <div className="visor-sidebar-right" style={dynamicRightStyle}>
        <h2 style={PdfViewer_S3}>Panel de edición</h2>
        <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Nivel</div>
          <select aria-label="Seleccionar nivel" value={selectedNivel??''} onChange={e=>{
            const v=e.target.value?Number(e.target.value):null;
            const idx = v !== null ? planos.findIndex(p => p.nivel === v && p.status === 'confirmed') : -1;
            setSelectedNivel(v);
            if (idx >= 0 && onSelectPlan) onSelectPlan(idx);
          }}
            style={PdfViewer_S4}>
            <option value="">— Seleccionar piso —</option>
            {pisos.toSorted((a,b)=>b.n-a.n).map(s=>{
              const tienePlano=planos.some(p=>p.nivel===s.n&&p.status==='confirmed');
              return <option key={s.id} value={s.n}>{tienePlano?'🟢 ':''}{pisoLbl(s.n)} ({s.npt} m)</option>;
            })}
          </select>
          {planoAsocInfo}
        </div>

        <CopyFromPlanPanel
          engineRef={engineRef} currentId={currentId} currentIdRef={currentIdRef}
          planosCtx={planosCtx} pisos={pisos} visibleNets={finalVisibleNets}
        />

        <div style={rightSidebarOpacity}>
          <TipoTramoSelector
            tipoTramo={tipoTramo} setTipoTramo={setTipoTramo}
            padreTributarioId={padreTributarioId} setPadreTributarioId={setPadreTributarioId}
            drawnElements={drawnElements} engineRef={engineRef}
          />

          <TramoEditor
            selElement={selElement} activeNet={activeNet} engineRef={engineRef}
            diamSel={diamSel} gasMatSel={gasMatSel} pendSel={pendSel} pendInput={pendInput}
            mats={mats} matLongName={matLongName}
            setDiamSel={setDiamSel} setGasMatSel={setGasMatSel} setPendSel={setPendSel} setPendInput={setPendInput}
            setSelElement={setSelElement} handleUpdateSel={handleUpdateSel} handleRotateLabel={handleRotateLabel}
            plans={planosCtx.plans} pisos={pisos}
          />

          <BajanteAsociacion
            selElement={selElement} setSelElement={setSelElement}
            selectedNivel={selectedNivel} pisoLbl={pisoLbl}
            lowerFloorsRamales={lowerFloorsRamales} planosCtx={planosCtx} engineRef={engineRef}
          />

          {!(selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante' || selElement.tipo === 'area' || selElement.id?.startsWith('AR'))) && (
            <AparatosPanel activeNet={activeNet} selElement={selElement} planId={currentId} />
          )}

          <PdfViewerDrawnElements drawnElements={drawnElements} activeNet={activeNet} selElement={selElement} engineRef={engineRef} />

          <div style={{flex:1}}/>
        </div>
      </div>

      <button type="button"
        onClick={() => setLeftCollapsed(!leftCollapsed)}
        style={{ ...PdfViewer_S5, left: leftCollapsed ? 0 : 180, borderLeft: leftCollapsed ? "1px solid #3a494a" : "none", borderRadius: "0 0 3px 0", transition: "left 0.2s ease" }}
        title={leftCollapsed ? "Expandir barra izquierda" : "Colapsar barra izquierda"}
        aria-label={leftCollapsed ? "Expandir barra izquierda" : "Colapsar barra izquierda"}
      >
        {leftCollapsed ? "▶" : "◀"}
      </button>

      <button type="button"
        onClick={() => setRightCollapsed(!rightCollapsed)}
        style={{ ...PdfViewer_S5, right: rightCollapsed ? 0 : 210, borderRight: rightCollapsed ? "1px solid #3a494a" : "none", borderRadius: "0 0 0 3px", transition: "right 0.2s ease" }}
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
