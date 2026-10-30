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
export async function fetchCmProyectos(): Promise<CmProyectoRow[]> {
  try {
    const { data, error } = await supabase
      .from('cm_proyectos')
      .select('id, user_id, codigo, nombre, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      devError('fetchCmProyectos:', error.message);
      return [];
    }
    return (data as CmProyectoRow[]) || [];
  } catch (e) {
    devError('fetchCmProyectos:', e);
    return [];
  }
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
