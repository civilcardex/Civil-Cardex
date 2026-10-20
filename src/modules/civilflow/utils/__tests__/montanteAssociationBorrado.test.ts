import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys';
import { applyBajanteAssociation, clearBajanteAssociation } from '../bajanteAssociation';
import { propagarAparatosPresion } from '../propagation';
import { deleteSelected } from '../../lib/PlanoEngine/deleteSelected';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState';

// (1) Al borrar el fantasma (o su Ldesvio) el enlace se desasocia: el montante/bajante
//     original vuelve a mostrar "sin origen" (el puntero origenId queda en null).
// (2) El Ldesvio CONSERVA la carga heredada: el propagador de presión no la borra como
//     residuo (no tiene aparato propio, pero la carga viene del piso de arriba).

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) {
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({}),
    };
  }
  if (!g.window) {
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
  }
});

const PLANS = [
  { id: '1', name: 'P1', nivel: 0, npt: 0, status: 'confirmed' },
  { id: '2', name: 'P2', nivel: 1, npt: 320, status: 'confirmed' },
] as never[];

function seedStorage() {
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '2',
    JSON.stringify({
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [100, 0],
            [0, 0],
          ],
          label: 'RAF1',
        },
      ],
      bajantes: [
        {
          id: 'MAF1',
          net: 'af',
          tipo: 'montante',
          x: 0,
          y: 0,
          recibeDeIds: ['RAF1'],
          dNominal: '3/4"',
        },
      ],
    }),
  );
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      ramales: [
        {
          id: 'RAF2',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [50, 50],
            [30, 30],
          ],
          label: 'RAF2',
        },
      ],
      bajantes: [
        {
          id: 'MAF2',
          net: 'af',
          tipo: 'montante',
          x: 30,
          y: 30,
          recibeDeIds: ['RAF2'],
          dNominal: '3/4"',
        },
      ],
    }),
  );
  localStorage.setItem(
    'civilflow_' + APARATOS_BY_TRAMO_KEY,
    JSON.stringify({ af_RAF1_2: { ino: 2, lvm: 1 } }),
  );
}

function makeEngine(loadedPlanId: string): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    activeNet: 'af',
    tipoTramo: 'ramal',
    _loadedPlanId: loadedPlanId,
    nivelActual: { label: 'P2', n: 1, npt: 320 } as never,
    scaleM: 0.5,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    updateElementById: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberAreas: () => {},
  };
  engine.updateElementById = ((id: string, fields: Record<string, unknown>) => {
    const el = [...(engine.bajantes || []), ...(engine.ramales || [])].find(
      (x) => (x as { id: string }).id === id,
    );
    if (el) Object.assign(el, fields);
  }) as never;
  return engine as IPlanoEngineCore;
}

const apos = (): Record<string, Record<string, number>> =>
  JSON.parse(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}');
const doc = (planId: string): Record<string, never> =>
  JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + planId) || '{}');

const SRC = {
  planId: '2',
  id: 'MAF1',
  x: 0,
  y: 0,
  net: 'af',
  dNominal: '3/4"',
  code: 'MAF1',
  nivelN: 1,
  npt: 320,
  tipo: 'montante',
};
const TGT = {
  planId: '1',
  id: 'MAF2',
  x: 30,
  y: 30,
  net: 'af',
  dNominal: '3/4"',
  code: 'MAF2',
  nivelN: 0,
  npt: 0,
  tipo: 'montante',
};

beforeEach(() => {
  localStorage.clear();
  seedStorage();
});

describe('borrar el fantasma / su Ldesvio desasocia el enlace', () => {
  it('borrar el FANTASMA deja el montante de abajo sin origen', () => {
    // Asociar desde el piso SUPERIOR (donde vive el fantasma).
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'MAF1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
    } as never);
    applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);

    // El piso de abajo tiene el origen apuntando al de arriba.
    const b2 = (doc('1').bajantes as unknown as Array<Record<string, unknown>>).find(
      (b) => b.id === 'MAF2',
    );
    expect(b2?.origenId).toBe('2|MAF1');

    // El fantasma vive en el piso de arriba: se borra desde allá.
    const eng2 = makeEngine('2');
    eng2.bajantes.push({
      id: 'MAF1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
    } as never);
    const ghosts = (doc('2').crossFloorGhosts as unknown as Array<Record<string, unknown>>) || [];
    expect(ghosts.length).toBeGreaterThan(0);
    eng2.crossFloorGhosts = ghosts as never;

    deleteSelected(eng2, [String(ghosts[0].id)]);

    // El origen queda limpio: el desplegable vuelve a "sin origen".
    const b2b = (doc('1').bajantes as unknown as Array<Record<string, unknown>>).find(
      (b) => b.id === 'MAF2',
    );
    expect(b2b?.origenId ?? null).toBeNull();
  });

  /** Carga en un motor del piso 1 lo que la asociación dejó en su storage (LD + MAF2). */
  function engPisoInferior(): IPlanoEngineCore {
    const eng = makeEngine('1');
    const d1 = doc('1');
    eng.ramales = (d1.ramales as never) ?? [];
    eng.bajantes = (d1.bajantes as never) ?? [];
    // El anillo del fantasma se escribió con la etiqueta de piso del destino: el motor
    // finge tener ese nivel cargado para que la ruta del anillo la encuentre.
    const maf2 = eng.bajantes.find((b) => b.id === 'MAF2') as {
      desplazamientos?: Record<string, unknown>;
    };
    const lvl = Object.keys(maf2?.desplazamientos || {})[0] || '';
    (eng as { nivelActual: unknown }).nivelActual = { label: lvl, n: 0, npt: 0 };
    return eng;
  }

  it('borrar el LDESVIO individual (selId) deja el montante de abajo sin origen', () => {
    const engAsoc = makeEngine('2');
    engAsoc.bajantes.push({
      id: 'MAF1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
    } as never);
    applyBajanteAssociation(engAsoc, SRC as never, TGT as never, PLANS);

    const eng1 = engPisoInferior();
    expect(eng1.ramales.some((r) => r.id === 'LD_MAF1')).toBe(true);
    eng1.selId = 'LD_MAF1';
    deleteSelected(eng1);

    const b2 = (doc('1').bajantes as unknown as Array<Record<string, unknown>>).find(
      (b) => b.id === 'MAF2',
    );
    expect(b2?.origenId ?? null).toBeNull();
    // Motor vivo: el desplegable de origen lee de acá.
    const vivo = eng1.bajantes.find((b) => b.id === 'MAF2') as { origenId?: string | null };
    expect(vivo.origenId ?? null).toBeNull();
    // El extremo superior también queda limpio (sin descarga colgando).
    const b1 = (doc('2').bajantes as unknown as Array<Record<string, unknown>>).find(
      (b) => b.id === 'MAF1',
    );
    expect(b1?.descargaEnId ?? null).toBeNull();
  });

  it('desasociar borra TAMBIÉN el anillo del fantasma (desplazamientos del destino)', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'MAF1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
    } as never);
    applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);

    // Desalineados: apply dejó el anillo (desplazamientos) en MAF2, en el piso inferior.
    const d1 = doc('1') as unknown as {
      bajantes: Array<Record<string, unknown>>;
    };
    const mac2 = d1.bajantes.find((b) => b.id === 'MAF2') as {
      desplazamientos?: Record<string, { Ldesvio?: string }>;
    };
    expect(Object.keys(mac2.desplazamientos || {}).length).toBeGreaterThan(0);

    clearBajanteAssociation(eng, '2', 'MAF1', 'af', '1|MAF2', PLANS);

    const d1b = doc('1') as unknown as {
      bajantes: Array<Record<string, unknown>>;
    };
    const mac2b = d1b.bajantes.find((b) => b.id === 'MAF2') as {
      desplazamientos?: Record<string, unknown>;
      ghostData?: Record<string, unknown>;
    };
    // El anillo (el montante fantasma dibujado) muere con el enlace — no solo el Ldesvio.
    expect(Object.keys(mac2b.desplazamientos || {}).length).toBe(0);
  });

  it('borrar el ANILLO fantasma individual (selId + _isGhostSel) deja el montante sin origen', () => {
    const engAsoc = makeEngine('2');
    engAsoc.bajantes.push({
      id: 'MAF1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
    } as never);
    applyBajanteAssociation(engAsoc, SRC as never, TGT as never, PLANS);

    const eng1 = engPisoInferior();
    (eng1 as { selId: string | null }).selId = 'MAF2';
    (eng1 as { _isGhostSel?: boolean })._isGhostSel = true;
    deleteSelected(eng1);

    const b2 = (doc('1').bajantes as unknown as Array<Record<string, unknown>>).find(
      (b) => b.id === 'MAF2',
    );
    expect(b2?.origenId ?? null).toBeNull();
    const vivo = eng1.bajantes.find((b) => b.id === 'MAF2') as { origenId?: string | null };
    expect(vivo.origenId ?? null).toBeNull();
  });
});

describe('el Ldesvio conserva la carga heredada', () => {
  it('tras propagar, el Ldesvio sigue con los 3 UC (no se borra como residuo)', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'MAF1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
    } as never);
    applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);
    expect(apos()['af_LD_MAF1_1']).toEqual({ ino: 2, lvm: 1 });

    // El propagador de presión corre (es lo que borra la carga de las piezas sin aparato).
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');

    expect(apos()['af_LD_MAF1_1']).toEqual({ ino: 2, lvm: 1 });
  });
});
