/** Suscripciones del usuario (la base de datos solo le devuelve las suyas). La app confía en la fecha de vencimiento (fecha_fin), no en promesas: si venció, se bloquea al toque. */
import { supabase } from '../supabase';
import type { ModuloId } from './catalog';
import { devError } from '../../utils/devError';

export interface SuscripcionRow {
  id: number;
  modulo: ModuloId;
  periodo: string;
  estado: string;
  fecha_fin: string;
  puestos?: number;
  user_id?: string;
}

/** Evento DOM para pedir refetch tras un pago aprobado. */
export const EV_SUSCRIPCIONES = 'civilflow_suscripciones_changed';

export function dispararRefetchSuscripciones(): void {
  window.dispatchEvent(new Event(EV_SUSCRIPCIONES));
}

/** Trae las suscripciones guardadas del usuario; si no hay sesión o falla la lectura devuelve [] (la app se comporta como sin suscripción). */
export async function fetchSuscripciones(): Promise<SuscripcionRow[]> {
  try {
    const { data, error } = await supabase
      .from('app_suscripciones')
      .select('id, modulo, periodo, estado, fecha_fin, puestos, user_id');
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

/** ¿La suscripción sigue al día? Debe estar marcada como activa y su fecha de fin tiene que ser futura. Ej: fecha_fin '2026-11-01' con hoy 2026-10-14 → true. */
export function estaActiva(
  s: Pick<SuscripcionRow, 'estado' | 'fecha_fin'>,
  ahora: Date = new Date(),
): boolean {
  if (s.estado !== 'activa') return false;
  return new Date(s.fecha_fin).getTime() > ahora.getTime();
}

/** Módulos a los que puede entrar: los comprados por él + los asientos que le dieron como miembro del equipo de una empresa. Si la función de BD no existe todavía, devuelve []. */
export async function fetchModulosConAcceso(): Promise<ModuloId[]> {
  try {
    const { data, error } = await supabase.rpc('mis_accesos');
    if (error || !Array.isArray(data)) return [];
    return data.filter((m: unknown): m is ModuloId => typeof m === 'string');
  } catch {
    return [];
  }
}

/** Lista rápida de módulos con suscripción al día (sin repetidos). */
export function modulosActivos(rows: SuscripcionRow[], ahora: Date = new Date()): Set<ModuloId> {
  const activos = new Set<ModuloId>();
  for (const r of rows) {
    if (estaActiva(r, ahora)) activos.add(r.modulo);
  }
  return activos;
}

/** Detecta que la pasarela de pagos no está desplegada (error 404): la app lo usa para avisar "pagos aún no disponibles" en vez de mostrar un error crudo. */
export function edgePagoNoDesplegada(err: unknown): boolean {
  const e = err as { message?: string; status?: number; context?: { status?: number } } | null;
  const status = e?.status ?? e?.context?.status;
  return /not found|404/i.test(e?.message ?? '') || status === 404;
}

let promiseHabilitadas: Promise<boolean> | null = null;

/** Interruptor maestro guardado en la BD (función suscripciones_habilitadas): mientras esté en off, la app funciona como siempre y nadie se bloquea. Si la lectura falla devuelve false SIN guardarlo (se reintenta). */
export function suscripcionesHabilitadas(): Promise<boolean> {
  promiseHabilitadas ??= (async () => {
    try {
      const { data, error } = await supabase.rpc('suscripciones_habilitadas');
      if (error) {
        devError('suscripciones_habilitadas:', error.message);
        promiseHabilitadas = null; // fallo transitorio: reintentable en el próximo fetch
        return false;
      }
      return data === true;
    } catch (e) {
      devError('suscripciones_habilitadas:', e);
      promiseHabilitadas = null; // fallo transitorio: reintentable en el próximo fetch
      return false;
    }
  })();
  return promiseHabilitadas;
}
