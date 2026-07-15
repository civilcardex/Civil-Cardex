export function parseDescargaEnId(descargaEnId: string, fallbackPlanId: string | number | null): [string | number | null, string] {
  return descargaEnId.includes('|') ? (descargaEnId.split('|') as [string, string]) : [fallbackPlanId, descargaEnId];
}
