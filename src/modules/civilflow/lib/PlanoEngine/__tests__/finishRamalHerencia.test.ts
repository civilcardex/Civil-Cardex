import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Herencia de diámetro (orig. usuario): tras borrar un segmento del brazo de una yee doble y
// REDIBUJARLO, la pieza nueva nacía sin diámetro y disparaba "Diámetros pendientes". Un trazo
// nuevo sin diámetro que conecta con la red adopta el MAYOR diámetro de los que toca, y
// propaga el suyo a vecinos sin diámetro. Nunca sobreescribe un diámetro explícito.
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
    tipoTramo: 'ramal',
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

describe('finishRamal — herencia de diámetro', () => {
  it('tributario sin diámetro que aterriza en un ramal D=2" lo hereda', () => {
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      diametro: '2"',
      pts: [
        [0, 0],
        [80, 0],
      ],
    });
    const eng = makeEngine([rs1]);
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
    expect(trib?.diametro).toBe('2"');
  });

  it('toma el MAYOR de los diámetros que toca (4" y 2" → 4")', () => {
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      diametro: '4"',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const rs2 = R({
      id: 'RS2',
      label: 'RS2',
      diametro: '2"',
      pts: [
        [40, 0],
        [80, 0],
      ],
    });
    const eng = makeEngine([rs1, rs2]);
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
    // Nace vacío y hereda el 4" del vecino tocado.
    expect(trib?.diametro).toBe('4"');
  });

  it('extensión de un tramo sin diámetro: adopta el diámetro por defecto', () => {
    // Flujo real: el trazo activo no lleva diametro — la pieza extendida toma el default
    // (o el de los vecinos) en la fusión; antes quedaba vacía y disparaba el aviso.
    const sinD = R({
      id: 'RS5',
      label: 'RS5',
      diametro: '',
      pts: [
        [40, 0],
        [80, 0],
      ],
    });
    const eng = makeEngine([sinD]);
    (
      eng as unknown as {
        _ramalDefaults: { diametro: string; material: string; pendiente: number };
      }
    )._ramalDefaults = { material: '', diametro: '2"', pendiente: 2 };
    eng.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [0, 0],
        [40, 0],
      ],
    } as never;
    finishRamal(eng);
    expect(sinD.diametro).toBe('2"');
  });

  it('NUNCA sobreescribe un diámetro explícito', () => {
    const vecino = R({
      id: 'RS1',
      label: 'RS1',
      diametro: '2"',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const eng = makeEngine([vecino]);
    eng.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [40, 0],
        [80, 0],
      ],
      diametro: '4"',
    } as never;
    finishRamal(eng);
    const nuevo = eng.ramales.find((r) => r.id !== 'RS1');
    if (nuevo) expect(nuevo.diametro).toBe('4"');
    expect(vecino.diametro).toBe('2"');
  });

  it('tributario san sin vecinos nace SIN diámetro (ítem usuario: solo aparato/default lo fija)', () => {
    const eng = makeEngine([]);
    eng.tipoTramo = 'tributario';
    eng.activeRamal = {
      net: 'san',
      tipo: 'tributario',
      padre: null,
      pts: [
        [0, 0],
        [40, 0],
      ],
      diametro: '',
    } as never;
    finishRamal(eng);
    expect(eng.ramales[0]?.diametro).toBe('');
  });
});
