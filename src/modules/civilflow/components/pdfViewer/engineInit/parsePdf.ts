/**
 * Carga y parseo del PDF del piso vigente (useParsePdf): cache hit (sin spinner) o FileReader +
 * getDocument de pdfjs (PDF.js), raster inmediato después y precalentamiento del resto de los
 * pisos. El spinner se baja cuando la carga VIGENTE termina sin raster en vuelo.
 * Ej: volver a un piso ya visitado cae en pdfCache.ts y no re-parsea nada.
 */
import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getPdfjs } from '../../../utils/lazyPdfjs.ts';
import { escalaDeDoc } from '../../../utils/planScale.ts';
import { pdfACache, calentarPdfs, pdfDeCache } from '../pdfCache.ts';
import { devError } from '../../../../../utils/devError.ts';

interface ParsePdfParams {
  currentFile: File | null;
  /** Todos los planos del proyecto: para precalentar el parse de sus PDFs tras la 1ª entrada
   *  y que los cambios de piso no re-parseen nada (cambio fluido, ped. usuario). */
  files?: Array<{ id: number; file: File }>;
  currentId: string | number | undefined;
  /** Proxy pdfjs del doc vigente (lo escriben el cache hit y la carga fría; lo lee el raster). */
  pdfDocRef: React.MutableRefObject<PDFDocumentProxy | null>;
  /** Contador de montaje: el loader lo incrementa por apertura y lo pasa al raster. */
  mountIdRef: React.MutableRefObject<number>;
  /** Escala default del estado: fallback si el plano no tiene escala de doc guardada. */
  scaleRef: React.RefObject<number>;
  renderPage: (
    pageNum: number,
    sc: number,
    mountCheck: number,
    opts?: { bgOnly?: boolean; extraScale?: number; causa?: string },
  ) => Promise<void> | null;
  /** Re-sincroniza la densidad del fondo con el zoom real (lo escribe el montaje del engine). */
  reprogramarBgRef: React.RefObject<(() => void) | null>;
  /** ¿Raster en vuelo o re-raster encolado? El spinner espera a que quede libre. */
  hayRasterEnVuelo: () => boolean;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

/** Carga el PDF (caché o parseo), encadena el raster y precalienta el resto de los pisos. */
export function useParsePdf({
  currentFile,
  files,
  currentId,
  pdfDocRef,
  mountIdRef,
  scaleRef,
  renderPage,
  reprogramarBgRef,
  hayRasterEnVuelo,
  setLoading,
  setError,
}: ParsePdfParams): void {
  // Secuencia de carga: cada apertura del PDF incrementa este contador. El overlay de carga
  // se baja al terminar la carga vigente, NO cuando cambia el montaje (un re-raster por zoom
  // o por cambio de escala movía el mountId y dejaba el spinner colgado).
  const cargaSeq = useRef(0);
  // Espejo de files para calentarPdfs sin meter el array en las deps del efecto currentFile.
  // Se sincroniza en efecto (declarado ANTES que el loader) y no en render: el solo hecho de
  // que cambie la identidad del array no debe re-disparar la carga en vuelo.
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  });

  useEffect(() => {
    // Sin lámina que cargar el loading DEBE bajar (C-1): si se quedara en true,
    // onLoadingChange mantenía el overlay z-9999 bloqueando el visor en proyectos sin planos.
    if (!currentFile) {
      setLoading(false);
      return;
    }
    mountIdRef.current += 1;
    const thisMount = mountIdRef.current;
    // Secuencia de CARGA (no de montaje): el overlay se baja cuando termina ESTA carga. Si se
    // comprobara el mountId, cualquier render extra (re-raster por zoom o por cambio de escala)
    // invalidaría la comprobación y dejaría el spinner colgado para siempre (orig. usuario).
    const thisCarga = ++cargaSeq.current;
    // Precalentar el RESTO de los pisos (una sola vez por sesión): parse en reposo tras la
    // primera entrada — los switches posteriores caen en la caché y no re-parsean nada.
    // filesRef (NO `files` en las deps): cada retry de PlansContext regenera el array y
    // re-disparaba ESTA cadena abortando la carga en vuelo (H5 auditoría 2026-10-27).
    const calentarResto = (): void => calentarPdfs(filesRef.current ?? []);
    // Cache hit: sin parse ni spinner; el canvas conserva el bitmap anterior (swap imperceptible).
    const enCache = pdfDeCache(currentFile);
    if (enCache) {
      void (async () => {
        try {
          pdfDocRef.current = enCache;
          setError(null);
          await renderPage(1, escalaDeDoc(currentId) ?? scaleRef.current, thisMount, {
            causa: 'loader-cache',
          });
          // Si una carga FRÍA anterior quedó con el spinner arriba y esta corrida la
          // reemplazó (cambio de piso por retry de contexto), bajarlo aquí: este path
          // nunca lo tocaba y el overlay quedaba colgado.
          if (thisCarga === cargaSeq.current) setLoading(false);
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
        // El spinner cubre el PRIMER PAINT COMPLETO + asentamiento CAUSAL: el mínimo de 600ms
        // se extiende mientras haya un raster en vuelo o un re-raster encolado (la corrección
        // de escala y el bgOnly de densidad llegan DESPUÉS del render principal — bajar por
        // timer fijo los dejaba ver: el reacomodo, orig. usuario). Techo de 3s por si acaso.
        if (thisCarga === cargaSeq.current) {
          const t0 = Date.now();
          const bajar = (): void => {
            if (thisCarga !== cargaSeq.current) return;
            const ocupado = hayRasterEnVuelo();
            if (ocupado && Date.now() - t0 < 3000) {
              window.setTimeout(bajar, 100);
              return;
            }
            setLoading(false);
          };
          window.setTimeout(bajar, 600);
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
  }, [
    currentFile,
    currentId,
    renderPage,
    setError,
    setLoading,
    pdfDocRef,
    mountIdRef,
    scaleRef,
    reprogramarBgRef,
    hayRasterEnVuelo,
  ]);
}
