import { describe, it, expect } from 'vitest';
import { autoSplitJunctionAndSumFlow } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

function mkRamal(id: string, net: string, pts: number[][], tipo = 'ramal'): PlanoRamal {
  return {
    id,
    net,
    tipo,
    padre: null,
    pts,
    totalL: 0,
    label: id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    nSalidas: 1,
    material: '',
    diametro: '',
    bloqueado: false,
    showLength: true,
    showName: true,
    showGuide: true,
  } as PlanoRamal;
}

function makeEngine(ramales: PlanoRamal[]): { engine: IPlanoEngineCore; alerts: string[] } {
  const alerts: string[] = [];
  const engine = {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    activeNet: 'san',
    tipoTramo: 'ramal',
    padreTributario: null,
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    pxToM: (px: number) => px,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: (t: string, m?: string) => alerts.push(m || t),
    _renumberRamales: () => {},
  } as unknown as IPlanoEngineCore;
  return { engine, alerts };
}

describe('extender ramal cuyo extremo comparte vértice con un tributario', () => {
  it('no alerta cuando el punto es vértice de un ramal normal Y de un tributario', () => {
    // R1 ramal san [0,0]-[40,0]; T1 tributario que aterrizó en su extremo [40,0].
    const r1 = mkRamal('RS1', 'san', [
      [0, 0],
      [40, 0],
    ]);
    const t1 = mkRamal(
      'T1',
      'san',
      [
        [40, 0],
        [40, 30],
      ],
      'tributario',
    );
    const { engine, alerts } = makeEngine([r1, t1]);
    // Extender R1 desde [40,0]: el trazo nuevo es tipo ramal y su vértice coincide
    // con el vértice de T1 — la conexión real es ramal-a-ramal, no debe alertar.
    const incoming = mkRamal('RS9', 'san', [
      [40, 0],
      [80, 0],
    ]);
    autoSplitJunctionAndSumFlow(engine, incoming);
    expect(alerts.some((a) => /tributarios/i.test(a))).toBe(false);
  });

  it('SÍ alerta cuando el único ramal en el punto es un tributario', () => {
    const t1 = mkRamal(
      'T1',
      'san',
      [
        [0, 0],
        [40, 0],
      ],
      'tributario',
    );
    const { engine, alerts } = makeEngine([t1]);
    const incoming = mkRamal('RS9', 'san', [
      [40, 0],
      [40, 40],
    ]);
    autoSplitJunctionAndSumFlow(engine, incoming);
    expect(alerts.some((a) => /tributarios/i.test(a))).toBe(true);
  });
});
