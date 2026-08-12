import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
});

import { saveToStorage, loadFromStorage } from '../../services/storageService';
import { APARATOS_BY_TRAMO_KEY } from '../../constants/storage-keys';
import { moveAllAparatoCounts } from '../syncExtremeAccessory';
import { directNeighborRamales } from '../flowDirection';

describe('moveAllAparatoCounts', () => {
  it('mueve el record completo de origen a destino y limpia el origen', () => {
    saveToStorage(APARATOS_BY_TRAMO_KEY, {
      af_RS1_10: { lava: 2, ducha: 1 },
      af_RS2_10: { sif: 3 },
    });
    moveAllAparatoCounts('af', 'RS1', 'RS2', 10);
    const all = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    expect(all['af_RS1_10']).toBeUndefined();
    expect(all['af_RS2_10']).toEqual({ sif: 3, lava: 2, ducha: 1 });
  });

  it('suma sobre lo que el destino ya tuviera', () => {
    saveToStorage(APARATOS_BY_TRAMO_KEY, {
      gas_G1_5: { cocina: 2 },
      gas_G2_5: { cocina: 1, calentador: 1 },
    });
    moveAllAparatoCounts('gas', 'G1', 'G2', 5);
    const all = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    expect(all['gas_G2_5']).toEqual({ cocina: 3, calentador: 1 });
  });

  it('no toca nada si el origen no tiene record', () => {
    saveToStorage(APARATOS_BY_TRAMO_KEY, { ac_R1_3: { lava: 1 } });
    moveAllAparatoCounts('ac', 'inexistente', 'R1', 3);
    const all = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    expect(all).toEqual({ ac_R1_3: { lava: 1 } });
  });

  it('no mezcla redes: solo mueve la clave del net solicitado', () => {
    saveToStorage(APARATOS_BY_TRAMO_KEY, {
      af_R1_3: { lava: 1 },
      gas_R1_3: { cocina: 1 },
    });
    moveAllAparatoCounts('af', 'R1', 'R2', 3);
    const all = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    expect(all['af_R1_3']).toBeUndefined();
    expect(all['af_R2_3']).toEqual({ lava: 1 });
    expect(all['gas_R1_3']).toEqual({ cocina: 1 });
  });
});

describe('directNeighborRamales', () => {
  const ramales = [
    {
      id: 'R1',
      net: 'af',
      pts: [
        [0, 0],
        [10, 0],
      ],
    },
    {
      id: 'R2',
      net: 'af',
      pts: [
        [10, 0],
        [20, 0],
      ],
    },
    {
      id: 'R3',
      net: 'af',
      pts: [
        [10, 0.1],
        [10, 10],
      ],
    },
    {
      id: 'R4',
      net: 'ac',
      pts: [
        [10, 0],
        [30, 0],
      ],
    },
    {
      id: 'R5',
      net: 'af',
      pts: [
        [50, 50],
        [60, 50],
      ],
    },
  ];

  it('devuelve vecinos que comparten extremo en la misma red', () => {
    const neighbors = directNeighborRamales(ramales, ramales[0]);
    expect(neighbors.map((n) => n.id).sort()).toEqual(['R2', 'R3']);
  });

  it('excluye ramales de otra red aunque compartan punto', () => {
    const neighbors = directNeighborRamales(ramales, ramales[0]);
    expect(neighbors.some((n) => n.id === 'R4')).toBe(false);
  });

  it('excluye el propio ramal', () => {
    const neighbors = directNeighborRamales(ramales, ramales[1]);
    expect(neighbors.map((n) => n.id).sort()).toEqual(['R1', 'R3']);
    expect(neighbors.every((n) => n.id !== 'R2')).toBe(true);
  });

  it('no devuelve ramales sin conexión', () => {
    expect(directNeighborRamales(ramales, ramales[4])).toEqual([]);
  });

  it('tolera ramales sin pts (los ignora sin crashear)', () => {
    const weird = [{ id: 'X', net: 'af', pts: [] as number[][] }, ...ramales];
    const neighbors = directNeighborRamales(weird, weird[1]);
    expect(neighbors.map((n) => n.id).sort()).toEqual(['R2', 'R3']);
  });
});
