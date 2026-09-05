import { describe, it, expect, beforeEach } from 'vitest';
import { validateBeforeClose } from './closeValidation';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { PlanoRamal } from '../../lib/PlanoEngine/PlanoState';

// Conversión ramal↔tributario: solo cambia el tipo del trazo — la carga (aparatos en el mapa
// o fixtures en el propio elemento) debe seguir cubriendo el UC/UD del cierre (orig. usuario:
// convertir un ramal con aparatos disparaba "UC/UD pendientes" nombrando al T{n} nuevo).
function resetStorage() {
  (globalThis as unknown as { localStorage: Storage }).localStorage = (() => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, String(v)),
      removeItem: (k: string) => m.delete(k),
      clear: () => m.clear(),
      key: (_i: number) => null,
      get length() {
        return m.size;
      },
    };
  })();
}
const setLS = (k: string, v: unknown) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(k, JSON.stringify(v));

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'RS2',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
    ],
    totalL: 0,
    label: 'RS2',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '2"',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

function makeEngine(ramales: PlanoRamal[]): PlanoEngine {
  return {
    ramales,
    bajantes: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    selId: null,
    activeNet: 'san',
    _loadedPlanId: 1,
    _hiddenNets: new Set(),
  } as unknown as PlanoEngine;
}

const alertas: { title: string; msg: string }[] = [];
const onAlert = (title: string, msg: string) => alertas.push({ title, msg });

// Padre RS1 con carga propia: solo el elemento en prueba puede disparar la alerta.
const RS1 = () => R({ id: 'RS1', label: 'RS1', uc: 5 });

describe('validateBeforeClose — conversión ramal↔tributario', () => {
  beforeEach(() => {
    resetStorage();
    alertas.length = 0;
  });

  it('ramal→tributario con aparatos en el mapa (id conservado) NO dispara la alerta', () => {
    setLS('civilflow_aparatos_by_tramo_v2', { san_RS2_1: { lv: 2 } });
    const trib = R({ tipo: 'tributario', padre: 'RS1', label: 'T1RS1' });
    const eng = makeEngine([RS1(), trib]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('tributario con aparatos como fixtures EN el elemento NO dispara la alerta', () => {
    const trib = R({
      tipo: 'tributario',
      padre: 'RS1',
      label: 'T1RS1',
      fixtures: { lv: 2 },
    });
    const eng = makeEngine([RS1(), trib]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('tributario→ramal con aparatos migrados por renameRamalId (id nuevo) NO dispara', () => {
    // convertToRamal renombra T1788→RS9 y renameRamalId migra los aparatos a la clave nueva.
    setLS('civilflow_aparatos_by_tramo_v2', { san_RS9_1: { lv: 2 } });
    const ramal = R({ id: 'RS9', label: 'RS9', uc: 0 });
    const eng = makeEngine([RS1(), ramal]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(true);
    expect(alertas).toHaveLength(0);
  });

  it('tributario SIN carga ninguna sí dispara (la validación sigue funcionando)', () => {
    const trib = R({ tipo: 'tributario', padre: 'RS1', label: 'T1RS1' });
    const eng = makeEngine([RS1(), trib]);
    expect(validateBeforeClose(eng, [], onAlert)).toBe(false);
    expect(alertas[0]?.title).toBe('UC/UD pendientes');
    expect(alertas[0]?.msg).toContain('T1RS1');
  });

  it('barrido de planos confirmados: trazo del tributario con aparatos en el mapa NO dispara', () => {
    setLS('civilflow_aparatos_by_tramo_v2', { san_RS2_1: { lv: 2 } });
    setLS('civilflow_trazos_1', {
      ramales: [{ id: 'RS2', net: 'san', tipo: 'tributario', label: 'T1RS1', diametro: '2"' }],
      bajantes: [],
    });
    const trib = R({ tipo: 'tributario', padre: 'RS1', label: 'T1RS1' });
    const eng = makeEngine([RS1(), trib]);
    const planos = [{ id: 1, status: 'confirmed' }];
    expect(validateBeforeClose(eng, planos as never, onAlert)).toBe(true);
  });
});
