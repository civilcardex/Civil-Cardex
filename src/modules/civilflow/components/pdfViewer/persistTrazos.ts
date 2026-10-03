/**
 * Persistencia del snapshot del engine (visor → caché local + BD). Núcleo compartido por el
 * autosave debounced (usePdfAutoSave.performSave) y el onDirty del engine — antes la secuencia
 * estaba duplicada en ambos lados y podía divergir (ts, LAST_TRAZOS_ID, sync a BD).
 */
import { saveTrazosToDB, loadFromStorage, saveTrazosLocales } from '../../services/storageService';
import { markPlanTrazosFresh } from '../../utils/drawingSync';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { devError } from '../../../../utils/devError';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';

/** Guarda el trabajo del engine bajo `id` con ts fresco; a BD solo si el id es real (no 'work',
 *  el doc de trabajo sin plano). Sincronía total con el storage local. */
export interface TrazosSnapshot {
  ts?: number;
  scaleM?: number;
  dims?: unknown[];
}

export function persistTrazosSnapshot(
  eng: { saveWork(): TrazosSnapshot },
  id: string | number,
): void {
  const work = eng.saveWork();
  // El panel del visor cambia el diámetro con updateSelected (solo r.diametro + bump de
  // dNominal vía bumpConnectedBajantes): sincronizar diamPulg de los bajantes de ventilación
  // desde su dNominal para que la tabla "Bajantes AN/vent" lea el "D vent propuesto".
  const wv = work as TrazosSnapshot & {
    ramales?: Array<Record<string, unknown>>;
    bajantes?: Array<{ net?: string; dNominal?: string; diamPulg?: number }>;
  };
  for (const b of wv.bajantes || []) {
    if (b.net !== 'vent' || !b.dNominal) continue;
    const pulg = diamPulgFromLabel(String(b.dNominal).replace(/-/g, ' '));
    if (pulg > 0) b.diamPulg = pulg;
  }
  work.ts = Date.now();
  // Blindaje anti-borrado de asociación (incidente persistente): si el doc en storage tiene
  // ramales LD_ / bajantes con ANILLO (desplazamientos) que el snapshot del engine no trae,
  // se FUSIONAN al work — ningún autosave puede borrar de la asociación por un engine a
  // medio hidratar. Seguro: la desasociación borra en storage TAMBIÉN (prev sin piezas →
  // no hay nada que fusionar). Trazas DEV para cazar quién producía el doc sin LD_.
  const prevDoc = loadFromStorage<{
    ramales?: Array<Record<string, unknown>>;
    bajantes?: Array<Record<string, unknown>>;
  } | null>(TRAZOS_PREFIX + String(id), null);
  if (prevDoc) {
    const wb = (wv.bajantes || []) as Array<Record<string, unknown>>;
    const prevLds = (prevDoc.ramales || []).filter((r) => String(r['id'] || '').startsWith('LD_'));
    const workLdIds = new Set(
      ((wv.ramales || []) as Array<{ id?: string }>).map((r) => String(r.id || '')),
    );
    const ldsPerdidos = prevLds.filter((r) => !workLdIds.has(String(r['id'] || '')));
    if (ldsPerdidos.length > 0) {
      devError(
        `[CF-PERSIST] piso ${id}: work sin ${ldsPerdidos.length} LD_ (${ldsPerdidos
          .map((r) => String(r['id']))
          .join(',')}) — restaurados desde storage`,
      );
      wv.ramales = [...(wv.ramales || []), ...ldsPerdidos];
    }
    for (const pb of prevDoc.bajantes || []) {
      const desp = pb['desplazamientos'] as Record<string, unknown> | undefined;
      if (!desp || Object.keys(desp).length === 0) continue;
      const wb2 = wb.find((x) => x['id'] === pb['id']);
      if (
        wb2 &&
        (!wb2['desplazamientos'] || Object.keys(wb2['desplazamientos'] as object).length === 0)
      ) {
        wb2['desplazamientos'] = desp;
        if (pb['ghostData']) wb2['ghostData'] = pb['ghostData'];
        devError(`[CF-PERSIST] piso ${id}: anillo restaurado a ${String(pb['id'])}`);
      }
    }
  }
  // serializeWork no lleva la marca assocLayout (el engine no la conoce): copiarla del doc
  // previo (mismo prevDoc de arriba — un solo parse del doc por autosave) evita que cada
  // guardado re-arme la migración de asociaciones (incidente 2026-09-25).
  const w = work as TrazosSnapshot & { assocLayout?: number };
  if (!w.assocLayout && (prevDoc as { assocLayout?: number } | null)?.assocLayout) {
    w.assocLayout = (prevDoc as { assocLayout?: number }).assocLayout;
  }
  saveTrazosLocales(id, work as Record<string, unknown>);
  markPlanTrazosFresh(id);
  if (id !== 'work') {
    saveTrazosToDB(String(id), work);
  }
}

/** ¿La clave de conteos `k` corresponde a un elemento borrado? Solo se tocan claves del piso
 *  cargado (isPlanKeyFor, filtro del caller): borrar RS4 en un piso no debe vaciar las UDs del
 *  mismo id en los demás. Tampoco se borra si un ramal renumerado ocupó ese id (RS2→RS1). */
export function claveDeBorrado(k: string, ids: string[], currentIds: Set<string>): boolean {
  const segs = k.split('_');
  let idInKey = segs[1] ?? '';
  // Claves de Ldesvio (san_LD_BAN2_17): el id real es compuesto (LD_BAN2) — con segs[1]='LD'
  // estas claves jamás se limpiaban en esta ruta (quedaban solo para la cascada del engine).
  if (idInKey === 'LD') idInKey = `LD_${segs[2] ?? ''}`;
  for (const id of ids) {
    const isExact = idInKey === id;
    const isTributaryOfDeleted = idInKey.startsWith('T') && idInKey.endsWith(id);
    if ((isExact || isTributaryOfDeleted) && !currentIds.has(idInKey)) return true;
  }
  return false;
}
