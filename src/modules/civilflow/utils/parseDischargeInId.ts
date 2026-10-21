import { splitPtr } from './keys.ts';

export function parseDescargaEnId(
  descargaEnId: string,
  fallbackPlanId: string | number | null,
): [string | number | null, string] {
  return splitPtr(descargaEnId, fallbackPlanId);
}
