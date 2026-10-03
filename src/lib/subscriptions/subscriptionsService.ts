/**
 * Lectura de suscripciones del usuario (RLS: solo sus filas) + verificación
 * de vigencia. La verdad es fecha_fin: estaActiva la compara contra el reloj
 * actual, así que una suscripción vence en vivo sin refetch.
 */
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

/** Trae las suscripciones del usuario; [] si no hay sesión o falla la lectura. */
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

/** Vigente: estado activa y fecha_fin estrictamente futura. */
export function estaActiva(
  s: Pick<SuscripcionRow, 'estado' | 'fecha_fin'>,
  ahora: Date = new Date(),
): boolean {
  if (s.estado !== 'activa') return false;
  return new Date(s.fecha_fin).getTime() > ahora.getTime();
}

/** Módulos con acceso VIGENTE del usuario: propias por RLS + asientos de empresa.
 *  El RPC mis_accesos une app_suscripciones y app_suscripciones_miembros server-side
 *  (la policy owner-only de app_suscripciones no ve los asientos). Devuelve [] si el
 *  RPC aún no existe en BD (feature no desplegada) — fail-open como el resto. */
export async function fetchModulosConAcceso(): Promise<ModuloId[]> {
  try {
    const { data, error } = await supabase.rpc('mis_accesos');
    if (error || !Array.isArray(data)) return [];
    return data.filter((m: unknown): m is ModuloId => typeof m === 'string');
  } catch {
    return [];
  }
}

/** Set de módulos con suscripción vigente. */
export function modulosActivos(rows: SuscripcionRow[], ahora: Date = new Date()): Set<ModuloId> {
  const activos = new Set<ModuloId>();
  for (const r of rows) {
    if (estaActiva(r, ahora)) activos.add(r.modulo);
  }
  return activos;
}

/**
 * Detecta el fallo "edge function de pagos inexistente" (crear-checkout / verificar-pago
 * aún sin deploy — ACTIVACIÓN paso 3 en AGENTS.md): el relay responde 404 ("Function
 * not found") y supabase-js lo entrega en el mensaje y/o el status del error.
 */
export function edgePagoNoDesplegada(err: unknown): boolean {
  const e = err as { message?: string; status?: number; context?: { status?: number } } | null;
  const status = e?.status ?? e?.context?.status;
  return /not found|404/i.test(e?.message ?? '') || status === 404;
}

let promiseHabilitadas: Promise<boolean> | null = null;

/** Flag global de la BD (app_config → RPC suscripciones_habilitadas). Cache por
 *  sesión: un solo RPC aunque many instancias del hook lo pidan. Error → false:
 *  sin confirmación de la BD el cliente NUNCA bloquea (el candado real es server-side).
 *  El false por error NO se cachea: el próximo fetch reintenta. */
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
