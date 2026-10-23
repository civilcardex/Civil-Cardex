import { diamPulgFromLabel } from '../diamInchesFromLabel.ts';
import { computeBushingCounts } from '../sanFittingsCatalog.ts';
import { dropAllZeroColumns, type MemoriaTable } from '../exportReportFinal.ts';
import type { RamalDibujo, TribDibujo, BajanteDibujo } from './collection';

/** Arma las filas de la tabla (totales por diámetro) y la devuelve lista para pintar. */
export function armarTabla(
  net: 'san' | 'll' | 'af' | 'ac' | 'gas',
  title: string,
  summaryCatalog: { id: string; nombre: string }[],
  totals: Record<string, Record<string, number>>,
  bajanteBushing: Record<string, number>,
  pulgById: Record<string, number>,
  drawingRamales: RamalDibujo[],
  tribDrawing: TribDibujo[],
  bajanteDrawing: BajanteDibujo[],
): MemoriaTable | null {
  const totalsByDiameter = Object.entries(totals)
    .map(([diametro, accesorios]) => ({ diametro, accesorios }))
    .filter((row) => Object.values(row.accesorios).some((count) => count > 0))
    .sort((a, b) => {
      const aMain = a.diametro.split('×')[0].trim();
      const bMain = b.diametro.split('×')[0].trim();
      return diamPulgFromLabel(bMain) - diamPulgFromLabel(aMain);
    });

  if (totalsByDiameter.length === 0) return null;

  // F2 + Bug 2: diámetros presentes y conteo REAL de bushings (af/ac/gas) — cada conexión de un
  // ramal menor contra un elemento mayor (ramal o bajante) es una reducción. Los menores
  // incluyen tributarios (el brazo de una tee casi siempre lo es); los mayores son los ramales
  // y bajantes del dibujo.
  let diamsPresent: string[] | undefined;
  let bushingCounts: Record<string, number> | undefined;
  if (net === 'af' || net === 'ac' || net === 'gas') {
    const seen = new Set<number>();
    for (const r of drawingRamales) {
      const p = diamPulgFromLabel(r.diametro) || pulgById[r.id] || 0;
      if (p > 0) seen.add(p);
    }
    if (seen.size >= 2) diamsPresent = [...seen].sort((a, b) => b - a).map(String);
    const minors = [
      ...drawingRamales.map((r) => ({ id: r.id, diametro: r.diametro, pts: r.pts })),
      ...tribDrawing.map((r) => ({ id: r.id, diametro: r.diametro, pts: r.pts })),
    ];
    const majors = drawingRamales.map((r) => ({ id: r.id, diametro: r.diametro, pts: r.pts }));
    // 14.3: exclude bajante with 1-2 ramales (handled via bajanteBushing) from generic bushing to avoid double count
    const filteredBajantes = bajanteDrawing.filter((b) => {
      const bNet = b.net || net;
      if (bNet !== net) return true;
      const c = b.recibeDeIds?.length || 0;
      return c === 0 || c > 2;
    });
    const counts = computeBushingCounts(minors, majors, filteredBajantes);
    if (Object.keys(counts).length > 0) bushingCounts = counts;
  }
  // Merge bajante bushing (any net) — spec 14.3, reuse bushing pseudo
  if (Object.keys(bajanteBushing).length > 0) {
    if (!bushingCounts) bushingCounts = {};
    for (const [k, v] of Object.entries(bajanteBushing)) {
      bushingCounts[k] = (bushingCounts[k] || 0) + v;
    }
    // Ensure diamsPresent includes bajante diams for any net
    const seenBaj = new Set<number>();
    for (const b of bajanteDrawing as Array<{ diametro: string; net?: string }>) {
      if ((b.net || net) !== net) continue;
      const p = diamPulgFromLabel(b.diametro);
      if (p > 0) seenBaj.add(p);
    }
    for (const r of [...drawingRamales, ...tribDrawing] as Array<{ diametro: string }>) {
      const p = diamPulgFromLabel(r.diametro);
      if (p > 0) seenBaj.add(p);
    }
    if (seenBaj.size >= 2) {
      const sorted = [...seenBaj].sort((a, b) => b - a).map(String);
      if (!diamsPresent) diamsPresent = sorted;
      else {
        const merged = new Set([...diamsPresent.map(Number), ...sorted.map(Number)]);
        diamsPresent = [...merged].sort((a, b) => b - a).map(String);
      }
    }
  }

  const headers = ['Diámetro', ...summaryCatalog.map((a) => a.nombre), 'Total'];
  const rows = totalsByDiameter.map((row) => {
    const total = Object.values(row.accesorios).reduce((s, n) => s + n, 0);
    return [row.diametro, ...summaryCatalog.map((a) => row.accesorios[a.id] || 0), total];
  });

  return dropAllZeroColumns(
    {
      title,
      headers,
      rows,
      ...(diamsPresent ? { diamsPresent } : {}),
      ...(bushingCounts ? { bushingCounts } : {}),
    },
    1,
    1,
  );
}
