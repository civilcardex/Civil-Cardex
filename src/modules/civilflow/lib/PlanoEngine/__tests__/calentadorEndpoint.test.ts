import { describe, it, expect, vi } from 'vitest';
import { handleCreateCalentadorMidBody } from '../drawingCreations';
import { buildTramos } from '../../../utils/buildTramos';
import { TRAZOS_PREFIX } from '../../../constants/storage-keys';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Inserción de calentador: solo en ramales AF, los clics en extremos NO deben partir el ramal (sin
// segmento duplicado de longitud cero), y el ramal sintético AC-01-{calId} debe recoger los
// aparatos guardados bajo la clave ac_ o la af_ (el calentador queda anclado a la red AF).

const calentadorBajanteFixture = {
  id: 'CALENT1',
  code: 'CALENT1',
  tipo: 'calentador',
  net: 'ac',
  pisoBase: '1',
  x: 0,
  y: 0,
};

vi.mock('../../../services/storageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/storageService')>();
  return {
    ...actual,
    loadFromStorage: vi.fn((key: string, fallback: unknown) => {
      if (key === TRAZOS_PREFIX + '1') {
        return { bajantes: [calentadorBajanteFixture] };
      }
      return fallback;
    }),
    loadPlanTrazos: vi.fn(() => ({ bajantes: [calentadorBajanteFixture] })),
    saveToStorage: vi.fn(),
  };
});

function makeRamal(id: string, pts: number[][], net = 'af'): PlanoRamal {
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
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    bloqueado: true,
  } as PlanoRamal;
}

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    selId: null,
    _isGhostSel: false,
    nivelActual: { label: 'P1', n: 1, npt: 0 } as IPlanoEngineCore['nivelActual'],
    pxToM: (px: number) => px,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
  };
  return engine as IPlanoEngineCore;
}

describe('handleCreateCalentadorMidBody — endpoint vs mid-body', () => {
  it('anchors the heater at the endpoint without splitting the ramal', () => {
    const ramal = makeRamal('RS1', [
      [0, 0],
      [20, 0],
    ]);
    const engine = makeEngine([ramal]);
    handleCreateCalentadorMidBody(engine, 'RS1', 0, 0, 0);
    expect(ramal.pts).toEqual([
      [0, 0],
      [20, 0],
    ]);
    const cal = engine.bajantes.find((b) => b.tipo === 'calentador');
    expect(cal).toBeDefined();
    expect(cal?.x).toBe(0);
    expect(cal?.y).toBe(0);
    expect(cal?.net).toBe('ac');
    expect(engine.selId).toBe('CALENT1');
  });

  it('splits the ramal only on a true mid-body click', () => {
    const ramal = makeRamal('RS1', [
      [0, 0],
      [20, 0],
      [40, 0],
    ]);
    const engine = makeEngine([ramal]);
    handleCreateCalentadorMidBody(engine, 'RS1', 20, 0, 1);
    expect(ramal.pts).toHaveLength(4);
    expect(engine.bajantes.find((b) => b.tipo === 'calentador')?.x).toBe(20);
  });

  it('rejects non-AF ramals', () => {
    const engine = makeEngine([
      makeRamal(
        'AC1',
        [
          [0, 0],
          [20, 0],
        ],
        'ac',
      ),
    ]);
    handleCreateCalentadorMidBody(engine, 'AC1', 10, 0, 1);
    expect(engine.bajantes).toHaveLength(0);
  });
});

describe('buildTramos — heater stub merges af_/ac_ fixture keys', () => {
  it('reads fixtures saved under the af_ key into AC-01-{calId}', () => {
    const planes = {
      ac_1: {
        planoId: '1',
        ramales: [],
        bajantes: [calentadorBajanteFixture],
      },
    };
    const hidroData = {};
    const aparatos = { af_CALENT1_1: { duc: 2 } };
    const incoming = buildTramos('ac', planes as never, hidroData, aparatos);
    const stub = incoming.find((t) => t.id === 'AC-01-CALENT1');
    expect(stub).toBeDefined();
    expect(stub?.fixtures).toEqual({ duc: 2 });
    expect(stub?.calCapacidad).toBe('');
  });

  it('prefers the ac_ key when both exist', () => {
    const planes = {
      ac_1: {
        planoId: '1',
        ramales: [],
        bajantes: [calentadorBajanteFixture],
      },
    };
    const hidroData = {};
    const aparatos = { af_CALENT1_1: { duc: 2 }, ac_CALENT1_1: { lvm: 1, duc: 1 } };
    const incoming = buildTramos('ac', planes as never, hidroData, aparatos);
    const stub = incoming.find((t) => t.id === 'AC-01-CALENT1');
    expect(stub?.fixtures).toEqual({ lvm: 1, duc: 1 });
  });

  it('a persisted AC-01 stub ramal reads its fixtures from the calentador key', () => {
    const planes = {
      ac_1: {
        planoId: '1',
        ramales: [
          {
            id: 'AC-01-CALENT1',
            label: 'AC-01-CALENT1',
            tipo: 'ramal',
            net: 'ac',
            _aparatosKey: 'ac_AC-01-CALENT1_1',
            ini: 'AF',
            fin: 'CALENT1',
            pts: [
              [0, 0],
              [10, 0],
            ],
            piso: '1',
          },
        ],
        bajantes: [calentadorBajanteFixture],
      },
    };
    const hidroData = {};
    const aparatos = { ac_CALENT1_1: { duc: 2, lvm: 1 } };
    const incoming = buildTramos('ac', planes as never, hidroData, aparatos);
    const stub = incoming.find((t) => t.id === 'AC-01-CALENT1');
    expect(stub).toBeDefined();
    expect(stub?.fixtures).toEqual({ duc: 2, lvm: 1 });
  });
});
