import type { IPlanoEngineCore } from './PlanoState';

function sameNet(a: string, b: string): boolean {
  return a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
}

function collectVectorsAtPoint(
  engine: IPlanoEngineCore,
  pt: number[],
  net: string,
): { x: number; y: number }[] {
  const TOL = 0.5;
  const vectors: { x: number; y: number }[] = [];
  for (const r of engine.ramales) {
    if (!sameNet(r.net, net)) continue;
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length; i++) {
      if (Math.hypot(r.pts[i][0] - pt[0], r.pts[i][1] - pt[1]) < TOL) {
        if (i > 0) {
          const dx = r.pts[i - 1][0] - pt[0];
          const dy = r.pts[i - 1][1] - pt[1];
          const len = Math.hypot(dx, dy);
          if (len > 0.1) vectors.push({ x: dx / len, y: dy / len });
        }
        if (i < r.pts.length - 1) {
          const dx = r.pts[i + 1][0] - pt[0];
          const dy = r.pts[i + 1][1] - pt[1];
          const len = Math.hypot(dx, dy);
          if (len > 0.1) vectors.push({ x: dx / len, y: dy / len });
        }
      }
    }
  }
  const uniq: typeof vectors = [];
  for (const v of vectors) {
    if (!uniq.some((u) => u.x * v.x + u.y * v.y > 0.99)) uniq.push(v);
  }
  return uniq;
}

export function hasTeeAtPoint(engine: IPlanoEngineCore, pt: number[], net: string): boolean {
  const vecs = collectVectorsAtPoint(engine, pt, net);
  return vecs.length >= 3;
}

export function fixVentCodoToTee(engine: IPlanoEngineCore): void {
  // Vent: any codo at a point that is now a T (3+ vectors) must become T / disappear — no codo remains
  const ventRamales = engine.ramales.filter((r) => r.net === 'vent');
  for (const r of ventRamales) {
    if (!r.pts) continue;
    // interior accMed codos — delete, let renderJunctions draw geometric T
    if (r.accMed) {
      for (const key of Object.keys(r.accMed)) {
        const m = key.match(/^accMed(\d+)$/);
        if (!m) continue;
        const idx = parseInt(m[1], 10);
        const pt = r.pts[idx];
        if (!pt) continue;
        const acc = r.accMed[key];
        if (!acc || !acc.toLowerCase().includes('codo')) continue;
        if (hasTeeAtPoint(engine, pt, r.net)) {
          delete r.accMed[key];
        }
      }
    }
    // endpoint codos — clear, geometric T will be drawn
    const checkEndpoint = (field: 'accesorioInicio' | 'accesorioFin', idx: number) => {
      const acc = r[field] as string | undefined;
      if (!acc || !acc.toLowerCase().includes('codo')) return;
      const pt = r.pts[idx];
      if (!pt) return;
      if (hasTeeAtPoint(engine, pt, r.net)) {
        r[field] = '';
      }
    };
    if (r.pts.length >= 2) {
      checkEndpoint('accesorioInicio', 0);
      checkEndpoint('accesorioFin', r.pts.length - 1);
    }
  }
}
