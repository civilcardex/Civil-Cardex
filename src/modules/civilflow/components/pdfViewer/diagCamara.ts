// Diagnóstico __cfCam (patrón __cfDiag/__cfScale): verifica que la LÁMINA rasterizada y el
// dibujo comparten escala. escalaRender === escalaDoc y pageW_dibujado === pageW_esperado
// = fondo y geometría alineados; distintos = la hoja quedó rasterizada en otra escala.
// Solo en DEV (expone la escala de la lámina del cliente en la consola).
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { escalaDeDoc } from '../../utils/planScale.ts';

export function instalarCfCam(args: {
  engineRef: React.RefObject<PlanoEngine | null>;
  currentIdRef: React.RefObject<string | number | undefined>;
  lastRenderScRef: React.RefObject<number | null>;
  lastPageBaseWRef: React.RefObject<number | null>;
  renderCountRef?: React.RefObject<number>;
  causaRenderRef?: React.RefObject<string>;
}): void {
  (window as unknown as { __cfCam?: () => unknown }).__cfCam = () => {
    const eng = args.engineRef.current;
    const escalaDoc = escalaDeDoc(args.currentIdRef.current);
    const escalaRender = args.lastRenderScRef.current;
    const baseW = args.lastPageBaseWRef.current;
    return {
      escalaDoc,
      escalaRender,
      pageW_base_px: baseW,
      pageW_esperado: baseW != null && escalaDoc ? baseW * escalaDoc : null,
      pageW_dibujado: escalaRender != null && baseW != null ? baseW * escalaRender : null,
      zoom: eng?.zoom ?? null,
      offX: eng?.offX ?? null,
      offY: eng?.offY ?? null,
      // Contador de rasters completos + última causa: dos dumps en un parpadeo dicen si el
      // contador sube (bucle de raster) y quién lo dispara (ped. usuario, parpadeo 1er piso).
      renders: args.renderCountRef?.current ?? null,
      causaRender: args.causaRenderRef?.current ?? null,
    };
  };
}
