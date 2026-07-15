import { APARATOS_DEF } from "../constants";

export const GAS_APPARATUS = APARATOS_DEF.filter(
  (a) => a.grupo === "g" && (a.qgas || 0) > 0
);

export function renouardByType(counts: Record<string, number>) {
  const present = [];
  for (const ap of GAS_APPARATUS) {
    const n = counts[ap.id] || 0;
    if (n > 0) present.push({ q: ap.qgas, n });
  }
  const sorted = present.sort((a, b) => b.q - a.q);
  const nTypes = sorted.length;
  if (nTypes === 0) return 0;
  if (nTypes === 1) return (sorted[0].q * sorted[0].n) / 2;
  if (nTypes === 2) return ((sorted[0].q * sorted[0].n) + (sorted[1].q * sorted[1].n)) / 2;
  const part1 = ((sorted[0].q * sorted[0].n) + (sorted[1].q * sorted[1].n)) / 2;
  const qMayor2 = sorted[1].q;
  const part2 = sorted.slice(2).filter(p => p.q < qMayor2).reduce((s, p) => s + p.q * p.n, 0);
  return part1 + part2;
}
