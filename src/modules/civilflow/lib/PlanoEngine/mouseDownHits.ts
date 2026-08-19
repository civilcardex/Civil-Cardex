import type { IPlanoEngineCore, PlanoBajante, PlanoElement, MultiDragOrigData } from './PlanoState';
import { ensureActiveNet } from './PlanoState';
import {
  pointInLabelBox,
  pointToSegmentDist,
  distanceToRamal,
  pointOnAnyBodySegment,
} from './HitTester';
import { selectAt } from './PlanoEngineSelection';
import { findCodoReventiladoLinks } from './PlanoEngineNetwork';
import { bajanteHitDistance, canalRectHitDistance } from './canalAssociation';

// Toma una foto de la posición del bajante y de todo ramal que toca (recibeDeIds, descargaEnId
// y su propio conector fantasma Ldesvio) antes de que empiece un bajDrag, para que handleDragUp
// pueda validar los ángulos resultantes igual que ptDrag/ramalDrag ya hacen — y revertir +
// alertar si son inválidos.
export function _captureBajDragBackup(engine: IPlanoEngineCore, b: PlanoBajante): void {
  engine._bajDragBackupXY = { x: b.x, y: b.y, labelX: b.labelX, labelY: b.labelY };
  const assocIds = [...(b.recibeDeIds || [])];
  if (b.descargaEnId) assocIds.push(b.descargaEnId);
  const lvl = engine.nivelActual?.label ?? '';
  const ldesvioId = b.desplazamientos?.[lvl]?.Ldesvio;
  if (ldesvioId) assocIds.push(ldesvioId);
  const backup: Record<string, number[][]> = {};
  for (const rid of assocIds) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (r) backup[rid] = structuredClone(r.pts);
  }
  engine._bajDragBackupPts = backup;
}

export function _tryBajanteHit(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  sel: PlanoElement | null,
): boolean {
  // Escanear todos los bajantes, elegir el mejor acierto de etiqueta (padre preferido sobre
  // fantasma, más cercano preferido)
  let bestB: (typeof engine.bajantes)[0] | null = null;
  let bestDist = Infinity;
  let bestIsGhost = false;
  for (const b of engine.bajantes) {
    const lx = b.labelX ?? b.x;
    const ly = b.labelY ?? b.y + 20;
    const lPos = engine.toCvs(lx, ly);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < 40) {
      if (ensureActiveNet(engine, b.net)) return true;
      const isGhost = b.pisoBase !== engine.nivelActual?.label;
      if (!bestB || (!isGhost && bestIsGhost) || (isGhost === bestIsGhost && d < bestDist)) {
        bestB = b;
        bestDist = d;
        bestIsGhost = isGhost;
      }
    }
    // Etiqueta de contador/calentador en posición desplazada
    if (b.tipo === 'contador' || b.tipo === 'calentador') {
      const clx = b.labelX ?? b.x - 25;
      const cly = b.labelY ?? b.y;
      const clPos = engine.toCvs(clx, cly);
      const cd = Math.hypot(x - clPos.x, y - clPos.y);
      if (cd < 50) {
        if (ensureActiveNet(engine, b.net)) return true;
        if (!bestB || cd < bestDist) {
          bestB = b;
          bestDist = cd;
          bestIsGhost = false;
        }
      }
    }
    // Acierto de SÍMBOLO (solo si no hubo acierto de etiqueta). El objetivo de clic de un canal
    // es su rectángulo visible (_canalBox), no un círculo, así que nunca se traga clics de un
    // bajante que quede dentro de él — los glifos reales ganan primero (gana el círculo más
    // cercano), y el cuerpo del canal solo agarra el clic cuando ningún glifo está en el punto.
    if (!bestB) {
      let symBest: { b: (typeof engine.bajantes)[0]; d: number } | null = null;
      for (const b of engine.bajantes) {
        if (b.tipo === 'canal') continue;
        const circ = b._circ;
        if (!circ) continue;
        const d = Math.hypot(x - circ.x, y - circ.y);
        if (d < circ.r && (!symBest || d < symBest.d)) symBest = { b, d };
      }
      if (symBest) {
        const b = symBest.b;
        if (ensureActiveNet(engine, b.net)) return true;
        if (b.id !== sel?.id) {
          engine.selId = b.id;
          engine._emitSelect(b);
          engine.render();
        }
        const dragAnchor = engine.toCvs(b.x, b.y);
        engine.bajDrag = { id: b.id, offX: x - dragAnchor.x, offY: y - dragAnchor.y };
        _captureBajDragBackup(engine, b);
        return true;
      }
      for (const b of engine.bajantes) {
        if (b.tipo !== 'canal') continue;
        if (canalRectHitDistance(b, x, y, 4 * engine.zoom) === Infinity) continue;
        if (ensureActiveNet(engine, b.net)) return true;
        if (b.id !== sel?.id) {
          engine.selId = b.id;
          engine._emitSelect(b);
          engine.render();
        }
        const dragAnchor = engine.toCvs(b.x, b.y);
        engine.bajDrag = { id: b.id, offX: x - dragAnchor.x, offY: y - dragAnchor.y };
        _captureBajDragBackup(engine, b);
        return true;
      }
    }
  }
  if (bestB) {
    const lPos = engine.toCvs(bestB.labelX ?? bestB.x, bestB.labelY ?? bestB.y + 20);
    if (bestB.id !== sel?.id) {
      engine.selId = bestB.id;
      engine._emitSelect(bestB);
      engine.render();
    }
    engine._lblDragIsParent = true;
    engine.lblDrag = { id: bestB.id, offX: x - lPos.x, offY: y - lPos.y };
    return true;
  }
  return false;
}

// Redimensionado por manija de esquina del rectángulo de un canal seleccionado. Debe correr
// ANTES del chequeo genérico de círculo-de-símbolo de _tryBajanteHit (que de otro modo trataría
// cualquier clic dentro del círculo delimitador — incluido uno justo en una esquina — como un
// movimiento de cuerpo completo vía bajDrag), para que agarrar una esquina redimensione en vez
// de mover todo el rectángulo.
export function _tryCanalResizeHit(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  sel: PlanoElement | null,
): boolean {
  const canal = sel as
    | (PlanoBajante & { _canalBox?: { x: number; y: number; w: number; h: number } })
    | null;
  if (!canal || canal.tipo !== 'canal' || !canal._canalBox) return false;
  const box = canal._canalBox;
  const corners: { x: number; y: number; corner: 'tl' | 'tr' | 'bl' | 'br' }[] = [
    { x: box.x, y: box.y, corner: 'tl' },
    { x: box.x + box.w, y: box.y, corner: 'tr' },
    { x: box.x, y: box.y + box.h, corner: 'bl' },
    { x: box.x + box.w, y: box.y + box.h, corner: 'br' },
  ];
  const grabbed = corners.find((c) => Math.hypot(x - c.x, y - c.y) < 10);
  if (!grabbed) return false;
  const wPlane = engine.cmToPlanePx(canal.longitud || 0);
  const hPlane = engine.cmToPlanePx(canal.base || 0);
  // Esquina opuesta, en coordenadas de PLANO (canal.x/y siempre es la esquina superior-
  // izquierda) — queda fija durante todo el gesto sin importar qué esquina se agarró.
  const anchorX = grabbed.corner === 'tl' || grabbed.corner === 'bl' ? canal.x + wPlane : canal.x;
  const anchorY = grabbed.corner === 'tl' || grabbed.corner === 'tr' ? canal.y + hPlane : canal.y;
  engine.canalResizeDrag = { id: canal.id, corner: grabbed.corner, anchorX, anchorY };
  return true;
}

export function _tryRamalEndpointHit(engine: IPlanoEngineCore, x: number, y: number): boolean {
  // Un clic sobre la ETIQUETA de un ramal es su target explícito — nunca debe robarlo el
  // extremo cercano de otro ramal (bug: la etiqueta de una rama tee AF cerca de la unión
  // agarraba el extremo de un ll que terminaba ahí y cambiaba la red activa a aguas lluvias).
  // Se devuelve false para que el flujo de etiquetas de handleSelectDown decida con el
  // ensureActiveNet del dueño.
  for (const r of engine.ramales) {
    if (r._labelBox && pointInLabelBox(x, y, r._labelBox)) return false;
  }
  let bestRamal = null;
  let bestPtIdx = -1;
  let minPtDist = 15;
  // El ramal de desvío de un bajante fantasma tiene un extremo sentado exactamente en la
  // posición desplazada del fantasma, así que un clic sobre el símbolo del fantasma también cae
  // dentro de la tolerancia de ese extremo — sin esto, el acierto de extremo de abajo gana
  // primero y roba el clic al fantasma.
  const lvl = engine.nivelActual?.label ?? '';
  const ghostPts = engine.getBajantesFantasma().map((b) => {
    const disp = b.desplazamientos?.[lvl];
    return { x: b.x + (disp ? disp.dx : 0), y: b.y + (disp ? disp.dy : 0) };
  });
  for (const r of engine.ramales) {
    if (engine._hiddenNets.has(r.net)) continue;
    if (r.pts && r.pts.length >= 2) {
      for (const i of [0, r.pts.length - 1]) {
        // Un ramal auto-creado por una tee (mergesFrom) empieza EXACTAMENTE en el punto de la
        // unión — su vértice de arranque coincide con el extremo del ramal real que el usuario
        // dibujó (y con el cuerpo de la rama de la tee). Si su arranque participara en el acierto
        // de extremo, un clic sobre la rama/etiqueta del ramal real cerca de la unión lo
        // seleccionaba a él (el "fantasma RAF3") y cambiaba la red activa a la del tramo
        // auto-creado. Su extremo LIBRE (pts[último]) sigue agarrándose normal.
        if (r.mergesFrom && i === 0) continue;
        const pc = engine.toCvs(r.pts[i][0], r.pts[i][1]);
        const d = Math.hypot(x - pc.x, y - pc.y);
        if (d < minPtDist) {
          // Ramas CORTAS (o extremos pegados al propio cuerpo): el radio fijo de extremo
          // convertía TODO el cuerpo cercano al extremo en "extremo" — un clic sobre el cuerpo de
          // una rama tee corta agarraba su extremo de la unión y arrancaba un arrastre (o
          // seleccionaba el ramal pero moviendo la unión), en vez de seleccionar limpio
          // ("no me deja seleccionar RAF2 por el cuerpo ni por la etiqueta — la hitbox es enorme").
          // Regla: clic SOBRE el propio cuerpo (≤3px de su línea) y a >4px del extremo → NO agarrar
          // el extremo; selección limpia vía selectAt. El agarrar extremo queda para clics sobre el
          // punto mismo (≤4px) o fuera del trazo del ramal (buscar extremo cercano sigue igual).
          const ownBodyDist = distanceToRamal(
            x,
            y,
            r.pts,
            (px, py) => engine.toCvs(px, py),
            engine.mm2cvs(3),
          );
          if (ownBodyDist < engine.mm2cvs(3) && d > 4) {
            if (engine._debugSel)
              engine._debugSel.notes.push(
                `endpoint-skip ${r.id} i=${i} d=${d.toFixed(1)} onSelfBody`,
              );
            continue;
          }
          const epP = r.pts[i];
          const bajAtEp = engine.bajantes.find(
            (b) => Math.abs(b.x - epP[0]) < 0.1 && Math.abs(b.y - epP[1]) < 0.1,
          );
          const ghostAtEp = ghostPts.some(
            (g) => Math.abs(g.x - epP[0]) < 0.1 && Math.abs(g.y - epP[1]) < 0.1,
          );
          if (bajAtEp || ghostAtEp) continue;
          minPtDist = d;
          bestRamal = r;
          bestPtIdx = i;
        }
      }
    }
  }
  if (!bestRamal) return false;

  if (engine._debugSel) {
    engine._debugSel.notes.push(
      `_tryRamalEndpointHit win: ${bestRamal.id} i=${bestPtIdx} d=${minPtDist.toFixed(1)}`,
    );
  }

  // Una rama de tee insertada sobre el cuerpo de otra línea: su extremo cae dentro del trazo del
  // host (o un ramal ll pasó cerca por casualidad). Un clic así es un clic SOBRE EL CUERPO de ese
  // otro ramal — debe seleccionarlo (selectAt decide), NUNCA agarrar el extremo cercano, y mucho
  // menos cambiar la red activa a la red del ramal cuyo extremo quedó dentro del radio (af → ll,
  // que era el bug reportado: clic sobre rama AF que quedaba seleccionando/haciendo drag en ll).
  if (
    pointOnAnyBodySegment(
      engine.ramales.filter((r) => r.id !== bestRamal.id && !engine._hiddenNets.has(r.net)),
      x,
      y,
      (px, py) => engine.toCvs(px, py),
      engine.mm2cvs(3),
    )
  ) {
    // El clic pertenece al cuerpo de OTRO ramal — seleccionarlo (selectAt resuelve por
    // distancia con bonus del dueño del cuerpo) en vez de agarrar el extremo cercano. Devolver
    // false dejaba el clic a su suerte sobre el orden del array y podía seleccionar un ll que
    // cruzaba la unión (cambio de red accidental).
    selectAt(engine, x, y);
    return true;
  }

  if (ensureActiveNet(engine, bestRamal.net)) return true;
  engine.selId = bestRamal.id;
  engine.multiSel = [];
  engine._emitSelect(bestRamal);
  // Este es el camino de primer clic para agarrar el extremo de un ramal (corre antes de
  // _trySelRamalDrag, que solo maneja un SEGUNDO clic sobre un ramal ya seleccionado).
  // "Bloquear Movimiento" debe mantener inmutable la geometría del ramal — el checkbox del
  // menú contextual conmuta bloqueado, así que todo arrastre que escribiría pts está
  // condicionado a ello, incluido este. La selección misma sigue funcionando (el ramal queda
  // seleccionable, solo no arrastrable); la cascada (ser arrastrado porque un ramal conectado
  // se movió) sigue permitida, y los arrastres de cuerpo completo se condicionan en
  // _trySelRamalDrag abajo.

  let slideConstraint = undefined;
  {
    // Estrictamente solo misma red — un extremo nunca debe restringirse al deslizamiento
    // contra un segmento de una red distinta solo porque esté visualmente cerca.
    const pt = bestRamal.pts[bestPtIdx];
    for (const other of engine.ramales) {
      if (other.id === bestRamal.id || other.net !== bestRamal.net) continue;
      for (let si = 0; si < other.pts.length - 1; si++) {
        const [ax, ay] = other.pts[si],
          [bx, by] = other.pts[si + 1];
        const sDx = bx - ax,
          sDy = by - ay;
        const sLen = Math.hypot(sDx, sDy);
        if (sLen < 0.001) continue;
        const cross = Math.abs(sDx * (ay - pt[1]) - sDy * (ax - pt[0])) / sLen;
        if (cross < 0.05) {
          // Solo una unión T genuina (pt en el INTERIOR del otro segmento) debe restringir el
          // deslizamiento. Dos ramales que solo convergen en una esquina de bajante compartido
          // también pasan el chequeo cruzado aquí, porque se tocan en el extremo propio de ese
          // segmento — excluir el margen exterior distingue esos dos casos.
          const t = ((pt[0] - ax) * sDx + (pt[1] - ay) * sDy) / (sLen * sLen);
          const marginT = Math.min(0.45, 2 / sLen);
          if (t > marginT && t < 1 - marginT) {
            slideConstraint = { otherId: other.id, segmentIdx: si };
            break;
          }
        }
      }
      if (slideConstraint) break;
    }
  }

  if (bestRamal.bloqueado) return false;

  const codoLinks = findCodoReventiladoLinks(engine, bestRamal, bestPtIdx);
  if (codoLinks.length > 0) {
    const backups: Record<string, number[][]> = {};
    for (const link of codoLinks) {
      const other = engine.ramales.find((r) => r.id === link.id);
      if (other) backups[link.id] = structuredClone(other.pts);
    }
    engine._dragLinkedBackupPts = backups;
  } else {
    engine._dragLinkedBackupPts = null;
  }

  engine._dragBackupPts = structuredClone(bestRamal.pts);
  engine.ptDrag = {
    id: bestRamal.id,
    ptIdx: bestPtIdx,
    slideConstraint,
    linkedPts: codoLinks.length > 0 ? codoLinks : undefined,
  };
  engine.render();
  return true;
}

// Ítem 7: ¿el clic cae sobre un EXTREMO (pts[0]/pts[último]) de un ramal multi-seleccionado?
// En ese caso el arrastre de grupo NO debe robar el clic — el extremo sigue remodelando ese
// ramal individualmente (mismo criterio que _tryRamalEndpointHit: 15px).
export function _tryMultiSelEndpointHit(engine: IPlanoEngineCore, x: number, y: number): boolean {
  if (engine.multiSel.length === 0) return false;
  for (const id of engine.multiSel) {
    const re = engine.ramales.find((r) => r.id === id);
    if (!re || !re.pts || re.pts.length < 2) continue;
    for (const i of [0, re.pts.length - 1]) {
      const c = engine.toCvs(re.pts[i][0], re.pts[i][1]);
      if (Math.hypot(x - c.x, y - c.y) < 15) return true;
    }
  }
  return false;
}

export function _tryMultiSelDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  isMultiSelectModifier: boolean,
): boolean {
  if (engine.multiSel.length === 0 || engine.tool !== 'sel') return false;

  for (const id of engine.multiSel) {
    let hit = false;
    const re = engine.ramales.find((r) => r.id === id);
    if (re && re.pts) {
      for (let i = 0; i < re.pts.length; i++) {
        const pc = engine.toCvs(re.pts[i][0], re.pts[i][1]);
        if (Math.hypot(x - pc.x, y - pc.y) < 12) {
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let i = 0; i < re.pts.length - 1; i++) {
          const p1 = engine.toCvs(re.pts[i][0], re.pts[i][1]);
          const p2 = engine.toCvs(re.pts[i + 1][0], re.pts[i + 1][1]);
          if (pointToSegmentDist(x, y, p1.x, p1.y, p2.x, p2.y) < 8) {
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        const d = distanceToRamal(x, y, re.pts, (px, py) => engine.toCvs(px, py), engine.mm2cvs(4));
        if (d < 12) hit = true;
      }
      if (!hit && re._labelBox && pointInLabelBox(x, y, re._labelBox)) hit = true;
    }
    const be = engine.bajantes.find((b) => b.id === id);
    if (!hit && be) {
      hit = Number.isFinite(bajanteHitDistance(be, x, y));
      if (!hit && be._labelBox && pointInLabelBox(x, y, be._labelBox)) hit = true;
    }
    const te = engine.textAnnots.find((t) => t.id === id);
    if (!hit && te && te._box) {
      hit =
        x >= te._box.x &&
        x <= te._box.x + te._box.w &&
        y >= te._box.y &&
        y <= te._box.y + te._box.h;
    }
    if (hit) {
      if (!isMultiSelectModifier) {
        const tp = engine.toPlane(x, y);
        const origData: MultiDragOrigData = {};
        for (const mid of engine.multiSel) {
          const mel = engine.ramales.find((r) => r.id === mid);
          if (mel) {
            // Ítem 7: una traslación rígida del conjunto nunca dobla la forma del ramal, así que
            // `bloqueado` (que existe para impedir el doblado) no excluye a nadie del arrastre de
            // grupo — mismo razonamiento ya aplicado al arrastre de cuerpo en handleDragMove.ts.
            origData[mid] = {
              type: 'ramal',
              origPts: mel.pts.map((p) => [...p]),
              origLabelX: mel.labelX,
              origLabelY: mel.labelY,
              origLabelAngle: mel.labelAngle || 0,
            };
            continue;
          }
          const mba = engine.bajantes.find((b) => b.id === mid);
          if (mba) {
            origData[mid] = {
              type: 'bajante',
              origX: mba.x,
              origY: mba.y,
              origLabelX: mba.labelX,
              origLabelY: mba.labelY,
            };
            continue;
          }
          const mtx = engine.textAnnots.find((t) => t.id === mid);
          if (mtx) {
            origData[mid] = { type: 'text', origX: mtx.x, origY: mtx.y };
          }
        }
        engine.multiDrag = { startX: tp.x, startY: tp.y, origData };
      }
      return true;
    }
  }
  return false;
}
