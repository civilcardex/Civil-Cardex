import { describe, it, expect } from 'vitest';
import { handleLineDown } from '../PlanoEngineDrawing.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

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

/** Bajante con fantasma entrepisos: el LD_ (ramal desvio entrepisos) nace en él y termina
 *  en el anillo. El host del LD_ (id LD_<bajanteId>) vive en engine.bajantes (proyección). */
function makeEngine(ramales: PlanoRamal[], bajantes: unknown[]): IPlanoEngineCore {
  return {
    ramales,
    bajantes,
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
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    snapMode: true,
    zoom: 1,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { san: { ramal: 1, tributario: 1 } },
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

describe('clic sobre el extremo del LDesvio', () => {
  const host = { id: 'BAN1', code: 'BAN1', net: 'san', x: 50, y: 0, tipo: 'bajante' };
  // LD_: nace en el bajante [50,0], anillo en [80,30].
  const ld = mkRamal('LD_BAN1', 'san', [
    [50, 0],
    [80, 30],
  ]);

  it('en el extremo del bajante NO continúa el LD: inicia un ramal nuevo (etiqueta propia)', () => {
    const engine = makeEngine([ld], [host]);
    handleLineDown(engine, 50, 0);
    expect(engine.activeRamal).toBeTruthy();
    // Sin id = trazo NUEVO (si continuara, activeRamal.id === 'LD_BAN1').
    expect(engine.activeRamal!.id).toBeUndefined();
    expect(engine.activeRamal!.pts[0]).toEqual([50, 0]);
  });

  it('en el extremo del anillo SÍ continúa el LD', () => {
    const engine = makeEngine([ld], [host]);
    handleLineDown(engine, 80, 30);
    expect(engine.activeRamal!.id).toBe('LD_BAN1');
  });

  it('LD huérfano (sin host en el piso) sigue continuable por su extremo libre', () => {
    const engine = makeEngine([ld], []);
    handleLineDown(engine, 80, 30);
    expect(engine.activeRamal!.id).toBe('LD_BAN1');
  });
});
