import type { IPlanoEngineCore, PlanoElement, PlanoRamal } from './PlanoState';
import { isBajante, isRamal, isDimension, ensureActiveNet } from './PlanoState';
import {
  pointInLabelBox,
  pointToSegmentDist,
  distanceToRamal,
  findAccMedVertexHit,
} from './HitTester';
import { findCodoReventiladoLinks } from './PlanoEngineNetwork';
import { _captureBajDragBackup } from './mouseDownHits';

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

export function _trySelBajanteDrag(
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

export function _trySelDimDrag(
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

export function _trySelRamalDrag(
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
      // El vértice de ARRANQUE de un ramal auto-creado por una tee (mergesFrom) comparte punto
      // con el extremo del ramal real que el usuario dibujó y con el cuerpo de la rama — un
      // clic ahí (rama, etiqueta o cuerpo del ramal real cerca de la unión) no debe agarrarse
      // como arrastre de ESTE vértice, o el "fantasma" del tramo auto-creado quedaba
      // seleccionado siempre (pesa 15px sobre toda la zona de la unión). Se cede a selectAt,
      // que resuelve por etiqueta/cuerpo; el extremo libre sigue arrastrándose normal.
      if (sel.mergesFrom && i === 0) return false;
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
