import { describe, it, expect } from 'vitest';
import { calcular, clasifRecinto, solucionAplicada, sugerirRef } from '../rejillasCalc';
import { CATALOGO_BASE } from '../../constants/rejillasNTC3631';
import type { RejSectorInput } from '../rejillasCalc';

// Ejemplos de verificación: los 5 sectores precargados del XLSX fuente + los casos del
// DOCX §5 (cocina 48 cm², combinación 19 cm², conducto horizontal 231, Pmax loft, catálogo).

function sector(parcial: Partial<RejSectorInput>): RejSectorInput {
  return {
    nombre: 'Apto A · Piso 2 · Cocina',
    areaM2: 7.2,
    altoM: 2.3,
    mono: false,
    piso: 'Piso 2',
    artefactos: [{ tipo: 'Estufa', clase: 'A', kw: 8, cant: 1 }],
    sol: 'ext-dir',
    vadj: 0,
    padj: 0,
    aconec: 0,
    gas: 'natural',
    catalogo: CATALOGO_BASE,
    importadas: false,
    ...parcial,
  };
}

describe('rejillasCalc — ejemplos de verificación (XLSX/DOCX)', () => {
  it('cocina 7,2 m² con estufa A 8 kW: 2 aberturas de 48 cm², Silplas 177 sugerida', () => {
    const r = calcular(sector({}));
    expect(r.estado).toBe('warn');
    expect(r.clasif).toBe('Volumen insuficiente / Confinado');
    expect(r.aberturas).toHaveLength(2);
    expect(r.aberturas[0].libre).toBe(48);
    expect(r.coef).toBe(6);
    expect(r.aberturas[0].ref?.ref).toBe('510-030-15');
    expect(r.aberturas[0].libreReal).toBe(177);
  });

  it('zona de ropas con calentador B 21 kW directa: 126 cm² por abertura', () => {
    const r = calcular(
      sector({
        nombre: 'Apto A · Zona de ropas',
        areaM2: 2.24,
        artefactos: [{ tipo: 'Calentador', clase: 'B', kw: 21, cant: 1 }],
      }),
    );
    expect(r.aberturas[0].libre).toBe(126);
  });

  it('mismo calentador con conducto horizontal: 231 cm² (11 cm²/kW)', () => {
    const r = calcular(
      sector({
        nombre: 'Apto B · Zona de ropas',
        areaM2: 1.95,
        artefactos: [{ tipo: 'Calentador', clase: 'B', kw: 21, cant: 1 }],
        sol: 'ext-hor',
      }),
    );
    expect(r.aberturas[0].libre).toBe(231);
    expect(r.coef).toBe(11);
  });

  it('interior mismo piso con adjunto suficiente: mínimo 645 cm²', () => {
    const r = calcular(
      sector({
        nombre: 'Apto B · Cocina abierta',
        areaM2: 6.16,
        artefactos: [{ tipo: 'Estufa', clase: 'A', kw: 8, cant: 1 }],
        sol: 'int-mismo',
        vadj: 60,
      }),
    );
    expect(r.estado).toBe('ok');
    expect(r.modo).toBe('interior');
    expect(r.aberturas[0].libre).toBe(645);
    expect(r.aberturas[0].pos).toBe('sup');
  });

  it('mono espacio 30×2,4 con 29 kW: Pmax 21,2 kW y crítica', () => {
    const r = calcular(
      sector({
        nombre: 'Apto C · Loft',
        areaM2: 30,
        altoM: 2.4,
        mono: true,
        artefactos: [
          { tipo: 'Estufa', clase: 'A', kw: 8, cant: 1 },
          { tipo: 'Calentador', clase: 'B', kw: 21, cant: 1 },
        ],
      }),
    );
    expect(r.Pmax).toBeCloseTo(21.18, 1);
    const crit = r.alertas.filter((a) => a.e);
    expect(crit.length).toBeGreaterThanOrEqual(1);
    expect(crit[0].t).toMatch(/mono-espacio/i);
  });

  it('combinación: factor 0,39 → 19 cm² (6 × 8 × 0,39, DOCX §5)', () => {
    const r = calcular(sector({ sol: 'comb-dir' }));
    expect(r.factor).toBeCloseTo(0.39, 2);
    expect(r.aberturas[0].libre).toBe(19);
  });

  it('solo Tipo C: sin aberturas, cumple', () => {
    const r = calcular(
      sector({ artefactos: [{ tipo: 'Calentador', clase: 'C', kw: 21, cant: 1 }] }),
    );
    expect(r.modo).toBe('estanco');
    expect(r.aberturas).toHaveLength(0);
    expect(r.estado).toBe('ok');
  });

  it('GLP fuerza Método 1 con alerta crítica', () => {
    const r = calcular(sector({ sol: 'ext-m2', gas: 'glp' }));
    expect(r.metodoAplicado).toBe('1');
    expect(r.aberturas).toHaveLength(2);
    expect(r.alertas.some((a) => a.e && /GLP/.test(a.t))).toBe(true);
  });

  it('dormitorio con artefacto de circuito abierto: crítica 3.2', () => {
    const r = calcular(sector({ nombre: 'Apto A · Dormitorio principal' }));
    expect(r.alertas.some((a) => a.e && /dormitorios y baños/.test(a.t))).toBe(true);
  });

  it('sótano 2: crítica 3.2 siempre; sótano 1 solo crítica con GLP', () => {
    const r2 = calcular(sector({ piso: 'Sótano 2' }));
    expect(r2.alertas.some((a) => a.e && /primer sótano/.test(a.t))).toBe(true);
    const r1n = calcular(sector({ piso: 'Sótano 1' }));
    expect(r1n.alertas.some((a) => a.e && /sótano/.test(a.t))).toBe(false);
    const r1g = calcular(sector({ piso: 'SS1', gas: 'glp' }));
    expect(r1g.alertas.some((a) => a.e && /primer sótano/.test(a.t))).toBe(true);
  });

  it('clasifRecinto y solucionAplicada etiquetan como el prototipo', () => {
    const r = calcular(sector({}));
    const [cl, color] = clasifRecinto(r);
    expect(cl).toBe('Volumen insuficiente / Confinado');
    expect(color).toBe('w');
    expect(solucionAplicada(r)).toBe('Exterior · 2 aberturas (método 1)');
  });

  it('sugerirRef respeta lado mínimo 8 cm y origen', () => {
    const s = sugerirRef(48, 200, CATALOGO_BASE, undefined, 'ext', false)!;
    expect(s.c.marca).toBe('Silplas');
    const soloImp = sugerirRef(1000, 200, CATALOGO_BASE, 'Koolair', 'ext', false);
    expect(soloImp).toBeNull(); // importadas desactivadas: no sugiere
    const impOn = sugerirRef(1000, 200, CATALOGO_BASE, 'Koolair', 'ext', true)!;
    expect(impOn.c.marca).toBe('Koolair');
  });
});
