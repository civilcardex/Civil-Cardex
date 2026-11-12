/** Test de caracterización del catálogo de rejillas NTC (Norma Técnica Colombiana) 3631:
 *  congela conteos, orden y registros completos para que cualquier cambio de datos
 *  (o del split en constants/rejillas/) falle aquí y no en el cálculo.
 *  Ej: si se borra una rejilla de Silplas o cambia un aef, este test lo detecta. */
import { describe, it, expect } from 'vitest';
import { NTC3631, SOL, TIPO_DEFAULT, COMERCIALES, CATALOGO_BASE } from '../rejillasNTC3631.ts';

describe('caracterización rejillasNTC3631', () => {
  it('NTC3631 congela sus 14 constantes (cm²/kW, cm, mm)', () => {
    expect(NTC3631).toEqual({
      VOL_KW: 3.4,
      EXT_DIR: 6,
      EXT_HOR: 11,
      UNICA: 11,
      INT_MISMO: 22,
      INT_MISMO_MIN: 645,
      INT_OTRO: 44,
      H_SUP: 180,
      H_INF: 30,
      ZOCALO: 4,
      MALLA: 6.3,
      MIN_LADO: 8,
      ALT_TOPE: 30,
      ALT_HMAX: 60,
    });
  });

  it('SOL mantiene sus 7 soluciones de ventilación', () => {
    expect(Object.keys(SOL)).toEqual([
      'ext-dir',
      'ext-hor',
      'ext-m2',
      'int-mismo',
      'int-otro',
      'comb-dir',
      'comb-hor',
    ]);
    expect(SOL['int-mismo']).toEqual({
      t: 'Interior · mismo piso',
      com: 'directa',
      met: '1',
      adj: true,
      piso: 'mismo',
    });
    expect(SOL['comb-dir']).toEqual({
      t: 'Combinación int.+ext. · directa',
      com: 'directa',
      met: '1',
      adj: false,
      comb: true,
    });
  });

  it('TIPO_DEFAULT por grupo de gasodomésticos (A suma, B suma con ducto, C estanco)', () => {
    expect(TIPO_DEFAULT).toEqual({ estufa: 'A', calent: 'B', otros: 'A' });
  });

  it('COMERCIALES congela las 20 medidas de respaldo (w×h en cm)', () => {
    expect(COMERCIALES).toEqual([
      [10, 10],
      [15, 10],
      [20, 10],
      [25, 10],
      [30, 10],
      [20, 15],
      [25, 15],
      [30, 15],
      [40, 15],
      [20, 20],
      [30, 20],
      [40, 20],
      [50, 20],
      [60, 20],
      [40, 25],
      [50, 25],
      [60, 25],
      [40, 30],
      [60, 30],
      [80, 30],
    ]);
  });

  it('CATALOGO_BASE trae 79 registros', () => {
    expect(CATALOGO_BASE).toHaveLength(79);
  });

  it('conteo por marca: Silplas 10, Grival 3, Laminaire 41 (L-OL-4 24 + L-DGD 17), Koolair 13, TROX 12', () => {
    const porMarca = CATALOGO_BASE.reduce<Record<string, number>>((acc, r) => {
      acc[r.marca] = (acc[r.marca] ?? 0) + 1;
      return acc;
    }, {});
    expect(porMarca).toEqual({ Silplas: 10, Grival: 3, Laminaire: 41, Koolair: 13, TROX: 12 });

    const porFamiliaLaminaire = CATALOGO_BASE.reduce<Record<string, number>>((acc, r) => {
      if (r.marca !== 'Laminaire') return acc;
      const familia = r.ref.startsWith('L-OL-4') ? 'L-OL-4' : 'L-DGD';
      acc[familia] = (acc[familia] ?? 0) + 1;
      return acc;
    }, {});
    expect(porFamiliaLaminaire).toEqual({ 'L-OL-4': 24, 'L-DGD': 17 });
  });

  it('orden completo de las 79 referencias (Silplas→Grival→Laminaire→Koolair→TROX)', () => {
    expect(CATALOGO_BASE.map((r) => r.ref)).toEqual([
      // Silplas (10)
      '510-030-15',
      '510-074-15',
      '510-046-15',
      '510-040-15',
      '510-081-15',
      '510-069-15',
      '510-043-15',
      '510-048-15',
      '0303615 (Coval)',
      '510-055-15',
      // Grival (3)
      '937010001',
      '937000001',
      '937310001',
      // Laminaire L-OL-4 (24)
      'L-OL-4 12x12',
      'L-OL-4 16x12',
      'L-OL-4 20x12',
      'L-OL-4 24x12',
      'L-OL-4 30x12',
      'L-OL-4 36x12',
      'L-OL-4 12x16',
      'L-OL-4 16x16',
      'L-OL-4 20x16',
      'L-OL-4 24x16',
      'L-OL-4 30x16',
      'L-OL-4 36x16',
      'L-OL-4 12x20',
      'L-OL-4 16x20',
      'L-OL-4 20x20',
      'L-OL-4 24x20',
      'L-OL-4 30x20',
      'L-OL-4 36x20',
      'L-OL-4 12x24',
      'L-OL-4 16x24',
      'L-OL-4 20x24',
      'L-OL-4 24x24',
      'L-OL-4 30x24',
      'L-OL-4 36x24',
      // Laminaire L-DGD (17)
      'L-DGD 6x6',
      'L-DGD 10x6',
      'L-DGD 12x6',
      'L-DGD 10x8',
      'L-DGD 12x8',
      'L-DGD 10x10',
      'L-DGD 18x6',
      'L-DGD 14x8',
      'L-DGD 16x8',
      'L-DGD 12x12',
      'L-DGD 16x12',
      'L-DGD 20x10',
      'L-DGD 18x12',
      'L-DGD 24x12',
      'L-DGD 18x18',
      'L-DGD 30x12',
      'L-DGD 24x18',
      // Koolair (13)
      '25-H 200x100',
      '25-H 300x100',
      '25-H 400x100',
      '25-H 500x100',
      '25-H 200x150',
      '25-H 400x150',
      '25-H 300x200',
      '25-H 400x200',
      '25-H 300x250',
      '25-H 450x200',
      '25-H 300x300',
      '25-H 600x200',
      '25-H 400x300',
      // TROX (12)
      'AGS 225x125',
      'AGS 325x125',
      'AGS 425x125',
      'AGS 525x125',
      'AGS 625x125',
      'AGS 825x125',
      'AGS 325x225',
      'AGS 425x225',
      'AGS 525x225',
      'AGS 625x225',
      'AGS 425x325',
      'AGS 525x325',
    ]);
  });

  it('Silplas: 2 registros congelados', () => {
    expect(CATALOGO_BASE.find((r) => r.ref === '510-030-15')).toEqual({
      marca: 'Silplas',
      ref: '510-030-15',
      tipo: 'Corriente',
      ext: '22,5×22,5',
      w: 20,
      h: 20,
      aef: 177,
      uso: 'ambos',
      origen: 'nacional',
    });
    expect(CATALOGO_BASE.find((r) => r.ref === '0303615 (Coval)')).toEqual({
      marca: 'Silplas',
      ref: '0303615 (Coval)',
      tipo: 'Colmena',
      ext: '45×25',
      w: 41,
      h: 21,
      aef: 645,
      uso: 'ambos',
      origen: 'nacional',
    });
  });

  it('Grival: 2 registros congelados (aef 0 = sin dato, no se sugieren)', () => {
    expect(CATALOGO_BASE.find((r) => r.ref === '937010001')).toEqual({
      marca: 'Grival',
      ref: '937010001',
      tipo: 'Sencilla',
      ext: '20×20',
      w: 20,
      h: 20,
      aef: 0,
      uso: 'ambos',
      origen: 'nacional',
    });
    expect(CATALOGO_BASE.find((r) => r.ref === '937310001')).toEqual({
      marca: 'Grival',
      ref: '937310001',
      tipo: 'Corriente',
      ext: '30×30',
      w: 30,
      h: 30,
      aef: 0,
      uso: 'ambos',
      origen: 'nacional',
    });
  });

  it('Laminaire: 2 registros congelados (uno por familia L-OL-4 y L-DGD)', () => {
    expect(CATALOGO_BASE.find((r) => r.ref === 'L-OL-4 24x24')).toEqual({
      marca: 'Laminaire',
      ref: 'L-OL-4 24x24',
      tipo: 'Louver exterior',
      ext: '24×24"',
      w: 61,
      h: 61,
      aef: 1328,
      uso: 'ext',
      origen: 'nacional',
    });
    expect(CATALOGO_BASE.find((r) => r.ref === 'L-DGD 6x6')).toEqual({
      marca: 'Laminaire',
      ref: 'L-DGD 6x6',
      tipo: 'Rejilla de puerta',
      ext: '6×6"',
      w: 15.2,
      h: 15.2,
      aef: 143,
      uso: 'int',
      origen: 'nacional',
    });
  });

  it('Koolair: 2 registros congelados', () => {
    expect(CATALOGO_BASE.find((r) => r.ref === '25-H 200x100')).toEqual({
      marca: 'Koolair',
      ref: '25-H 200x100',
      tipo: 'Toma aire exterior',
      ext: '22,8×12,8',
      w: 20,
      h: 10,
      aef: 54,
      uso: 'ext',
      origen: 'importado',
    });
    expect(CATALOGO_BASE.find((r) => r.ref === '25-H 400x300')).toEqual({
      marca: 'Koolair',
      ref: '25-H 400x300',
      tipo: 'Toma aire exterior',
      ext: '42,8×32,8',
      w: 40,
      h: 30,
      aef: 480,
      uso: 'ext',
      origen: 'importado',
    });
  });

  it('TROX: 2 registros congelados', () => {
    expect(CATALOGO_BASE.find((r) => r.ref === 'AGS 225x125')).toEqual({
      marca: 'TROX',
      ref: 'AGS 225x125',
      tipo: 'Paso de aire (puerta/muro)',
      ext: '25,3×15,9',
      w: 22.5,
      h: 12.5,
      aef: 80,
      uso: 'int',
      origen: 'importado',
    });
    expect(CATALOGO_BASE.find((r) => r.ref === 'AGS 525x325')).toEqual({
      marca: 'TROX',
      ref: 'AGS 525x325',
      tipo: 'Paso de aire (puerta/muro)',
      ext: '55,3×35,9',
      w: 52.5,
      h: 32.5,
      aef: 700,
      uso: 'int',
      origen: 'importado',
    });
  });

  it('todo registro tiene uso y origen válidos y aef no negativa', () => {
    for (const r of CATALOGO_BASE) {
      expect(['ambos', 'ext', 'int']).toContain(r.uso);
      expect(['nacional', 'importado']).toContain(r.origen);
      expect(r.aef).toBeGreaterThanOrEqual(0);
    }
  });
});
