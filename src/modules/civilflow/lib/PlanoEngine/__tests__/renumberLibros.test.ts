import { describe, it, expect, beforeEach } from 'vitest';
import { _renumberRamales, renameRamalId } from '../networkRenumber.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { leerHeredadosPresion, propagarAparatosPresion } from '../../../utils/propagation';
import { sigma } from '../../../utils/__tests__/sigmaHelper.ts';

// Renumerar/renombrar migraba el disco (aparatos_by_tramo_v2) pero dejaba huérfanos los
// libros de la propagación (heredados + trib): fase A sin memoria volvía "manual" todo
// lo propagado y la Σ explotaba (orig. usuario: ducha/tina ×4 con filas en 1).

function setL(key: string, val: unknown) {
  localStorage.setItem('civilflow_' + key, JSON.stringify(val));
}
function getL(key: string): Record<string, Record<string, number>> {
  return JSON.parse(localStorage.getItem('civilflow_' + key) || '{}');
}

function RAC(id: string, extra: Partial<PlanoRamal> = {}): PlanoRamal {
  return {
    id,
    net: 'ac',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [10, 0],
    ],
    totalL: 1,
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
    ...extra,
  } as PlanoRamal;
}

function sigmaDucha(keys: string[]): number {
  return sigma(keys, 'ducha');
}

beforeEach(() => {
  localStorage.clear();
});

describe('_renumberRamales migra disco + libros con scoping por piso', () => {
  it('RAC4→RAC1 en P2 mueve las 3 claves sin tocar P1', () => {
    setL('aparatos_by_tramo_v2', { ac_RAC4_2: { ducha: 1 }, ac_RAC4_1: { ducha: 9 } });
    setL('aparatos_heredados_v1', { ac_RAC4_2: { ducha: 1 }, ac_RAC4_1: { ducha: 9 } });
    setL('aparatos_heredados_trib_v1', { ac_RAC4_2: { ducha: 1 } });
    const eng = {
      ramales: [RAC('RAC4')],
      bajantes: [],
      _loadedPlanId: '2',
      _netCounts: { ac: { ramal: 0, tributario: 0 } },
    } as unknown as IPlanoEngineCore;
    _renumberRamales(eng, 'ac');
    expect(eng.ramales[0].id).toBe('RAC1');
    for (const store of [
      'aparatos_by_tramo_v2',
      'aparatos_heredados_v1',
      'aparatos_heredados_trib_v1',
    ]) {
      const d = getL(store);
      expect(d['ac_RAC1_2']).toEqual({ ducha: 1 });
      expect(d['ac_RAC4_2']).toBeUndefined();
    }
    // Piso ajeno intacto (incluido su libro).
    expect(getL('aparatos_by_tramo_v2')['ac_RAC4_1']).toEqual({ ducha: 9 });
    expect(getL('aparatos_heredados_v1')['ac_RAC4_1']).toEqual({ ducha: 9 });
  });
});

describe('renameRamalId migra libros y la Σ queda estable', () => {
  it('RAC2→RAC9: disco + libros viajan y re-propagar no duplica', () => {
    setL('trazos_7', {
      ramales: [
        {
          ...RAC('RAC1'),
          pts: [
            [0, 0],
            [100, 0],
          ],
          aparatoFin: 'ducha',
        },
        {
          ...RAC('RAC2'),
          pts: [
            [100, 0],
            [100, 80],
          ],
        },
      ],
      bajantes: [],
    });
    setL('aparatos_by_tramo_v2', { ac_RAC1_7: { ducha: 1 } });
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    expect(sigmaDucha(['ac_RAC1_7', 'ac_RAC2_7'])).toBe(1);
    expect(leerHeredadosPresion('ac_RAC2_7')).toEqual({ ducha: 1 });

    const eng = {
      ramales: [RAC('RAC1'), RAC('RAC2')],
      bajantes: [],
      selId: null,
      _loadedPlanId: '7',
    } as unknown as IPlanoEngineCore;
    renameRamalId(eng, 'RAC2', 'RAC9');
    // Autosave persistiría el engine mutado: se simula reescribiendo trazos.
    setL('trazos_7', {
      ramales: [
        {
          ...RAC('RAC1'),
          pts: [
            [0, 0],
            [100, 0],
          ],
          aparatoFin: 'ducha',
        },
        {
          ...RAC('RAC9'),
          pts: [
            [100, 0],
            [100, 80],
          ],
        },
      ],
      bajantes: [],
    });
    for (const store of [
      'aparatos_by_tramo_v2',
      'aparatos_heredados_v1',
      'aparatos_heredados_trib_v1',
    ]) {
      expect(getL(store)['ac_RAC2_7']).toBeUndefined();
    }
    expect(getL('aparatos_by_tramo_v2')['ac_RAC9_7']).toEqual({ ducha: 1 });
    expect(getL('aparatos_heredados_v1')['ac_RAC9_7']).toEqual({ ducha: 1 });

    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    // Sin migrar libros, fase A vería prev={} y el heredado se volvería manual (Σ=2).
    expect(sigmaDucha(['ac_RAC1_7', 'ac_RAC9_7'])).toBe(1);
  });
});
