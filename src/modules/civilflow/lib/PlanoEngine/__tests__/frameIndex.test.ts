import { describe, it, expect } from 'vitest';
import {
  iniciarFrame,
  terminarFrame,
  indiceFrame,
  firmaGeometria,
} from '../renderers/frameIndex.ts';
import type { IPlanoEngineCore } from '../PlanoState.ts';

/**
 * Índice geométrico del frame (lo que hizo usable el render: antes cada codo y cada unión
 * recorrían TODOS los ramales y todos sus puntos). Estos tests fijan las tres cosas que no
 * pueden romperse: que encuentre los mismos candidatos que el barrido completo, que se
 * reutilice mientras la geometría no cambie y que se rehaga cuando cambie.
 */

function engineCon(ramales: unknown[]): IPlanoEngineCore {
  return {
    ramales,
    bajantes: [],
    areas: [],
    textAnnots: [],
    _hiddenNets: new Set<string>(),
  } as unknown as IPlanoEngineCore;
}

const ramal = (id: string, pts: number[][], extra: Record<string, unknown> = {}) => ({
  id,
  net: 'af',
  pts,
  labelMoved: false,
  ...extra,
});

describe('indiceFrame · consultas', () => {
  const eng = engineCon([
    ramal('R1', [
      [0, 0],
      [100, 0],
      [100, 100],
    ]),
    ramal('R2', [
      [50, 50],
      [150, 50],
    ]),
    ramal(
      'T1',
      [
        [100, 0],
        [100, -50],
      ],
      { padre: 'R1' },
    ),
  ]);

  it('tocan: vértices a menos de 0.5 con su índice', () => {
    iniciarFrame(eng);
    try {
      const refs = indiceFrame(eng).tocan(100, 0);
      expect(refs.map((r) => `${r.r.id}:${r.i}`).sort()).toEqual(['R1:1', 'T1:0']);
      expect(indiceFrame(eng).tocan(999, 999)).toEqual([]);
    } finally {
      terminarFrame();
    }
  });

  it('cruzan: cuerpo que pasa por el punto sin tener vértice ahí', () => {
    iniciarFrame(eng);
    try {
      // (75,50) está SOBRE el cuerpo de R2 y lejos de sus extremos.
      const ids = indiceFrame(eng)
        .cruzan(75, 50)
        .map((r) => r.id);
      expect(ids).toEqual(['R2']);
      // En (100,0) hay vértice: el cuerpo de R2 no pasa por ahí.
      expect(
        indiceFrame(eng)
          .cruzan(100, 0)
          .map((r) => r.id),
      ).not.toContain('R2');
    } finally {
      terminarFrame();
    }
  });

  it('porPts, hijosDe y orden', () => {
    iniciarFrame(eng);
    try {
      const idx = indiceFrame(eng);
      const pts = (eng.ramales[1] as unknown as { pts: number[][] }).pts;
      expect(idx.porPts(pts)?.id).toBe('R2');
      expect(idx.porPts([[0, 0]])).toBeUndefined();
      expect(idx.hijosDe('R1').map((r) => r.id)).toEqual(['T1']);
      expect(idx.hijosDe('nadie')).toEqual([]);
      expect([idx.orden(eng.ramales[0]), idx.orden(eng.ramales[2])]).toEqual([0, 2]);
    } finally {
      terminarFrame();
    }
  });
});

describe('indiceFrame · reutilización entre frames', () => {
  it('misma geometría → el índice NO se reconstruye (el paneo no paga nada)', () => {
    const eng = engineCon([
      ramal('R1', [
        [0, 0],
        [100, 0],
      ]),
    ]);
    const a = iniciarFrame(eng);
    terminarFrame();
    const b = iniciarFrame(eng);
    terminarFrame();
    expect(b).toBe(a);
  });

  it('un punto movido → cambia la firma y el índice se rehace', () => {
    const r = ramal('R1', [
      [0, 0],
      [100, 0],
    ]);
    const eng = engineCon([r]);
    const a = iniciarFrame(eng);
    terminarFrame();
    (r.pts as number[][])[1] = [300, 0];
    const firma2 = firmaGeometria(eng);
    expect(firma2).not.toBe(a.firma);
    const b = iniciarFrame(eng);
    terminarFrame();
    expect(b).not.toBe(a);
    expect(b.tocan(300, 0).map((x) => x.r.id)).toEqual(['R1']);
  });

  it('etiqueta movida o red oculta también invalidan (la firma cubre lo que cambia la vista)', () => {
    const r = ramal('R1', [
      [0, 0],
      [100, 0],
    ]);
    const eng = engineCon([r]);
    const base = firmaGeometria(eng);
    r.labelMoved = true;
    expect(firmaGeometria(eng)).not.toBe(base);
    (eng._hiddenNets as Set<string>).add('af');
    expect(firmaGeometria(eng)).not.toBe(base);
  });
});
