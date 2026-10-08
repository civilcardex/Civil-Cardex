import { loadFromStorage } from '../services/storageService';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { collectSourceAgg } from './bajanteAssociation';
import type { InheritPoolBajante, InheritPoolRamal } from './bajanteAssociation';
import { pisoLbl } from '../constants';
import { mapUdBombaDesdeTrazos } from './bombaHerencia';

import { libroHeredado } from '../components/fixturesStorage';

export interface AsocLiveBaj {
  id?: string;
  origenId?: string | null;
  bombaEnId?: string | null;
  pisoBase?: string;
  ucAplicado?: Record<string, Record<string, number>>;
}

/** FUENTE ÚNICA de verdad para el panel del bajante ASOCIADO (orig. usuario: original/fantasma/
 *  Ldesvio/salida deben mostrar SIEMPRE las UD del grupo — 12, no 16). Orden: (1) enlace a
 *  bomba → mapUdBombaDesdeTrazos; (2) libro `ucAplicado`; (3) árbol REAL del bajante origen vía
 *  collectSourceAgg sobre el trazos del piso origen. null = el elemento no es asociado (el
 *  caller cae a su ruta normal). */
export function aggBajanteAsociado(opts: {
  targetId: string;
  netId: string;
  planId: string;
  liveBaj: AsocLiveBaj | null | undefined;
  plans: Array<{ id: string | number; nivel: number | string | null }>;
  counts: Record<string, Record<string, number>>;
  hidro: Record<string, { accesorios?: Record<string, number> }>;
  engine?: {
    _loadedPlanId?: string | number | null;
    bajantes: unknown[];
    ramales: unknown[];
  } | null;
}): Record<string, number> | null {
  const { targetId, netId, planId, liveBaj, plans, counts, hidro } = opts;
  const eng = opts.engine ?? null;
  if (!liveBaj) return null;
  const poolVivoDe = (planIdStr: string) => {
    const enVivo = !!eng && String(eng._loadedPlanId ?? '') === planIdStr;
    return enVivo
      ? {
          bajantes: eng!.bajantes as InheritPoolBajante[],
          ramales: eng!.ramales as InheritPoolRamal[],
        }
      : null;
  };

  // 1) Enlace a BOMBA: UDs leídas directo de los trazos del piso de la bomba (su caja + tramos).
  if (liveBaj.bombaEnId?.includes('|')) {
    const [pPlan, pId] = liveBaj.bombaEnId.split('|');
    try {
      const heredado = mapUdBombaDesdeTrazos(pPlan, pId, netId, poolVivoDe(pPlan));
      if (Object.keys(heredado).length) return heredado;
    } catch {
      /* lectura best-effort */
    }
  }

  // 2) Libro de herencia (engine vivo primero — el autosave tarda 1.5 s —, storage de respaldo;
  //    el piso del libro es el del PROPIO bajante, remapeado por pisoBase si el elemento es un
  //    fantasma proyectado de otro piso).
  let libro: Record<string, Record<string, number>> | undefined;
  if (liveBaj.ucAplicado && Object.keys(liveBaj.ucAplicado).length) {
    libro = liveBaj.ucAplicado;
  } else {
    try {
      const planDelLibro = (() => {
        const pb = liveBaj.pisoBase;
        if (!pb) return planId;
        const home = plans.find((p) => p.nivel != null && pisoLbl(Number(p.nivel)) === pb);
        return home && String(home.id) !== String(planId) ? String(home.id) : planId;
      })();
      libro = loadFromStorage<{
        bajantes?: Array<{ id?: string; ucAplicado?: Record<string, Record<string, number>> }>;
      } | null>(TRAZOS_PREFIX + planDelLibro, null)?.bajantes?.find(
        (x) => x.id === targetId,
      )?.ucAplicado;
    } catch {
      /* lectura best-effort */
    }
  }
  const porLibro = libroHeredado({ ucAplicado: libro });
  if (Object.keys(porLibro).length) return porLibro;

  // 3) Libro ausente/vacío: espejar el árbol REAL del bajante origen (misma verdad que la
  //    propagación) — la lectura local sumaba heredado + UD propias del piso (16 vs 12).
  if (liveBaj.origenId?.includes('|')) {
    try {
      const [oPlan, oBaj] = liveBaj.origenId.split('|');
      const rawOrigen = loadFromStorage<{
        ramales?: unknown[];
        bajantes?: unknown[];
      } | null>(TRAZOS_PREFIX + oPlan, null);
      const srcBaj = (rawOrigen?.bajantes as InheritPoolBajante[] | undefined)?.find(
        (x) => x.id === oBaj,
      );
      if (srcBaj) {
        const { agg } = collectSourceAgg({
          net: netId,
          planId: String(oPlan),
          bajId: oBaj,
          liveBaj: poolVivoDe(oPlan)?.bajantes.find((b) => b.id === oBaj) ?? null,
          liveRamales: poolVivoDe(oPlan)?.ramales ?? null,
          storedBaj: srcBaj,
          storedRamales: (rawOrigen?.ramales ?? []) as InheritPoolRamal[],
          counts,
          hidro,
        });
        if (Object.keys(agg).length) return agg;
      }
    } catch {
      /* lectura best-effort */
    }
  }
  return null;
}
