import type { jsPDF as JsPDFType } from 'jspdf';

/** Carga perezosa de jsPDF + autotable en chunks separados (una sola descarga). */
export async function loadJspdf(): Promise<{
  jsPDF: typeof JsPDFType;
  autoTable: (doc: unknown, opts: unknown) => void;
}> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  return { jsPDF, autoTable: autoTable as (doc: unknown, opts: unknown) => void };
}

/** Carga perezosa de xlsx-js-style en chunk separado (una sola descarga). */
export async function loadXlsx(): Promise<typeof import('xlsx-js-style')> {
  return import('xlsx-js-style');
}
