/**
 * Motor de render del visor (hook): parsea el PDF con pdfjs, rasteriza la lámina a la escala del doc (scaleM = metros por pixel), encola los re-rasters (filaRender: el que llega en vuelo corre al cerrar el actual — última gana) y monta el PlanoEngine sobre el canvas de dibujo.
 * Ej: cambiar de piso no re-parsea nada — calentarPdfs ya parseó todos los planos tras la 1ª entrada.
 * Piezas extraídas (extracción verbatim, en engineInit/): parsePdf (carga/parseo), renderLamina (raster) y colaRender (cola última-gana). Aquí quedan los refs compartidos, el montaje del engine y su vínculo con el visor.
 */
import { useState, useRef, useEffect } from 'react';
import { instalarCfCam } from './diagCamera.ts';
import { useReRasterEscala } from './useReRasterScale.ts';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { devError } from '../../../../utils/devError.ts';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { escalaDeDoc, paginaDeDoc } from '../../utils/planScale.ts';
import { guardarAlDesmontar } from './persistStrokes.ts';
import { useRenderLamina, type CallbacksVisor } from './engineInit/renderLamina.ts';
import { useParsePdf } from './engineInit/parsePdf.ts';

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
  const internalLoadingPlanRef = useRef(false);
  const loadingPlanRef = externalLoadingPlanRef ?? internalLoadingPlanRef;
  const scaleRef = useRef(scale);
  const callbacksRef = useRef<CallbacksVisor>({
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

  // Raster de la lámina + cola de re-rasters (extracción: engineInit/renderLamina.ts).
  const { renderPage, hayRasterEnVuelo } = useRenderLamina({
    pdfDocRef,
    pdfCanvasRef,
    drawCanvasRef,
    engineRef,
    currentIdRef,
    activeNetRef,
    mountIdRef: mountId,
    lastRenderScRef,
    lastPageBaseWRef,
    renderCountRef,
    causaRenderRef,
    ultimoFullScRef,
    callbacksRef,
    loadTrazosForPlan,
    setActiveNet,
    setScaleM,
    setError,
  });

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
              // primer paint — MISMA fórmula que el post-raster y el switch
              // (reEncuadrarContenido, bbox del dibujo CON dims; sin dibujo cae a la hoja):
              // una sola fórmula de encuadre = la cámara de entrada es idéntica en todos los
              // pasos y nada se re-acomoda (el salto residual, orig. usuario).
              // Encuadre INCONDICIONAL pre-paint (ped. usuario: "que siempre se muestre
              // centrado el plano"): entrar a un piso SIEMPRE muestra el dibujo encajado —
              // la cámara guardada deja de mandar en la entrada y la resolución
              // local-vs-BD posterior no produce reacomodo.
              eng2.reEncuadrarContenido();
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
        guardarAlDesmontar(eng, currentIdAtInit, loadingPlanRef.current);
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
    scaleRef,
    mountId,
    reprogramarBgRef,
    callbacksRef,
    lastRenderScRef,
    lastPageBaseWRef,
    renderCountRef,
    causaRenderRef,
  ]);

  // Carga/parseo del PDF (extracción: engineInit/parsePdf.ts).
  useParsePdf({
    currentFile,
    files,
    currentId,
    pdfDocRef,
    mountIdRef: mountId,
    scaleRef,
    renderPage,
    reprogramarBgRef,
    hayRasterEnVuelo,
    setLoading,
    setError,
  });

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
    /** ¿Hay raster en vuelo o re-raster encolado? El finCarga del switch la espera: el
     *  re-raster de la corrección de escala va por EVENTO y aterriza después del await del
     *  loader — bajar el velo antes lo dejaba ver (auditoría 2026-10-27, ficha 4). */
    hayRasterEnVuelo,
  };
}
