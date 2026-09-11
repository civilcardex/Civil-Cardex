import { describe, it, expect, beforeEach } from 'vitest';
import { writeSanDrawingSync, setSyncLoadedLiveIds } from '../drawingSync';
import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY } from '../../constants/storage-keys';

// Guard del GC (bug "recargar reseteaba las UDs del piso 2 a 0"): el barrido de claves
// huérfanas se guía por las cachés locales; si la caché del piso cargado quedó vieja, las
// claves de aparatos de ramales recientes parecían huérfanas y se borraban. Con el guard,
// una clave del piso cargado cuyo id está vivo en el engine nunca se borra.

function resetLS() {
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

const PLANS = [{ id: '2', name: 'P2', nivel: 1, npt: 320, status: 'confirmed' }] as never;

describe('GC de sync — guard del piso cargado', () => {
  beforeEach(() => {
    resetLS();
    setSyncLoadedLiveIds(null, []);
  });

  it('caché vieja sin el ramal: la clave del piso cargado con id vivo en el engine SOBREVIVE', () => {
    // Caché local vieja: solo RS4 (RS9 se dibujó después y el autosave de trazos aún no corre).
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({ ramales: [{ id: 'RS4', net: 'san' }], bajantes: [] }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ san_RS9_2: { lav: 2 }, san_RS4_2: { san: 1 } }),
    );
    // Engine vivo: RS9 existe.
    setSyncLoadedLiveIds('2', ['RS4', 'RS9']);

    writeSanDrawingSync(PLANS);

    const counts = JSON.parse(
      localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}',
    ) as Record<string, unknown>;
    expect(counts['san_RS9_2']).toEqual({ lav: 2 });
    expect(counts['san_RS4_2']).toEqual({ san: 1 });
  });

  it('sin guard, la clave huérfana se borra (comportamiento de limpieza intacto)', () => {
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({ ramales: [{ id: 'RS4', net: 'san' }], bajantes: [] }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ san_MUERTO_2: { lav: 1 }, san_RS4_2: { san: 1 } }),
    );

    writeSanDrawingSync(PLANS);

    const counts = JSON.parse(
      localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}',
    ) as Record<string, unknown>;
    expect(counts['san_MUERTO_2']).toBeUndefined();
    expect(counts['san_RS4_2']).toEqual({ san: 1 });
  });
});
