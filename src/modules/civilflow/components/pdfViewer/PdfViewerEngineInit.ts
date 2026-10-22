import { useState, useRef, useEffect, useCallback } from 'react';
import { getPdfjs } from '../../utils/lazyPdfjs';
import { pdfDeCache, pdfACache, calentarPdfs } from './pdfCache.ts';
import { instalarCfCam } from './diagCamara.ts';
import { useReRasterEscala } from './useReRasterEscala.ts';
import { encuadrarContenido } from '../../lib/PlanoEngine/planoCamera.ts';
import { bboxDelDibujo } from './drawingBBox.ts';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { saveToStorage, saveTrazosToDB } from '../../services/storageService.ts';
import { devError } from '../../../../utils/devError.ts';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { cargarMallas } from '../../lib/PlanoEngine/nodos';
import {
  escalaDeDoc,
  filaRender,
  guardarPaginaDeDoc,
  paginaDeDoc,
  type RenderReq,
} from '../../utils/planScale.ts';
import { registraCarga } from '../../utils/cargaDiagnostico.ts';

interface UsePdfViewerEngineParams {
  currentFile: File | null;
  /** Todos los planos del proyecto: para precalentar el parse de sus PDFs tras la 1ª entrada
   *  y que los cambios de piso no re-parseen nada (cambio fluido, ped. usuario). */
  files?: Array<{ id: number; file: File }>;
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
  files,
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
  // Secuencia de carga: cada apertura del PDF incrementa este contador. El overlay de carga
  // se baja al terminar la carga vigente, NO cuando cambia el montaje (un re-raster por zoom
  // o por cambio de escala movía el mountId y dejaba el spinner colgado).
  const cargaSeq = useRef(0);
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
  // Re-sincroniza el re-raster de fondo con el zoom REAL (lo llama el loader tras el primer
  // render): lastZoomRaster nace en 1 y el fit de entrada deja el zoom en otro valor.
  const reprogramarBgRef = useRef<(() => void) | null>(null);
  // Trazabilidad + dedupe de re-rasters completos (parpadeo del plano del piso de entrada,
  // orig. usuario): un renderPage FULL con la MISMA escala se SALTA — el flip repetido de la
  // escala del estado entre dos escritores era un bucle de raster visible como parpadeo.
  const ultimoFullScRef = useRef<number | null>(null);
  const renderCountRef = useRef(0);
  const causaRenderRef = useRef<string>('-');
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
      opts: { bgOnly?: boolean; extraScale?: number; causa?: string } = {},
    ) => {
      renderCountRef.current += 1;
      causaRenderRef.current = opts?.causa ?? (opts?.bgOnly ? 'bg' : 'full');
      // extraScale > 1: rasteriza el fondo a mayor densidad (zoom en vivo) SIN tocar el
      // drawCanvas ni el engine — el bitmap sube de resolución y el scale() por CSS del
      // pdfWrap deja de estirar píxeles (planos borrosos, ped. usuario).
      // Pedido SIN tope duro de 2× (a zoom de trabajo, extra < zoom estira el bitmap):
      // el presupuesto post-viewport es el único límite (lado ≤6000px, área ≤24MP).
      const extraPedido = opts.extraScale ?? 1;
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
        // Presupuesto del bitmap: la densidad extra pedida se recorta a lado ≤6000px y
        // área ≤40MP — hojas grandes en pantallas dpr>=2 sin reventar memoria; el zoom
        // hasta ~3× sigue viéndose nativo también a 150% de escala de Windows (antes
        // dpr>=2 quedaba clavado en 1×).
        // A PROPÓSITO la lámina se rasteriza ENTERA (no solo el área visible): con el fondo
        // completo, arrastrar y desplazar la cámara no vuelve a rasterizar nada; rasterizar
        // por viewport obligaría a rehacer el fondo en cada paneo (el "trabado" original).
        const lado = Math.max(viewport.width, viewport.height) * dpr;
        const extra = Math.max(
          1,
          Math.min(
            extraPedido,
            6000 / lado,
            Math.sqrt(40e6 / (viewport.width * viewport.height * dpr * dpr)),
          ),
        );
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
        // Asignar width/height LIMPIA el bitmap: si el tamaño no cambió (re-raster a igual
        // densidad o cambio de piso con la misma hoja), NO tocar — el fondo anterior queda
        // visible hasta que el nuevo render termine (cambio de piso sin flash, ped. usuario).
        const hi = extra > 1 ? page.getViewport({ scale: sc * extra }) : null;
        const nuevoW = Math.floor((hi ?? viewport).width * dpr);
        const nuevoH = Math.floor((hi ?? viewport).height * dpr);
        const reDimensionado = pdfCanvas.width !== nuevoW || pdfCanvas.height !== nuevoH;
        if (pdfCanvas.width !== nuevoW) pdfCanvas.width = nuevoW;
        if (pdfCanvas.height !== nuevoH) pdfCanvas.height = nuevoH;
        pdfCanvas.style.width = viewport.width + 'px';
        pdfCanvas.style.height = viewport.height + 'px';
        const ctx = pdfCanvas.getContext('2d')!;
        // Fondo del plano: suavizado de alta calidad (texto/líneas finas); el FALSE queda
        // para la capa de trazos (crisp).
        ctx!.imageSmoothingEnabled = true;
        ctx!.imageSmoothingQuality = 'high';
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Limpiar SOLO si re-dimensionó (el resize ya deja el canvas vacío): sin resize, el
        // clearRect borraría el fondo anterior que precisamente estamos conservando — el
        // render nuevo pinta la hoja completa encima (opaca).
        if (reDimensionado) ctx!.clearRect(0, 0, (hi ?? viewport).width, (hi ?? viewport).height);
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

        if (!opts.bgOnly) {
          // Re-encuadre tras el raster REAL (el fit de entrada usó el tamaño PERSISTIDO de la
          // lámina; el viewport real puede diferir): corrige antes de que suba el velo.
          const cwFit = cwRef.current;
          if (cwFit && engineRef.current) {
            encuadrarContenido(engineRef.current, cwFit, bboxDelDibujo(engineRef.current));
          }
        }

        // Repintar los elementos sobre la lámina recién rasterizada: si ensureCanvasSize
        // re-dimensionó el lienzo de dibujo aquí, quedó limpio — sin esto los elementos no
        // aparecen hasta la siguiente interacción.
        engineRef.current?.render();

        if (opts.bgOnly) {
          renderingRef.current = false;
          return;
        }
        // Full render completado con esta escala: los dedupes de los llamadores (efecto de
        // escala / evento) la usan para no re-rasterizar el mismo valor.
        ultimoFullScRef.current = sc;

        const drawCanvas = drawCanvasRef.current;
        if (drawCanvas && engineRef.current) {
          // UN SOLO dueño del tamaño del lienzo de dibujo: el motor (`ensureCanvasSize`,
          // fórmula de área visible). renderPage le pasaba HOJA×dpr y el motor volvía a
          // ÁREA-VISIBLE en el siguiente render — cada cambio de tamaño limpia el canvas y
          // repinta: el plano PARPADEABA en bucle hasta que un trazo lo asentaba
          // (orig. usuario). El resize del motor ya lleva backing × dpr + setTransform.
          const eng = engineRef.current;
          eng.dpr = dpr;
          eng.setPageSize(viewport.width, viewport.height);
          eng.ensureCanvasSize();
          const dctx = drawCanvas.getContext('2d');
          dctx!.imageSmoothingEnabled = false;
          dctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

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
          // Diagnóstico de la carga: con qué escala se rasterizó la lámina, de qué tamaño
          // quedó y con qué cámara quedó el encuadre (para comparar dos sesiones).
          try {
            registraCarga(resolvedId, {
              escalaRaster: sc,
              pageW: viewport.width,
              pageH: viewport.height,
              zoom: eng.zoom,
              offX: eng.offX,
              offY: eng.offY,
              elementos: eng.ramales.length + eng.bajantes.length + eng.areas.length,
            });
          } catch {
            /* el diagnóstico es best-effort */
          }
          pdfRenderedRef.current = true;
          try {
            callbacksRef.current.onReady?.();
          } catch {
            /* ignorar */
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
      cwRef,
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
    // El loader re-sincroniza la densidad del fondo tras el primer render (ver refs arriba).
    reprogramarBgRef.current = () => {
      lastZoomRaster = engineRef.current?.zoom ?? 1;
      scheduleBg(300);
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
    // El lienzo de DIBUJO (los ramales) se re-mide cuando cambia el área visible: sin esto
    // se quedaba con el tamaño inicial y el trazo se cortaba por un lado al plegar una
    // barra (el PDF de fondo, que es CSS, sí llegaba al borde).
    eng.watchContainerSize();
    if (pdfWrap)
      zoomObserver.observe(pdfWrap, { attributeFilter: ['style'], attributeOldValue: false });
    engineRef.current = eng;
    // Diagnóstico: instancia accesible desde la consola para depurar conteos/trazos
    // (window.__cfEngine.ramales.map(r=>[r.id,r.label,r.tipo])).
    // Solo en DEV: en producción el motor vivo expone el proyecto del cliente a cualquiera
    // que abra la consola del navegador.
    if (import.meta.env.DEV) {
      (window as unknown as { __cfEngine?: PlanoEngine }).__cfEngine = eng;
    }
    // Dump __cfCam: diagnóstico de alineación lámina↔dibujo (módulo diagCamara, solo DEV).
    if (import.meta.env.DEV) {
      instalarCfCam({
        engineRef,
        currentIdRef,
        lastRenderScRef,
        lastPageBaseWRef,
        renderCountRef,
        causaRenderRef,
      });
    }
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
              // El lienzo de DIBUJO mide el área VISIBLE (lo fija el motor en su primer render);
              // aquí solo se asegura la medida antes del primer paint.
              eng2.ensureCanvasSize();
              // Cámara calibrada bajo OTRA rasterización (pre-fix, lámina a 0.5): con la
              // lámina a su tamaño real los bordes caen fuera del viewport y el overflow del
              // contenedor los RECORTA (el "recuadro"). Re-encuadre síncrono ANTES del
              // primer paint — mismo cálculo que "Ajustar" (solo zoom/offX/offY; la
              // geometría y la escala no se tocan).
              // Encuadre INCONDICIONAL pre-paint (ped. usuario: "que siempre se muestre
              // centrado el plano" + "el pequeño salto mientras se acomodan"): entrar a un
              // piso SIEMPRE muestra el dibujo encajado — la cámara guardada deja de mandar
              // en la entrada y la resolución local-vs-BD posterior no produce reacomodo.
              encuadrarContenido(eng2, cwRef.current, bboxDelDibujo(eng2));
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
    mountId.current += 1;
    const thisMount = mountId.current;
    // Secuencia de CARGA (no de montaje): el overlay se baja cuando termina ESTA carga. Si se
    // comprobara el mountId, cualquier render extra (re-raster por zoom o por cambio de escala)
    // invalidaría la comprobación y dejaría el spinner colgado para siempre (orig. usuario).
    const thisCarga = ++cargaSeq.current;
    // Precalentar el RESTO de los pisos (una sola vez por sesión): parse en reposo tras la
    // primera entrada — los switches posteriores caen en la caché y no re-parsean nada.
    const calentarResto = (): void => calentarPdfs(files ?? []);
    // Cache hit: sin parse y SIN NINGÚN spinner (ni overlay ni velo). El canvas conserva
    // el bitmap anterior mientras rasteriza el nuevo → swap imperceptible.
    const enCache = pdfDeCache(currentFile);
    if (enCache) {
      void (async () => {
        try {
          pdfDocRef.current = enCache;
          setError(null);
          await renderPage(1, escalaDeDoc(currentId) ?? scaleRef.current, thisMount, {
            causa: 'loader-cache',
          });
          reprogramarBgRef.current?.();
          calentarResto();
        } catch (err) {
          if (thisCarga === cargaSeq.current) {
            devError('Error rasterizando PDF en caché:', err);
            setError('Error cargando PDF');
            setLoading(false);
          }
        }
      })();
      return;
    }
    // Overlay desde el MISMO ciclo de montaje: si se levantara en reader.onload (async),
    // el pre-paint local del motor alcanzaba a verse desplazado un instante (el tirón).
    setLoading(true);
    const reader = new FileReader();

    reader.onload = async () => {
      if (thisCarga !== cargaSeq.current) return;
      try {
        setLoading(true);
        setError(null);
        const buffer = reader.result as ArrayBuffer;
        const pdfjsLib = await pdfjsPromise;
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (thisCarga !== cargaSeq.current) return;
        pdfDocRef.current = pdf;
        // Guardar en la caché de parseados: el regreso a este piso (o su precalentamiento)
        // no vuelve a pasar por FileReader + getDocument.
        if (currentFile) pdfACache(currentFile, pdf);
        // F1: la lámina se rasteriza con la ESCALA DEL DOC (no con el default del estado —
        // el loader pone engine.scaleM = docScale DENTRO de este render; rasterizar antes
        // con 0.5 dejaba fondo y dibujo en escalas distintas toda la sesión).
        await renderPage(1, escalaDeDoc(currentId) ?? scaleRef.current, thisMount, {
          causa: 'loader-pdf',
        });
        // Re-sincronizar la densidad del fondo con el zoom real (el fit de entrada cambia
        // el zoom y lastZoomRaster nacía en 1) + precalentar el resto de los pisos.
        reprogramarBgRef.current?.();
        calentarResto();
        // El spinner cubre el PRIMER PAINT COMPLETO + un asentamiento breve: cualquier frame
        // de ajuste (cámara/redes asentándose) queda dentro de la carga, nunca a la vista
        // (orig. usuario: prefiere pantalla de carga un poco más larga al acomodarse).
        if (thisCarga === cargaSeq.current) {
          window.setTimeout(() => {
            if (thisCarga === cargaSeq.current) setLoading(false);
          }, 600);
        }
      } catch (err) {
        if (thisCarga === cargaSeq.current) {
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
  }, [currentFile, currentId, files, renderPage, setError, setLoading]);

  // Re-rasters por escala (prop + evento), con dedupe anti-parpadeo: useReRasterEscala.
  useReRasterEscala({
    pdfDocRef,
    scale,
    currentIdRef,
    engineRef,
    scaleRef,
    ultimoFullScRef,
    renderPage,
  });

  return {
    engineRef,
    engineReady,
    loadingPlanRef,
  };
}
