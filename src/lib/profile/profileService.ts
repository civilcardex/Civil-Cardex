/** Perfil de la cuenta (datos personales del usuario: nombre, apellido, profesión, matrícula, teléfono). Transversal — no es de suscripciones ni de un módulo de cálculo. */
import { supabase } from '../supabase';

/** Cuerpo del RPC save_perfil (RPC = función de la BD que se invoca por nombre): el perfil EDITABLE completo, porque el RPC hace upsert del conjunto y los campos omitidos se rescriben a NULL. Ej: {nombre:'Ana', apellido:'Gómez', email:'ana@x.com', profesion:'Ingeniera Civil'}. */
export interface PerfilGuardable {
  email?: string | undefined;
  [campo: string]: unknown;
}

/** Trae la fila de perfil del usuario (tabla cf_perfiles, la misma que CF_TABLES.perfiles en modules/civilflow). Ej: fetchPerfil('uuid') -> {data:{nombre, apellido, ...}, error}. El que llama decide el reintento (p. ej. 401 por sesión vencida). */
export async function fetchPerfil(userId: string) {
  return await supabase.from('cf_perfiles').select('*').eq('id', userId).single();
}

/** Guarda el perfil completo (RPC save_perfil: upsert — se manda el perfil entero o los campos omitidos se rescriben a NULL). Ej: savePerfil({...perfil, email: user.email, telefono: '3101234567'}). */
export async function savePerfil(perfil: PerfilGuardable) {
  return await supabase.rpc('save_perfil', { p_perfil: perfil });
}
