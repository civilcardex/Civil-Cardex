import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError.ts';
import { CF_TABLES } from '../constants/tableNames.ts';
import {} from './storageService.ts';
import { emitErrorGuardado } from '../../../utils/saveEvents.ts';

export interface ProyectoRow {
  /** Identificador único universal (uuid) del proyecto (cf_proyectos.id); mismo formato que cm_proyectos, para deep-links. */
  id: string;
  user_id: string;
  codigo: string;
  nombre: string;
  created_at?: string;
}

/** Mapea la fila cruda de BD a la forma del cliente (id uuid). */
function rowToProyecto(raw: Record<string, unknown>): ProyectoRow {
  return { ...(raw as unknown as ProyectoRow), id: String(raw.id) };
}

/** Tamaño de página del listado (el server paga por página; recorrer hasta el final). */
const PROYECTOS_PAGINA = 200;

/** Trae TODAS las páginas del listado (auditoría 2026-11-27: antes quedaba el proyecto 201
 *  invisible). Orden estable por (created_at, id) para que la paginación no salte filas. */
async function paginaProyectos(from: number): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from(CF_TABLES.proyectos)
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + PROYECTOS_PAGINA - 1);
  if (error) throw new Error(error.message);
  return (data as unknown as Record<string, unknown>[]) || [];
}

/** Variante estricta para flujos que deben distinguir "sin proyectos" de "fallo de red/BD":
 *  lanza en error del servidor o de red; solo devuelve [] cuando el usuario no tiene ninguno. */
export async function fetchProyectosOrThrow(): Promise<ProyectoRow[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('sin-sesion');
  // Sin filtro user_id: RLS devuelve propios + proyectos de la empresa (asiento activo).
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PROYECTOS_PAGINA) {
    const pagina = await paginaProyectos(from);
    out.push(...pagina);
    if (pagina.length < PROYECTOS_PAGINA || from > 20_000) break;
  }
  return out.map(rowToProyecto);
}

/**
 * Trae todos los proyectos del usuario autenticado, ordenados por más reciente.
 * @returns Arreglo de objetos ProyectoRow; arreglo vacío ante error o usuario no autenticado.
 */
export async function fetchProyectos(): Promise<ProyectoRow[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];

    // Sin filtro user_id: RLS devuelve propios + proyectos de la empresa (asiento activo).
    // Paginado completo (el .limit(200) dejaba fuera el proyecto 201+).
    const out: Record<string, unknown>[] = [];
    /* H-07 (remediación 2026-11-27): si falla una página TARDÍA se conservan las páginas
     * confirmadas (listado incompleto, sin duplicados por el orden estable); solo el fallo
     * de la PRIMERA página devuelve vacío — distingue cuenta vacía de fallo de red. */
    for (let from = 0; ; from += PROYECTOS_PAGINA) {
      try {
        const pagina = await paginaProyectos(from);
        out.push(...pagina);
        if (pagina.length < PROYECTOS_PAGINA || from > 20_000) break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (from === 0) {
          if (msg.includes('relation') || msg.includes('does not exist')) return [];
          devError('proyectosService fetch:', msg);
          return [];
        }
        devError(
          'proyectosService fetch (listado incompleto desde la página',
          from / PROYECTOS_PAGINA + 1,
          '):',
          msg,
        );
        break;
      }
    }

    return ((out as unknown as Record<string, unknown>[]) || []).map(rowToProyecto);
  } catch (e) {
    devError('proyectosService fetch exception:', e);
    return [];
  }
}

/** Resultado de crear proyecto: fila creada, o fallo con mensaje del RPC (p. ej.
 *  'suscripcion_requerida' cuando la BD tiene el gating activo y la suscripción venció). */
export type CreateProyectoResult = { ok: true; row: ProyectoRow } | { ok: false; msg: string };

/**
 * Crea un proyecto nuevo vía RPC SECURITY DEFINER y devuelve la fila insertada (el RPC
 * devuelve el row como jsonb; la validación de propiedad/texto la hace el servidor). Ver
 * supabase/migrations/20260813000002_rls_security_definer_writes.sql.
 * @param codigo - Código corto del proyecto.
 * @param nombre - Nombre legible del proyecto.
 * @param pais - País del perfil normativo.
 * @param uso - Tipo de uso del edificio.
 * @returns {ok:true, row} o {ok:false, msg} con el mensaje del RPC.
 */
export async function createProyecto(
  codigo: string,
  nombre: string,
  pais: string,
  uso: string,
): Promise<CreateProyectoResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { ok: false, msg: 'sin_sesion' };

    const { data, error } = await supabase.rpc('save_proyecto', {
      p_codigo: codigo,
      p_nombre: nombre,
      p_pais: pais,
      p_uso: uso,
    });

    if (error) {
      devError('proyectosService create rpc:', error.message);
      // '' colisiona con "ok pero vacío": los mensajes se propagan como { ok:false, msg }.
      return { ok: false, msg: error.message };
    }

    return { ok: true, row: rowToProyecto(data as unknown as Record<string, unknown>) };
  } catch (e) {
    devError('proyectosService create exception:', e);
    return { ok: false, msg: 'error_red' };
  }
}

/**
 * Actualiza el nombre mostrado de un proyecto existente vía RPC (validación y propiedad
 * server-side).
 * @param id - Clave primaria del proyecto.
 * @param nombre - Nuevo nombre mostrado.
 * @returns True si la actualización funcionó, false si no.
 */
export async function updateProyectoNombre(id: string, nombre: string): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return false;

    const { error } = await supabase.rpc('update_proyecto_nombre', {
      p_id: id,
      p_nombre: nombre,
    });

    if (error) {
      devError('proyectosService updateNombre rpc:', error.message);
      return false;
    }

    return true;
  } catch (e) {
    devError('proyectosService updateNombre exception:', e);
    return false;
  }
}

/**
 * Elimina un proyecto por id vía RPC (validación de propiedad server-side; el RPC borra
 * también sus dependencias en cascada, definidas en el esquema).
 * @param id - Clave primaria del proyecto.
 * @returns True si la eliminación funcionó, false si no.
 */
export async function deleteProyecto(id: string): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return false;

    const { error } = await supabase.rpc('delete_proyecto', { p_id: id });

    if (error) {
      devError('proyectosService delete rpc:', error.message);
      emitErrorGuardado('delete-proyecto', error.message);
      return false;
    }

    return true;
  } catch (e) {
    devError('proyectosService delete exception:', e);
    return false;
  }
}
