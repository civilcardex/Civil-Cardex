import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pines del movimiento useFixtureAccMutations (rediseño FixturesPanel): la lógica pura
// (mutarHidroAcc/mutarGasAcc) contra stores REALES de localStorage — sin harness de React.

const mockStorage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: (i: number) => Object.keys(mockStorage)[i] ?? null,
});
vi.stubGlobal('window', { dispatchEvent: () => {} });

import { mutarHidroAcc, mutarGasAcc } from '../../components/aparatos/useAparatoAccMutaciones.ts';
import {
  loadHidroData,
  saveHidroData,
  loadGasAcc,
  saveGasAcc,
} from '../../components/aparatosAlmacenamiento.ts';

describe('mutarHidroAcc / mutarGasAcc (pines FixturesPanel)', () => {
  it('hidro: +1 crea el accesorio; −1 a cero lo elimina; idempotente en disco', () => {
    const KEY = 'san_RS1_5';
    let map = mutarHidroAcc(loadHidroData(), KEY, 'inodoro', 1);
    map = mutarHidroAcc(map, KEY, 'inodoro', 1);
    saveHidroData(map);
    expect(loadHidroData()[KEY]?.accesorios['inodoro']).toBe(2);
    map = mutarHidroAcc(loadHidroData(), KEY, 'inodoro', -1);
    map = mutarHidroAcc(map, KEY, 'inodoro', -1);
    saveHidroData(map);
    expect(loadHidroData()[KEY]?.accesorios['inodoro']).toBeUndefined();
  });

  it('gas: −1 a cero BORRA la clave completa (sin cascarón vacío)', () => {
    const KEY = 'gas_RG1_5';
    let map = mutarGasAcc(loadGasAcc(), KEY, 'manguera', 1);
    saveGasAcc(map);
    expect(loadGasAcc()[KEY]).toEqual({ manguera: 1 });
    map = mutarGasAcc(loadGasAcc(), KEY, 'manguera', -1);
    saveGasAcc(map);
    expect(loadGasAcc()[KEY]).toBeUndefined();
  });

  it('gas: otras claves del mapa sobreviven a la poda', () => {
    const semilla = { gas_RG1_5: { manguera: 2 }, gas_RG2_5: { codos_90_std: 3 } };
    saveGasAcc(semilla);
    let map = mutarGasAcc(loadGasAcc(), 'gas_RG1_5', 'manguera', -1);
    map = mutarGasAcc(map, 'gas_RG1_5', 'manguera', -1);
    saveGasAcc(map);
    expect(loadGasAcc()).toEqual({ gas_RG2_5: { codos_90_std: 3 } });
    expect(loadGasAcc()['gas_RG1_5']).toBeUndefined();
  });
});
