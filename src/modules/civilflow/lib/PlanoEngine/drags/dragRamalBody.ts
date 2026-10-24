import type { IPlanoEngineCore } from '../PlanoState.ts';
import { calculateRamalLength, _midpoint } from '../PlanoEngineDrawing.ts';
import { checkRamalAnglesExcludingConnections } from '../junctionAutoSplit.ts';
import { indexRamales, sameNetGroup, refrescarTrazo } from './dragContext.ts';

/** Arrastre del CUERPO de un ramal: segmento suelto (con snap ortogonal) o traslación rígida
 *  completa con cascada connRamales/connBaj, restricción de deslizamiento contra T genuinas y
 *  el Ldesvio entrepisos que lleva AMBOS extremos de la asociación. */
export function dragRamalBody(engine: IPlanoEngineCore, x: number, y: number): void {
  const ramalesById = indexRamales(engine);
  const r = ramalesById.get(engine.ramalDrag!.id);
  if (r && engine.ramalDrag!.segIdx !== undefined) {
    const tp = engine.toPlane(x, y);
    let dx = tp.x - engine.ramalDrag!.startX;
    let dy = tp.y - engine.ramalDrag!.startY;
    // Con snap activo el desplazamiento del segmento es estrictamente ortogonal: solo el eje
    // dominante del gesto se conserva, el otro se anula (sin diagonales ni movimiento libre).
    if (engine.snapMode) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    const si = engine.ramalDrag!.segIdx;
    if (si >= 0 && si + 1 < r.pts.length) {
      r.pts[si][0] = engine.ramalDrag!.origPts[si][0] + dx;
      r.pts[si][1] = engine.ramalDrag!.origPts[si][1] + dy;
      r.pts[si + 1][0] = engine.ramalDrag!.origPts[si + 1][0] + dx;
      r.pts[si + 1][1] = engine.ramalDrag!.origPts[si + 1][1] + dy;
    }
    // Etiqueta movida a mano (ítem 2 usuario): los re-encuadres de geometría no la tocan —
    // ver refrescarTrazo.
    refrescarTrazo(engine, r);
    engine.scheduleRender();
    return;
  }
  // bloqueado se pone en true a todo ramal al crearlo y nunca se quita en ninguna parte del
  // código, así que condicionar este arrastre de cuerpo completo a `!r.bloqueado` dejaba el
  // arrastre de cuerpo inoperante para TODOS los ramales — incluida la cascada connRamales/connBaj
  // unas líneas abajo, que es el mecanismo real para mover junto una red san/vent conectada. Una
  // traslación rígida del cuerpo completo nunca dobla la forma del ramal, así que bloqueado (que
  // existe para impedir doblado) no debería condicionarlo en absoluto — coincide con el mismo fix
  // ya aplicado a la ruta de arrastre de vértice/extremo.
  if (r) {
    const tp = engine.toPlane(x, y);
    const dx = tp.x - engine.ramalDrag!.startX;
    const dy = tp.y - engine.ramalDrag!.startY;

    let slideDx = dx,
      slideDy = dy;
    for (const other of engine.ramales) {
      if (other.id === r.id || !sameNetGroup(other.net, r.net)) continue;
      for (let si = 0; si < other.pts.length - 1; si++) {
        const [ax, ay] = other.pts[si],
          [bx, by] = other.pts[si + 1];
        const sDx = bx - ax,
          sDy = by - ay;
        const sLen = Math.hypot(sDx, sDy);
        if (sLen < 0.001) continue;
        const origFirst = engine.ramalDrag!.origPts[0];
        const cross = Math.abs(sDx * (ay - origFirst[1]) - sDy * (ax - origFirst[0])) / sLen;
        if (cross < 0.05) {
          // Restringir el deslizamiento solo contra una unión T genuina (origFirst en el
          // interior del otro segmento) — no contra una esquina compartida de bajante donde
          // dos ramales solo se tocan en el extremo de ese segmento.
          const tCheck = ((origFirst[0] - ax) * sDx + (origFirst[1] - ay) * sDy) / (sLen * sLen);
          const marginT = Math.min(0.45, 2 / sLen);
          if (tCheck <= marginT || tCheck >= 1 - marginT) continue;
          const proposedX = origFirst[0] + dx,
            proposedY = origFirst[1] + dy;
          let t = ((proposedX - ax) * sDx + (proposedY - ay) * sDy) / (sLen * sLen);
          t = Math.max(0, Math.min(1, t));
          slideDx = ax + t * sDx - origFirst[0];
          slideDy = ay + t * sDy - origFirst[1];
          break;
        }
      }
    }

    for (let i = 0; i < r.pts.length; i++) {
      r.pts[i][0] = engine.ramalDrag!.origPts[i][0] + slideDx;
      r.pts[i][1] = engine.ramalDrag!.origPts[i][1] + slideDy;
    }
    if (engine.ramalDrag!.origLabelX !== undefined && r.labelX !== undefined) {
      r.labelX = engine.ramalDrag!.origLabelX + slideDx;
    }
    if (engine.ramalDrag!.origLabelY !== undefined && r.labelY !== undefined) {
      r.labelY = engine.ramalDrag!.origLabelY + slideDy;
    }
    r.totalL = calculateRamalLength(r.pts, engine);
    checkRamalAnglesExcludingConnections(engine, r);
    if (engine.ramalDrag!.connRamales) {
      for (const cr of engine.ramalDrag!.connRamales) {
        const other = ramalesById.get(cr.id);
        if (!other) continue;
        for (let i = 0; i < other.pts.length && i < cr.origPts.length; i++) {
          other.pts[i][0] = cr.origPts[i][0] + slideDx;
          other.pts[i][1] = cr.origPts[i][1] + slideDy;
        }
        other.totalL = calculateRamalLength(other.pts, engine);
        if (cr.origLabelX !== undefined && other.labelX !== undefined) {
          other.labelX = cr.origLabelX + slideDx;
        }
        if (cr.origLabelY !== undefined && other.labelY !== undefined) {
          other.labelY = cr.origLabelY + slideDy;
        }
      }
    }
    if (engine.nivelActual) {
      const lvl = engine.nivelActual.label ?? '';
      for (const b of engine.bajantes) {
        const desp = b.desplazamientos?.[lvl];
        if (desp && desp.Ldesvio === r.id) {
          // El Ldesvio conecta los dos extremos de una asociación entre pisos — arrastrarlo
          // como cuerpo completo debe llevar AMBOS a la vez, no solo actualizar el desplazamiento
          // lejano (destino/fantasma) y dejar atrás el glifo del bajante cercano (origen),
          // desconectado de pts[0].
          const firstPt = r.pts[0];
          const origBx = b.x,
            origBy = b.y;
          b.x = firstPt[0];
          b.y = firstPt[1];
          if (b.labelX !== undefined) b.labelX += b.x - origBx;
          if (b.labelY !== undefined) b.labelY += b.y - origBy;
          const lastPt = r.pts[r.pts.length - 1];
          desp.dx = lastPt[0] - b.x;
          desp.dy = lastPt[1] - b.y;
          break;
        }
      }
    }
    engine.scheduleRender();
  }
}
