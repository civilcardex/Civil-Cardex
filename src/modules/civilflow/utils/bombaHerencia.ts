import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import {
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys';
import { ldesvioIdFor } from './associateBajanteAcrossFloors';
import { collectSourceAgg } from './bajanteAssociation';
import type { InheritPoolBajante, InheritPoolRamal } from './bajanteAssociation';
import type { IPlanoEngineCore } from '../lib/PlanoEngine/PlanoState';

export function mapUdBombaDesdeTrazos(
  pumpPlanId: string,
  pumpId: string,
  net: string,
  live?: {
    bajantes: InheritPoolBajante[];
    ramales: InheritPoolRamal[];
  } | null,
): Record<string, number> {
  const trazos = loadFromStorage<{
    ramales?: Array<{
      id: string;
      tipo?: string;
      padre?: string | null;
      net?: string;
      pts?: number[][];
      _tribReversed?: boolean;
    }>;
    bajantes?: Array<{
      id: string;
      tipo?: string;
      net?: string;
      code?: string;
      x?: number;
      y?: number;
      cajaOrigenId?: string | null;
      recibeDeIds?: string[];
      alimentaIds?: string[];
    }>;
  } | null>(TRAZOS_PREFIX + pumpPlanId, null);
  const counts = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
  const bomba = trazos?.bajantes?.find((b) => b.id === pumpId && b.tipo === 'bomba');
  if (!bomba) return {};
  const caja = trazos?.bajantes?.find((x) => x.id === bomba.cajaOrigenId);
  if (caja) {
    const hidro = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      HYDRO_DATA_STORAGE_KEY,
      {},
    );
    // Pool vivo cuando hay (piso cargado): los trazos en disco pueden ir por detrás
    // (autosave 1.5 s, arrastres sin guardar) y dejar fuera ramales que el visor sí ve —
    // el espejo del panel y esta lectura divergían (10 vs 4).
    const liveCaja = live?.bajantes.find((b) => b.id === caja.id) ?? null;
    const { agg } = collectSourceAgg({
      net,
      planId: pumpPlanId,
      bajId: caja.id,
      liveBaj: liveCaja,
      liveRamales: liveCaja && live?.ramales.length ? live.ramales : null,
      storedBaj: caja,
      storedRamales: trazos?.ramales ?? null,
      counts,
      hidro,
    });
    if (Object.keys(agg).length) return agg;
  }
  // Fallback DESPUÉS del cierre: la clave espejo de la bomba (mantenida en vivo por el
  // visor) solo vale si los trazos no aportaron nada.
  const mirror = counts[`${net}_${pumpId}_${pumpPlanId}`];
  const out: Record<string, number> = {};
  if (mirror) for (const [k, v] of Object.entries(mirror)) out[k] = (out[k] || 0) + (v as number);
  return out;
}

/** Herencia bomba→bajante del piso superior: la clave de la bomba (= UDs de su caja,
 *  espejadas) se replica con delta exacto (libro `ucAplicado`: nuevo = actual − aplicado +
 *  agregado) en los ramales del bajante (recibe+alimenta) + `ucAcum` — la MISMA mecánica de
 *  delta que la herencia hacia abajo, pero hacia ARRIBA. Campo dedicado `bombaEnId`:
 *  descargaEnId/origenId dispararían la herencia invertida.
 *  Extraído del efecto de FixturesPanel para usarlo también al asociar (ver `asociarBomba`):
 *  una sola implementación. Muta `disk`; el caller guarda y dispara eventos. Todas las
 *  escrituras (motor, trazos, libro) son condicionales a cambio real — si no, el `setCounts`
 *  posterior re-dispararía el efecto en bucle. @returns true si cambió `disk`. */
export function propagarHerenciaBomba(
  eng: IPlanoEngineCore,
  planId: string | number | null | undefined,
  netId: string,
  disk: Record<string, Record<string, number>>,
): boolean {
  const pid = planId != null ? String(planId) : '';
  const pkey = (rid: string) => (pid ? `${netId}_${rid}_${pid}` : `${netId}_${rid}`);
  let diskDirty = false;
  for (const baj of eng.bajantes) {
    if (baj.net !== netId || baj.tipo !== 'bajante') continue;
    if (!baj.bombaEnId?.includes('|')) continue;
    const [pPlan, pId] = baj.bombaEnId.split('|');
    // SIEMPRE desde los trazos del piso de la bomba: la clave espejo en `disk` puede estar
    // vacía/vieja si ese piso no está cargado (orig. usuario: herencia salía 0 UD). Con el
    // piso cargado se suma el pool vivo (los trazos en disco van por detrás del motor).
    const engMismoPiso = String(eng._loadedPlanId ?? '') === pPlan ? eng : null;
    const aggBomba = mapUdBombaDesdeTrazos(
      pPlan,
      pId,
      netId,
      engMismoPiso
        ? {
            bajantes: engMismoPiso.bajantes as unknown as InheritPoolBajante[],
            ramales: engMismoPiso.ramales as unknown as InheritPoolRamal[],
          }
        : null,
    );
    const tgtRamalIds = [...(baj.recibeDeIds || []), ...(baj.alimentaIds || [])];
    const ucNuevo: Record<string, Record<string, number>> = {};
    for (const rid of tgtRamalIds) {
      const tk = pkey(rid);
      const cur = disk[tk] || {};
      const prevAp = baj.ucAplicado?.[tk] || {};
      const result: Record<string, number> = {};
      for (const k of new Set([...Object.keys(cur), ...Object.keys(aggBomba)])) {
        const nv = Math.max(0, (cur[k] || 0) - (prevAp[k] || 0)) + ((aggBomba[k] as number) || 0);
        if (nv > 0) result[k] = nv;
      }
      if (JSON.stringify(disk[tk] || {}) !== JSON.stringify(result)) {
        if (Object.keys(result).length) disk[tk] = result;
        else delete disk[tk];
        diskDirty = true;
      }
      ucNuevo[tk] = { ...aggBomba };
    }
    const totalB = Object.values(aggBomba).reduce((a, v) => a + (v as number), 0);
    // CLAVE PROPIA del bajante = agregado de la bomba (orig. usuario: "el ramal que SALE del
    // bajante no toma las UDs") — el espejo de salidas copia agregadoBajante(BAN2), que parte
    // de la clave propia; sin esto copiaba la clave VACÍA y RS7 quedaba en 0 UD.
    const bkSelf = pkey(baj.id);
    if (JSON.stringify(disk[bkSelf] || {}) !== JSON.stringify(aggBomba)) {
      disk[bkSelf] = { ...aggBomba };
      diskDirty = true;
    }
    // Espejo del LDESVIO de la bomba (LD_<bajId> en el piso de la bomba, creado al asociar
    // desalineados): REEMPLAZO puro con el agregado — contar como cualquier ramal con las
    // MISMAS UDs de la bomba (orig. usuario). Vacío → borrar la clave.
    const lk = `${netId}_${ldesvioIdFor(baj.id)}_${pPlan}`;
    const aggNoVacio = Object.keys(aggBomba).length > 0;
    if (aggNoVacio) {
      if (JSON.stringify(disk[lk] || {}) !== JSON.stringify(aggBomba)) {
        disk[lk] = { ...aggBomba };
        diskDirty = true;
      }
    } else if (disk[lk]) {
      delete disk[lk];
      diskDirty = true;
    }
    if (
      JSON.stringify(baj.ucAplicado || {}) !== JSON.stringify(ucNuevo) ||
      (baj.ucAcum ?? 0) !== totalB
    ) {
      eng.updateElementById(baj.id, {
        ucAplicado: ucNuevo,
        ucAcum: totalB,
      } as unknown as Record<string, unknown>);
    }
    // Persistir el libro YA (el autosave tarda 1.5s y el panel leía el storage viejo → 0 UD).
    const trazosBaj = loadFromStorage<{
      bajantes?: Array<{ id: string; ucAplicado?: Record<string, Record<string, number>> }>;
    } | null>(TRAZOS_PREFIX + pid, null);
    const tBj = trazosBaj?.bajantes?.find((x) => x.id === baj.id);
    if (tBj && JSON.stringify(tBj.ucAplicado || {}) !== JSON.stringify(ucNuevo)) {
      tBj.ucAplicado = ucNuevo;
      saveToStorage(TRAZOS_PREFIX + pid, trazosBaj);
      saveTrazosToDB(String(pid), trazosBaj);
    }
  }
  return diskDirty;
}
