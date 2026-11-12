/** Suscripciones del usuario (la base de datos solo le devuelve las suyas). La app confía en la fecha de vencimiento (fecha_fin), no en promesas: si venció, se bloquea al toque. */
import { supabase } from '../supabase';
import type { ModuloId, Periodo, PuestosPorModulo } from './catalog.ts';
import { devError } from '../../utils/devError.ts';

/** Fila de app_suscripciones (una compra vigente de un módulo). Ej: {modulo:'flow', periodo:'mensual', fecha_fin:'2026-11-01'} -> acceso a flow hasta esa fecha. */
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

/** Pide a todos los hooks de suscripciones que recarguen (dispara EV_SUSCRIPCIONES). Ej: el webhook de pago aprobado la llama para que el candado se abra sin recargar. */
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

// Caché del flag con TTL: un valor cacheado PARA SIEMPRE escondía un cambio del
// interruptor (encender/apagar suscripciones_activas) hasta recargar la página.
let promiseHabilitadas: Promise<boolean> | null = null;
let habilitadasDesde = 0;
const HABILITADAS_TTL_MS = 5 * 60 * 1000;

/** Interruptor maestro guardado en la BD (función suscripciones_habilitadas): mientras esté en off, la app funciona como siempre y nadie se bloquea. Si la lectura falla devuelve false SIN guardarlo (se reintenta). */
export function suscripcionesHabilitadas(): Promise<boolean> {
  // El TTL es del RESULTADO, no de la promesa: un error no se cachea (lo maneja el body).
  if (promiseHabilitadas && Date.now() - habilitadasDesde < HABILITADAS_TTL_MS)
    return promiseHabilitadas;
  habilitadasDesde = Date.now();
  promiseHabilitadas = (async () => {
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

// ─── Empresa: puestos de una suscripción (miembros del equipo) ───

/** Miembros del equipo de una suscripción empresarial (RPC mis_miembros; RPC = función de la BD que se invoca por nombre). Ej: fetchMiembros(12) -> [{user_id, email, puede_editar, asignado_en}] o {error} con el código del server. */
export async function fetchMiembros(suscripcionId: number) {
  return await supabase.rpc('mis_miembros', { p_suscripcion_id: suscripcionId });
}

/** Asigna un puesto (asiento de un plan empresarial) a un correo con cuenta registrada (RPC asignar_puesto). Ej: asignarPuesto(12, 'ana@x.com'). El error.message es un código ('usuario_no_encontrado', 'sin_puestos_disponibles', ...) que la UI traduce. */
export async function asignarPuesto(suscripcionId: number, email: string) {
  return await supabase.rpc('asignar_puesto', {
    p_suscripcion_id: suscripcionId,
    p_email: email,
  });
}

/** Quita a un miembro del equipo de una suscripción empresarial (RPC quitar_puesto). Ej: quitarPuesto(12, 'uuid-del-miembro'). */
export async function quitarPuesto(suscripcionId: number, userId: string) {
  return await supabase.rpc('quitar_puesto', {
    p_suscripcion_id: suscripcionId,
    p_user_id: userId,
  });
}

/** Cambia si un miembro puede editar los proyectos de la empresa (RPC cambiar_permiso_miembro). Ej: cambiarPermisoMiembro(12, 'uuid', false) -> el miembro queda en solo lectura. */
export async function cambiarPermisoMiembro(
  suscripcionId: number,
  userId: string,
  puedeEditar: boolean,
) {
  return await supabase.rpc('cambiar_permiso_miembro', {
    p_suscripcion_id: suscripcionId,
    p_user_id: userId,
    p_puede_editar: puedeEditar,
  });
}

// ─── Pago: edge functions de Lemon Squeezy ───

/** Verifica el estado de un pago tras la vuelta del checkout (edge function verificar-pago: SOLO lee la fila propia, no activa nada). Ej: verificarPago('LS-123') -> {data:{aprobado:true, estado:'aprobada'}, error}. */
export async function verificarPago(referencia: string) {
  return await supabase.functions.invoke('verificar-pago', {
    body: { referencia },
  });
}

/** Pide la URL del checkout hosteado de Lemon Squeezy (edge function crear-checkout: calcula el total server-side desde app_precios e inserta la fila pendiente). Ej: crearCheckout(['flow'], 'anual', {flow:3}) -> {data:{checkoutUrl}, error}. */
export async function crearCheckout(
  modulos: ModuloId[],
  periodo: Periodo,
  puestos?: PuestosPorModulo,
) {
  return await supabase.functions.invoke('crear-checkout', {
    body: { modulos, periodo, puestosPorModulo: puestos ?? {} },
  });
}
