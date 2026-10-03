import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  writeSanDrawingSync,
  writeHydroDrawingSync,
  setSyncLoadedLiveIds,
  markPlanTrazosFresh,
} from '../drawingSync';
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

function counts(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}') as Record<
    string,
    unknown
  >;
}

describe('GC de sync — guard del piso cargado', () => {
  beforeEach(() => {
    resetLS();
    setSyncLoadedLiveIds(null, []);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
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

    expect(counts()['san_RS9_2']).toEqual({ lav: 2 });
    expect(counts()['san_RS4_2']).toEqual({ san: 1 });
  });

  it('piso fresco de esta sesión: la clave huérfana se borra cuando el huérfano cruza el umbral de tiempo (limpieza intacta)', () => {
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({ ramales: [{ id: 'RS4', net: 'san' }], bajantes: [] }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ san_MUERTO_2: { lav: 1 }, san_RS4_2: { san: 1 } }),
    );
    // Sin guard de cargado, pero la caché la escribió esta sesión (fresca = confiable).
    markPlanTrazosFresh('2');

    // La primera pasada solo marca sospechosa (ts del primer avistamiento).
    writeSanDrawingSync(PLANS);
    expect(counts()['san_MUERTO_2']).toEqual({ lav: 1 });

    // Pasado el umbral (≥1,5 s desde el primer avistamiento), el siguiente sync borra.
    vi.advanceTimersByTime(1600);
    writeSanDrawingSync(PLANS);

    expect(counts()['san_MUERTO_2']).toBeUndefined();
    expect(counts()['san_RS4_2']).toEqual({ san: 1 });
  });

  it('san + hidro en el MISMO round NO borran el huérfano (2 pasadas ≠ 2 rounds)', () => {
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({ ramales: [{ id: 'RS4', net: 'san' }], bajantes: [] }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ san_MUERTO_2: { lav: 1 } }),
    );
    markPlanTrazosFresh('2');

    // Un round real de sync corre AMBOS write*DrawingSync seguidos: cada uno pasa el GC.
    // Con el umbral de tiempo, el par del mismo round ya no basta para borrar.
    writeSanDrawingSync(PLANS);
    writeHydroDrawingSync(PLANS);

    expect(counts()['san_MUERTO_2']).toEqual({ lav: 1 });
  });

  it('trazos del plan SIN campo areas: la clave gas_AR del área no se borra aunque el sync cruce rounds', () => {
    // Caché reconstruida desde BD o escritor que soltó areas: sin la lista no hay prueba
    // de orfandad — el área puede seguir viva en el engine/BD.
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({ ramales: [{ id: 'RG1', net: 'gas' }], bajantes: [] }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ gas_AR1790972072000_2: { cal21: 1 } }),
    );
    markPlanTrazosFresh('2');

    writeSanDrawingSync(PLANS);
    vi.advanceTimersByTime(1600);
    writeSanDrawingSync(PLANS);
    writeHydroDrawingSync(PLANS);

    expect(counts()['gas_AR1790972072000_2']).toEqual({ cal21: 1 });
  });

  it('trazos del plan CON campo areas y el área ausente: la clave gas_AR sí se limpia tras el umbral', () => {
    // Lista de áreas presente y el id ya no está: orfandad PROBADA — se limpia normal.
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({ ramales: [], bajantes: [], areas: [{ id: 'AR999', net: 'gas' }] }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ gas_AR1790972072000_2: { cal21: 1 }, gas_AR999_2: { est4: 1 } }),
    );
    markPlanTrazosFresh('2');

    writeSanDrawingSync(PLANS);
    vi.advanceTimersByTime(1600);
    writeSanDrawingSync(PLANS);

    const c = counts();
    expect(c['gas_AR1790972072000_2']).toBeUndefined();
    expect(c['gas_AR999_2']).toEqual({ est4: 1 });
  });
});
