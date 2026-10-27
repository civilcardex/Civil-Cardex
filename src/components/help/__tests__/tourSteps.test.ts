// Tests del tour de onboarding: forma de los datos (pasos, ancla final libre) y mapeo
// clave de Ayuda → tour por pestaña/sección. Puro dato (la posición la prueba el navegador).
import { describe, it, expect } from 'vitest';
import { TOURS, tourDe } from '../../tour/tourSteps.ts';

describe('tourSteps', () => {
  it('hay tour para cada pestaña del workarea flow', () => {
    for (const tab of ['info', 'planos', 'datos', 'redes', 'inf', 'crit']) {
      expect(TOURS[`cf:tab:${tab}`], `falta cf:tab:${tab}`).toBeTruthy();
    }
    // iso: tour POR SUBPESTAÑA (cf:tab:iso:<n>), no una sola entrada.
    expect(TOURS['cf:tab:iso']).toBeUndefined();
    for (const n of [1, 2, 3, 4, 5]) {
      expect(TOURS[`cf:tab:iso:${n}`], `falta cf:tab:iso:${n}`).toBeTruthy();
    }
  });

  it('hay tour para cada sección de CivilManager (y catálogo)', () => {
    for (const clave of [
      'cm:catalogos:configuracion',
      'cm:catalogos:colaboradores',
      'cm:catalogos:cuadrillas',
      'cm:catalogos:equipos',
      'cm:catalogos:insumos',
      'cm:catalogos:proveedores',
      'cm:apus',
      'cm:presupuestos',
    ]) {
      expect(TOURS[clave], `falta ${clave}`).toBeTruthy();
    }
  });

  it('todo tour tiene pasos válidos y el último va centrado (sin sel)', () => {
    for (const [clave, pasos] of Object.entries(TOURS)) {
      expect(pasos.length, clave).toBeGreaterThanOrEqual(2);
      for (const p of pasos) {
        expect(p.titulo.length, clave).toBeGreaterThan(0);
        expect(p.desc.length, clave).toBeGreaterThan(10);
      }
      expect(pasos[pasos.length - 1].sel, clave).toBeUndefined();
    }
  });

  it('los tours de isometría señalan los paneles laterales', () => {
    const tiene = (clave: string, sel: string) =>
      (TOURS[clave] || []).some((p) => p.sel === `[data-tour="${sel}"]`);
    expect(tiene('cf:tab:iso:1', 'iso-sidebar'), 'iso:1 sin panel de tramos').toBe(true);
    expect(tiene('cf:tab:iso:1', 'iso-toolbar'), 'iso:1 sin barra').toBe(true);
    for (const n of [2, 3, 4, 5]) {
      expect(tiene(`cf:tab:iso:${n}`, 'iso-viewer-sidebar'), `iso:${n} sin sidebar`).toBe(true);
    }
  });

  it('los tours de isometría resaltan SOLO el lienzo 3D (no los paneles)', () => {
    const pasosDelVisor = (clave: string) =>
      (TOURS[clave] || []).filter((p) => p.sel === '[data-tour="iso-canvas"]');
    for (const n of [1, 2, 3, 4, 5]) {
      expect(pasosDelVisor(`cf:tab:iso:${n}`).length, `iso:${n} sin paso del visor`).toBe(1);
    }
    // El ancla vieja envolvía paneles + lienzo: ningún tour debe volver a usarla.
    for (const [clave, pasos] of Object.entries(TOURS)) {
      expect(
        pasos.some((p) => p.sel === '[data-tour="iso-contenido"]'),
        clave,
      ).toBe(false);
    }
  });

  it('el tour de diseño de redes señala el contenido de la red', () => {
    expect(
      (TOURS['cf:tab:redes'] || []).some((p) => p.sel === '[data-tour="redes-contenido"]'),
    ).toBe(true);
  });

  it('el tour de diseño de redes ya no tiene el paso de sub-secciones', () => {
    expect((TOURS['cf:tab:redes'] || []).some((p) => p.sel === '[data-tour="redes-paginas"]')).toBe(
      false,
    );
  });

  it('tourDe mapea el contexto de Ayuda al tour de su pestaña/sección', () => {
    expect(tourDe('cf:visor')).toBe('cf:visor');
    // El editor de recorte publica su propio contexto: repetir tour = tour del recorte.
    expect(tourDe('cf:recorte')).toBe('cf:recorte');
    expect(tourDe('cf:info')).toBe('cf:tab:info');
    expect(tourDe('cf:planos')).toBe('cf:tab:planos');
    expect(tourDe('cf:redes:san')).toBe('cf:tab:redes');
    expect(tourDe('cf:iso')).toBe('cf:tab:iso:1');
    expect(tourDe('cf:iso:2')).toBe('cf:tab:iso:2');
    expect(tourDe('cm:catalogos:insumos')).toBe('cm:catalogos:insumos');
    expect(tourDe('cm:apus')).toBe('cm:apus');
    expect(tourDe('cm:presupuestos')).toBe('cm:presupuestos');
    expect(tourDe('otra:cosa')).toBeNull();
  });
});
