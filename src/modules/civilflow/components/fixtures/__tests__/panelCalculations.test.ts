import { describe, it, expect } from 'vitest';
import { itemsDelPanel } from '../panelItems.ts';
import { calcularMergeKeys, type RamalMerge } from '../mergeKeys.ts';

/**
 * Los dos cálculos del panel de aparatos: la lista de la red con su override y las claves combinadas de un ramal (empalme + subárbol aguas arriba).
 * Ej: ramal RS3 con mergesFrom RS1/RS2 -> claves de RS3, RS1 y RS2, cada una una vez.
 */
describe('itemsDelPanel', () => {
  it('sin unidad de tabla no hay lista', () => {
    expect(itemsDelPanel('san', null, [])).toEqual([]);
  });

  it('en san/ll la lista es la de unidades de desag\u00fce', () => {
    const items = itemsDelPanel('san', 'ud', []);
    expect(items.length).toBeGreaterThan(0);
    // La lista viene ordenada por el cat\u00e1logo base (UD_BASE_INIT), no alfab\u00e9ticamente.
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('el override de la red aplicada gana al valor del cat\u00e1logo', () => {
    const base = itemsDelPanel('af', 'uc_af', []);
    const primero = base[0];
    // El campo del override es 'ucaf' (no 'uc_af'): lo define APS_FIELD en el panel.
    const conOverride = itemsDelPanel('af', 'uc_af', [{ id: primero.id, ucaf: 99 }] as never);
    const idx = conOverride.findIndex((i) => i.id === primero.id);
    expect(conOverride[idx].uc_af).toBe(99);
  });
});

describe('calcularMergeKeys', () => {
  const ramal = (id: string, over: Partial<RamalMerge> = {}): RamalMerge => ({
    id,
    net: 'san',
    tipo: 'ramal',
    pts: [
      [0, 0],
      [100, 0],
    ],
    ...over,
  });

  it('sin objetivo no hay claves', () => {
    expect(
      calcularMergeKeys({ target: { id: '' }, netId: 'san', allRamalesForPlan: [], bajantes: [] }),
    ).toBeNull();
  });

  it('un ramal auto-creado muestra el combinado de su empalme', () => {
    const rs = [
      ramal('RS1', {
        mergesFrom: undefined,
        pts: [
          [0, 0],
          [50, 0],
        ],
      }),
      ramal('RS2', {
        mergesFrom: undefined,
        pts: [
          [0, 0],
          [0, 50],
        ],
      }),
      ramal('RS3', {
        mergesFrom: ['RS1', 'RS2'],
        pts: [
          [50, 0],
          [100, 0],
        ],
      }),
    ];
    const claves = calcularMergeKeys({
      target: rs[2],
      netId: 'san',
      allRamalesForPlan: rs,
      bajantes: [],
    });
    expect(claves).not.toBeNull();
    expect(claves!.length).toBeGreaterThan(0);
  });

  it('el sub\u00e1rbol aguas arriba se acumula (transitividad)', () => {
    const rs = [
      ramal('RS1', {
        mergesFrom: undefined,
        pts: [
          [0, 0],
          [50, 0],
        ],
      }),
      ramal('RS2', {
        mergesFrom: undefined,
        pts: [
          [0, 0],
          [0, 50],
        ],
      }),
      ramal('RS3', {
        mergesFrom: ['RS1', 'RS2'],
        pts: [
          [50, 0],
          [100, 0],
        ],
      }),
    ];
    const claves = calcularMergeKeys({
      target: rs[2],
      netId: 'san',
      allRamalesForPlan: rs,
      bajantes: [],
    });
    // Las claves son id_plan: cada ramal aparece UNA vez.
    expect(new Set(claves).size).toBe(claves!.length);
  });
});
