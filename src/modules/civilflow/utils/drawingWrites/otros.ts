import { writeHydroDrawingSync, writeSanDrawingSync } from '../drawingSync';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../../services/storageService';
import { TRAZOS_PREFIX, HYDRO_FAMILIES, SAN_FAMILIES } from '../../constants/storage-keys';
import type { SyncPlanInput, RawElement } from '../drawingSync';
import { normalizarCanal } from '../../lib/PlanoEngine/canalAssociation';
import { cmToPlanePx } from '../../lib/PlanoEngine/planoCoords';

/** Escribe la pendiente (%) de un ramal ll al doc de trazos del piso + BD (y sync san —
 *  'll' ∈ SAN_FAMILIES). El caller valida el rango físico; aquí solo persistencia dual. */
interface LocalDrawingData {
  ts?: number;
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

export function writePendienteToDrawing(
  ramalKey: string,
  net: string,
  newPend: number,
  plans: SyncPlanInput[],
): void {
  if (!ramalKey || !net || !plans) return;
  const isSan = SAN_FAMILIES.has(net);
  const parts = ramalKey.split('-');
  const ramalId = parts[0];
  const planId = parts[1];
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    let changed = false;
    for (const r of data.ramales || []) {
      if (r.id === ramalId && r.net === net) {
        r.pendiente = newPend;
        changed = true;
      }
    }
    if (changed) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
    }
  }
  if (isSan) writeSanDrawingSync(plans);
}

export function writeNSalidasToDrawing(
  ramalKey: string,
  net: string,
  newVal: number,
  plans: SyncPlanInput[],
): void {
  if (!ramalKey || !net || !plans) return;
  const isSan = SAN_FAMILIES.has(net);
  const isHydro = HYDRO_FAMILIES.has(net);
  const parts = ramalKey.split('-');
  const ramalId = parts[0];
  const planId = parts[1];
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    let changed = false;
    for (const r of data.ramales || []) {
      if (r.id === ramalId && r.net === net) {
        r.nSalidas = newVal;
        changed = true;
      }
    }
    // también actualizar hidroData nSalidas si existe
    if (changed) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
      // sincronizar hidroData
      const hKey = `${net}_${ramalId}_${plan.id}`;
      const hidro = loadFromStorage<
        Record<string, { accesorios: Record<string, number>; Lh: number; nSalidas: number }>
      >('tramo_hidro_data_v3', {});
      if (hidro[hKey]) {
        hidro[hKey].nSalidas = newVal;
        saveToStorage('tramo_hidro_data_v3', hidro);
      }
    }
  }
  if (isSan) writeSanDrawingSync(plans);
  if (isHydro) writeHydroDrawingSync(plans);
}

/** Escribe dims de un CANAL (base/altura/longitud/pendiente) al doc de su piso + BD, con
 *  normalizarCanal (base-corta) en el mismo write — la tabla de chequeo escribe por aquí
 *  (ítem 7 usuario: manda el dibujo). Un solo load+save por plano + sync san (ll ∈ san). */
export function writeCanalDimsToDrawing(
  drawId: string,
  planId: string | number,
  dims: { base?: number; altura?: number; longitud?: number; pendiente?: number },
  plans: SyncPlanInput[],
) {
  if (!drawId || planId == null || !plans) return;
  // Engine vivo con ESTE plan cargado: mutar ahí (el autosave es el escritor de verdad —
  // escribir solo storage haría que su próximo autosave revirtiera la edición de la tabla).
  const eng = (
    window as unknown as {
      __cfEngine?: {
        _loadedPlanId?: string | number | null;
        updateElementById(id: string, fields: Record<string, unknown>): void;
      };
    }
  ).__cfEngine;
  if (eng && String(eng._loadedPlanId ?? '') === String(planId)) {
    eng.updateElementById(drawId, dims as Record<string, unknown>);
    try {
      writeSanDrawingSync(plans);
    } catch {
      /* sync best-effort */
    }
    return;
  }
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    let changed = false;
    const pxPerCm = cmToPlanePx(Number((data as { scaleM?: number }).scaleM ?? 0.5), 1);
    for (const b of data.bajantes || []) {
      if (b.id === drawId && b.net === 'll' && (b as { tipo?: string }).tipo === 'canal') {
        const bb = b as Record<string, unknown>;
        if (dims.base != null) bb.base = dims.base;
        if (dims.altura != null) bb.altura = dims.altura;
        if (dims.longitud != null) bb.longitud = dims.longitud;
        if (dims.pendiente != null) bb.pendiente = dims.pendiente;
        try {
          normalizarCanal(
            pxPerCm,
            bb as { x: number; y: number; longitud?: number; base?: number; angulo?: number },
          );
        } catch {
          // Canal corrupto: se guarda lo escrito sin normalizar, no se pierde el dato.
        }
        changed = true;
      }
    }
    if (changed) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
      try {
        writeSanDrawingSync(plans);
      } catch {
        /* sync best-effort */
      }
    }
  }
}
