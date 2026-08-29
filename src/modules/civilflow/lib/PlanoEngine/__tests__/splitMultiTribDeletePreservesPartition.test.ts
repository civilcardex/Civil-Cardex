import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Regresión (spec usuario): RS1 → RS1+RS2 (tributario A) → RS1+RS2+RS3 (tributario B sobre RS1).
// Borrar el primer tributario (A) debe conservar la partición posterior (B) — NO colapsar todo a RS1.

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    activeNet: 'san',
    tipoTramo: 'tributario',
    padreTributario: 'RS1',
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 1, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px) => px,
    cmToPlanePx: (c) => c,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    triggerAccesorioModal: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
  };
  return engine as IPlanoEngineCore;
}
const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
    ],
    totalL: 0,
    label: o.id || 'RS1',
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

describe('spec split múltiple con tributarios — borrar primer tributario conserva partición posterior', () => {
  it('RS1 + RS2 + RS3 → borrar tributario A deja 2 segmentos con partición B en x=10', () => {
    const engine = makeEngine([R({ id: 'RS1' })]);
    // Tributario A en x=20 → divide RS1 en RS1[0,20] + RS2[20,40]
    engine.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: 'RS1',
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    // Tributario B en x=10 sobre RS1[0,20] → RS1[0,10] + RS3[10,20]
    engine.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: 'RS1',
      pts: [
        [10, 40],
        [10, 0],
      ],
    } as never;
    finishRamal(engine);

    // Ramales (no tributarios): RS1, RS3, RS2
    const ramalesSan = engine.ramales.filter((r) => r.net === 'san' && r.tipo !== 'tributario');
    expect(ramalesSan.length).toBe(3);

    const divisorA = engine.ramales.find(
      (r) => r.tipo === 'tributario' && Math.abs(r.pts[1][0] - 20) < 0.5 && r.pts[0][1] === 40,
    );
    expect(divisorA).toBeDefined();

    deleteSelected(engine, [divisorA!.id]);

    const restantes = engine.ramales.filter((r) => r.net === 'san' && r.tipo !== 'tributario');
    // Debe quedar RS1[0,10] + (RS3+RS2)[10,40] → 2 segmentos, partición B (x=10) conservada
    expect(restantes.length).toBe(2);

    const starts = restantes.map((r) => r.pts[0]);
    const ends = restantes.map((r) => r.pts[r.pts.length - 1]);
    const hasTenBoundary =
      ends.some((p) => Math.abs(p[0] - 10) < 0.5) && starts.some((p) => Math.abs(p[0] - 10) < 0.5);
    expect(hasTenBoundary).toBe(true);

    // Ningún ramal único abarcando todo [0,40] (no re-colapsado a un solo RS1)
    const spansWhole = restantes.some(
      (r) => Math.abs(r.pts[0][0] - 0) < 0.5 && Math.abs(r.pts[r.pts.length - 1][0] - 40) < 0.5,
    );
    expect(spansWhole).toBe(false);

    // El tributario B sigue vivo
    const tribB = engine.ramales.find(
      (r) => r.tipo === 'tributario' && Math.abs(r.pts[1][0] - 10) < 0.5,
    );
    expect(tribB).toBeDefined();
  });

  it('borrar el SEGUNDO tributario (B) fusiona RS1+RS3 y conserva la partición A en x=20', () => {
    const engine = makeEngine([R({ id: 'RS1' })]);
    engine.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: 'RS1',
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    engine.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: 'RS1',
      pts: [
        [10, 40],
        [10, 0],
      ],
    } as never;
    finishRamal(engine);

    const divisorB = engine.ramales.find(
      (r) => r.tipo === 'tributario' && Math.abs(r.pts[1][0] - 10) < 0.5 && r.pts[0][1] === 40,
    );
    expect(divisorB).toBeDefined();
    deleteSelected(engine, [divisorB!.id]);

    const restantes = engine.ramales.filter((r) => r.net === 'san' && r.tipo !== 'tributario');
    // RS1+RS3 → [0,20], RS2 [20,40] → 2 segmentos, partición A (x=20) conservada
    expect(restantes.length).toBe(2);
    const starts = restantes.map((r) => r.pts[0]);
    const ends = restantes.map((r) => r.pts[r.pts.length - 1]);
    const hasTwentyBoundary =
      ends.some((p) => Math.abs(p[0] - 20) < 0.5) && starts.some((p) => Math.abs(p[0] - 20) < 0.5);
    expect(hasTwentyBoundary).toBe(true);
    const spansWhole = restantes.some(
      (r) => Math.abs(r.pts[0][0] - 0) < 0.5 && Math.abs(r.pts[r.pts.length - 1][0] - 40) < 0.5,
    );
    expect(spansWhole).toBe(false);
    // El tributario A sigue vivo
    const tribA = engine.ramales.find(
      (r) => r.tipo === 'tributario' && Math.abs(r.pts[1][0] - 20) < 0.5,
    );
    expect(tribA).toBeDefined();
  });
});
