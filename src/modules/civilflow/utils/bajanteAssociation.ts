import { writeBajantePropToDrawing } from './writeDiameterToDrawing';
import type { SyncPlanInput } from './drawingSync';
import {
  writeCrossFloorGhost,
  removeCrossFloorGhost,
  createCrossFloorLdesvioRamal,
  removeCrossFloorLdesvioRamal,
  buildLdesvioRamal,
  ldesvioIdFor,
  nextRamalLabel,
  type CrossFloorGhost,
} from './associateBajanteAcrossFloors';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import {
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys';
import { pisoCorto, pisoLbl } from '../constants';
import type { IPlanoEngineCore } from '../lib/PlanoEngine/PlanoState';

interface StoredBajanteDesp {
  id: string;
  desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
}

// Mismo bookkeeping de "fantasma desplazado de sí mismo" que applyBajanteAssociation/
// clearBajanteAssociation hacen en el engine EN VIVO cuando el piso propio del source resulta
// estar cargado — espejado aquí para cuando NO lo está (el flujo "Origen" siempre asocia desde un
// piso distinto a aquel donde el bajante origen realmente vive), parcheando el storage de ese
// piso directamente.
// Elimina cualquier clave-de-nivel de desplazamientos en la que se etiquetara el conector Ldesvio
// de este bajante — claveada por el id de Ldesvio (único por source) en vez de por una etiqueta
// de nivel, porque la etiqueta no siempre puede reconstruirse del piso (posiblemente distinto)
// cargado actualmente del caller.
function removeBajanteDesplazamientoFromStorage(planId: string, bajanteId: string): void {
  const key = TRAZOS_PREFIX + planId;
  const raw = loadFromStorage<{ bajantes?: StoredBajanteDesp[] } | null>(key, null);
  if (!raw?.bajantes) return;
  const b = raw.bajantes.find((x) => x.id === bajanteId);
  if (!b?.desplazamientos) return;
  const ldId = ldesvioIdFor(bajanteId);
  let changed = false;
  const desp = { ...b.desplazamientos };
  for (const lvlKey of Object.keys(desp)) {
    if (desp[lvlKey]?.Ldesvio === ldId) {
      delete desp[lvlKey];
      changed = true;
    }
  }
  if (!changed) return;
  b.desplazamientos = desp;
  saveToStorage(key, raw);
  saveTrazosToDB(planId, raw);
}

function setBajanteDesplazamientoInStorage(
  planId: string,
  bajanteId: string,
  lvl: string,
  disp: { dx: number; dy: number; Ldesvio?: string } | null,
): void {
  const key = TRAZOS_PREFIX + planId;
  const raw = loadFromStorage<{ bajantes?: StoredBajanteDesp[] } | null>(key, null);
  if (!raw?.bajantes) return;
  const b = raw.bajantes.find((x) => x.id === bajanteId);
  if (!b) return;
  const desp = { ...(b.desplazamientos || {}) };
  if (disp) desp[lvl] = disp;
  else delete desp[lvl];
  b.desplazamientos = desp;
  saveToStorage(key, raw);
  saveTrazosToDB(planId, raw);
}

// Un extremo bajante/montante de una asociación entre pisos — suficiente para escribir los
// punteros de ambas direcciones, el fantasma, y (cuando está desalineado) el ramal de desvío
// Ldesvio, sin importar cuál de los dos pisos resulte ser el cargado en vivo actualmente.
export interface AssocEndpoint {
  planId: string;
  id: string;
  x: number;
  y: number;
  net: string;
  dNominal: string;
  code: string;
  /** plan.nivel — el índice ordinal del piso, usado para etiquetas de piso y comparación de elevación. */
  nivelN: number;
  npt: number;
}

function isAligned(a: AssocEndpoint, b: AssocEndpoint): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

export function areEndpointsAligned(a: AssocEndpoint, b: AssocEndpoint): boolean {
  return isAligned(a, b);
}

// Elimina todo lo perteneciente a un enlace previamente establecido donde `sourcePlanId`/
// `sourceBajanteId` era el lado que sostenía descargaEnId de `oldLinkValue` ("targetPlanId|targetId"):
// su fantasma (en el piso del viejo target), su Ldesvio (en el propio piso del source), y el puntero
// inverso origenId del viejo target. Llamado antes de aplicar un NUEVO enlace, o al limpiar uno.
export function clearBajanteAssociation(
  eng: IPlanoEngineCore,
  sourcePlanId: string,
  sourceBajanteId: string,
  sourceNet: string,
  oldLinkValue: string,
  plans: SyncPlanInput[],
): void {
  const [targetPlanId, targetBajanteId] = oldLinkValue.split('|');
  if (!targetPlanId || !targetBajanteId) return;
  const loadedPlanId = String(eng._loadedPlanId ?? '');

  // Borrar fantasma y Ldesvio en ambas direcciones (upper->lower y lower->upper) para cubrir
  // quita asociación desde cualquiera de los dos pisos y asegurar que el círculo 2/4 del inferior desaparezca
  removeCrossFloorGhost(targetPlanId, sourcePlanId, sourceBajanteId);
  removeCrossFloorGhost(sourcePlanId, targetPlanId, targetBajanteId);
  removeCrossFloorLdesvioRamal(sourcePlanId, sourceBajanteId);
  removeCrossFloorLdesvioRamal(targetPlanId, targetBajanteId);
  writeBajantePropToDrawing(
    `${targetBajanteId}-${targetPlanId}`,
    sourceNet,
    'origenId',
    null,
    plans,
  );
  writeBajantePropToDrawing(
    `${sourceBajanteId}-${sourcePlanId}`,
    sourceNet,
    'descargaEnId',
    null,
    plans,
  );

  if (loadedPlanId === targetPlanId) {
    eng.crossFloorGhosts = eng.crossFloorGhosts.filter(
      (g) => !(g.sourcePlanId === sourcePlanId && g.sourceBajanteId === sourceBajanteId),
    );
    const t = eng.bajantes.find((b) => b.id === targetBajanteId);
    if (t) eng.updateElementById(t.id, { origenId: null });
  }
  if (loadedPlanId === sourcePlanId) {
    eng.crossFloorGhosts = eng.crossFloorGhosts.filter(
      (g) => !(g.sourcePlanId === targetPlanId && g.sourceBajanteId === targetBajanteId),
    );
    const s = eng.bajantes.find((b) => b.id === sourceBajanteId);
    if (s) eng.updateElementById(s.id, { descargaEnId: null, origenId: null });
  }
  // El Ldesvio (ramal autogenerado) se borra SIEMPRE del motor vivo, sin importar en qué piso se
  // esté: al desasociar desde el piso del TARGET (flujo "Origen") el Ldesvio vive en el piso del
  // source (otro plan, normalmente no cargado) y el filtro es un no-op seguro; si ambos pisos
  // estuvieran cargados, evita que el ramal quede huérfano visualmente.
  const ldId = ldesvioIdFor(sourceBajanteId);
  eng.ramales = eng.ramales.filter((r) => r.id !== ldId);
  if (loadedPlanId === sourcePlanId) {
    const srcBaj = eng.bajantes.find((b) => b.id === sourceBajanteId);
    const lvl = eng.nivelActual?.label ?? '';
    if (srcBaj?.desplazamientos?.[lvl]) {
      const desp = { ...srcBaj.desplazamientos };
      delete desp[lvl];
      eng.updateElementById(sourceBajanteId, { desplazamientos: desp });
    }
  } else {
    // Espeja la ruta de escritura solo-en-storage del branch `else` de applyBajanteAssociation —
    // el piso propio del source puede no estar cargado aquí tampoco (limpiar un enlace "Origen"
    // desde abajo). La etiqueta de nivel no puede reconstruirse desde `eng.nivelActual` (ese es
    // el piso ACTUAL, no el del source), así que esto barre cada clave de nivel por número de
    // piso parseado en su lugar.
    removeBajanteDesplazamientoFromStorage(sourcePlanId, sourceBajanteId);
  }
}

// Establece source -> target: escribe AMBOS punteros (source.descargaEnId, target.origenId),
// siempre crea el fantasma (en el piso del target, en la posición del source — una confirmación
// visual permanente de que el enlace existe, no solo algo que aparece cuando está desalineado), y
// crea el ramal de desvío Ldesvio (en el piso del source) solo cuando los dos no están ya
// alineados.
export function applyBajanteAssociation(
  eng: IPlanoEngineCore,
  source: AssocEndpoint,
  target: AssocEndpoint,
  plans: SyncPlanInput[],
): { aligned: boolean } {
  const loadedPlanId = String(eng._loadedPlanId ?? '');
  const linkValue = `${target.planId}|${target.id}`;
  const reverseValue = `${source.planId}|${source.id}`;
  const targetIsBelow = target.npt < source.npt;
  const sourceDireccion: 'sube' | 'baja' = targetIsBelow ? 'baja' : 'sube';
  const ghostDireccion: 'sube' | 'baja' = targetIsBelow ? 'sube' : 'baja';
  const aligned = isAligned(source, target);

  writeBajantePropToDrawing(
    `${source.id}-${source.planId}`,
    source.net,
    'descargaEnId',
    linkValue,
    plans,
  );
  writeBajantePropToDrawing(
    `${source.id}-${source.planId}`,
    source.net,
    'direccion',
    sourceDireccion,
    plans,
  );
  writeBajantePropToDrawing(
    `${target.id}-${target.planId}`,
    target.net,
    'origenId',
    reverseValue,
    plans,
  );
  if (loadedPlanId === source.planId) {
    eng.updateElementById(source.id, { descargaEnId: linkValue, direccion: sourceDireccion });
  }
  if (loadedPlanId === target.planId) {
    eng.updateElementById(target.id, { origenId: reverseValue });
  }

  const ghost: CrossFloorGhost = {
    id: `XFG_${source.id}_${source.planId}`,
    net: source.net,
    code: source.code || source.id,
    x: source.x,
    y: source.y,
    dNominal: source.dNominal || '',
    direccion: ghostDireccion,
    parentDireccion: sourceDireccion,
    piso: pisoCorto(source.nivelN),
    sourcePlanId: source.planId,
    sourceBajanteId: source.id,
    targetBajanteId: target.id,
  };
  writeCrossFloorGhost(target.planId, ghost);
  if (loadedPlanId === target.planId) {
    eng.crossFloorGhosts = [
      ...eng.crossFloorGhosts.filter(
        (g) => !(g.sourcePlanId === source.planId && g.sourceBajanteId === source.id),
      ),
      ghost,
    ];
  }

  // El bajante source SIEMPRE recibe el marcador "desplazamiento" del mismo piso en SU PROPIO
  // piso, en la posición PROYECTADA del target — la contraparte del mismo piso del fantasma
  // escrito arriba. Debe existir incluso cuando los dos extremos están alineados (offset cero):
  // sin él, una asociación alineada deja el piso del source sin rastro visible del enlace mientras
  // el piso del target ya muestra el fantasma, y el usuario cambiando al piso del source no ve
  // nada.
  if (loadedPlanId === source.planId) {
    const lvl = eng.nivelActual?.label ?? '';
    if (lvl) {
      const srcBaj = eng.bajantes.find((b) => b.id === source.id);
      if (srcBaj) {
        const desp = { ...(srcBaj.desplazamientos || {}) };
        desp[lvl] = {
          dx: target.x - source.x,
          dy: target.y - source.y,
          Ldesvio: ldesvioIdFor(source.id),
        };
        eng.updateElementById(source.id, { desplazamientos: desp });
      }
    }
  } else {
    // El piso propio del source no está cargado (p. ej. asociar vía "Origen" desde abajo) —
    // mismo bookkeeping, escrito directo al storage de ese piso en vez del engine en vivo.
    setBajanteDesplazamientoInStorage(source.planId, source.id, pisoLbl(source.nivelN), {
      dx: target.x - source.x,
      dy: target.y - source.y,
      Ldesvio: ldesvioIdFor(source.id),
    });
  }

  if (!aligned) {
    createCrossFloorLdesvioRamal(
      source.planId,
      source.id,
      source.net,
      source.x,
      source.y,
      target.x,
      target.y,
      source.dNominal || '',
      source.nivelN,
    );
    if (loadedPlanId === source.planId) {
      const ldId = ldesvioIdFor(source.id);
      const existing = eng.ramales.find((r) => r.id === ldId);
      const label = existing?.label || nextRamalLabel(source.net, eng.ramales);
      const ramal = buildLdesvioRamal(
        ldId,
        label,
        source.net,
        source.x,
        source.y,
        target.x,
        target.y,
        source.dNominal || '',
        source.nivelN,
        eng.scaleM || 0.5,
        existing ? existing.bloqueado : true,
      );
      eng.ramales = [...eng.ramales.filter((r) => r.id !== ldId), ramal as never];
    }
  }

  // UC inheritance: el fantasma (target) y su Ldesvio (si existe) heredan las UC/UD
  // de los ramales SAN del piso superior que descargan en el bajante origen. Así tanto
  // el caso alineado (sin Ldesvio) como el desalineado (con Ldesvio) comparten mismas UC.
  // ponytail: minimal — copia el mapa APARATOS_BY_TRAMO / HYDRO del source a Ldesvio
  try {
    const srcRaw = loadFromStorage<{
      bajantes?: { id: string; recibeDeIds?: string[] }[];
      ramales?: { id: string; net: string }[];
    } | null>(TRAZOS_PREFIX + source.planId, null);
    const srcBaj = srcRaw?.bajantes?.find((b) => b.id === source.id);
    const ramalIds: string[] = srcBaj?.recibeDeIds || [];
    // fallback geom: si no hay recibeDeIds, colectar ramales SAN del piso origen (no Ldesvio)
    if (ramalIds.length === 0 && srcRaw?.ramales?.length) {
      for (const rr of srcRaw.ramales) {
        if (rr.net === source.net && rr.id && !rr.id.startsWith('LD_')) ramalIds.push(rr.id);
      }
      // si sigue vacío, no copiar
      if (ramalIds.length > 10) ramalIds.length = 10;
    }
    if (ramalIds.length) {
      const apos = loadFromStorage<Record<string, Record<string, number>>>(
        APARATOS_BY_TRAMO_KEY,
        {},
      );
      const hydro = loadFromStorage<
        Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
      >(HYDRO_DATA_STORAGE_KEY, {});
      const agg: Record<string, number> = {};
      let hydroAgg: Record<string, number> | null = null;
      for (const rid of ramalIds) {
        const sk = `${source.net}_${rid}_${source.planId}`;
        const m = apos[sk];
        if (m) for (const [k, v] of Object.entries(m)) agg[k] = (agg[k] || 0) + (v as number);
        const h = hydro[sk];
        if (h?.accesorios) {
          if (!hydroAgg) hydroAgg = {};
          for (const [k, v] of Object.entries(h.accesorios))
            hydroAgg[k] = (hydroAgg[k] || 0) + (v as number);
        }
      }
      if (Object.keys(agg).length || hydroAgg) {
        let aposDirty = false;
        let hydroDirty = false;
        if (!aligned) {
          const ldId = ldesvioIdFor(source.id);
          const ldKey = `${source.net}_${ldId}_${source.planId}`;
          if (Object.keys(agg).length) {
            apos[ldKey] = { ...agg };
            aposDirty = true;
          }
          if (hydroAgg) {
            hydro[ldKey] = { accesorios: { ...hydroAgg }, Lh: 0, nSalidas: 0 };
            hydroDirty = true;
          }
        }
        // UCs automáticas al piso inferior (orig. usuario): los ramales conectados al bajante
        // DESTINO reciben el agregado del piso superior SUMADO a lo que ya tengan — y el
        // bajante destino marca el total en ucAcum.
        const tgtRaw = loadFromStorage<{
          bajantes?: { id: string; recibeDeIds?: string[]; alimentaIds?: string[] }[];
          ramales?: { id: string; net: string }[];
        } | null>(TRAZOS_PREFIX + target.planId, null);
        const tgtBaj = tgtRaw?.bajantes?.find((b) => b.id === target.id);
        // Ramales que LLEGAN (recibeDeIds) y los que SALEN del bajante destino (alimentaIds,
        // orig. usuario: los ramales que salen del bajante también reciben las UDs).
        const tgtRamalIds: string[] = [
          ...(tgtBaj?.recibeDeIds || []),
          ...(tgtBaj?.alimentaIds || []),
        ];
        if (tgtRamalIds.length === 0 && tgtRaw?.ramales?.length) {
          // fallback geom: ramales de la red con un extremo en el bajante destino.
          for (const rr of tgtRaw.ramales) {
            if (rr.net !== target.net || !rr.id || rr.id.startsWith('LD_')) continue;
            tgtRamalIds.push(rr.id);
            if (tgtRamalIds.length > 10) break;
          }
        }
        // UDs propias del bajante destino: los ramales que SALEN de él deben tener las mismas
        // UDs que el bajante (orig. usuario, asignación automática).
        const own = apos[`${target.net}_${target.id}_${target.planId}`] || {};
        for (const rid of tgtRamalIds) {
          const tk = `${target.net}_${rid}_${target.planId}`;
          const esAlimenta = (tgtBaj?.alimentaIds || []).includes(rid);
          const extra = esAlimenta ? { ...agg, ...own } : agg;
          if (Object.keys(extra).length) {
            const cur = apos[tk] || {};
            for (const [k, v] of Object.entries(extra)) cur[k] = (cur[k] || 0) + (v as number);
            apos[tk] = cur;
            aposDirty = true;
          }
          if (hydroAgg) {
            const cur = hydro[tk] || { accesorios: {}, Lh: 0, nSalidas: 0 };
            const acc = { ...(cur.accesorios || {}) };
            for (const [k, v] of Object.entries(hydroAgg)) acc[k] = (acc[k] || 0) + (v as number);
            hydro[tk] = { ...cur, accesorios: acc };
            hydroDirty = true;
          }
        }
        if (aposDirty) saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
        if (hydroDirty) saveToStorage(HYDRO_DATA_STORAGE_KEY, hydro);
        // ucAcum del bajante destino = total UC agregada del piso superior (visible en tablas).
        const totalUc = Object.values(agg).reduce((s, v) => s + (v as number), 0);
        if (totalUc > 0) {
          writeBajantePropToDrawing(
            `${target.id}-${target.planId}`,
            target.net,
            'ucAcum',
            totalUc,
            plans,
          );
          if (loadedPlanId === target.planId) {
            eng.updateElementById(target.id, { ucAcum: totalUc });
          }
        }
        if (aposDirty || hydroDirty) {
          try {
            window.dispatchEvent(new CustomEvent('aparatos-clear'));
            window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* ignore copy errors */
  }

  eng.render();
  eng._markDirty();
  return { aligned };
}
