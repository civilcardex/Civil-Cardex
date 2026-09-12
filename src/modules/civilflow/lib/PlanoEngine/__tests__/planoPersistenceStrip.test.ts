import { describe, it, expect } from 'vitest';
import { serializeWork } from '../PlanoPersistence';

// Strip de cachés de render (orig. usuario piso 2): `_labelBox`/`_circ` se recalculan en
// cada render y dominaban el JSON (cuota muda → caché local vieja → GC borraba UDs).

const baseEngine = {
  scaleM: 0.5,
  definedScaleM: 0.5,
  activeNet: 'san',
  zoom: 1,
  offX: 0,
  offY: 0,
  lineWidthScale: 1,
  dims: [],
  textAnnots: [],
  areas: [],
  nptLevels: [],
  crossFloorGhosts: [],
  guideLines: [],
};

describe('serializeWork strip de cachés de render', () => {
  it('quita _labelBox/_circ pero conserva geometría, fixtures y referencias', () => {
    const ramal = {
      id: 'RS1',
      net: 'san',
      pts: [
        [0, 0],
        [10, 0],
      ],
      fixtures: { lvm: 1 },
      recibeDeIds: ['X'],
      _labelBox: { cx: 1, cy: 2, corners: [[0, 0]] },
    };
    const bajante = {
      id: 'BAN1',
      net: 'san',
      recibeDeIds: ['RS1'],
      ucAplicado: { RS1: { san: 1 } },
      _circ: { x: 0, y: 0, r: 8 },
      _labelBox: { cx: 3 },
    };
    const work = serializeWork({ ...baseEngine, ramales: [ramal], bajantes: [bajante] });
    const raw = JSON.stringify(work);
    expect(raw).not.toContain('_labelBox');
    expect(raw).not.toContain('_circ');
    expect(work.ramales).toEqual([
      {
        id: 'RS1',
        net: 'san',
        pts: [
          [0, 0],
          [10, 0],
        ],
        fixtures: { lvm: 1 },
        recibeDeIds: ['X'],
      },
    ]);
    expect(work.bajantes).toEqual([
      { id: 'BAN1', net: 'san', recibeDeIds: ['RS1'], ucAplicado: { RS1: { san: 1 } } },
    ]);
    // Sin mutar los objetos vivos del engine.
    expect(ramal).toHaveProperty('_labelBox');
    expect(bajante).toHaveProperty('_circ');
  });

  it('reduce el tamaño del JSON en trazos con etiquetas', () => {
    const big = {
      id: 'RS1',
      pts: [
        [0, 0],
        [10, 0],
      ],
      _labelBox: {
        cx: 1,
        cy: 2,
        w: 90,
        h: 40,
        corners: [
          [1, 2],
          [3, 4],
          [5, 6],
          [7, 8],
        ],
      },
    };
    const withCache = JSON.stringify(big).length;
    const [strippedRamal] = serializeWork({ ...baseEngine, ramales: [big], bajantes: [] })
      .ramales as unknown[];
    const stripped = JSON.stringify(strippedRamal).length;
    expect(stripped).toBeLessThan(withCache / 2);
  });

  it('tolera arreglos ausentes (mocks parciales)', () => {
    const work = serializeWork({ ...baseEngine, ramales: [], bajantes: undefined as never });
    expect(work.bajantes).toEqual([]);
  });
});
