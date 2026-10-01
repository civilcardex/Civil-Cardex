import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc: async () => ({ error: null, data: null }),
  },
}));

import { reanclarClavesDesdeTrazosLocales, setSyncLoadedLiveIds } from '../drawingSync';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys';

// Anti-resurrección (orig. usuario: Quitar/"-" sin efecto tras reentrar): la copia `fixtures`
// del ramal en el trazo se escribe al cargar y nada la invalida al quitar el aparato. El
// re-ancla de sync NO debe devolver claves de ramales que ya no llevan campo/glifo de aparato;
// sí debe seguir restaurando las legítimas (símbolo intacto, conteo perdido) y las de bajantes.

function resetLS() {
  const m = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
    clear: () => m.clear(),
    key: (_i: number) => null,
    get length() {
      return m.size;
    },
  } as Storage;
  (globalThis as Record<string, unknown>).window = globalThis;
}

const plans = [{ id: 7 }];

const ramalBase = {
  id: 'RS1',
  net: 'san',
  tipo: 'ramal',
  pts: [
    [0, 0],
    [10, 0],
  ],
};

/** Escenario "tras reentrar": la copia fixtures sigue en el trazo con el aparato, y el mapa
 *  local pierde la clave (recién quitada por el usuario o perdida). */
function seedTrazo(ramal: Record<string, unknown>) {
  saveToStorage(TRAZOS_PREFIX + '7', { ramales: [ramal], bajantes: [] });
}

const mapa = () =>
  loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});

describe('reanclarClavesDesdeTrazosLocales — anti-resurrección de aparatos', () => {
  beforeEach(() => {
    resetLS();
    setSyncLoadedLiveIds(null, []);
  });

  it('ramal con copia stale (campos de aparato ya limpios) NO resucita la clave quitada', () => {
    // Quitar limpió aparatoInicio/Fin y el glifo (codo90rmSube); la copia fixtures quedó.
    seedTrazo({ ...ramalBase, aparatoInicio: '', accesorioInicio: '', fixtures: { san: 1 } });
    expect(reanclarClavesDesdeTrazosLocales(plans)).toBe(0);
    expect(mapa()['san_RS1_7']).toBeUndefined();
  });

  it('ramal con aparato vigente (campo presente) SÍ restaura la clave perdida', () => {
    seedTrazo({ ...ramalBase, aparatoFin: 'lav', fixtures: { lav: 1 } });
    expect(reanclarClavesDesdeTrazosLocales(plans)).toBe(1);
    expect(mapa()['san_RS1_7']).toEqual({ lav: 1 });
  });

  it('ramal san con glifo de aparato (codo90rmSube/sifon) y sin campo SÍ restaura', () => {
    seedTrazo({ ...ramalBase, accesorioInicio: 'codo90rmSube', fixtures: { sif: 1 } });
    reanclarClavesDesdeTrazosLocales(plans);
    expect(mapa()['san_RS1_7']).toEqual({ sif: 1 });
  });

  it('bajante sin campos portadores sigue restaurando (UDs de bomba/caja)', () => {
    saveToStorage(TRAZOS_PREFIX + '7', {
      ramales: [],
      bajantes: [{ id: 'BAN1', net: 'san', tipo: 'bajante', fixtures: { san: 2 } }],
    });
    reanclarClavesDesdeTrazosLocales(plans);
    expect(mapa()['san_BAN1_7']).toEqual({ san: 2 });
  });

  it('clave viva en el mapa no se pisa (solo rellena ausentes, como antes)', () => {
    seedTrazo({ ...ramalBase, aparatoFin: 'lav', fixtures: { lav: 1 } });
    saveToStorage(APARATOS_BY_TRAMO_KEY, { san_RS1_7: { lav: 3 } });
    reanclarClavesDesdeTrazosLocales(plans);
    expect(mapa()['san_RS1_7']).toEqual({ lav: 3 });
  });

  // Repro exacto del "sigue pasando en ramales": el motor purga la clave al borrar, pero el
  // trazo LOCAL sigue stale (con el ramal borrado, campos + fixtures) hasta el autosave (1.5 s).
  // Un sync en esa ventana (onDeleteHandler → syncDrawings) re-anclaba la clave recién purgada.
  describe('con piso cargado registrado (ids vivos del engine)', () => {
    it('id borrado (fuera de los ids vivos): la clave purgada NO resucita aunque el trazo esté stale', () => {
      const trazoStale = {
        ramales: [
          {
            ...ramalBase,
            accesorioInicio: 'codo90rmSube', // el trazo viejo aún trae los campos del aparato
            aparatoInicio: '',
            fixtures: { san: 1 },
          },
        ],
        bajantes: [],
      };
      saveToStorage(TRAZOS_PREFIX + '7', trazoStale);
      // Post-borrado: el engine ya no tiene RS1 — syncDrawings registra los ids vivos reales.
      setSyncLoadedLiveIds('7', ['RS2', 'RS2']);

      reanclarClavesDesdeTrazosLocales(plans);
      expect(mapa()['san_RS1_7']).toBeUndefined();
    });

    it('id VIVO con clave perdida: sí se restaura (caso de reparación original intacto)', () => {
      saveToStorage(TRAZOS_PREFIX + '7', {
        ramales: [{ ...ramalBase, aparatoFin: 'lav', fixtures: { lav: 1 } }],
        bajantes: [],
      });
      setSyncLoadedLiveIds('7', ['RS1', 'RS1']);

      reanclarClavesDesdeTrazosLocales(plans);
      expect(mapa()['san_RS1_7']).toEqual({ lav: 1 });
    });

    it('id vivo por LABEL también cuenta (ramal con id≠label)', () => {
      saveToStorage(TRAZOS_PREFIX + '7', {
        ramales: [{ ...ramalBase, id: 'RS3', aparatoFin: 'lav', fixtures: { lav: 1 } }],
        bajantes: [],
      });
      // El engine lo registra por label (flatMap [id, label]).
      setSyncLoadedLiveIds('7', ['RS3', 'RS3']);

      reanclarClavesDesdeTrazosLocales(plans);
      expect(mapa()['san_RS3_7']).toEqual({ lav: 1 });
    });

    it('otro piso sin registro de ids vivos: comportamiento anterior (restaura)', () => {
      saveToStorage(TRAZOS_PREFIX + '7', {
        ramales: [{ ...ramalBase, aparatoFin: 'lav', fixtures: { lav: 1 } }],
        bajantes: [],
      });
      setSyncLoadedLiveIds('9', ['OTRO']); // piso cargado es el 9, no el 7

      reanclarClavesDesdeTrazosLocales(plans);
      expect(mapa()['san_RS1_7']).toEqual({ lav: 1 });
    });
  });
});
