// Diagnóstico __cfCam (patrón __cfDiag/__cfScale): verifica que la LÁMINA rasterizada y el
// dibujo comparten escala. escalaRender === escalaDoc y pageW_dibujado === pageW_esperado
// = fondo y geometría alineados; distintos = la hoja quedó rasterizada en otra escala.
// Solo en DEV (expone la escala de la lámina del cliente en la consola).
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { escalaDeDoc } from '../../utils/planScale.ts';
import { ptsDeDibujoConDims } from '../../lib/PlanoEngine/planoCamera.ts';

/** Instala `window.__cfCam()` (solo DEV): vuelca escala de lámina vs escala de render, ancho de página esperado/dibujado y qué elementos empujan el bbox del encuadre. */
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
    const baseWpx = args.lastPageBaseWRef.current;
    // BBox del contenido (lo que usa reEncuadrarContenido): un punto lejísimos del resto
    // (elemento suelto, cota arrastrada) agranda el cuadro y el encuadre "se aleja" solo.
    const bbox = eng ? ptsDeDibujoConDims(eng) : null;
    const fuera = bbox
      ? (() => {
          const cx = (bbox.minX + bbox.maxX) / 2;
          const cy = (bbox.minY + bbox.maxY) / 2;
          const span = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
          const out: Array<{ x: number; y: number; quien: string }> = [];
          const empuja = (x: unknown, y: unknown, quien: string): void => {
            if (
              typeof x === 'number' &&
              typeof y === 'number' &&
              Math.hypot(x - cx, y - cy) > span * 0.75
            )
              out.push({ x, y, quien });
          };
          for (const r of eng?.ramales || [])
            for (const p of r.pts || []) empuja(p[0], p[1], `ramal ${r.id ?? ''}`);
          for (const b of eng?.bajantes || []) empuja(b.x, b.y, `bajante ${b.id ?? ''}`);
          for (const d of eng?.dims || []) {
            empuja(d.x1, d.y1, `cota ${d.id ?? ''}`);
            empuja(d.x2, d.y2, `cota ${d.id ?? ''}`);
          }
          return out.slice(0, 8);
        })()
      : [];
    return {
      escalaDoc,
      escalaRender,
      pageW_base_px: baseWpx,
      pageW_esperado: baseWpx != null && escalaDoc ? baseWpx * escalaDoc : null,
      pageW_dibujado: escalaRender != null && baseWpx != null ? baseWpx * escalaRender : null,
      zoom: eng?.zoom ?? null,
      offX: eng?.offX ?? null,
      offY: eng?.offY ?? null,
      bbox,
      puntosQueAlejan: fuera,
      // Contador de rasters completos + última causa: dos dumps en un parpadeo dicen si el
      // contador sube (bucle de raster) y quién lo dispara (ped. usuario, parpadeo 1er piso).
      renders: args.renderCountRef?.current ?? null,
      causaRender: args.causaRenderRef?.current ?? null,
    };
  };
  // __cfPerf: tiempos del último render por capa (trazo, uniones, bajantes) + tamaño del
  // lienzo en megapíxeles. Sirve para saber si el paneo/zoom "trabado" viene del dibujo, del
  // fondo o del tamaño del canvas, sin adivinar.
  (window as unknown as { __cfPerf?: () => unknown }).__cfPerf = () =>
    args.engineRef.current?.reportePerf() ?? null;
}
