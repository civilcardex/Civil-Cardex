import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyBajanteAssociation,
  clearBajanteAssociation,
} from '../../../utils/bajanteAssociation';
import type { IPlanoEngineCore } from '../PlanoState';
import { resolveJunctionEntrant } from '../../../utils/flowDirection';

// MONTANTES asociados entre pisos (orig. usuario): el mismo funcionamiento de bajantes —
// Ldesvio + anillo + fantasma cuando no están alineados y herencia de UDs — pero los montantes
// SIEMPRE fluyen 'sube': la asociación no les estampa 'baja' aunque el destino esté abajo.

function makeEngine(loadedPlanId: string): IPlanoEngineCore {
  return {
    _loadedPlanId: loadedPlanId,
    bajantes: [],
    ramales: [],
    crossFloorGhosts: [],
    nivelActual: { label: 'P2', n: 2, npt: 3 },
    scaleM: 0.5,
    updateElementById: () => {},
    render: () => {},
    _markDirty: () => {},
  } as unknown as IPlanoEngineCore;
}

interface Trazos {
  ramales?: Array<{ id: string; pts?: number[][] }>;
  bajantes?: Array<{
    id: string;
    direccion?: string;
    descargaEnId?: string | null;
    origenId?: string | null;
    desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
  }>;
  crossFloorGhosts?: Array<{ id: string; targetBajanteId?: string }>;
}

const read = (planId: string): Trazos =>
  JSON.parse(localStorage.getItem('civilflow_trazos_' + planId) || '{}') as Trazos;

const seedMontantes = () => {
  localStorage.clear();
  const set = (k: string, v: unknown) => localStorage.setItem('civilflow_' + k, JSON.stringify(v));
  // Superior plan 2 (MON2 en 100,80), inferior plan 1 (MON1 en 300,200) — desalineados.
  set('trazos_2', {
    ramales: [],
    bajantes: [{ id: 'MON2_af', net: 'af', tipo: 'montante', x: 100, y: 80 }],
  });
  set('trazos_1', {
    ramales: [],
    bajantes: [{ id: 'MON1_af', net: 'af', tipo: 'montante', x: 300, y: 200 }],
  });
};

const endpoint = (
  planId: string,
  id: string,
  x: number,
  y: number,
  nivelN: number,
  npt: number,
) => ({
  planId,
  id,
  x,
  y,
  net: 'af',
  dNominal: '1"',
  code: id,
  nivelN,
  npt,
  tipo: 'montante',
});

const plans = [
  { id: '1', status: 'confirmed' },
  { id: '2', status: 'confirmed' },
] as unknown as Parameters<typeof applyBajanteAssociation>[3];

describe('montantes asociados entre pisos', () => {
  beforeEach(seedMontantes);

  it('desalineados: LD + anillo + fantasma como bajantes, y direccion SIEMPRE sube', () => {
    const eng = makeEngine('2');
    applyBajanteAssociation(
      eng,
      endpoint('2', 'MON2_af', 100, 80, 2, 3),
      endpoint('1', 'MON1_af', 300, 200, 1, 0),
      plans,
    );
    const lower = read('1');
    const upper = read('2');
    // LD_<superior> en el piso de la montante inferior, desde la posición de la superior.
    const ld = lower.ramales?.find((r) => r.id === 'LD_MON2_af');
    expect(ld?.pts).toEqual([
      [100, 80],
      [300, 200],
    ]);
    // Anillo en la montante inferior.
    const desp = lower.bajantes?.find((b) => b.id === 'MON1_af')?.desplazamientos ?? {};
    expect(Object.values(desp).some((d) => d.Ldesvio === 'LD_MON2_af')).toBe(true);
    // Fantasma en el piso superior.
    expect(upper.crossFloorGhosts?.some((g) => g.targetBajanteId === 'MON2_af')).toBe(true);
    // AMBOS extremos 'sube' — aunque el destino esté abajo (montante nunca 'baja').
    expect(upper.bajantes?.find((b) => b.id === 'MON2_af')?.direccion).toBe('sube');
    expect(lower.bajantes?.find((b) => b.id === 'MON1_af')?.direccion).toBe('sube');
    // Punteros de la asociación.
    expect(upper.bajantes?.find((b) => b.id === 'MON2_af')?.descargaEnId).toBe('1|MON1_af');
    expect(lower.bajantes?.find((b) => b.id === 'MON1_af')?.origenId).toBe('2|MON2_af');
  });

  it('quitar limpia punteros, direccion no toca y LD fuera', () => {
    const eng = makeEngine('2');
    applyBajanteAssociation(
      eng,
      endpoint('2', 'MON2_af', 100, 80, 2, 3),
      endpoint('1', 'MON1_af', 300, 200, 1, 0),
      plans,
    );
    clearBajanteAssociation(eng, '2', 'MON2_af', 'af', '1|MON1_af', plans);
    const lower = read('1');
    const upper = read('2');
    expect(upper.bajantes?.find((b) => b.id === 'MON2_af')?.descargaEnId ?? null).toBeNull();
    expect(lower.ramales?.some((r) => r.id === 'LD_MON2_af')).toBe(false);
  });
});

describe('regla de UDs en nodos AF/AC/gas — la pata única lleva el total', () => {
  const leg = (id: string, originAtJc: boolean) => ({
    id,
    pts: originAtJc
      ? [
          [0, 0],
          [50, 0],
        ]
      : [
          [50, 0],
          [0, 0],
        ],
  });

  it('2 salidas + 1 entrada: la ENTRADA (minoritaria) es la pata del total', () => {
    // Flujo llega por R_ent (origen lejos de jc) y sale por R_s1/R_s2 (origen EN jc).
    const entrante = resolveJunctionEntrant(
      [0, 0],
      { id: 'R_ent', pts: leg('R_ent', false).pts },
      { id: 'R_auto', pts: leg('R_auto', true).pts },
      { id: 'R_s2', pts: leg('R_s2', true).pts },
    );
    expect(entrante).toBe('R_ent');
  });

  it('2 entradas + 1 salida: la SALIDA (minoritaria) es la pata del total', () => {
    // Llegan R_e1 y R_e2; solo R_sal sale del nodo.
    const salida = resolveJunctionEntrant(
      [0, 0],
      { id: 'R_e1', pts: leg('R_e1', false).pts },
      { id: 'R_sal', pts: leg('R_sal', true).pts },
      { id: 'R_e2', pts: leg('R_e2', false).pts },
    );
    expect(salida).toBe('R_sal');
  });
});
