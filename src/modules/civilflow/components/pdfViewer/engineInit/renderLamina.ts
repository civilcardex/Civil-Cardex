/**
 * Raster de la lámina del PDF al canvas de fondo (useRenderLamina): calcula el viewport a la
 * escala del doc, recorta la densidad extra a un presupuesto de memoria (lado ≤6000px, área
 * ≤40MP), corre el render de pdfjs (PDF.js) y al terminar sincroniza el motor (tamaño de
 * página, re-encuadre y trazos del piso).
 * Ej: entrar a un piso llama renderPage(1, escalaDelDoc, mount) y deja la hoja completa pintada.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import { guardarPaginaDeDoc, type RenderReq } from '../../../utils/planScale.ts';
import { registraCarga } from '../../../utils/loadDiagnostics.ts';
import { marcarPrimerPisoCargado } from '../pdfCache.ts';
import { devError } from '../../../../../utils/devError.ts';
import { crearColaRender, type ColaRender } from './colaRender.ts';

/** Callbacks del visor que el hook dueño mantiene frescos en un ref (no recrean el motor ni el raster). */
export interface CallbacksVisor {
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
  setActiveNet: (net: string) => void;
  onReady?: () => void;
}

interface RenderLaminaParams {
  /** Proxy pdfjs del doc vigente (lo escribe la carga en engineInit/parsePdf.ts). */
  pdfDocRef: React.RefObject<PDFDocumentProxy | null>;
  pdfCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  drawCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  engineRef: React.RefObject<PlanoEngine | null>;
  currentIdRef: React.RefObject<string | number | undefined>;
  activeNetRef: React.RefObject<string>;
  /** Contador de montaje: un raster de un montaje viejo se aborta al comparar contra él. */
  mountIdRef: React.RefObject<number>;
  /** Diagnóstico __cfCam (solo DEV, lo lee diagCamera.ts): última escala y ancho base rasterizados. */
  lastRenderScRef: React.RefObject<number | null>;
  lastPageBaseWRef: React.RefObject<number | null>;
  renderCountRef: React.RefObject<number>;
  causaRenderRef: React.RefObject<string>;
  /** Dedupe de re-rasters por escala (lo lee useReRasterScale.ts): un FULL deja la escala aquí. */
  ultimoFullScRef: React.RefObject<number | null>;
  callbacksRef: React.RefObject<CallbacksVisor>;
  loadTrazosForPlan: (eng: PlanoEngine, id: string | number) => Promise<boolean>;
  setActiveNet: (net: string) => void;
  setScaleM: (sm: string) => void;
  setError: (e: string | null) => void;
}

/**
 * Rasteriza la lámina (renderPage) sobre el canvas del PDF y sincroniza el motor al terminar;
 * expone `hayRasterEnVuelo` para que el velo de carga no se baje con rasters pendientes.
 */
export function useRenderLamina({
  pdfDocRef,
  pdfCanvasRef,
  drawCanvasRef,
  engineRef,
  currentIdRef,
  activeNetRef,
  mountIdRef,
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
}: RenderLaminaParams): {
  renderPage: (
    pageNum: number,
    sc: number,
    mountCheck: number,
    opts?: { bgOnly?: boolean; extraScale?: number; causa?: string },
  ) => Promise<void>;
  hayRasterEnVuelo: () => boolean;
} {
  const renderTaskRef = useRef<RenderTask | null>(null);
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
  const pdfRenderedRef = useRef(false);
  // Lanzador del drenaje: la cola lo invoca al CERRAR el turno (fuera del render). Va por
  // parámetro y NO al crear la cola — un ref no cruza ninguna llamada en pleno render.
  const lanzarPendiente = useCallback((req: RenderReq, mountCheck: number): boolean => {
    const rp = renderPageRef.current;
    if (!rp) return false;
    void rp(req.pageNum, req.sc, mountCheck, req.opts);
    return true;
  }, []);
  const colaRef = useRef<ColaRender | null>(null);
  if (colaRef.current == null) colaRef.current = crearColaRender();
  const cola = colaRef.current;

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
      if (!cola.decidir(req)) return;
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
      cola.abrir();

      const dpr = window.devicePixelRatio || 1;

      try {
        if (mountCheck && mountCheck !== mountIdRef.current) return;
        const page = await pdf.getPage(pageNum);
        if (mountCheck && mountCheck !== mountIdRef.current) return;
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
            cola.liberar();
            return;
          }
          throw rerr;
        }
        renderTaskRef.current = null;

        // Tamaño de página del piso NUEVO ANTES de re-encuadrar: el fitPage del piso vacío
        // usa pageW — con el del piso ANTERIOR el encuadre salía equivocado y el reacomodo
        // llegaba tarde (bug de orden puro, orig. usuario: «el salto sigue pasando»).
        const eng0 = engineRef.current;
        if (!opts.bgOnly && eng0) {
          eng0.setPageSize(viewport.width, viewport.height);
        }

        // Re-encuadre tras el raster REAL (misma fórmula que pre-paint/switch): la cámara
        // no se mueve un píxel entre el primer paint y aquí (salto residual, orig. usuario).
        if (!opts.bgOnly) engineRef.current?.reEncuadrarContenido();

        // Repintar tras el raster (el lienzo pudo re-dimensionarse y quedó vacío) + marcar
        // el primer piso SOLO al completar el ÚLTIMO raster completo: la corrección de
        // escala dispara uno después de la carga de trazos y marcar antes dejaba ver el
        // re-encuadre («salto residual»). Idempotente.
        engineRef.current?.render();
        marcarPrimerPisoCargado();

        if (opts.bgOnly) {
          cola.liberar();
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
        if (mountCheck && mountCheck !== mountIdRef.current) return;
        devError('Error renderizando pagina:', err);
        setError(String(err));
      } finally {
        // Drenar la cola (F2): el re-raster que llegó en vuelo corre ahora, ya libre.
        cola.cerrar(mountIdRef.current, lanzarPendiente);
      }
    },
    [
      pdfDocRef,
      mountIdRef,
      callbacksRef,
      lastRenderScRef,
      lastPageBaseWRef,
      renderCountRef,
      causaRenderRef,
      ultimoFullScRef,
      currentIdRef,
      activeNetRef,
      loadTrazosForPlan,
      setActiveNet,
      setScaleM,
      setError,
      engineRef,
      pdfCanvasRef,
      drawCanvasRef,
      cola,
      lanzarPendiente,
    ],
  );
  useEffect(() => {
    renderPageRef.current = renderPage;
  }, [renderPage]);

  // ¿Hay raster en vuelo o re-raster encolado? (lo consumen el velo del loader y finCarga).
  const hayRasterEnVuelo = useCallback(
    () => cola.ocupada() || renderTaskRef.current != null,
    [cola],
  );

  return { renderPage, hayRasterEnVuelo };
}
