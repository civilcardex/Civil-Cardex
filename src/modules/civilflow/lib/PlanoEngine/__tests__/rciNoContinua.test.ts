import { describe, it, expect } from 'vitest';
import { handleLineDown } from '../PlanoEngineDrawing.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

// rci NO continúa ramales al clicar sobre su extremo (ped. usuario): el trazo que conecta
// ramales paralelos debe nacer como RAMAL NUEVO (tramo propio del extractor), no como
// prolongación del primero. En las demás redes la continuación sigue igual.

function mkRamal(id: string, net: string, pts: number[][]): PlanoRamal {
  return {
    id,
    net,
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
    nSalidas: 1,
    material: '',
    diametro: '',
    bloqueado: false,
    showLength: true,
    showName: true,
    showGuide: true,
  } as PlanoRamal;
}

function makeEngine(net: string, ramales: PlanoRamal[]): IPlanoEngineCore {
  return {
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
    activeNet: net,
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    snapMode: true,
    zoom: 1,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { [net]: { ramal: 1, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    toPlane: (x: number, y: number) => ({ x, y }),
    toCvs: (x: number, y: number) => ({ x, y }),
    mm2cvs: (mm: number) => mm,
    snapToExisting: () => null,
    snapAngle: (_x: number, _y: number, px: number, py: number) => ({ x: px, y: py }),
    _snapToSegment: () => null,
    _ventFirstSegDir: null,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
    _renumberMontantes: () => {},
    _renumberBajantes: () => {},
    _renumberAreas: () => {},
    _emitDelete: () => {},
  } as unknown as IPlanoEngineCore;
}

describe('clic sobre el extremo de un ramal rci', () => {
  const base = mkRamal('RRCI1', 'rci', [
    [0, 0],
    [100, 0],
  ]);

  it('en rci NO continúa: el trazo nace como ramal NUEVO (id indefinido)', () => {
    const engine = makeEngine('rci', [base]);
    handleLineDown(engine, 100, 0); // exactamente el extremo de RRCI1
    expect(engine.activeRamal).toBeTruthy();
    expect(engine.activeRamal!.id).toBeUndefined(); // si continuara, sería 'RRCI1'
    expect(engine.activeRamal!.pts[0]).toEqual([100, 0]);
    expect(base.pts).toHaveLength(2); // sin extensión del existente
  });

  it('en san SÍ continúa (comportamiento de las demás redes intacto)', () => {
    const san = mkRamal('RS1', 'san', [
      [0, 0],
      [100, 0],
    ]);
    const engine = makeEngine('san', [san]);
    handleLineDown(engine, 100, 0);
    expect(engine.activeRamal!.id).toBe('RS1'); // continúa el existente (id heredado)
  });
});
