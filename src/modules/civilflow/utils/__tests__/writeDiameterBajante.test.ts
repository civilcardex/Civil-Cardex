import { describe, it, expect, beforeEach } from 'vitest';
import { writeDiametroToDrawing } from '../writeDiameterToDrawing';
import { loadFromStorage } from '../../services/storageService';
import type { SyncPlanInput } from '../drawingSync';

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

const plans = [{ id: 1, status: 'confirmed' as const }] as unknown as SyncPlanInput[];

function seed() {
  resetStorage();
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
    'civilflow_trazos_1',
    JSON.stringify({
      v: 3,
      ts: 1,
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [40, 0],
          ],
          diametro: '2"',
        },
        {
          id: 'RS2',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [40, 0],
            [80, 0],
          ],
          diametro: '2"',
        },
      ],
      bajantes: [
        {
          id: 'B1',
          net: 'san',
          tipo: 'bajante',
          x: 80,
          y: 0,
          dNominal: '2"',
          recibeDeIds: ['RS1', 'RS2'],
        },
      ],
    }),
  );
}

function bajantes() {
  const raw = loadFromStorage<{ bajantes: Array<{ id: string; dNominal?: string }> } | null>(
    'trazos_1',
    null,
  );
  return raw?.bajantes || [];
}

describe('tabla cambia ramal — el bajante sube al mayor', () => {
  beforeEach(seed);

  it('sube dNominal del bajante conectado', () => {
    const res = writeDiametroToDrawing('RS1-1', 'san', '4"', plans);
    expect(res.ok).toBe(true);
    expect(bajantes().find((b) => b.id === 'B1')?.dNominal).toBe('4"');
  });

  it('sigue hacia abajo cuando baja el máximo', () => {
    let res = writeDiametroToDrawing('RS1-1', 'san', '4"', plans);
    expect(res.ok).toBe(true);
    expect(bajantes().find((b) => b.id === 'B1')?.dNominal).toBe('4"');
    res = writeDiametroToDrawing('RS1-1', 'san', '2"', plans);
    expect(res.ok).toBe(true);
    // RS2 sigue en 2": el máximo queda en 2" y el bajante lo sigue.
    expect(bajantes().find((b) => b.id === 'B1')?.dNominal).toBe('2"');
  });

  it('no baja del otro ramal mayor ni del oversize explícito', () => {
    let res = writeDiametroToDrawing('RS1-1', 'san', '4"', plans);
    expect(res.ok).toBe(true);
    res = writeDiametroToDrawing('RS2-1', 'san', '6"', plans);
    expect(res.ok).toBe(true);
    expect(bajantes().find((b) => b.id === 'B1')?.dNominal).toBe('6"');
    // RS1 baja a 2" pero RS2 sostiene 6": el bajante se queda.
    res = writeDiametroToDrawing('RS1-1', 'san', '2"', plans);
    expect(res.ok).toBe(true);
    expect(bajantes().find((b) => b.id === 'B1')?.dNominal).toBe('6"');
  });
});
