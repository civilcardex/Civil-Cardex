import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { calculateRamalLength, _midpoint } from '../PlanoEngineDrawing.ts';
import { angleAtHalfLength } from '../drawingAngles.ts';
import { parseDescargaEnId } from '../../../utils/parseDischargeInId.ts';
import { puedeConectarRamalABajante } from '../bajanteRules.ts';
import { bumpBajanteToMaxRamal } from '../drawingUtils.ts';
import { checkRamalAnglesExcludingConnections } from '../junctionAutoSplit.ts';
import { indexRamales, indexBajantes, type DragCtx } from './dragContext.ts';

/** Arrastre del FANTASMA entrepisos (anillo de desplazamiento): SOLO actualiza el
 *  desplazamiento del piso — no toca ramales existentes salvo el Ldesvio explícito. */
export function dragGhost(engine: IPlanoEngineCore, x: number, y: number): void {
  const bajantesById = indexBajantes(engine);
  const ramalesById = indexRamales(engine);
  const b = bajantesById.get(engine.ghostDrag!.id);
  if (b && engine.nivelActual) {
    let dx = (x - engine.ghostDrag!.startX) / engine.zoom + engine.ghostDrag!.baseDx;
    let dy = (y - engine.ghostDrag!.startY) / engine.zoom + engine.ghostDrag!.baseDy;
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

    // La etiqueta del fantasma colocada a mano acompaña al anillo (ped. usuario: se
    // quedaba clavada mientras el fantasma seguía al cursor). Solo si existe la etiqueta
    // previa — la de offset fijo (15mm) se recalcula sola en el render.
    const lbl = engine.nivelActual.label ?? '';
    const gd = b.ghostData?.[lbl];
    if (gd && gd.labelX != null && gd.labelY != null && oldD) {
      gd.labelX += dx - oldD.dx;
      gd.labelY += dy - oldD.dy;
    }

    // Actualizar solo el ramal Ldesvio si existe (el ramal explícito de desplazamiento)
    const newGx = b.x + dx;
    const newGy = b.y + dy;
    if (lDesvio) {
      const r = ramalesById.get(lDesvio);
      if (r) {
        r.pts[0] = [b.x, b.y];
        r.pts[r.pts.length - 1] = [newGx, newGy];
        r.totalL = calculateRamalLength(r.pts, engine);
        if (!r.labelMoved) r.labelAngle = angleAtHalfLength(r.pts);
        const [mx, my] = _midpoint(r.pts);
        r.labelX = mx;
        r.labelY = my;
      }
    }

    engine.scheduleRender();
  }
}

/** Arrastre de un BAJANTE/MONTANTE/canal: snap 45° anclado al doblez vecino, snap al extremo
 *  de sus ramales asociados, AUTO-CONEXIÓN de extremos cercanos (canal excluido) y arrastre de
 *  los extremos pegados + el Ldesvio del fantasma. */
export function dragBajante(engine: IPlanoEngineCore, x: number, y: number, ctx: DragCtx): void {
  const { ramalesPorId } = ctx;
  const bajantesById = indexBajantes(engine);
  const ramalesById = indexRamales(engine);
  const b = bajantesById.get(engine.bajDrag!.id);
  if (b) {
    let p = engine.toPlane(x - engine.bajDrag!.offX, y - engine.bajDrag!.offY);
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
        const r = ramalesPorId.get(rid);
        if (r) associatedRamales.push(r);
      });
    }
    if (b.descargaEnId) {
      const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
      const targetPlanId = parts[0];
      const targetId = parts[1];
      if (String(targetPlanId) === String(engine._loadedPlanId)) {
        const r = ramalesPorId.get(targetId);
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
      // Tributarios ni llegan ni salen de un bajante (orig. usuario) — se saltan en silencio
      // durante el arrastre.
      if (r.tipo === 'tributario') continue;
      if (recibeDeSet.has(r.id)) continue;
      const pStart = r.pts[0];
      const pEnd = r.pts[r.pts.length - 1];
      const dStart = Math.hypot(pStart[0] - p.x, pStart[1] - p.y);
      const dEnd = Math.hypot(pEnd[0] - p.x, pEnd[1] - p.y);
      // Regla central (bajanteRules): misma red + tope de asociaciones — se dispara una vez
      // por el extremo infractor y sigue buscando el siguiente ramal, así otras asociaciones
      // válidas del mismo movimiento no quedan bloqueadas. Iniciar un ramal en el bajante es
      // válido: el extremo pts[0] alimenta (r.ini).
      if (dStart < autoThresh && dStart <= dEnd) {
        const check = puedeConectarRamalABajante(b, r, 'alimenta');
        if (!check.ok) {
          if (check.title && check.msg) engine.triggerAlert(check.title, check.msg);
          continue;
        }
        // Diámetro según cómo se conecta (orig. usuario): el ramal que nace del bajante
        // adopta su dNominal; si el bajante no tiene, toma el del ramal.
        if (b.dNominal) r.diametro = r.diametro || b.dNominal;
        else if (r.diametro) b.dNominal = r.diametro;
        if (!b.recibeDeIds) b.recibeDeIds = [];
        // El Set (recibeDeSet) ya sabe si está: el .includes sobre el array que crece era
        // O(n) por asociación, y este código corre por cuadro.
        if (!recibeDeSet.has(r.id)) {
          b.recibeDeIds.push(r.id);
          recibeDeSet.add(r.id);
        }
        r.ini = b.code || b.id;
        p.x = pStart[0];
        p.y = pStart[1];
        break;
      } else if (dEnd < autoThresh) {
        const check = puedeConectarRamalABajante(b, r, 'recibe');
        if (!check.ok) {
          if (check.title && check.msg) engine.triggerAlert(check.title, check.msg);
          continue;
        }
        // Llegada: el ramal conserva su diámetro (si lo tiene) y el bajante sube al mayor.
        if (!r.diametro && b.dNominal) r.diametro = b.dNominal;
        if (!b.recibeDeIds) b.recibeDeIds = [];
        if (!recibeDeSet.has(r.id)) {
          b.recibeDeIds.push(r.id);
          recibeDeSet.add(r.id);
        }
        const bumped = bumpBajanteToMaxRamal(engine.ramales, b.recibeDeIds, b.dNominal || '');
        if (bumped) b.dNominal = bumped;
        r.fin = b.code || b.id;
        p.x = pEnd[0];
        p.y = pEnd[1];
        break;
      }
    }

    // (orig. usuario) YA NO hay asociación automática canal↔bajante al arrastrar: la
    // asociación vive en los ramales que el usuario dibuja del canal al bajante
    // (PlanoRamal.esCanalId + recibeDeIds del bajante, todo explícito).

    const dx = p.x - oldX;
    const dy = p.y - oldY;

    b.x = p.x;
    b.y = p.y;
    b.labelX = (b.labelX || 0) + dx;
    b.labelY = (b.labelY || 0) + dy;

    if (b.recibeDeIds?.length) {
      b.recibeDeIds.forEach((rid) => {
        const r = ramalesPorId.get(rid);
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
          if (!r.labelMoved) r.labelAngle = angleAtHalfLength(r.pts);
          if (!r.labelMoved) {
            const [mx, my] = _midpoint(r.pts);
            r.labelX = mx;
            r.labelY = my;
          }
          checkRamalAnglesExcludingConnections(engine, r);
        }
      });
    }

    // Mantener pegado el ramal conector del fantasma (Ldesvio). Layout nuevo: el portador
    // del desplazamiento es el bajante INFERIOR — el extremo del Ldesvio en ESTE piso
    // (pts[último], lado inferior) sigue al arrastrado, y el extremo lejano queda anclado en
    // la posición proyectada del bajante superior: el anillo (b.x+dx) NO deriva con el
    // arrastre — el delta del movimiento se compensa en dx/dy.
    if (b.desplazamientos) {
      const dxMove = p.x - oldX;
      const dyMove = p.y - oldY;
      for (const d of Object.values(b.desplazamientos)) {
        if (!d.Ldesvio) continue;
        const r = ramalesById.get(d.Ldesvio);
        if (!r) continue;
        r.pts[r.pts.length - 1] = [b.x, b.y];
        d.dx -= dxMove;
        d.dy -= dyMove;
        r.pts[0] = [b.x + d.dx, b.y + d.dy];
        r.totalL = calculateRamalLength(r.pts, engine);
        if (!r.labelMoved) r.labelAngle = angleAtHalfLength(r.pts);
        if (!r.labelMoved) {
          const [mx, my] = _midpoint(r.pts);
          r.labelX = mx;
          r.labelY = my;
        }
      }
    }

    engine.scheduleRender();
  }
}
