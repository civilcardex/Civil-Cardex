import { describe, expect, it, beforeEach } from 'vitest';
import {
  corrigeEscalaMeta,
  decideEscalaDelDoc,
  decideEscalaPorDefectoDelPlan,
  esEscalaEstandar,
  leeReportes,
  registraCarga,
  textoReporte,
} from '../cargaDiagnostico.ts';

/**
 * Decisiones de ESCALA del piso al cargar el visor (fix 2026-10-21).
 *
 * Orig. usuario: al reingresar al visor, los elementos aparecían desplazados y las cotas en
 * metros leían menos. Estos tests fijan la regla que lo evita: la escala de un piso es la
 * calibrada en SU meta (no la global del proyecto), y una escala del set estándar en el doc
 * significa "etiqueta pisada" (se arregla la etiqueta, NO se mueve el dibujo).
 */

describe('decideEscalaPorDefectoDelPlan', () => {
  it('no pisa la escala si el piso ya tiene doc con escala', () => {
    expect(
      decideEscalaPorDefectoDelPlan({ escalaDoc: 0.669, tieneContenido: true, escalaPlan: 0.5 }),
    ).toBe(false);
  });

  it('no pisa la escala si el motor tiene contenido del piso', () => {
    expect(
      decideEscalaPorDefectoDelPlan({ escalaDoc: null, tieneContenido: true, escalaPlan: 0.75 }),
    ).toBe(false);
  });

  it('aplica la escala por defecto solo en un piso vacío sin doc', () => {
    expect(
      decideEscalaPorDefectoDelPlan({ escalaDoc: null, tieneContenido: false, escalaPlan: 0.5 }),
    ).toBe(true);
  });

  it('sin escala de plano no hay nada que aplicar', () => {
    expect(
      decideEscalaPorDefectoDelPlan({ escalaDoc: null, tieneContenido: false, escalaPlan: null }),
    ).toBe(false);
  });
});

describe('decideEscalaDelDoc', () => {
  it('sin calibración del piso el doc manda tal cual', () => {
    expect(decideEscalaDelDoc({ escalaDoc: 0.5, escalaPlano: null })).toEqual({ accion: 'nada' });
  });

  it('doc y calibración iguales: no se toca nada', () => {
    expect(decideEscalaDelDoc({ escalaDoc: 0.669, escalaPlano: 0.669 })).toEqual({
      accion: 'nada',
    });
  });

  it('diferencia de redondeo (0.4723 vs 0.47): el doc exacto corrige al meta', () => {
    expect(decideEscalaDelDoc({ escalaDoc: 0.4723, escalaPlano: 0.47 })).toEqual({
      accion: 'autoheal',
      escala: 0.4723,
    });
  });

  it('escala estándar pisada: se arregla la etiqueta SIN mover la geometría', () => {
    // El doc quedó a 0.5 (set estándar) pero el piso está calibrado a 0.669: los píxeles
    // están bien, la etiqueta mal — re-escalar el drawing lo encogía de más.
    expect(decideEscalaDelDoc({ escalaDoc: 0.5, escalaPlano: 0.669 })).toEqual({
      accion: 'reparar-etiqueta',
      escala: 0.669,
    });
  });

  it('escala real distinta (no estándar): re-base con su factor', () => {
    const d = decideEscalaDelDoc({ escalaDoc: 0.6, escalaPlano: 0.669 });
    expect(d.accion).toBe('rebase');
    if (d.accion !== 'rebase') throw new Error('tipo inesperado');
    expect(d.escala).toBe(0.669);
    expect(d.factor).toBeCloseTo(0.6 / 0.669, 10);
  });
});

describe('esEscalaEstandar', () => {
  it('reconoce el set estándar de planos', () => {
    expect(esEscalaEstandar(0.5)).toBe(true);
    expect(esEscalaEstandar(1.25)).toBe(true);
    expect(esEscalaEstandar(0.669)).toBe(false);
    expect(esEscalaEstandar(null)).toBe(false);
  });
});

describe('corrigeEscalaMeta', () => {
  it('corrige la entrada del piso con la escala exacta del doc', () => {
    const { meta, cambio } = corrigeEscalaMeta(
      [{ id: 1, scale: 47, origen: { x_px: 1, y_px: 1 } }],
      1,
      0.4723,
    );
    expect(cambio).toBe(true);
    expect(meta[0].scale).toBeCloseTo(47.23, 6);
  });

  it('sincroniza el portador de la calibración global cuando el piso la hereda', () => {
    const { meta, cambio } = corrigeEscalaMeta(
      [
        { id: 1, scale: 47, calGlobal: true, origen: { x_px: 1, y_px: 1 } },
        { id: 2, scale: 50, calGlobal: true, origen: { x_px: 2, y_px: 2 } },
      ],
      2,
      0.4723,
      true,
    );
    expect(cambio).toBe(true);
    expect(meta[1].scale).toBeCloseTo(47.23, 6);
    // El portador global (el primero con calGlobal) también queda en la escala exacta.
    expect(meta[0].scale).toBeCloseTo(47.23, 6);
  });

  it('sin cambios no toca nada', () => {
    const { meta, cambio } = corrigeEscalaMeta([{ id: 1, scale: 50 }], 1, 0.5);
    expect(cambio).toBe(false);
    expect(meta[0].scale).toBe(50);
  });
});

describe('registro de carga (diagnóstico)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('guarda y devuelve el reporte del piso', () => {
    registraCarga(7, { escalaDoc: 0.5, escalaPlano: 0.669, accion: 'reparar-etiqueta' });
    const lista = leeReportes(7);
    expect(lista).toHaveLength(1);
    expect(lista[0].escalaDoc).toBe(0.5);
    expect(lista[0].accion).toBe('reparar-etiqueta');
    expect(textoReporte(7)).toContain('[CF-CARGA] piso 7');
  });

  it('el motor completa el mismo registro cuando llega cerca en el tiempo', () => {
    registraCarga(7, { escalaDoc: 0.5, accion: 'reparar-etiqueta' });
    registraCarga(7, { escalaRaster: 0.669, zoom: 1 });
    const lista = leeReportes(7);
    expect(lista).toHaveLength(1);
    expect(lista[0].escalaDoc).toBe(0.5);
    expect(lista[0].escalaRaster).toBe(0.669);
  });
});
