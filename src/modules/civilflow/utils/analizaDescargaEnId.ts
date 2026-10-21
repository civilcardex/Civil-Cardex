import { splitPtr } from './claves.ts';

export function parseDescargaEnId(
  descargaEnId: string,
  fallbackPlanId: string | number | null,
): [string | number | null, string] {
  return splitPtr(descargaEnId, fallbackPlanId);
}
