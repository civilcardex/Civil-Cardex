/** Catálogo de rejillas visto desde el PAÍS del proyecto (ped. usuario 2026-11-17): la
 *  división Nacionales/Importadas es RELATIVA — en Colombia Silplas/Grival/Laminaire son
 *  nacionales y Koolair/TROX importadas; en cualquier otro país (PE/EC/CL/AR/BO) TODAS son
 *  importadas (no hay catálogos locales cargados aún — cuando lleguen, se agregan aquí por
 *  país). Usa perfilDe (fallback Colombia para país vacío/desconocido).
 *  Ej: catalogoRejillasDe('Perú') → Silplas 510-1025 con origen 'importado'. */
import { perfilDe } from '../countryStandards.ts';
import { CATALOGO_BASE, type RejRef } from './index.ts';

export function catalogoRejillasDe(pais: string | undefined): RejRef[] {
  if (perfilDe(pais).id === 'CO') return CATALOGO_BASE;
  return CATALOGO_BASE.map((r) => ({ ...r, origen: 'importado' as const }));
}
