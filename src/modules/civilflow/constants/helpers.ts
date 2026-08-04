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

// The label a bajante actually renders with on the canvas (renderBajantes.ts) — code stripped of
// '#' and uppercased, plus the short floor suffix ("BAN1-P1", "MAF1-S2", "BALL1-C"). Reused by
// cross-floor association alerts so they quote the visual label, not the bare id/code.
export function buildBajanteVisualLabel(
  b: { code?: string | null; id?: string | null } | null | undefined,
  pisoCortoStr?: string,
): string {
  const code = (b?.code || '').replace(/#/g, '').toUpperCase();
  if (code) return `${code}${pisoCortoStr ? '-' + pisoCortoStr : ''}`;
  const id = (b?.id || '').replace(/#/g, '').toUpperCase();
  return `${id}${pisoCortoStr ? '-' + pisoCortoStr : ''}`;
}
