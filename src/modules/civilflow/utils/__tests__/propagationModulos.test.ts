import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Cada fase de la propagación se prueba en su propio módulo (no solo a través del
 * orquestador): si un módulo deja de usarse o se rompe su contrato, salta aquí.
 * Complementa a `aparatosPresionCaracterizacion.test.ts` (que congela el resultado final).
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

import { saveToStorage } from '../../services/almacenamientoServicio.ts';
import { sumaCnt, cntIgual, cntVacio, limpiar, libroHeredadoDe } from '../propagation/conteo.ts';
import { leerPiezas, calcularCargaBajantes } from '../propagation/reading';
import { detectarDownTrib } from '../propagation/tributaries';
import { calcularAristas } from '../propagation/aristas.ts';
import { calcularUpMonte } from '../propagation/arribaMontante.ts';
import { calcularPlegado } from '../propagation/folding';
import { calcularTotales } from '../propagation/dfs';
import { refrescarMontantes } from '../propagation/accesorios.ts';
import { escribirDelta } from '../propagation/writing';
import { propagarAparatosPresion } from '../propagation/index';
import { leerHeredadosPresion, udPropiaDe } from '../propagation/books';
import type { Ctx, RamalP } from '../propagation/conteo.ts';

const ramal = (id: string, pts: number[][], extra: Partial<RamalP> = {}): RamalP =>
  ({
    id,
    net: 'af',
    pts,
    key: `af_${id}_P1`,
    pid: 'P1',
    ...extra,
  }) as RamalP;

describe('conteo · helpers puros', () => {
  it('sumaCnt suma y cntIgual compara sin ceros', () => {
    expect(sumaCnt({ a: 1 }, { a: 2, b: 1 })).toEqual({ a: 3, b: 1 });
    expect(cntIgual({ a: 1, b: 0 }, { a: 1 })).toBe(true);
    expect(cntIgual({ a: 1 }, { a: 2 })).toBe(false);
    expect(cntVacio({})).toBe(true);
    expect(limpiar({ a: 1, b: 0 })).toEqual({ a: 1 });
  });

  it('libroHeredadoDe toma el MÁXIMO de cada entrada', () => {
    expect(libroHeredadoDe({ x: { ino: 2 }, y: { ino: 2, lvm: 1 } })).toEqual({ ino: 2, lvm: 1 });
  });
});

describe('lectura · fases 1 y 2', () => {
  it('leerPiezas devuelve las piezas del plano y null si no hay ninguna', () => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
      ],
      bajantes: [{ id: 'MON1', net: 'af', tipo: 'montante', x: 0, y: 0 }],
    });
    const piezas = leerPiezas('af', {}, {}, {}, {});
    expect(piezas?.ramales).toHaveLength(1);
    expect(piezas?.bajes).toHaveLength(1);
    expect(piezas?.ramales[0].key).toBe('af_RAF1_P1');
  });

  it('leerPiezas devuelve null cuando la red no tiene piezas', () => {
    expect(leerPiezas('af', {}, {}, {}, {})).toBeNull();
  });

  it('calcularCargaBajantes suma lo propio y lo heredado (libro por MÁXIMO)', () => {
    const cargaBaj = calcularCargaBajantes('af', { af_MON1_P1: { ino: 1 } }, [
      {
        id: 'MON1',
        net: 'af',
        tipo: 'montante',
        pid: 'P1',
        ucAplicado: { af_LD_P1: { ino: 2 } },
      } as never,
    ]);
    // 1 propio + 2 heredados. DENTRO del libro, el máximo (la misma carga en varias piezas).
    expect(cargaBaj.get('MON1|P1')).toEqual({ ino: 3 });
  });
});

describe('tributarios · down-trib', () => {
  it('detecta el tributario vertical abajo y su padre', () => {
    const r = detectarDownTrib([
      ramal('RAF1', [
        [100, 0],
        [0, 0],
      ]),
      ramal(
        'RAF2',
        [
          [100, 0],
          [100, 60],
        ],
        { tipo: 'tributario', padre: 'RAF1' },
      ),
    ]);
    expect(r.downTrib.get('af_RAF2_P1')?.padreKey).toBe('af_RAF1_P1');
    expect(r.padresDeDown.has('af_RAF1_P1')).toBe(true);
    expect(r.ramalesPorPlano.get('P1')?.get('RAF1')).toBeDefined();
  });
});

describe('aristas · clusters', () => {
  it('devuelve las aristas con su índice por destino', () => {
    const r = calcularAristas(
      [
        ramal('RAFA', [
          [0, 0],
          [100, 0],
        ]),
        ramal('RAFB', [
          [100, 0],
          [200, 0],
        ]),
      ],
      new Map(),
      new Map(),
      new Set(),
      new Map(),
      {},
      {},
      {},
      {},
    );
    expect(r.aristas.length).toBeGreaterThan(0);
    expect(r.aristasPorDestino.size).toBeGreaterThan(0);
  });
});

describe('upMonte · la entrega del montante', () => {
  it('el ramal que nace en el montante recibe su carga', () => {
    const up = calcularUpMonte(
      [
        ramal('RAF1', [
          [0, 0],
          [100, 0],
        ]),
      ],
      [
        {
          id: 'MON1',
          net: 'af',
          tipo: 'montante',
          pid: 'P1',
          x: 0,
          y: 0,
          alimentaIds: ['RAF1'],
          ucAplicado: { af_RAF1_P1: { ino: 1 } },
        } as never,
      ],
      new Map([['MON1|P1', { ino: 1 }]]),
    );
    expect(up.get('af_RAF1_P1')).toEqual({ ino: 1 });
  });
});

describe('plegado / dfs / escritura · las fases con estado', () => {
  const ctxBase = (): Ctx => ({
    net: 'af',
    disk: { af_RAFA_P1: { inodoro: 1 } },
    libros: {},
    librosTrib: {},
    bajadasLibro: {},
    diag: {},
    ramales: [
      ramal(
        'RAFA',
        [
          [0, 0],
          [100, 0],
        ],
        { aparatoFin: 'inodoro' },
      ),
      ramal('RAFB', [
        [100, 0],
        [200, 0],
      ]),
    ],
    bajes: [],
    cargaBaj: new Map(),
    downTrib: new Map(),
    padresDeDown: new Set(),
    ramalesPorPlano: new Map([['P1', new Map()]]),
    aristas: [],
    aristasPorDestino: new Map(),
    cadenaTrib: new Set(),
    transferencias: new Map(),
    upMonte: new Map(),
    manualCrudoDe: new Map(),
    heredadoAsocDe: new Map(),
    foldDe: new Map(),
    manualDe: new Map(),
    bajadasDown: new Set(),
    foldNDe: new Map(),
    totalDe: new Map(),
    heredadoDe: new Map(),
    tribFoldDe: new Map(),
    porKey: new Map(),
  });

  it('calcularPlegado deja el manual y el plegado en el contexto', () => {
    const ctx = ctxBase();
    calcularPlegado(ctx);
    expect(ctx.manualCrudoDe.get('af_RAFA_P1')).toEqual({ inodoro: 1 });
    expect(ctx.manualDe.size).toBeGreaterThan(0);
  });

  it('calcularTotales deja el total y el heredado en el contexto', () => {
    const ctx = ctxBase();
    ctx.manualCrudoDe.set('af_RAFA_P1', { inodoro: 1 });
    ctx.manualDe.set('af_RAFA_P1', { inodoro: 1 });
    ctx.porKey = new Map(ctx.ramales.map((r) => [r.key, r]));
    calcularTotales(ctx);
    expect(ctx.totalDe.get('af_RAFA_P1')).toEqual({ inodoro: 1 });
  });

  it('refrescarMontantes y escribirDelta no rompen con el contexto vacío', () => {
    const ctx = ctxBase();
    expect(() => refrescarMontantes(ctx)).not.toThrow();
    expect(() => escribirDelta(ctx)).not.toThrow();
  });
});

describe('libros · lectores públicos', () => {
  it('leerHeredadosPresion y udPropiaDe trabajan con el libro', () => {
    saveToStorage('aparatos_heredados_v1', { af_RAFB_P1: { inodoro: 1 } });
    expect(leerHeredadosPresion('af_RAFB_P1')).toEqual({ inodoro: 1 });
    expect(udPropiaDe({ inodoro: 3 }, { inodoro: 1 }, {})).toEqual({ inodoro: 2 });
  });
});

describe('index · el orquestador encadena las fases', () => {
  it('propagarAparatosPresion sigue siendo la entrada p\u00fablica', () => {
    expect(typeof propagarAparatosPresion).toBe('function');
  });
});
