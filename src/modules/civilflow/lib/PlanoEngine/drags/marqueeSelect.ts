/**
 * Confirmación del marquee (selección por caja) al soltar: agrega a multiSel todo lo que toque
 * el recuadro — ramales (vértices o segmento que cruza), bajantes/canales (bbox del glifo con
 * fallback OBB), textos, áreas, guías y cotas (Liang-Barsky). Extraído verbatim de
 * handleDragUp.ts. Ej: arrastrar una caja alrededor de 3 ramales los deja en engine.multiSel.
 */
import type { IPlanoEngineCore } from '../PlanoState.ts';
import { canalMarco, esquinasCanalOBB } from '../channelAssociation';

/** ¿Este trazo pasa por dentro del recuadro de selección? (método Liang-Barsky, en coordenadas de
 *  pantalla). Lo usa el marquee para decidir si una tubería, guía o cota queda seleccionada. */
function segIntersectsRect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): boolean {
  let t0 = 0,
    t1 = 1;
  const dx = p2.x - p1.x,
    dy = p2.y - p1.y;
  const p = [-dx, dx, -dy, dy];
  const q = [p1.x - minX, maxX - p1.x, p1.y - minY, maxY - p1.y];
  for (let k = 0; k < 4; k++) {
    if (p[k] === 0) {
      if (q[k] < 0) return false;
    } else {
      const t = q[k] / p[k];
      if (p[k] < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** Confirma el marquee activo: limpia engine.marqueeRect, resuelve click simple sobre área y
 *  llena multiSel por tipo de elemento. Devuelve true si había marquee (el caller termina ahí). */
export function confirmarMarquee(engine: IPlanoEngineCore, isCtrl: boolean): boolean {
  if (!engine.marqueeRect) return false;
  const { x1, y1, x2, y2 } = engine.marqueeRect;
  const minX = Math.min(x1, x2),
    maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2),
    maxY = Math.max(y1, y2);
  const w = maxX - minX,
    h = maxY - minY;
  engine.marqueeRect = null;
  // Click simple sobre un área (sin arrastre): seleccionarla.
  if (w < 3 && h < 3 && engine._areaClickCandidate) {
    const cand = engine._areaClickCandidate;
    engine._areaClickCandidate = null;
    engine.selId = cand;
    engine._emitSelect(engine.areas.find((a) => a.id === cand) ?? null);
    engine.render();
    return true;
  }
  engine._areaClickCandidate = null;
  if (w >= 3 || h >= 3) {
    if (!isCtrl) {
      engine.multiSel = [];
    }
    engine.ramales.forEach((r) => {
      let inside = false;
      // Solo geometría (vértices dentro o segmento que cruza): la etiqueta puede
      // arrastrarse lejos del trazo y seleccionaba ramales fuera del recuadro
      // (orig. usuario). Sin cruce de líneas no hay selección parcial.
      for (const pt of r.pts) {
        const c = engine.toCvs(pt[0], pt[1]);
        if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
          inside = true;
          break;
        }
      }
      if (!inside && r.pts.length >= 2) {
        for (let i = 0; i < r.pts.length - 1; i++) {
          const p1 = engine.toCvs(r.pts[i][0], r.pts[i][1]);
          const p2 = engine.toCvs(r.pts[i + 1][0], r.pts[i + 1][1]);
          if (segIntersectsRect(p1, p2, minX, maxX, minY, maxY)) {
            inside = true;
            break;
          }
        }
      }
      if (inside && !engine.multiSel.includes(r.id)) engine.multiSel.push(r.id);
    });
    // TOCAR cualquier parte (orig. usuario): intersección del bbox del glifo con el
    // recuadro — nunca solo el punto centro. Canal: su caja completa (_canalBox, con
    // fallback a las dos esquinas en plano); el resto: el disco de render (_circ, que
    // para cajas CAN/CALL ya es la media diagonal del cuadrado a escala real).
    engine.bajantes.forEach((b) => {
      let inside: boolean;
      if (b.tipo === 'canal') {
        let cb = b._canalBox;
        if (!cb) {
          // Fallback sin render previo: AABB del OBB (válido en diagonal, no solo ejes).
          const cs = esquinasCanalOBB(canalMarco(engine.cmToPlanePx(1), b)).map((p) =>
            engine.toCvs(p.x, p.y),
          );
          const xs = cs.map((c) => c.x);
          const ys = cs.map((c) => c.y);
          const x0 = Math.min(...xs);
          const y0 = Math.min(...ys);
          cb = {
            x: x0,
            y: y0,
            w: Math.max(...xs) - x0,
            h: Math.max(...ys) - y0,
          };
        }
        inside = cb.x <= maxX && cb.x + cb.w >= minX && cb.y <= maxY && cb.y + cb.h >= minY;
      } else if (b._circ) {
        const bb = b._circ;
        inside =
          bb.x - bb.r <= maxX && bb.x + bb.r >= minX && bb.y - bb.r <= maxY && bb.y + bb.r >= minY;
      } else {
        const c = engine.toCvs(b.x, b.y);
        inside = c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY;
      }
      if (inside && !engine.multiSel.includes(b.id)) engine.multiSel.push(b.id);
    });
    // Textos: bbox completo (_box, render) — tocar cualquier parte del texto selecciona;
    // fallback al punto ancla si aún no hay caja renderizada.
    engine.textAnnots.forEach((t) => {
      let inside: boolean;
      if (t._box) {
        const bb = t._box;
        inside = bb.x <= maxX && bb.x + bb.w >= minX && bb.y <= maxY && bb.y + bb.h >= minY;
      } else {
        const c = engine.toCvs(t.x, t.y);
        inside = c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY;
      }
      if (inside && !engine.multiSel.includes(t.id)) engine.multiSel.push(t.id);
    });
    // PUNTO (orig. usuario): ÁREAS en la multiselección del recuadro — criterio de
    // INTERSECCIÓN con el bbox del área (el recuadro que toque o cubra el área la
    // selecciona; el label puede estar arrastrado lejos y no influye).
    engine.areas.forEach((a) => {
      let pb = a._polyBox;
      if (!pb && a.pts && a.pts.length >= 3) {
        const xs = a.pts.map((p) => p[0]);
        const ys = a.pts.map((p) => p[1]);
        pb = {
          x: Math.min(...xs),
          y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys),
        };
      }
      if (!pb) return;
      // _polyBox ya está en CANVAS (renderAreas lo setea con toCvs) — comparar directo
      // contra el marquee (también canvas). Sin doble conversión.
      const intersecta = pb.x <= maxX && pb.x + pb.w >= minX && pb.y <= maxY && pb.y + pb.h >= minY;
      if (intersecta && !engine.multiSel.includes(a.id)) engine.multiSel.push(a.id);
    });
    // Guías: ENTIDAD COMPLETA — basta un vértice dentro del rect o un segmento que lo
    // cruce (Liang-Barsky, mismo test que ramales) para seleccionar la guía entera
    // (orig. usuario: arrastre selecciona guías como los demás trazos).
    engine.guideLines.forEach((g) => {
      if (!g.pts || g.pts.length < 2) return;
      let inside = false;
      for (const pt of g.pts) {
        const c = engine.toCvs(pt[0], pt[1]);
        if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
          inside = true;
          break;
        }
      }
      if (!inside) {
        for (let i = 0; i < g.pts.length - 1; i++) {
          const p1 = engine.toCvs(g.pts[i][0], g.pts[i][1]);
          const p2 = engine.toCvs(g.pts[i + 1][0], g.pts[i + 1][1]);
          if (segIntersectsRect(p1, p2, minX, maxX, minY, maxY)) {
            inside = true;
            break;
          }
        }
      }
      if (inside && !engine.multiSel.includes(g.id)) engine.multiSel.push(g.id);
    });
    // COTAS: tocar el segmento (cruce Liang-Barsky, mismo test que ramales/guías) o el
    // punto de etiqueta — la cota entra en la multiselección igual que cualquier trazo.
    engine.dims?.forEach((d) => {
      const p1 = engine.toCvs(d.x1, d.y1);
      const p2 = engine.toCvs(d.x2, d.y2);
      let inside = segIntersectsRect(p1, p2, minX, maxX, minY, maxY);
      if (!inside) {
        const lp = d.lblX != null && d.lblY != null ? engine.toCvs(d.lblX, d.lblY) : d._labelPos;
        if (lp && lp.x >= minX && lp.x <= maxX && lp.y >= minY && lp.y <= maxY) {
          inside = true;
        }
      }
      if (inside && !engine.multiSel.includes(d.id)) engine.multiSel.push(d.id);
    });
    engine.selId = null;
    engine._emitSelect(null);
  }
  engine.render();
  return true;
}
