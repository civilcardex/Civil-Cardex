import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';

export interface CmProyectoRow {
  id: string;
  codigo: string;
  nombre: string;
  created_at: string;
}

export async function fetchCmProyectos(): Promise<CmProyectoRow[]> {
  try {
    const { data, error } = await supabase
      .from('cm_proyectos')
      .select('id, codigo, nombre, created_at')
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
      .select('id, codigo, nombre, created_at')
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
