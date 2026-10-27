import { describe, expect, it } from 'vitest';
import {
  tryMergeExtensionPorExtremo,
  mergeExtensionPorExtremoConFallback,
} from '../finishRamalMergeExtreme';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

/** Ramal san horizontal. */
function ramal(id: string, pts: number[][], over: Partial<PlanoRamal> = {}): PlanoRamal {
  return { id, net: 'san', tipo: 'ramal', pts, ...over } as PlanoRamal;
}

function motor(ramales: PlanoRamal[], incoming: number[][]) {
  const eng = {
    ramales,
    bajantes: [],
    activeRamal: { pts: incoming, net: 'san', tipo: 'ramal', padre: null, totalL: 0 },
    _ramalDefaults: { diametro: '' },
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    render: () => {},
    pxToM: (n: number) => n / 100,
  };
  return eng as unknown as IPlanoEngineCore;
}

/** El merge por extremo extiende el ramal existente (punto nuevo en su extremo libre) y
 *  consume el trazo activo; el fallback devuelve false cuando no hay merge posible. */
describe('finishRamalMergeExtremo', () => {
  it('extiende el ramal existente por llegada a extremo y consume el trazo', () => {
    const existente = ramal('RS1', [
      [0, 0],
      [100, 0],
    ]);
    const eng = motor(
      [existente],
      [
        [100, 0],
        [140, 0],
      ],
    );
    const ok = mergeExtensionPorExtremoConFallback(eng);
    expect(ok).toBe(true);
    expect(eng.activeRamal).toBeNull();
    expect(existente.pts).toEqual([
      [0, 0],
      [100, 0],
      [140, 0],
    ]);
    expect(eng.selId).toBe('RS1');
  });

  it('extremo sobre un bajante: NO mergea (laterales separados del Y doble)', () => {
    const existente = ramal('RS1', [
      [0, 0],
      [100, 0],
    ]);
    const eng = motor(
      [existente],
      [
        [100, 0],
        [140, 0],
      ],
    );
    (eng as unknown as { bajantes: unknown[] }).bajantes = [
      { id: 'BAN1', code: 'BAN1', x: 100, y: 0 },
    ];
    const ok = tryMergeExtensionPorExtremo(eng);
    expect(ok).toBe(false);
    expect(existente.pts).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it('trazo con id (edición de existente) no entra al merge', () => {
    const existente = ramal('RS1', [
      [0, 0],
      [100, 0],
    ]);
    const eng = motor(
      [existente],
      [
        [100, 0],
        [140, 0],
      ],
    );
    (eng.activeRamal as { id?: string }).id = 'RS9';
    const ok = tryMergeExtensionPorExtremo(eng);
    expect(ok).toBe(false);
  });

  it('excepción dentro del merge cae al fallback (false, sin lanzar)', () => {
    const eng = motor(
      [
        ramal('RS1', [
          [0, 0],
          [100, 0],
        ]),
      ],
      [
        [100, 0],
        [140, 0],
      ],
    );
    // ramales sin pts rompe el camino interno — el catch del wrapper lo absorbe.
    (eng as unknown as { ramales: unknown[] }).ramales = [{}];
    expect(() => mergeExtensionPorExtremoConFallback(eng)).not.toThrow();
  });
});
