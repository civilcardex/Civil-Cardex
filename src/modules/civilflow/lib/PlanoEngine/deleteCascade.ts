import type { IPlanoEngineCore, PlanoBajante } from './PlanoState';
import {
  removeCrossFloorGhost,
  removeCrossFloorLdesvioRamal,
} from '../../utils/associateBajanteAcrossFloors';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { HYDRO_DATA_STORAGE_KEY } from '../../constants/storage-keys';
import { _firstSegmentAngle } from './drawingAngles';

/** Entrada del storage de hidráulica: conteo de accesorios, longitud horizontal y salidas de un ramal. */
export interface HidroDataEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}

// La barra lateral de Aparatos (FixturesPanel.tsx/AccesoriosSection) lleva su propio conteo de
// cada glifo de tee como "accesorio" asignado al ramal huésped (HYDRO_DATA_STORAGE_KEY, llave
// `${net}_${ramalId}_${planId}`) — limpiar el campo del glifo en el objeto del ramal no toca ese
// conteo, así que la barra seguía mostrando la tee como asignada después de que el símbolo
// desapareciera visualmente. Se decrementa a la par.
/** Decrementa en el storage de conteos el accesorio de una tee borrada del dibujo, para que la barra de aparatos no siga mostrándola como asignada. */
export function decrementAccesorioCount(
  engine: IPlanoEngineCore,
  hostR: { id: string; net: string },
  accType: string,
): void {
  const planId = engine._loadedPlanId;
  if (planId == null) return;
  const storageKey = `${hostR.net}_${hostR.id}_${planId}`;
  const map = loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {});
  const entry = map[storageKey];
  if (!entry?.accesorios?.[accType]) return;
  const next = entry.accesorios[accType] - 1;
  const nextAcc = { ...entry.accesorios };
  if (next <= 0) delete nextAcc[accType];
  else nextAcc[accType] = next;
  map[storageKey] = { ...entry, accesorios: nextAcc };
  saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
}

// Un bajante/montante conectado a otro piso por "Origen"/"Destino" es el mismo tubo físico que
// continúa allá — borrar el símbolo de un lado y dejar el otro (apuntando a un id que ya no
// existe) no tiene sentido, así que borrar cualquiera de los dos extremos borra también el otro,
// dondequiera que viva su piso. Aplica tanto a bajante como a montante.
/** Al borrar un montante, limpia en cascada las asociaciones de descarga u origen entre pisos que apuntaban a él. */
export function cascadeMontanteAssociation(engine: IPlanoEngineCore, deleted: PlanoBajante): void {
  if (deleted.tipo !== 'montante' && deleted.tipo !== 'bajante') return;
  const thisPlanId = String(engine._loadedPlanId ?? '');

  if (deleted.descargaEnId) {
    const [targetPlanId, targetBajanteId] = deleted.descargaEnId.includes('|')
      ? deleted.descargaEnId.split('|')
      : [thisPlanId, deleted.descargaEnId];
    if (targetPlanId && targetBajanteId) {
      removeCrossFloorGhost(targetPlanId, thisPlanId, deleted.id);
      removeCrossFloorLdesvioRamal(thisPlanId, deleted.id);
      if (targetPlanId === thisPlanId) {
        const t = engine.bajantes.find((b) => b.id === targetBajanteId);
        if (t) t.origenId = null;
      } else {
        // No borrar el bajante del otro piso, solo limpiar su asociación y fantasma 2/4
        removeCrossFloorGhost(targetPlanId, thisPlanId, deleted.id);
        // limpiar origenId del bajante destino en storage sin borrarlo
        try {
          const key = `trazos_${targetPlanId}`;
          const raw = loadFromStorage<unknown>(key, null) as {
            bajantes?: { id: string; origenId?: string | null }[];
          } | null;
          if (raw?.bajantes) {
            let changed = false;
            for (const b of raw.bajantes) {
              if (b.id === targetBajanteId && b.origenId) {
                b.origenId = null;
                changed = true;
              }
            }
            if (changed) {
              saveToStorage(key, raw);
            }
          }
        } catch {
          /* storage cleanup not critical */
        }
      }
    }
  }

  if (deleted.origenId) {
    const [originPlanId, originBajanteId] = deleted.origenId.includes('|')
      ? deleted.origenId.split('|')
      : [thisPlanId, deleted.origenId];
    if (originPlanId && originBajanteId) {
      removeCrossFloorGhost(thisPlanId, originPlanId, originBajanteId);
      removeCrossFloorLdesvioRamal(originPlanId, originBajanteId);
      if (originPlanId === thisPlanId) {
        const o = engine.bajantes.find((b) => b.id === originBajanteId);
        if (o) o.descargaEnId = null;
      } else {
        // No borrar el bajante del otro piso, solo limpiar su asociación
        removeCrossFloorGhost(originPlanId, thisPlanId, deleted.id);
        try {
          const key = `trazos_${originPlanId}`;
          const raw = loadFromStorage<unknown>(key, null) as {
            bajantes?: {
              id: string;
              descargaEnId?: string | null;
              desplazamientos?: Record<string, unknown>;
              ghostData?: Record<string, unknown>;
            }[];
          } | null;
          if (raw?.bajantes) {
            let changed = false;
            for (const b of raw.bajantes) {
              if (b.id === originBajanteId && b.descargaEnId) {
                b.descargaEnId = null;
                changed = true;
              }
              // limpiar desplazamiento 2/4 del origen si apuntaba a este Ldesvio
              if (b.desplazamientos) {
                for (const lvl of Object.keys(b.desplazamientos)) {
                  if (
                    (b.desplazamientos[lvl] as { Ldesvio?: string })?.Ldesvio ===
                    `LD_${originBajanteId}`
                  ) {
                    delete (b.desplazamientos as Record<string, unknown>)[lvl];
                    if (b.ghostData) delete (b.ghostData as Record<string, unknown>)[lvl];
                    changed = true;
                  }
                }
              }
            }
            if (changed) {
              saveToStorage(key, raw);
            }
          }
        } catch {
          /* storage cleanup not critical */
        }
      }
    }
  }
}

// Dirección (normalizada) hacia el interior desde el extremo compartido sharedPt.
/** Dirección normalizada hacia el interior de la polilínea desde el extremo compartido dado. */
export function dirAt(r: { pts: number[][] }, sharedPt: number[]): [number, number] | null {
  const len = r.pts.length;
  let other: number[];
  if (Math.hypot(r.pts[0][0] - sharedPt[0], r.pts[0][1] - sharedPt[1]) < 0.5) other = r.pts[1];
  else other = r.pts[len - 2];
  let dx = other[0] - sharedPt[0];
  let dy = other[1] - sharedPt[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return null;
  dx /= d;
  dy /= d;
  return [dx, dy];
}
