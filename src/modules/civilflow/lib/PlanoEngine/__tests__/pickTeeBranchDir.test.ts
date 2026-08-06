import { describe, it, expect } from 'vitest';
import { pickTeeBranchDir } from '../renderers/renderRamales';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// pickTeeBranchDir debe elegir el lado de la rama hacia el ramal que cruza PERPENDICULARMENTE
// real, y NO debe dejarse engañar por segmentos colineales (stubs de división) que también tocan
// la unión.

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
    activeNet: 'af',
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { af: { ramal: 0, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
  };
  return engine as IPlanoEngineCore;
}

function makeRamal(id: string, pts: number[][], opts: Partial<PlanoRamal> = {}): PlanoRamal {
  return {
    id,
    net: 'af',
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label: id,
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
    pendiente: 0,
    bloqueado: true,
    ...opts,
  } as PlanoRamal;
}

describe('pickTeeBranchDir — horizontal through ramal, vertical tributario', () => {
  it('points the branch DOWN when the tributario goes down (y+)', () => {
    // Ramal de paso: horizontal [0,0]->[20,0] (ownId). El tributario cruza la unión yendo hacia ABAJO.
    const engine = makeEngine([
      makeRamal('THROUGH', [
        [0, 0],
        [20, 0],
      ]),
      makeRamal('TRIB', [
        [20, 0],
        [20, 30],
      ]),
    ]);
    const { px, py } = pickTeeBranchDir(engine, 'THROUGH', 'af', [20, 0], 1, 0, 0, 1);
    // La rama debe alinearse con el tributario: (0,1) = ABAJO
    expect(Math.abs(px)).toBeLessThan(0.01);
    expect(py).toBeGreaterThan(0.99);
  });

  it('points the branch UP when the tributario goes up (y-)', () => {
    const engine = makeEngine([
      makeRamal('THROUGH', [
        [0, 0],
        [20, 0],
      ]),
      makeRamal('TRIB', [
        [20, 0],
        [20, -30],
      ]),
    ]);
    const { px, py } = pickTeeBranchDir(engine, 'THROUGH', 'af', [20, 0], 1, 0, 0, 1);
    expect(Math.abs(px)).toBeLessThan(0.01);
    expect(py).toBeLessThan(-0.99);
  });

  it('ignores a COLLINEAR split stub and still picks the tributario side', () => {
    // El stub de división continúa la línea horizontal desde la unión — toca el punto pero es
    // colineal con la dirección de paso, así que NO debe ganarle al tributario perpendicular.
    const engine = makeEngine([
      makeRamal('THROUGH', [
        [0, 0],
        [20, 0],
      ]),
      makeRamal('STUB', [
        [20, 0],
        [40, 0],
      ]),
      makeRamal('TRIB', [
        [20, 0],
        [20, -30],
      ]),
    ]);
    const { px, py } = pickTeeBranchDir(engine, 'THROUGH', 'af', [20, 0], 1, 0, 0, 1);
    expect(Math.abs(px)).toBeLessThan(0.01);
    expect(py).toBeLessThan(-0.99);
  });

  it('falls back to screen-up convention when no crossing ramal exists', () => {
    const engine = makeEngine([
      makeRamal('THROUGH', [
        [0, 0],
        [20, 0],
      ]),
    ]);
    const { px, py } = pickTeeBranchDir(engine, 'THROUGH', 'af', [10, 0], 1, 0, 0, 1);
    // Respaldo: arriba en pantalla = (0,-1)
    expect(Math.abs(px)).toBeLessThan(0.01);
    expect(py).toBeLessThan(-0.99);
  });
});
