export function getTributarioIds(tramos: Array<{ recibeDe?: string[]; descripcion?: string }>): Set<string> {
  const tribSet = new Set<string>();
  for (const t of tramos) {
    if (t.recibeDe) {
      for (const id of t.recibeDe) tribSet.add(id);
    }
    if (t.descripcion) {
      const ids = t.descripcion.split('+').map(s => s.trim()).filter(Boolean);
      for (const id of ids) tribSet.add(id);
    }
  }
  return tribSet;
}
