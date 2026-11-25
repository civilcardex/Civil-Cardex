import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hitDelSeleccionado } from '../menuHit.ts';
import type PlanoEngine from '../../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoElement } from '../../../../lib/PlanoEngine/PlanoState.ts';

// Elección del punto con que el botón «Opciones» (tablets) abre el menú contextual. En el
// primer bloque el hit-test está mockeado (solo se prueba QUÉ candidato se le entrega); el
// segundo restaura la implementación real para probar la cadena completa.
const hitTestReal = (
  await vi.importActual<typeof import('../../../../lib/PlanoEngine/PlanoEngineHitTesting.ts')>(
    '../../../../lib/PlanoEngine/PlanoEngineHitTesting.ts',
  )
).hitTestRightClick;

const { hitTestRightClick } = vi.hoisted(() => ({ hitTestRightClick: vi.fn() }));
vi.mock('../../../../lib/PlanoEngine/PlanoEngineHitTesting.ts', () => ({ hitTestRightClick }));

const ramal = {
  id: 'RS1',
  pts: [
    [0, 0],
    [100, 0],
    [100, 80],
  ],
} as unknown as PlanoElement;
const extremo = { idx: 0, x: 0, y: 0 };
const cuerpo = { segmentIdx: 1, x: 100, y: 40 };
const acierto = (element: unknown, extra: Record<string, unknown>) => ({
  element,
  clientX: 0,
  clientY: 0,
  ...extra,
});
const motor = (lastDown?: { x: number; y: number }): PlanoEngine =>
  // toCvs desplaza las coords de plano para comprobar que se convierten y no se usan crudas.
  ({
    _lastDown: lastDown ?? null,
    toCvs: (x: number, y: number) => ({ x: x + 1000, y: y + 500 }),
  }) as unknown as PlanoEngine;

describe('hitDelSeleccionado: el punto con que «Opciones» abre el menú', () => {
  beforeEach(() => hitTestRightClick.mockReset());

  it('usa el último toque sobre el lienzo cuando cayó en el elemento seleccionado', () => {
    hitTestRightClick.mockReturnValue(
      acierto(ramal, { isGhostClick: false, ramalEndpoint: extremo, midRamalHit: null }),
    );
    expect(hitDelSeleccionado(motor({ x: 120, y: 340 }), ramal)).toEqual({
      isGhostClick: false,
      ramalEndpoint: extremo,
      midRamalHit: null,
    });
    expect(hitTestRightClick).toHaveBeenCalledTimes(1);
    expect(hitTestRightClick).toHaveBeenCalledWith(expect.anything(), 120, 340, 0, 0);
  });

  it('si el último toque fue en OTRO elemento, busca un punto del cuerpo del seleccionado', () => {
    hitTestRightClick.mockReturnValueOnce(acierto({ id: 'BAN1' }, {}));
    hitTestRightClick.mockReturnValueOnce(
      acierto(ramal, { isGhostClick: false, ramalEndpoint: null, midRamalHit: cuerpo }),
    );
    expect(hitDelSeleccionado(motor({ x: 5, y: 5 }), ramal)).toEqual({
      isGhostClick: false,
      ramalEndpoint: null,
      midRamalHit: cuerpo,
    });
    // 1er intento: el toque. 2º: el punto medio del 1er segmento (50, 0) convertido a lienzo.
    expect(hitTestRightClick.mock.calls.map(([, x, y]) => [x, y])).toEqual([
      [5, 5],
      [1050, 500],
    ]);
  });

  it('sin toque previo (elección desde la lista) parte directamente del cuerpo', () => {
    hitTestRightClick.mockReturnValue(
      acierto(ramal, { isGhostClick: false, ramalEndpoint: null, midRamalHit: cuerpo }),
    );
    expect(hitDelSeleccionado(motor(), ramal).midRamalHit).toEqual(cuerpo);
    expect(hitTestRightClick.mock.calls[0].slice(1, 3)).toEqual([1050, 500]);
  });

  it('si ningún punto cae en el elemento, abre sin dato (igual que antes del cambio)', () => {
    hitTestRightClick.mockReturnValue(null);
    expect(hitDelSeleccionado(motor(), ramal)).toEqual({});
    // Un elemento sin trazo (bajante) no tiene cuerpo que probar.
    hitTestRightClick.mockClear();
    expect(hitDelSeleccionado(motor(), { id: 'BAN1' } as unknown as PlanoElement)).toEqual({});
    expect(hitTestRightClick).not.toHaveBeenCalled();
  });
});

// Cadena REAL (motor de prueba + hitTestRightClick GENUINO): un toque sobre un ramal
// sanitario debe producir el dato (extremo o cuerpo) con que el menú arma «asignar aparato».
import { hitDelSeleccionado as hitReal } from '../menuHit.ts';
import type { IPlanoEngineCore } from '../../../../lib/PlanoEngine/PlanoState.ts';

function motorReal(
  ramales: unknown[],
  selId: string,
  lastDown?: { x: number; y: number },
): IPlanoEngineCore {
  return {
    ramales,
    bajantes: [],
    areas: [],
    textAnnots: [],
    dims: [],
    guideLines: [],
    selId,
    activeNet: 'san',
    nivelActual: { label: 'P1' },
    zoom: 1,
    mm: 10,
    toCvs: (x: number, y: number) => ({ x, y }),
    mm2cvs: (n: number) => n,
    _hiddenNets: new Set<string>(),
    getBajantesFantasma: () => [],
    _lastDown: lastDown ?? null,
  } as unknown as IPlanoEngineCore;
}

describe('hitDelSeleccionado con hit-test REAL (ramal sanitario → asignar aparato)', () => {
  beforeEach(() => {
    // El vi.mock del primer bloque pisa el módulo para TODO el archivo: aquí se restaura el
    // hit-test genuino para probar la cadena completa (y se limpia al salir del bloque).
    (hitTestRightClick as ReturnType<typeof vi.fn>).mockImplementation(hitTestReal);
  });
  afterEach(() => {
    (hitTestRightClick as ReturnType<typeof vi.fn>).mockReset();
  });

  const san = {
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    pts: [
      [100, 100],
      [400, 100],
    ],
  } as unknown as PlanoElement;
  const otro = {
    ...san,
    id: 'RS2',
    pts: [
      [500, 500],
      [600, 600],
    ],
  } as unknown as PlanoElement;

  it('toque en el EXTREMO del ramal → el menú abre con ese extremo (selector de aparato)', () => {
    const hit = hitReal(
      motorReal([san], 'RS1', { x: 100, y: 100 }) as unknown as PlanoEngine,
      san,
      { x: 100, y: 100 },
    );
    expect(hit.ramalEndpoint?.idx).toBe(0);
    expect(hit.midRamalHit).toBeNull();
  });

  it('toque en el CUERPO → midRamalHit (asignar aparato a mitad de ramal)', () => {
    const hit = hitReal(
      motorReal([san], 'RS1', { x: 250, y: 100 }) as unknown as PlanoEngine,
      san,
      { x: 250, y: 100 },
    );
    expect(hit.midRamalHit?.segmentIdx).toBe(0);
  });

  it('toque sobre OTRO elemento → cae al cuerpo del seleccionado (misma vía del clic derecho)', () => {
    const hit = hitReal(
      motorReal([san, otro], 'RS2', { x: 550, y: 550 }) as unknown as PlanoEngine,
      san,
      { x: 550, y: 550 },
    );
    expect(hit.midRamalHit?.segmentIdx).toBe(0);
  });
});
