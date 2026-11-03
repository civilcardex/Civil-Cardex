import { describe, it, expect } from 'vitest';
import { DIAM_BY_MAT, MATS_DEFAULT, MAT_HAZEN_C, MAT_MANNING } from '../../../constants/index.ts';

// PVC C900 RDE 18 (Red Contra Incendio) — FASE 2 RCI: el material entra al catálogo de rci y
// sus diámetros comerciales llevan el diámetro INTERNO (mm) de la tabla PIPES del cálculo rci
// (OD − 2×espesor DR18): 4" 121.9−2×6.78, 6" 175.3−2×9.73, 8" 229.9−2×12.78,
// 10" 281.9−2×15.67, 12" 335.3−2×18.62. El selector de diámetros de ramales/montantes rci lee
// esta lista vía civilflow_mats['rci'].

describe('catálogo de diámetros PVC C900 RDE 18', () => {
  it('DIAM_BY_MAT tiene las 5 medidas comerciales con el ID interno exacto (mm)', () => {
    const lista = DIAM_BY_MAT['PVC C900 RDE 18'];
    expect(lista?.map((d) => d.n)).toEqual(['4"', '6"', '8"', '10"', '12"']);
    expect(lista?.map((d) => d.id)).toEqual([108.34, 155.84, 204.34, 250.56, 298.06]);
  });

  it('MATS_DEFAULT.rci ofrece el material (civilflow_mats nuevo proyecto)', () => {
    const vals = (MATS_DEFAULT.rci || []).map((m) => m.val);
    expect(vals).toContain('PVC C900 RDE 18');
  });

  it('coeficientes hidráulicos del material ya presentes (Hazen C=150, Manning n=0.009)', () => {
    expect(MAT_HAZEN_C['PVC C900 RDE 18']).toBe(150);
    expect(MAT_MANNING['PVC C900 RDE 18']).toBe(0.009);
  });
});
