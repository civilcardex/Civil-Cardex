import { describe, expect, it } from 'vitest';
import { dibujaOverlayCalibracion, type EstadoOverlay } from '../calibrationSuperposicion.ts';

/**
 * Caracterización del overlay de calibración: el dibujo es una función pura y el test usa un contexto falso que registra lo pintado.
 * Ej: origen marcado -> el contexto registra la cruz y la etiqueta (0,0).
 */

interface Llamada {
  metodo: string;
  args: unknown[];
}

/** Contexto 2D falso: registra las llamadas y devuelve medidas plausibles. */
function ctxFalso() {
  const llamadas: Llamada[] = [];
  const rec =
    (metodo: string) =>
    (...args: unknown[]) => {
      llamadas.push({ metodo, args });
    };
  const ctx = {
    llamadas,
    save: rec('save'),
    restore: rec('restore'),
    setTransform: rec('setTransform'),
    clearRect: rec('clearRect'),
    setLineDash: rec('setLineDash'),
    beginPath: rec('beginPath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    stroke: rec('stroke'),
    fill: rec('fill'),
    fillText: rec('fillText'),
    roundRect: rec('roundRect'),
    measureText: (t: string) => ({ width: t.length * 6 }),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    font: '',
    shadowColor: '',
    shadowBlur: 0,
  };
  return ctx as unknown as CanvasRenderingContext2D & { llamadas: Llamada[] };
}

function estado(over: Partial<EstadoOverlay> = {}): EstadoOverlay {
  return {
    origen: null,
    calStart: null,
    calPreview: null,
    modoOrigen: false,
    modoCalX: false,
    modoCalY: false,
    cursorPos: null,
    pageW: 1000,
    pageH: 800,
    scaleM: null,
    factorX: null,
    factorY: null,
    lenX: '',
    lenY: '',
    preScaleM: null,
    isPdf: false,
    ...over,
  };
}

describe('dibujaOverlayCalibracion — qué se pinta según el modo', () => {
  it('sin nada activo no pinta nada', () => {
    const ctx = ctxFalso();
    dibujaOverlayCalibracion(ctx, estado());
    expect(ctx.llamadas.length).toBe(0);
  });

  it('con origen marcado pinta la cruz naranja y la etiqueta (0,0)', () => {
    const ctx = ctxFalso();
    dibujaOverlayCalibracion(ctx, estado({ origen: { x_px: 100, y_px: 200 } }));
    const textos = ctx.llamadas.filter((c) => c.metodo === 'fillText').map((c) => c.args[0]);
    expect(textos).toContain('(0,0)');
  });

  it('en modo origen muestra la instrucción del clic', () => {
    const ctx = ctxFalso();
    dibujaOverlayCalibracion(ctx, estado({ modoOrigen: true }));
    const textos = ctx.llamadas.filter((c) => c.metodo === 'fillText').map((c) => c.args[0]);
    expect(textos.some((t) => String(t).includes('Clic en la intersección'))).toBe(true);
  });

  it('en modo Cal X muestra la instrucción del eje horizontal', () => {
    const ctx = ctxFalso();
    dibujaOverlayCalibracion(ctx, estado({ modoCalX: true }));
    const textos = ctx.llamadas.filter((c) => c.metodo === 'fillText').map((c) => c.args[0]);
    expect(textos.some((t) => String(t).includes('línea horizontal'))).toBe(true);
  });

  it('la previsualización mide en cm mientras no hay escala calibrada', () => {
    const ctx = ctxFalso();
    dibujaOverlayCalibracion(
      ctx,
      estado({
        modoCalX: true,
        calStart: { x_px: 0, y_px: 0 },
        calPreview: { x: 96, y: 0 },
      }),
    );
    const textos = ctx.llamadas.filter((c) => c.metodo === 'fillText').map((c) => c.args[0]);
    // 96 px a 96 dpi son 2.54 cm.
    expect(textos.some((t) => String(t).includes('2.54 cm'))).toBe(true);
  });

  it('con escala calibrada la previsualización mide en metros', () => {
    const ctx = ctxFalso();
    dibujaOverlayCalibracion(
      ctx,
      estado({
        modoCalX: true,
        calStart: { x_px: 0, y_px: 0 },
        calPreview: { x: 96, y: 0 },
        scaleM: 0.01,
      }),
    );
    const textos = ctx.llamadas.filter((c) => c.metodo === 'fillText').map((c) => c.args[0]);
    expect(textos.some((t) => String(t).includes('0.03 m'))).toBe(true);
  });
});
