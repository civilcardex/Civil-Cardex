import { describe, it, expect } from 'vitest';
import { handleDragUp } from '../handleDragUp';
import type { IPlanoEngineCore } from '../PlanoState';

// Marquee: solo geometría dentro del recuadro. La etiqueta puede arrastrarse lejos del
// trazo — antes seleccionaba ramales fuera del recuadro (orig. usuario). El cruce de
// segmentos sí selecciona (window-crossing, igual que las guías).

function makeEngine(): IPlanoEngineCore {
  return {
    ramales: [],
    bajantes: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    multiSel: [],
    selId: null,
    marqueeRect: { x1: 0, y1: 0, x2: 100, y2: 100 },
    toCvs: (x: number, y: number) => ({ x, y }),
    _emitSelect: () => {},
    render: () => {},
  } as unknown as IPlanoEngineCore;
}

const ramal = (o: object) =>
  ({
    id: 'RX',
    net: 'san',
    tipo: 'ramal',
    labelX: 0,
    labelY: 0,
    pts: [
      [0, 0],
      [10, 0],
    ],
    ...o,
  }) as never;

describe('marquee multiselección por recuadro', () => {
  it('etiqueta dentro pero trazo fuera → NO selecciona', () => {
    const eng = makeEngine();
    eng.ramales = [
      ramal({
        id: 'RS1',
        labelX: 50,
        labelY: 50,
        pts: [
          [500, 500],
          [540, 500],
        ],
      }),
    ] as never;
    handleDragUp(eng);
    expect(eng.multiSel).not.toContain('RS1');
  });

  it('vértice dentro → selecciona', () => {
    const eng = makeEngine();
    eng.ramales = [
      ramal({
        id: 'RS1',
        pts: [
          [50, 50],
          [500, 500],
        ],
      }),
    ] as never;
    handleDragUp(eng);
    expect(eng.multiSel).toContain('RS1');
  });

  it('segmento que cruza sin vértices dentro → selecciona', () => {
    const eng = makeEngine();
    eng.ramales = [
      ramal({
        id: 'RS1',
        pts: [
          [-50, 50],
          [150, 50],
        ],
      }),
    ] as never;
    handleDragUp(eng);
    expect(eng.multiSel).toContain('RS1');
  });

  it('bajante con centro fuera → NO selecciona (aunque esté cerca)', () => {
    const eng = makeEngine();
    eng.bajantes = [{ id: 'BAN1', net: 'san', x: 150, y: 50 }] as never;
    handleDragUp(eng);
    expect(eng.multiSel).not.toContain('BAN1');
  });
});
