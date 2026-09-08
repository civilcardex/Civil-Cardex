import { describe, it, expect } from 'vitest';
import {
  autoAdjustGuide,
  netAllowedSteps,
} from '../../../components/pdfViewer/drawingElementContextMenu/guideOps';
import type { PlanoRamal, PlanoGuideLine } from '../PlanoState';
import type PlanoEngine from '../PlanoEngine';

// Menú de guía rework: UNA opción "Ajustar a XX°" auto-orientada. El sistema agrega el
// segmento de conexión desde el extremo de la guía a XX° respecto al ramal cruzado; el
// segmento original queda intacto y el punto real de conexión lo calcula el sistema.
const R = (o: Partial<PlanoRamal> & { id: string }): PlanoRamal =>
  ({
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
    ],
    totalL: 0,
    label: o.id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

function makeEngine(ramales: PlanoRamal[], guides: PlanoGuideLine[]) {
  const alerts: string[] = [];
  const engine = {
    ramales,
    bajantes: [],
    guideLines: guides,
    snapMode: true,
    render: () => {},
    _markDirty: () => {},
    triggerAlert: (t: string, m: string) => alerts.push(`${t}|${m}`),
  };
  return { eng: engine as unknown as PlanoEngine, alerts };
}

/** Ángulo relativo (grados 0..180) entre el último segmento de la guía y el host. */
function lastSegRelAngle(pts: [number, number][], host: PlanoRamal): number {
  const [p, q] = [pts[pts.length - 2], pts[pts.length - 1]];
  const g = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
  const [h0, h1] = [host.pts![0], host.pts![1]];
  const h = (Math.atan2(h1[1] - h0[1], h1[0] - h0[0]) * 180) / Math.PI;
  const diff = Math.abs(((g - h) % 180) + 180) % 180;
  return Math.min(diff, 180 - diff);
}

/** ¿El último punto de la guía cae sobre el cuerpo del host (a <2 unid)? */
function endsOnHost(pts: [number, number][], host: PlanoRamal): boolean {
  const last = pts[pts.length - 1];
  for (let i = 0; i < host.pts!.length - 1; i++) {
    const [ax, ay] = host.pts![i];
    const [bx, by] = host.pts![i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) continue;
    const t = Math.max(0, Math.min(1, ((last[0] - ax) * dx + (last[1] - ay) * dy) / lenSq));
    if (Math.hypot(last[0] - (ax + t * dx), last[1] - (ay + t * dy)) < 2.0) return true;
  }
  return false;
}

describe('netAllowedSteps — etiqueta única por red', () => {
  it('san/ll/vent → 45, af/ac/gas → 90', () => {
    expect(netAllowedSteps('san')).toEqual([45]);
    expect(netAllowedSteps('ll')).toEqual([45]);
    expect(netAllowedSteps('vent')).toEqual([45]);
    expect(netAllowedSteps('af')).toEqual([90]);
    expect(netAllowedSteps('ac')).toEqual([90]);
    expect(netAllowedSteps('gas')).toEqual([90]);
  });
});

describe('autoAdjustGuide — ajuste auto-orientado', () => {
  it('san: guía que cruza un ramal vertical → re-angulada a 45° aterrizando en el trazo', () => {
    const ramal = R({
      id: 'RS1',
      pts: [
        [50, 0],
        [50, 100],
      ],
    });
    const guide = {
      id: 'GL1',
      net: 'san',
      pts: [
        [0, 30],
        [70, 45],
      ],
    } as PlanoGuideLine;
    const { eng, alerts } = makeEngine([ramal], [guide]);
    autoAdjustGuide(eng, guide, () => {}, null);
    expect(alerts).toEqual([]);
    const pts = (eng.guideLines.find((g) => g.id === 'GL1') || guide).pts;
    // La guía se re-angula alrededor de su vértice de llegada y aterriza EN el trazo: el
    // pedazo que cruzaba (y sobraba) desaparece.
    expect(pts.length).toBe(2);
    expect(pts[0]).toEqual([0, 30]);
    expect(lastSegRelAngle(pts, ramal)).toBeCloseTo(45, 0);
    expect(endsOnHost(pts, ramal)).toBe(true);
    expect(pts[1][0]).toBeCloseTo(50, 6);
  });

  it('gas: re-angulada a 90° aterrizando en el trazo', () => {
    const ramal = R({
      id: 'RG1',
      net: 'gas',
      pts: [
        [0, 100],
        [100, 100],
      ],
    });
    const guide = {
      id: 'GL1',
      net: 'gas',
      pts: [
        [20, 140],
        [70, 80],
      ],
    } as PlanoGuideLine;
    const { eng, alerts } = makeEngine([ramal], [guide]);
    autoAdjustGuide(eng, guide, () => {}, null);
    expect(alerts).toEqual([]);
    const pts = (eng.guideLines.find((g) => g.id === 'GL1') || guide).pts;
    expect(pts.length).toBe(2);
    expect(pts[0]).toEqual([20, 140]);
    expect(lastSegRelAngle(pts, ramal)).toBeCloseTo(90, 0);
    expect(endsOnHost(pts, ramal)).toBe(true);
    expect(pts[1][1]).toBeCloseTo(100, 6);
  });

  it('multisegmento: el vértice anterior se conserva y el último segmento aterriza a 45°', () => {
    const ramal = R({
      id: 'RS1',
      pts: [
        [50, 0],
        [50, 100],
      ],
    });
    const guide = {
      id: 'GL1',
      net: 'san',
      pts: [
        [0, 30],
        [40, 36],
        [70, 45],
      ],
    } as PlanoGuideLine;
    const { eng, alerts } = makeEngine([ramal], [guide]);
    autoAdjustGuide(eng, guide, () => {}, null);
    expect(alerts).toEqual([]);
    const pts = (eng.guideLines.find((g) => g.id === 'GL1') || guide).pts;
    expect(pts.length).toBe(3);
    expect(pts[0]).toEqual([0, 30]);
    expect(pts[1]).toEqual([40, 36]);
    expect(lastSegRelAngle(pts, ramal)).toBeCloseTo(45, 0);
    expect(endsOnHost(pts, ramal)).toBe(true);
  });

  it('sin cruce: alerta y guía sin cambios', () => {
    const ramal = R({
      id: 'RS1',
      pts: [
        [500, 500],
        [500, 600],
      ],
    });
    const guide = {
      id: 'GL1',
      net: 'san',
      pts: [
        [0, 0],
        [10, 0],
      ],
    } as PlanoGuideLine;
    const { eng, alerts } = makeEngine([ramal], [guide]);
    autoAdjustGuide(eng, guide, () => {}, null);
    expect(alerts.length).toBe(1);
    expect(alerts[0]).toContain('Sin cruce');
    expect(guide.pts).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });
});
