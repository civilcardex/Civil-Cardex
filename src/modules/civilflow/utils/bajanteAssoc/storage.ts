// IO de storage y parcheo de docs de la asociación entre pisos: el anillo de desplazamientos,
// el registro/borrado del LDesvio, los punteros de enlace leídos del motor vivo o del storage,
// los roles físicos del enlace y la marca de desasociación. Ej: guardar el desplazamiento del
// nivel 'P2' de BAN1 con el piso 2 cerrado — se parchea su doc directamente en el storage.
import type { SyncPlanInput } from '../drawingSync.ts';
import { aplicarEnDocDePlan, type MotorDoc } from '../writePlanDoc.ts';
import {
  hasCachedPlan,
  loadData,
  saveData,
  type LocalGhostDrawingData,
} from '../associateBajanteAcrossFloors';
import { devError } from '../../../../utils/devError.ts';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../../services/storageService.ts';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState.ts';
import type { StoredBajanteDesp } from './types.ts';

// Mismo bookkeeping de "fantasma desplazado de sí mismo" que applyBajanteAssociation/
// clearBajanteAssociation hacen en el engine EN VIVO cuando el piso propio del source resulta
// estar cargado — espejado aquí para cuando NO lo está (el flujo "Origen" siempre asocia desde un
// piso distinto a aquel donde el bajante origen realmente vive), parcheando el storage de ese
// piso directamente.
// Elimina cualquier clave-de-nivel de desplazamientos en la que se etiquetara el conector Ldesvio
// de este bajante — claveada por el id de Ldesvio (único por source) en vez de por una etiqueta
// de nivel, porque la etiqueta no siempre puede reconstruirse del piso (posiblemente distinto)
// cargado actualmente del caller.
/** Escribe (o con disp null, borra) el desplazamiento de un nivel del anillo del bajante DIRECTO
 *  en el storage de su piso — funciona aunque ese piso no esté cargado. Ej: guardar
 *  {dx:14, dy:-22} del nivel 'P2' de BAN1 y la dirección 'sube' del fantasma, con el piso 2 cerrado. */
export function setBajanteDesplazamientoInStorage(
  planId: string,
  bajanteId: string,
  lvl: string,
  disp: { dx: number; dy: number; Ldesvio?: string } | null,
  ghostDireccion?: 'sube' | 'baja',
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
  if (ghostDireccion) {
    const gd = { ...(b.ghostData || {}) };
    gd[lvl] = { ...(gd[lvl] ?? {}), direccion: ghostDireccion };
    b.ghostData = gd;
  }
  saveToStorage(key, raw);
  saveTrazosToDB(planId, raw);
}

/** Registra el desvío en L (LD) como RAMAL ASOCIADO del bajante/montante al que LLEGA (el
 *  original del piso destino): lo añade a `recibeDeIds` + `asocManual` (la asociación a mano
 *  no se poda por geometría) y marca el `fin` del LD con el código del bajante. Con esto el
 *  "Ramal asociado" aparece MARCADO en el panel derecho y en el menú contextual, y el estado
 *  es REAL (guardado en el doc), no un dibujito del menú (orig. usuario). */
export function registrarLdesvioComoAsociado(args: {
  planId: string | number;
  bajanteId: string;
  bajanteCode: string;
  ldId: string;
  eng?: MotorDoc | null;
}): void {
  const { planId, bajanteId, bajanteCode, ldId, eng } = args;
  if (!bajanteId || !ldId) return;
  aplicarEnDocDePlan(eng ?? null, planId, (doc) => {
    for (const raw of doc.bajantes || []) {
      const b = raw as { id: string; recibeDeIds?: string[]; asocManual?: string[] };
      if (b.id !== bajanteId) continue;
      const recibe = new Set(b.recibeDeIds || []);
      const manual = new Set(b.asocManual || []);
      if (!recibe.has(ldId)) recibe.add(ldId);
      if (!manual.has(ldId)) manual.add(ldId);
      b.recibeDeIds = [...recibe];
      b.asocManual = [...manual];
    }
    for (const raw of doc.ramales || []) {
      const r = raw as { id: string; fin?: string };
      if (r.id !== ldId) continue;
      r.fin = bajanteCode;
    }
  });
}

/** Quita el desvío en L (LD_, ramal desvio entrepisos) de la asociación del bajante (muere
 *  con el enlace): lo saca de `recibeDeIds` + `asocManual`. Sin esto, el LD muerto quedaba en
 *  la lista y los espejos le escribían la carga del bajante (clave fantasma de UD (Unidades
 *  de Desague) residuales, orig. usuario). */
export function desasociarLdesvioDeBajante(args: {
  planId: string | number;
  bajanteId: string;
  ldId: string;
  eng?: MotorDoc | null;
}): void {
  const { planId, bajanteId, ldId, eng } = args;
  if (!bajanteId || !ldId) return;
  aplicarEnDocDePlan(eng ?? null, planId, (doc) => {
    for (const raw of doc.bajantes || []) {
      const b = raw as { id: string; recibeDeIds?: string[]; asocManual?: string[] };
      if (b.id !== bajanteId) continue;
      const recibe = b.recibeDeIds || [];
      const manual = b.asocManual || [];
      b.recibeDeIds = recibe.filter((id) => id !== ldId);
      b.asocManual = manual.filter((id) => id !== ldId);
    }
  });
}

/** Con qué bajantes de OTROS pisos está enlazado este (descargaEnId/origenId): primero se mira el motor vivo, y si ese piso no está abierto, lo guardado. */
export function readBajanteLink(
  eng: IPlanoEngineCore,
  planId: string,
  bajId: string,
): { descargaEnId: string | null; origenId: string | null } {
  const loadedPlanId = String(eng._loadedPlanId ?? '');
  const live = loadedPlanId === planId ? eng.bajantes.find((b) => b.id === bajId) : undefined;
  if (live) return { descargaEnId: live.descargaEnId ?? null, origenId: live.origenId ?? null };
  const raw = loadFromStorage<{
    bajantes?: { id: string; descargaEnId?: string | null; origenId?: string | null }[];
  } | null>(TRAZOS_PREFIX + planId, null);
  const b = raw?.bajantes?.find((x) => x.id === bajId);
  return { descargaEnId: b?.descargaEnId ?? null, origenId: b?.origenId ?? null };
}

/** NPT (nivel de piso topografico) del piso buscado dentro de la lista de pisos del proyecto —
 *  con él se sabe qué extremo del enlace queda arriba. Ej: plans con 'Piso 2' de npt 3.0 → 3.
 *  @param plans - pisos del proyecto (plans_meta).
 *  @returns el npt en metros, o null si el piso no existe o no trae npt numérico. */
function nptOfPlan(planId: string, plans: SyncPlanInput[]): number | null {
  const p = plans.find((x) => String(x.id) === String(planId));
  return typeof p?.npt === 'number' ? p.npt : null;
}

// Roles físicos de un enlace (el LD/ghost/anillo se direccionan por upper/lower por NPT,
// no por los roles UI source/target): el ghost XFG_<lowerId>_<lowerPlan> hospedado en el piso
// superior dice la verdad; sin ghost, se deriva por npt (empate → upper = target, igual que
// el apply); sin npts, null (barrido amplio legacy como último recurso).
/** Roles físicos (piso de ARRIBA / piso de ABAJO) de un enlace entre pisos: primero pregunta al
 *  fantasma guardado (dice la verdad aunque falten NPT (nivel de piso topografico)) y sin él
 *  deriva por npt. Ej: BAN1-P1 ↔ BAN2-P2 → upper = BAN2 del piso 2. */
export function resolveLinkRoles(
  sourcePlanId: string,
  sourceBajanteId: string,
  targetPlanId: string,
  targetBajanteId: string,
  plans: SyncPlanInput[],
): { upperPlanId: string; upperId: string; lowerPlanId: string; lowerId: string } | null {
  for (const pid of new Set([sourcePlanId, targetPlanId])) {
    const data = loadFromStorage<{
      crossFloorGhosts?: {
        sourcePlanId?: string;
        sourceBajanteId?: string;
        targetBajanteId?: string;
      }[];
    } | null>(TRAZOS_PREFIX + pid, null);
    for (const g of data?.crossFloorGhosts || []) {
      const match =
        (g.sourcePlanId === sourcePlanId &&
          g.sourceBajanteId === sourceBajanteId &&
          g.targetBajanteId === targetBajanteId) ||
        (g.sourcePlanId === targetPlanId &&
          g.sourceBajanteId === targetBajanteId &&
          g.targetBajanteId === sourceBajanteId);
      if (!match || !g.sourcePlanId || !g.sourceBajanteId || !g.targetBajanteId) continue;
      return {
        upperPlanId: pid,
        upperId: g.targetBajanteId,
        lowerPlanId: g.sourcePlanId,
        lowerId: g.sourceBajanteId,
      };
    }
  }
  const nptS = nptOfPlan(sourcePlanId, plans);
  const nptT = nptOfPlan(targetPlanId, plans);
  if (nptS == null || nptT == null) return null;
  // Espejo del apply: targetIsBelow = nptT < nptS; upper = below ? source : target.
  const upperIsSource = nptT < nptS;
  return upperIsSource
    ? {
        upperPlanId: sourcePlanId,
        upperId: sourceBajanteId,
        lowerPlanId: targetPlanId,
        lowerId: targetBajanteId,
      }
    : {
        upperPlanId: targetPlanId,
        upperId: targetBajanteId,
        lowerPlanId: sourcePlanId,
        lowerId: sourceBajanteId,
      };
}

// Elimina todo lo perteneciente a un enlace previamente establecido donde `sourcePlanId`/
// `sourceBajanteId` era el lado que sostenía descargaEnId de `oldLinkValue` ("targetPlanId|targetId").
// Scope EXACTO por enlace (roles upper/lower): los barridos amplios por id borraban el LD, el
// anillo y las claves de OTRO enlace cruzado que comparte id de bajante en otro piso
// (BAN1-P1↔BAN2-P2 + BAN1-P2↔BAN2-P1: LD_BAN1 vive en el piso 1 para el segundo enlace).
/** Deja constancia en AMBOS pisos de que se desasoció (así una cop vieja guardada en el navegador no "resucita" el LD_ (ramal desvio entrepisos) que se acaba de borrar). */
export function estamparAsocsClearedTs(planIds: string[]): void {
  const ts = Date.now();
  for (const pid of planIds) {
    try {
      if (!hasCachedPlan(pid)) continue;
      const doc = loadData(pid) as LocalGhostDrawingData & { asocsClearedTs?: number };
      doc.asocsClearedTs = ts;
      saveData(pid, doc as LocalGhostDrawingData);
    } catch (e) {
      devError('[assoc] marca desasociación:', pid, e);
    }
  }
}
