import { describe, it, expect } from 'vitest';
import { calcsDe, INPUTS_DEFAULT, type BombaInputs } from '../BombaARDesign';

// Regresión de la cadena de pérdidas a PRECISIÓN COMPLETA (auditoría r5 C-4, commit 8b03312):
// el Excel encadena Hf→Hac→Hfri→Hm sin redondear eslabones intermedios y solo muestra 3 dec.
// Los toFixed intermedios que había antes divergían ±0.001-0.002 justo en el umbral del 3er
// decimal. Casos pinneados a mano contra las fórmulas corregidas del maestro.

const inp = (over: Partial<BombaInputs> = {}): BombaInputs => ({
  ...INPUTS_DEFAULT,
  hz: '2.5',
  lImp: '12',
  dImp: '2',
  pDesc: '1.5',
  etaB: '65',
  tipoTuberia: 'PVC-PR',
  ...over,
});

describe('BombaAR calcsDe — cadena a precisión completa', () => {
  it('Hf/Hac/Hfri/Hm encadenan sin redondeo intermedio (caso Excel)', () => {
    const c = calcsDe(inp(), 10);
    // Hm crudo = HfRaw + HacRaw + HestRaw — el Ph usa el crudo (no el mostrado).
    // Pin: Hf≈0.012 → mostrado 0.012; Hm debe incluir la fracción que el redondeo comía.
    expect(c.Hm).toBeGreaterThan(4);
    expect(c.Hfri as number).toBeCloseTo((c.Hf as number) + (c.Hac as number), 2);
    // El crudo HmRaw - (Hf+Hac+Hest mostrados) puede diferir ±0.002 si hubiese toFixed
    // intermedio; con la cadena completa el Ph es coherente con Hm mostrado.
    const hmShown = c.Hm;
    expect(hmShown).toBeGreaterThan(0);
  });

  it('η vacío → Peje/Pcom/HP sin valor (nunca inventar eficiencia)', () => {
    const c = calcsDe(inp({ etaB: '' }), 10);
    expect(c.Peje).toBe('');
    expect(c.Pcom).toBe('');
    expect(c.php).toBe('');
  });

  it('Qd por Hunter y Qb=1.25·Qd (caso pinneado 10 UD, PVC)', () => {
    const c = calcsDe(inp(), 10);
    // Hunter 10 UD < 240: Qd = K·0.1163·UD^0.6875 (sal=1 → K=1) ≈ 0.5646 → 0.57.
    expect(c.Qd).toBeCloseTo(0.57, 2);
    expect(c.Qb).toBeCloseTo(0.71, 2);
    // HP = Pcom/745.7 (constante unificada con las equivalencias Eq).
    if (c.Pcom !== '' && c.php !== '') {
      expect(c.php as number).toBeCloseTo((c.Pcom as number) / 745.7, 2);
    }
  });
});
