import { describe, expect, it } from 'vitest';
import { renderRamales } from '../renderers/renderRamales.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

// El des-tapado (espiral de labelDeclutter) mueve la etiqueta cuando su caja choca. Ese destino es
// de ESTE render: si se guarda en labelX/labelY, el frame siguiente lo toma como "por defecto",
// ahí está libre (las demás etiquetas siguen en su sitio) y no vuelve nunca. Resultado: la
// etiqueta emigra hasta ~400 px de su trazo y el destino queda persistido en label_x — de ahí el
// "al reingresar al visor las etiquetas me aparecen muy alejadas".

function makeCtx() {
  const ctxStub = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'measureText') return () => ({ width: 10 });
        return () => {};
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return ctxStub;
}

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  return {
    ramales,
    bajantes: [],
    areas: [],
    guideLines: [],
    textAnnots: [],
    crossFloorGhosts: [],
    multiSel: [],
    selId: null,
    activeRamal: null,
    activeNet: 'san',
    tool: 'select',
    tipoTramo: null,
    padreTributario: null,
    _hiddenNets: new Set(),
    zoom: 1,
    nivelActual: { label: 'P1', n: 1, npt: 0 } as never,
    MM: { lblName: 2, lblInfo: 2, coord: 2, diam: 2 },
    labelScaleM: 1,
    lineWidthScale: 1,
    cmToPlanePx: (cm: number) => cm,
    mm2cvs: (mm: number) => mm,
    toCvs: (x: number, y: number) => ({ x, y }),
    toPlane: (x: number, y: number) => ({ x, y }),
    render: () => {},
    scheduleRender: () => {},
    getBajantesFantasma: () => [],
    _markDirty: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
  } as unknown as IPlanoEngineCore;
}

const ramal = (id: string, pts: number[][], enMedio = true): PlanoRamal => {
  const mx = (pts[0][0] + pts[pts.length - 1][0]) / 2;
  const my = (pts[0][1] + pts[pts.length - 1][1]) / 2;
  return {
    id,
    net: 'san',
    code: id,
    label: id,
    pts,
    // Sin labelMoved: la etiqueta es automática y su ancla es el punto medio del trazo.
    labelX: enMedio ? mx : 5000,
    labelY: enMedio ? my : 5000,
    labelAngle: 0,
  } as unknown as PlanoRamal;
};

describe('des-tapado de etiquetas: no desterra al trazo', () => {
  it('el sitio elegido NO se guarda en labelX/labelY (sin trinquete entre renders)', () => {
    // Dos ramales que se CRUZAN: sus etiquetas caen en el mismo punto (el cruce), así que la
    // segunda tiene que des-taparse.
    const horizontal = ramal('RS1', [
      [0, 0],
      [100, 0],
    ]);
    const vertical = ramal('RS2', [
      [50, -50],
      [50, 50],
    ]);
    const eng = makeEngine([horizontal, vertical]);

    renderRamales(makeCtx(), eng);

    // Se des-tapó (la caja se fue del cruce)...
    expect(vertical._labelBox).toBeDefined();
    expect(vertical._labelBox!.cx).not.toBe(50);
    // ...pero su ancla sigue en el punto medio: el desplazamiento no se persistió.
    expect(vertical.labelX).toBe(50);
    expect(vertical.labelY).toBe(0);
  });

  it('un render repetido no migra la etiqueta cada vez (el trinquete seRestartaba)', () => {
    const horizontal = ramal('RS1', [
      [0, 0],
      [100, 0],
    ]);
    const vertical = ramal('RS2', [
      [50, -50],
      [50, 50],
    ]);
    const eng = makeEngine([horizontal, vertical]);

    renderRamales(makeCtx(), eng);
    const primeraCaja = { ...vertical._labelBox! };
    renderRamales(makeCtx(), eng);

    // Mismo sitio de pintado en el segundo pase (no "un poco más lejos" cada vez).
    expect(vertical._labelBox!.cx).toBe(primeraCaja.cx);
    expect(vertical._labelBox!.cy).toBe(primeraCaja.cy);
    expect(vertical.labelX).toBe(50);
  });

  it('reencasilla en el punto medio la etiqueta automática que quedó desterrada', () => {
    // Ancla a 5000 px del punto medio: no lo puso el usuario (una automática vive en el punto
    // medio; el arrastre y la edición lo reencasillan), lo dejó un des-tapado guardado.
    const r = ramal(
      'RS3',
      [
        [0, 0],
        [100, 0],
      ],
      false,
    );
    const eng = makeEngine([r]);

    renderRamales(makeCtx(), eng);

    expect(r.labelX).toBe(50);
    expect(r.labelY).toBe(0);
  });

  it('no toca una etiqueta automática que está cerca de su punto medio', () => {
    const r = ramal('RS4', [
      [0, 0],
      [100, 0],
    ]);
    r.labelX = 56; // desvío de un caja: legítimo, se respeta
    r.labelY = 3;
    const eng = makeEngine([r]);

    renderRamales(makeCtx(), eng);

    expect(r.labelX).toBe(56);
    expect(r.labelY).toBe(3);
  });

  it('jamás reencasilla una etiqueta movida a mano (labelMoved)', () => {
    const r = ramal('RS5', [
      [0, 0],
      [100, 0],
    ]);
    r.labelMoved = true;
    r.labelX = 5000;
    r.labelY = 5000;
    const eng = makeEngine([r]);

    renderRamales(makeCtx(), eng);

    expect(r.labelX).toBe(5000);
    expect(r.labelY).toBe(5000);
  });
});
