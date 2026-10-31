import { describe, it, expect } from 'vitest';
import { dibujaCodoIso } from '../codoIso.ts';

// Geometría del empalme del codo 90° en isometría: tangencias a R sobre las dos líneas (tubo
// vertical y ramal), curva cúbica con los controles sobre las tangentes → el empalme entra y
// sale alineado con las dos tuberías para CUALQUIER ángulo de pantalla (en iso la vertical y el
// ramal forman 54.7° o 125.3°, no 90°: el arco circular se enroscaba hacia afuera en el lado
// obtuso). Salto si el ramal llega vertical (no hay esquina que curvar).

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

type Pt = { x: number; y: number };
function curva(calls: Array<{ op: string; args: unknown[] }>) {
  const m = calls.find((c) => c.op === 'moveTo')!.args as number[];
  const b = calls.find((c) => c.op === 'bezierCurveTo')!.args as number[];
  return {
    t1: { x: m[0], y: m[1] },
    c1: { x: b[0], y: b[1] },
    c2: { x: b[2], y: b[3] },
    t2: { x: b[4], y: b[5] },
  };
}

/** ¿El vector v es paralelo a la dirección d? (tangencia: control alineado con la tubería). */
function paralelo(v: Pt, d: Pt): boolean {
  return Math.abs(v.x * d.y - v.y * d.x) < 1e-6;
}

describe('empalme del codo (codoIso)', () => {
  it('dibuja UNA curva por llamada (solo el empalme — la flecha vive en el render)', () => {
    const calls = dibujar('abajo', { x: 1, y: 0 });
    expect(calls.filter((c) => c.op === 'bezierCurveTo')).toHaveLength(1);
    expect(calls.filter((c) => c.op === 'arc')).toHaveLength(0);
  });

  it('ramal horizontal + lado abajo: tangencias a R sobre la vertical y el ramal', () => {
    const { t1, t2 } = curva(dibujar('abajo', { x: 1, y: 0 }));
    // T1 = vertex + fd·R con fd = (0,1) (el tubo sigue abajo); T2 = vertex + hd·R.
    expect(t1).toEqual({ x: 100, y: 109 });
    expect(t2).toEqual({ x: 109, y: 100 });
  });

  it('lado arriba: la tangencia del tubo queda por ENCIMA del vértice', () => {
    const { t1 } = curva(dibujar('arriba', { x: 1, y: 0 }));
    expect(t1).toEqual({ x: 100, y: 91 });
  });

  it('los controles caen sobre las tangentes: la curva entra y sale alineada', () => {
    // Caso iso real (ramal diagonal abajo-derecha): el control de T1 va por la vertical y el de
    // T2 por la línea del ramal — sin esto la curva remata en pico contra la tubería.
    const hd = { x: 0.816, y: 0.577 };
    const { t1, t2, c1, c2 } = curva(dibujar('arriba', hd));
    expect(paralelo({ x: c1.x - t1.x, y: c1.y - t1.y }, { x: 0, y: 1 })).toBe(true);
    expect(paralelo({ x: t2.x - c2.x, y: t2.y - c2.y }, hd)).toBe(true);
  });

  it('ángulo OBTUSO (tubo arriba + ramal abajo-derecha): la curva no se sale del codo', () => {
    // Antes el arco circular de radio R enroscaba hacia arriba-izquierda (gancho fuera de la
    // esquina). La cúbica vive dentro del triángulo T1-vértice-T2: ningún punto pasa a la
    // izquierda de la vertical ni por encima de la tangencia del tubo.
    const hd = { x: 0.816, y: 0.577 };
    const { t1, c1, c2, t2 } = curva(dibujar('arriba', hd));
    const puntos = [t1, c1, c2, t2];
    for (const p of puntos) {
      expect(p.x).toBeGreaterThanOrEqual(100 - 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(91 - 1e-9);
    }
  });

  it('ramal VERTICAL (misma dirección que el tubo): sin curva — no hay esquina 90°', () => {
    expect(dibujar('abajo', { x: 0, y: 1 }).filter((c) => c.op === 'bezierCurveTo')).toHaveLength(
      0,
    );
  });
});
