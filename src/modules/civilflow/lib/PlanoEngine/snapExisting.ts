import type { Point } from './PlanoState.ts';
import type { IPlanoEngineCore } from './PlanoState.ts';
import { netsSnapLinked } from './PlanoState.ts';
import { bajanteLleno } from './bajanteRules.ts';
import { snapToSegment } from './HitTester.ts';
import { indiceFrame } from './renderers/frameIndex.ts';

/**
 * ¿El bbox del ramal puede contener un punto dentro de `margen` del cursor? Preconsulta
 * del índice del frame (bbox cacheado por firma): en espacio vacío los 3 barridos de
 * puntos/cuerpos de abajo no iteran NADA (antes ~12.000 tests de distancia por mousemove).
 */
function bboxLejos(
  idx: ReturnType<typeof indiceFrame>,
  r: { pts?: number[][] },
  x: number,
  y: number,
  margen: number,
): boolean {
  const bb = r.pts && r.pts.length >= 2 ? idx.bboxDe(r as never) : null;
  if (!bb) return false;
  return x < bb[0] - margen || x > bb[2] + margen || y < bb[1] - margen || y > bb[3] + margen;
}

/**
 * Punto de snap existente más cercano al cursor (extremos de ramales, bajantes y CUERPO de
 * ramal) — el snap del trazo activo. Redes distintas no se atraen, salvo vent↔san (el marcador
 * de codo reventilado depende de caer exactamente sobre el punto sanitario).
 * @param permitirBajantesLlenos - el canal lo pasa true (su snap es la única forma precisa de
 *   aterrizar en el bajante); el resto respeta el tope de 2 asociaciones.
 */
export function snapToExisting(
  eng: IPlanoEngineCore,
  x: number,
  y: number,
  net?: string,
  tipo?: string,
  permitirBajantesLlenos: boolean = false,
): Point | null {
  const netRef = net ?? eng.activeNet;
  const idx = indiceFrame(eng);
  // Margen que cubre TODOS los umbrales de abajo (24/zoom vértices, 12/zoom cuerpo).
  const margenR = 24 / eng.zoom;
  let best: Point | null = null;
  let minD = 16 / eng.zoom;
  eng.ramales.forEach((r) => {
    // Nunca pegar entre redes — elementos de redes distintas no deben conectarse solo porque
    // están visualmente cerca. Excepción: ventilación debe caer exactamente sobre un punto de
    // sanitaria (el marcador de reventilado existente depende de eso), así que se permite ese
    // único par.
    if (!netsSnapLinked(r.net, netRef)) return;
    // Los ramales no se conectan a tributarios — un trazo de tipo ramal solo pega a ramales.
    if (tipo === 'ramal' && r.tipo === 'tributario') return;
    // bbox > margen del cursor: ningún punto/cuerpo de este ramal puede snapear.
    if (bboxLejos(idx, r, x, y, margenR)) return;
    r.pts.forEach(([rx, ry], idx2) => {
      let thresh = 16 / eng.zoom;
      if (idx2 > 0 && idx2 < r.pts.length - 1) {
        const ptA = r.pts[idx2 - 1];
        const ptB = r.pts[idx2];
        const ptC = r.pts[idx2 + 1];
        const ax = ptB[0] - ptA[0],
          ay = ptB[1] - ptA[1];
        const bx = ptC[0] - ptB[0],
          by = ptC[1] - ptB[1];
        const lenA = Math.hypot(ax, ay),
          lenB = Math.hypot(bx, by);
        if (lenA > 0 && lenB > 0) {
          const cosAngle = (-ax * bx - ay * by) / (lenA * lenB);
          if (Math.abs(cosAngle) < 0.05) {
            thresh = 24 / eng.zoom;
          }
        }
      }
      const d = Math.hypot(x - rx, y - ry);
      if (d < thresh && (!best || d < minD)) {
        minD = d;
        best = { x: rx, y: ry };
      }
    });
  });
  const bajThresh = 20 / eng.zoom;
  const lvlLabel = eng.nivelActual?.label ?? '';
  eng.bajantes.forEach((b) => {
    if (eng._hiddenNets.has(b.net)) return;
    if (!netsSnapLinked(b.net, netRef)) return;
    // El canal no atrae el snap: su _circ es media longitud y pegaría el extremo al CENTRO
    // del canal, borrando el punto de salida arbitrario del ramal de canal (orig. usuario).
    if (b.tipo === 'canal') return;
    // Bajante LLENO fuera del snap (orig. usuario): enganchar el trazo a un bajante que ya
    // tiene sus 2 asociaciones solo dispara "Bajante completo" sin conectar nada. Salvo
    // cuando el trazo es de canal (exento del tope) — ahí el snap es la única forma precisa
    // de aterrizar en el bajante.
    if (!permitirBajantesLlenos && bajanteLleno(b)) return;
    const disp = b.desplazamientos?.[lvlLabel] || {};
    const bx = b.x + (disp.dx || 0);
    const by = b.y + (disp.dy || 0);
    const d = Math.hypot(x - bx, y - by);
    if (d < bajThresh && (!best || d < minD)) {
      minD = d;
      best = { x: bx, y: by };
    }
  });
  // Snap al CUERPO de ramales de redes enlazadas (vent↔san) — el cursor del trazo activo se
  // acerca visualmente al ramal aunque no esté sobre un vértice, señalando la conexión antes de
  // finalizar el trazo.
  eng.ramales.forEach((r) => {
    if (!netsSnapLinked(r.net, netRef)) return;
    if (tipo === 'ramal' && r.tipo === 'tributario') return;
    if (bboxLejos(idx, r, x, y, margenR)) return;
    const segThresh = 12 / eng.zoom;
    const p = snapToSegment(x, y, r.pts, segThresh);
    if (p && (!best || Math.hypot(p.x - x, p.y - y) < minD)) {
      minD = Math.hypot(p.x - x, p.y - y);
      best = p;
    }
  });
  return best;
}

/**
 * Snap 45° del preview del tributario contra su padre (mientras se dibuja): el punto a 20/zoom
 * del cuerpo del ramal padre, o null si no hay padre activo.
 */
export function snapPreviewToPadre(eng: IPlanoEngineCore, x: number, y: number): Point | null {
  if (eng.tipoTramo !== 'tributario' || !eng.padreTributario || eng.activeRamal) return null;
  const padre = eng.ramales.find((r) => r.id === eng.padreTributario);
  if (!padre) return null;
  return eng._snapToSegment(x, y, padre.pts, 20 / eng.zoom);
}
