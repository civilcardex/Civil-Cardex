import { describe, it, expect } from 'vitest';
import { heredarEntrePisos } from '../crossFloorInheritance';
import type { PaseEspejos } from '../fixtureMirrorsTypes';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../../constants/storage-keys.ts';

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
import { vi } from 'vitest';

const DISK = 'civilflow_' + APARATOS_BY_TRAMO_KEY;
const DOC = (p: string) => 'civilflow_' + TRAZOS_PREFIX + p;

/**
 * Repro del guard de origen VACIADO: el usuario borra los aparatos del montante superior →
 * writing.ts BORRA su clave del disco (`san_RU1_2` ausente). La única evidencia de que el
 * enlace existió es el SELLO de vida per-upper (propioSnap['1|BAN1'].uc['san_LD_BAN1_1'],
 * estampado por el pase anterior con la carga). Con ese sello, liveAgg vacío = verdad cero
 * → el libro del inferior debe LIMPIARSE (no congelarse rancio). El sello es per-UPPER:
 * dos montantes sobre el mismo bajante inferior no se comparten la evidencia.
 */

function seed(): void {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  // Piso SUPERIOR (cargado): BAN1 con descargaEnId al inferior. Sus ramales NO tienen clave
  // en el disco (el usuario las vació — writing.ts borró san_RU1_2).
  mockStorage[DOC('2')] = JSON.stringify({
    ts: 1,
    bajantes: [
      {
        id: 'BAN1',
        net: 'san',
        code: 'BAN1',
        tipo: 'bajante',
        pisoBase: 'Piso 2',
        x: 0,
        y: 0,
        recibeDeIds: ['RU1'],
        alimentaIds: [],
        dNominal: '4"',
        descargaEnId: '1|BAN1',
      },
    ],
    ramales: [],
  });
  // Piso INFERIOR: BAN1 con libro RANCIO (de una era con carga) en ucAplicado.
  mockStorage[DOC('1')] = JSON.stringify({
    ts: 1,
    bajantes: [
      {
        id: 'BAN1',
        net: 'san',
        code: 'BAN1',
        tipo: 'bajante',
        pisoBase: 'Piso 1',
        x: 60,
        y: 60,
        recibeDeIds: ['RL1'],
        alimentaIds: [],
        dNominal: '4"',
        ucAplicado: { san_RL1_1: { lav: 9 }, san_LD_BAN1_1: { lav: 9 } },
        ucAcum: 9,
      },
    ],
    ramales: [],
  });
  // Disco sin claves del superior (vaciadas) — solo la clave del ramal del inferior.
  mockStorage[DISK] = JSON.stringify({ san_RL1_1: { lav: 1 } });
}

function paseDe(eng: Record<string, unknown>, extraSnap?: Record<string, unknown>): PaseEspejos {
  return {
    eng: eng as never,
    netId: 'san',
    planId: '2',
    disk: JSON.parse(mockStorage[DISK] || '{}'),
    hdisk: {},
    propioSnap: extraSnap ?? {
      // Sello de vida del enlace (pase anterior con carga) + foto de lo propio del ramal.
      '1|BAN1': { uc: { san_RL1_1: { lav: 1 }, san_LD_BAN1_1: { lav: 9 } }, hidro: {} },
    },
    dirty: false,
    hdirty: false,
    snapDirty: false,
    esDeEstePiso: (b: { pisoBase?: string }) => b.pisoBase === 'Piso 2',
    pkey: (rid: string) => `san_${rid}_2`,
    agregadoBajante: () => ({}),
    exitsDeBajante: () => new Set(),
  } as never;
}

describe('heredarEntrePisos · origen vaciado legítimamente', () => {
  it('libro rancio del inferior se limpia con la FOTO como evidencia (clave del disco ausente)', () => {
    seed();
    const eng = {
      _loadedPlanId: '2',
      bajantes: JSON.parse(JSON.stringify(JSON.parse(mockStorage[DOC('2')]).bajantes)) as Array<
        Record<string, unknown>
      >,
      ramales: [],
      crossFloorGhosts: [],
      updateElementById: () => {},
      triggerAlert: () => {},
      render: () => {},
      _markDirty: () => {},
      _emitStatus: () => {},
      _emitSelect: () => {},
    };
    const p = paseDe(eng);
    const planPorId = new Map([
      ['1', { nivel: 0 }],
      ['2', { nivel: 1 }],
    ]);
    heredarEntrePisos(p, planPorId, '2', 1, (pid) => (pid === '2' ? 1 : pid === '1' ? 0 : null));

    const bajo = (JSON.parse(mockStorage[DOC('1')]).bajantes as Array<Record<string, unknown>>)[0];
    // "Limpiar" = cada clave del libro en {} (cero heredado), el rancio {lav:9} fuera.
    const libro = bajo.ucAplicado as Record<string, Record<string, number>>;
    expect(libro.san_RL1_1).toEqual({});
    expect(libro.san_LD_BAN1_1).toEqual({});
    expect(bajo.ucAcum).toBe(0);
  });

  it('sin NINGUNA evidencia (ni disco ni foto) el guard viejo sigue: libro NO se toca', () => {
    seed();
    // Quitar la foto: enlace del que no hay verdad.
    const p = paseDe({
      _loadedPlanId: '2',
      bajantes: JSON.parse(JSON.stringify(JSON.parse(mockStorage[DOC('2')]).bajantes)),
      ramales: [],
      crossFloorGhosts: [],
    } as never);
    (p as { propioSnap: Record<string, unknown> }).propioSnap = {};
    heredarEntrePisos(
      p,
      new Map([
        ['1', { nivel: 0 }],
        ['2', { nivel: 1 }],
      ]),
      '2',
      1,
      (pid) => (pid === '2' ? 1 : pid === '1' ? 0 : null),
    );
    const bajo = (JSON.parse(mockStorage[DOC('1')]).bajantes as Array<Record<string, unknown>>)[0];
    expect(bajo.ucAplicado).toEqual({ san_RL1_1: { lav: 9 }, san_LD_BAN1_1: { lav: 9 } });
  });
});

/**
 * Repro multi-upper (dos baños sobre un bajante — patrón normal de edificio): RU1 con
 * aparatos y RU2 recién asociado y VACÍO, ambos descargan al MISMO bajante BAN1 del piso 1.
 * El pase procesa RU1 primero (escribe su herencia), luego RU2: su evidencia NO existe
 * (sello per-upper) → el guard viejo debe continuar y NO pisar el libro con su agg vacío.
 * Con la evidencia keyed por snapKey (bug), la foto de BAN1 hacía pasar a RU2 y borraba
 * las UDs de RU1 → el bajante se dimensionaba con carga 0.
 */
describe('heredarEntrePisos · dos montantes sobre el mismo bajante inferior', () => {
  it('RU2 vacío sin historia NO pisa la herencia que RU1 acaba de escribir', () => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    // Piso superior: DOS montantes, ambos descargan a BAN1 del piso 1.
    mockStorage[DOC('2')] = JSON.stringify({
      ts: 1,
      bajantes: [
        {
          id: 'RU1',
          net: 'san',
          code: 'RU1',
          tipo: 'montante',
          pisoBase: 'Piso 2',
          x: 0,
          y: 0,
          recibeDeIds: [],
          alimentaIds: [],
          dNominal: '2"',
          descargaEnId: '1|BAN1',
        },
        {
          id: 'RU2',
          net: 'san',
          code: 'RU2',
          tipo: 'montante',
          pisoBase: 'Piso 2',
          x: 30,
          y: 0,
          recibeDeIds: [],
          alimentaIds: [],
          dNominal: '2"',
          descargaEnId: '1|BAN1',
        },
      ],
      ramales: [],
    });
    // Piso inferior: BAN1 con la herencia que RU1 acaba de escribir en un pase previo.
    mockStorage[DOC('1')] = JSON.stringify({
      ts: 1,
      bajantes: [
        {
          id: 'BAN1',
          net: 'san',
          code: 'BAN1',
          tipo: 'bajante',
          pisoBase: 'Piso 1',
          x: 60,
          y: 60,
          recibeDeIds: ['RL1'],
          alimentaIds: [],
          dNominal: '4"',
          ucAplicado: { san_RL1_1: { lav: 4 }, san_LD_RU1_1: { lav: 4 } },
          ucAcum: 4,
        },
      ],
      ramales: [],
    });
    // Solo RU1 tiene clave en el disco (sus aparatos); RU2 no tiene nada jamás.
    mockStorage[DISK] = JSON.stringify({ san_RU1_2: { lav: 4 }, san_RL1_1: { lav: 1 } });

    const eng = {
      _loadedPlanId: '2',
      bajantes: JSON.parse(JSON.stringify(JSON.parse(mockStorage[DOC('2')]).bajantes)) as Array<
        Record<string, unknown>
      >,
      ramales: [],
      crossFloorGhosts: [],
      updateElementById: () => {},
      triggerAlert: () => {},
      render: () => {},
      _markDirty: () => {},
      _emitStatus: () => {},
      _emitSelect: () => {},
    };
    const p = paseDe(eng, {
      // Sello previo de RU1 (su pase anterior escribió {lav:4}); RU2 jamás sello nada.
      '1|BAN1': { uc: { san_LD_RU1_1: { lav: 4 } }, hidro: {} },
    });
    heredarEntrePisos(
      p,
      new Map([
        ['1', { nivel: 0 }],
        ['2', { nivel: 1 }],
      ]),
      '2',
      1,
      (pid) => (pid === '2' ? 1 : pid === '1' ? 0 : null),
    );

    const bajo = (JSON.parse(mockStorage[DOC('1')]).bajantes as Array<Record<string, unknown>>)[0];
    const libro = bajo.ucAplicado as Record<string, Record<string, number>>;
    // La herencia de RU1 sobrevive al pase de RU2 (con el bug quedaba {}).
    expect(libro.san_RL1_1).toEqual({ lav: 4 });
    expect(libro.san_LD_RU1_1).toEqual({ lav: 4 });
    expect(bajo.ucAcum).toBe(4);
    // RU2 nunca escribió su clave (sin sello, sin verdad).
    expect(libro.san_LD_RU2_1).toBeUndefined();
  });
});
