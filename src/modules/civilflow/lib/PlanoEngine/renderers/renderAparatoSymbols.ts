import type { IPlanoEngineCore } from '../PlanoState.ts';
import { APARATO_IMG } from '../../../constants';

// Cache de nivel de módulo para los símbolos de aparato. DEBE vivir a nivel de módulo, no
// dentro de la función: un cache por-render se borra en cada engine.render(), así que la
// imagen reiniciaría su carga en cada pase, nunca se dibujaría, y cada onload dispararía
// otro render (bucle infinito de recargas). Con un cache de nivel de módulo el primer
// render arranca la carga, onload guarda la imagen y re-renderiza una vez, y el siguiente
// pase la dibuja síncronamente desde el cache.
const aparatoImgCache = new Map<string, HTMLImageElement | null>();

const getAparatoImg = (src: string, engine: IPlanoEngineCore): HTMLImageElement | null => {
  if (aparatoImgCache.has(src)) return aparatoImgCache.get(src) || null;
  aparatoImgCache.set(src, null);
  const img = new Image();
  img.onload = () => {
    aparatoImgCache.set(src, img);
    engine.render();
  };
  img.onerror = () => {
    aparatoImgCache.set(src, null);
  };
  img.src = src;
  return null;
};

/**
 * Símbolos de aparato (fixture) en los extremos de ramal — pase propio, tras los
 * accesorios de extremo. aparatoInicio/aparatoFin guardan un id de APARATOS_DEF
 * ('lvm'/'duc'); la imagen webp se pinta con drawImage desde el cache de módulo.
 * En af/ac/gas no se dibuja nada (el glifo del codo implícito ya marca el extremo).
 */
export function renderAparatoSymbols(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
): void {
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    if (!((r.tipo === 'tributario' || r.tipo === 'ramal') && r.pts.length >= 2)) return;
    // En AF/AC el símbolo del aparato no se dibuja: el glifo de accesorio implícito (codo 90°
    // sube junto al aparato, arriba) ya marca el extremo y la imagen del fixture solo ensucia
    // el plano. En gas tampoco (orig. usuario: al asignar un gasodoméstico no debe ponerse
    // nada en el extremo) — el aparato vive en el campo/conteo, no como glifo.
    if (r.net === 'af' || r.net === 'ac' || r.net === 'gas') return;

    [0, r.pts.length - 1].forEach((idx) => {
      const appType = idx === 0 ? r.aparatoInicio : r.aparatoFin;
      if (!appType) return;
      const imgSrc = (APARATO_IMG as Record<string, string>)[appType];
      if (!imgSrc) return;
      const img = getAparatoImg(imgSrc, engine);
      if (!img) return; // todavía cargando — onload re-renderiza este pase

      const pt = r.pts[idx];
      const c = engine.toCvs(pt[0], pt[1]);

      let dx = 0,
        dy = 0;
      if (idx === 0) {
        dx = r.pts[1][0] - r.pts[0][0];
        dy = r.pts[1][1] - r.pts[0][1];
      } else {
        dx = r.pts[idx][0] - r.pts[idx - 1][0];
        dy = r.pts[idx][1] - r.pts[idx - 1][1];
      }
      const len = Math.hypot(dx, dy);
      if (len > 0.01) {
        dx /= len;
        dy /= len;
      } else {
        dx = 1;
        dy = 0;
      }
      const outX = idx === 0 ? -dx : dx;
      const outY = idx === 0 ? -dy : dy;

      const rad = engine.realMmToCanvasPx(23) * 0.9;
      const size = rad * 2;
      ctx.save();
      // Ponytail: keep the codo90rmSube disk visible at the pipe end — push the fixture image
      // outward so it does not cover the codo symbol (bajante at one end, aparato at the other).
      ctx.translate(c.x + outX * rad * 1.4, c.y + outY * rad * 1.4);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    });
  });
}
