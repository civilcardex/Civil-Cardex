import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Asociar o desasociar entre pisos no debe borrar lo que el usuario acaba de dibujar: el storage va 1,5 s detrás del motor.
 * Ej: motor con un ramal nuevo + storage viejo -> aplicar el cambio conserva el ramal nuevo.
 */

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  const g = globalThis as Record<string, unknown>;
  g.localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => {
      mockStorage[k] = v;
    },
    removeItem: (k: string) => {
      delete mockStorage[k];
    },
    get length() {
      return Object.keys(mockStorage).length;
    },
    key: (i: number) => Object.keys(mockStorage)[i] ?? null,
  };
  g.window = { dispatchEvent: () => {} };
});

import { aplicarEnDocDePlan } from '../writePlanDoc';
import { registrarLdesvioComoAsociado } from '../bajanteAssocShared';

const docGuardado = (planId: string) =>
  JSON.parse(mockStorage[`civilflow_trazos_${planId}`] || '{}') as {
    bajantes?: Array<Record<string, unknown>>;
    ramales?: Array<Record<string, unknown>>;
  };

describe('aplicarEnDocDePlan', () => {
  it('plano ABIERTO: muta el estado vivo del motor y NO pisa lo dibujado', () => {
    // El storage tiene el doc VIEJO (sin el ramal recién dibujado).
    mockStorage['civilflow_trazos_1'] = JSON.stringify({
      bajantes: [{ id: 'MON1', recibeDeIds: [] }],
      ramales: [],
    });
    // El motor tiene el ramal nuevo (el usuario lo acaba de dibujar).
    const motor = {
      _loadedPlanId: '1',
      bajantes: [{ id: 'MON1', recibeDeIds: [] }],
      ramales: [{ id: 'R9', pts: [[0, 0]] }],
      saveWork: () => ({
        bajantes: [{ id: 'MON1', recibeDeIds: ['LD1'] }],
        ramales: [{ id: 'R9' }, { id: 'LD1' }],
      }),
    };
    aplicarEnDocDePlan(motor, '1', (doc) => {
      const b = (doc.bajantes || [])[0] as { recibeDeIds?: string[] };
      b.recibeDeIds = ['LD1'];
    });
    // El motor recibió el cambio (no el doc viejo del storage).
    expect(motor.bajantes[0].recibeDeIds).toEqual(['LD1']);
    // Y lo persistido conserva el ramal dibujado (no se machaca).
    const guardado = docGuardado('1');
    expect(guardado.ramales?.some((r) => r.id === 'R9')).toBe(true);
  });

  it('plano CERRADO: muta el doc del storage y lo guarda', () => {
    mockStorage['civilflow_trazos_2'] = JSON.stringify({
      bajantes: [{ id: 'MON2', recibeDeIds: [] }],
      ramales: [],
    });
    aplicarEnDocDePlan(null, '2', (doc) => {
      const b = (doc.bajantes || [])[0] as { recibeDeIds?: string[] };
      b.recibeDeIds = ['LD2'];
    });
    expect(docGuardado('2').bajantes?.[0].recibeDeIds).toEqual(['LD2']);
  });

  it('plano inexistente: no rompe ni escribe nada', () => {
    expect(() => aplicarEnDocDePlan(null, '99', () => {})).not.toThrow();
    expect(mockStorage['civilflow_trazos_99']).toBeUndefined();
  });
});

describe('registrarLdesvioComoAsociado', () => {
  it('con el motor abierto NO borra lo dibujado en ese plano', () => {
    mockStorage['civilflow_trazos_1'] = JSON.stringify({
      bajantes: [{ id: 'MON1', recibeDeIds: [], asocManual: [] }],
      ramales: [],
    });
    const motor = {
      _loadedPlanId: '1',
      bajantes: [{ id: 'MON1', recibeDeIds: [], asocManual: [] }],
      ramales: [{ id: 'R9', pts: [[0, 0]] }],
      saveWork: () => ({
        bajantes: [{ id: 'MON1', recibeDeIds: ['LD1'], asocManual: ['LD1'] }],
        ramales: [{ id: 'R9' }, { id: 'LD1', fin: 'MON1' }],
      }),
    };
    registrarLdesvioComoAsociado({
      planId: '1',
      bajanteId: 'MON1',
      bajanteCode: 'MON1',
      ldId: 'LD1',
      eng: motor,
    });
    // El estado vivo: el LD queda asociado y el ramal dibujado sigue ahí.
    expect(motor.bajantes[0].recibeDeIds).toEqual(['LD1']);
    expect(motor.bajantes[0].asocManual).toEqual(['LD1']);
    expect(motor.ramales.some((r) => r.id === 'R9')).toBe(true);
  });
});
