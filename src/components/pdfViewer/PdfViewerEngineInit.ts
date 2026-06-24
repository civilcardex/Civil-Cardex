import { useState, useRef, useEffect, useCallback } from "react";
import { getPdfjs } from "../../utils/lazyPdfjs";
import PlanoEngine from "../../lib/PlanoEngine";
import { saveToStorage, saveTrazosToDB } from "../../services/storageService";

interface UsePdfViewerEngineParams {
  currentFile: File | null;
  currentId: string | undefined;
  currentIdRef: React.MutableRefObject<string | undefined>;
  activeNetRef: React.MutableRefObject<string>;
  cwRef: React.RefObject<HTMLDivElement | null>;
  drawCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  pdfCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onStatus: (msg: string) => void;
  onDirty: (eng: PlanoEngine) => void;
  onSelect: (el: any) => void;
  onDelete: (ids: string[]) => void;
  onToolChange: (tool: string) => void;
  onRequestText: (x: number, y: number, cb: (text: string) => void) => void;
  loadTrazosForPlan: (eng: PlanoEngine, id: string) => Promise<boolean>;
  setActiveNet: (net: string) => void;
  setScaleM: (sm: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  scale: number;
}

export function usePdfViewerEngine({
  currentFile,
  currentId,
  currentIdRef,
  activeNetRef,
  cwRef,
  drawCanvasRef,
  pdfCanvasRef,
  onStatus,
  onDirty,
  onSelect,
  onDelete,
  onToolChange,
  onRequestText,
  loadTrazosForPlan,
  setActiveNet,
  setScaleM,
  setLoading,
  setError,
  scale,
}: UsePdfViewerEngineParams) {
  const engineRef = useRef<PlanoEngine | null>(null);
  const pdfDocRef = useRef<any>(null);
  const mountId = useRef(0);
  const renderTaskRef = useRef<any>(null);
  const renderingRef = useRef(false);
  const [numPages, setNumPages] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const pdfRenderedRef = useRef(false);
  const loadingPlanRef = useRef(false);

  const renderPage = useCallback(async (pageNum: number, sc: number, mountCheck: number) => {
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
      const task = page.render({ canvas: pdfCanvas, viewport });
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
          const eng = engineRef.current;
          eng.dpr = dpr;
          eng.setPageSize(viewport.width, viewport.height);
          eng.resizeCanvas(viewport.width, viewport.height);

          const resolvedId = eng._loadedPlanId || currentIdRef.current || 'work';
          if (eng.ramales.length === 0 && eng.bajantes.length === 0 && eng.dims.length === 0 && eng.textAnnots.length === 0 && eng.areas.length === 0) {
            const loaded = await loadTrazosForPlan(eng, resolvedId);
            if (loaded) {
              const loadedNet = eng.activeNet || activeNetRef.current || 'af';
              const sm = eng.scaleM;
              setActiveNet(loadedNet);
              if (sm != null) setScaleM(String(sm));
              eng.render();
            }
          }
          pdfRenderedRef.current = true;
        }
      }
    } catch (err) {
      if ((err as any)?.name === 'RenderingCancelledException') return;
      if (mountCheck && mountCheck !== mountId.current) return;
      if (import.meta.env.DEV) console.error("Error renderizando pagina:", err);
      setError(String(err));
    } finally {
      renderingRef.current = false;
    }
  }, [currentIdRef, activeNetRef, loadTrazosForPlan, setActiveNet, setScaleM, setError, pdfCanvasRef, drawCanvasRef]);

  useEffect(() => {
    if (!cwRef.current || !drawCanvasRef.current) return;
    const cw = cwRef.current;
    const canv = drawCanvasRef.current;
    if (engineRef.current) engineRef.current.destroy();
    const pdfWrap = pdfCanvasRef.current?.parentElement ?? undefined;
    const eng = new PlanoEngine(cw, pdfWrap!, canv);
    engineRef.current = eng;
    const initialId = currentIdRef.current || currentId || '';
    eng._loadedPlanId = initialId || null;
    eng.onSelect((el) => onSelect(el));
    eng.onStatus((msg) => onStatus(msg));
    eng.onDelete((ids) => onDelete(ids));
    eng.onDirty(() => {
      eng._dirty = true;
      onDirty(eng);
    });
    eng.onRequestText(onRequestText);
    const origSetTool = eng.setTool.bind(eng);
    eng.setTool = (t) => {
      origSetTool(t);
      onToolChange(t);
    };
    setEngineReady(true);
    return () => {
      try {
        if (!loadingPlanRef.current && eng._dirty) {
          const id = eng._loadedPlanId || currentIdRef.current || 'work';
          const work = eng.saveWork() as any;
          work.ts = Date.now();
          saveToStorage(`trazos_${id}`, work);
          if (id !== 'work') {
            saveToStorage('last_tracos_id', id);
            saveTrazosToDB(id, work);
          }
        }
      } catch (e) { if (import.meta.env.DEV) console.error('[CLEANUP] error', e); }
      eng.setTool = origSetTool;
      eng.destroy();
      engineRef.current = null;
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
        const pdfjsLib = await pdfjsPromise;
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (thisMount !== mountId.current) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
        await renderPage(1, scale, thisMount);
      } catch (err) {
        if (thisMount === mountId.current) {
          if (import.meta.env.DEV) console.error("Error cargando PDF:", err);
          setError("Error cargando PDF");
          setLoading(false);
        }
      }
    };

    reader.onerror = () => {
      setError("No se pudo leer el archivo.");
      setLoading(false);
    };

    const pdfjsPromise = getPdfjs();
    reader.readAsArrayBuffer(currentFile);
  }, [currentId]);

  useEffect(() => {
    if (!pdfDocRef.current) return;
    mountId.current += 1;
    renderPage(1, scale, mountId.current);
  }, [scale]);

  return {
    engineRef,
    numPages,
    engineReady,
    renderPage,
    mountId,
    loadingPlanRef,
  };
}
