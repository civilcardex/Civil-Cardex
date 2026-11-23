import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError.ts';

/** Fila de la tabla cm_proyectos tal como la lee el cliente (proyecto del módulo CM (Civil Manager)). */
export interface CmProyectoRow {
  user_id?: string;
  id: string;
  codigo: string;
  nombre: string;
  created_at: string;
}

/** Lista los proyectos CM del usuario (más nuevo primero). Ej: 3 proyectos -> los 3 con su código para el selector. @returns filas o [] si falla la consulta. */
export async function fetchCmProyectos(cursor?: Pick<CmProyectoRow, 'created_at' | 'id'>) {
  const pageSize = 50;
  const query = supabase.from('cm_proyectos').select('id, user_id, codigo, nombre, created_at');
  const filtered = cursor
    ? query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      )
    : query;
  const { data, error } = await filtered
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);
  if (error) throw new Error(error.message);
  const page = data.slice(0, pageSize);
  const rows = page.flatMap((row) => (row.id ? [{ ...row, id: row.id }] : []));
  const last = rows.at(-1);
  return { rows, next: data.length > pageSize ? (last ?? null) : null };
}

/** Busca el proyecto por su ID (identificador) bajo las reglas de acceso de la base de datos. */
export async function fetchCmProyectoById(id: string): Promise<CmProyectoRow | null> {
  const { data, error } = await supabase
    .from('cm_proyectos')
    .select('id, user_id, codigo, nombre, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ? { ...data, id: data.id } : null;
}

/** Crea un proyecto CM para el usuario autenticado. Ej: createCmProyecto('P-001','Torre Norte') -> fila insertada. @returns la fila nueva o null si no hay sesión/falla. */
export async function createCmProyecto(
  codigo: string,
  nombre: string,
): Promise<CmProyectoRow | null> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id;
    if (!userId) {
      devError('createCmProyecto: no session');
      return null;
    }
    const { data, error } = await supabase
      .from('cm_proyectos')
      .insert({ user_id: userId, codigo, nombre })
      .select('id, user_id, codigo, nombre, created_at')
      .single();
    if (error) {
      devError('createCmProyecto:', error.message);
      return null;
    }
    return data as CmProyectoRow;
  } catch (e) {
    devError('createCmProyecto:', e);
    return null;
  }
}

/** Borra el proyecto CM por id (la BD elimina en cascada sus catálogos). Ej: borrar 'P-001' quita también sus APU. @returns true si el DELETE salió bien. */
export async function deleteCmProyecto(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('cm_proyectos').delete().eq('id', id);
    if (error) {
      devError('deleteCmProyecto:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    devError('deleteCmProyecto:', e);
    return false;
  }
}
