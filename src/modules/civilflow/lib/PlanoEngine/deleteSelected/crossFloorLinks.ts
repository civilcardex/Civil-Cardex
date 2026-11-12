/** Enlaces entre pisos del borrado (deleteSelected): resolver el bajante del PISO ABIERTO
 *  (real vs proyección), limpiar los punteros origen/descarga de un enlace, desasociar un
 *  bajante de su enlace y borrar el fantasma (anillo) que es la mitad visual del enlace.
 *  Ej: borrar el anillo del piso de abajo debe dejar el montante original del piso de arriba
 *  con «Sin origen» en su desplegable. */
import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState.ts';
import type { CrossFloorGhost } from '../PlanoState.ts';
import { splitPtr } from '../../../utils/keys.ts';
import { clearBajanteAssociation } from '../../../utils/bajanteAssociation';
import { TRAZOS_PREFIX } from '../../../constants/storage-keys.ts';
import {
  loadFromStorage,
  saveToStorage,
  saveTrazosToDB,
} from '../../../services/storageService.ts';

/** Índice del bajante con ese id prefiriendo el del PISO ABIERTO: el motor puede tener el
 *  real y la proyección de otro piso con el MISMO id — un findIndex plano borraba la
 *  proyección y el montante real se quedaba en el dibujo ("no se borró nada", orig. usuario).
 *  Ej: motor con BAN1 real (Piso 1) + BAN1 proyección (Piso 2), nivelActual=Piso 1 → índice del real.
 */
export function indiceBajanteDePiso(engine: IPlanoEngineCore, id: string): number {
  const candidatos = engine.bajantes.map((b, i) => ({ b, i })).filter((x) => x.b.id === id);
  if (candidatos.length === 0) return -1;
  const nivel = engine.nivelActual?.label ?? '';
  return (candidatos.find((x) => (x.b.pisoBase ?? '') === nivel) ?? candidatos[0]).i;
}

/** Desasocia los dos extremos de un enlace entre pisos: el de ARRIBA pierde su `descargaEnId`
 *  (apuntaba al de abajo) y el de ABAJO pierde su `origenId` (apuntaba al de arriba). Solo se
 *  toca el puntero que apunta AL OTRO extremo — en una cadena de tres pisos el montante del
 *  medio conserva su enlace con el piso de más abajo. Se limpia en el storage de cada piso y
 *  en el motor vivo (lo que pinta el desplegable de origen). */
export function limpiarPunterosDeEnlace(
  engine: IPlanoEngineCore,
  arriba: { planId: string; id: string },
  abajo: { planId: string; id: string },
): void {
  const punteroArriba = `${abajo.planId}|${abajo.id}`;
  const punteroAbajo = `${arriba.planId}|${arriba.id}`;
  // Storage de cada piso.
  for (const [planId, id, prop, puntero] of [
    [arriba.planId, arriba.id, 'descargaEnId', punteroArriba],
    [abajo.planId, abajo.id, 'origenId', punteroAbajo],
  ] as Array<[string, string, 'descargaEnId' | 'origenId', string]>) {
    try {
      const key = TRAZOS_PREFIX + planId;
      const raw = loadFromStorage<{ bajantes?: Array<Record<string, unknown>> } | null>(key, null);
      const b = raw?.bajantes?.find((x) => x.id === id);
      if (!b || b[prop] !== puntero) continue;
      b[prop] = null;
      saveToStorage(key, raw);
      saveTrazosToDB(planId, raw);
    } catch {
      /* best-effort */
    }
  }
  // Motor vivo (el elemento seleccionado: el desplegable de origen).
  for (const [planId, id, prop, puntero] of [
    [arriba.planId, arriba.id, 'descargaEnId', punteroArriba],
    [abajo.planId, abajo.id, 'origenId', punteroAbajo],
  ] as Array<[string, string, 'descargaEnId' | 'origenId', string]>) {
    if (String(engine._loadedPlanId ?? '') !== planId) continue;
    const el = engine.bajantes.find((x) => x.id === id) as
      (Record<string, unknown> & { id: string }) | undefined;
    if (!el || el[prop] !== puntero) continue;
    engine.updateElementById(el.id, { [prop]: null });
  }
}

/** Desasocia un bajante/montante de su enlace entre pisos: limpia el puntero del OTRO extremo
 *  (el que queda en el piso vecino) para que su desplegable de origen vuelva a "Sin origen".
 *  Works con el puntero que tenga (origenId = el de arriba; descargaEnId = el de abajo). */
export function desasociarPorBajante(engine: IPlanoEngineCore, baj: PlanoBajante): void {
  const planId = String(engine._loadedPlanId ?? '');
  const arriba = splitPtr(baj.origenId ?? '', '');
  if (arriba[0] && arriba[1]) {
    limpiarPunterosDeEnlace(engine, { planId: arriba[0], id: arriba[1] }, { planId, id: baj.id });
    return;
  }
  const abajo = splitPtr(baj.descargaEnId ?? '', '');
  if (abajo[0] && abajo[1]) {
    limpiarPunterosDeEnlace(engine, { planId, id: baj.id }, { planId: abajo[0], id: abajo[1] });
  }
}

/** Baja el fantasma (anillo punteado) de un enlace entre pisos en el borrado EN CONJUNTO:
 *  tumba el enlace COMPLETO — puntero inverso del piso destino, desplazamiento del origen y
 *  el fantasma en storage. Ej: borrar el anillo del piso 2 debe dejar el montante del piso 1
 *  con «Sin origen», no solo desaparecer el anillo. */
export function borrarFantasmaEnlaceEnConjunto(
  engine: IPlanoEngineCore,
  g: CrossFloorGhost,
  id: string,
): void {
  // Un fantasma es la mitad visual de un enlace entre pisos — borrarlo debe tumbar el
  // enlace COMPLETO: el puntero inverso origenId del piso destino, el desplazamiento del
  // origen (con su ramal Ldesvio) y el fantasma mismo en storage. El piso destino es el
  // que está cargado (los fantasmas solo se dibujan ahí), así que clearBajanteAssociation
  // también arregla el estado vivo del motor. `plans` no está disponible a nivel de motor:
  // el origenId null del destino aterriza en storage por el flujo normal de guardado
  // sucio, y la caché de dibujo sincronizada se reconstruye en el próximo syncDrawings.
  // El fantasma vive en el piso del extremo SUPERIOR (g.targetBajanteId) y su puntero
  // `descargaEnId` apunta al de abajo (g.sourceBajanteId): pasar los extremos al revés
  // dejaba el origenId vivo y el desplegable de origen seguía con valor (orig. usuario).
  clearBajanteAssociation(
    engine,
    String(engine._loadedPlanId ?? ''),
    String(g.targetBajanteId ?? ''),
    g.net,
    `${g.sourcePlanId}|${g.sourceBajanteId}`,
    [],
  );
  limpiarPunterosDeEnlace(
    engine,
    { planId: String(engine._loadedPlanId ?? ''), id: String(g.targetBajanteId ?? '') },
    { planId: String(g.sourcePlanId), id: String(g.sourceBajanteId) },
  );
  engine.crossFloorGhosts = engine.crossFloorGhosts.filter((x) => x.id !== id);
  engine.selectedGhostId = null;
  engine._isGhostSel = false;
  engine.selId = null;
  engine._emitSelect(null);
  engine._emitDelete([id]);
  engine.render();
  engine._markDirty();
}
