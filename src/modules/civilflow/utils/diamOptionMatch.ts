/**
 * Resuelve un diámetro crudo (como se guarda en el ramal: `1-1/2"`, `1/2" RDE 9`, o el valor
 * completo `1-1/2" — 42.7 mm`) al valor canónico de la opción correspondiente de DIAM_BY_MAT.
 * Sin este ajuste, el diámetro heredado del ramal no coincidía con ninguna opción del
 * selector y se veía en blanco.
 */
export function matchDiamOption(
  diamList: Array<{ n: string }>,
  raw: string | undefined | null,
): string {
  if (!diamList || diamList.length === 0 || !raw) return '';
  const direct = diamList.find((d) => d.n === raw);
  if (direct) return direct.n;
  const base = raw.split(' — ')[0].trim();
  const byBase = diamList.find((d) => d.n.split(' — ')[0].trim() === base);
  if (byBase) return byBase.n;
  // Sin match por base (p. ej. gas que normaliza a "1/2\" (13 mm)"): resolver por pulgada
  // inicial completa, cuidando no mezclar 1/2" con 1-1/4" ni 1" con 10".
  const first = raw.match(/^\d+(?:-\d+)?(?:\/\d+)?(?:\.\d+)?"/)?.[0] || '';
  const byPulg = first ? diamList.find((d) => d.n.startsWith(first)) : undefined;
  return byPulg ? byPulg.n : '';
}
