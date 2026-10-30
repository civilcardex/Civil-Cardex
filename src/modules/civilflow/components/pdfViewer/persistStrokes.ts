/** Persistencia del snapshot del engine (visor → caché local + BD).
 * Núcleo compartido por el autosave debounced (usePdfAutoSave.performSave) y el onDirty del engine — antes la secuencia estaba duplicada en ambos lados y podía divergir (ts, LAST_TRAZOS_ID, sync a BD). */
import {
  saveTrazosToDB,
  saveToStorage,
  loadFromStorage,
  saveTrazosLocales,
  trazosDocHasContent,
} from '../../services/storageService.ts';
import { markPlanTrazosFresh, planContentLoaded } from '../../utils/drawingSync.ts';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { journalTrazos } from '../../services/storage/trazosJournal.ts';
import { devError } from '../../../../utils/devError.ts';
import { diamPulgFromLabel } from '../../utils/diamInchesFromLabel.ts';
import { splitCount } from '../../utils/keys.ts';

/** Foto del contenido del motor que se persiste (trazos + ts + scaleM (escala metros por pixel)). */
export interface TrazosSnapshot {
  ts?: number;
  scaleM?: number;
  dims?: unknown[];
}

/** Guarda el trabajo del engine bajo `id` con ts (marca de tiempo) fresco; a BD solo si el id es real (no 'work', el doc de trabajo sin plano). Ej: autosave de RAF1 movido → caché local + BD con el doc vivo. */
export function persistTrazosSnapshot(
  eng: { saveWork(): TrazosSnapshot },
  id: string | number,
): void {
  const work = eng.saveWork();
  // BLINDAJE anti-borrado (dump [CF-SAVE] pasos 1→2, 2026-10-28: cubierta guardó 1 ramal
  // (16:42:41) y al REABRIR la pestaña quedó 0/0 con ts fresco — la apertura limpia la caché
  // local, la carga de BD del piso no llega (carrera) y un _dirty espurio dispara el autosave
  // con el motor vacío, que pisa local Y BD). Un push VACÍO solo es legítimo si el contenido
  // de ese piso CARGÓ alguna vez en esta sesión (borrar todo); si nunca cargó, el snapshot
  // vacío es basura de carrera y no toca nada. El guard previo (engine en otro piso) no
  // alcanzaba: aquí el engine SÍ estaba en el piso, pero su contenido jamás llegó.
  if (!trazosDocHasContent(work) && !planContentLoaded(String(id))) {
    const engId = (eng as { _loadedPlanId?: unknown })._loadedPlanId;
    devError(
      `[CF-PERSIST] piso ${id}: snapshot VACÍO bloqueado (contenido nunca cargó esta sesión; engine piso=${String(engId)})`,
    );
    journalTrazos('persist-block', id, work, `vacio-sin-carga engine=${String(engId)}`);
    return;
  }
  if (!trazosDocHasContent(work)) {
    const engId = (eng as { _loadedPlanId?: unknown })._loadedPlanId;
    const mismoPiso = engId != null && String(engId) === String(id);
    const prev = loadFromStorage<unknown>(TRAZOS_PREFIX + String(id), null);
    if (trazosDocHasContent(prev) && !mismoPiso) {
      devError(
        `[CF-PERSIST] piso ${id}: snapshot VACÍO bloqueado (engine en otro piso: ${String(engId)})`,
      );
      journalTrazos('persist-block', id, work, `vacio-otro-piso engine=${String(engId)}`);
      return;
    }
  }
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

/** Guardado de DESMONTE del visor (el último escritor de la pestaña): persiste el engine bajo el
 *  piso cargado si hay ediciones reales y NO hay carga en vuelo (un engine a medio hidratar
 *  escribiría un doc vacío/ajeno con ts fresco). Anota el motivo en el diario DEV.
 *  Ej: cerrar la pestaña con trazos sin autosave -> caché local + BD con el doc vivo. */
export function guardarAlDesmontar(
  eng: {
    _loadedPlanId?: string | number | null;
    _dirty?: boolean;
    saveWork(): TrazosSnapshot;
  },
  fallbackId: string | number | null | undefined,
  loading: boolean,
): void {
  if (!eng._dirty) return;
  const id = eng._loadedPlanId || fallbackId || 'work';
  if (loading) {
    // Desmonte DURANTE una carga: el guard evita persistir un engine a medio hidratar. Si esas
    // ediciones se pierden, el diario deja el motivo (antes era invisible).
    journalTrazos('cleanup-skip', id, null, 'carga-en-vuelo');
    return;
  }
  const work = eng.saveWork();
  work.ts = Date.now();
  // Caja negra (DEV): id real vs fallback (plano nunca asignado) — la firma del piso perdido.
  journalTrazos('cleanup', id, work, `loadedPlanId=${String(eng._loadedPlanId)}`);
  saveToStorage(TRAZOS_PREFIX + id, work, { sinDiario: true });
  if (id !== 'work') saveTrazosToDB(String(id), work);
}

/** Snapshot que escribe el PANEL de aparatos (no es el autosave): guarda el engine del piso
 *  abierto en la caché local, salvo que el engine esté VACÍO y la caché tenga contenido — un
 *  vacío con ts fresco (piso entrante que aún no hidrató) lo consolidaba en BD la
 *  migración/prefetch y el piso se borraba al reabrir. El borrado legítimo va por el autosave
 *  (_dirty). Ej: abrir un piso cuya carga de BD aún no llegó -> no se escribe nada. */
export function guardarSnapshotDelPanel(eng: {
  _loadedPlanId?: string | number | null;
  saveWork(): TrazosSnapshot;
}): void {
  const clave = `${TRAZOS_PREFIX}${String(eng._loadedPlanId)}`;
  const work = eng.saveWork();
  if (!trazosDocHasContent(work) && trazosDocHasContent(loadFromStorage(clave, null))) return;
  work.ts = Date.now();
  saveToStorage(clave, work);
}

/** ¿La clave de conteos `k` corresponde a un elemento borrado?
 * Solo se tocan claves del piso cargado (isPlanKeyFor, filtro del caller): borrar RS4 en un piso no debe vaciar las UDs (Unidades de Desague) del mismo id en los demás. */
export function claveDeBorrado(k: string, ids: string[], currentIds: Set<string>): boolean {
  // splitCount resuelve el id compuesto (LD_BAN2) y el label de tributario (T1RS4) sin
  // casos especiales; el fallback cubre el legado sin sufijo numérico.
  const [, parsedId] = splitCount(k);
  let idInKey = parsedId;
  if (!idInKey) {
    const segs = k.split('_');
    idInKey = segs[1] ?? '';
    if (idInKey === 'LD') idInKey = `LD_${segs[2] ?? ''}`;
  }
  for (const id of ids) {
    const isExact = idInKey === id;
    const isTributaryOfDeleted = idInKey.startsWith('T') && idInKey.endsWith(id);
    if ((isExact || isTributaryOfDeleted) && !currentIds.has(idInKey)) return true;
  }
  return false;
}
