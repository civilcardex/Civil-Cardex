import { describe, it, expect } from 'vitest';
import { detectTributaryPadre, finishRamal } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const calls: string[] = [];
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
    triggerAlert: (t: string) => calls.push('alert:' + t),
    triggerAccesorioModal: () => calls.push('modal'),
    _renumberRamales: () => {},
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
  };
  (engine as unknown as { calls: string[] }).calls = calls;
  return engine as IPlanoEngineCore;
}
const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'P1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [],
    totalL: 0,
    label: 'RS1',
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

describe('detectTributaryPadre (feature #5 auto-detección)', () => {
  it('detecta el ramal que toca el trazo cuando no hay padre seleccionado', () => {
    const padre = R({
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const engine = makeEngine([padre]);
    // tributario [[20,20],[20,0]] — el extremo (20,0) cae sobre el cuerpo del padre (0,0)-(40,0)
    const padreId = detectTributaryPadre(
      engine,
      [
        [20, 20],
        [20, 0],
      ],
      'san',
    );
    expect(padreId).toBe('P1');
  });

  it('devuelve null si el trazo no toca ningún ramal', () => {
    const padre = R({
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const engine = makeEngine([padre]);
    expect(
      detectTributaryPadre(
        engine,
        [
          [20, 50],
          [20, 30],
        ],
        'san',
      ),
    ).toBeNull();
  });

  it('finishRamal: padre autodetectado; el split re-asigna padre/label al ramal auto-creado', () => {
    const padre = R({
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const engine = makeEngine([padre]);
    engine.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: null,
      pts: [
        [20, 20],
        [20, 0],
      ],
      totalL: 0,
    } as never;
    finishRamal(engine);
    const trib = engine.ramales.find((r) => r.tipo === 'tributario');
    expect(trib).toBeTruthy();
    // El extremo (20,0) cae a mitad del cuerpo de P1 → autoSplit lo parte y el padre real del
    // tributario pasa a ser el segmento AUTO-CREADO aguas abajo (recibe la descarga), no el
    // tronco truncado (orig. usuario: etiquetas T2RS9 → deben ser del tramo nuevo).
    const down = engine.ramales.find((r) => r.mergesFrom?.[1] === trib!.id);
    expect(down).toBeTruthy();
    expect(trib!.padre).toBe(down!.id);
    expect(trib!.label).toBe(`T1${down!.label}`);
  });
});
