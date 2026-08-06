import type {
  IPlanoEngineCore,
  PlanoBajante,
  PlanoElement,
  PlanoRamal,
  MultiDragOrigData,
} from './PlanoState';
import {
  isBajante,
  isRamal,
  isTextAnnotation,
  isArea,
  isDimension,
  ensureActiveNet,
} from './PlanoState';
import {
  type TextCorner,
  oppositeTextCorner,
  textLocalCorner,
  rotateLocalPoint,
} from './textAnnotationGeometry';
import {
  pointInLabelBox,
  pointToSegmentDist,
  distanceToRamal,
  findAccMedVertexHit,
} from './HitTester';
import { getSelected } from './PlanoEngineSelection';
import { selectAt } from './PlanoEngineSelection';
import { findCodoReventiladoLinks } from './PlanoEngineNetwork';
import { bajanteHitDistance, canalRectHitDistance } from './canalAssociation';

// Solo es true cuando el bajante está REALMENTE sobre uno de los extremos del ramal — o sea la
// conexión es rígida, no solo la línea guía punteada verde dibujada entre dos puntos separados.
// Un ramal bloqueado solo debe impedir el movimiento del bajante cuando ya se están tocando;
// mientras la línea punteada siga visible (aún sin pegar) el diseñador necesita poder deslizar
// libremente el bajante para conectarlo, con candado o sin él.
// Ventilación es una subred de sanitaria — los ramales san y vent pueden conectarse en bajantes
// compartidos y moverse como una sola red conectada, así que la cascada los trata como un solo
// grupo de red en todos lados.
function sameNetGroup(a: string, b: string): boolean {
  return a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
}

// BFS sobre extremos compartidos, transitivo — partiendo del ramal que se arrastra, encuentra
// todo ramal alcanzable por una cadena de extremos que se tocan (o tributario-de-un-ramal-
// alcanzable), más todo bajante que descarga desde cualquier ramal de ese conjunto alcanzable.
// Sirve para que arrastrar un ramal cargue toda su red conectada, no solo sus vecinos directos
// (de 1 salto).
export function collectConnectedGraph(
  engine: IPlanoEngineCore,
  startRamal: PlanoRamal,
): {
  ramales: { id: string; origPts: [number, number][]; origLabelX?: number; origLabelY?: number }[];
  bajantes: {
    id: string;
    origX: number;
    origY: number;
    origLblX: number;
    origLblY: number;
    atIdx: number;
  }[];
} {
  const TOL = 0.5;
  const visitedRamales = new Set<string>([startRamal.id]);
  type FrontierPt = { pt: number[]; fromId: string };
  // Sembrado con TODOS los puntos del ramal arrastrado, no solo sus dos extremos — un ramal de
  // vent casi siempre se conecta a un vértice INTERIOR de un ramal san (un codo/tee), no a los
  // extremos de su polilínea, así que sembrar solo extremos se perdía en silencio la forma de
  // conexión san↔vent más común.
  let frontier: FrontierPt[] = startRamal.pts.map((pt) => ({ pt, fromId: startRamal.id }));
  const resultRamales: {
    id: string;
    origPts: [number, number][];
    origLabelX?: number;
    origLabelY?: number;
  }[] = [];

  const startNet = startRamal.net;

  // Un ramal "toca" el frente de la cascada si CUALQUIERA de sus puntos (no solo los extremos)
  // está encima de un punto del frente. Crítico para el caso san↔vent: un ramal de vent que PASA
  // POR una unión de un ramal san (vértice interior, no extremo) se perdería con chequeos solo
  // de extremos.
  const touchesAt = (other: PlanoRamal, pt: number[]) =>
    other.pts.some((p) => Math.hypot(p[0] - pt[0], p[1] - pt[1]) < TOL);

  // Un toque de vent también puede caer sobre el CUERPO simple de una línea san recta de dos
  // puntos que no tiene ningún doblez en el lugar del toque — la conexión solo es "punto cerca
  // de línea", nunca un vértice compartido real. touchesAt (punto contra punto) nunca puede
  // atraparlo sin importar cuántos vértices se siembren en el frente, porque el tronco
  // simplemente no tiene vértice ahí con qué coincidir. Se chequea también la distancia
  // punto-contra-SEGMENTO: ¿`pt` (un extremo de `other`) cae sobre algún segmento de un ramal ya
  // visitado del mismo grupo de red, no solo sobre uno de sus puntos guardados?
  const touchesSegmentOfVisited = (pt: number[]): boolean => {
    for (const vid of visitedRamales) {
      const v = engine.ramales.find((rr) => rr.id === vid);
      if (!v?.pts || v.pts.length < 2) continue;
      for (let si = 0; si < v.pts.length - 1; si++) {
        const [ax, ay] = v.pts[si];
        const [bx, by] = v.pts[si + 1];
        const sDx = bx - ax,
          sDy = by - ay;
        const sLen = Math.hypot(sDx, sDy);
        if (sLen < 0.001) continue;
        const cross = Math.abs(sDx * (ay - pt[1]) - sDy * (ax - pt[0])) / sLen;
        if (cross >= TOL) continue;
        const t = ((pt[0] - ax) * sDx + (pt[1] - ay) * sDy) / (sLen * sLen);
        if (t >= -0.02 && t <= 1.02) return true;
      }
    }
    return false;
  };

  while (frontier.length > 0) {
    const nextFrontier: FrontierPt[] = [];
    for (const other of engine.ramales) {
      if (visitedRamales.has(other.id) || !sameNetGroup(other.net, startNet) || !other.pts?.length)
        continue;
      const touchesFrontier = frontier.some((fp) => touchesAt(other, fp.pt));
      const tapsIntoVisitedBody =
        touchesSegmentOfVisited(other.pts[0]) ||
        touchesSegmentOfVisited(other.pts[other.pts.length - 1]);
      // Dirección inversa: un punto del frente (p.ej. extremo de vent sobre segmento de cuerpo
      // de san) que no tiene vértice en el candidato — solo se chequea touchesSegmentOfVisited,
      // pero eso es extremo-del-candidato-sobre-cuerpo-VISITADO, no punto-del-frente-sobre-
      // cuerpo-del-CANDIDATO.
      const frontierOnOtherBody = frontier.some((fp) => {
        if (!other.pts || other.pts.length < 2) return false;
        for (let si = 0; si < other.pts.length - 1; si++) {
          const [ax, ay] = other.pts[si],
            [bx, by] = other.pts[si + 1];
          const sDx = bx - ax,
            sDy = by - ay;
          const sLen = Math.hypot(sDx, sDy);
          if (sLen < 0.001) continue;
          const cross = Math.abs(sDx * (ay - fp.pt[1]) - sDy * (ax - fp.pt[0])) / sLen;
          if (cross >= TOL) continue;
          const t = ((fp.pt[0] - ax) * sDx + (fp.pt[1] - ay) * sDy) / (sLen * sLen);
          if (t >= -0.02 && t <= 1.02) return true;
        }
        return false;
      });
      const isTributarioChild = !!other.padre && visitedRamales.has(other.padre);
      if (touchesFrontier || tapsIntoVisitedBody || frontierOnOtherBody || isTributarioChild) {
        visitedRamales.add(other.id);
        resultRamales.push({
          id: other.id,
          origPts: other.pts.map((pt) => [...pt] as [number, number]),
          origLabelX: other.labelX,
          origLabelY: other.labelY,
        });
        // Todos los puntos de `other` re-entran al frente (no solo sus extremos) para que un
        // ramal más lejano que se conecte a SU interior — otro codo san↔vent, un salto más
        // profundo — también se encuentre.
        for (const pt of other.pts) nextFrontier.push({ pt, fromId: other.id });
      }
    }
    // También caminar A TRAVÉS de bajantes: un ramal conectado a un bajante en la posición del
    // frente se une a la cascada también. Este es el salto san→bajante→vent que el compartir
    // extremos directo no ve.
    for (const b of engine.bajantes) {
      if (!sameNetGroup(b.net, startNet)) continue;
      const touchesFrontier = frontier.some(
        (fp) => Math.hypot(b.x - fp.pt[0], b.y - fp.pt[1]) < TOL,
      );
      if (!touchesFrontier) continue;
      for (const other of engine.ramales) {
        if (
          visitedRamales.has(other.id) ||
          !sameNetGroup(other.net, startNet) ||
          !other.pts?.length
        )
          continue;
        const oStart = other.pts[0],
          oEnd = other.pts[other.pts.length - 1];
        const nearBaj =
          Math.hypot(oStart[0] - b.x, oStart[1] - b.y) < TOL ||
          Math.hypot(oEnd[0] - b.x, oEnd[1] - b.y) < TOL ||
          other.pts.some((p) => Math.hypot(p[0] - b.x, p[1] - b.y) < TOL);
        if (!nearBaj) continue;
        const isTributarioChild = !!other.padre && visitedRamales.has(other.padre);
        if (nearBaj || isTributarioChild) {
          visitedRamales.add(other.id);
          resultRamales.push({
            id: other.id,
            origPts: other.pts.map((pt) => [...pt] as [number, number]),
            origLabelX: other.labelX,
            origLabelY: other.labelY,
          });
          for (const pt of other.pts) nextFrontier.push({ pt, fromId: other.id });
        }
      }
    }
    frontier = nextFrontier;
  }

  const resultBajantes: {
    id: string;
    origX: number;
    origY: number;
    origLblX: number;
    origLblY: number;
    atIdx: number;
  }[] = [];
  for (const b of engine.bajantes) {
    if (!sameNetGroup(b.net, startNet)) continue;
    if (!b.recibeDeIds?.some((rid) => visitedRamales.has(rid))) continue;
    // atIdx es legacy/sin uso aguas abajo — se conserva solo para satisfacer la forma existente
    // de ramalDrag.connBaj.
    resultBajantes.push({
      id: b.id,
      origX: b.x,
      origY: b.y,
      origLblX: b.labelX ?? b.x,
      origLblY: b.labelY ?? b.y,
      atIdx: 0,
    });
  }

  return { ramales: resultRamales, bajantes: resultBajantes };
}

// Toma una foto de la posición del bajante y de todo ramal que toca (recibeDeIds, descargaEnId
// y su propio conector fantasma Ldesvio) antes de que empiece un bajDrag, para que handleDragUp
// pueda validar los ángulos resultantes igual que ptDrag/ramalDrag ya hacen — y revertir +
// alertar si son inválidos.
function _captureBajDragBackup(engine: IPlanoEngineCore, b: PlanoBajante): void {
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

function _tryBajanteHit(
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
function _tryCanalResizeHit(
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
  const wPlane = engine.cmToPlanePx(canal.base || 0);
  const hPlane = engine.cmToPlanePx(canal.altura || 0);
  // Esquina opuesta, en coordenadas de PLANO (canal.x/y siempre es la esquina superior-
  // izquierda) — queda fija durante todo el gesto sin importar qué esquina se agarró.
  const anchorX = grabbed.corner === 'tl' || grabbed.corner === 'bl' ? canal.x + wPlane : canal.x;
  const anchorY = grabbed.corner === 'tl' || grabbed.corner === 'tr' ? canal.y + hPlane : canal.y;
  engine.canalResizeDrag = { id: canal.id, corner: grabbed.corner, anchorX, anchorY };
  return true;
}

function _tryRamalEndpointHit(engine: IPlanoEngineCore, x: number, y: number): boolean {
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
        const pc = engine.toCvs(r.pts[i][0], r.pts[i][1]);
        const d = Math.hypot(x - pc.x, y - pc.y);
        if (d < minPtDist) {
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

function _tryMultiSelDrag(
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
            // Los ramales "Bloquear Movimiento" nunca se mueven en un arrastre de grupo — se
            // saltan por completo, para que ningún camino de código (arrastre simple, de grupo,
            // deslizamiento de accesorio) escriba sus pts.
            if (mel.bloqueado) continue;
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

function _trySelBajanteDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  sel: PlanoElement | null,
  wasGhostSel: boolean,
): boolean {
  if (
    !isBajante(sel) ||
    !(
      sel.tipo === 'bajante' ||
      sel.tipo === 'montante' ||
      sel.tipo === 'red_publica' ||
      sel.tipo === 'contador' ||
      sel.tipo === 'calentador' ||
      sel.id?.startsWith('B')
    )
  )
    return false;

  if (ensureActiveNet(engine, sel.net)) return true;
  if (sel._labelBox && pointInLabelBox(x, y, sel._labelBox)) {
    const lPos = engine.toCvs(sel.labelX, sel.labelY);
    engine._lblDragIsParent = true;
    engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
    return true;
  }
  if (sel.labelX != null && sel.labelY != null) {
    const lPos = engine.toCvs(sel.labelX, sel.labelY);
    if (Math.hypot(x - lPos.x, y - lPos.y) < 30) {
      engine._lblDragIsParent = true;
      engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
      return true;
    }
  }
  const circ = sel._circ!;
  const d = Math.hypot(x - circ.x, y - circ.y);
  if (d < circ.r) {
    if (wasGhostSel && !sel.isFantasma) {
      engine._isGhostSel = false;
      engine._emitSelect(sel);
      engine.render();
    }
    engine.bajDrag = { id: sel.id, offX: x - circ.x, offY: y - circ.y };
    _captureBajDragBackup(engine, sel);
    return true;
  }
  return false;
}

function _trySelDimDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  sel: PlanoElement | null,
): boolean {
  if (!isDimension(sel)) return false;
  if (sel._labelPos) {
    // Tolerancia de 22px (antes 14) — la etiqueta de cota es texto corto ("3.50m") pero el área
    // legible de un objetivo de clic es la bbox circundante, no solo el alcance del glifo; 14 era
    // muy justo para darle a la etiqueta numérica pequeña, sobre todo cuando la cota es
    // perpendicular al ángulo de visión del usuario y el texto renderizado se lee pequeño.
    const lx = sel._labelPos.x;
    const ly = sel._labelPos.y;
    if (Math.hypot(x - lx, y - ly) < 22) {
      engine.dimLblDrag = { id: sel.id, offX: x - lx, offY: y - ly };
      return true;
    }
  }
  const dist = distanceToRamal(
    x,
    y,
    [
      [sel.x1, sel.y1],
      [sel.x2, sel.y2],
    ],
    (px, py) => engine.toCvs(px, py),
    2,
  );
  if (dist < 15) {
    const tp = engine.toPlane(x, y);
    engine.dimDrag = { id: sel.id, startX: tp.x, startY: tp.y };
    return true;
  }
  return false;
}

function _trySelRamalDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  sel: PlanoElement | null,
): boolean {
  // isRamal() (estructural: 'pts' en el) ya distingue un elemento tipo ramal de todo otro tipo
  // seleccionable, así que el chequeo de prefijo de id solo necesita excluir formas no-ramal —
  // NO debe excluir también tributarios (prefijo de id 'T'). Un tributario es exactamente cómo
  // esta app modela una rama que se conecta a un vértice interior de un ramal padre — p.ej. la
  // conexión común vent-en-san — así que rechazar ids con prefijo 'T' aquí dejaba el arrastre de
  // cuerpo completo inoperante para todo tributario de la app, lo que a su vez significaba que
  // su ramal padre nunca lo veía como algo a cascadear de todos modos.
  if (!isRamal(sel) || (sel.tipo !== 'ramal' && sel.tipo !== 'tributario')) return false;

  // Los íconos de accesorio a mitad de ramal se dibujan desplazados de la línea central
  // (renderRamales.ts), así que un clic sobre el ícono visible puede errar el radio ajustado
  // por vértice de abajo. Se chequea primero la huella más ancha del ícono para que clicar el
  // ícono mismo — no solo el vértice subyacente exacto — inicie el arrastre de deslizamiento
  // por el cuerpo. "Bloquear Movimiento" también lo bloquea: el usuario decidió que el candado
  // debe hacer la geometría del ramal totalmente inmutable (largo inalterable), así que el
  // vértice accMed no debe moverse en absoluto en un ramal bloqueado.
  const accIdxRaw = findAccMedVertexHit(
    sel.pts,
    sel.accMed,
    (px, py) => engine.toCvs(px, py),
    x,
    y,
    engine.realMmToCanvasPx(23) * 0.6 + 8,
  );
  const accIdx = accIdxRaw;
  if (accIdx !== null) {
    if (sel.bloqueado) return false;
    const a = sel.pts[accIdx - 1],
      b = sel.pts[accIdx + 1];
    engine._dragBackupPts = structuredClone(sel.pts);
    engine.ptDrag = {
      id: sel.id,
      ptIdx: accIdx,
      accMedSlide: { ax: a[0], ay: a[1], bx: b[0], by: b[1] },
    };
    return true;
  }

  for (let i = 0; i < sel.pts.length; i++) {
    const pc = engine.toCvs(sel.pts[i][0], sel.pts[i][1]);
    if (Math.hypot(x - pc.x, y - pc.y) < 15) {
      const isEndpoint = i === 0 || i === sel.pts.length - 1;
      // bloqueado marcado → bloquear todo arrastre directo (vértice, extremo, cuerpo).
      // La cascada (ser arrastrado por un ramal conectado) NO se bloquea — ver
      // collectConnectedGraph.
      if (sel.bloqueado) return false;
      let slideConstraint = undefined;
      // Un accesorio dibujado a mitad de cuerpo (accMed) puede moverse, pero solo deslizándose
      // por la línea recta hacia sus vecinos — no debe doblar el recorrido real del ramal.
      if (!isEndpoint && sel.accMed && sel.accMed[`accMed${i}`]) {
        const a = sel.pts[i - 1],
          b = sel.pts[i + 1];
        engine._dragBackupPts = structuredClone(sel.pts);
        engine.ptDrag = {
          id: sel.id,
          ptIdx: i,
          accMedSlide: { ax: a[0], ay: a[1], bx: b[0], by: b[1] },
        };
        return true;
      }
      if (isEndpoint) {
        // Un extremo conectado (a bajante o accesorio) NO se bloquea de arrastrar — pasa por el
        // mismo camino ptDrag restringido por ángulo-de-snap que un extremo libre (abajo), que
        // ya propaga el movimiento rígidamente a todo bajante/ramal conectado. Bloquearlo de
        // plano solo empujaba a los usuarios al camino sin restricciones de arrastre de cuerpo.
        const pt = sel.pts[i];
        for (const other of engine.ramales) {
          if (other.id === sel.id || !sameNetGroup(other.net, sel.net)) continue;
          for (let si = 0; si < other.pts.length - 1; si++) {
            const [ax, ay] = other.pts[si],
              [bx, by] = other.pts[si + 1];
            const sDx = bx - ax,
              sDy = by - ay;
            const sLen = Math.hypot(sDx, sDy);
            if (sLen < 0.001) continue;
            const cross = Math.abs(sDx * (ay - pt[1]) - sDy * (ax - pt[0])) / sLen;
            if (cross < 0.05) {
              // Misma regla de solo-unión-T que el otro cálculo de slideConstraint de arriba —
              // excluir el caso donde pt solo toca el extremo propio del OTRO segmento (p.ej.
              // dos ramales convergiendo en el mismo bajante).
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
      const codoLinks = findCodoReventiladoLinks(engine, sel, i);
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

      engine._dragBackupPts = structuredClone(sel.pts);
      engine.ptDrag = {
        id: sel.id,
        ptIdx: i,
        slideConstraint,
        linkedPts: codoLinks.length > 0 ? codoLinks : undefined,
      };
      return true;
    }
  }
  for (let i = 0; i < sel.pts.length - 1; i++) {
    const p1 = engine.toCvs(sel.pts[i][0], sel.pts[i][1]);
    const p2 = engine.toCvs(sel.pts[i + 1][0], sel.pts[i + 1][1]);
    if (pointToSegmentDist(x, y, p1.x, p1.y, p2.x, p2.y) < 6) {
      if (sel.bloqueado) return false;
      const tp = engine.toPlane(x, y);
      const origPts = sel.pts.map((pt: number[]) => [...pt] as [number, number]);
      // Los ramales/tributarios conectados transitivamente (por una cadena de extremos
      // compartidos, o como tributario de algo en esa cadena) se mueven juntos como cuerpo
      // rígido, para que la conexión no se despegue al arrastrar un ramal sin bloquear — no solo
      // sus vecinos directos (de 1 salto).
      const { ramales: connRamales, bajantes: connBaj } = collectConnectedGraph(engine, sel);
      engine.ramalDrag = {
        id: sel.id,
        startX: tp.x,
        startY: tp.y,
        origPts,
        connBaj,
        connRamales,
        origLabelX: sel.labelX,
        origLabelY: sel.labelY,
      };
      return true;
    }
  }
  return false;
}

export function handleSelectDown(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  isMultiSelectModifier: boolean = false,
): void {
  const wasGhostSel = engine._isGhostSel;
  engine._isGhostSel = false;
  engine._lblDragIsParent = false;
  // La selección de un fantasma de asociación entre pisos (selectedGhostId) nunca debe
  // sobrevivir a este clic — se limpia incondicionalmente al inicio para que CUALQUIER otro
  // acierto de abajo (la etiqueta de un bajante real, un ramal, etc.) parta de pizarra limpia.
  // Se re-fija abajo solo si ESTE clic realmente cae sobre el círculo propio de un fantasma.
  if (engine.tool === 'sel' && !isMultiSelectModifier && engine.selectedGhostId) {
    engine.selectedGhostId = null;
  }
  // PRIMERO: revisar todas las etiquetas de bajante — simple, sin juegos de prioridad
  let labelBest: { id: string; x: number; y: number; isParent: boolean } | null = null;
  let labelBestDist = Infinity;
  for (const b of engine.bajantes) {
    const lx = b.labelX ?? b.x;
    const ly = b.labelY ?? b.y + 20;
    const lPos = engine.toCvs(lx, ly);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < 30) {
      if (ensureActiveNet(engine, b.net)) return;
      const isParent = b.pisoBase === engine.nivelActual?.label;
      if (
        !labelBest ||
        (isParent && !labelBest.isParent) ||
        (isParent === labelBest.isParent && d < labelBestDist)
      ) {
        labelBest = { id: b.id, x: x - lPos.x, y: y - lPos.y, isParent };
        labelBestDist = d;
      }
    }
  }
  if (labelBest) {
    engine.selId = labelBest.id;
    engine._lblDragIsParent = labelBest.isParent;
    const b = engine.bajantes.find((bb) => bb.id === labelBest!.id);
    if (b) engine._emitSelect(b);
    engine.lblDrag = { id: labelBest.id, offX: labelBest.x, offY: labelBest.y };
    engine.render();
    return;
  }
  const sel = getSelected(engine);

  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    if (_tryCanalResizeHit(engine, x, y, sel)) return;
  }

  // Fantasma de asociación entre pisos (associateBajanteAcrossFloors.ts) — marcador de
  // referencia puro, con su propio estado de selección (selectedGhostId), nunca dirige la
  // selección ni el arrastre de ramales/bajantes. selectedGhostId ya se limpió
  // incondicionalmente arriba; solo se re-fija si ESTE clic realmente cae sobre el círculo
  // propio de un fantasma.
  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    for (const g of engine.crossFloorGhosts) {
      if (!g._hitCircle) continue;
      const gDist = Math.hypot(x - g._hitCircle.x, y - g._hitCircle.y);
      if (gDist >= g._hitCircle.r) continue;
      // Un bajante real justo al lado de este marcador de referencia debe ganar siempre si está
      // genuinamente más cerca del clic — el fantasma es secundario, nunca se le permite
      // eclipsar un elemento real y editable.
      let realIsCloser = false;
      for (const b of engine.bajantes) {
        const c = engine.toCvs(b.x, b.y);
        if (Math.hypot(x - c.x, y - c.y) < gDist) {
          realIsCloser = true;
          break;
        }
        const lx = b.labelX ?? b.x,
          ly = b.labelY ?? b.y + 20;
        const lPos = engine.toCvs(lx, ly);
        if (Math.hypot(x - lPos.x, y - lPos.y) < gDist) {
          realIsCloser = true;
          break;
        }
      }
      if (realIsCloser) continue;
      engine.selectedGhostId = g.id;
      engine.selId = null;
      engine.render();
      return;
    }
  }

  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    if (_tryBajanteHit(engine, x, y, sel)) return;
  }

  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    if (_tryRamalEndpointHit(engine, x, y)) return;
  }

  if (_tryMultiSelDrag(engine, x, y, isMultiSelectModifier)) return;

  if (engine.multiSel.length > 0 && !isMultiSelectModifier) {
    engine.multiSel = [];
  }

  if (_trySelBajanteDrag(engine, x, y, sel, wasGhostSel)) return;
  if (_trySelDimDrag(engine, x, y, sel)) return;
  if (_trySelRamalDrag(engine, x, y, sel)) return;

  if (sel && 'labelX' in sel && !sel.id?.startsWith('T')) {
    if (sel._labelBox && pointInLabelBox(x, y, sel._labelBox)) {
      const lPos = engine.toCvs(sel.labelX!, sel.labelY!);
      engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
      return;
    }
    if (
      !(
        isBajante(sel) &&
        (sel.tipo === 'bajante' ||
          sel.tipo === 'montante' ||
          sel.tipo === 'red_publica' ||
          sel.tipo === 'contador' ||
          sel.tipo === 'calentador' ||
          sel.id?.startsWith('B'))
      )
    ) {
      const lPos = engine.toCvs(sel.labelX!, sel.labelY!);
      if (Math.hypot(x - lPos.x, y - lPos.y) < 12) {
        engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
        return;
      }
    }
  }

  if (isTextAnnotation(sel) && sel._box && sel.id?.startsWith('T')) {
    const b = sel._box;
    // Cualquiera de las 4 esquinas se puede arrastrar para redimensionar. El ancla es la esquina
    // OPUESTA en el marco local (sin rotar) de la caja — calculada con las mismas fórmulas que
    // renderTextAnnotations.ts usa para dibujarla — para que la posición de canvas de esa
    // esquina quede exactamente fija mientras se redimensiona, sin importar qué esquina se agarró
    // ni si el texto está rotado.
    const corners: { x: number; y: number; corner: TextCorner }[] = [
      { x: b.x, y: b.y, corner: 'tl' },
      { x: b.x + b.w, y: b.y, corner: 'tr' },
      { x: b.x, y: b.y + b.h, corner: 'bl' },
      { x: b.x + b.w, y: b.y + b.h, corner: 'br' },
    ];
    const grabbed = corners.find((c) => Math.hypot(x - c.x, y - c.y) < 10);
    if (grabbed) {
      const fs = engine.mm2cvs(sel.fontMm || 2.5);
      const pad = 5 * engine.zoom;
      const boxWFull = (sel.boxW > 0 ? sel.boxW * engine.zoom : b.w - pad * 2) + pad * 2;
      const boxHFull = fs + pad * 2;
      const angle = ((sel.textAngle || 0) * Math.PI) / 180;
      const c = engine.toCvs(sel.x + (sel.lblOffX || 0), sel.y + (sel.lblOffY || 0));
      const anchorCorner = oppositeTextCorner(grabbed.corner);
      const local = textLocalCorner(anchorCorner, fs, pad, boxWFull, boxHFull);
      const rot = rotateLocalPoint(local.lx, local.ly, angle);
      const anchorX = c.x + rot.x;
      const anchorY = c.y + rot.y;
      engine.txtResize = {
        id: sel.id,
        corner: grabbed.corner,
        anchorX,
        anchorY,
        startDist: Math.hypot(x - anchorX, y - anchorY),
        origFontMm: sel.fontMm || 2.5,
        origBoxWpx: boxWFull,
      };
      return;
    }
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      const tp = engine.toPlane(x, y);
      engine.txtDrag = { id: sel.id, startX: tp.x, startY: tp.y, origX: sel.x, origY: sel.y };
      return;
    }
  }

  if (isArea(sel) && sel.id?.startsWith('AR') && sel._polyBox) {
    const pb = sel._polyBox;
    if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
      for (const b of engine.bajantes) {
        if (Number.isFinite(bajanteHitDistance(b, x, y))) {
          selectAt(engine, x, y, isMultiSelectModifier);
          return;
        }
      }
      const fg = engine.getBajantesFantasma();
      for (const b of fg) {
        if (b._ghost) {
          const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
          if (d < b._ghost.r) {
            selectAt(engine, x, y, isMultiSelectModifier);
            return;
          }
        }
      }
      const tp = engine.toPlane(x, y);
      engine.areaDrag = { id: sel.id, startX: tp.x, startY: tp.y };
      return;
    }
  }

  for (const t of engine.textAnnots) {
    if (t._box) {
      const b = t._box;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        engine.selId = t.id;
        const tp = engine.toPlane(x, y);
        engine.txtDrag = { id: t.id, startX: tp.x, startY: tp.y, origX: t.x, origY: t.y };
        engine._emitSelect(t);
        engine.render();
        return;
      }
    }
  }

  for (const a of engine.areas) {
    if (a._labelBox && pointInLabelBox(x, y, a._labelBox)) {
      engine.selId = a.id;
      const lPos = engine.toCvs(a.labelX, a.labelY);
      engine.lblDrag = { id: a.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(a);
      engine.render();
      return;
    }
  }

  for (const a of engine.areas) {
    if (a._polyBox) {
      const b = a._polyBox;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        let bajAtPos = false;
        for (const bb of engine.bajantes) {
          if (Number.isFinite(bajanteHitDistance(bb, x, y))) {
            bajAtPos = true;
            break;
          }
        }
        if (!bajAtPos) {
          const fg = engine.getBajantesFantasma();
          for (const bb of fg) {
            if (bb._ghost && Math.hypot(x - bb._ghost.x, y - bb._ghost.y) < bb._ghost.r) {
              bajAtPos = true;
              break;
            }
          }
        }
        if (bajAtPos) break;
        engine.selId = a.id;
        const tp = engine.toPlane(x, y);
        engine.areaDrag = { id: a.id, startX: tp.x, startY: tp.y };
        engine._emitSelect(a);
        engine.render();
        return;
      }
    }
  }

  for (const r of engine.ramales) {
    const lPos = engine.toCvs(r.labelX, r.labelY);
    const inBox = r._labelBox && pointInLabelBox(x, y, r._labelBox);
    const nearPoint = Math.hypot(x - lPos.x, y - lPos.y) < 12;
    if (inBox || nearPoint) {
      if (ensureActiveNet(engine, r.net)) return;
      engine.selId = r.id;
      engine.lblDrag = { id: r.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(r);
      engine.render();
      return;
    }
  }

  // Etiqueta de accesorio de sifón ("S D=...") — su propia caja arrastrable, separada de la
  // etiqueta principal del ramal, una por extremo porque un ramal puede llevar un sifón en
  // ambas puntas.
  for (const r of engine.ramales) {
    const slots: Array<{ slot: 'ini' | 'fin'; box: typeof r._sifonLabelBoxIni }> = [
      { slot: 'ini', box: r._sifonLabelBoxIni },
      { slot: 'fin', box: r._sifonLabelBoxFin },
    ];
    for (const { slot, box } of slots) {
      if (!box || !pointInLabelBox(x, y, box)) continue;
      if (ensureActiveNet(engine, r.net)) return;
      engine.selId = r.id;
      engine.lblDrag = { id: r.id, offX: x - box.cx, offY: y - box.cy, slot };
      engine._emitSelect(r);
      engine.render();
      return;
    }
  }

  // Acierto directo de etiqueta usando solo labelX/labelY — se salta posibles problemas de
  // _labelBox.
  let bestB: (typeof engine.bajantes)[0] | null = null;
  let bestDist = Infinity;
  let bestIsGhost = false;
  for (const b of engine.bajantes) {
    const lx = b.labelX ?? b.x;
    const ly = b.labelY ?? b.y + 20;
    const lPos = engine.toCvs(lx, ly);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < 40) {
      if (ensureActiveNet(engine, b.net)) return;
      const isGhost = b.pisoBase !== engine.nivelActual?.label;
      // Preferir no-fantasma (padre) sobre fantasma, y más cercano sobre más lejano
      if (!bestB || (!isGhost && bestIsGhost) || (isGhost === bestIsGhost && d < bestDist)) {
        bestB = b;
        bestDist = d;
        bestIsGhost = isGhost;
      }
    }
  }
  if (bestB) {
    const lPos = engine.toCvs(bestB.labelX ?? bestB.x, bestB.labelY ?? bestB.y + 20);
    engine.selId = bestB.id;
    engine._emitSelect(bestB);
    engine._lblDragIsParent = true;
    engine.lblDrag = { id: bestB.id, offX: x - lPos.x, offY: y - lPos.y };
    engine.render();
    return;
  }

  const fg = engine.getBajantesFantasma();
  let gFound: PlanoBajante | null = null,
    gMin = Infinity;

  for (const b of fg) {
    if (b._ghostLabelBox && pointInLabelBox(x, y, b._ghostLabelBox)) {
      if (ensureActiveNet(engine, b.net)) return;
      engine.selId = b.id;
      engine._isGhostSel = true;
      // El fantasma siempre tiene su propia posición de etiqueta independiente (ghostData por
      // nivel) — nunca debe redirigirse a arrastrar la etiqueta del padre en su lugar.
      const gd = b.ghostData?.[engine.nivelActual?.label ?? ''] || {};
      let lx: number, ly: number;
      if (gd.labelX != null && gd.labelY != null) {
        lx = gd.labelX;
        ly = gd.labelY;
      } else {
        const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
        const gx = b.x + (disp ? disp.dx : 0);
        const gy = b.y + (disp ? disp.dy : 0);
        let ghostAngle = 0;
        const firstRamal = b.recibeDeIds?.length
          ? engine.ramales.find((rr) => rr.id === b.recibeDeIds![0])
          : engine.ramales.find(
              (rr) => rr.pts?.length && Math.hypot(rr.pts[0][0] - gx, rr.pts[0][1] - gy) < 12,
            );
        if (firstRamal && firstRamal.pts && firstRamal.pts.length >= 2) {
          const dx = firstRamal.pts[1][0] - firstRamal.pts[0][0];
          const dy = firstRamal.pts[1][1] - firstRamal.pts[0][1];
          if (Math.hypot(dx, dy) > 0.1) {
            ghostAngle = Math.atan2(dy, dx);
          }
        } else {
          ghostAngle = ((b.labelAngle || 0) * Math.PI) / 180;
        }
        const c = engine.toCvs(gx, gy);
        const distPx = engine.mm2cvs(15);
        const cLx = c.x + distPx * Math.cos(ghostAngle);
        const cLy = c.y + distPx * Math.sin(ghostAngle);
        const pL = engine.toPlane(cLx, cLy);
        lx = pL.x;
        ly = pL.y;
      }
      const lPos = engine.toCvs(lx, ly);
      const dGhost = Math.hypot(x - lPos.x, y - lPos.y);
      // Antes de comprometerse con el fantasma: revisar si alguna etiqueta de padre no-fantasma
      // está más cerca
      let bestParent: typeof b | null = null,
        bestPDist = Infinity;
      for (const pb of engine.bajantes) {
        if (pb.pisoBase !== engine.nivelActual?.label) continue;
        const plx = pb.labelX ?? pb.x;
        const ply = pb.labelY ?? pb.y + 20;
        const pp = engine.toCvs(plx, ply);
        const pd = Math.hypot(x - pp.x, y - pp.y);
        if (pd < 40 && pd < bestPDist) {
          bestParent = pb;
          bestPDist = pd;
        }
      }
      if (bestParent && bestPDist < dGhost) {
        engine._isGhostSel = false;
        engine._lblDragIsParent = true;
        const pp = engine.toCvs(
          bestParent.labelX ?? bestParent.x,
          bestParent.labelY ?? bestParent.y + 20,
        );
        engine.lblDrag = { id: bestParent.id, offX: x - pp.x, offY: y - pp.y };
        engine._emitSelect(bestParent);
        engine.render();
        return;
      }
      engine._lblDragIsParent = false;
      engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(b);
      engine.render();
      return;
    }
  }

  for (const b of fg) {
    if (b._ghost) {
      const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
      if (d < b._ghost.r && d < gMin) {
        gMin = d;
        gFound = b as PlanoBajante;
      }
    }
  }
  if (gFound) {
    if (ensureActiveNet(engine, gFound.net)) return;
    engine.selId = gFound.id;
    engine._isGhostSel = true;
    engine._emitSelect(gFound);
    engine.render();
    engine.ghostDrag = {
      id: gFound.id,
      startX: x,
      startY: y,
      baseDx: gFound.desplazamientos?.[engine.nivelActual?.label ?? '']?.dx || 0,
      baseDy: gFound.desplazamientos?.[engine.nivelActual?.label ?? '']?.dy || 0,
    };
    return;
  }
  selectAt(engine, x, y, isMultiSelectModifier);
  if (
    engine.tool === 'sel' &&
    !engine.ptDrag &&
    !engine.ramalDrag &&
    !engine.bajDrag &&
    !engine.ghostDrag &&
    !engine.lblDrag &&
    !engine.txtDrag &&
    !engine.areaDrag &&
    !engine.dimDrag &&
    !engine.multiDrag &&
    !engine.selId
  ) {
    if (!isMultiSelectModifier) {
      engine.multiSel = [];
    }
    engine.marqueeRect = { x1: x, y1: y, x2: x, y2: y };
  }
}
