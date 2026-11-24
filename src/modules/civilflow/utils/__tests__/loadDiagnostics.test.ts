import { beforeEach, describe, expect, it } from 'vitest';
import { leeReportes, registraCarga } from '../loadDiagnostics.ts';

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
