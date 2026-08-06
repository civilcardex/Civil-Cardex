import { NETS } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';

/**
 * El texto de la barra de estado del visor según la herramienta activa — el mensaje que dice
 * qué está haciendo el usuario ahora mismo ("Ramal", "Cota", "Bajante", ...) y, mientras dibuja
 * una línea o un área, cuántos puntos lleva y su longitud. Vive en este archivo para que tanto
 * PlanoEngineDrawing como drawingCreations puedan usarlo sin importarse entre sí.
 */
export function _statusMsg(engine: IPlanoEngineCore): string {
  const names: Record<string, string> = {
    sel: 'Seleccionar elemento',
    line: 'Ramal',
    dim: 'Cota',
    text: 'Texto',
    baj: 'Bajante',
    mon: 'Montante',
    pan: 'Pan',
    area: 'Área',
    erase: 'Borrar',
    delm: 'Eliminar elemento',
    red_pub: 'Red Pública',
    cont: 'Contador',
    guide: 'Línea guía',
    canal: 'Canal',
  };
  let m = names[engine.tool] || engine.tool;
  if (engine.tool === 'line') {
    const net = NETS.find((n) => n.id === engine.activeNet);
    m += ` — ${net ? net.lbl : ''} [${engine.tipoTramo}]`;
    if (engine.activeRamal)
      m += ` (${engine.activeRamal.pts.length} pts, ${engine.activeRamal.totalL}m)`;
  }
  if (engine.tool === 'area' && engine.activeArea) {
    m += ` (${engine.activeArea.pts.length} pts)`;
  }
  if (engine.tool === 'canal' && engine._canalStart) {
    const mp = engine.toPlane(engine.mouseX, engine.mouseY);
    const base = Math.round(engine.pxToM(Math.abs(mp.x - engine._canalStart.x)) * 100);
    const altura = Math.round(engine.pxToM(Math.abs(mp.y - engine._canalStart.y)) * 100);
    m += ` (${base} x ${altura} cm)`;
  }
  return m;
}

/**
 * Mide la longitud real de un ramal en metros (lo que el usuario ve en la tabla de longitudes).
 *
 * Recorre todos los segmentos punto a punto y suma sus distancias. Si el trazo "retrocede"
 * sobre sí mismo (el usuario dibujó un tramo de ida y vuelta encima), esos segmentos repetidos
 * se ignoran para no contar dos veces la misma tubería.
 */
export function calculateRamalLength(pts: number[][], engine: IPlanoEngineCore): number {
  let len = 0;
  const segments: Array<[number, number, number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const x1 = pts[i][0],
      y1 = pts[i][1];
    const x2 = pts[i + 1][0],
      y2 = pts[i + 1][1];

    let isBacktrack = false;
    for (const [sx1, sy1, sx2, sy2] of segments) {
      const distStart = Math.hypot(x1 - sx2, y1 - sy2);
      const distEnd = Math.hypot(x2 - sx1, y2 - sy1);
      if (distStart < 0.1 && distEnd < 0.1) {
        isBacktrack = true;
        break;
      }
    }
    if (isBacktrack) continue;

    segments.push([x1, y1, x2, y2]);
    len += engine.pxToM(Math.hypot(x2 - x1, y2 - y1));
  }
  return +len.toFixed(3);
}
