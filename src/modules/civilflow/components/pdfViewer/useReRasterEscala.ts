// Re-rasters disparados por la ESCALA (dedupe anti-parpadeo incluido):
//  · Efecto del prop `scale`: la escala del estado cambió → raster completo (una vez por valor).
//  · EVENTO_ESCALA_CAMBIADA: la corrección de escala al cargar → re-raster con la escala del doc.
// Un renderPage FULL con una escala YA rasterizada se SALTA (`ultimoFullScRef`): el flip
// repetido de scaleM entre dos escritores era un bucle de raster visible como parpadeo del
// piso de entrada (orig. usuario).
import { useEffect } from 'react';
import { escalaDeDoc } from '../../utils/planScale.ts';
import { EVENTO_ESCALA_CAMBIADA } from '../../utils/cargaDiagnostico.ts';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface Params {
  pdfDocRef: React.RefObject<PDFDocumentProxy | null>;
  scale: number;
  currentIdRef: React.RefObject<string | number | undefined>;
  engineRef: React.RefObject<PlanoEngine | null>;
  scaleRef: React.RefObject<number>;
  ultimoFullScRef: React.RefObject<number | null>;
  renderPage: (
    pageNum: number,
    sc: number,
    mountCheck: number,
    opts?: { bgOnly?: boolean; extraScale?: number; causa?: string },
  ) => Promise<void> | null;
}

export function useReRasterEscala({
  pdfDocRef,
  scale,
  currentIdRef,
  engineRef,
  scaleRef,
  ultimoFullScRef,
  renderPage,
}: Params): void {
  useEffect(() => {
    if (!pdfDocRef.current) return;
    if (ultimoFullScRef.current === scale) return;
    renderPage(1, scale, 0, { causa: 'prop-escala' });
  }, [scale, renderPage, pdfDocRef, ultimoFullScRef]);

  useEffect(() => {
    const onEscalaCambiada = () => {
      const id = currentIdRef.current || engineRef.current?._loadedPlanId || null;
      const sc = escalaDeDoc(id) ?? scaleRef.current;
      if (ultimoFullScRef.current === sc) return;
      // mountCheck 0 = "sin chequeo de montaje": este re-raster es del MISMO plano.
      void renderPage(1, sc, 0, { causa: 'evento-escala' });
    };
    window.addEventListener(EVENTO_ESCALA_CAMBIADA, onEscalaCambiada);
    return () => window.removeEventListener(EVENTO_ESCALA_CAMBIADA, onEscalaCambiada);
  }, [renderPage, currentIdRef, engineRef, scaleRef, ultimoFullScRef]);
}
