import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';

const BUCKET = 'plan_pdfs';

function objectPath(userId: string, proyectoId: number, planId: number): string {
  return `${userId}/${proyectoId}/${planId}.pdf`;
}

export async function uploadPlanPDF(proyectoId: number, planId: number, file: File): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath(user.id, proyectoId, planId), file, {
        upsert: true,
        contentType: 'application/pdf',
      });
    if (error) devError('pdfStorageService upload:', error.message);
  } catch (e) {
    devError('pdfStorageService upload exception:', e);
  }
}

export async function downloadPlanPDF(
  proyectoId: number,
  planId: number,
  name: string,
): Promise<File | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(objectPath(user.id, proyectoId, planId));
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

/** Borra la fila de metadatos del plano en cf_planos vía RPC dueño-only. La limpieza legítima
 *  de un plano eliminado va POR AQUÍ: el autosave con lista vacía ya no borra nada en BD
 *  (save_planos_meta con lista vacía es no-op — migración 20260918000000). */
export async function deletePlanMeta(planId: number): Promise<void> {
  try {
    const { error } = await supabase.rpc('delete_plano_meta', { p_plano_id: planId });
    if (error) devError('pdfStorageService deletePlanMeta:', error.message);
  } catch (e) {
    devError('pdfStorageService deletePlanMeta exception:', e);
  }
}

export async function deletePlanPDF(proyectoId: number, planId: number): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([objectPath(user.id, proyectoId, planId)]);
    if (error) devError('pdfStorageService delete:', error.message);
  } catch (e) {
    devError('pdfStorageService delete exception:', e);
  }
}
