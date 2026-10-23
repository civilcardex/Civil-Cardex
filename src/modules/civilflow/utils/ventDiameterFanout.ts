import type { DrawingData } from './drawingSync.ts';
import { sectorDe, planIdDeKey } from './formatUtils.ts';

/**
 * Ramales de ventilación conectados a los bajantes de vent de un bajante sanitario:
 * los que nacen o terminan en el bajante (por id o por code). Es la parte pura del
 * fan-out del "D vent propuesto" — cambiar el diámetro propuesto adopta el mismo
 * diámetro en TODOS estos ramales con UN batch write.
 * @param ventBajKeys - claves de los bajantes de vent conectados (p.ej. "BAV2-P2").
 * @param ventBajKey - clave del bajante de vent principal (fallback si la lista viene vacía).
 * @param storageByPlan - docs de dibujo por planId (fuente de la geometría).
 * @returns claves de ramales vent ("id-plan") para writeDiametroToDrawingBatch.
 */
export function clavesRamalesVentDeBajantes(
  ventBajKeys: string[],
  ventBajKey: string | null,
  storageByPlan: Record<string, DrawingData>,
): string[] {
  const ventRamalKeys: string[] = [];
  for (const vk of ventBajKeys.length ? ventBajKeys : ventBajKey ? [ventBajKey] : []) {
    const vId = sectorDe(vk);
    const vPlan = planIdDeKey(vk);
    const vdoc = storageByPlan[vPlan];
    if (!vdoc) continue;
    const vBaj = (vdoc.bajantes || []).find((x) => x.id === vId);
    for (const vr of vdoc.ramales || []) {
      if (vr.net !== 'vent' && vr._net !== 'vent') continue;
      if (vr.ini !== vId && vr.fin !== vId && vr.ini !== vBaj?.code && vr.fin !== vBaj?.code)
        continue;
      ventRamalKeys.push(`${String(vr.id)}-${vPlan}`);
    }
  }
  return ventRamalKeys;
}
