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
 * El paquete es el ALIAS `npm:xlsx-republish@0.20.3` (package.json) — un RE-PUBLISH comunitario
 * de SheetJS Community 0.20.3 (la 0.19+ del oficial ya no sale en npm: se distribuye por
 * cdn.sheetjs.com bajo licencia distinta). Existe porque las alternativas en npm traían
 * CVE-2023-30533 (prototype pollution) y CVE-2024-22363 (ReDoS) sin parche. Riesgo conocido
 * de supply chain (no es el canal oficial) — documentado en AGENTS/auditorías; sustituto
 * natural cuando haya release npm oficial.
 */
export async function loadXlsx(): Promise<typeof import('xlsx')> {
  return import('xlsx');
}
