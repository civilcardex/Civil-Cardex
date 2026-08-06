import type { IPlanoEngineCore, PlanoElement } from './PlanoState';
import { pointInLabelBox, pointInPoly } from './HitTester';
import { canalRectHitDistance } from './canalAssociation';

export interface ContextMenuHitResult {
  element: PlanoElement;
  isGhostClick: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
  /** El clic cayó sobre el cuerpo del ramal (no cerca de un vértice existente). segmentIdx/x/y
   *  describen dónde habría que insertar un vértice nuevo (entre pts[segmentIdx] y
   *  pts[segmentIdx+1]) si el usuario asigna un accesorio a mitad de ramal ahí. */
  midRamalHit?: { segmentIdx: number; x: number; y: number } | null;
  clientX: number;
  clientY: number;
}

export function hitTestRightClick(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  clientX: number,
  clientY: number,
): ContextMenuHitResult | null {
  const zoom = engine.zoom;

  // Revisar primero los bajantes fantasma (máxima prioridad), salvo que se solapen con un
  // bajante real sin desplazamiento
  const fg = engine.getBajantesFantasma();
  for (const b of fg) {
    if (b._ghost) {
      const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
      // Si el fantasma no está desplazado de su padre (misma posición), saltar la detección de
      // fantasma para que el bajante padre pueda recibir el clic derecho normalmente
      const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
      const isDisplaced = disp && (Math.abs(disp.dx) > 0.5 || Math.abs(disp.dy) > 0.5);
      if (!isDisplaced) continue;
      if (d <= b._ghost.r) {
        return { element: b, isGhostClick: true, clientX, clientY };
      }
      if (b._ghostLabelBox && pointInLabelBox(x, y, b._ghostLabelBox)) {
        return { element: b, isGhostClick: true, clientX, clientY };
      }
    }
  }

  // Revisar Contador (caja + flecha) ANTES que ramales — ambos deben ser clicables sin
  // interferirse
  for (const b of engine.bajantes) {
    if (b.tipo === 'contador') {
      const c = engine.toCvs(b.x, b.y);
      const hitR = Math.max(22 * zoom, 10 * zoom + 8);
      // Área de la caja
      if (Math.hypot(x - c.x, y - c.y) <= hitR) {
        return { element: b, isGhostClick: false, clientX, clientY };
      }
      // Área de la flecha debajo de la caja
      const arrowLeft = c.x - 50 * zoom;
      const arrowRight = c.x + 50 * zoom;
      const arrowTop = c.y + 10 * zoom;
      const arrowBottom = c.y + 10 * zoom + 50 * zoom;
      if (x >= arrowLeft && x <= arrowRight && y >= arrowTop && y <= arrowBottom) {
        return { element: b, isGhostClick: false, clientX, clientY };
      }
    }
  }

  // Revisar bajantes reales (círculo o etiqueta) ANTES que ramales para que el bajante gane
  // cuando se solapan. El objetivo de clic de un canal es su rectángulo visible (_canalBox), no
  // el círculo diagonal.
  for (const b of engine.bajantes) {
    const c = engine.toCvs(b.x, b.y);
    const hitOnCircle =
      b.tipo === 'canal'
        ? canalRectHitDistance(b, x, y, 4 * zoom) < Infinity
        : Math.hypot(x - c.x, y - c.y) <= (b._circ?.r || Math.max(8 * zoom, 10 * zoom));
    const hitOnLabel = b._labelBox && pointInLabelBox(x, y, b._labelBox);
    if (hitOnCircle || hitOnLabel) {
      return { element: b, isGhostClick: false, clientX, clientY };
    }
  }

  // Revisar ramales
  for (const r of engine.ramales) {
    let hitOnRamal = false;
    let ramalEndpoint: { idx: number; x: number; y: number } | null = null;
    let midRamalHit: { segmentIdx: number; x: number; y: number } | null = null;

    if (r.pts) {
      // Revisar primero los vértices de accesorio a mitad de ramal existentes (radio 12px). El
      // chequeo de segmento de abajo solo reporta un midRamalHit para 0.05 < t < 0.95 (para no
      // chocar con aciertos de extremo), lo que significa que un clic justo sobre un vértice
      // accMed existente nunca se detectaría — esto hacía imposible editar/quitar un accesorio
      // de mitad de ramal existente.
      if (r.accMed) {
        for (const key of Object.keys(r.accMed)) {
          const m = key.match(/^accMed(\d+)$/);
          if (!m) continue;
          const idx = parseInt(m[1], 10);
          if (idx <= 0 || idx >= r.pts.length - 1) continue;
          const ep = engine.toCvs(r.pts[idx][0], r.pts[idx][1]);
          if (Math.hypot(x - ep.x, y - ep.y) <= 12) {
            hitOnRamal = true;
            midRamalHit = { segmentIdx: idx - 1, x: r.pts[idx][0], y: r.pts[idx][1] };
            break;
          }
        }
      }

      // Revisar extremos primero (radio 12px)
      if (!hitOnRamal) {
        for (const epIdx of [0, r.pts.length - 1]) {
          const ep = engine.toCvs(r.pts[epIdx][0], r.pts[epIdx][1]);
          if (Math.hypot(x - ep.x, y - ep.y) <= 12) {
            hitOnRamal = true;
            ramalEndpoint = { idx: epIdx, x: r.pts[epIdx][0], y: r.pts[epIdx][1] };
            break;
          }
        }
      }

      // Revisar segmentos (distancia de 12px a la línea)
      if (!hitOnRamal) {
        for (let i = 0; i < r.pts.length - 1; i++) {
          const p1 = engine.toCvs(r.pts[i][0], r.pts[i][1]);
          const p2 = engine.toCvs(r.pts[i + 1][0], r.pts[i + 1][1]);
          const l2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
          let t = l2 === 0 ? 0 : ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / l2;
          t = Math.max(0, Math.min(1, t));
          const projX = p1.x + t * (p2.x - p1.x);
          const projY = p1.y + t * (p2.y - p1.y);
          if (Math.hypot(x - projX, y - projY) <= 12) {
            hitOnRamal = true;
            // Solo ofrecer un punto de inserción a mitad de ramal cuando no esté efectivamente
            // encima de uno de los extremos propios del segmento (esos los cubren ramalEndpoint
            // / el chequeo de un segmento adyacente).
            if (t > 0.05 && t < 0.95) {
              const [ax, ay] = r.pts[i],
                [bx, by] = r.pts[i + 1];
              midRamalHit = { segmentIdx: i, x: ax + t * (bx - ax), y: ay + t * (by - ay) };
            }
            break;
          }
        }
      }
    }

    const hitOnLabel = r._labelBox && pointInLabelBox(x, y, r._labelBox);
    if (hitOnRamal || hitOnLabel) {
      return { element: r, isGhostClick: false, ramalEndpoint, midRamalHit, clientX, clientY };
    }
  }

  // Revisar líneas guía
  for (const g of engine.guideLines) {
    if (g._labelBox && pointInLabelBox(x, y, g._labelBox)) {
      return { element: g, isGhostClick: false, clientX, clientY };
    }
  }

  // Revisar áreas
  for (const a of engine.areas) {
    let hitOnArea = false;
    if (a.pts) {
      const cvsPts = a.pts.map((pt: number[]) => engine.toCvs(pt[0], pt[1]));
      hitOnArea = pointInPoly(x, y, cvsPts);
    }
    const hitOnLabel = a._labelBox && pointInLabelBox(x, y, a._labelBox);
    if (hitOnArea || hitOnLabel) {
      return { element: a, isGhostClick: false, clientX, clientY };
    }
  }

  return null;
}

export function hitTestBajanteLabelForDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
): { id: string; offX: number; offY: number } | null {
  const selEl = engine.bajantes.find((b) => b.id === engine.selId);
  if (!selEl) return null;

  let candidate: { offX: number; offY: number; dist: number } | null = null;
  if (selEl._labelBox && pointInLabelBox(x, y, selEl._labelBox)) {
    const lPos = engine.toCvs(selEl.labelX ?? selEl.x, selEl.labelY ?? selEl.y + 20);
    candidate = { offX: x - lPos.x, offY: y - lPos.y, dist: Math.hypot(x - lPos.x, y - lPos.y) };
  } else if (selEl.labelX != null && selEl.labelY != null) {
    const lPos = engine.toCvs(selEl.labelX, selEl.labelY);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < 40) candidate = { offX: x - lPos.x, offY: y - lPos.y, dist: d };
  } else if (selEl.tipo === 'contador' || selEl.tipo === 'calentador') {
    const lx = selEl.labelX ?? selEl.x - 25;
    const ly = selEl.labelY ?? selEl.y;
    const lPos = engine.toCvs(lx, ly);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < 60) candidate = { offX: x - lPos.x, offY: y - lPos.y, dist: d };
  }
  if (!candidate) return null;

  // La etiqueta propia del bajante seleccionado ganaba siempre aquí antes, incluso cuando el
  // clic estaba de verdad mucho más cerca de la etiqueta de un bajante DISTINTO justo al lado
  // (p.ej. un bajante real junto a uno asociado en otro piso) — esto corría ANTES de que la
  // comparación justa de etiqueta-más-cercana de handleSelectDown tuviera oportunidad, así que
  // clicar cerca de la etiqueta de un bajante vecino seguía arrastrando lo que ya estaba
  // seleccionado. Solo ganar aquí si nada más está genuinamente más cerca; si no, salir para
  // que el camino normal (justo, comparado por distancia) de selección en handleSelectDown
  // elija el correcto.
  for (const other of engine.bajantes) {
    if (other.id === selEl.id) continue;
    const lx = other.labelX ?? other.x;
    const ly = other.labelY ?? other.y + 20;
    const lPos = engine.toCvs(lx, ly);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < candidate.dist) return null;
  }
  return { id: selEl.id, offX: candidate.offX, offY: candidate.offY };
}
