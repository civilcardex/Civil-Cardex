import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';

export interface ProyectoCoreData {
  pisos: unknown[];
  proy: unknown;
  mats: unknown;
  profs: unknown[];
  crits: unknown[];
}

export interface ProyectoDataRow extends Partial<ProyectoCoreData> {
  plans_meta?: unknown[];
}

export async function saveProyectoCoreData(proyectoId: number, core: ProyectoCoreData): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('proyecto_data')
      .upsert(
        { proyecto_id: proyectoId, user_id: user.id, ...core, updated_at: new Date().toISOString() },
        { onConflict: 'proyecto_id' }
      );
    if (error) devError('proyectoDataService saveCore:', error.message);
  } catch (e) {
    devError('proyectoDataService saveCore exception:', e);
  }
}

export async function saveProyectoPlansMeta(proyectoId: number, plansMeta: unknown[]): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('proyecto_data')
      .upsert(
        { proyecto_id: proyectoId, user_id: user.id, plans_meta: plansMeta, updated_at: new Date().toISOString() },
        { onConflict: 'proyecto_id' }
      );
    if (error) devError('proyectoDataService savePlansMeta:', error.message);
  } catch (e) {
    devError('proyectoDataService savePlansMeta exception:', e);
  }
}

export async function loadProyectoData(proyectoId: number): Promise<ProyectoDataRow | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('proyecto_data')
      .select('pisos, proy, mats, profs, crits, plans_meta')
      .eq('proyecto_id', proyectoId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      devError('proyectoDataService load:', error.message);
      return null;
    }
    return (data as ProyectoDataRow) || null;
  } catch (e) {
    devError('proyectoDataService load exception:', e);
    return null;
  }
}
