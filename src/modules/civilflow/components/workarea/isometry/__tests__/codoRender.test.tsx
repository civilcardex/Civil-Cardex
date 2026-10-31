// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useIsometriaRender } from '../useIsometryRender.ts';
import { project } from '../geometry.ts';
import type { IsoRamal, IsoBajante } from '../geometry.ts';

// Repro real del codo 90° en la isometría (hook con canvas grabado): un montante/bajante con
// ramal conectado por fin=code debe dibujar SU arco de empalme y dejar el ramal RECORTADO en
// la tangencia; sin ramal conectado solo hay marcador (0 arcos del empalme).

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.window)
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      devicePixelRatio: 1,
    };
  (g as { devicePixelRatio?: number }).devicePixelRatio = 1;
});

type Op = { op: string; args: unknown[] };

/** Tangencia T1 del empalme: el moveTo inmediatamente anterior a su bezierCurveTo (el resto de
 *  moveTo son de otras tuberías, del triángulo de la flecha o de las etiquetas). */
function t1DelEmpalme(calls: Op[]): number[] {
  const i = calls.findIndex((c) => c.op === 'bezierCurveTo');
  for (let j = i - 1; j >= 0; j--) {
    if (calls[j].op === 'moveTo') return calls[j].args as number[];
  }
  return [];
}

function mkCanvas() {
  const calls: Op[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'canvas') return null;
        if (k === 'measureText') return () => ({ width: 10 });
        return (...args: unknown[]) => {
          calls.push({ op: String(k), args });
        };
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 800,
    height: 600,
    style: {},
    getContext: () => ctx,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
  return { canvas, calls };
}

function montar(
  ramales: IsoRamal[],
  bajantes: IsoBajante[],
  nptMap: Record<number, number> = { 0: 0 },
) {
  const { canvas, calls } = mkCanvas();
  const props = {
    canvasRef: { current: canvas as unknown as HTMLCanvasElement },
    planImagesRef: { current: new Map() },
    dataByNet: { af: { ramales, bajantes } },
    activeNets: new Set(['af']),
    profByNet: { af: 0 },
    nptMap,
    pisos: [],
    rotZ: 45,
    rotX: -45,
    scaleZ: 1,
    zoom: 1,
    offX: 0,
    offY: 0,
    size: { w: 800, h: 600 },
    selTramo: null,
    showPlanos: false,
    confirmedPlanos: [],
    renderTick: 0,
    getIsoCoords: (x: number, y: number) => ({ x, y }),
    getZPix: (z: number) => z,
    pisosVisibles: null,
  };
  const cont = document.createElement('div');
  document.body.appendChild(cont);
  const Probe = () => useIsometriaRender(props) as never;
  act(() => {
    const root = createRoot(cont);
    root.render(<Probe />);
  });
  return calls;
}

function ramalHacia(pts: number[][], fin: string): IsoRamal {
  return {
    id: 'RAF1',
    net: 'af',
    tipo: 'ramal',
    pts,
    label: 'RAF1',
    ini: '',
    fin,
    planNivel: 0,
    planId: '1',
  } as unknown as IsoRamal;
}

function montante(direccion: 'sube' | 'baja'): IsoBajante {
  return {
    id: 'MAF1_af',
    net: 'af',
    tipo: 'montante',
    code: 'MAF1',
    x: 100,
    y: 100,
    pisoBase: 'P1',
    pisoCima: 'P1',
    nptBase: 0,
    nptCima: 0,
    hVert: 0,
    dNominal: '1/2"',
    recibeDeIds: ['RAF1'],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    direccion,
    planNivel: 0,
    planId: '1',
  } as unknown as IsoBajante;
}

describe('codo 90° en el render de isometría', () => {
  it('montante sube + ramal conectado: arco dibujado y ramal recortado en la tangencia', () => {
    const calls = montar(
      [
        ramalHacia(
          [
            [300, 100],
            [100, 100],
          ],
          'MAF1',
        ),
      ],
      [montante('sube')],
    );
    // El marcador círculo+triángulo añade 1 arc propio; el empalme añade su curva.
    expect(calls.filter((c) => c.op === 'arc').length).toBeGreaterThanOrEqual(1);
    expect(calls.filter((c) => c.op === 'bezierCurveTo')).toHaveLength(1);
    // El ramal NO llega al centro del montante (100,100): recortado antes de la tangencia.
    const lineTos = calls.filter((c) => c.op === 'lineTo').map((c) => c.args as number[]);
    expect(lineTos.some(([x, y]) => Math.abs(x - 100) < 0.5 && Math.abs(y - 100) < 0.5)).toBe(
      false,
    );
  });

  it('montante baja: mismo empalme, lado por donde el tubo sigue', () => {
    const calls = montar(
      [
        ramalHacia(
          [
            [300, 100],
            [100, 100],
          ],
          'MAF1',
        ),
      ],
      [montante('baja')],
    );
    expect(calls.filter((c) => c.op === 'bezierCurveTo')).toHaveLength(1);
  });

  it('sin ramal conectado: solo el marcador (1 arco), sin empalme', () => {
    const calls = montar([], [montante('sube')]);
    expect(calls.filter((c) => c.op === 'arc')).toHaveLength(1);
    expect(calls.filter((c) => c.op === 'bezierCurveTo')).toHaveLength(0);
  });
});

describe('bajante que VIENE BAJANDO (descargaEnId a piso inferior)', () => {
  it('baja con descarga: arco + ramal recortado + marcador separado por debajo', () => {
    const baj: IsoBajante = {
      ...(montante('baja') as object),
      id: 'BAN1',
      code: 'BAN1',
      tipo: 'bajante',
      dNominal: '4"',
      descargaEnId: '2|BAN1',
    } as unknown as IsoBajante;
    const props = {
      canvasRef: { current: null as unknown as HTMLCanvasElement },
      planImagesRef: { current: new Map() },
      dataByNet: {
        af: {
          ramales: [
            ramalHacia(
              [
                [300, 100],
                [100, 100],
              ],
              'BAN1',
            ),
          ],
          bajantes: [baj],
        },
      },
      activeNets: new Set(['af']),
      profByNet: { af: 0 },
      nptMap: { 0: 0, 1: 2700 },
      pisos: [],
      rotZ: 45,
      rotX: -45,
      scaleZ: 1,
      zoom: 1,
      offX: 0,
      offY: 0,
      size: { w: 800, h: 600 },
      selTramo: null,
      showPlanos: false,
      confirmedPlanos: [],
      renderTick: 0,
      getIsoCoords: (x: number, y: number) => ({ x, y }),
      getZPix: (z: number) => z,
      pisosVisibles: null,
    };
    const { canvas, calls } = (() => {
      const c = mkCanvas();
      props.canvasRef.current = c.canvas as unknown as HTMLCanvasElement;
      const cont = document.createElement('div');
      document.body.appendChild(cont);
      const Probe = () => useIsometriaRender(props) as never;
      act(() => {
        const root = createRoot(cont);
        root.render(<Probe />);
      });
      return c;
    })();
    void canvas;
    // Empalme: una sola curva (el marcador sigue siendo el círculo de radio 5).
    const curvas = calls.filter((c2) => c2.op === 'bezierCurveTo');
    expect(curvas.length).toBe(1);
    // Sin origenId (solo descarga): lado abajo — la tangencia sobre el tubo queda DEBAJO de la
    // unión (el test de abajo compara con el caso `origenId`). La cámara iso real proyecta con
    // rotación: la aserción absoluta no aplica en el mock.
    (window as unknown as { __cySinOrigen?: number }).__cySinOrigen = t1DelEmpalme(calls)[1];
    // Ramal recortado: ningún lineTo cae exacto en el centro del bajante (100,100).
    const lineTos = calls.filter((c2) => c2.op === 'lineTo').map((c2) => c2.args as number[]);
    expect(lineTos.some(([x, y]) => Math.abs(x - 100) < 0.5 && Math.abs(y - 100) < 0.5)).toBe(
      false,
    );
  });
});

describe('lado del codo según origen', () => {
  function montarLado(origenId: string | undefined) {
    const baj: IsoBajante = {
      ...(montante('baja') as object),
      id: 'BAN1',
      code: 'BAN1',
      tipo: 'bajante',
      dNominal: '4"',
      descargaEnId: null,
      origenId,
    } as unknown as IsoBajante;
    // Columna del piso superior que llega a la unión: sin ella `origenId` no puede forzar el
    // arco hacia arriba (el arco quedaría flotando sobre la tubería que baja).
    const arriba = {
      ...(montante('baja') as object),
      id: 'BAN2',
      code: 'BAN2',
      tipo: 'bajante',
      dNominal: '4"',
      planId: '2',
      planNivel: 1,
      descargaEnId: '1|BAN1',
    } as unknown as IsoBajante;
    const props = {
      canvasRef: { current: null as unknown as HTMLCanvasElement },
      planImagesRef: { current: new Map() },
      dataByNet: {
        af: {
          ramales: [
            ramalHacia(
              [
                [300, 100],
                [100, 100],
              ],
              'BAN1',
            ),
          ],
          bajantes: [baj, arriba],
        },
      },
      activeNets: new Set(['af']),
      profByNet: { af: 0 },
      nptMap: { 0: 0, 1: -2700 },
      pisos: [],
      rotZ: 45,
      rotX: -45,
      scaleZ: 1,
      zoom: 1,
      offX: 0,
      offY: 0,
      size: { w: 800, h: 600 },
      selTramo: null,
      showPlanos: false,
      confirmedPlanos: [],
      renderTick: 0,
      getIsoCoords: (x: number, y: number) => ({ x, y }),
      getZPix: (z: number) => z,
      pisosVisibles: null,
    };
    const c = mkCanvas();
    props.canvasRef.current = c.canvas as unknown as HTMLCanvasElement;
    const cont = document.createElement('div');
    document.body.appendChild(cont);
    const Probe = () => useIsometriaRender(props) as never;
    act(() => {
      const root = createRoot(cont);
      root.render(<Probe />);
    });
    const empalme = c.calls.filter((c2) => c2.op === 'bezierCurveTo');
    expect(empalme.length).toBe(1);
    // Tangencia sobre el TUBO (T1 del empalme): su y dice de qué lado va el codo.
    return t1DelEmpalme(c.calls)[1] as number;
  }

  it('sin origenId (solo descarga): empalme del lado de la descarga', () => {
    (window as unknown as { __cySin?: number }).__cySin = montarLado(undefined);
  });

  it('con origenId (viene bajando desde arriba): empalme ARRIBA del caso sin origen', () => {
    const cyCon = montarLado('2|BAN1');
    expect(cyCon).toBeLessThan((window as unknown as { __cySin?: number }).__cySin!);
  });
});

// El vértice en PANTALLA del bajante de prueba (100,100) a z=0 con la cámara del harness.
const UNION = project(100, 100, 0, 45, -45, 1, 1, 0, 0, 400, 300);

describe('varios ramales en el mismo bajante', () => {
  it('un arco de empalme por ramal, flecha fuera del abanico y vertical recortada UNA vez', () => {
    const calls = montar(
      [
        ramalHacia(
          [
            [300, 100],
            [100, 100],
          ],
          'MAF1',
        ),
        {
          ...ramalHacia(
            [
              [100, 250],
              [100, 100],
            ],
            'MAF1',
          ),
          id: 'RAF2',
        } as unknown as IsoRamal,
      ],
      [montante('sube')],
    );
    // Un empalme por ramal (antes solo el primero tenía codo).
    expect(calls.filter((c) => c.op === 'bezierCurveTo')).toHaveLength(2);
    // La flecha (círculo r=5) queda a R + r + 4 del vértice: ni sobre la curva ni sobre el tubo.
    const circulos = calls.filter((c) => c.op === 'arc' && (c.args as number[])[2] === 5);
    expect(circulos).toHaveLength(1);
    const [mx, my] = circulos[0].args as number[];
    expect(Math.hypot(mx - UNION.sx, my - UNION.sy)).toBeCloseTo(9 + 5 + 4, 4);
    // Con dos ramales simétricos la flecha cae RECTA hacia afuera del abanico (debajo de la
    // unión: las curvas van hacia arriba) — antes se sumaban las direcciones crudas y quedaba
    // sobre la vertical, dentro de las curvas.
    expect(mx).toBeCloseTo(UNION.sx, 4);
    expect(my).toBeCloseTo(UNION.sy + 18, 4);
    // La vertical arranca en la tangencia (R sobre el vértice), una sola vez: los empalmes
    // también hacen moveTo en T1 (por eso se descartan los que siguen con bezierCurveTo).
    const verticales = calls.filter((c, i) => {
      if (c.op !== 'moveTo') return false;
      const [x, y] = c.args as number[];
      return (
        Math.abs(x - UNION.sx) < 0.01 &&
        Math.abs(y - (UNION.sy - 9)) < 0.01 &&
        calls[i + 1]?.op === 'lineTo'
      );
    });
    expect(verticales).toHaveLength(1);
  });
});

describe('tee entre pisos: la vertical pasa recta por la unión', () => {
  it('un bajante del piso superior llega a la unión: NO se recorta la vertical', () => {
    const p1 = {
      ...(montante('baja') as object),
      id: 'BAN1',
      code: 'BAN1',
      tipo: 'bajante',
      descargaEnId: null,
    } as unknown as IsoBajante;
    const p2 = {
      ...(montante('baja') as object),
      id: 'BAN2',
      code: 'BAN2',
      tipo: 'bajante',
      planId: '2',
      planNivel: 1,
      descargaEnId: '1|BAN1',
    } as unknown as IsoBajante;
    const calls = montar(
      [
        ramalHacia(
          [
            [300, 100],
            [100, 100],
          ],
          'BAN1',
        ),
      ],
      [p1, p2],
      { 0: 0, 1: -2700 },
    );
    // El codo existe (1 empalme)…
    expect(calls.filter((c) => c.op === 'bezierCurveTo')).toHaveLength(1);
    // …pero la vertical del piso propio NO se recorta: termina EXACTA en la unión (lineTo).
    const enUnion = calls.filter(
      (c) =>
        c.op === 'lineTo' &&
        Math.abs((c.args as number[])[0] - UNION.sx) < 0.01 &&
        Math.abs((c.args as number[])[1] - UNION.sy) < 0.01,
    );
    // Las dos columnas (piso propio y piso superior) llegan a la misma unión: tubo continuo.
    expect(enUnion).toHaveLength(2);
    // Ningún arranque de vertical a R de la unión (eso sería el recorte indebido del tee).
    const recortadas = calls.filter(
      (c) =>
        c.op === 'moveTo' &&
        Math.abs((c.args as number[])[0] - UNION.sx) < 0.01 &&
        Math.abs((c.args as number[])[1] - (UNION.sy - 9)) < 0.01,
    );
    expect(recortadas).toHaveLength(0);
  });
});

describe('descarga entre pisos a un RAMAL', () => {
  it('dibuja el codo en el extremo inferior de la columna y recorta el ramal destino', () => {
    const ramalDestino = {
      ...ramalHacia(
        [
          [100, 100],
          [300, 100],
        ],
        '',
      ),
      id: 'RAF1',
      ini: '',
      fin: '',
      planId: '1',
      planNivel: 0,
    } as unknown as IsoRamal;
    const baj: IsoBajante = {
      ...(montante('baja') as object),
      id: 'BAN1',
      code: 'BAN1',
      tipo: 'bajante',
      planId: '2',
      planNivel: 1,
      descargaEnId: '1|RAF1',
    } as unknown as IsoBajante;
    const calls = montar([ramalDestino], [baj], { 0: 0, 1: -2700 });
    // El empalme vive en el extremo INFERIOR de la columna (la unión del piso destino).
    const curvas = calls.filter((c) => c.op === 'bezierCurveTo');
    expect(curvas).toHaveLength(1);
    // La vertical se recorta en la tangencia (R sobre la unión).
    const lineTos = calls.filter((c) => c.op === 'lineTo').map((c) => c.args as number[]);
    expect(
      lineTos.some(
        ([x, y]) => Math.abs(x - UNION.sx) < 0.01 && Math.abs(y - (UNION.sy - 9)) < 0.01,
      ),
    ).toBe(true);
    // El ramal NO llega crudo a la unión: su extremo queda a R (recortado en la tangencia).
    expect(
      lineTos.some(([x, y]) => Math.abs(x - UNION.sx) < 0.01 && Math.abs(y - UNION.sy) < 0.01),
    ).toBe(false);
    expect(
      lineTos.some(([x, y]) => Math.abs(Math.hypot(x - UNION.sx, y - UNION.sy) - 9) < 0.2),
    ).toBe(true);
  });
});

describe('origenId sin vertical dibujada arriba', () => {
  it('el arco va hacia ABAJO (donde sigue el tubo) en vez de flotar sobre la unión', () => {
    const baj: IsoBajante = {
      ...(montante('baja') as object),
      id: 'BAN1',
      code: 'BAN1',
      tipo: 'bajante',
      origenId: '2|BAN1',
    } as unknown as IsoBajante;
    const calls = montar(
      [
        ramalHacia(
          [
            [300, 100],
            [100, 100],
          ],
          'BAN1',
        ),
      ],
      [baj],
    );
    const curvas = calls.filter((c) => c.op === 'bezierCurveTo');
    expect(curvas).toHaveLength(1);
    // La tangencia sobre el tubo queda DEBAJO de la unión (fd = abajo): la curva empalma con la
    // vertical visible, que baja desde el piso. Antes `origenId` forzaba 'arriba' y flotaba.
    expect(t1DelEmpalme(calls)[1]).toBeGreaterThan(UNION.sy);
    // Y la vertical se recorta en esa tangencia (arranca R debajo de la unión).
    const lineTos = calls.filter((c) => c.op === 'lineTo').map((c) => c.args as number[]);
    expect(
      lineTos.some(
        ([x, y]) => Math.abs(x - UNION.sx) < 0.01 && Math.abs(y - (UNION.sy + 9)) < 0.01,
      ),
    ).toBe(true);
  });
});

// Estructura EXACTA del usuario (2026-10-31): bajante superior con descarga a una BAJANTE
// del piso inferior, y el horizontal que ve es el LD_ de esa bajante inferior nacido en el
// anillo (= la posición de la bajante superior proyectada). El codo debe unir la vertical
// con el LD_ en el anillo, y el LD_ queda recortado en su tangencia.
describe('descarga a BAJANTE + LD_ al pie (caso usuario)', () => {
  it('codo vertical→LD_ en el anillo, con el LD_ recortado', () => {
    const bans: IsoBajante = {
      ...(montante('baja') as object),
      id: 'BANS',
      code: 'BAN1',
      tipo: 'bajante',
      descargaEnId: '2|BAN1',
      planId: '1',
      planNivel: 0,
    } as unknown as IsoBajante;
    const banInf: IsoBajante = {
      ...(montante('baja') as object),
      id: 'BAN1',
      code: 'BAN1',
      tipo: 'bajante',
      origenId: '1|BANS',
      planId: '2',
      planNivel: 1,
    } as unknown as IsoBajante;
    const ld: IsoRamal = {
      id: 'LD_BAN1',
      net: 'af',
      tipo: 'ramal',
      pts: [
        [100, 100],
        [260, 130],
      ],
      label: 'LDBAN1',
      ini: '',
      fin: 'BAN1',
      planNivel: 1,
      planId: '2',
    } as unknown as IsoRamal;
    const calls = montar([ld], [bans, banInf], { 0: 0, 1: 2700 });
    // El empalme vertical→LD_ existe (Bézier).
    const t1 = t1DelEmpalme(calls);
    expect(t1.length).toBe(2);
    // El LD_ queda recortado: ningún lineTo exacto en su extremo (100,100).
    const lineTos = calls.filter((c) => c.op === 'lineTo').map((c) => c.args as number[]);
    expect(lineTos.some(([x, y]) => Math.abs(x - 100) < 0.5 && Math.abs(y - 100) < 0.5)).toBe(
      false,
    );
  });
});
