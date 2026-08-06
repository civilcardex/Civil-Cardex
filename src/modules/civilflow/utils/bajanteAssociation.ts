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
import { TRAZOS_PREFIX } from '../constants/storage-keys';
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

  removeCrossFloorGhost(targetPlanId, sourcePlanId, sourceBajanteId);
  removeCrossFloorLdesvioRamal(sourcePlanId, sourceBajanteId);
  writeBajantePropToDrawing(
    `${targetBajanteId}-${targetPlanId}`,
    sourceNet,
    'origenId',
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

  eng.render();
  eng._markDirty();
  return { aligned };
}
