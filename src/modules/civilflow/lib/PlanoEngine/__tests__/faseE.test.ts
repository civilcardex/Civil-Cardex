import { describe, it, expect, beforeEach } from 'vitest';
import { asociarRamalABajantes } from '../drawingUtils';
import { applyBajanteAssociation } from '../../../utils/bajanteAssociation';
import { copyDrawingFromPlan } from '../../../utils/copyDrawingFromPlan';
import { updateSelected } from '../PlanoEngineSelection';
import type { IPlanoEngineCore } from '../PlanoState';

// Fase E: (1) ramal desde caja recortado al BORDE siguiendo la dirección del usuario;
// (8) canal↔bajante ll entre pisos crea fantasma+Ldesvio; (B) LD no admite diámetro mayor
// al del bajante.

function makeEngine(loadedPlanId: string): IPlanoEngineCore {
  const alerts: Array<{ title: string; msg: string }> = [];
  return {
    _loadedPlanId: loadedPlanId,
    ramales: [],
    bajantes: [],
    crossFloorGhosts: [],
    areas: [],
    textAnnots: [],
    multiSel: [],
    tool: 'sel',
    _hiddenNets: new Set<string>(),
    zoom: 1,
    scaleM: 0.5,
    nivelActual: { label: 'S1', n: -1, npt: 1600 },
    cmToPlanePx: (cm: number) => cm * 0.5, // caja exterior 100cm → semilado 50 unid.
    updateElementById: () => {},
    updateSelected: () => {},
    triggerAlert: (title: string, msg: string) => alerts.push({ title, msg }),
    _emitSelect: () => {},
    render: () => {},
    _markDirty: () => {},
    alerts,
  } as unknown as IPlanoEngineCore;
}

const read = (planId: string) =>
  JSON.parse(localStorage.getItem('civilflow_trazos_' + planId) || '{}') as {
    ramales?: Array<{ id: string; pts?: number[][] }>;
    bajantes?: Array<{ id: string; desplazamientos?: Record<string, unknown> }>;
    crossFloorGhosts?: Array<{ id: string; targetBajanteId?: string }>;
  };

beforeEach(() => localStorage.clear());

describe('punto 1 — ramal desde caja recortado al borde', () => {
  it('pts[0] queda en el borde de la caja, en la dirección dibujada por el usuario', () => {
    const eng = makeEngine('1');
    // Caja en (0,0); semilado = cmToPlanePx(100)/2 = 50. Ramal dibujado diagonal desde el
    // centro hacia (100,100): el borde está a t = 50/max(0.707,0.707) ≈ 70.71.
    const caja = {
      id: 'CAN1',
      net: 'san',
      tipo: 'caja_san',
      x: 0,
      y: 0,
      recibeDeIds: [],
      alimentaIds: [],
    };
    const r = {
      id: 'RS1',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [100, 100],
      ] as number[][],
      recibeDeIds: [] as string[],
      alimentaIds: [] as string[],
      ini: '',
      fin: '',
      diametro: '',
    };
    eng.bajantes.push(caja as never);
    eng.ramales.push(r as never);

    const res = asociarRamalABajantes(eng, r as never, false);
    expect(res.rejected).toBe(false);
    expect(r.ini).toBe('CAN1');
    // pts[0] sobre la ESQUINA del cuadro (semilado 25, diagonal): 25/√2·√2 = 25 por eje.
    expect(r.pts[0][0]).toBeCloseTo(25, 1);
    expect(r.pts[0][1]).toBeCloseTo(25, 1);
    // Dirección preservada: pts[1] intacto.
    expect(r.pts[1]).toEqual([100, 100]);
    void eng;
  });
});

describe('punto 8 — canal↔bajante ll entre pisos (fantasma + Ldesvio)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'civilflow_trazos_9',
      JSON.stringify({
        ramales: [],
        bajantes: [{ id: 'CALL1', net: 'll', tipo: 'canal', x: 100, y: 80 }],
      }),
    );
    localStorage.setItem(
      'civilflow_trazos_8',
      JSON.stringify({
        ramales: [],
        bajantes: [{ id: 'BALL1', net: 'll', tipo: 'bajante', x: 300, y: 200 }],
      }),
    );
  });

  it('desalineados: fantasma en el piso superior + Ldesvio en el inferior (red ll)', () => {
    const eng = makeEngine('9');
    applyBajanteAssociation(
      eng,
      {
        planId: '9',
        id: 'CALL1',
        x: 100,
        y: 80,
        net: 'll',
        dNominal: '8"',
        code: 'CALL1',
        nivelN: 3,
        npt: 9600,
        tipo: 'canal',
      },
      {
        planId: '8',
        id: 'BALL1',
        x: 300,
        y: 200,
        net: 'll',
        dNominal: '4"',
        code: 'BALL1',
        nivelN: 1,
        npt: 3200,
      },
      [
        { id: '8', status: 'confirmed' },
        { id: '9', status: 'confirmed' },
      ] as never,
    );
    const lower = read('8');
    const upper = read('9');
    expect(lower.ramales?.some((r) => r.id === 'LD_CALL1')).toBe(true);
    expect(
      Object.values(
        (lower.bajantes?.find((b) => b.id === 'BALL1')?.desplazamientos || {}) as Record<
          string,
          { Ldesvio?: string }
        >,
      ).some((d) => d.Ldesvio === 'LD_CALL1'),
    ).toBe(true);
    expect(upper.crossFloorGhosts?.some((g) => g.targetBajanteId === 'CALL1')).toBe(true);
  });
});

describe('adición B — LD de bomba: diámetro acotado al bajante', () => {
  function ldEngine(): IPlanoEngineCore {
    const eng = makeEngine('1');
    (eng as unknown as { selId: string }).selId = 'LD_BAN1';
    eng.ramales.push({
      id: 'LD_BAN1',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [10, 0],
      ],
      diametro: '2"',
    } as never);
    eng.bajantes.push({ id: 'BAN1', net: 'san', dNominal: '4"' } as never);
    return eng;
  }

  it('diámetro mayor al bajante: bloqueado con alerta', () => {
    const eng = ldEngine();
    updateSelected(eng as never, { diametro: '6"' });
    const ld = eng.ramales[0] as { diametro?: string };
    expect(ld.diametro).toBe('2"'); // sin cambio
    expect((eng as unknown as { alerts: unknown[] }).alerts.length).toBe(1);
  });

  it('diámetro menor o igual: permitido', () => {
    const eng = ldEngine();
    updateSelected(eng as never, { diametro: '3"' });
    const ld = eng.ramales[0] as { diametro?: string };
    expect(ld.diametro).toBe('3"');
    expect((eng as unknown as { alerts: unknown[] }).alerts.length).toBe(0);
  });
});

describe('punto 1b — segundo ramal desde la misma caja (tras borrar el primero)', () => {
  it('el 2º ramal también se recorta al borde (sin alimentaIds stale que lo rechace)', () => {
    const eng = makeEngine('1');
    eng.bajantes.push({
      id: 'CAN1',
      net: 'san',
      tipo: 'caja_san',
      x: 0,
      y: 0,
      recibeDeIds: [],
      alimentaIds: [],
    } as never);

    // 1er ramal: nace en el CENTRO de la caja (snap), se asocia → recorte al borde.
    const r1 = {
      id: 'RS1',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [100, 100],
      ] as number[][],
      recibeDeIds: [] as string[],
      alimentaIds: [] as string[],
      ini: '',
      fin: '',
      diametro: '',
    };
    eng.ramales.push(r1 as never);
    let res = asociarRamalABajantes(eng, r1 as never, false);
    expect(res.rejected).toBe(false);
    expect(r1.pts[0][0]).toBeCloseTo(25, 1);

    // Borrar RS1: el deleteSelected real limpia alimentaIds — simulamos el efecto neto
    // (ramal fuera de engine, referencia stale REMOVIDA de la caja).
    eng.ramales = eng.ramales.filter((x) => x.id !== 'RS1');
    const caja = eng.bajantes[0] as { alimentaIds: string[] };
    caja.alimentaIds = caja.alimentaIds.filter((x) => x !== 'RS1');

    // 2º ramal: nace en el centro (snap) y DEBE recortarse al borde igual que el primero.
    const r2 = {
      id: 'RS2',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [100, 100],
      ] as number[][],
      recibeDeIds: [] as string[],
      alimentaIds: [] as string[],
      ini: '',
      fin: '',
      diametro: '',
    };
    eng.ramales.push(r2 as never);
    res = asociarRamalABajantes(eng, r2 as never, false);
    expect(res.rejected).toBe(false);
    expect(r2.ini).toBe('CAN1');
    expect(r2.pts[0][0]).toBeCloseTo(25, 1);
  });
});

describe('punto 5b — clic sobre vértice del área seleccionada lanza areaPtDrag', () => {
  it('handleSelectDown sobre la esquina fija areaPtDrag (no areaDrag)', async () => {
    const { handleSelectDown } = await import('../handleMouseDown');
    const eng = makeEngine('1') as unknown as {
      selId: string | null;
      multiSel: string[];
      tool: string;
      ramales: unknown[];
      bajantes: unknown[];
      dims: unknown[];
      areaPtDrag: { id: string; idx: number } | null;
      areaDrag: unknown;
      _emitSelect: (el: unknown) => void;
      areas: Array<{
        id: string;
        tipo: string;
        pts: number[][];
        _polyBox: { x: number; y: number; w: number; h: number };
        _labelBox?: unknown;
      }>;
      toPlane: (x: number, y: number) => { x: number; y: number };
      zoom: number;
    };
    eng.areas = [
      {
        id: 'AR1',
        tipo: 'area',
        pts: [
          [100, 100],
          [200, 100],
          [200, 200],
          [100, 200],
        ],
        _polyBox: { x: 100, y: 100, w: 100, h: 100 },
      },
    ];
    eng.toPlane = (x, y) => ({ x, y });
    (eng as unknown as { getBajantesFantasma: () => unknown[] }).getBajantesFantasma = () => [];
    // Primer clic: centro → inicia marquee-candidato; el mouseUp sin arrastre selecciona.
    const { handleDragUp: dragUp } = await import('../handleDragUp');
    handleSelectDown(eng as never, 150, 150);
    dragUp(eng as never);
    expect(eng.selId).toBe('AR1');
    // Segundo clic: sobre el vértice (100,100) — área YA seleccionada → agarra la esquina.
    handleSelectDown(eng as never, 100, 100);
    expect(eng.areaPtDrag).toEqual({
      id: 'AR1',
      idx: 0,
      offX: 0,
      offY: 0,
    });
  });
});

describe('marquee incluye áreas', () => {
  it('recuadro sobre el área la agrega a multiSel', async () => {
    const { handleDragUp } = await import('../handleDragUp');
    const eng = makeEngine('1') as unknown as {
      marqueeRect: { x1: number; y1: number; x2: number; y2: number } | null;
      multiSel: string[];
      areas: Array<{
        id: string;
        labelX?: number;
        labelY?: number;
        _polyBox?: { x: number; y: number; w: number; h: number };
      }>;
      toCvs: (x: number, y: number) => { x: number; y: number };
      ramales: unknown[];
      bajantes: unknown[];
      textAnnots: unknown[];
      guideLines: unknown[];
      crossFloorGhosts: unknown[];
    };
    eng.areas = [
      {
        id: 'AR1',
        labelX: 150,
        labelY: 150,
        _polyBox: { x: 100, y: 100, w: 100, h: 100 },
      },
    ];
    eng.toCvs = (x, y) => ({ x, y });
    eng.guideLines = [];
    eng.crossFloorGhosts = [];
    eng.marqueeRect = { x1: 120, y1: 120, x2: 140, y2: 140 };
    handleDragUp(eng as never);
    expect(eng.multiSel).toContain('AR1');
  });
});

describe('multiselección e2e — recuadro selecciona áreas', () => {
  it('press dentro del área + drag + up: AR1 queda en multiSel', async () => {
    const { handleSelectDown } = await import('../handleMouseDown');
    const { handleDragMove } = await import('../handleDragMove');
    const { handleDragUp } = await import('../handleDragUp');
    const eng = makeEngine('1') as unknown as {
      tool: string;
      multiSel: string[];
      selId: string | null;
      areas: Array<{ id: string; pts: number[][]; _polyBox?: unknown }>;
      toPlane: (x: number, y: number) => { x: number; y: number };
      toCvs: (x: number, y: number) => { x: number; y: number };
      zoom: number;
      bajantes: unknown[];
      ramales: unknown[];
      textAnnots: unknown[];
      dims: unknown[];
      guideLines: unknown[];
      crossFloorGhosts: unknown[];
      marqueeRect: { x1: number; y1: number; x2: number; y2: number } | null;
      _emitSelect: (el: unknown) => void;
      _markDirty: () => void;
    };
    eng.areas = [
      {
        id: 'AR1',
        pts: [
          [100, 100],
          [200, 100],
          [200, 200],
          [100, 200],
        ],
        _polyBox: { x: 100, y: 100, w: 100, h: 100 },
      },
    ];
    eng.toPlane = (x, y) => ({ x, y });
    eng.toCvs = (x, y) => ({ x, y });
    eng.zoom = 1;
    (eng as unknown as { getBajantesFantasma: () => unknown[] }).getBajantesFantasma = () => [];
    (eng as unknown as { mm2cvs: (mm: number) => number }).mm2cvs = (mm) => mm;
    eng.guideLines = [];
    eng.textAnnots = [];
    eng.dims = [];
    // Press dentro del bbox del área (vacía de otros elementos) → inicia marquee.
    handleSelectDown(eng as never, 150, 150);
    expect(eng.marqueeRect).toBeTruthy();
    // Arrastre: crecer el recuadro hasta cubrir un vértice del área.
    eng.marqueeRect!.x2 = 220;
    eng.marqueeRect!.y2 = 220;
    handleDragMove(eng as never, 220, 220);
    handleDragUp(eng as never);
    expect(eng.multiSel).toContain('AR1');
  });
});

describe('copia entre pisos con calibraciones distintas', () => {
  it('coordenadas normalizadas por escala origen/destino — misma distancia real', () => {
    localStorage.clear();
    // Origen escala 0.4, destino escala 0.5 → factor 0.8: los px se comprimen.
    localStorage.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        scaleM: 0.4,
        ramales: [],
        bajantes: [{ id: 'BAN1', net: 'san', tipo: 'bajante', code: 'BAN1', x: 400, y: 400 }],
      }),
    );
    const eng = makeEngine('2') as unknown as {
      scaleM: number;
      bajantes: Array<{ id: string; x?: number; y?: number }>;
      _netCounts: Record<string, { ramal: number }>;
    };
    eng.scaleM = 0.5;
    eng._netCounts = {};
    copyDrawingFromPlan(eng as never, '2', '1', [{ netId: 'san', tipos: new Set(['bajante']) }]);
    // 400px × (0.4/0.5) = 320: el bajante aterriza a los mismos metros reales.
    expect(eng.bajantes[0].x).toBe(320);
  });
});
