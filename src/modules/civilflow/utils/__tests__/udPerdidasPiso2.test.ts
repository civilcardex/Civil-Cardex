import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  writeSanDrawingSync,
  setSyncLoadedLiveIds,
  markPlanTrazosFresh,
  reanclarClavesDesdeTrazosLocales,
} from '../drawingSync';
import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY } from '../../constants/storage-keys';

// Bug piso 2 (orig. usuario): UDs asignadas en el piso con más trazos aparecían en 0 al
// volver mucho después (símbolos intactos, hidro intacto). Cadena: la cuota muda de
// localStorage congelaba la caché local de trazos → el GC veía huérfana toda clave de
// tributarios nuevos (id≠label) y la borraba; el merge desde BD la restauraba y el
// siguiente GC la volvía a borrar. El GC ahora solo borra pisos elegibles (cargado o
// fresco de esta sesión) y respalda lo borrado en `civilflow_gc_bak_ultimo`.

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

const lsGet = (k: string) =>
  JSON.parse(localStorage.getItem('civilflow_' + k) || '{}') as Record<string, unknown>;
const lsSet = (k: string, v: unknown) => localStorage.setItem('civilflow_' + k, JSON.stringify(v));

const PLANS = [
  { id: '11', name: 'P1', nivel: 1, npt: 0, status: 'confirmed' },
  { id: '12', name: 'P2', nivel: 2, npt: 320, status: 'confirmed' },
] as never;

describe('GC con caché vieja no borra (bug piso 2)', () => {
  beforeEach(() => {
    resetLS();
    setSyncLoadedLiveIds(null, []);
  });

  it('caché vieja del piso 2 + piso 1 cargado: las claves del piso 2 SOBREVIVEN', () => {
    // P2: caché vieja (solo RS1; el tributario T se dibujó/asignó después).
    lsSet(TRAZOS_PREFIX + '12', { ramales: [{ id: 'RS1', net: 'san' }], bajantes: [] });
    lsSet(TRAZOS_PREFIX + '11', { ramales: [{ id: 'RS1', net: 'san' }], bajantes: [] });
    lsSet(APARATOS_BY_TRAMO_KEY, {
      san_TX_12: { lvm: 1 },
      san_RS1_12: { san: 1 },
      san_MUERTO_11: { lav: 1 },
      san_RS1_11: { san: 1 },
    });
    // Piso cargado = P1 (el guard solo cubre al cargado).
    setSyncLoadedLiveIds('11', ['RS1']);

    writeSanDrawingSync(PLANS);

    const counts = lsGet(APARATOS_BY_TRAMO_KEY);
    expect(counts['san_TX_12']).toEqual({ lvm: 1 });
    expect(counts['san_RS1_12']).toEqual({ san: 1 });
    // Ventana de gracia del piso cargado: el huérfano real NO se borra aún — un elemento
    // dibujado hace <1 autosave tampoco está en caché ni en los ids vivos, y borrarlo en
    // esta ventana era exactamente "se borra lo que acabo de hacer" (orig. usuario).
    expect(counts['san_MUERTO_11']).toEqual({ lav: 1 });
    expect(counts['san_RS1_11']).toEqual({ san: 1 });
    // Pasada la ventana de gracia (4s), el próximo sync limpia al huérfano real y deja
    // respaldo de lo borrado.
    setSyncLoadedLiveIds('11', ['RS1']);
    const spyAhora = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);
    writeSanDrawingSync(PLANS);
    spyAhora.mockRestore();
    const counts2 = lsGet(APARATOS_BY_TRAMO_KEY);
    expect(counts2['san_MUERTO_11']).toBeUndefined();
    expect(counts2['san_RS1_11']).toEqual({ san: 1 });
    const bak = lsGet('gc_bak_ultimo') as {
      aparatos?: Record<string, unknown>;
    };
    expect(bak.aparatos?.['san_MUERTO_11']).toEqual({ lav: 1 });
    expect(bak.aparatos?.['san_TX_12']).toBeUndefined();
  });

  it('piso fresco de esta sesión con el trib en caché: la clave sobrevive y no hay bak', () => {
    lsSet(TRAZOS_PREFIX + '12', {
      ramales: [
        { id: 'RS1', net: 'san' },
        { id: 'TX', net: 'san' },
      ],
      bajantes: [],
    });
    lsSet(TRAZOS_PREFIX + '11', { ramales: [{ id: 'RS1', net: 'san' }], bajantes: [] });
    lsSet(APARATOS_BY_TRAMO_KEY, { san_TX_12: { lvm: 1 } });
    setSyncLoadedLiveIds('11', ['RS1']);
    markPlanTrazosFresh('12');

    writeSanDrawingSync(PLANS);

    expect(lsGet(APARATOS_BY_TRAMO_KEY)['san_TX_12']).toEqual({ lvm: 1 });
    expect(localStorage.getItem('civilflow_gc_bak_ultimo')).toBeNull();
  });

  it('re-anclaje: claves borradas con fixtures vivos en trazos vuelven solas al sincronizar', () => {
    // Caso exacto del usuario: trazos con fixtures (símbolos intactos), store vacío.
    lsSet(TRAZOS_PREFIX + '12', {
      ramales: [
        { id: 'RS1', net: 'san', fixtures: { san: 1 } },
        { id: 'TX', net: 'san', fixtures: { lvm: 1 } },
        { id: 'RS2', net: 'san', fixtures: {} },
      ],
      bajantes: [{ id: 'BAN1', net: 'san', fixtures: { san: 2 } }],
    });
    lsSet(TRAZOS_PREFIX + '11', { ramales: [{ id: 'RS1', net: 'san' }], bajantes: [] });
    lsSet(APARATOS_BY_TRAMO_KEY, { san_RS1_11: { san: 1 } });
    setSyncLoadedLiveIds('11', ['RS1']);

    expect(reanclarClavesDesdeTrazosLocales(PLANS)).toBe(3);
    const counts = lsGet(APARATOS_BY_TRAMO_KEY);
    expect(counts['san_TX_12']).toEqual({ lvm: 1 });
    expect(counts['san_RS1_12']).toEqual({ san: 1 });
    expect(counts['san_BAN1_12']).toEqual({ san: 2 });
    expect(counts['san_RS1_11']).toEqual({ san: 1 });
    expect(counts['san_RS2_12']).toBeUndefined();

    // Y el GC posterior (caché vieja) ya no las toca: el loop queda estable.
    writeSanDrawingSync(PLANS);
    const after = lsGet(APARATOS_BY_TRAMO_KEY);
    expect(after['san_TX_12']).toEqual({ lvm: 1 });
    expect(after['san_RS1_12']).toEqual({ san: 1 });
    expect(after['san_BAN1_12']).toEqual({ san: 2 });
  });
});
