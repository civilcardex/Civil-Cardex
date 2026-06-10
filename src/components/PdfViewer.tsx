import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import PlanoEngine, { NETS } from "../lib/PlanoEngine";
import { pisoLbl, matLongName, GAS } from "../constants";
import { useProject } from "../context/ProjectContext";
import { usePlans } from "../context/PlansContext";
import { writeSanDrawingSync, writeHydroDrawingSync } from "../utils/drawingSync";
import AparatosPanel from "./FixturesPanel";
import PdfViewerToolbar from "./PdfViewerToolbar";
import PdfCanvas from "./pdfViewer/PdfCanvas";
import TramoEditor, { DIAM_DEFAULT_BY_NET } from "./pdfViewer/TramoEditor";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState("line");
  const [activeNet, setActiveNet] = useState("af");
  const [tipoTramo, setTipoTramo] = useState("ramal");
  const [padreTributarioId, setPadreTributarioId] = useState<string | null>(null);
  const [snapOn, setSnapOn] = useState(true);
  const [scaleM, setScaleM] = useState("0.5");
  const [selectedNivel, setSelectedNivel] = useState<number | null>(null);
  const [hiddenNets, setHiddenNets] = useState<Set<string>>(new Set());
  const [lockedNets, setLockedNets] = useState<Set<string>>(new Set());
  const [statusMsg, setStatusMsg] = useState("Seleccionar");
  const [saveStatus, setSaveStatus] = useState("saved");
  const [selElement, setSelElement] = useState<Record<string, any> | null>(null);
  const [drawnElements, setDrawnElements] = useState<any[]>([]);
  const [diamSel, setDiamSel] = useState<Record<string, string>>({});
  const [gasMatSel, setGasMatSel] = useState<Record<string, string>>({});
  const [pendSel, setPendSel] = useState<Record<string, number>>({});
  const [pendInput, setPendInput] = useState('');
  const [engineReady, setEngineReady] = useState(false);
  const toolRef = useRef(tool);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  toolRef.current = tool;

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
  }, [selElement]);

  useEffect(() => {
    if (!engineRef.current) return;
    const els = engineRef.current.getElementsByNet(activeNet);
    if (els.length > 0 && selElement?.net !== activeNet) {
      setSelElement(els[els.length - 1]);
    } else if (els.length === 0) {
      setSelElement(null);
    }
  }, [activeNet]);

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

  useEffect(() => {
    if (!engineRef.current || !engineReady) return;
    const prevId = engineRef.current._loadedPlanId;
    if (prevId && prevId !== currentId) {
      const prevKey = `civilflow_trazos_${prevId}`;
      try { localStorage.setItem(prevKey, engineRef.current.saveWork()); } catch (_) {}
    }
    const key = `civilflow_trazos_${currentIdRef.current || currentId || 'work'}`;
    console.log('[LOAD] key=', key, 'currentId=', currentId, 'currentIdRef=', currentIdRef.current, 'engineReady=', engineReady);
    try {
      const json = localStorage.getItem(key);
      console.log('[LOAD] json found:', json ? json.length + ' bytes' : 'null', 'ramales in json:', json ? JSON.parse(json).ramales?.length : null);
      if (json) {
        engineRef.current.loadWork(json);
      } else {
        engineRef.current.ramales = [];
        engineRef.current.bajantes = [];
        engineRef.current.areas = [];
        engineRef.current.dims = [];
        engineRef.current.textAnnots = [];
        engineRef.current.selId = null;
        engineRef.current.activeRamal = null;
        engineRef.current.activeArea = null;
        engineRef.current.render();
      }
    } catch (e) { console.error('[LOAD] error', e); }
    engineRef.current._loadedPlanId = currentId;
    try { writeSanDrawingSync(planosCtx.plans); } catch (_) {}
    try { writeHydroDrawingSync(planosCtx.plans); } catch (_) {}
  }, [currentId, engineReady]);

  useEffect(() => {
    try { writeSanDrawingSync(planosCtx.plans); } catch (_) {}
try { writeHydroDrawingSync(planosCtx.plans); } catch (_) {}
  }, [planosCtx.plans.length, currentId, activeNet]);

  useEffect(() => {
    const handler = () => { try { writeSanDrawingSync(planosCtx.plans); } catch (_) {}
try { writeHydroDrawingSync(planosCtx.plans); } catch (_) {} };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [planosCtx.plans.length]);

const saveTrazosToStorage = useCallback(() => {
const eng = engineRef.current;
const id = currentIdRef.current;
if (!eng || !id) return;
const key = `civilflow_trazos_${id}`;
try {
const json = eng.saveWork();
localStorage.setItem(key, json);
} catch (e) {
console.error('[saveTrazos] Error saving trazos key=' + key + ':', e);
}
}, []);

  useEffect(() => {
  window.addEventListener('beforeunload', saveTrazosToStorage);
  return () => window.removeEventListener('beforeunload', saveTrazosToStorage);
  }, [saveTrazosToStorage]);

  useEffect(() => {
  return () => { saveTrazosToStorage(); };
  }, [saveTrazosToStorage]);

const doSave = useCallback(() => {
if (!engineRef.current) return;
const id = currentIdRef.current;
if (!id) return;
const key = `civilflow_trazos_${id}`;
const json = engineRef.current.saveWork();
try { localStorage.setItem(key, json); } catch (_) {}
try { writeSanDrawingSync(planosCtx.plans); } catch (_) {}
try { writeHydroDrawingSync(planosCtx.plans); } catch (_) {}
engineRef.current._dirty = false;
setSaveStatus('saved');
}, [planosCtx.plans]);

useEffect(() => {
const interval = setInterval(() => {
const eng = engineRef.current;
if (!eng) return;
if (eng._dirty && saveStatus === 'saved') {
setSaveStatus('unsaved');
}
}, 300);
return () => clearInterval(interval);
}, [saveStatus]);

useEffect(() => {
if (saveStatus !== 'unsaved') return;
if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
autoSaveTimerRef.current = setTimeout(() => {
if (!engineRef.current?._dirty) { setSaveStatus('saved'); return; }
setSaveStatus('saving');
doSave();
}, 1500);
return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
}, [saveStatus, doSave]);

  const [liveActiveNets, setLiveActiveNets] = useState<Set<string> | null>(() => {
    try {
      const saved = localStorage.getItem('civilflow_active_nets');
      if (saved) return new Set(JSON.parse(saved));
    } catch (_) {}
    return null;
  });

  useEffect(() => {
    const refresh = () => {
      try {
        const saved = localStorage.getItem('civilflow_active_nets');
        setLiveActiveNets(saved ? new Set(JSON.parse(saved)) : null);
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
    if (activeNetworks && activeNetworks.size > 0) return excludeEquipment(NETS.filter(n => activeNetworks.has(n.id)));
    if (liveActiveNets) return excludeEquipment(NETS.filter(n => liveActiveNets.has(n.id)));
    return excludeEquipment(NETS);
  }, [activeNetworks, liveActiveNets]);

  const pdfDocRef = useRef<any>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cwRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<PlanoEngine | null>(null);
  const mountId = useRef(0);
  const renderTaskRef = useRef<any>(null);
  const renderingRef = useRef(false);
  const fileInputSaveRef = useRef<HTMLInputElement | null>(null);
  const scaleRef = useRef(1);

  const syncEngine = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setTool(tool as any);
    eng.setActiveNet(activeNet);
    eng.setTipoTramo(tipoTramo as any);
    eng.setSnap(snapOn);
    eng.setScaleM(scaleM);
    const floorObj = pisos.find(p => p.n === selectedNivel);
    eng.nivelActual = floorObj || null;
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
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const eng = engineRef.current;
      if (eng) setDrawnElements(eng.getElementsByNet(activeNet));
    }, 400);
    return () => clearInterval(id);
  }, [activeNet]);

  useEffect(() => {
    if (!engineRef.current) return;
    setDrawnElements(engineRef.current.getElementsByNet(activeNet));
  }, [selElement, activeNet]);

  useEffect(() => {
    if (!cwRef.current || !drawCanvasRef.current) return;
    const cw = cwRef.current;
    const canv = drawCanvasRef.current;
    if (engineRef.current) engineRef.current.destroy();
    const pdfWrap = pdfCanvasRef.current?.parentElement ?? undefined;
    const eng = new PlanoEngine(cw, pdfWrap!, canv);
    engineRef.current = eng;
    eng.onSelect((el) => setSelElement(el));
    eng.onStatus((msg) => setStatusMsg(msg));
    eng.onDirty(() => {
      if (!autoSaveTimerRef.current) {
        autoSaveTimerRef.current = setTimeout(() => {
          autoSaveTimerRef.current = null;
          saveTrazosToStorage();
          try { writeSanDrawingSync(planosCtx.plans); } catch (_) {}
          try { writeHydroDrawingSync(planosCtx.plans); } catch (_) {}
        }, 800);
      }
    });
    const origSetTool = eng.setTool.bind(eng);
    eng.setTool = (t) => {
      origSetTool(t);
      setTool(t);
    };
    setEngineReady(true);
    return () => {
      console.log('[CLEANUP] running, _loadedPlanId=', eng._loadedPlanId, 'ramales=', eng.ramales?.length);
      try {
        const id = eng._loadedPlanId;
        if (id) {
          const key = `civilflow_trazos_${id}`;
          const work = eng.saveWork();
          console.log('[CLEANUP] saving to', key, 'bytes=', work ? work.length : null);
          localStorage.setItem(key, work);
        }
      } catch (e) { console.error('[CLEANUP] error', e); }
      eng.setTool = origSetTool;
      eng.destroy();
      setEngineReady(false);
    };
  }, []);

  useEffect(() => {
    if (!currentFile) return;
    mountId.current += 1;
    const thisMount = mountId.current;
    const reader = new FileReader();

    reader.onload = async () => {
      if (thisMount !== mountId.current) return;
      try {
        setLoading(true);
        setError(null);
        const buffer = reader.result as ArrayBuffer;
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (thisMount !== mountId.current) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setPageNumber(1);
        setLoading(false);
        await renderPage(1, scale, thisMount);
      } catch (err) {
        if (thisMount === mountId.current) {
          console.error("Error cargando PDF:", err);
          setError("Error cargando PDF");
          setLoading(false);
        }
      }
    };

    reader.onerror = () => {
      setError("No se pudo leer el archivo.");
      setLoading(false);
    };

    reader.readAsArrayBuffer(currentFile);
  }, [currentId]);

  useEffect(() => {
    if (!pdfDocRef.current) return;
    mountId.current += 1;
    renderPage(pageNumber, scale, mountId.current);
  }, [scale]);

  const renderPage = async (pageNum: number, sc: number, mountCheck: number) => {
    if (renderingRef.current) return;
    const pdf = pdfDocRef.current;
    const pdfCanvas = pdfCanvasRef.current;
    if (!pdf || !pdfCanvas) return;

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch (_) {}
      try { await renderTaskRef.current.promise; } catch (_) {}
      renderTaskRef.current = null;
    }
    renderingRef.current = true;

    const dpr = window.devicePixelRatio || 1;

    try {
      const page = await pdf.getPage(pageNum);
      if (mountCheck && mountCheck !== mountId.current) return;
      const viewport = page.getViewport({ scale: sc });
      pdfCanvas.width = Math.floor(viewport.width * dpr);
      pdfCanvas.height = Math.floor(viewport.height * dpr);
      pdfCanvas.style.width = viewport.width + 'px';
      pdfCanvas.style.height = viewport.height + 'px';
      const ctx = pdfCanvas.getContext("2d")!;
      ctx!.imageSmoothingEnabled = false;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, viewport.width, viewport.height);
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (rerr) {
        if ((rerr as any)?.name === 'RenderingCancelledException') { renderingRef.current = false; return; }
        throw rerr;
      }
      renderTaskRef.current = null;

      const drawCanvas = drawCanvasRef.current;
      if (drawCanvas) {
        drawCanvas.width = Math.floor(viewport.width * dpr);
        drawCanvas.height = Math.floor(viewport.height * dpr);
        drawCanvas.style.width = viewport.width + 'px';
        drawCanvas.style.height = viewport.height + 'px';
        const dctx = drawCanvas.getContext('2d');
        dctx!.imageSmoothingEnabled = false;
        dctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (engineRef.current) {
          engineRef.current.dpr = dpr;
          engineRef.current.setPageSize(viewport.width, viewport.height);
          engineRef.current.resizeCanvas(viewport.width, viewport.height);
        }
      }
    } catch (err) {
      if ((err as any)?.name === 'RenderingCancelledException') return;
      if (mountCheck && mountCheck !== mountId.current) return;
      console.error("Error renderizando pagina:", err);
      setError(String(err));
    } finally {
      renderingRef.current = false;
    }
  };

  const goToPage = useCallback((target: number) => {
    if (target < 1 || target > numPages) return;
    setPageNumber(target);
    mountId.current += 1;
    renderPage(target, scale, mountId.current);
  }, [numPages, scale]);

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
    eng.offX = (cw.clientWidth - eng.pageW * sc) / 2;
    eng.offY = 16;
    eng.render();
  }, []);

  const handleClear = useCallback(() => {
    if (!engineRef.current) return;
    const netId = activeNet;
    const netName = NETS.find(n => n.id === netId)?.name || netId;
    if (window.confirm(`¿Deseas eliminar todo el trazado de la red activa (${netName})? Esta acción no se puede deshacer.`)) {
      engineRef.current.clearNet(netId);
      setSelElement(null);
    }
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
    const label = selElement.label || selElement.id || 'elemento';
    if (window.confirm(`¿Deseas eliminar el ramal seleccionado (${label})?`)) {
      engineRef.current.deleteSelected();
      setSelElement(null);
    }
  }, [selElement]);

  const handleUpdateSel = useCallback((field: string, value: any) => {
    if (!engineRef.current || !selElement) return;
    engineRef.current.updateSelected({ [field]: value });
    setSelElement({ ...selElement, [field]: value });
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
    } else if (!selElement) {
      const p = pendSel[activeNet];
      setPendInput(p !== undefined && p > 0 ? String(p) : '');
    }
  }, [selElement?.id, activeNet]);

  useEffect(() => {
    const c = drawCanvasRef.current;
    if (c) {
      c.style.cursor = tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair';
    }
  }, [tool]);

  const netObj = NETS.find(n => n.id === activeNet);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
      background: "#111317", border: "1px solid #3a494a", overflow: "hidden",
    }}>
      {/* Network toolbar — horizontal strip above canvas */}
      <div style={{
        height: 38, flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
        padding: "0 8px", background: "#14161a", borderBottom: "1px solid #3a494a",
        overflowX: "auto", overflowY: "hidden", justifyContent: "center",
      }}>
        <div style={{flex:1,minWidth:4}}/>
        {finalVisibleNets.map((n: any) => {
          const isActive=activeNet===n.id;
          const isHidden=hiddenNets.has(n.id);
          const isLocked=lockedNets.has(n.id);
          return <div key={n.id} style={{display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
            <button onClick={()=>setActiveNet(n.id)}
              title={`Red ${n.name.charAt(0).toLowerCase() + n.name.slice(1)}${isLocked?' (bloqueada)':''}`}
              style={{
                padding:"2px 8px", background:isActive?n.col+'22':"transparent",
                borderTop:`1px solid ${isActive?n.col:'#3a494a'}`,
                borderRight:`1px solid ${isActive?n.col:'#3a494a'}`,
                borderBottom:`1px solid ${isActive?n.col:'#3a494a'}`,
                borderLeft:`3px solid ${n.col}`,
                borderRadius:"3px", color:isActive?n.col:"#849495",
                cursor:"pointer", fontFamily:"'Geist',monospace", fontWeight:600,
                fontSize:10, whiteSpace:"nowrap", opacity:isHidden?0.5:1,
                textDecoration:isLocked&&isActive?'line-through':'none',
              }}>
              {isLocked&&isActive?'🔒 ':' '}{isHidden?'👻 ':' '}Red {n.name.charAt(0).toLowerCase() + n.name.slice(1)}
            </button>
            <button onClick={()=>{
              const next=new Set(hiddenNets);
              if(next.has(n.id))next.delete(n.id);else next.add(n.id);
              setHiddenNets(next);
              if(engineRef.current)engineRef.current.setNetHidden(n.id,next.has(n.id));
            }}
              style={{
                padding:"3px 6px", background:"transparent", border:"none",
                cursor:"pointer", fontSize:14, flexShrink:0, lineHeight:1,
                color:isHidden?'#6b8cae':n.col,
                opacity:isHidden?0.5:1,
                textDecoration:isHidden?'line-through':'none',
              }}
              title={isHidden?'Mostrar':'Ocultar'}>
              {isHidden?'👁‍🗨':'👁'}
            </button>
            <button onClick={()=>{
              const next=new Set(lockedNets);
              if(next.has(n.id))next.delete(n.id);else next.add(n.id);
              setLockedNets(next);
              if(engineRef.current)engineRef.current.setNetLocked(n.id,next.has(n.id));
            }}
              style={{
                padding:"3px 3px", background:"transparent", border:"none",
                cursor:"pointer", fontSize:11, flexShrink:0, lineHeight:1,
                color:lockedNets.has(n.id)?'#6b8cae':n.col,
              }}
              title={lockedNets.has(n.id)?'Desbloquear red':'Bloquear red'}>
              {lockedNets.has(n.id)?'🔒':'🔓'}
            </button>
          </div>;
        })}

        <div style={{flex:1,minWidth:4}}/>
      </div>

      {/* Main area: sidebar + canvas */}
      <div style={{flex:1,display:"flex",minHeight:0}}>

      {/* Sidebar: only Herramientas + Acciones */}
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
          onSelectTool={setTool}
          onSnapToggle={() => setSnapOn(!snapOn)}
        />

        {/* Acciones */}
        <div style={{ padding: "6px 8px 4px", borderBottom: "1px solid #3a494a" }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 9, color: "#849495", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Acciones</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button onClick={handleFit} disabled={!currentFile}
              style={{ ...accBtn, width: "100%", borderColor: "#10B98155", color: "#10B981",
                opacity: !currentFile ? 0.4 : 1, cursor: !currentFile ? 'not-allowed' : 'pointer',
              }}
              title={currentFile ? "Ajustar PDF al visor" : "Carga un plano para poder ajustarlo"}>
              <span style={{ fontSize: 14 }}>⛶</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0, lineHeight: 1.1 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>Ajustar</span>
                <span style={{ fontSize: 8, opacity: 0.7, fontWeight: 400 }}>Encajar PDF al visor</span>
              </div>
            </button>
            <button onClick={handleSave} style={{ ...accBtn, width: "100%" }} title="Guarda los trazados y cambios realizados en el plano para la red activa">
              <span style={{ fontSize: 14 }}>💾</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 0, lineHeight: 1.1, flex: 1 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textAlign: "left" }}>Guardar</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, textAlign: "left",
                  color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'saving' ? '#3b82f6' : '#ef4444',
                }}>
                  {saveStatus === 'saved' ? '✔ Guardado' : saveStatus === 'saving' ? '⏳ Guardando...' : '⚠ Sin guardar'}
                </span>
              </div>
            </button>
            <button onClick={handleUndo} style={{ ...accBtn, width: "100%" }} title="Deshace el último elemento dibujado: ramal, bajante, área, cota o texto. (Ctrl+Z)">
              <span style={{ fontSize: 14 }}>↩</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0, lineHeight: 1.1 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>Deshacer</span>
                <span style={{ fontSize: 8, opacity: 0.7, fontWeight: 400 }}>Último trazo · Ctrl+Z</span>
              </div>
            </button>
            <button onClick={handleClear} style={{ ...accBtn, width: "100%", borderColor: "rgba(255,180,171,.3)", color: "#ffb4ab" }} title="Eliminar todo el trazado de la red activa">
              <span style={{ fontSize: 14 }}>🗑</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0, lineHeight: 1.1 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>Limpiar</span>
                <span style={{ fontSize: 8, opacity: 0.7, fontWeight: 400 }}>Borrar trazado de red activa</span>
              </div>
            </button>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Close drawing */}
        <div style={{padding:"6px 8px",borderTop:"1px solid #3a494a"}}>
        <button onClick={()=>{
          const eng = engineRef.current;
          const key = `civilflow_trazos_${currentIdRef.current || currentId || 'work'}`;
          console.log('[CERRAR] key=', key, 'currentId=', currentId, 'currentIdRef=', currentIdRef.current);
          if (eng) {
            const work = eng.saveWork();
            console.log('[CERRAR] work bytes=', work ? work.length : null, 'ramales=', eng.ramales?.length, 'bajantes=', eng.bajantes?.length);
            try { localStorage.setItem(key, work); console.log('[CERRAR] saved to', key); } catch (e) { console.error('[CERRAR] save error', e); }
            try { writeSanDrawingSync(planosCtx.plans); } catch (_) {}
            try { writeHydroDrawingSync(planosCtx.plans); } catch (_) {}
          }
          window.location.href = '#/civilflowareatrabajo';
        }}
            style={{
              padding: "8px", background: "rgba(211,47,47,.12)", border: "1px solid rgba(211,47,47,.3)", borderRadius: "3px",
              color: "#ef5350", cursor: "pointer", fontFamily: "'Geist',monospace", fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", fontSize: 10,
              transition:"all .15s",
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>)=>{e.currentTarget.style.background='rgba(211,47,47,.25)';e.currentTarget.style.borderColor='rgba(211,47,47,.5)'}}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>)=>{e.currentTarget.style.background='rgba(211,47,47,.12)';e.currentTarget.style.borderColor='rgba(211,47,47,.3)'}}>
            <svg viewBox="0 0 22 22" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 3H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Cerrar dibujo
          </button>
        </div>
      </div>

      {/* Canvas area */}
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

      {/* Right sidebar: Piso, ¿Qué voy a dibujar?, Tramo, Escala */}
      <div className="visor-sidebar-right" style={{
        width: 210, flexShrink: 0, display: "flex", flexDirection: "column",
        background: "#14161a", borderLeft: "1px solid #3a494a",
        overflowY: "auto", overflowX: "hidden",
      }}>
        {/* Nivel */}
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

        {/* ¿Qué voy a dibujar? */}
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

        {/* Escala */}
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

        {/* Cuantificación de aparatos */}
        <AparatosPanel activeNet={activeNet} selElement={selElement} />

        {/* Trazos de red */}
        <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Trazos de red ({drawnElements.length})
          </div>
          {drawnElements.length===0 ? (
            <div style={{fontSize:11,color:'#6b8cae',fontFamily:"'Geist',monospace",padding:'4px 0'}}>
              Ningún trazo dibujado en esta red
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:3}}>
              {drawnElements.map(el=>(
                <div key={el.id}
                  style={{
                    padding:'6px 8px',background:selElement?.id===el.id?'#2563EB22':'#1a1c20',
                    borderRadius:3,cursor:'pointer',border:`1px solid ${selElement?.id===el.id?'rgba(37,99,235,.4)':'#3a494a'}`,
                    display:'flex',flexDirection:'column',gap:4,
                  }}>
                  <div style={{display:'flex',alignItems:'center',gap:4}} onClick={()=>{if(engineRef.current)engineRef.current.selectById(el.id);}}>
                    <span style={{fontSize:11,color:el.type==='bajante'?'#F04545':'#4D8FF7'}}>
                      {el.type==='bajante'?'⬇':'╱'}
                    </span>
<span style={{fontSize:12,fontWeight:600,color:'#b9caca',fontFamily:"'Geist',monospace",flex:1}}>{el.tipo==='tributario'?((()=>{try{const p=drawnElements.find(x=>x.id===el.padre&&x.tipo==='ramal');return p?p.label:el.label;}catch(_){return el.label}})()):el.label}</span>
              <span style={{fontSize:11,fontWeight:600,color:'#6b8cae',fontFamily:"'Geist',monospace",textTransform:'uppercase'}}>{(el.tipo==='ramal'?'ramal':el.tipo==='tributario'?el.label:el.tipo==='bajante'?'baj':el.tipo)||''}</span>
                    <button onClick={e=>{e.stopPropagation();if(engineRef.current){engineRef.current.selectById(el.id);engineRef.current.deleteSelected();}}}
                      style={{padding:'3px 6px',background:'transparent',border:'1px solid #3a494a',borderRadius:2,color:'#ffb4ab',cursor:'pointer',fontSize:10,fontFamily:"'Geist',monospace",flexShrink:0}}>✕</button>
                  </div>
                  <div style={{
                    display:'flex',flexWrap:'wrap',gap:'2px 8px',fontSize:9,
                    color:'#6b8cae',fontFamily:"'Geist',monospace",paddingLeft:17
                  }}>
                    <span>L={typeof el.totalL==='number'?el.totalL.toFixed(1):el.totalL}m</span>
                    {el.type !== 'bajante' && <span>· {el.segs} {el.segs === 1 ? 'seg' : 'segs'}</span>}
                    {(el.pendiente !== undefined && el.pendiente !== null && el.pendiente !== 0 && (activeNet === 'san' || activeNet === 'll')) && (
                      <span>· S={el.pendiente}%</span>
                    )}
                    {el.diametro && <span>· Ø {el.diametro}</span>}
                    {el.piso && <span>· {el.piso}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{flex:1}}/>
      </div>
    </div>
    </div>
  );
}

const iconBtn = {
  padding: "5px 6px", background: "#1e2024", border: "1px solid #3a494a",
  borderRadius: "4px", color: "#b9caca", cursor: "pointer", fontSize: 16,
  fontFamily: "'Geist',monospace", display: "flex", alignItems: "center", justifyContent: "center",
};
const accBtn = {
  padding: "6px 8px", background: "#1e2024", border: "1px solid #3a494a",
  borderRadius: "4px", color: "#b9caca", cursor: "pointer",
  fontFamily: "'Geist',monospace", display: "flex", alignItems: "center", gap: 6,
  transition: "all .12s",
};
const smBtn = {
  padding: "3px 8px", background: "#1e2024", border: "1px solid #3a494a",
  borderRadius: "4px", color: "#b9caca", cursor: "pointer", fontSize: 10,
  fontFamily: "'Geist',monospace",
};
const smInput = {
  padding: "3px 6px", background: "#1e2024", border: "1px solid #3a494a",
  borderRadius: 4, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", textAlign: "center",
};

function navBtnSm(dis: boolean): React.CSSProperties {
  return {
    padding: "3px 8px", background: dis ? "#1e2024" : "#282a2e",
    border: "1px solid #3a494a", borderRadius: "3px",
    color: dis ? "#849495" : "#b9caca", cursor: dis ? "not-allowed" : "pointer",
    opacity: dis ? 0.5 : 1, fontSize: 11, fontFamily: "'Geist',monospace",
  };
}
