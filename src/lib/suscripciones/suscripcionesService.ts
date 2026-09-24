/**
 * Lectura de suscripciones del usuario (RLS: solo sus filas) + verificación
 * de vigencia. La verdad es fecha_fin: estaActiva la compara contra el reloj
 * actual, así que una suscripción vence en vivo sin refetch.
 */
import { supabase } from '../supabase';
import type { ModuloId } from './catalogo';
import { devError } from '../../utils/devError';

export interface SuscripcionRow {
  id: number;
  modulo: ModuloId;
  periodo: string;
  estado: string;
  fecha_fin: string;
}

/** Evento DOM para pedir refetch tras un pago aprobado. */
export const EV_SUSCRIPCIONES = 'civilflow_suscripciones_changed';

export function dispararRefetchSuscripciones(): void {
  window.dispatchEvent(new Event(EV_SUSCRIPCIONES));
}

/** Trae las suscripciones del usuario; [] si no hay sesión o falla la lectura. */
export async function fetchSuscripciones(): Promise<SuscripcionRow[]> {
  try {
    const { data, error } = await supabase
      .from('cf_suscripciones')
      .select('id, modulo, periodo, estado, fecha_fin');
    if (error) {
      devError('fetchSuscripciones:', error.message);
      return [];
    }
    return (data ?? []) as SuscripcionRow[];
  } catch (e) {
    devError('fetchSuscripciones:', e);
    return [];
  }
}

/** Vigente: estado activa y fecha_fin estrictamente futura. */
export function estaActiva(
  s: Pick<SuscripcionRow, 'estado' | 'fecha_fin'>,
  ahora: Date = new Date(),
): boolean {
  if (s.estado !== 'activa') return false;
  return new Date(s.fecha_fin).getTime() > ahora.getTime();
}

/** Set de módulos con suscripción vigente. */
export function modulosActivos(rows: SuscripcionRow[], ahora: Date = new Date()): Set<ModuloId> {
  const activos = new Set<ModuloId>();
  for (const r of rows) {
    if (estaActiva(r, ahora)) activos.add(r.modulo);
  }
  return activos;
}
