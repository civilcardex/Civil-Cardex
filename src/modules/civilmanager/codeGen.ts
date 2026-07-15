/** Genera el siguiente código disponible para un prefijo dado (ej: "APU-004"), escaneando los códigos existentes. */
export function genCodeFor<T extends { codigo?: string }>(items: T[], prefix: string, codeOverride?: string, padLen = 3): string {
  if (codeOverride && String(codeOverride).trim()) return String(codeOverride).trim();
  const re = new RegExp(prefix + '-(\\d+)');
  const maxNum = items.reduce((m, item) => {
    const match = (item.codigo || '').match(re);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return prefix + '-' + String(maxNum + 1).padStart(padLen, '0');
}
