import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';

export interface ProyectoRow {
  id: number;
  user_id: string;
  codigo: string;
  nombre: string;
  created_at?: string;
}

/**
 * Trae todos los proyectos del usuario autenticado, ordenados por más reciente.
 * @returns Arreglo de objetos ProyectoRow; arreglo vacío ante error o usuario no autenticado.
 */
export async function fetchProyectos(): Promise<ProyectoRow[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (
        error.code === 'PGRST116' ||
        error.message?.includes('relation') ||
        error.message?.includes('does not exist')
      ) {
        return [];
      }
      devError('proyectosService fetch:', error.message);
      return [];
    }

    return (data as ProyectoRow[]) || [];
  } catch (e) {
    devError('proyectosService fetch exception:', e);
    return [];
  }
}

/**
 * Crea un proyecto nuevo vía RPC SECURITY DEFINER y devuelve la fila insertada (el RPC
 * devuelve el row como jsonb; la validación de propiedad/texto la hace el servidor). Ver
 * supabase/migrations/20260813000002_rls_security_definer_writes.sql.
 * @param codigo - Código corto del proyecto.
 * @param nombre - Nombre legible del proyecto.
 * @returns ProyectoRow insertado o null ante fallo.
 */
export async function createProyecto(codigo: string, nombre: string): Promise<ProyectoRow | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.rpc('save_proyecto', {
      p_codigo: codigo,
      p_nombre: nombre,
    });

    if (error) {
      devError('proyectosService create rpc:', error.message);
      return null;
    }

    return data as unknown as ProyectoRow;
  } catch (e) {
    devError('proyectosService create exception:', e);
    return null;
  }
}

/**
 * Actualiza el nombre mostrado de un proyecto existente vía RPC (validación y propiedad
 * server-side).
 * @param id - Clave primaria del proyecto.
 * @param nombre - Nuevo nombre mostrado.
 * @returns True si la actualización funcionó, false si no.
 */
export async function updateProyectoNombre(id: number, nombre: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

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
export async function deleteProyecto(id: number): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase.rpc('delete_proyecto', { p_id: id });

    if (error) {
      devError('proyectosService delete rpc:', error.message);
      return false;
    }

    return true;
  } catch (e) {
    devError('proyectosService delete exception:', e);
    return false;
  }
}
