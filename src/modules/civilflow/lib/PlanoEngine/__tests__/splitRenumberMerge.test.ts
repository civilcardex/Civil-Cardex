import { describe, it, expect } from 'vitest';
import { handleLineDown, finishRamal } from '../PlanoEngineDrawing';
import { deleteSelected } from '../deleteSelected';
import { _renumberRamales } from '../networkRenumber';
import type { IPlanoEngineCore } from '../PlanoState';

function makeEngine(): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
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
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    snapMode: false,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 1, tributario: 1 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px) => px,
    cmToPlanePx: (c) => c,
    cmToCanvasPx: (c) => c,
    toCvs: (x, y) => ({ x, y }),
    toPlane: (x, y) => ({ x, y }),
    realMmToCanvasPx: (mm) => mm,
    mm2cvs: (mm) => mm,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    triggerAccesorioModal: () => {},
    _renumberRamales: (net: string) => _renumberRamales(engine as IPlanoEngineCore, net),
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
    zoom: 1,
    offX: 0,
    offY: 0,
    multiSel: [],
    snapToExisting: () => null,
    snapAngle: (_x, _y, _px, _py) => ({ x: _px, y: _py }),
    _snapToSegment: () => null,
    _ventFirstSegDir: null,
  };
  return engine as unknown as IPlanoEngineCore;
}

describe('BUG 1 — split + _renumberRamales + borrar divisor', () => {
  it('el renumber NO debe romper mergesFrom; borrar divisor re-úne en UNO', () => {
    const engine = makeEngine();
    // A: [[0,0],[40,0]] → id RS1
    handleLineDown(engine, 0, 0);
    handleLineDown(engine, 40, 0);
    finishRamal(engine);
    const aId = engine.ramales[0].id;
    expect(engine.ramales[0].pts).toEqual([
      [0, 0],
      [40, 0],
    ]);
    // B (tributario padre A) aterriza en (10,0): A se parte RS1+RS2(downstream)
    engine.tipoTramo = 'tributario';
    engine.padreTributario = aId;
    handleLineDown(engine, 40, 30);
    handleLineDown(engine, 10, 0);
    finishRamal(engine);
    const down = engine.ramales.find((r) => r.mergesFrom);
    expect(down).toBeTruthy();
    console.log(
      'POST-SPLIT:',
      engine.ramales
        .map((r) => `${r.id}[${r.label}] mer=${JSON.stringify(r.mergesFrom)}`)
        .join(' | '),
    );
    // Simular el renumber que la app corre tras crear (los IDs de ramal pueden cambiar)
    _renumberRamales(engine, 'san');
    console.log(
      'POST-RENUMBER:',
      engine.ramales
        .map(
          (r) =>
            `${r.id}[${r.label}] mer=${JSON.stringify(r.mergesFrom)} pts=${JSON.stringify(r.pts)}`,
        )
        .join(' | '),
    );
    // mergesFrom debe seguir apuntando a ids VIVOS (migrado por el renumber)
    for (const r of engine.ramales) {
      if (!r.mergesFrom) continue;
      for (const m of r.mergesFrom) {
        const alive =
          engine.ramales.some((x) => x.id === m) || engine.bajantes.some((b) => b.id === m);
        expect(alive, `mergesFrom apunta a id muerto: ${m} en ${r.id}`).toBe(true);
      }
    }
    // Borrar el divisor B (tributario, NO renumerado — el renumber solo toca tipo!=='tributario')
    const divisor = engine.ramales.find((r) => r.tipo === 'tributario');
    expect(divisor).toBeTruthy();
    engine.selId = divisor!.id;
    deleteSelected(engine);
    console.log(
      'POST-BORRAR:',
      engine.ramales
        .map(
          (r) =>
            `${r.id}[${r.label}] mer=${JSON.stringify(r.mergesFrom)} pts=${JSON.stringify(r.pts)}`,
        )
        .join(' | '),
    );
    // UN solo ramal continuo: [0,0]→[40,0]
    const ramales = engine.ramales.filter((r) => r.tipo === 'ramal');
    expect(ramales).toHaveLength(1);
    expect(ramales[0].pts[0]).toEqual([0, 0]);
    expect(ramales[0].pts[ramales[0].pts.length - 1]).toEqual([40, 0]);
  });
});
