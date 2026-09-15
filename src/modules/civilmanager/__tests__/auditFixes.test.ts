import { describe, it, expect, beforeEach } from 'vitest';
import { migrateState, defaultState } from '../storage';
import { calcAPU, parseNum } from '../calc';
import { findContadorBajante } from '../../civilflow/utils/writeDiameterToDrawing';
// findContadorBajante vive en civilflow/utils — path relativo desde civilmanager/__tests:
import type { Apu, Insumo } from '../types';

// Fixes de la auditoría 2026-09-14: RPC con forma inesperada no debe tumbar la carga;
// 0 es un valor legítimo de consumo/desperdicio; el diámetro del contador viaja a la FILA editada.

function resetLS() {
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

describe('migrateState con forma inesperada del RPC', () => {
  beforeEach(resetLS);

  it('claves null (apus/equipos/insumos/cuadrillas/proveedores) caen al base sin TypeError', () => {
    const raw = {
      apus: null,
      equipos: undefined,
      insumos: null,
      cuadrillas: undefined,
      proveedores: null,
      presupuestos: [],
    } as never;
    const st = migrateState(raw);
    expect(st.apus).toEqual([]);
    expect(st.equipos).toEqual([]);
    expect(st.insumos).toEqual([]);
    expect(st.cuadrillas).toEqual([]);
    expect(st.proveedores).toEqual([]);
    expect(st.cargos.length).toBe(defaultState().cargos.length); // ids son randomUUID por llamada
  });
});

describe('calcAPU: 0 legítimo en consumo y desperdicio', () => {
  beforeEach(resetLS);

  const insumo = (): Insumo =>
    ({
      id: 'ins1',
      codigo: 'I1',
      nombre: 'Cemento',
      unidad: 'KG',
      origen: 'Local',
      categoria: 'C1',
      subcategoria: '',
      marca_referencia: '',
      costo_unitario: 100,
      fecha_cotizacion: '',
      apu_basico_id: '',
      proveedor_id: '',
    }) as Insumo;

  const apuCon = (recursosIns: Array<Record<string, unknown>>): Apu =>
    ({
      id: 'a1',
      codigo: 'APU-1',
      nombre: 'Zapata',
      categoria: 'C',
      unidad: 'M3',
      fecha_creacion: '',
      es_basico: false,
      recursos_mo: [],
      recursos_eq: [],
      recursos_ins: recursosIns as never,
      recursos_transporte: [],
    }) as Apu;

  it('consumo 0 aporta 0 (antes contaba como 1)', () => {
    const r = calcAPU(
      apuCon([{ insumo_id: 'ins1', consumo: 0, desperdicios_pct: 0 }]),
      [],
      [],
      [insumo()],
      null,
      0,
      1,
      false,
      false,
    );
    expect(r.subIns).toBe(0);
  });

  it('desperdicio 0% no se cobra como 5%', () => {
    const r = calcAPU(
      apuCon([{ insumo_id: 'ins1', consumo: 2, desperdicios_pct: 0 }]),
      [],
      [],
      [insumo()],
      null,
      0,
      1,
      false,
      false,
    );
    expect(r.subIns).toBe(200);
  });

  it('campo vacío cuenta 0 (parseNum normaliza vacío→0; 0 no se infla)', () => {
    const r = calcAPU(
      apuCon([{ insumo_id: 'ins1', consumo: '', desperdicios_pct: '' }]),
      [],
      [],
      [insumo()],
      null,
      0,
      1,
      false,
      false,
    );
    expect(r.subIns).toBe(0);
  });
});

describe('findContadorBajante con objetivo de fila', () => {
  beforeEach(resetLS);

  it('devuelve la FILA pedida (planId+id), no el primer contador del proyecto', () => {
    const ls = (globalThis as unknown as { localStorage: Storage }).localStorage;
    ls.setItem(
      'civilflow_trazos_1',
      JSON.stringify({
        ramales: [],
        bajantes: [{ id: 'BAN1', net: 'gas', tipo: 'contador', dNominal: '2"' }],
      }),
    );
    ls.setItem(
      'civilflow_trazos_2',
      JSON.stringify({
        ramales: [],
        bajantes: [{ id: 'BAN1', net: 'gas', tipo: 'contador', dNominal: '4"' }],
      }),
    );
    const plans = [
      { id: 1, status: 'confirmed' },
      { id: 2, status: 'confirmed' },
    ] as never;
    const first = findContadorBajante(plans, 'gas');
    expect(first?.planId).toBe(1);
    const objetivo = findContadorBajante(plans, 'gas', { planId: 2, id: 'BAN1' });
    expect(objetivo?.planId).toBe(2);
    expect(objetivo?.bajante.id).toBe('BAN1');
  });
});

describe('parseNum', () => {
  it.each([
    ['3,5', 3.5],
    ['', 0],
    ['abc', 0],
  ])('parseNum(%p) → %p', (input, expected) => {
    expect(parseNum(input)).toBe(expected);
  });
});
