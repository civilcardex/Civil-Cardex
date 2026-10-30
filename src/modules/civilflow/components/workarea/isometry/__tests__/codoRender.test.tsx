// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useIsometriaRender } from '../useIsometryRender.ts';
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

function montar(ramales: IsoRamal[], bajantes: IsoBajante[]) {
  const { canvas, calls } = mkCanvas();
  const props = {
    canvasRef: { current: canvas as unknown as HTMLCanvasElement },
    planImagesRef: { current: new Map() },
    dataByNet: { af: { ramales, bajantes } },
    activeNets: new Set(['af']),
    profByNet: { af: 0 },
    nptMap: { 0: 0 },
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
    // El marcador círculo+triángulo añade 1 arc propio; el empalme añade el segundo.
    expect(calls.filter((c) => c.op === 'arc').length).toBeGreaterThanOrEqual(2);
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
    expect(calls.filter((c) => c.op === 'arc').length).toBeGreaterThanOrEqual(2);
  });

  it('sin ramal conectado: solo el marcador (1 arco), sin empalme', () => {
    const calls = montar([], [montante('sube')]);
    expect(calls.filter((c) => c.op === 'arc')).toHaveLength(1);
  });
});
