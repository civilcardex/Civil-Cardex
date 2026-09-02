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
import { _midpoint, maxDiametroLabel } from './PlanoEngineDrawing';
import { diametroCambioPermitido } from './drawingFlow';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import {
  pointInPoly,
  pointInLabelBox,
  distanceToRamal,
  findAccMedVertexHit,
  pointOnAnyBodySegment,
  pointToSegmentDist,
} from './HitTester';
import { updateCrossFloorGhostFieldBySource } from '../../utils/associateBajanteAcrossFloors';
import { bajanteHitDistance } from './canalAssociation';

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

function checkVentDiameterLimits(
  engine: IPlanoEngineCore,
  el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | PlanoDimension | PlanoGuideLine,
  fields: Record<string, unknown>,
): boolean {
  if (!el || !fields) return true;
  if (!('tipo' in el)) return true; // text annotations / areas never trigger vent-diameter checks

  const getConnectedVentRamales = (b: PlanoBajante) => {
    const ventRamales = engine.ramales.filter((r) => r.net === 'vent');
    const connected: PlanoRamal[] = [];
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    const bx = b.x + (disp ? disp.dx : 0);
    const by = b.y + (disp ? disp.dy : 0);
    for (const vr of ventRamales) {
      const isExplicit =
        b.recibeDeIds &&
        (b.recibeDeIds.includes(vr.id) || (vr.label && b.recibeDeIds.includes(vr.label)));
      let isConnected = isExplicit;
      if (!isConnected && vr.pts && vr.pts.length >= 2) {
        const d1 = Math.hypot(vr.pts[0][0] - bx, vr.pts[0][1] - by);
        const d2 = Math.hypot(vr.pts[vr.pts.length - 1][0] - bx, vr.pts[vr.pts.length - 1][1] - by);
        if (d1 < 2.0 || d2 < 2.0) isConnected = true;
      }
      if (isConnected) connected.push(vr);
    }
    return connected;
  };

  const getConnectedVentBajantes = (r: PlanoRamal) => {
    const ventBajantes = engine.bajantes.filter((b) => b.net === 'vent');
    const connected: PlanoBajante[] = [];
    for (const vb of ventBajantes) {
      const disp = vb.desplazamientos?.[engine.nivelActual?.label ?? ''];
      const bx = vb.x + (disp ? disp.dx : 0);
      const by = vb.y + (disp ? disp.dy : 0);
      const isExplicit =
        vb.recibeDeIds &&
        (vb.recibeDeIds.includes(r.id) || (r.label && vb.recibeDeIds.includes(r.label)));
      let isConnected = isExplicit;
      if (!isConnected && r.pts && r.pts.length >= 2) {
        const d1 = Math.hypot(r.pts[0][0] - bx, r.pts[0][1] - by);
        const d2 = Math.hypot(r.pts[r.pts.length - 1][0] - bx, r.pts[r.pts.length - 1][1] - by);
        if (d1 < 2.0 || d2 < 2.0) isConnected = true;
      }
      if (isConnected) connected.push(vb);
    }
    return connected;
  };

  const isVent = el.net === 'vent' || ('_net' in el && el._net === 'vent');
  if (isVent) {
    if (el.tipo === 'bajante' || el.tipo === 'montante') {
      let newDNom = '';
      if (fields.dNominal !== undefined) {
        newDNom = String(fields.dNominal || '');
      } else if (fields.ghostData !== undefined) {
        const lvl = engine.nivelActual?.label ?? '';
        const gd =
          (fields.ghostData as Record<string, { dNominal?: string; d_nominal?: string }>)[lvl] ||
          {};
        newDNom = String(gd.dNominal || gd.d_nominal || '');
      }
      if (newDNom) {
        const bDVal = diamPulgFromLabel(newDNom);
        if (bDVal > 0) {
          const connected = getConnectedVentRamales(el as PlanoBajante);
          for (const vr of connected) {
            const rDVal = vr.diamPulg || diamPulgFromLabel(vr.diametro);
            if (rDVal > 0 && bDVal < rDVal) {
              engine.triggerAlert(
                'Diámetro no válido',
                `El diámetro del bajante de ventilación (${newDNom}) no puede ser inferior al diámetro del ramal de ventilación al que está conectado (${vr.diametro || vr.id}).`,
              );
              if (fields.dNominal !== undefined) {
                fields.dNominal = '';
              } else if (fields.ghostData !== undefined) {
                const lvl = engine.nivelActual?.label ?? '';
                const gd =
                  (fields.ghostData as Record<string, { dNominal?: string; d_nominal?: string }>)[
                    lvl
                  ] || {};
                gd.dNominal = '';
                gd.d_nominal = '';
              }
              return true;
            }
          }
        }
      }
    } else if (el.id?.startsWith('R') && fields.diametro !== undefined) {
      const newDiam = String(fields.diametro || '');
      const rDVal = diamPulgFromLabel(newDiam);
      if (rDVal > 0) {
        const connected = getConnectedVentBajantes(el as PlanoRamal);
        for (const vb of connected) {
          const lvl = engine.nivelActual?.label ?? '';
          const gd = vb.ghostData?.[lvl];
          const bNominal = gd?.dNominal || vb.dNominal || '';
          const bDVal = vb.diamPulg || diamPulgFromLabel(bNominal);
          if (bDVal > 0 && bDVal < rDVal) {
            engine.triggerAlert(
              'Diámetro no válido',
              `El diámetro del bajante de ventilación (${bNominal || vb.id}) no puede ser inferior al diámetro del ramal de ventilación al que está conectado (${newDiam}).`,
            );
            fields.diametro = '';
            return true;
          }
        }
      }
    }
  }
  return true;
}

// Item 2: sincroniza el diámetro de todos los bajantes de ventilación conectados
// al mismo bajante sanitario. La conexión vent→san se identifica por:
//  - descargaEnId del vent apunta al san (formato `planId|sanBajanteIdOrCode`), o
//  - recibeDeIds del san incluye el id/code del vent.
// Cuando un vent bajante cambia de dNominal, los demás vents que comparten el
// mismo san bajante destino toman ese mismo diámetro. Esto garantiza estado
// consistente: todos los vents de un mismo san tienen el mismo diámetro.
function syncVentBajanteDiameters(
  engine: IPlanoEngineCore,
  el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | PlanoDimension | PlanoGuideLine,
  fields: Record<string, unknown>,
): void {
  if (!el || !('tipo' in el)) return;
  const b = el as PlanoBajante;
  if (b.net !== 'vent' || (b.tipo !== 'bajante' && b.tipo !== 'montante')) return;
  let newNom: string | undefined;
  if (fields.dNominal !== undefined) {
    newNom = String(fields.dNominal || '');
  } else if (fields.ghostData !== undefined) {
    const lvl = engine.nivelActual?.label ?? '';
    const gd = (fields.ghostData as Record<string, { dNominal?: string }>)[lvl];
    newNom = gd?.dNominal;
  }
  if (!newNom) return;
  // Resolver el san bajante destino de este vent: por descargaEnId, o buscando
  // un san bajante cuyo recibeDeIds lo incluya.
  const sanBajanteIdOrCode = resolveVentSanTarget(engine, b);
  if (!sanBajanteIdOrCode) return;
  // Encontrar todos los demás vent bajantes que descargan en el mismo san.
  for (const other of engine.bajantes) {
    if (other === b) continue;
    if (other.net !== 'vent') continue;
    const otherTarget = resolveVentSanTarget(engine, other);
    if (otherTarget === sanBajanteIdOrCode) {
      other.dNominal = newNom;
      other.diamPulg = diamPulgFromLabel(newNom);
      // Sincronizar también ghostData del nivel actual si existe.
      const lvl = engine.nivelActual?.label ?? '';
      if (other.ghostData?.[lvl]) {
        other.ghostData[lvl].dNominal = newNom;
      }
    }
  }
}

// Resuelve la clave (id) del bajante sanitario al que sirve un bajante de
// ventilación. La conexión puede ser:
//  1. directa: descargaEnId del vent apunta al san bajante;
//  2. por cadena (el caso real del plano): vent bajante → vent ramal(es) que
//     nacen de él (recibeDeIds o geometría) → san ramal que el vent ramal toca
//     (codo reventilado / Y) → san bajante en el que ese san ramal descarga
//     (recibeDeIds del bajante o ini/fin del ramal);
//  3. coincidencia geométrica directa con un san bajante.
// @returns id del san bajante o null.
function resolveVentSanTarget(engine: IPlanoEngineCore, ventB: PlanoBajante): string | null {
  const sanBajs = engine.bajantes.filter((b) => b.net === 'san' || b.net === 'll');
  const findSanBaj = (ref: string | null | undefined): PlanoBajante | null => {
    if (!ref) return null;
    const parts = String(ref).split('|');
    const tgt = parts[parts.length - 1];
    if (!tgt) return null;
    // Coincidencia exacta id/code, o base sin sufijo de piso ("BAN1-P2" → "BAN1").
    const base = tgt.split('-')[0];
    return (
      sanBajs.find((b) => b.id === tgt || b.code === tgt || b.id === base || b.code === base) ||
      null
    );
  };
  // 1. directa
  const direct = findSanBaj(ventB.descargaEnId);
  if (direct) return direct.id;
  // 2. cadena por ramales
  const lvlLabel = engine.nivelActual?.label ?? '';
  const disp = ventB.desplazamientos?.[lvlLabel] || {};
  const bx = ventB.x + (disp.dx || 0);
  const by = ventB.y + (disp.dy || 0);
  const ventRamalIds = new Set<string>();
  for (const r of engine.ramales) {
    if (r.net !== 'vent' || !r.pts || r.pts.length < 2) continue;
    const explicit =
      ventB.recibeDeIds?.includes(r.id) || (!!r.label && ventB.recibeDeIds?.includes(r.label));
    const head = r.pts[r.pts.length - 1];
    const geo =
      Math.hypot(r.pts[0][0] - bx, r.pts[0][1] - by) < 2.0 ||
      Math.hypot(head[0] - bx, head[1] - by) < 2.0;
    if (explicit || geo) ventRamalIds.add(r.id);
  }
  for (const vrId of ventRamalIds) {
    const vr = engine.ramales.find((r) => r.id === vrId);
    if (!vr?.pts || vr.pts.length < 2) continue;
    const eps = [vr.pts[0], vr.pts[vr.pts.length - 1]];
    for (const san of engine.ramales) {
      if (san.net !== 'san' && san.net !== 'll') continue;
      if (!san.pts || san.pts.length < 2) continue;
      let touches = false;
      for (const ep of eps) {
        for (let i = 0; i < san.pts.length - 1 && !touches; i++) {
          if (
            pointToSegmentDist(
              ep[0],
              ep[1],
              san.pts[i][0],
              san.pts[i][1],
              san.pts[i + 1][0],
              san.pts[i + 1][1],
            ) < 0.5
          )
            touches = true;
        }
      }
      if (!touches) continue;
      // san ramal → bajante en el que descarga. El bajante pudo montarse sobre el
      // CUERPO del ramal (split): las mitades resultantes no quedan en
      // recibeDeIds ni con ini/fin, así que se camina aguas abajo por la cadena
      // de ramales san hasta el bajante (geométrico o referenciado).
      const bajId = findSanBajanteDownstream(engine, san, sanBajs, findSanBaj);
      if (bajId) return bajId;
    }
  }
  // 3. coincidencia geométrica directa
  for (const s of sanBajs) {
    if (Math.hypot(s.x - ventB.x, s.y - ventB.y) < 0.5) return s.id;
  }
  return null;
}

// Camina aguas abajo desde un ramal san hasta el id del bajante en que descarga:
// recibeDeIds / fin / ini de cada ramal, o un bajante san montado geométricamente
// en su extremo de salida de flujo. Si el flujo continúa por otro ramal san (el
// caso del split por bajante en el cuerpo), salta a él. Máx 8 saltos (ciclos).
function findSanBajanteDownstream(
  engine: IPlanoEngineCore,
  start: PlanoRamal,
  sanBajs: PlanoBajante[],
  findSanBaj: (ref: string | null | undefined) => PlanoBajante | null,
): string | null {
  const lvlLabel = engine.nivelActual?.label ?? '';
  const bajAt = (pt: number[]): PlanoBajante | null => {
    for (const b of sanBajs) {
      if (Math.hypot(b.x - pt[0], b.y - pt[1]) < 2.0) return b;
      const disp = b.desplazamientos?.[lvlLabel] || {};
      if (Math.hypot(b.x + (disp.dx || 0) - pt[0], b.y + (disp.dy || 0) - pt[1]) < 2.0) return b;
    }
    return null;
  };
  const visited = new Set<string>();
  let cur: PlanoRamal | null = start;
  for (let hop = 0; hop < 8 && cur; hop++) {
    if (visited.has(cur.id)) break;
    visited.add(cur.id);
    const curId = cur.id;
    const byRecibe = sanBajs.find((b) => b.recibeDeIds?.includes(curId));
    if (byRecibe) return byRecibe.id;
    const byRef = findSanBaj(cur.fin) || findSanBaj(cur.ini);
    if (byRef) return byRef.id;
    if (!cur.pts || cur.pts.length < 2) break;
    const head = cur._tribReversed ? cur.pts[0] : cur.pts[cur.pts.length - 1];
    const gb = bajAt(head);
    if (gb) return gb.id;
    let next: PlanoRamal | null = null;
    for (const s2 of engine.ramales) {
      if (s2.id === curId || visited.has(s2.id)) continue;
      if (s2.net !== 'san' && s2.net !== 'll') continue;
      if (!s2.pts || s2.pts.length < 2) continue;
      if (s2.pts.some((p) => Math.hypot(p[0] - head[0], p[1] - head[1]) < 2.0)) {
        next = s2;
        break;
      }
    }
    cur = next;
  }
  return null;
}

export function updateSelected(engine: IPlanoEngineCore, fields: Record<string, unknown>): void {
  const el = getSelected(engine);
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
function guardDiametroNodo(
  engine: IPlanoEngineCore,
  el: { pts?: number[][]; net?: string; id?: string },
  fields: Record<string, unknown>,
): boolean {
  if (fields.diametro === undefined) return true;
  const ram = el as PlanoRamal;
  if (!ram.pts || (ram.net !== 'af' && ram.net !== 'ac' && ram.net !== 'gas')) return true;
  const res = diametroCambioPermitido(engine.ramales, ram.id, String(fields.diametro ?? ''));
  if (!res.ok) {
    engine.triggerAlert('Diámetro no permitido', res.msg || '');
    return false;
  }
  return true;
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
    // de dNominal del bajante (bajanteMenus.tsx usa este método).
    syncVentBajanteDiameters(engine, el, fields);
    // Item 2: el bajante/montante toma por defecto el diámetro del trazo al que se
    // conecta; si son varios, el MAYOR de todos. Cuando un ramal cambia de diámetro,
    // recalcular el floor del bajante = max de todos los ramales asociados — nunca
    // queda por debajo. Si el bajante no tenía diámetro, se le asigna este.
    if (fields.diametro !== undefined && (el as PlanoRamal).pts) {
      const newRamD = String(fields.diametro ?? '');
      const newRamIn = diamPulgFromLabel(newRamD);
      if (newRamIn > 0) {
        const lvlLabel = engine.nivelActual?.label ?? '';
        const changedRam = el as PlanoRamal;
        for (const b of engine.bajantes) {
          if (b.tipo !== 'bajante' && b.tipo !== 'montante') continue;
          const assocRamIds = b.recibeDeIds || [];
          // ¿conectado a este ramal? (explícito por recibeDeIds o geométrico)
          let isConnected = assocRamIds.includes(id);
          if (!isConnected && changedRam.pts) {
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
          // Floor = max de todos los ramales asociados + el que cambió
          let maxRam = '';
          for (const rid of assocRamIds) {
            const rr = engine.ramales.find((x) => x.id === rid);
            if (rr?.diametro) maxRam = maxDiametroLabel(maxRam, rr.diametro);
          }
          maxRam = maxDiametroLabel(maxRam, newRamD);
          const bIn = diamPulgFromLabel(b.dNominal || '');
          const maxIn = diamPulgFromLabel(maxRam);
          if (bIn <= 0) b.dNominal = maxRam;
          else if (maxIn > bIn) b.dNominal = maxRam;
        }
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
