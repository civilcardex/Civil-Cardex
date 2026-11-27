import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError.ts';
import { CF_TABLES } from '../constants/tableNames.ts';

const BUCKET = 'plan_pdfs';

/** Dueño resuelto por proyecto: el user_id del dueño no cambia en la sesión — cada
 *  upload/download/delete ahorraba un SELECT a cf_proyectos antes de tocar storage. */
const ownerCache = new Map<string, string>();

/**
 * Dueño (user_id) del proyecto: en proyectos de empresa el miembro que sube/descarga NO es
 * el dueño — la primera carpeta del bucket debe ser SIEMPRE la del dueño, o las policies
 * `pdfs_empresa_*` (que asumen dueño en carpeta 1) y las descargas del dueño no encuentran
 * el objeto. Fallback a `fallback` (uid de sesión) si la consulta falla o RLS oculta la fila
 * (un fallback NUNCA se cachea: el siguiente intento reconsulta — p.ej. tras ganar el asiento).
 * @param proyectoId id del proyecto (uuid).
 * @param fallback uid de sesión al que caer si no se puede resolver el dueño.
 */
async function ownerDe(proyectoId: string, fallback: string): Promise<string> {
  const hit = ownerCache.get(proyectoId);
  if (hit) return hit;
  try {
    const { data, error } = await supabase
      .from(CF_TABLES.proyectos)
      .select('user_id')
      .eq('id', proyectoId)
      .maybeSingle();
    if (error) {
      devError('pdfStorageService owner lookup:', error.message);
      return fallback;
    }
    const owner = (data as { user_id: string } | null)?.user_id;
    if (!owner) return fallback;
    ownerCache.set(proyectoId, owner);
    return owner;
  } catch {
    return fallback;
  }
}

/** Ruta del objeto: userId/proyectoId(uuid)/planId.pdf. */
function objectPath(userId: string, proyectoId: string, planId: number): string {
  return `${userId}/${proyectoId}/${planId}.pdf`;
}

/** Sube el PDF del plano al bucket. Lanza si la subida falla: el llamador reintenta y avisa.
 *  Tragar el error dejaba la fila de metadata en `cf_planos` sin binario — el visor abría
 *  sin lámina en otro dispositivo y nadie sabía por qué.
 *  @param proyectoId id del proyecto (uuid).
 *  @param planId id del plano.
 *  @param file archivo PDF.
 * @returns promesa resuelta cuando el archivo está subido.
 */
export async function uploadPlanPDF(proyectoId: string, planId: number, file: File): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('sin-sesion');

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath(await ownerDe(proyectoId, session.user.id), proyectoId, planId), file, {
        upsert: true,
        contentType: 'application/pdf',
      });
    if (error) throw new Error(error.message);
  } catch (e) {
    devError('pdfStorageService upload exception:', e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/** Descarga el PDF del plano del bucket (null si no existe o no hay sesión). Ej: al abrir el visor en otro dispositivo trae la lámina desde la nube. */
export async function downloadPlanPDF(
  proyectoId: string,
  planId: number,
  name: string,
): Promise<File | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(objectPath(await ownerDe(proyectoId, session.user.id), proyectoId, planId));
    if (error || !data) {
      if (error) devError('pdfStorageService download:', error.message);
      return null;
    }
    return new File([data], name, { type: 'application/pdf' });
  } catch (e) {
    devError('pdfStorageService download exception:', e);
    return null;
  }
}

/** Reintenta una operación de borrado (auditoría 2026-11-27, Alta 4): 3 intentos con espera
 *  creciente. true = sin error; false = agotados (la UI avisa al usuario). */
async function conReintentos(op: () => Promise<string | null>): Promise<boolean> {
  for (let intento = 1; intento <= 3; intento++) {
    /* H-06 (remediación 2026-11-27): un RECHAZO transitorio de red también cuenta como
     * intento fallido y consume su reintento — antes un throw cortaba el bucle entero. */
    let err: string | null;
    try {
      err = await op();
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    if (!err) return true;
    devError(`pdfStorageService delete (intento ${intento}/3):`, err);
    if (intento < 3) await new Promise((r) => setTimeout(r, 250 * intento));
  }
  return false;
}

/** Borra la fila de metadatos del plano en cf_planos vía RPC dueño-only. La limpieza legítima
 *  de un plano eliminado va POR AQUÍ: el autosave con lista vacía ya no borra nada en BD
 *  (save_planos_meta con lista vacía es no-op — migración 20260918000000).
 *  @returns true si el RPC respondió sin error. */
export async function deletePlanMeta(planId: number): Promise<boolean> {
  try {
    return await conReintentos(async () => {
      const { error } = await supabase.rpc('delete_plano_meta', { p_plano_id: planId });
      return error ? error.message : null;
    });
  } catch (e) {
    devError('pdfStorageService deletePlanMeta exception:', e);
    return false;
  }
}

/** Borra el binario del bucket (par de deletePlanMeta). Ej: al eliminar un plano, se van fila
 *  de metadatos y PDF.
 *  @returns true si Storage respondió sin error (y había sesión). */
export async function deletePlanPDF(proyectoId: string, planId: number): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return false;
    const ruta = objectPath(await ownerDe(proyectoId, session.user.id), proyectoId, planId);
    return await conReintentos(async () => {
      const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
      return error ? error.message : null;
    });
  } catch (e) {
    devError('pdfStorageService delete exception:', e);
    return false;
  }
}
