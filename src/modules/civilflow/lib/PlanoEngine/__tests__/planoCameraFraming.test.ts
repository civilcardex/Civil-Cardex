import { describe, it, expect } from 'vitest';
import { encuadrarHoja, encuadrarDibujo, bboxDePuntos } from '../planoCamera';

/**
 * Encuadre del visor: lámina centrada y zoom sobre solo el dibujo (sin el fondo negro).
 * Ej: dibujo de 200x100 en viewport 1000x800 -> su centro cae en (500,400) y cabe completo.
 */
describe('encuadrarDibujo', () => {
  const vis = { visW: 1000, visH: 800, pageW: 2000, pageH: 1600 };

  it('centra el dibujo en el viewport', () => {
    const enc = encuadrarDibujo({
      ...vis,
      bbox: { minX: 0, minY: 0, maxX: 200, maxY: 100 },
    });
    // El centro del bbox (100, 50) cae en el centro del viewport (500, 400).
    const cx = 100 * enc.zoom + enc.offX;
    const cy = 50 * enc.zoom + enc.offY;
    expect(cx).toBeCloseTo(500, 6);
    expect(cy).toBeCloseTo(400, 6);
  });

  it('el zoom muestra el dibujo completo (con un poco de aire)', () => {
    const enc = encuadrarDibujo({
      ...vis,
      bbox: { minX: 0, minY: 0, maxX: 200, maxY: 100 },
    });
    // El ancho del dibujo escalado cabe en el viewport con el margen.
    expect(200 * enc.zoom).toBeLessThanOrEqual(1000);
    expect(100 * enc.zoom).toBeLessThanOrEqual(800);
  });

  it('sin dibujo cae a la hoja completa (centrada)', () => {
    const enc = encuadrarDibujo({ ...vis, bbox: null });
    const hoja = encuadrarHoja(vis);
    expect(enc).toEqual(hoja);
    // La hoja centrada: el centro de la lámina en el centro del viewport.
    const cx = 1000 * enc.zoom + enc.offX;
    expect(cx).toBeCloseTo(500, 6);
  });

  it('encuadrarHoja deja la lámina centrada con el aire pedido', () => {
    const enc = encuadrarHoja({ ...vis, pad: 16 });
    const sc = Math.min((1000 - 32) / 2000, (800 - 32) / 1600);
    expect(enc.zoom).toBeCloseTo(sc, 9);
  });
});

describe('bboxDePuntos', () => {
  it('abarca todos los puntos', () => {
    const b = bboxDePuntos([
      { x: 10, y: 20 },
      { x: 50, y: 5 },
      { x: 30, y: 40 },
    ]);
    expect(b).toEqual({ minX: 10, minY: 5, maxX: 50, maxY: 40 });
  });

  it('sin puntos devuelve null (el encuadre cae a la hoja)', () => {
    expect(bboxDePuntos([])).toBeNull();
  });
});
