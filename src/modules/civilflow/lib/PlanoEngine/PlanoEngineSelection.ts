import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoTextAnnotation,
  PlanoDimension,
  PlanoGuideLine,
  PlanoElement,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { NETS, checkActiveNet } from './PlanoState';
import {
  pointInPoly,
  pointInLabelBox,
  distanceToRamal,
  findAccMedVertexHit,
  pointOnAnyBodySegment,
} from './HitTester';
import { bajanteHitDistance } from './canalAssociation';

export {
  updateSelected,
  guardDiametroNodo,
  bumpConnectedBajantes,
  pushBajanteDiameterToRamales,
  updateElementById,
  rotateLabelSnap,
  resetLabel,
} from './PlanoEngineSelectionEdit';

/**
 * Resuelve selección por punto (canvas coords). Prioridad: anotaciones texto > etiqueta bajante >
 * cuerpo ramal > bajante > canal (detrás de ramales) > área. Actualiza `selId`/`multiSel` y emite evento.
 * @param engine - Núcleo del motor con colecciones y estado de selección.
 * @param cx - X en canvas.
 * @param cy - Y en canvas.
 * @param isMultiSelectModifier - Si true, alterna en `multiSel` en vez de reemplazar.
 */
export function selectAt(
  engine: IPlanoEngineCore,
  cx: number,
  cy: number,
  isMultiSelectModifier: boolean = false,
): void {
  engine._isGhostSel = false;

  const applySelection = (
    id: string | null,
    obj: PlanoElement | null,
    isGhost: boolean = false,
  ) => {
    engine._isGhostSel = isGhost;
    if (isMultiSelectModifier) {
      if (engine.selId && !engine.multiSel.includes(engine.selId)) {
        engine.multiSel.push(engine.selId);
      }
      engine.selId = null;
      if (id) {
        if (engine.multiSel.includes(id)) {
          engine.multiSel = engine.multiSel.filter((mid) => mid !== id);
        } else {
          engine.multiSel.push(id);
        }
      }
      engine._emitSelect(null);
    } else {
      engine.selId = id;
      engine.multiSel = [];
      engine._emitSelect(obj);
    }
    engine.render();
  };

  let foundTxt: PlanoTextAnnotation | null = null;
  for (const t of engine.textAnnots) {
    if (t._box) {
      const b = t._box;
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h)
        foundTxt = t as PlanoTextAnnotation;
    }
  }
  if (foundTxt) return applySelection(foundTxt.id, foundTxt);

  let foundBaj: PlanoBajante | null = null,
    minBD = 50;
  let foundBajIsGhost = false;
  for (const b of engine.bajantes) {
    // Ítem 3: bajante asociado a un canal — nunca seleccionable por sí mismo; el clic cae al
    // canal (paso propio más abajo).
    if (b._labelBox && pointInLabelBox(cx, cy, b._labelBox)) {
      const d = Math.hypot(cx - b._labelBox.cx, cy - b._labelBox.cy);
      if (d < minBD) {
        minBD = d;
        foundBaj = b as PlanoBajante;
        foundBajIsGhost = false;
      }
    }
    // El RECTÁNGULO del canal no se chequea aquí: un canal es una canaleta de fondo y su zona de
    // clic (rectángulo ×1.1, bajanteHitDistance devuelve 1 dentro de él) cubre el área donde
    // pueden pasar ramales de otras redes — si el canal ganara aquí, un clic sobre un ramal
    // dentro de la zona del canal siempre seleccionaba el canal y cambiaba la red activa a
    // aguas lluvias. Los canales se revisan DESPUÉS de los ramales (paso propio más abajo).
    if (b.tipo !== 'canal') {
      const d = bajanteHitDistance(b as PlanoBajante, cx, cy);
      if (d < minBD) {
        minBD = d;
        foundBaj = b as PlanoBajante;
        foundBajIsGhost = false;
      }
    }
  }
  const fg = engine.getBajantesFantasma();
  for (const b of fg) {
    if (b._ghostLabelBox && pointInLabelBox(cx, cy, b._ghostLabelBox)) {
      const d = Math.hypot(cx - b._ghostLabelBox.cx, cy - b._ghostLabelBox.cy);
      if (d < minBD) {
        minBD = d;
        foundBaj = b as PlanoBajante;
        foundBajIsGhost = true;
      }
    }
    if (b._ghost) {
      const d = Math.hypot(cx - b._ghost.x, cy - b._ghost.y);
      if (d < b._ghost.r && d < minBD) {
        minBD = d;
        foundBaj = b as PlanoBajante;
        foundBajIsGhost = true;
      }
    }
  }
  const checkAndSwitchNet = (obj: { net?: string }): boolean => {
    if (!obj || !obj.net) return true;
    if (obj.net !== engine.activeNet) {
      if (!checkActiveNet(engine, obj.net)) {
        const netObj = NETS.find((n) => n.id === obj.net);
        const netName = netObj ? netObj.name : obj.net;
        engine.triggerAlert(
          'Red inactiva',
          `Debe activar la red de ${netName} en la información general`,
        );
        return false;
      } else {
        engine.setActiveNet(obj.net);
      }
    }
    return true;
  };

  if (foundBaj) {
    if (!checkAndSwitchNet(foundBaj)) return;
    return applySelection(foundBaj.id, foundBaj, foundBajIsGhost);
  }

  let foundDim: PlanoDimension | null = null,
    minDimD = 20;
  for (const d of engine.dims) {
    // Un clic SOBRE la etiqueta de la cota también debe seleccionarla — si no, el usuario no
    // podría preseleccionar una cota para arrastrar su etiqueta (la única forma de que
    // _trySelDimDrag active su radio de etiqueta es si sel === la cota misma, lo que solo pasa
    // cuando selectAt la elige).
    const distLine = distanceToRamal(
      cx,
      cy,
      [
        [d.x1, d.y1],
        [d.x2, d.y2],
      ],
      (x, y) => engine.toCvs(x, y),
      2,
    );
    let hitD = distLine;
    if (d._labelPos) {
      // d._labelPos ya está en coordenadas de canvas (ver renderDimensions.ts:59, donde lx/ly
      // salieron de toCvs). Llamar a toCvs una segunda vez duplicaría la transformación — usar
      // directamente.
      const labelDist = Math.hypot(cx - d._labelPos.x, cy - d._labelPos.y);
      // El acierto sobre la etiqueta pesa más que uno sobre la línea: clicar la burbuja numérica
      // es intencional y la etiqueta ocupa espacio real en pantalla; la línea mide solo 2px y
      // rara vez es lo que el usuario quiso.
      hitD = labelDist < 22 ? -1 : distLine;
    }
    if (hitD < minDimD) {
      minDimD = hitD;
      foundDim = d as PlanoDimension;
    }
  }
  if (foundDim) {
    return applySelection(foundDim.id, foundDim);
  }

  let foundGuide: PlanoGuideLine | null = null,
    minGuideD = 15;
  for (const g of engine.guideLines) {
    const d = distanceToRamal(cx, cy, g.pts, (x, y) => engine.toCvs(x, y), engine.mm2cvs(2));
    if (d < minGuideD) {
      minGuideD = d;
      foundGuide = g;
    }
  }
  if (foundGuide) {
    return applySelection(foundGuide.id, foundGuide);
  }

  let found: PlanoRamal | null = null,
    minD = 20;
  // Dueño del cuerpo bajo el clic: si el clic está sobre el CUERPO (interior del trazo) de un
  // ramal, solo ese ramal puede recibir el bonus de extremo (-5) — un clic sobre la rama de una
  // tee debe seleccionar la RAMA, no el ramal cuyo extremo quedó a <15px por casualidad (que
  // además le cambiaría la red activa al usuario).
  const bodyOwnerId = pointOnAnyBodySegment(
    engine.ramales.filter((r) => !engine._hiddenNets.has(r.net)),
    cx,
    cy,
    (px, py) => engine.toCvs(px, py),
    engine.mm2cvs(3),
  );
  const cvsLen = (r: PlanoRamal): number => {
    let s = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = engine.toCvs(r.pts[i][0], r.pts[i][1]);
      const b = engine.toCvs(r.pts[i + 1][0], r.pts[i + 1][1]);
      s += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return s;
  };
  // Un clic sobre una ETIQUETA es la intención más explícita de seleccionar ESE ramal — pesa
  // más que cualquier ramal que cruce por debajo o que un extremo ajeno cercano
  // (bug: clicar la etiqueta de una rama tee AF cerca de la unión seleccionaba el ll que
  // cruzaba la unión y cambiaba la red activa a aguas lluvias).
  for (const r of engine.ramales) {
    if (r._labelBox && pointInLabelBox(cx, cy, r._labelBox)) {
      if (-50 < minD) {
        minD = -50;
        found = r as PlanoRamal;
        break;
      }
    }
  }
  for (const r of engine.ramales) {
    const accMedHitIdx = findAccMedVertexHit(
      r.pts,
      r.accMed,
      (x, y) => engine.toCvs(x, y),
      cx,
      cy,
      engine.realMmToCanvasPx(23) * 0.6 + 8,
    );
    if (accMedHitIdx !== null) {
      if (0.01 < minD) {
        minD = 0.01;
        found = r as PlanoRamal;
      }
    }
    // Clic sobre el CUERPO (interior del trazo) de un ramal: el dueño del cuerpo debe ganar
    // sobre ramales que cruzan el mismo punto o extremos ajenos cercanos — si el empate se
    // resolviera por orden de array, un ll que cruza la unión ganaría y cambiaría la red activa.
    let d = distanceToRamal(cx, cy, r.pts, (x, y) => engine.toCvs(x, y), engine.mm2cvs(3));
    const isBodyOwner = r.pts && r.pts.length > 0 && r.id === bodyOwnerId;
    if (isBodyOwner) {
      d -= 6;
    }
    // Distancia del clic a la etiqueta del ramal — desempate final cuando dos ramales colineales
    // solapados dan la MISMA distancia de cuerpo (p.ej. el tramo resultante de un split y el
    // ramal que lo partió quedan colineales): el que tenga su etiqueta más cerca del clic gana,
    // permitiendo seleccionar/mover la etiqueta del tramo que se quiere.
    const labelDist = (rr: PlanoRamal): number => {
      if (rr.labelX == null || rr.labelY == null || !rr.pts || rr.pts.length === 0) return Infinity;
      return Math.hypot(cx - (rr.labelX as number), cy - (rr.labelY as number));
    };
    // Desempate: 1) el dueño del cuerpo bajo el clic SIEMPRE gana (aunque otro ramal colineal
    // contiguo dé la misma distancia — p.ej. las dos mitades de un ramal dividido en el punto
    // compartido); 2) a igualdad sin dueño, gana el ramal MÁS CORTO (rama de tee sobre ramal
    // largo es el target típico); 3) si ambos son dueños o ambos no, gana el de etiqueta más
    // cercana.
    if (d < minD) {
      minD = d;
      found = r as PlanoRamal;
    } else if (d === minD && found) {
      const fIsOwner = found.id === bodyOwnerId;
      if (isBodyOwner && !fIsOwner) {
        found = r as PlanoRamal;
      } else if (isBodyOwner === fIsOwner) {
        const lenCmp = cvsLen(r) - cvsLen(found);
        if (Math.abs(lenCmp) > 1e-6) {
          if (lenCmp < 0) found = r as PlanoRamal;
        } else if (labelDist(r) < labelDist(found)) {
          found = r as PlanoRamal;
        }
      }
    }
  }

  // Canales (aguas lluvias): se revisan DESPUÉS de los ramales y solo si no ganó ningún otro
  // elemento — su zona de clic es el propio rectángulo del canal (una canaleta, fondo del
  // dibujo) y un clic sobre un ramal que cruza esa zona debe seleccionar el RAMAL, no el canal
  // (que además cambiaría la red activa a ll).
  if (!foundBaj && !found) {
    let foundCanal: PlanoBajante | null = null;
    for (const b of engine.bajantes) {
      if (b.tipo !== 'canal') continue;
      const d = bajanteHitDistance(b as PlanoBajante, cx, cy);
      if (d < minBD) {
        minBD = d;
        foundCanal = b as PlanoBajante;
      }
    }
    if (foundCanal) {
      if (!checkAndSwitchNet(foundCanal)) return;
      return applySelection(foundCanal.id, foundCanal);
    }
  }

  let foundAreaLabel: PlanoArea | null = null;
  for (const a of engine.areas) {
    if (a._labelBox && pointInLabelBox(cx, cy, a._labelBox)) {
      foundAreaLabel = a as PlanoArea;
    }
  }
  if (foundAreaLabel) {
    if (!checkAndSwitchNet(foundAreaLabel)) return;
    return applySelection(foundAreaLabel.id, foundAreaLabel);
  }

  let foundArea: PlanoArea | null = null;
  for (const a of engine.areas) {
    if (
      pointInPoly(
        cx,
        cy,
        a.pts.map((pt) => engine.toCvs(pt[0], pt[1])),
      )
    ) {
      foundArea = a as PlanoArea;
    }
  }
  if (foundArea) {
    // Ramal cerca del clic manda sobre el área (orig. usuario): el chequeo de cuerpo de
    // ramal de arriba usa una tolerancia angosta (mm2cvs(3)) y el área gana por TODO su
    // polígono — un clic "cerca del trazo" dentro del área seleccionaba el área y el ramal
    // que la cruza quedaba inseleccionable. El ramal MÁS CERCANO a ≤15px se lleva el clic.
    let ramalCerca: PlanoRamal | null = null;
    let bestD = 15;
    for (const r of engine.ramales) {
      if (!r.pts || r.pts.length < 2 || engine._hiddenNets.has(r.net)) continue;
      const d = distanceToRamal(cx, cy, r.pts, (x, y) => engine.toCvs(x, y), bestD);
      if (d < bestD) {
        bestD = d;
        ramalCerca = r as PlanoRamal;
      }
    }
    if (ramalCerca) {
      if (!checkAndSwitchNet(ramalCerca)) return;
      return applySelection(ramalCerca.id, ramalCerca);
    }
    if (!checkAndSwitchNet(foundArea)) return;
    return applySelection(foundArea.id, foundArea);
  }

  if (found) {
    if (!checkAndSwitchNet(found)) return;
    // Recordar DÓNDE se hizo clic sobre el ramal: Suprimir recorta el extremo cercano a este
    // punto (no al cursor al momento de pulsar la tecla, que suele haber quedado en otro lado).
    engine._selPointCvs = { x: cx, y: cy };
  }

  applySelection(found ? found.id : null, found);
  if (engine._debugSel) {
    engine._debugSel.notes.push(
      `selectAt found=${found ? found.id : 'null'} minD=${minD.toFixed(1)} bodyOwner=${bodyOwnerId ? bodyOwnerId : 'null'}`,
    );
    engine._debugSel.final = found ? found.id : 'null';
  }
}

export function selectById(engine: IPlanoEngineCore, id: string): void {
  engine._isGhostSel = false;
  const found =
    engine.ramales.find((r) => r.id === id) ||
    engine.bajantes.find((b) => b.id === id) ||
    engine.textAnnots.find((t) => t.id === id) ||
    engine.areas.find((a) => a.id === id) ||
    engine.dims.find((d) => d.id === id) ||
    engine.guideLines.find((g) => g.id === id);
  if (found) {
    engine.selId = found.id;
    engine._emitSelect(found);
    engine.render();
  }
}

export function getSelected(
  engine: IPlanoEngineCore,
):
  | PlanoRamal
  | PlanoBajante
  | PlanoTextAnnotation
  | PlanoArea
  | PlanoDimension
  | PlanoGuideLine
  | null {
  if (!engine.selId) return null;
  // Las cotas faltaban aquí aunque selectAt()/selectById() las seleccionan bien — sel volvía
  // null en cada clic después del primero, así que el chequeo isDimension(sel) de _trySelDimDrag
  // nunca pasaba y ni la línea ni su etiqueta podían arrastrarse.
  return (engine.ramales.find((r) => r.id === engine.selId) ||
    engine.bajantes.find((b) => b.id === engine.selId) ||
    engine.textAnnots.find((t) => t.id === engine.selId) ||
    engine.areas.find((a) => a.id === engine.selId) ||
    engine.dims.find((d) => d.id === engine.selId) ||
    engine.guideLines.find((g) => g.id === engine.selId) ||
    null) as
    | PlanoRamal
    | PlanoBajante
    | PlanoTextAnnotation
    | PlanoArea
    | PlanoDimension
    | PlanoGuideLine
    | null;
}
