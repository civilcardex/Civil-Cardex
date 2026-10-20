import { describe, it, expect } from 'vitest';
import { propagarAparatosPresion, diagUltimaPropagacion } from '../propagation';
import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY } from '../../constants/storage-keys';

describe('debug', () => {
  it('propaga', () => {
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
    console.log('DIAG', JSON.stringify(diagUltimaPropagacion()).slice(0, 1200));
    expect(true).toBe(true);
  });
});
