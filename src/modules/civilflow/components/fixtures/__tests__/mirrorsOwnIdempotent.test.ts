import { describe, it, expect, beforeEach, vi } from 'vitest';
import { correrEspejos } from '../fixtureMirrors';
import type { EspejosArgs } from '../fixtureMirrorsTypes';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../../constants/storage-keys.ts';

/**
 * REPRO del conteo sanitario que CRECE al cambiar de piso (orig. usuario: bajante asociado
 * entre pisos). El espejo de abajo escribe `propio + grupo heredado` en la clave del ramal y
 * anota el grupo en el libro `ucAplicado` del doc. Si ese libro no está (doc atrasado,
 * escritura perdida, bajante ausente), el pase siguiente restaba CERO y volvía a sumar el
 * grupo sobre lo que ya lo contenía: +grupo por cada pase (y cada cambio de piso dispara pases).
 * La foto de lo propio + la regla "sin libro no se espeja" cortan el rastrillo.
 */

const mockStorage: Record<string, string> = {};

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

const DISK = 'civilflow_' + APARATOS_BY_TRAMO_KEY;
const DOC_ABAJO = 'civilflow_' + TRAZOS_PREFIX + 'P1';

type DocBajante = {
  id: string;
  recibeDeIds?: string[];
  alimentaIds?: string[];
  ucAplicado?: Record<string, Record<string, number>>;
  ucAcum?: number;
};

function escribirDocAbajo(bajantes: DocBajante[]): void {
  mockStorage[DOC_ABAJO] = JSON.stringify({ bajantes, ramales: [], ts: 1 });
}

function disco(): Record<string, Record<string, number>> {
  return JSON.parse(mockStorage[DISK] || '{}');
}

/** Piso 2 cargado con el bajante superior; su descarga apunta al bajante BAN1 del piso 1. */
const ENG = {
  _loadedPlanId: 'P2',
  zoom: 1,
  bajantes: [
    {
      id: 'BAN1',
      net: 'san',
      code: 'BAN1',
      x: 980,
      y: 320,
      descargaEnId: 'P1|BAN1',
      recibeDeIds: [],
      alimentaIds: [],
    },
  ],
  ramales: [],
  crossFloorGhosts: [],
};

function argsSobre(): EspejosArgs {
  return {
    engineRef: { current: ENG } as never,
    loadingPlanRef: { current: false } as never,
    netId: 'san',
    planId: 'P2',
    plans: [
      { id: 'P1', nivel: 1 },
      { id: 'P2', nivel: 2 },
    ] as never,
    setCounts: () => {},
    setHidroData: () => {},
    // Los ramales de salida no participan de este caso.
    agregadoBajante: () => ({}),
    exitsDeBajante: () => new Set<string>(),
  } as never;
}

beforeEach(() => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  // Piso 2 (cargado): el bajante superior tiene 4 lavaderos propios.
  mockStorage[DISK] = JSON.stringify({ san_BAN1_P2: { lav: 4 } });
  // Piso 1: el ramal RS5 ya trae la herencia del pase anterior (4 lav) + 2 inodoros propios.
  mockStorage[DISK] = JSON.stringify({
    san_BAN1_P2: { lav: 4 },
    san_RS5_P1: { lav: 4, ino: 2 },
  });
  escribirDocAbajo([
    {
      id: 'BAN1',
      recibeDeIds: ['RS5'],
      ucAplicado: { san_RS5_P1: { lav: 4 } },
      ucAcum: 4,
    },
  ]);
});

describe('espejo entre pisos: la herencia nunca se vuelve a sumar', () => {
  it('con el libro al día, dos pases dejan el disco y el libro idénticos', () => {
    correrEspejos(argsSobre());
    expect(disco()['san_RS5_P1']).toEqual({ lav: 4, ino: 2 });
    correrEspejos(argsSobre());
    expect(disco()['san_RS5_P1']).toEqual({ lav: 4, ino: 2 });
    const doc = JSON.parse(mockStorage[DOC_ABAJO]);
    expect(doc.bajantes[0].ucAplicado['san_RS5_P1']).toEqual({ lav: 4 });
    expect(doc.bajantes[0].ucAcum).toBe(4);
  });

  it('si el doc perdió el libro, la foto de lo propio evita que la herencia se sume otra vez', () => {
    // Pase normal: deja la foto de lo propio (ino:2) guardada.
    correrEspejos(argsSobre());
    // El doc se recarga desde una copia atrasada: la clave del ramal sigue con la herencia,
    // pero el libro del bajante viene vacío (escritura perdida / BD vieja).
    escribirDocAbajo([{ id: 'BAN1', recibeDeIds: ['RS5'], ucAplicado: {}, ucAcum: 0 }]);
    correrEspejos(argsSobre());
    expect(disco()['san_RS5_P1']).toEqual({ lav: 4, ino: 2 });
    correrEspejos(argsSobre());
    expect(disco()['san_RS5_P1']).toEqual({ lav: 4, ino: 2 });
  });

  it('sin el bajante destino en el doc no se escribe ninguna clave (no hay dónde anotar el libro)', () => {
    escribirDocAbajo([]);
    correrEspejos(argsSobre());
    expect(disco()['san_RS5_P1']).toEqual({ lav: 4, ino: 2 });
    correrEspejos(argsSobre());
    expect(disco()['san_RS5_P1']).toEqual({ lav: 4, ino: 2 });
  });
});
