import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';

export interface ProyectoRow {
  id: number;
  user_id: string;
  codigo: string;
  nombre: string;
  created_at?: string;
}

export async function fetchProyectos(): Promise<ProyectoRow[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
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

export async function createProyecto(codigo: string, nombre: string): Promise<ProyectoRow | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('proyectos')
      .insert({ codigo, nombre, user_id: user.id })
      .select()
      .single();

    if (error) {
      devError('proyectosService create:', error.message);
      return null;
    }

    return data as ProyectoRow;
  } catch (e) {
    devError('proyectosService create exception:', e);
    return null;
  }
}

export async function updateProyectoNombre(id: number, nombre: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('proyectos')
      .update({ nombre })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      devError('proyectosService updateNombre:', error.message);
      return false;
    }

    return true;
  } catch (e) {
    devError('proyectosService updateNombre exception:', e);
    return false;
  }
}

export async function deleteProyecto(id: number): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('proyectos')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      devError('proyectosService delete:', error.message);
      return false;
    }

    return true;
  } catch (e) {
    devError('proyectosService delete exception:', e);
    return false;
  }
}
