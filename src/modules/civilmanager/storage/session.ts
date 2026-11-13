import { supabase } from '../../../lib/supabase';

/**
 * Identidad para atribuir filas: quién está autenticado y quién es el DUEÑO del proyecto
 * activo (empresarial: un miembro edita el proyecto del dueño y las filas se sellan con
 * el user_id del dueño, no del miembro).
 */
export async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Empresarial: user_id del dueño del proyecto activo.
 *
 * Falla si la consulta no se puede resolver: con RLS bloqueando el SELECT, `.single()`
 * devuelve `{data: null, error}` y un `null` silencioso hacía que las filas se sellaran con
 * el user_id del MIEMBRO en vez del dueño (el dueño no las veía y el catálogo "duplicaba"
 * por usuario). El fallo de red y el caso "no hay dueño" ya no son indistinguibles.
 *
 * @param proyectoUid id del proyecto CM.
 * @returns el user_id del dueño.
 * @throws Error si la consulta falla o el proyecto no tiene dueño.
 */
export async function ownerIdProyectoActivo(proyectoUid: string): Promise<string> {
  const { data, error } = await supabase
    .from('cm_proyectos')
    .select('user_id')
    .eq('id', proyectoUid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.user_id) throw new Error('proyecto CM sin dueño');
  return data.user_id as string;
}
