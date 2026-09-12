import { describe, it, expect, beforeEach } from 'vitest';
import { prefetchAllTrazos } from '../prefetchTrazos';
import { readSanDrawingSync } from '../drawingSync';
import { loadFromStorage } from '../../services/storageService';

// Prefetch global de trazos: con TODOS los pisos ya en caché local no toca la BD y deja las
// claves de sync re-escritas + la migración de asociaciones aplicada (marca assocLayout: 2).
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
  // saveTrazosToDB/supabase referencian window en runtime — node no lo tiene.
  (globalThis as unknown as { window: unknown }).window = globalThis;
}
const setLS = (k: string, v: unknown) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(k, JSON.stringify(v));

const plans = [
  { id: 1, nivel: 1, name: 'P1', status: 'confirmed' },
  { id: 2, nivel: 2, name: 'P2', status: 'confirmed' },
] as unknown as Parameters<typeof prefetchAllTrazos>[0];

describe('prefetchAllTrazos', () => {
  beforeEach(() => {
    resetStorage();
    // Asociación con layout viejo: ghost en el piso inferior (plan 1), Ldesvio + anillo en el
    // piso superior (plan 2).
    setLS('civilflow_trazos_1', {
      ramales: [],
      bajantes: [{ id: 'BAN8', net: 'san', tipo: 'bajante', x: 300, y: 200 }],
      crossFloorGhosts: [
        {
          id: 'XFG_BAN9_2',
          net: 'san',
          code: 'BAN9',
          x: 100,
          y: 80,
          dNominal: '4"',
          direccion: 'sube',
          parentDireccion: 'baja',
          piso: 'P2',
          sourcePlanId: '2',
          sourceBajanteId: 'BAN9',
          targetBajanteId: 'BAN8',
        },
      ],
    });
    setLS('civilflow_trazos_2', {
      ramales: [
        {
          id: 'LD_BAN9',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [100, 80],
            [300, 200],
          ],
        },
      ],
      bajantes: [
        {
          id: 'BAN9',
          net: 'san',
          tipo: 'bajante',
          x: 100,
          y: 80,
          desplazamientos: { P2: { dx: 200, dy: 120, Ldesvio: 'LD_BAN9' } },
        },
      ],
    });
  });

  it('reescribe las claves de sync', async () => {
    localStorage.removeItem('civilflow_dibujo_sanitario_v1');
    await prefetchAllTrazos(plans);
    expect(readSanDrawingSync()).toBeTruthy();
  });

  it('migra la asociación al layout nuevo (LD al piso inferior, ghost al superior)', async () => {
    await prefetchAllTrazos(plans);
    const t1 = JSON.parse(localStorage.getItem('civilflow_trazos_1') || '{}');
    const t2 = JSON.parse(localStorage.getItem('civilflow_trazos_2') || '{}');
    expect(t1.ramales?.some((r: { id: string }) => r.id === 'LD_BAN9')).toBe(true);
    expect(t1.crossFloorGhosts ?? []).toHaveLength(0);
    expect(t2.crossFloorGhosts?.[0]?.sourceBajanteId).toBe('BAN8');
    expect(t2.crossFloorGhosts?.[0]?.targetBajanteId).toBe('BAN9');
    expect(t2.ramales ?? []).toHaveLength(0);
    expect((t1.assocLayout ?? 0) === 2 && (t2.assocLayout ?? 0) === 2).toBe(true);
  });

  it('es idempotente', async () => {
    await prefetchAllTrazos(plans);
    await prefetchAllTrazos(plans);
    const t1 = JSON.parse(localStorage.getItem('civilflow_trazos_1') || '{}');
    expect(t1.ramales?.filter((r: { id: string }) => r.id === 'LD_BAN9')).toHaveLength(1);
    const t2 = JSON.parse(localStorage.getItem('civilflow_trazos_2') || '{}');
    expect(t2.crossFloorGhosts ?? []).toHaveLength(1);
  });

  it('loadFromStorage sigue leyendo trazos tras el prefetch', async () => {
    await prefetchAllTrazos(plans);
    // la clave va SIN el prefijo civilflow_: loadFromStorage lo agrega internamente
    expect(loadFromStorage('trazos_1', null)).toBeTruthy();
  });
});

// Single-flight: los tres componentes que disparan el prefetch al montar deben compartir UNA
// ejecución — dos corridas concurrentes intercalan read-modify-write de documentos completos.
it('llamadas concurrentes comparten la misma promesa (una sola ejecución)', async () => {
  const p1 = prefetchAllTrazos(plans);
  const p2 = prefetchAllTrazos(plans);
  expect(p2).toBe(p1);
  await expect(p1).resolves.toBeUndefined();
  // Terminada la ejecución, una llamada nueva vuelve a correr (no comparte la vieja).
  const p3 = prefetchAllTrazos(plans);
  expect(p3).not.toBe(p1);
  await p3;
});
