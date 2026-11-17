/** Resolver del catálogo de rejillas por país: CO = base tal cual; los demás países ven
 *  TODO como importado (origen relativo, ped. usuario 2026-11-17). */
import { describe, expect, it } from 'vitest';
import { CATALOGO_BASE } from '../rejillas/index.ts';
import { catalogoRejillasDe } from '../rejillas/catalogo-por-pais.ts';

describe('catalogoRejillasDe (origen relativo al país)', () => {
  it('Colombia devuelve la base SIN cambios (misma referencia)', () => {
    expect(catalogoRejillasDe('Colombia')).toBe(CATALOGO_BASE);
  });

  it('país sin catálogo local: todas las refs quedan importadas', () => {
    for (const pais of ['Perú', 'Chile', 'Ecuador', 'Argentina', 'Bolivia']) {
      const cat = catalogoRejillasDe(pais);
      expect(cat).toHaveLength(CATALOGO_BASE.length);
      expect(cat.every((r) => r.origen === 'importado')).toBe(true);
    }
  });

  it('país vacío o desconocido → fallback Colombia (base tal cual)', () => {
    expect(catalogoRejillasDe('')).toBe(CATALOGO_BASE);
    expect(catalogoRejillasDe(undefined)).toBe(CATALOGO_BASE);
    expect(catalogoRejillasDe('Marte')).toBe(CATALOGO_BASE);
  });

  it('cada ref conserva marca/referencia/medidas — solo cambia el origen', () => {
    const cat = catalogoRejillasDe('Perú');
    cat.forEach((r, i) => {
      expect(r.marca).toBe(CATALOGO_BASE[i].marca);
      expect(r.ref).toBe(CATALOGO_BASE[i].ref);
      expect(r.w).toBe(CATALOGO_BASE[i].w);
      expect(r.h).toBe(CATALOGO_BASE[i].h);
      expect(r.aef).toBe(CATALOGO_BASE[i].aef);
    });
  });
});
