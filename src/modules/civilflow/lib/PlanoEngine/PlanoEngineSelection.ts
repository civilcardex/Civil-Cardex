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
  _midpoint,
  maxDiametroLabel,
  bumpBajanteToMaxRamal,
  followBajanteToMaxRamal,
} from './PlanoEngineDrawing';
import { diametroCambioPermitido, sanDiametroPermitido } from './drawingFlow';
import {
  pointInPoly,
  pointInLabelBox,
  distanceToRamal,
  findAccMedVertexHit,
  pointOnAnyBodySegment,
} from './HitTester';
import { updateCrossFloorGhostFieldBySource } from '../../utils/associateBajanteAcrossFloors';
import { bajanteHitDistance } from './canalAssociation';
import { checkVentDiameterLimits, syncVentBajanteDiameters } from './ventDiameters';

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

export function updateSelected(engine: IPlanoEngineCore, fields: Record<string, unknown>): void {
  const el = getSelected(engine);
  // Diámetro previo para el seguimiento del bajante (follow en ambas direcciones).
  const prevRamDiam =
    el && fields.diametro !== undefined && (el as PlanoRamal).pts
      ? (el as PlanoRamal).diametro || ''
      : '';
  if (el) {
    checkVentDiameterLimits(engine, el, fields);
    if (!guardDiametroNodo(engine, el, fields)) {
      engine.render();
      return;
    }
    Object.assign(el, fields);
    if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
      const [mx, my] = _midpoint((el as PlanoRamal).pts);
      (el as PlanoRamal).labelX = mx;
      (el as PlanoRamal).labelY = my;
    }
    // Item 2: sincronizar diámetros de bajantes de ventilación conectados al
    // mismo bajante sanitario. Si se cambia el dNominal de un bajante vent,
    // todos los demás bajantes vent que descargan en el mismo bajante sanitario
    // toman el mismo diámetro. La conexión se resuelve por descargaEnId (vent →
    // san) y por recibeDeIds del san (incluye vents que descargan en él).
    syncVentBajanteDiameters(engine, el, fields);
    // El cambio de diámetro por el panel (TramoEditor) también arrastra al bajante.
    if (fields.diametro !== undefined && (el as PlanoRamal).pts && el.id) {
      bumpConnectedBajantes(engine, el.id, prevRamDiam, String(fields.diametro ?? ''));
    }
    // Ítem 6/8: propagar el elemento mutado al snapshot de selección del panel derecho/ menú
    // contextual (única fuente de verdad). _emitSelect ya emite una copia superficial, así que
    // React recibe una referencia nueva y re-renderiza sin que el usuario deba re-seleccionar.
    engine._emitSelect(el);
  } else {
    return;
  }
  engine.render();
  engine._markDirty();
}

// Validación de diámetros en nodos de presión (salida ≤ entrada) a nivel motor: intercepta
// CUALQUIER escritura de `diametro` sobre un ramal af/ac/gas (menú contextual, TramoEditor,
// editores) y bloquea con alerta la configuración inválida — sin reasignación automática.
// Sanitaria usa la regla inversa en AMBAS direcciones (receptor ≥ alimentador y alimentador ≤
// receptor) vía sanDiametroPermitido.
function guardDiametroNodo(
  engine: IPlanoEngineCore,
  el: { pts?: number[][]; net?: string; id?: string },
  fields: Record<string, unknown>,
): boolean {
  if (fields.diametro === undefined) return true;
  const ram = el as PlanoRamal;
  if (!ram.pts || (ram.net !== 'af' && ram.net !== 'ac' && ram.net !== 'gas' && ram.net !== 'san'))
    return true;
  const res =
    ram.net === 'san'
      ? sanDiametroPermitido(engine.ramales, ram.id, String(fields.diametro ?? ''))
      : diametroCambioPermitido(engine.ramales, ram.id, String(fields.diametro ?? ''));
  if (!res.ok) {
    engine.triggerAlert('Diámetro no permitido', res.msg || '');
    return false;
  }
  return true;
}

/** Piso del bajante = máximo de sus ramales asociados: sigue al cambio en ambas direcciones
 *  (si seguía al máximo anterior adopta el nuevo; un oversize explícito mayor se conserva).
 *  Se aplica en updateElementById Y updateSelected: cambiar el diámetro por cualquier editor
 *  (menú o panel) arrastra al bajante conectado. @param engine Motor con ramales y bajantes vivos. */
export function bumpConnectedBajantes(
  engine: IPlanoEngineCore,
  ramId: string,
  oldRamD: string,
  newRamD: string,
): void {
  const changedRam = engine.ramales.find((r) => r.id === ramId);
  if (!changedRam?.pts) return;
  const lvlLabel = engine.nivelActual?.label ?? '';
  for (const b of engine.bajantes) {
    if (b.tipo !== 'bajante' && b.tipo !== 'montante') continue;
    const assocRamIds = b.recibeDeIds || [];
    // ¿conectado a este ramal? (explícito por recibeDeIds o geométrico)
    let isConnected = assocRamIds.includes(ramId);
    if (!isConnected) {
      const disp = b.desplazamientos?.[lvlLabel] || {};
      const bx = b.x + (disp.dx || 0);
      const by = b.y + (disp.dy || 0);
      const head = changedRam.pts[changedRam.pts.length - 1];
      const tail = changedRam.pts[0];
      if (
        Math.hypot(head[0] - bx, head[1] - by) < 2.0 ||
        Math.hypot(tail[0] - bx, tail[1] - by) < 2.0
      )
        isConnected = true;
    }
    if (!isConnected) continue;
    const followed = followBajanteToMaxRamal(
      engine.ramales,
      assocRamIds,
      b.dNominal || '',
      ramId,
      oldRamD,
      newRamD,
    );
    if (followed) b.dNominal = followed;
  }
}

export function updateElementById(
  engine: IPlanoEngineCore,
  id: string,
  fields: Record<string, unknown>,
): void {
  const el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | undefined =
    engine.ramales.find((r) => r.id === id) ||
    engine.bajantes.find((b) => b.id === id) ||
    engine.textAnnots.find((t) => t.id === id) ||
    engine.areas.find((a) => a.id === id);
  // Diámetro previo para el seguimiento del bajante (follow en ambas direcciones).
  const prevRamDiam =
    el && fields.diametro !== undefined && (el as PlanoRamal).pts
      ? (el as PlanoRamal).diametro || ''
      : '';
  if (el) {
    checkVentDiameterLimits(engine, el, fields);
    if (!guardDiametroNodo(engine, el, fields)) {
      engine.render();
      return;
    }
    Object.assign(el, fields);
    if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
      const [mx, my] = _midpoint((el as PlanoRamal).pts);
      (el as PlanoRamal).labelX = mx;
      (el as PlanoRamal).labelY = my;
    }
    // Item 2: sincronizar diámetros de bajantes de ventilación conectados al
    // mismo bajante sanitario. updateElementById es el camino real del cambio
    // de dNominal del bajante (bajanteMenu.tsx usa este método).
    syncVentBajanteDiameters(engine, el, fields);
    // Item 2: el bajante/montante toma por defecto el diámetro del trazo al que se
    // conecta; si son varios, el MAYOR de todos. Cuando un ramal cambia de diámetro,
    // recalcular el floor del bajante = max de todos los ramales asociados — nunca
    // queda por debajo. Si el bajante no tenía diámetro, se le asigna este.
    if (fields.diametro !== undefined && (el as PlanoRamal).pts) {
      bumpConnectedBajantes(engine, id, prevRamDiam, String(fields.diametro ?? ''));
    }
    // Al ASOCIAR ramales a un bajante/montante (recibeDeIds), su diámetro sube al mayor de
    // los asociados — nunca queda por debajo (misma regla que al crear el bajante y que el
    // piso por cambio de diámetro de ramal de arriba). Solo sube, nunca baja.
    if (fields.recibeDeIds !== undefined && !(el as PlanoRamal).pts) {
      const b = el as PlanoBajante;
      if (b.tipo === 'bajante' || b.tipo === 'montante') {
        const bumped = bumpBajanteToMaxRamal(engine.ramales, b.recibeDeIds, b.dNominal || '');
        if (bumped) b.dNominal = bumped;
      }
    }
    // ponytail: propagate diameter change to downstream auto-split ramals (mergesFrom chains).
    // Covers BOTH manual dropdown AND aparato assignment — aparato write goes through updateElementById.
    if (fields.diametro !== undefined && (el as PlanoRamal).pts) {
      const newD = String(fields.diametro ?? '');
      const visited = new Set<string>([id]);
      const stack = [id];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        for (const child of engine.ramales) {
          if (!child.mergesFrom || !child.mergesFrom.includes(cur)) continue;
          if (visited.has(child.id)) continue;
          visited.add(child.id);
          const [p0, p1] = child.mergesFrom;
          const d0 = p0 === cur ? newD : engine.ramales.find((r) => r.id === p0)?.diametro || '';
          const d1 = p1 === cur ? newD : engine.ramales.find((r) => r.id === p1)?.diametro || '';
          const maxD = maxDiametroLabel(d0, d1);
          if (maxD && maxD !== child.diametro) {
            child.diametro = maxD;
          }
          stack.push(child.id);
        }
      }
    }
  }
  // Refleja los cambios de propiedad del bajante (dNominal, dirección) a todo fantasma entre
  // pisos que apunte a este bajante, para que la etiqueta de línea punteada del piso destino se
  // mantenga sincronizada sin requerir una acción separada del usuario.
  if (el && (el as PlanoBajante).tipo) {
    if (fields.dNominal !== undefined) {
      updateCrossFloorGhostFieldBySource(
        engine._loadedPlanId ?? '',
        id,
        'dNominal',
        String(fields.dNominal ?? ''),
      );
    }
    if (fields.direccion !== undefined) {
      const dirVal = String(fields.direccion ?? '');
      if (dirVal === 'sube' || dirVal === 'baja') {
        updateCrossFloorGhostFieldBySource(
          engine._loadedPlanId ?? '',
          id,
          'parentDireccion',
          dirVal,
        );
      }
    }
  }
  // Ítem 6/8: propagar el elemento mutado al snapshot de selección (panel derecho / menú
  // contextual) — única fuente de verdad, sin requerir re-selección.
  if (el) engine._emitSelect(el);
  engine.render();
  engine._markDirty();
}

export function rotateLabelSnap(engine: IPlanoEngineCore): void {
  const el = getSelected(engine);
  if (!el) return;
  const ANGLES = [0, 45, 90, -90, -45];
  if (el.id?.startsWith('T') && (el as PlanoTextAnnotation).text !== undefined) {
    const cur = (el as PlanoTextAnnotation).textAngle || 0;
    const idx = ANGLES.reduce(
      (b, a, i) => (Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b),
      0,
    );
    (el as PlanoTextAnnotation).textAngle = ANGLES[(idx + 1) % ANGLES.length];
  } else {
    const elLabeled = el as PlanoRamal | PlanoBajante | PlanoArea;
    const cur = elLabeled.labelAngle || 0;
    const idx = ANGLES.reduce(
      (b, a, i) => (Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b),
      0,
    );
    elLabeled.labelAngle = ANGLES[(idx + 1) % ANGLES.length];
  }
  engine._emitSelect(el);
  engine.render();
}

export function resetLabel(engine: IPlanoEngineCore): void {
  const el = getSelected(engine);
  if (!el) return;
  if ((el as PlanoRamal).pts) {
    const [mx, my] = _midpoint((el as PlanoRamal).pts);
    const elRamal = el as PlanoRamal;
    elRamal.labelX = mx;
    elRamal.labelY = my;
    elRamal.labelAngle = 0;
  } else {
    // Los bajantes/áreas tienen su propio labelX/Y; los textos se posicionan con x/y — este cast
    // refleja esa forma realmente mezclada, no incertidumbre de tipos.
    const elPositionable = el as {
      labelX?: number;
      labelY?: number;
      labelAngle?: number;
      x?: number;
      y?: number;
    };
    elPositionable.labelX = elPositionable.x;
    elPositionable.labelY = elPositionable.y;
    elPositionable.labelAngle = 0;
  }
  engine.render();
}
