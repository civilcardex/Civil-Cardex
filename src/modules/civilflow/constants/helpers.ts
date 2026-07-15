export function pisoLbl(n: number) {
  if (n < 0) return `Sótano ${Math.abs(n)}`;
  if (n === 99) return `Cubierta`;
  return `Piso ${n}`;
}

export function pisoCorto(n: number) {
  if (n < 0) return `S${Math.abs(n)}`;
  if (n === 99) return `C`;
  return `P${n}`;
}

export function pisoCortoLoose(v: unknown): string {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (isNaN(n)) return '';
  return pisoCorto(n);
}
