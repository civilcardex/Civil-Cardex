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

/**
 * Carga perezosa de SheetJS (xlsx) en chunk separado (una sola descarga).
 *
 * Se usa el SheetJS OFICIAL 0.20.3 (servido desde cdn.sheetjs.com: la versión de npm está
 * clavada en 0.18.5 por licencias). El fork `xlsx-js-style` empaquetaba esa 0.18.5, con
 * CVE-2023-30533 (prototype pollution) y CVE-2024-22363 (ReDoS) sin aviso en npm audit.
 */
export async function loadXlsx(): Promise<typeof import('xlsx')> {
  return import('xlsx');
}
