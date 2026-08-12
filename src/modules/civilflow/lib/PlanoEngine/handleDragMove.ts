import type { IPlanoEngineCore, PlanoRamal, PlanoBajante, PlanoArea } from './PlanoState';
import { isBajante } from './PlanoState';
import { calculateRamalLength, _midpoint, _firstSegmentAngle } from './PlanoEngineDrawing';
import { checkRamalAngles } from './drawingAngles';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';
import { oppositeTextCorner, textLocalCorner, rotateLocalPoint } from './textAnnotationGeometry';
import { isRamalBajanteConnectionAllowed } from '../../utils/flowDirection';
import { resolveAndClampToCanal, clampToCanal } from './canalAssociation';

/**
 * Construye un índice por id de los ramales del motor. Los handlers de arrastre corren por frame
 * (cada movimiento de mouse) y hacían lookups O(n) repetidos por frame; con el índice los
 * lookups pasan a O(1) sin cambiar la semántica (mismo match por id, undefined si no existe).
 */
function indexRamales(engine: IPlanoEngineCore): Map<string, PlanoRamal> {
  return new Map(engine.ramales.map((r) => [r.id, r]));
}

/** Índice por id de los bajantes del motor — mismo propósito que indexRamales. */
function indexBajantes(engine: IPlanoEngineCore): Map<string, PlanoBajante> {
  return new Map(engine.bajantes.map((b) => [b.id, b]));
}

export function handleDragMove(engine: IPlanoEngineCore, x: number, y: number): void {
  const sameNetGroup = (a: string, b: string) =>
    a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
  if (engine.multiDrag) {
    const tp = engine.toPlane(x, y);
    const dx = tp.x - engine.multiDrag.startX;
    const dy = tp.y - engine.multiDrag.startY;
    const ramalesById = indexRamales(engine);
    const bajantesById = indexBajantes(engine);
    const textAnnotsById = new Map(engine.textAnnots.map((tt) => [tt.id, tt]));
    for (const id of Object.keys(engine.multiDrag.origData)) {
      const orig = engine.multiDrag.origData[id];
      if (!orig) continue;
      if (orig.type === 'ramal') {
        const r = ramalesById.get(id);
        if (r) {
          r.pts = (orig.origPts || []).map((p) => [p[0] + dx, p[1] + dy]);
          r.labelX = (orig.origLabelX || 0) + dx;
          r.labelY = (orig.origLabelY || 0) + dy;
          r.labelAngle = orig.origLabelAngle || 0;
          r.totalL = calculateRamalLength(r.pts, engine);
        }
      } else if (orig.type === 'bajante') {
        const b = bajantesById.get(id);
        if (b) {
          b.x = (orig.origX || 0) + dx;
          b.y = (orig.origY || 0) + dy;
          b.labelX = (orig.origLabelX || 0) + dx;
          b.labelY = (orig.origLabelY || 0) + dy;
        }
      } else if (orig.type === 'text') {
        const t = textAnnotsById.get(id);
        if (t) {
          t.x = (orig.origX || 0) + dx;
          t.y = (orig.origY || 0) + dy;
        }
      }
    }
    engine.scheduleRender();
    return;
  }
  if (engine.ramalDrag) {
    const ramalesById = indexRamales(engine);
    const r = ramalesById.get(engine.ramalDrag!.id);
    // bloqueado se pone en true a todo ramal al crearlo y nunca se quita en ninguna parte del
    // código, así que condicionar este arrastre de cuerpo completo a `!r.bloqueado` dejaba el
    // arrastre de cuerpo inoperante para TODOS los ramales — incluida la cascada connRamales/connBaj
    // unas líneas abajo, que es el mecanismo real para mover junto una red san/vent conectada. Una
    // traslación rígida del cuerpo completo nunca dobla la forma del ramal, así que bloqueado (que
    // existe para impedir doblado) no debería condicionarlo en absoluto — coincide con el mismo fix
    // ya aplicado a la ruta de arrastre de vértice/extremo.
    if (r) {
      const tp = engine.toPlane(x, y);
      const dx = tp.x - engine.ramalDrag.startX;
      const dy = tp.y - engine.ramalDrag.startY;

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
          const origFirst = engine.ramalDrag.origPts[0];
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
        r.pts[i][0] = engine.ramalDrag.origPts[i][0] + slideDx;
        r.pts[i][1] = engine.ramalDrag.origPts[i][1] + slideDy;
      }
      if (engine.ramalDrag.origLabelX !== undefined && r.labelX !== undefined) {
        r.labelX = engine.ramalDrag.origLabelX + slideDx;
      }
      if (engine.ramalDrag.origLabelY !== undefined && r.labelY !== undefined) {
        r.labelY = engine.ramalDrag.origLabelY + slideDy;
      }
      r.totalL = calculateRamalLength(r.pts, engine);
      checkRamalAngles(r.pts, r.net, r.tipo, engine.snapMode);
      if (engine.ramalDrag.connRamales) {
        for (const cr of engine.ramalDrag.connRamales) {
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
    return;
  }
  if (engine.ghostDrag) {
    const bajantesById = indexBajantes(engine);
    const ramalesById = indexRamales(engine);
    const b = bajantesById.get(engine.ghostDrag!.id);
    if (b && engine.nivelActual) {
      let dx = (x - engine.ghostDrag.startX) / engine.zoom + engine.ghostDrag.baseDx;
      let dy = (y - engine.ghostDrag.startY) / engine.zoom + engine.ghostDrag.baseDy;
      if (engine.snapMode) {
        let snappedPt = engine.snapAngle(b.x, b.y, b.x + dx, b.y + dy, b.net);
        const sp = engine.snapToExisting(snappedPt.x, snappedPt.y);
        if (sp) {
          snappedPt = sp;
        }
        dx = snappedPt.x - b.x;
        dy = snappedPt.y - b.y;
      }
      if (!b.desplazamientos) b.desplazamientos = {};
      const oldD = b.desplazamientos[engine.nivelActual.label ?? ''];

      const lDesvio = oldD ? oldD.Ldesvio : null;
      // SOLO actualizar el desplazamiento — NO tocar ramales existentes.
      // El padre sigue conectado a su ramal original; solo se mueve el fantasma.
      b.desplazamientos[engine.nivelActual.label ?? ''] = { dx, dy, Ldesvio: lDesvio };

      // Actualizar solo el ramal Ldesvio si existe (el ramal explícito de desplazamiento)
      const newGx = b.x + dx;
      const newGy = b.y + dy;
      if (lDesvio) {
        const r = ramalesById.get(lDesvio);
        if (r) {
          r.pts[0] = [b.x, b.y];
          r.pts[r.pts.length - 1] = [newGx, newGy];
          r.totalL = calculateRamalLength(r.pts, engine);
          r.labelAngle = _firstSegmentAngle(r.pts);
          const [mx, my] = _midpoint(r.pts);
          r.labelX = mx;
          r.labelY = my;
        }
      }

      engine.scheduleRender();
    }
    return;
  }
  if (engine.bajDrag) {
    const bajantesById = indexBajantes(engine);
    const ramalesById = indexRamales(engine);
    const b = bajantesById.get(engine.bajDrag!.id);
    if (b) {
      let p = engine.toPlane(x - engine.bajDrag.offX, y - engine.bajDrag.offY);
      const oldX = b.x;
      const oldY = b.y;

      // Modo snap: se restringe la nueva posición del bajante a un ángulo múltiplo de 45° medido
      // desde el VÉRTICE FIJO adyacente al extremo que toca este bajante — para un ramal doblado
      // (3+ puntos) ese es el punto de doblez vecino, NO el extremo opuesto de la polilínea.
      // Anclar en el extremo lejano de un ramal multisegmento mide el ángulo a través de todos
      // los dobleces intermedios, produciendo un ángulo arbitrario sobre el segmento que de
      // verdad se mueve. Elegir el ancla candidata más cercana al cursor crudo (enfoque aún más
      // viejo) casi siempre elegía el ancla cercana/la propia — en un arrastre continuo lento el
      // delta de cada frame es diminuto, así que pegar "desde sí mismo" apenas restringe nada y
      // el ramal de hecho derivaba libre.
      // Deliberadamente NO se pasa el segmento "entrante" a snapEndpointAngle: filtrar solo
      // candidatos con giro válido durante el arrastre hace inalcanzables los ángulos inválidos,
      // lo que se traga en silencio la alerta "Ángulo no recomendado" (checkRamalAngles al
      // soltar, abajo en handleDragUp, nunca ve un estado inválido que atrapar). Snap solo de
      // cuadrícula durante el arrastre + validar-y-revertir-con-alerta al soltar coincide con
      // cómo ptDrag/ramalDrag/dibujo ya presentan este aviso.
      if (engine.snapMode) {
        const assocIds = [...(b.recibeDeIds || [])];
        if (b.descargaEnId) assocIds.push(b.descargaEnId);
        const assocSet = new Set(assocIds);
        const assocRamales = (engine.ramales || []).filter(
          (r) => assocSet.has(r.id) && r.pts && r.pts.length >= 2,
        );
        if (assocRamales.length > 0) {
          const r = assocRamales[0];
          const pStart = r.pts[0];
          const pEnd = r.pts[r.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - oldX, pStart[1] - oldY);
          const distEnd = Math.hypot(pEnd[0] - oldX, pEnd[1] - oldY);
          const anchor =
            distStart <= distEnd
              ? r.pts.length > 2
                ? r.pts[1]
                : pEnd
              : r.pts.length > 2
                ? r.pts[r.pts.length - 2]
                : pStart;
          p = engine.snapAngle(anchor[0], anchor[1], p.x, p.y, r.net, r.tipo);
        }
      }

      const associatedRamales: PlanoRamal[] = [];
      if (b.recibeDeIds?.length) {
        b.recibeDeIds.forEach((rid) => {
          const r = engine.ramales.find((rr) => rr.id === rid);
          if (r) associatedRamales.push(r);
        });
      }
      if (b.descargaEnId) {
        const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
        const targetPlanId = parts[0];
        const targetId = parts[1];
        if (String(targetPlanId) === String(engine._loadedPlanId)) {
          const r = engine.ramales.find((rr) => rr.id === targetId);
          if (r) associatedRamales.push(r);
        }
      }

      // Snap al EXTREMO del ramal — siempre activo
      {
        const snapThresh = 20 / engine.zoom;
        for (const r of associatedRamales) {
          if (!r.pts || r.pts.length === 0) continue;
          const pStart = r.pts[0];
          const pEnd = r.pts[r.pts.length - 1];
          const dStart = Math.hypot(pStart[0] - p.x, pStart[1] - p.y);
          const dEnd = Math.hypot(pEnd[0] - p.x, pEnd[1] - p.y);
          if (dStart < snapThresh && dStart <= dEnd) {
            p.x = pStart[0];
            p.y = pStart[1];
            break;
          } else if (dEnd < snapThresh) {
            p.x = pEnd[0];
            p.y = pEnd[1];
            break;
          }
        }
      }

      // Auto-conexión: detectar extremos de ramal cercanos y auto-asociar durante el arrastre —
      // el canal es un símbolo independiente (igual que contador/calentador/red_publica) y nunca
      // se asocia con un ramal, así que nunca debe caer en este comportamiento de auto-conexión
      // exclusivo de bajantes.
      const autoThresh = 20 / engine.zoom;
      const recibeDeSet = new Set(b.recibeDeIds || []);
      for (const r of b.tipo === 'canal' ? [] : engine.ramales || []) {
        if (!r.pts || r.pts.length === 0) continue;
        if (r.net !== b.net) continue;
        if (recibeDeSet.has(r.id)) continue;
        const pStart = r.pts[0];
        const pEnd = r.pts[r.pts.length - 1];
        const dStart = Math.hypot(pStart[0] - p.x, pStart[1] - p.y);
        const dEnd = Math.hypot(pEnd[0] - p.x, pEnd[1] - p.y);
        // Guardia de dirección de flujo (centralizada en flowDirection.ts): un bajante 'baja'
        // solo debe RECIBIR flujo — nunca INICIAR un ramal; un 'sube' solo debe EMITIR — nunca
        // TERMINAR uno. La guardia dispara una vez por el extremo infractor y sigue buscando el
        // siguiente ramal, así otras asociaciones válidas del mismo movimiento no quedan
        // bloqueadas.
        if (dStart < autoThresh && dStart <= dEnd) {
          const allowed = isRamalBajanteConnectionAllowed(engine, r, 0, b);
          if (!allowed) continue;
          if (!b.recibeDeIds) b.recibeDeIds = [];
          b.recibeDeIds.push(r.id);
          r.ini = b.code || b.id;
          p.x = pStart[0];
          p.y = pStart[1];
          break;
        } else if (dEnd < autoThresh) {
          const allowed = isRamalBajanteConnectionAllowed(engine, r, r.pts.length - 1, b);
          if (!allowed) continue;
          if (!b.recibeDeIds) b.recibeDeIds = [];
          b.recibeDeIds.push(r.id);
          r.fin = b.code || b.id;
          p.x = pEnd[0];
          p.y = pEnd[1];
          break;
        }
      }

      // Un bajante de lluvia dentro de un canal recolectora puede reposicionarse libremente
      // DENTRO del rectángulo del canal (recortado a sus límites), pero no puede salirse de él —
      // se mantiene asociado a ese canal. Un bajante aún no asociado se puede arrastrar libre y,
      // al caer dentro de un rectángulo de canal, queda asociado desde ese momento.
      if (b.net === 'll' && b.tipo === 'bajante') {
        if (b.canalId) {
          const canal = engine.bajantes.find((c) => c.id === b.canalId && c.tipo === 'canal');
          if (canal) {
            const clamped = clampToCanal(engine, canal, p.x, p.y);
            p.x = clamped.x;
            p.y = clamped.y;
          }
        } else {
          const resolved = resolveAndClampToCanal(engine, p.x, p.y, null);
          p.x = resolved.x;
          p.y = resolved.y;
          b.canalId = resolved.canalId;
        }
      }

      const dx = p.x - oldX;
      const dy = p.y - oldY;

      b.x = p.x;
      b.y = p.y;
      b.labelX = (b.labelX || 0) + dx;
      b.labelY = (b.labelY || 0) + dy;

      // Mover el cuerpo completo de un canal debe arrastrar a sus bajantes asociados con él —
      // guardan coordenadas absolutas de plano, no un desplazamiento relativo al canal, así que
      // sin esto se quedarían quietos y terminarían fuera de la nueva posición del canal.
      if (b.tipo === 'canal') {
        for (const assoc of engine.bajantes) {
          if (assoc.canalId !== b.id) continue;
          const moved = clampToCanal(engine, b, assoc.x + dx, assoc.y + dy);
          assoc.x = moved.x;
          assoc.y = moved.y;
        }
      }

      if (b.recibeDeIds?.length) {
        b.recibeDeIds.forEach((rid) => {
          const r = engine.ramales.find((rr) => rr.id === rid);
          if (!r || !r.pts) return;
          let changed = false;
          if (Math.hypot(r.pts[0][0] - oldX, r.pts[0][1] - oldY) < 0.5) {
            r.pts[0][0] = p.x;
            r.pts[0][1] = p.y;
            changed = true;
          }
          const lastIdx = r.pts.length - 1;
          if (Math.hypot(r.pts[lastIdx][0] - oldX, r.pts[lastIdx][1] - oldY) < 0.5) {
            r.pts[lastIdx][0] = p.x;
            r.pts[lastIdx][1] = p.y;
            changed = true;
          }
          if (changed) {
            r.totalL = calculateRamalLength(r.pts, engine);
            r.labelAngle = _firstSegmentAngle(r.pts);
            const [mx, my] = _midpoint(r.pts);
            r.labelX = mx;
            r.labelY = my;
            checkRamalAngles(r.pts, r.net, r.tipo, engine.snapMode);
          }
        });
      }

      // Mantener pegado el ramal conector del fantasma (Ldesvio): el primer extremo sigue al
      // padre, el segundo se queda en su posición absoluta fija (el fantasma no deriva con el
      // padre — el desplazamiento se compensa con el delta del movimiento).
      if (b.desplazamientos) {
        const dxMove = p.x - oldX;
        const dyMove = p.y - oldY;
        for (const d of Object.values(b.desplazamientos)) {
          if (!d.Ldesvio) continue;
          const r = ramalesById.get(d.Ldesvio);
          if (!r) continue;
          r.pts[0] = [b.x, b.y];
          d.dx -= dxMove;
          d.dy -= dyMove;
          r.pts[r.pts.length - 1] = [b.x + d.dx, b.y + d.dy];
          r.totalL = calculateRamalLength(r.pts, engine);
          r.labelAngle = _firstSegmentAngle(r.pts);
          const [mx, my] = _midpoint(r.pts);
          r.labelX = mx;
          r.labelY = my;
        }
      }

      engine.scheduleRender();
    }
    return;
  }
  if (engine.lblDrag) {
    const el =
      engine.ramales.find((r) => r.id === engine.lblDrag!.id) ||
      engine.bajantes.find((b) => b.id === engine.lblDrag!.id) ||
      engine.areas.find((a) => a.id === engine.lblDrag!.id);
    if (el) {
      const p = engine.toPlane(x - engine.lblDrag.offX, y - engine.lblDrag.offY);
      // Solo un bajante tiene posiciones de etiqueta "fantasma" entre pisos (ghostData, una por
      // piso) — los ramales/áreas nunca. Se usa la bandera _lblDragIsParent: si el arrastre
      // empezó en la etiqueta del padre se actualiza labelX/labelY; si no (etiqueta fantasma),
      // se actualiza ghostData. Además se condiciona con isBajante(el), para que un arrastre de
      // etiqueta de ramal/área siempre escriba labelX/labelY directo — sin eso, cada arrastre de
      // etiqueta de ramal/área caía en la rama fantasma (isParentDrag nunca se fija true para
      // ellos) y escribía en una propiedad ghostData inexistente, así que la etiqueta nunca se
      // movía de verdad.
      const isParentDrag = !!engine._lblDragIsParent;
      if (engine.lblDrag.slot && !isBajante(el)) {
        const ramal = el as PlanoRamal;
        if (engine.lblDrag.slot === 'ini') ramal.sifonLabelIni = [p.x, p.y];
        else ramal.sifonLabelFin = [p.x, p.y];
      } else if (!isParentDrag && engine.nivelActual && isBajante(el)) {
        const baj = el;
        const lbl = engine.nivelActual.label ?? '';
        if (!baj.ghostData) baj.ghostData = {};
        if (!baj.ghostData[lbl]) baj.ghostData[lbl] = {};
        baj.ghostData[lbl].labelX = p.x;
        baj.ghostData[lbl].labelY = p.y;
      } else {
        (el as PlanoRamal | PlanoBajante | PlanoArea).labelX = p.x;
        (el as PlanoRamal | PlanoBajante | PlanoArea).labelY = p.y;
      }
      engine.scheduleRender();
    }
    return;
  }
  if (engine.txtDrag) {
    const t = engine.textAnnots.find((tt) => tt.id === engine.txtDrag!.id);
    if (t) {
      const p = engine.toPlane(x, y);
      t.x = engine.txtDrag.origX + (p.x - engine.txtDrag.startX);
      t.y = engine.txtDrag.origY + (p.y - engine.txtDrag.startY);
      engine.scheduleRender();
    }
    return;
  }
  if (engine.txtResize) {
    const t = engine.textAnnots.find((tt) => tt.id === engine.txtResize!.id);
    if (t) {
      const { corner, anchorX, anchorY, startDist, origFontMm, origBoxWpx } = engine.txtResize;
      const dist = Math.hypot(x - anchorX, y - anchorY);
      const scale = startDist > 0.01 ? Math.max(0.2, Math.min(6, dist / startDist)) : 1;
      const newFontMm = Math.max(1, Math.min(40, origFontMm * scale));
      const pad = 5 * engine.zoom;
      const newBoxWFull = Math.max(pad * 2 + 4, origBoxWpx * scale);
      t.fontMm = newFontMm;
      t.boxW = (newBoxWFull - pad * 2) / engine.zoom;

      // Mantener la esquina ancla (la opuesta a la que se arrastra) clavada en su posición
      // original de canvas — recalcular dónde debe quedar el origen de traslación de la caja
      // (t.x/t.y) para que la esquina ancla de la caja NUEVA (redimensionada) caiga exactamente
      // ahí.
      const fs2 = engine.mm2cvs(newFontMm);
      const boxHFull2 = fs2 + pad * 2;
      const angle = ((t.textAngle || 0) * Math.PI) / 180;
      const anchorCorner = oppositeTextCorner(corner);
      const local = textLocalCorner(anchorCorner, fs2, pad, newBoxWFull, boxHFull2);
      const rot = rotateLocalPoint(local.lx, local.ly, angle);
      const newC = engine.toPlane(anchorX - rot.x, anchorY - rot.y);
      t.x = newC.x - (t.lblOffX || 0);
      t.y = newC.y - (t.lblOffY || 0);
      engine.scheduleRender();
    }
    return;
  }
  if (engine.canalResizeDrag) {
    // Genérico en todas las direcciones: la esquina arrastrada siempre termina siendo el punto
    // de plano que NO es el ancla fija, así que no hace falta ramificar por esquina — agarrar
    // cualquiera de las 4 esquinas resuelve a la misma matemática de min/abs contra su propia
    // opuesta fija.
    const { id, anchorX, anchorY } = engine.canalResizeDrag;
    const canal = engine.bajantes.find((b) => b.id === id);
    if (canal) {
      const p = engine.toPlane(x, y);
      canal.x = Math.min(anchorX, p.x);
      canal.y = Math.min(anchorY, p.y);
      canal.longitud = Math.max(1, +(engine.pxToM(Math.abs(p.x - anchorX)) * 100).toFixed(1));
      canal.base = Math.max(1, +(engine.pxToM(Math.abs(p.y - anchorY)) * 100).toFixed(1));
      // Encoger el canal puede dejar un bajante asociado fuera de su rectángulo nuevo — se
      // regresa, con la misma regla que un bajante arrastrado hacia el borde.
      for (const assoc of engine.bajantes) {
        if (assoc.canalId !== canal.id) continue;
        const clamped = clampToCanal(engine, canal, assoc.x, assoc.y);
        assoc.x = clamped.x;
        assoc.y = clamped.y;
      }
      engine.scheduleRender();
    }
    return;
  }
  if (engine.dimLblDrag) {
    const d = engine.dims.find((dd) => dd.id === engine.dimLblDrag!.id);
    if (d) {
      const p = engine.toPlane(x - engine.dimLblDrag.offX, y - engine.dimLblDrag.offY);
      d.lblX = p.x;
      d.lblY = p.y;
      engine.scheduleRender();
    }
    return;
  }
  if (engine.dimDrag) {
    const d = engine.dims.find((dd) => dd.id === engine.dimDrag!.id);
    if (d) {
      const p = engine.toPlane(x, y);
      const dx = p.x - engine.dimDrag.startX;
      const dy = p.y - engine.dimDrag.startY;
      d.x1 += dx;
      d.y1 += dy;
      d.x2 += dx;
      d.y2 += dy;
      if (d.lblX != null && d.lblY != null) {
        d.lblX += dx;
        d.lblY += dy;
      }
      engine.dimDrag.startX = p.x;
      engine.dimDrag.startY = p.y;
      engine.scheduleRender();
    }
    return;
  }
  if (engine.areaDrag) {
    const a = engine.areas.find((aa) => aa.id === engine.areaDrag!.id);
    if (a) {
      const p = engine.toPlane(x, y);
      const dx = p.x - engine.areaDrag.startX;
      const dy = p.y - engine.areaDrag.startY;
      a.pts.forEach((pt) => {
        pt[0] += dx;
        pt[1] += dy;
      });
      if (a.labelX !== undefined) {
        a.labelX += dx;
        a.labelY += dy;
      }
      engine.areaDrag.startX = p.x;
      engine.areaDrag.startY = p.y;
      engine.scheduleRender();
    }
    return;
  }
  if (engine.ptDrag) {
    const r = engine.ramales.find((rr) => rr.id === engine.ptDrag!.id);
    if (r) {
      let p = engine.toPlane(x, y);
      const idx = engine.ptDrag.ptIdx;
      const isEndpoint = idx === 0 || idx === r.pts.length - 1;

      // Accesorio a mitad de ramal: deslizarse solo por la línea recta entre sus vecinos,
      // recortado entre ellos, para que el recorrido real del ramal nunca se doble por este
      // arrastre.
      const accSlide = engine.ptDrag.accMedSlide;
      if (accSlide) {
        const sDx = accSlide.bx - accSlide.ax,
          sDy = accSlide.by - accSlide.ay;
        const sLen2 = sDx * sDx + sDy * sDy;
        let t =
          sLen2 > 0.0001 ? ((p.x - accSlide.ax) * sDx + (p.y - accSlide.ay) * sDy) / sLen2 : 0;
        t = Math.max(0.02, Math.min(0.98, t));
        r.pts[idx][0] = accSlide.ax + t * sDx;
        r.pts[idx][1] = accSlide.ay + t * sDy;
        engine.scheduleRender();
        return;
      }

      if (engine.snapMode) {
        const constraint = engine.ptDrag.slideConstraint;
        let snappedToConstraint = false;

        if (isEndpoint && constraint) {
          const other = engine.ramales.find((o) => o.id === constraint.otherId);
          if (other && other.pts && other.pts.length > constraint.segmentIdx) {
            const [ax, ay] = other.pts[constraint.segmentIdx];
            const [bx, by] = other.pts[constraint.segmentIdx + 1] || [ax, ay];
            const sDx = bx - ax,
              sDy = by - ay;
            const sLen = Math.hypot(sDx, sDy);
            if (sLen > 0.001) {
              const crossPlane = Math.abs(sDx * (ay - p.y) - sDy * (ax - p.x)) / sLen;
              if (crossPlane < engine.mm2cvs(3)) {
                const t = ((p.x - ax) * sDx + (p.y - ay) * sDy) / (sLen * sLen);
                p.x = ax + t * sDx;
                p.y = ay + t * sDy;
                snappedToConstraint = true;
              }
            }
          }
        }

        // Snap solo de cuadrícula (sin filtrar por giro válido) para que un giro inválido pueda
        // formarse aquí — ver el comentario equivalente en la rama bajDrag de arriba para el
        // porqué: debe ser alcanzable para que checkRamalAngles al soltar lo atrape y muestre
        // "Ángulo no recomendado".
        if (!snappedToConstraint) {
          if (idx === 0 && r.pts.length > 1) {
            p = engine.snapAngle(r.pts[1][0], r.pts[1][1], p.x, p.y, r.net, r.tipo);
          } else if (idx > 0) {
            p = engine.snapAngle(r.pts[idx - 1][0], r.pts[idx - 1][1], p.x, p.y, r.net, r.tipo);
          }
        }
      }

      if (isEndpoint) {
        const associatedBajantes: PlanoBajante[] = [];
        engine.bajantes.forEach((b) => {
          const isRecibe = b.recibeDeIds?.includes(r.id);
          let isDescarga = false;
          if (b.descargaEnId) {
            const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
            const targetPlanId = parts[0];
            const targetId = parts[1];
            if (String(targetPlanId) === String(engine._loadedPlanId) && targetId === r.id) {
              isDescarga = true;
            }
          }
          if (isRecibe || isDescarga) {
            associatedBajantes.push(b);
          }
        });

        const snapThresh = 20 / engine.zoom;
        let snapped = false;
        for (const b of associatedBajantes) {
          const dist = Math.hypot(b.x - p.x, b.y - p.y);
          if (dist < snapThresh) {
            p.x = b.x;
            p.y = b.y;
            snapped = true;
            break;
          }
        }

        // También pegar a otros bajantes/puntos del canvas (snapToExisting), excluyendo los
        // propios
        if (!snapped) {
          const snapThresh2 = 16 / engine.zoom;
          // Pegar a otros bajantes
          for (const b of engine.bajantes) {
            if (b.id === r.id) continue;
            if (b.net !== r.net) continue;
            if (engine._hiddenNets.has(b.net)) continue;
            const lvlLabel = engine.nivelActual?.label ?? '';
            const disp = b.desplazamientos?.[lvlLabel] || {};
            const bx = b.x + (disp.dx || 0);
            const by = b.y + (disp.dy || 0);
            const dist = Math.hypot(bx - p.x, by - p.y);
            if (dist < snapThresh2) {
              p.x = bx;
              p.y = by;
              snapped = true;
              break;
            }
          }
          // Pegar a los extremos de otros ramales
          if (!snapped) {
            for (const other of engine.ramales) {
              if (other.id === r.id) continue;
              if (other.net !== r.net) continue;
              for (const [rx, ry] of other.pts) {
                const dist = Math.hypot(rx - p.x, ry - p.y);
                if (dist < snapThresh2) {
                  p.x = rx;
                  p.y = ry;
                  snapped = true;
                  break;
                }
              }
              if (snapped) break;
            }
          }
        }
      }

      const oldP = [...r.pts[idx]];
      r.pts[idx] = [p.x, p.y];

      const dPx = p.x - oldP[0],
        dPy = p.y - oldP[1];
      if (Math.abs(dPx) + Math.abs(dPy) > 0.001) {
        const movedRamalIds = new Set<string>([r.id]);
        const allOldPositions: number[][] = [oldP];
        let frontier: number[][] = [oldP];

        while (frontier.length > 0) {
          const nextFrontier: number[][] = [];
          for (const other of engine.ramales) {
            if (other.id === r.id || !sameNetGroup(other.net, r.net) || movedRamalIds.has(other.id))
              continue;
            let changed = false;
            // Punto contra punto: ¿un punto del frente de avance coincide con un vértice de
            // `other`?
            for (let i = 0; i < other.pts.length; i++) {
              const matches = frontier.some(
                (fp) => Math.hypot(other.pts[i][0] - fp[0], other.pts[i][1] - fp[1]) < 0.5,
              );
              if (matches) {
                const before: [number, number] = [other.pts[i][0], other.pts[i][1]];
                other.pts[i][0] += dPx;
                other.pts[i][1] += dPy;
                changed = true;
                nextFrontier.push(before);
                allOldPositions.push(before);
              }
            }
            // Punto contra cuerpo: ¿un punto del frente aterriza sobre el segmento del cuerpo de
            // `other` (extremo de vent sobre cuerpo de san)? Espejo de frontierOnOtherBody en
            // collectConnectedGraph.
            if (!changed) {
              frontier.some((fp) => {
                if (!other.pts || other.pts.length < 2) return false;
                for (let si = 0; si < other.pts.length - 1; si++) {
                  const [ax, ay] = other.pts[si],
                    [bx, by] = other.pts[si + 1];
                  const sDx = bx - ax,
                    sDy = by - ay;
                  const sLen = Math.hypot(sDx, sDy);
                  if (sLen < 0.001) continue;
                  const cross = Math.abs(sDx * (ay - fp[1]) - sDy * (ax - fp[0])) / sLen;
                  if (cross >= 0.5) continue;
                  const t = ((fp[0] - ax) * sDx + (fp[1] - ay) * sDy) / (sLen * sLen);
                  if (t >= -0.02 && t <= 1.02) {
                    // Desplazar rígidamente todos los puntos de `other`
                    for (let pi = 0; pi < other.pts.length; pi++) {
                      const origPt: [number, number] = [other.pts[pi][0], other.pts[pi][1]];
                      other.pts[pi][0] += dPx;
                      other.pts[pi][1] += dPy;
                      nextFrontier.push(origPt);
                      allOldPositions.push(origPt);
                    }
                    changed = true;
                    break;
                  }
                }
                return false;
              });
            }
            if (changed) {
              movedRamalIds.add(other.id);
              other.totalL = calculateRamalLength(other.pts, engine);
              other.labelAngle = _firstSegmentAngle(other.pts);
              const [mx, my] = _midpoint(other.pts);
              other.labelX = mx;
              other.labelY = my;
            }
          }
          frontier = nextFrontier;
        }

        // Codo reventilado: el extremo del ramal de vent y el punto coincidente del ramal de san
        // deben quedar exactamente juntos, así que se mueve el punto enlazado a la misma
        // posición absoluta en vez de por delta (evita la deriva si no estaban pixel-perfect
        // coincidentes).
        if (engine.ptDrag.linkedPts) {
          const ramalesById = indexRamales(engine);
          for (const link of engine.ptDrag.linkedPts) {
            const other = ramalesById.get(link.id);
            if (!other || !other.pts[link.ptIdx]) continue;
            other.pts[link.ptIdx] = [p.x, p.y];
            other.totalL = calculateRamalLength(other.pts, engine);
            other.labelAngle = _firstSegmentAngle(other.pts);
            const [mx, my] = _midpoint(other.pts);
            other.labelX = mx;
            other.labelY = my;
          }
        }
        // Los bajantes son los anclajes fijos de la red — un arrastre de extremo debe adaptar el
        // ramal a la posición del bajante, no desplazar el bajante para seguir el arrastre. Solo
        // el ramalDrag de cuerpo completo (abajo) puede trasladar rígidamente un bajante
        // conectado.
      }

      if (engine.nivelActual) {
        const lvl = engine.nivelActual.label ?? '';
        for (const b of engine.bajantes) {
          const desp = b.desplazamientos?.[lvl];
          if (desp && desp.Ldesvio === r.id) {
            const lastPt = r.pts[r.pts.length - 1];
            desp.dx = lastPt[0] - b.x;
            desp.dy = lastPt[1] - b.y;
            break;
          }
        }
      }
      r.labelAngle = _firstSegmentAngle(r.pts);
      r.totalL = calculateRamalLength(r.pts, engine);
      const [mx, my] = _midpoint(r.pts);
      r.labelX = mx;
      r.labelY = my;
      checkRamalAngles(r.pts, r.net, r.tipo, engine.snapMode);
      engine.scheduleRender();
    }
    return;
  }
}
