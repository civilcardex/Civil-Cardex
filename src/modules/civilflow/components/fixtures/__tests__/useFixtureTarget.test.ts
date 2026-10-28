import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../../constants/storage-keys.ts';
import { currentMapDe } from '../useFixtureTarget.ts';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';

// El panel de cada pieza de la asociación (montante destino, LDesvio) debe leer el GRUPO
// vivo — la misma fuente única de los bajantes san (aggBajanteAsociado) — y NO una clave
// espejo que puede estar rancia o vacía (orig. usuario: el Ldesvio af quedaba en 0).

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g.document)
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({}),
    };
  if (!g.window)
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
});

const GRUPO = { ino: 2, lvm: 1 };

function seed() {
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      ramales: [],
      bajantes: [
        {
          id: 'MAC2',
          net: 'af',
          tipo: 'montante',
          x: 30,
          y: 30,
          origenId: '2|MAC1',
          ucAplicado: { af_LD_MAC1_1: GRUPO, af_RAF2_1: GRUPO },
        },
      ],
    }),
  );
  localStorage.setItem('civilflow_' + APARATOS_BY_TRAMO_KEY, JSON.stringify({}));
}

function argsDe(targetId: string, storageKey: string): Parameters<typeof currentMapDe>[0] {
  const engine = {
    _loadedPlanId: '1',
    bajantes: [
      {
        id: 'MAC2',
        net: 'af',
        tipo: 'montante',
        x: 30,
        y: 30,
        origenId: '2|MAC1',
        ucAplicado: { af_LD_MAC1_1: GRUPO, af_RAF2_1: GRUPO },
      },
    ],
    ramales: [],
  } as unknown as PlanoEngine;
  return {
    netId: 'af',
    storageKey,
    targetId,
    mergeKeys: null,
    isBajanteSan: false,
    planId: '1',
    selElement: { id: targetId, tipo: 'ramal' } as never,
    counts: {},
    hidroData: {},
    plans: [{ id: '1', nivel: 0 }],
    engineRef: { current: engine },
    agregadoBajante: () => ({}),
    exitsDeBajante: () => new Set<string>(),
  };
}

beforeEach(() => {
  localStorage.clear();
  seed();
});

describe('el panel de las piezas de la asociación af lee el grupo vivo', () => {
  it('LDesvio af: grupo del libro aunque su clave espejo esté vacía', () => {
    const map = currentMapDe(argsDe('LD_MAC1', 'af_LD_MAC1_1'));
    expect(map).toEqual(GRUPO);
  });

  it('montante destino af: grupo del libro', () => {
    const a = argsDe('MAC2', 'af_MAC2_1');
    a.isBajanteSan = true;
    expect(currentMapDe(a)).toEqual(GRUPO);
  });

  it('REPRO dump: la proyección del piso de arriba (mismo id, libro rancio) no eclipsa al real', () => {
    // El motor mantiene los bajantes de OTROS pisos que atraviesan esta altura (pisoBase
    // ajeno, MISMO id tras el renombre) — el find() plano devolvía la proyección con su
    // libro rancio (15.5) en vez del montante real (orig. usuario MAC1-P1).
    const a = argsDe('MAC2', 'af_MAC2_1');
    a.isBajanteSan = true;
    const eng = a.engineRef.current as unknown as {
      bajantes: unknown[];
      nivelActual: { label: string };
    };
    // El real vive en el piso abierto (pisoBase = 'Piso 1'); la proyección llegó primero.
    (eng.bajantes[0] as { pisoBase?: string }).pisoBase = 'Piso 1';
    eng.bajantes.unshift({
      id: 'MAC2',
      net: 'af',
      tipo: 'montante',
      pisoBase: 'Piso 2',
      ucAplicado: { af_LD_X_1: { duc: 3, lvro: 3, lvm: 5, lvp: 2, tin: 5 } },
    });
    eng.nivelActual = { label: 'Piso 1' };
    expect(currentMapDe(a)).toEqual(GRUPO);
  });
});

describe('ramal nacido en bajante/montante con enlace entre pisos', () => {
  function argsSan(ramales: unknown[], bajantes: unknown[]) {
    const a = argsDe('RALL1', 'san_RALL1_1');
    a.netId = 'san';
    a.counts = { san_RALL1_1: { lav: 3 } };
    const eng = a.engineRef.current as unknown as {
      ramales: unknown[];
      bajantes: unknown[];
      crossFloorGhosts: unknown[];
    };
    eng.ramales = ramales;
    eng.bajantes = bajantes;
    return a;
  }

  const ball = { id: 'BALL1', net: 'san', code: 'BALL1', tipo: 'bajante', pisoBase: 'P1' };
  const rall = { id: 'RALL1', net: 'san', tipo: 'ramal', ini: 'BALL1', fin: '' };

  it('dueño con LD_ pero SIN asociación (bajante fuente del piso superior): muestra el grupo', () => {
    // El LD_/fantasmas por sí solos NO vacían el panel: el lado FUENTE conserva la carga
    // visible en sus ramales de salida (la prueba de que el grupo bajó al piso de abajo).
    const a = argsSan(
      [rall, { id: 'LD_BALL1', net: 'san', tipo: 'ramal', ini: '', fin: '' }],
      [ball],
    );
    expect(currentMapDe(a)).toEqual({ lav: 3 });
  });

  it('dueño con origenId (asociado): panel vacío', () => {
    const a = argsSan([rall], [{ ...ball, origenId: '2|BALL1' }]);
    expect(currentMapDe(a)).toEqual({});
  });

  it('dueño SIN enlace entre pisos: el panel muestra lo suyo como siempre', () => {
    const a = argsSan([rall], [ball]);
    expect(currentMapDe(a)).toEqual({ lav: 3 });
  });
});
