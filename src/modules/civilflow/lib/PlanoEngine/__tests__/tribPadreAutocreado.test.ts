import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Ítem 3: al dividir un ramal creando un tributario, el tributario toma como padre el ramal
// AUTOCREADO (aguas abajo), no el original — por dibujo manual (split a mitad de cuerpo y
// unión extremo-con-extremo) en cualquier red.
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
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 2 },
    _netCounts: {
      san: { ramal: 3, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P2', n: 2, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
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

describe('ítem 3 — tributario toma como padre el ramal autocreado', () => {
  it('split a mitad de cuerpo: RS1 → RS1+RS2, padre del tributario es RS2', () => {
    const eng = makeEngine([
      R({
        id: 'RS1',
        label: 'RS1',
        pts: [
          [0, 0],
          [80, 0],
        ],
      }),
    ]);
    eng.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: null,
      pts: [
        [40, 40],
        [40, 0],
      ],
      diametro: '',
    } as never;
    finishRamal(eng);
    const trib = eng.ramales.find((r) => r.tipo === 'tributario');
    const downstream = eng.ramales.find((r) => r.mergesFrom && r.mergesFrom[1] === trib?.id);
    expect(downstream).toBeDefined();
    expect(trib?.padre).toBe(downstream!.id);
    expect(trib?.label).toContain(downstream!.label || downstream!.id);
  });

  it('unión extremo-con-extremo: padre es el ramal que NACE en la junta (RS8, no RS7)', () => {
    const eng = makeEngine([
      R({
        id: 'RS7',
        label: 'RS7',
        pts: [
          [0, 0],
          [40, 0],
        ],
      }),
      R({
        id: 'RS8',
        label: 'RS8',
        pts: [
          [40, 0],
          [80, 0],
        ],
      }),
    ]);
    eng.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: null,
      pts: [
        [40, 40],
        [40, 0],
      ],
      diametro: '',
    } as never;
    finishRamal(eng);
    const trib = eng.ramales.find((r) => r.tipo === 'tributario');
    expect(trib?.padre).toBe('RS8');
    expect(trib?.label).toContain('RS8');
  });
});
