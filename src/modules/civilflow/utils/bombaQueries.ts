import { loadFromStorage } from '../services/storageService';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { pisoLbl } from '../constants';
import type { PlanItem } from '../context/PlansContext';

export interface BombaRow {
  planId: string;
  id: string;
  code: string;
  caja: string;
  nivel: string;
  /** plan.nivel numérico del piso de la bomba — clave del anillo (desplazamientos) y pisoCorto. */
  nivelN: number;
  x: number;
  y: number;
  net: string;
}

/** Bombas (tipo 'bomba') del piso INMEDIATAMENTE inferior al actual — única fuente de opciones
 *  para asociar (orig. usuario). "Inmediato" = el mayor `nivel` que sea menor al actual. */
export function bombsImmediateLowerFloor(plans: PlanItem[], currentPlanId: string): BombaRow[] {
  const current = plans.find((pl) => String(pl.id) === currentPlanId);
  if (!current || typeof current.nivel !== 'number') return [];
  const lower = plans.filter(
    (pl) =>
      pl.status === 'confirmed' &&
      String(pl.id) !== currentPlanId &&
      typeof pl.nivel === 'number' &&
      (pl.nivel as number) < (current.nivel as number),
  );
  if (!lower.length) return [];
  const inmNivel = Math.max(...lower.map((pl) => pl.nivel as number));
  const out: BombaRow[] = [];
  for (const pl of lower.filter((pl) => pl.nivel === inmNivel)) {
    const t = loadFromStorage<{
      bajantes?: Array<{
        id: string;
        code?: string;
        net?: string;
        tipo?: string;
        x?: number;
        y?: number;
        cajaOrigenId?: string | null;
      }>;
    } | null>(TRAZOS_PREFIX + String(pl.id), null);
    for (const b of t?.bajantes || []) {
      if (b.tipo !== 'bomba') continue;
      out.push({
        planId: String(pl.id),
        id: b.id,
        code: b.code || b.id,
        caja: b.cajaOrigenId || '—',
        nivel: pl.nivel != null ? pisoLbl(Number(pl.nivel)) : String(pl.id),
        nivelN: typeof pl.nivel === 'number' ? pl.nivel : 0,
        x: b.x ?? 0,
        y: b.y ?? 0,
        net: b.net || 'san',
      });
    }
  }
  return out;
}

export interface BajanteSuperiorRow {
  planId: string;
  id: string;
  code: string;
  x: number;
  y: number;
  net: string;
  dNominal: string;
  nivel: string;
  nivelN: number;
  bombaEnId: string | null;
}

/** Bajantes (tipo 'bajante') del piso INMEDIATAMENTE SUPERIOR al actual — opciones para
 *  asociar DESDE la bomba (orig. usuario). Inverso de `bombsImmediateLowerFloor`: el menor
 *  `nivel` que sea mayor al actual. */
export function bajantesImmediateUpperFloor(
  plans: PlanItem[],
  currentPlanId: string,
): BajanteSuperiorRow[] {
  const current = plans.find((pl) => String(pl.id) === currentPlanId);
  if (!current || typeof current.nivel !== 'number') return [];
  const upper = plans.filter(
    (pl) =>
      pl.status === 'confirmed' &&
      String(pl.id) !== currentPlanId &&
      typeof pl.nivel === 'number' &&
      (pl.nivel as number) > (current.nivel as number),
  );
  if (!upper.length) return [];
  const inmNivel = Math.min(...upper.map((pl) => pl.nivel as number));
  const out: BajanteSuperiorRow[] = [];
  for (const pl of upper.filter((pl) => pl.nivel === inmNivel)) {
    const t = loadFromStorage<{
      bajantes?: Array<{
        id: string;
        code?: string;
        net?: string;
        tipo?: string;
        x?: number;
        y?: number;
        dNominal?: string;
        bombaEnId?: string | null;
      }>;
    } | null>(TRAZOS_PREFIX + String(pl.id), null);
    for (const b of t?.bajantes || []) {
      if (b.tipo !== 'bajante') continue;
      out.push({
        planId: String(pl.id),
        id: b.id,
        code: b.code || b.id,
        x: b.x ?? 0,
        y: b.y ?? 0,
        net: b.net || 'san',
        dNominal: b.dNominal || '',
        nivel: pl.nivel != null ? pisoLbl(Number(pl.nivel)) : String(pl.id),
        nivelN: typeof pl.nivel === 'number' ? pl.nivel : 0,
        bombaEnId: b.bombaEnId ?? null,
      });
    }
  }
  return out;
}

/** Asocia la bomba al bajante: `bombaEnId` en el bajante + direccion 'sube' automática.
 *  La herencia de UDs la ejecuta el efecto en vivo de FixturesPanel. `bajPlanId`: piso del
 *  bajante (necesario al asociar DESDE el piso de la bomba, donde currentPlanId es el piso de
 *  la bomba y el bajante vive arriba). */
