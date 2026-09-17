import { describe, it, expect } from 'vitest';
import { handleDragUp } from '../handleDragUp';
import { _tryMultiSelDrag } from '../mouseDownHits';
import { handleDragMove } from '../handleDragMove';
import type { IPlanoEngineCore } from '../PlanoState';

// Multiselección universal (orig. usuario): el marquee selecciona TODO elemento que TOQUE el
// recuadro (intersección bbox/segmento — nunca contención total ni solo el punto centro) y las
// cotas entran al arrastre de grupo como cualquier otro tipo.

function makeEngine(): IPlanoEngineCore {
  return {
    ramales: [],
    bajantes: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    dims: [],
    multiSel: [],
    selId: null,
    marqueeRect: { x1: 0, y1: 0, x2: 100, y2: 100 },
    toCvs: (x: number, y: number) => ({ x, y }),
    toPlane: (x: number, y: number) => ({ x, y }),
    cmToPlanePx: (cm: number) => (cm / 100) * 75, // 200cm → 150px, como scaleM 0.5
    _emitSelect: () => {},
    render: () => {},
    scheduleRender: () => {},
  } as unknown as IPlanoEngineCore;
}

describe('marquee universal: tocar cualquier parte selecciona', () => {
  it('COTA: segmento que cruza el recuadro → selecciona', () => {
    const eng = makeEngine();
    eng.dims = [{ id: 'D1', x1: -50, y1: 50, x2: 150, y2: 50, L: 2 }] as never;
    handleDragUp(eng);
    expect(eng.multiSel).toContain('D1');
  });

  it('COTA: etiqueta arrastrada dentro del recuadro → selecciona (la etiqueta es parte del elemento)', () => {
    const eng = makeEngine();
    eng.dims = [
      { id: 'D1', x1: 500, y1: 500, x2: 540, y2: 500, L: 0.4, lblX: 50, lblY: 50 },
    ] as never;
    handleDragUp(eng);
    expect(eng.multiSel).toContain('D1');
  });

  it('COTA: completamente fuera → NO selecciona', () => {
    const eng = makeEngine();
    eng.dims = [{ id: 'D1', x1: 500, y1: 500, x2: 540, y2: 500, L: 0.4 }] as never;
    handleDragUp(eng);
    expect(eng.multiSel).not.toContain('D1');
  });

  it('CANAL: esquina (x,y) fuera (arriba-izq) pero su rect atraviesa el recuadro → selecciona', () => {
    const eng = makeEngine();
    // Esquina sup-izq (-50,-80) con rect de 150x150 px: el punto (x,y) queda fuera del marquee
    // (0..100) PERO el cuerpo del canal sí lo atraviesa — bbox-intersect lo agarra.
    eng.bajantes = [
      { id: 'CNL1', net: 'll', tipo: 'canal', x: -50, y: -80, longitud: 200, base: 200 },
    ] as never;
    handleDragUp(eng);
    expect(eng.multiSel).toContain('CNL1');
  });

  it('BAJANTE: centro fuera pero su disco (_circ) toca el borde del recuadro → selecciona', () => {
    const eng = makeEngine();
    eng.bajantes = [
      { id: 'BAN1', net: 'san', x: 150, y: 50, _circ: { x: 150, y: 50, r: 60 } },
    ] as never;
    handleDragUp(eng);
    expect(eng.multiSel).toContain('BAN1');
  });

  it('TEXTO: punto ancla fuera pero su caja (_box) intersecta el recuadro → selecciona', () => {
    const eng = makeEngine();
    eng.textAnnots = [
      { id: 'T1', x: 200, y: 200, text: 'hola', _box: { x: 90, y: 20, w: 40, h: 20 } },
    ] as never;
    handleDragUp(eng);
    expect(eng.multiSel).toContain('T1');
  });

  it('grupo: la COTA se arrastra con el conjunto (origData + multiDrag)', () => {
    const eng = makeEngine();
    eng.tool = 'sel' as never;
    eng.dims = [{ id: 'D1', x1: 10, y1: 10, x2: 60, y2: 10, L: 0.5, lblX: 35, lblY: 5 }] as never;
    eng.multiSel = ['D1'];
    // Clic sobre el segmento de la cota (35, 10)
    const consumed = _tryMultiSelDrag(eng, 35, 10, false);
    expect(consumed).toBe(true);
    expect(eng.multiDrag?.origData['D1']?.type).toBe('dim');
    // Arrastrar 10,5
    handleDragMove(eng, 45, 15);
    const d = eng.dims[0] as { x1: number; y1: number; x2: number; y2: number; lblX: number };
    expect(d.x1).toBe(20);
    expect(d.y1).toBe(15);
    expect(d.x2).toBe(70);
    expect(d.y2).toBe(15);
    expect(d.lblX).toBe(45);
  });
});
