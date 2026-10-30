import { describe, it, expect } from 'vitest';
import { dibujaCodoIso } from '../codoIso.ts';

// Geometría del empalme del codo 90° en isometría: tangencias a distancia R sobre las dos
// líneas (tubo vertical y ramal), centro en vertex+(fd+hd)·R, barrido SIEMPRE el corto
// (≤180° — el wrap de atan2 podía mandar el arco por los 270°), y salto si el ramal llega
// vertical (no hay esquina que curvar).

function mkCtx() {
  const calls: Array<{ op: string; args: unknown[] }> = [];
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
  return { ctx, calls };
}

function dibujar(lado: 'arriba' | 'abajo', ramalDir: { x: number; y: number }) {
  const { ctx, calls } = mkCtx();
  dibujaCodoIso({
    ctx,
    vertex: { sx: 100, sy: 100 },
    ramalDir,
    lado,
    R: 9,
    color: '#fff',
    sel: false,
  });
  return calls;
}

describe('empalme del codo (codoIso)', () => {
  it('dibuja UN arco por llamada (solo la curva — la flecha vive en el render)', () => {
    expect(dibujar('abajo', { x: 1, y: 0 }).filter((c) => c.op === 'arc')).toHaveLength(1);
  });

  it('ramal horizontal + lado abajo: tangencias a R sobre la vertical y el ramal', () => {
    const calls = dibujar('abajo', { x: 1, y: 0 });
    const [cx, cy, r, a1, a2, acw] = calls.find((c) => c.op === 'arc')!.args as never as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    expect(r).toBe(9);
    // Centro a R de cada rayo: C = vertex + (fd+hd)·R con fd=(0,1), hd=(1,0) → (109,109).
    expect(cx).toBeCloseTo(109, 5);
    expect(cy).toBeCloseTo(109, 5);
    // Tangencias: T1=(100,109) sobre el tubo, T2=(109,100) sobre el ramal.
    const t1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
    const t2 = { x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2) };
    expect(t1.x).toBeCloseTo(100, 5);
    expect(t1.y).toBeCloseTo(109, 5);
    expect(t2.x).toBeCloseTo(109, 5);
    expect(t2.y).toBeCloseTo(100, 5);
    // Barrido corto: el arco NO da la vuelta larga.
    const dosPi = Math.PI * 2;
    const sweep = acw
      ? (((a1 - a2) % dosPi) + dosPi) % dosPi
      : (((a2 - a1) % dosPi) + dosPi) % dosPi;
    expect(sweep).toBeCloseTo(Math.PI / 2, 5);
  });

  it('lado arriba: el arco sube (tangencia en la vertical por encima del vértice)', () => {
    const calls = dibujar('arriba', { x: 1, y: 0 });
    const [cx, cy] = calls.find((c) => c.op === 'arc')!.args as never as [number, number];
    expect(cy).toBeCloseTo(91, 5); // vertex + (fd+hd)·R con fd=(0,-1)
    expect(cx).toBeCloseTo(109, 5);
  });

  it('ramal VERTICAL (misma dirección que el tubo): sin arco — no hay esquina 90°', () => {
    expect(dibujar('abajo', { x: 0, y: 1 }).filter((c) => c.op === 'arc')).toHaveLength(0);
  });
});
