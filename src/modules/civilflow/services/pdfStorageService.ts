import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';

const BUCKET = 'plan_pdfs';

function objectPath(userId: string, proyectoId: number, planId: number): string {
  return `${userId}/${proyectoId}/${planId}.pdf`;
}

export async function uploadPlanPDF(proyectoId: number, planId: number, file: File): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath(user.id, proyectoId, planId), file, { upsert: true, contentType: 'application/pdf' });
    if (error) devError('pdfStorageService upload:', error.message);
  } catch (e) {
    devError('pdfStorageService upload exception:', e);
  }
}

export async function downloadPlanPDF(proyectoId: number, planId: number, name: string): Promise<File | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
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

export async function deletePlanPDF(proyectoId: number, planId: number): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([objectPath(user.id, proyectoId, planId)]);
    if (error) devError('pdfStorageService delete:', error.message);
  } catch (e) {
    devError('pdfStorageService delete exception:', e);
  }
}
