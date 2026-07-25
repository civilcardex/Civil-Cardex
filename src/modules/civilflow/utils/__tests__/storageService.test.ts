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

import { saveToStorage, loadFromStorage, removeFromStorage } from '../../services/storageService';

describe('loadFromStorage', () => {
  it('retorna fallback si la key no existe', () => {
    expect(loadFromStorage('noexiste', 'fallback')).toBe('fallback');
  });

  it('retorna fallback si la key no existe (objeto)', () => {
    expect(loadFromStorage('noexiste', { a: 1 })).toEqual({ a: 1 });
  });

  it('retorna valor parseado si existe JSON', () => {
    saveToStorage('test_key', { x: 42, name: 'test' });
    const result = loadFromStorage('test_key', {});
    expect(result).toEqual({ x: 42, name: 'test' });
  });

  it('retorna valor string sin parsear si es string simple', () => {
    saveToStorage('test_str', 'hello');
    expect(loadFromStorage('test_str', 'default')).toBe('hello');
  });

  it('retorna valor numerico sin parsear', () => {
    saveToStorage('test_num', 123);
    expect(loadFromStorage('test_num', 0)).toBe(123);
  });

  it('retorna null si valor es null', () => {
    saveToStorage('test_null', null);
    expect(loadFromStorage('test_null', 'fallback')).toBe(null);
  });
});

describe('saveToStorage', () => {
  it('guarda y recupera objeto', () => {
    saveToStorage('obj', { items: [1, 2, 3] });
    expect(loadFromStorage('obj', null)).toEqual({ items: [1, 2, 3] });
  });

  it('guarda y recupera array', () => {
    saveToStorage('arr', [1, 'dos', { tres: 3 }]);
    expect(loadFromStorage('arr', [])).toEqual([1, 'dos', { tres: 3 }]);
  });

  it('sobrescribe valor existente', () => {
    saveToStorage('dup', 'first');
    saveToStorage('dup', 'second');
    expect(loadFromStorage('dup', 'fallback')).toBe('second');
  });
});

describe('removeFromStorage', () => {
  it('elimina una key existente', () => {
    saveToStorage('to_delete', { data: 1 });
    removeFromStorage('to_delete');
    expect(loadFromStorage('to_delete', 'fallback')).toBe('fallback');
  });

  it('no falla si la key no existe', () => {
    expect(() => removeFromStorage('no_existe')).not.toThrow();
  });
});
