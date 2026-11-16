import { writeSanDrawingSync } from '../drawingSync.ts';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../../services/storageService.ts';
import { TRAZOS_PREFIX, SAN_FAMILIES } from '../../constants/storage-keys.ts';
import type { SyncPlanInput, RawElement } from '../drawingSync.ts';
import { normalizarCanal } from '../../lib/PlanoEngine/channelAssociation';
import { cmToPlanePx } from '../../lib/PlanoEngine/planoCoords.ts';
import { parseBajanteKey } from './diameters';

/** Doc de dibujo local (ramales + bajantes con ts) para los writes de este módulo. */
interface LocalDrawingData {
  ts?: number;
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

/** Escribe pendiente (%) de un ramal ll (Lluvias) al doc + BD (el caller valida el rango). */
export function writePendienteToDrawing(
  ramalKey: string,
  net: string,
  newPend: number,
  plans: SyncPlanInput[],
): void {
  if (!ramalKey || !net || !plans) return;
  const isSan = SAN_FAMILIES.has(net);
  const [ramalId, planId] = parseBajanteKey(ramalKey);
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

/** Escribe dims del canal ll (Lluvias) al doc + BD (con normalizarCanal en el mismo write). */
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
