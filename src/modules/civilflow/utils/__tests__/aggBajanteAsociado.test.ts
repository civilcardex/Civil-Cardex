import { describe, it, expect, beforeEach } from 'vitest';
import { aggBajanteAsociado } from '../bombaAssociation';

// Fuente única del panel del bajante ASOCIADO (orig. usuario: original/fantasma/Ldesvio deben
// mostrar SIEMPRE las UD del grupo — 12 —, nunca la suma local del piso — 16). Orden de la
// verdad: bomba → libro ucAplicado → árbol real del origen (collectSourceAgg).

function resetStorage() {
  const m = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, String(v));
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
  (globalThis as unknown as { window: unknown }).window = globalThis;
}

const setLS = (k: string, v: unknown) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(k, JSON.stringify(v));

const plans = [
  { id: 1, nivel: 1 },
  { id: 0, nivel: 0 },
];

const baseOpts = {
  targetId: 'BAN1',
  netId: 'san',
  planId: '0',
  plans,
  counts: {},
  hidro: {},
  engine: null,
};

beforeEach(resetStorage);

describe('aggBajanteAsociado', () => {
  it('prioriza el libro ucAplicado del bajante', () => {
    setLS('civilflow_trazos_1', {
      ramales: [{ id: 'RS1', net: 'san' }],
      bajantes: [{ id: 'BAN2', net: 'san' }],
    });
    setLS('civilflow_aparatos_by_tramo_v2', { san_BAN2_1: { duc: 9 } });
    const agg = aggBajanteAsociado({
      ...baseOpts,
      liveBaj: { id: 'BAN1', origenId: '1|BAN2', ucAplicado: { san_RS1_0: { sif: 2 } } },
      counts: { san_BAN2_1: { duc: 9 } },
    });
    expect(agg).toEqual({ sif: 2 });
  });

  it('sin libro: espeja el árbol real del bajante origen (12, no la suma local 16)', () => {
    setLS('civilflow_trazos_1', {
      ramales: [],
      bajantes: [{ id: 'BAN2', net: 'san', ucAcum: 12 }],
    });
    setLS('civilflow_aparatos_by_tramo_v2', {
      san_BAN2_1: { sif: 2, lvm: 1, ino: 1, duc: 1 }, // árbol del origen = 12 UD ponderadas
    });
    const agg = aggBajanteAsociado({
      ...baseOpts,
      liveBaj: { id: 'BAN1', origenId: '1|BAN2' },
      counts: { san_BAN2_1: { sif: 2, lvm: 1, ino: 1, duc: 1 } },
    });
    expect(agg).toEqual({ sif: 2, lvm: 1, ino: 1, duc: 1 });
  });

  it('sin punteros de asociación → null (el caller cae a su ruta normal)', () => {
    const agg = aggBajanteAsociado({ ...baseOpts, liveBaj: { id: 'BAN9' } });
    expect(agg).toBeNull();
    expect(aggBajanteAsociado({ ...baseOpts, liveBaj: null })).toBeNull();
  });
});
