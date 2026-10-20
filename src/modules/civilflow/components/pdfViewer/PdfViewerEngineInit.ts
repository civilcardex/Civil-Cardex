import { useState, useRef, useEffect, useCallback } from 'react';
import { getPdfjs } from '../../utils/lazyPdfjs';
import { encuadrarDibujo } from '../../lib/PlanoEngine/planoCamera';
import { bboxDelDibujo } from './drawingBBox';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import { saveToStorage, saveTrazosToDB } from '../../services/storageService';
import { devError } from '../../../../utils/devError';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { cargarMallas } from '../../lib/PlanoEngine/nodos';
import {
  escalaDeDoc,
  filaRender,
  guardarPaginaDeDoc,
  paginaDeDoc,
  type RenderReq,
} from '../../utils/planScale';

interface UsePdfViewerEngineParams {
  currentFile: File | null;
  currentId: string | number | undefined;
  currentIdRef: React.MutableRefObject<string | number | undefined>;
  activeNetRef: React.MutableRefObject<string>;
  cwRef: React.RefObject<HTMLDivElement | null>;
  drawCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  pdfCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onStatus: (msg: string) => void;
  onDirty: (eng: PlanoEngine) => void;
  onSelect: (el: Record<string, unknown> | null) => void;
  onDelete: (ids: string[]) => void;
  onToolChange: (tool: string) => void;
  onRequestText: (x: number, y: number, cb: (text: string) => void) => void;
  onAlert: (title: string, msg: string) => void;
  onAccesorioModal: (data: {
    ramalId: string;
    angleDeg: number;
    junctionIndex: number;
    point: number[];
    net: string;
    isTee?: boolean;
  }) => void;
  loadTrazosForPlan: (eng: PlanoEngine, id: string | number) => Promise<boolean>;
  setActiveNet: (net: string) => void;
  setScaleM: (sm: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  onReady?: () => void;
  scale: number;
  engineRef?: React.MutableRefObject<PlanoEngine | null>;
  loadingPlanRef?: React.MutableRefObject<boolean>;
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
  onAlert,
  onAccesorioModal,
  loadTrazosForPlan,
  setActiveNet,
  setScaleM,
  setLoading,
  setError,
  onReady,
  scale,
  engineRef: externalEngineRef,
  loadingPlanRef: externalLoadingPlanRef,
}: UsePdfViewerEngineParams) {
  // useRef se llama incondicionalmente en cada render (rules-of-hooks) — la fusión con ?? elige
  // cuál objeto ref usar, nunca decide si el hook mismo se ejecuta.
  const internalEngineRef = useRef<PlanoEngine | null>(null);
  const engineRef = externalEngineRef ?? internalEngineRef;
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const mountId = useRef(0);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderingRef = useRef(false);
  // Re-raster pedido mientras había uno en vuelo (F2): se ENCOLA y se ejecuta al cerrar el
  // actual — antes el guard lo descartaba y la lámina se quedaba en la escala vieja.
  const renderPendingRef = useRef<RenderReq | null>(null);
  // El drenaje de la cola invoca renderPage SIN autorreferenciarlo (el compilador no
  // preserva la memoización de un useCallback que se llama a sí mismo).
  const renderPageRef =
    useRef<
      (
        pageNum: number,
        sc: number,
        mountCheck: number,
        opts?: { bgOnly?: boolean; extraScale?: number },
      ) => Promise<void> | null
    >(null);
  // Última escala/página con la que se rasterizó el fondo (dump __cfCam: comparar contra
  // la escala del doc — distintas = lámina y dibujo en escalas distintas).
  const lastRenderScRef = useRef<number | null>(null);
  const lastPageBaseWRef = useRef<number | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const pdfRenderedRef = useRef(false);
  const internalLoadingPlanRef = useRef(false);
  const loadingPlanRef = externalLoadingPlanRef ?? internalLoadingPlanRef;
  const scaleRef = useRef(scale);
  const callbacksRef = useRef({
    onStatus,
    onDirty,
    onSelect,
    onDelete,
    onToolChange,
    onRequestText,
    onAlert,
    onAccesorioModal,
    setActiveNet,
    onReady,
  });

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    callbacksRef.current = {
      onStatus,
      onDirty,
      onSelect,
      onDelete,
      onToolChange,
      onRequestText,
      onAlert,
      onAccesorioModal,
      setActiveNet,
      onReady,
    };
  }, [
    onReady,
    onStatus,
    onDirty,
    onSelect,
    onDelete,
    onToolChange,
    onRequestText,
    onAlert,
    onAccesorioModal,
    setActiveNet,
  ]);

  const renderPage = useCallback(
    async (
      pageNum: number,
      sc: number,
      mountCheck: number,
      opts: { bgOnly?: boolean; extraScale?: number } = {},
    ) => {
      // extraScale > 1: rasteriza el fondo a mayor densidad (zoom en vivo) SIN tocar el
      // drawCanvas ni el engine — el bitmap sube de resolución y el scale() por CSS del
      // pdfWrap deja de estirar píxeles (planos borrosos, ped. usuario).
      // ponytail: densidad total = extra*dpr, tope ~2 — el re-raster es el tirón
      // al soltar la rueda; 3x pedía el doble de píxeles por un detalle invisible.
      const dprCap = Math.max(1, 2 / (window.devicePixelRatio || 1));
      const extra = Math.max(1, Math.min(opts.extraScale ?? 1, 2, dprCap));
      // En vuelo: ENCOLAR (no descartar) — el último pedido gana y corre al cerrar este.
      const req: RenderReq = { pageNum, sc, opts };
      const fila = filaRender(renderingRef.current, renderPendingRef.current, req);
      renderPendingRef.current = fila.pendiente;
      if (!fila.arranca) return;
      const pdf = pdfDocRef.current;
      const pdfCanvas = pdfCanvasRef.current;
      if (!pdf || !pdfCanvas) return;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          /* ignorar */
        }
        try {
          await renderTaskRef.current.promise;
        } catch {
          /* ignorar */
        }
        renderTaskRef.current = null;
      }
      renderingRef.current = true;

      const dpr = window.devicePixelRatio || 1;

      try {
        if (mountCheck && mountCheck !== mountId.current) return;
        const page = await pdf.getPage(pageNum);
        if (mountCheck && mountCheck !== mountId.current) return;
        const viewport = page.getViewport({ scale: sc });
        lastRenderScRef.current = sc;
        lastPageBaseWRef.current = viewport.width / sc;
        // Tamaño de la LÁMINA a escala 1 (el del archivo PDF): se guarda para que la próxima
        // apertura dimensione el lienzo ANTES de que llegue el PDF (sin el "salto" del
        // contenedor ni el "recuadro" que recortaba el trazo). A escala 1 → no caduca cuando
        // el doc se re-basea a la escala global del proyecto.
        if (!opts.bgOnly) {
          const planId = currentIdRef.current || engineRef.current?._loadedPlanId || null;
          guardarPaginaDeDoc(planId, viewport.width / sc, viewport.height / sc);
        }
        // Bitmap a densidad extra (o dpr, lo que dé más); CSS SIEMPRE al tamaño base.
        const hi = extra > 1 ? page.getViewport({ scale: sc * extra }) : null;
        pdfCanvas.width = Math.floor((hi ?? viewport).width * dpr);
        pdfCanvas.height = Math.floor((hi ?? viewport).height * dpr);
        pdfCanvas.style.width = viewport.width + 'px';
        pdfCanvas.style.height = viewport.height + 'px';
        const ctx = pdfCanvas.getContext('2d')!;
        // Fondo del plano: suavizado de alta calidad (texto/líneas finas); el FALSE queda
        // para la capa de trazos (crisp).
        ctx!.imageSmoothingEnabled = true;
        ctx!.imageSmoothingQuality = 'high';
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx!.clearRect(0, 0, (hi ?? viewport).width, (hi ?? viewport).height);
        const task = page.render({ canvas: pdfCanvas, viewport: hi ?? viewport });
        renderTaskRef.current = task;
        try {
          await task.promise;
        } catch (rerr) {
          if ((rerr as { name?: string })?.name === 'RenderingCancelledException') {
            renderingRef.current = false;
            return;
          }
          throw rerr;
        }
        renderTaskRef.current = null;

        if (opts.bgOnly) {
          renderingRef.current = false;
          return;
        }

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
            if (
              eng.ramales.length === 0 &&
              eng.bajantes.length === 0 &&
              eng.dims.length === 0 &&
              eng.textAnnots.length === 0 &&
              eng.areas.length === 0
            ) {
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
            try {
              callbacksRef.current.onReady?.();
            } catch {
              /* ignorar */
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'RenderingCancelledException') return;
        if (mountCheck && mountCheck !== mountId.current) return;
        devError('Error renderizando pagina:', err);
        setError(String(err));
      } finally {
        renderingRef.current = false;
        // Drenar la cola (F2): el re-raster que llegó en vuelo corre ahora, ya libre.
        const pend = renderPendingRef.current;
        const rp = renderPageRef.current;
        if (pend && rp) {
          renderPendingRef.current = null;
          void rp(pend.pageNum, pend.sc, mountId.current, pend.opts);
        }
      }
    },
    [
      currentIdRef,
      activeNetRef,
      loadTrazosForPlan,
      setActiveNet,
      setScaleM,
      setError,
      engineRef,
      pdfCanvasRef,
      drawCanvasRef,
    ],
  );
  useEffect(() => {
    renderPageRef.current = renderPage;
  }, [renderPage]);

  useEffect(() => {
    if (!cwRef.current || !drawCanvasRef.current) return;
    const cw = cwRef.current;
    const canv = drawCanvasRef.current;
    const currentIdAtInit = currentIdRef.current;
    if (engineRef.current) engineRef.current.destroy();
    const pdfWrap = pdfCanvasRef.current?.parentElement ?? undefined;
    // Planos borrosos (ped. usuario): el fondo se rasteriza a escala fija y el scale() por
    // CSS lo estira. Observando el transform del pdfWrap, cuando el zoom se estabiliza
    // re-rasterizamos SOLO el fondo a esa densidad (bgOnly, debounced).
    let zoomRaf = 0;
    let lastZoomRaster = 1;
    // Throttle del re-raster: cada disparo bloquea 30-60ms (pdfjs + upload). Sin throttle,
    // cada pausa del gesto = hitch. Máx 1 cada 1.5s + uno final al estabilizar.
    let lastBgAt = 0;
    const BG_MIN_GAP = 1500;
    const scheduleBg = (delay: number) => {
      window.clearTimeout(zoomRaf);
      zoomRaf = window.setTimeout(() => {
        const wait = BG_MIN_GAP - (Date.now() - lastBgAt);
        if (wait > 0) {
          scheduleBg(wait);
          return;
        }
        lastBgAt = Date.now();
        const z = lastZoomRaster;
        void renderPage(1, scaleRef.current, mountId.current, {
          bgOnly: true,
          extraScale: z,
        }).then(() => {
          // renderPage descarta si había otro render en vuelo: si el zoom se movió
          // mientras tanto, reintenta una vez (si no, el fondo queda rancio).
          if (lastZoomRaster !== z) scheduleBg(600);
        });
      }, delay);
    };
    const zoomObserver = new MutationObserver(() => {
      // Fuente de verdad = engine.zoom, no el string del transform (acopla a su formato).
      const live = engineRef.current?.zoom;
      const zoom =
        typeof live === 'number' && Number.isFinite(live)
          ? live
          : (() => {
              const wrap = pdfCanvasRef.current?.parentElement;
              if (!wrap) return NaN;
              const m = /scale\(([\d.]+)\)/.exec(wrap.style.transform || '');
              return m ? parseFloat(m[1] ?? '1') : NaN;
            })();
      if (!Number.isFinite(zoom)) return;
      // Umbral 0.15 (no 0): el zoom fino acumulado por debajo queda con el bitmap viejo
      // (ligeramente borroso) hasta superar el umbral — precio consciente del throttle.
      if (Math.abs(zoom - lastZoomRaster) < 0.15) return;
      lastZoomRaster = zoom;
      scheduleBg(600);
    });
    const eng = new PlanoEngine(cw, pdfWrap!, canv);
    if (pdfWrap)
      zoomObserver.observe(pdfWrap, { attributeFilter: ['style'], attributeOldValue: false });
    engineRef.current = eng;
    // Diagnóstico: instancia accesible desde la consola para depurar conteos/trazos
    // (window.__cfEngine.ramales.map(r=>[r.id,r.label,r.tipo])).
    (window as unknown as { __cfEngine?: PlanoEngine }).__cfEngine = eng;
    // Dump __cfCam (patrón __cfDiag/__cfScale): verifica que la LÁMINA y el dibujo comparten
    // escala. escalaRender === escalaDoc y pageW === pageW_esperado (px de lámina base ×
    // escalaDoc) = fondo y geometría alineados; distintos = la hoja quedó en otra escala.
    (window as unknown as { __cfCam?: () => unknown }).__cfCam = () => {
      const escalaDoc = escalaDeDoc(currentIdRef.current);
      const escalaRender = lastRenderScRef.current;
      const baseW = lastPageBaseWRef.current;
      return {
        escalaDoc,
        escalaRender,
        pageW_base_px: baseW,
        pageW_esperado: baseW != null && escalaDoc ? baseW * escalaDoc : null,
        pageW_dibujado: escalaRender != null && baseW != null ? baseW * escalaRender : null,
        zoom: eng.zoom,
        offX: eng.offX,
        offY: eng.offY,
      };
    };
    const initialId = currentIdRef.current || '';
    eng._loadedPlanId = initialId || null;
    eng.mallasDeclaradas = cargarMallas(eng._loadedPlanId);
    eng.onSelect((el) => callbacksRef.current.onSelect(el));
    eng.onStatus((msg) => callbacksRef.current.onStatus(msg));
    eng.onDelete((ids) => callbacksRef.current.onDelete(ids));
    eng.onActiveNetChange((net) => callbacksRef.current.setActiveNet(net));
    eng.onAlert((title, msg) => callbacksRef.current.onAlert(title, msg));
    eng.onAccesorioModal((data) => callbacksRef.current.onAccesorioModal(data));
    eng.onDirty(() => {
      eng._dirty = true;
      callbacksRef.current.onDirty(eng);
    });
    eng.onRequestText((x, y, cb) => callbacksRef.current.onRequestText(x, y, cb));
    const origSetTool = eng.setTool.bind(eng);
    eng.setTool = (t) => {
      origSetTool(t);
      callbacksRef.current.onToolChange(t);
    };
    setEngineReady(true);
    // ponytail: load trazados (draw elements) immediately from local cache, INDEPENDENT of PDF render.
    // Previously elements only appeared after renderPage finished the heavy pdfjs render (line ~185),
    // so entering the drawing was slow. Local cache is synchronous — draw overlays show fast.
    {
      const eng2 = engineRef.current;
      if (eng2) {
        const initId = currentIdRef.current || eng2._loadedPlanId || '';
        if (initId) {
          const mk = `trazos_${initId}`;
          const saved = (() => {
            try {
              const raw = localStorage.getItem('civilflow_' + mk);
              return raw ? (JSON.parse(raw) as unknown) : null;
            } catch {
              return null;
            }
          })();
          if (saved) {
            // La escala del DOC antes del primer paint: los elementos nacen en su espacio
            // real y no se ven desplazados mientras "se acomodan" (el loader del PDF
            // confirma la misma escala al terminar; orig. usuario).
            const es = escalaDeDoc(initId);
            // Tamaño FINAL de la lámina (persistido a escala 1 → se aplica con la escala del
            // doc): el lienzo de dibujo y el contenedor quedan con la medida buena desde el
            // primer paint. Sin él, el dibujo se pintaría en un espacio provisional
            // (recortado) y el contenedor se re-centraría al llegar el PDF (el "salto" y el
            // "recuadro" del visor, orig. usuario).
            const pg = es ? paginaDeDoc(initId, es) : null;
            if (es && pg) {
              eng2.scaleM = es;
              eng2.loadWork(typeof saved === 'string' ? saved : (saved as object));
              const pdfCanvas = pdfCanvasRef.current;
              if (pdfCanvas) {
                pdfCanvas.style.width = pg.w + 'px';
                pdfCanvas.style.height = pg.h + 'px';
              }
              eng2.setPageSize(pg.w, pg.h);
              eng2.resizeCanvas(pg.w, pg.h);
              // Cámara calibrada bajo OTRA rasterización (pre-fix, lámina a 0.5): con la
              // lámina a su tamaño real los bordes caen fuera del viewport y el overflow del
              // contenedor los RECORTA (el "recuadro"). Re-encuadre síncrono ANTES del
              // primer paint — mismo cálculo que "Ajustar" (solo zoom/offX/offY; la
              // geometría y la escala no se tocan).
              if (Math.abs(es - scaleRef.current) > 1e-6) {
                const cw = cwRef.current;
                if (cw && eng2.pageW && eng2.pageH) {
                  // Mismo encuadre que el bot\u00f3n "Ajustar": encaja el DIBUJO (no la l\u00e1mina)
                  // para que se vea solo el plano, sin el fondo negro.
                  const encuadre = encuadrarDibujo({
                    visW: cw.clientWidth,
                    visH: cw.clientHeight,
                    pageW: eng2.pageW,
                    pageH: eng2.pageH,
                    bbox: bboxDelDibujo(eng2),
                  });
                  eng2.zoom = encuadre.zoom;
                  eng2.offX = encuadre.offX;
                  eng2.offY = encuadre.offY;
                }
              }
              eng2.render();
              // El estado React = la escala del doc: si no, syncEngine pisa el motor con el
              // default ('0.5') y las longitudes quedan calculadas en la escala equivocada.
              const sm = eng2.scaleM;
              if (sm != null) setScaleM(String(sm));
            }
            // Sin lámina conocida NO se pinta nada aquí: el loader (que corre con el PDF en
            // mano) carga el doc y lo dibuja ya en su sitio definitivo.
          }
        }
      }
    }
    return () => {
      try {
        // Check VIVO de carga (no el capturado al montar): desmontar durante una carga en
        // vuelo con el engine a medio hidratar persistía un trabajo vacío/ajeno con ts fresco
        // bajo el id del plano entrante — borrado de la caché y, vía autosave/BD, del piso.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- el valor VIVO del ref en el cleanup es el objetivo del guard
        if (!loadingPlanRef.current && eng._dirty) {
          const id = eng._loadedPlanId || currentIdAtInit || 'work';
          const work = eng.saveWork();
          work.ts = Date.now();
          saveToStorage(TRAZOS_PREFIX + id, work);
          if (id !== 'work') {
            saveTrazosToDB(String(id), work);
          }
        }
      } catch (e) {
        devError('[CLEANUP] error', e);
      }
      // El desmonte del engine JAMÁS debe lanzar: una excepción aquí crashea el árbol de
      // React durante el cambio de ruta y deja la pantalla congelada en el visor (la URL
      // sí cambia; solo una recarga la recupera — orig. usuario).
      try {
        eng.setTool = origSetTool;
        eng.destroy();
      } catch (e) {
        devError('[CLEANUP] destroy error', e);
      }
      try {
        zoomObserver.disconnect();
        window.clearTimeout(zoomRaf);
      } catch {
        /* ignore */
      }
      engineRef.current = null;
      try {
        setEngineReady(false);
      } catch {
        /* owner ya desmontado */
      }
    };
  }, [
    cwRef,
    currentIdRef,
    drawCanvasRef,
    engineRef,
    loadingPlanRef,
    pdfCanvasRef,
    renderPage,
    setScaleM,
  ]);

  useEffect(() => {
    // Sin lámina que cargar el loading DEBE bajar (C-1): si se quedara en true,
    // onLoadingChange mantenía el overlay z-9999 bloqueando el visor en proyectos sin planos.
    if (!currentFile) {
      setLoading(false);
      return;
    }
    // Overlay desde el MISMO ciclo de montaje: si se levantara en reader.onload (async),
    // el pre-paint local del motor alcanzaba a verse desplazado un instante (el tirón).
    setLoading(true);
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
        // F1: la lámina se rasteriza con la ESCALA DEL DOC (no con el default del estado —
        // el loader pone engine.scaleM = docScale DENTRO de este render; rasterizar antes
        // con 0.5 dejaba fondo y dibujo en escalas distintas toda la sesión).
        await renderPage(1, escalaDeDoc(currentId) ?? scaleRef.current, thisMount);
        // El spinner cubre el PRIMER PAINT COMPLETO + un asentamiento breve: cualquier frame
        // de ajuste (cámara/redes asentándose) queda dentro de la carga, nunca a la vista
        // (orig. usuario: prefiere pantalla de carga un poco más larga al acomodarse).
        if (thisMount === mountId.current) {
          window.setTimeout(() => {
            if (thisMount === mountId.current) setLoading(false);
          }, 600);
        }
      } catch (err) {
        if (thisMount === mountId.current) {
          devError('Error cargando PDF:', err);
          setError('Error cargando PDF');
          setLoading(false);
        }
      }
    };

    reader.onerror = () => {
      setError('No se pudo leer el archivo.');
      setLoading(false);
    };

    const pdfjsPromise = getPdfjs();
    reader.readAsArrayBuffer(currentFile);
  }, [currentFile, currentId, renderPage, setError, setLoading]);

  useEffect(() => {
    if (!pdfDocRef.current) return;
    mountId.current += 1;
    renderPage(1, scale, mountId.current);
  }, [scale, renderPage]);

  return {
    engineRef,
    engineReady,
    loadingPlanRef,
  };
}
