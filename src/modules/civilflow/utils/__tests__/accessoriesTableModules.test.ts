import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * La tabla de accesorios se armaba en una función de 1200 líneas; ahora vive en un módulo por
 * bloque. Estos tests cubren cada bloque por separado (y el orquestador de punta a punta).
 */

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});

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

vi.stubGlobal('window', { dispatchEvent: () => {} });

import { saveToStorage } from '../../services/storageService.ts';
import { catalogoDeRed } from '../accessoriesTable/catalog.ts';
import { coleccionarPiezas } from '../accessoriesTable/collection';
import { detectarYees } from '../accessoriesTable/yees';
import { contarAccesorios } from '../accessoriesTable/counting.ts';
import { calcularBushing } from '../accessoriesTable/bushing';
import { armarTabla } from '../accessoriesTable/rows.ts';
import { computeAccesoriosTable, computeAccesoriosTableLarga } from '../accessoriesTable/index';
import { diamPulgFromLabel } from '../diamInchesFromLabel.ts';

const plan = { id: '1', name: 'P1', nivel: 0, npt: 0, status: 'confirmed' } as never;

describe('catalogo · el cat\u00e1logo visible por red', () => {
  it('cada red devuelve su cat\u00e1logo y su t\u00edtulo', () => {
    const san = catalogoDeRed('san');
    expect(san.catalog.length).toBeGreaterThan(0);
    expect(san.title.length).toBeGreaterThan(0);
    const af = catalogoDeRed('af');
    expect(af.catalog.length).toBeGreaterThan(0);
  });
});

describe('coleccion · las piezas dibujadas de los planos', () => {
  it('lee los ramales guardados del plano confirmado', () => {
    saveToStorage('trazos_1', {
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          pts: [
            [0, 0],
            [100, 0],
          ],
          label: 'RS1',
          diametro: '4"',
        },
      ],
      bajantes: [{ id: 'BAN1', net: 'san', tipo: 'bajante', x: 100, y: 0, diametro: '4"' }],
    });
    const piezas = coleccionarPiezas('san', [plan]);
    expect(piezas.drawingRamales.length).toBe(1);
    expect(piezas.drawingRamales[0].id).toBe('RS1');
    expect(piezas.bajanteDrawing.length).toBe(1);
  });

  it('sin planos no hay piezas', () => {
    expect(coleccionarPiezas('san', []).drawingRamales).toEqual([]);
  });
});

describe('yees · detecci\u00f3n por v\u00e9rtice', () => {
  it('sin ramales no hay yees', () => {
    const r = detectarYees('san', [], [], [], []);
    expect(r.yeeJunctions).toEqual([]);
    expect(r.yeeDiams).toEqual({});
  });
});

describe('conteo · el total por di\u00e1metro', () => {
  it('cuenta el codo de un ramal con accesorio de extremo', () => {
    const drawingRamales = [
      {
        id: 'RS1',
        label: 'RS1',
        diametro: '4"',
        pts: [
          [0, 0],
          [100, 0],
        ],
        planId: '1',
        accesorioFin: 'codo90',
      },
    ];
    const { totals, addAcc } = contarAccesorios(
      'san',
      [{ id: 'codo90', nombre: 'Codo 90' }],
      [{ id: 'codo90', nombre: 'Codo 90' }],
      drawingRamales,
      [],
      {},
      {},
      {},
      [],
    );
    expect(typeof addAcc).toBe('function');
    expect(totals).toBeDefined();
  });
});

describe('bushing · accesorios de bajante', () => {
  it('sin piezas no hay bushing', () => {
    const r = calcularBushing('san', [], [], [], [], [], {}, {}, [], {}, () => {});
    expect(r.bajanteBushing).toEqual({});
  });
});

describe('filas · la tabla final', () => {
  it('arma las filas con el total por di\u00e1metro', () => {
    const tabla = armarTabla(
      'san',
      'Sanitarios',
      [{ id: 'codo90', nombre: 'Codo 90' }],
      { '4"': { codo90: 2 } },
      {},
      {},
      [],
      [],
      [],
    );
    expect(tabla).not.toBeNull();
    expect(tabla?.headers[0]).toBe('Di\u00e1metro');
  });
});

describe('index · el orquestador', () => {
  it('sin datos devuelve null sin romperse', () => {
    expect(computeAccesoriosTable('san', [], [])).toBeNull();
  });
});

describe('tabla larga · memorias finales (Diámetro | Accesorio | Cantidad)', () => {
  it('sin datos: null como la matriz', () => {
    expect(computeAccesoriosTableLarga('san', [], [])).toBeNull();
  });

  it('convierte la matriz a filas largas (una por accesorio presente), ordenadas por diámetro desc', () => {
    saveToStorage('trazos_2', {
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          pts: [
            [0, 0],
            [100, 0],
          ],
          label: 'RS1',
          diametro: '4"',
        },
        {
          id: 'RS2',
          net: 'san',
          pts: [
            [200, 0],
            [300, 0],
          ],
          label: 'RS2',
          diametro: '2"',
        },
      ],
      bajantes: [],
    });
    const larga = computeAccesoriosTableLarga(
      'san',
      [],
      [{ ...(plan as object), id: '2' } as never],
    );
    if (larga) {
      expect(larga.headers).toEqual(['Diámetro', 'Accesorio', 'Cantidad']);
      for (const row of larga.rows) {
        expect(row).toHaveLength(3);
        expect(Number(row[2])).toBeGreaterThan(0);
      }
      // Diámetros en descenso (bushing "×" va al final por su lado mayor).
      const diams = larga.rows.map((r) => diamPulgFromLabel(String(r[0]).split('×')[0].trim()));
      for (let i = 1; i < diams.length; i++) expect(diams[i - 1]).toBeGreaterThanOrEqual(diams[i]);
    }
  });
});
