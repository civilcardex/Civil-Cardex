import { describe, it, expect } from 'vitest';
import { propagarAparatosPresion, diagUltimaPropagacion } from '../propagation';
import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY } from '../../constants/almacenamientoClaves.ts';

/**
 * Smoke del propagador de presión: un ramal con UN lavamanos debe quedar con su carga
 * en el diag. Antes este archivo solo hacía `expect(true).toBe(true)`: no fallaba nunca,
 * así que daba falsa cobertura del motor de propagación (el corazón del cálculo de UC).
 */
describe('propagación de presión', () => {
  it('el ramal con un lavamanos aparece en el diag con su carga', () => {
    localStorage.clear();
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({
        ramales: [
          {
            id: 'RAF1',
            net: 'af',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [100, 0],
            ],
            label: 'RAF1',
          },
        ],
        bajantes: [],
      }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ af_RAF1_2: { lvm: 1 } }),
    );

    propagarAparatosPresion('af');

    const diag = diagUltimaPropagacion() as {
      net?: string;
      piezas?: Array<{ id: string; disk?: Record<string, number> }>;
    };
    expect(diag).toBeDefined();
    expect(diag.net).toBe('af');
    const raf1 = (diag.piezas || []).find((p) => p.id === 'RAF1');
    expect(raf1).toBeDefined();
    // El aparato asignado al ramal viaja en su disco.
    expect(raf1!.disk).toEqual({ lvm: 1 });
  });
});
