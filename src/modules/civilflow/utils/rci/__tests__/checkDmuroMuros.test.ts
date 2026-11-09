import { describe, it, expect } from 'vitest';
import { checks, type DibujoPiso } from '../../../lib/rci/checks.ts';
import { compute, ejemploVerificacion } from '../../../lib/rci/index.ts';
import type { Verificacion } from '../../../lib/rci/types.ts';

const st = ejemploVerificacion();
const R = compute(st);
// Dmuro del ejemplo = 1.7 m (tabla Datos del rociador): la tolerancia del check es ESE valor.

const checkDe = (L: Verificacion[]) =>
  L.find((v) => v.lab === 'Distancia de ramales a muros ≤ Dmuro');

describe('verificación: distancia de ramales a muros (guías esMuro, tolerancia Dmuro)', () => {
  it('sin dibujo no aparece la verificación (motor puro intacto)', () => {
    expect(checkDe(R.checks)).toBeUndefined();
  });

  it('sin Dmuro definido → PENDIENTE', () => {
    const st2 = { ...st, roc: { ...st.roc, Dmuro: '' } };
    const L = checks(st2, R, {
      muros: [
        [
          [0, 1],
          [10, 1],
        ],
      ],
      ramPts: [
        [
          [0, 0],
          [10, 0],
        ],
      ],
    });
    expect(checkDe(L)?.st).toBe('PENDIENTE');
    expect(checkDe(L)?.val).toBe('Sin Dmuro definido');
  });

  it('sin muros marcados → PENDIENTE', () => {
    const L = checks(st, R, {
      muros: [],
      ramPts: [
        [
          [0, 0],
          [10, 0],
        ],
      ],
    });
    expect(checkDe(L)?.st).toBe('PENDIENTE');
    expect(checkDe(L)?.val).toBe('Sin muros marcados');
  });

  it('muro dentro de Dmuro (1 m ≤ 1.7 m) → CUMPLE', () => {
    const dibujo: DibujoPiso = {
      muros: [
        [
          [0, 1],
          [10, 1],
        ],
      ],
      ramPts: [
        [
          [0, 0],
          [10, 0],
        ],
      ],
    };
    const L = checks(st, R, dibujo);
    expect(checkDe(L)?.st).toBe('CUMPLE');
  });

  it('muro fuera de Dmuro (5 m > 1.7 m) → NO CUMPLE con el peor muro en el valor', () => {
    // Muro 1 a 5 m del ramal (fuera), muro 2 pegado al ramal (0.1 m, dentro).
    const dibujo: DibujoPiso = {
      muros: [
        [
          [0, 5],
          [10, 5],
        ],
        [
          [0, 0.1],
          [10, 0.1],
        ],
      ],
      ramPts: [
        [
          [0, 0],
          [10, 0],
        ],
      ],
    };
    const L = checks(st, R, dibujo);
    const v = checkDe(L);
    expect(v?.st).toBe('NO CUMPLE');
    expect(v?.val).toContain('1 de 2');
    expect(v?.val).toContain('5,00 m');
  });

  it('muro que cruza el ramal → distancia 0 → CUMPLE', () => {
    const dibujo: DibujoPiso = {
      muros: [
        [
          [5, -3],
          [5, 3],
        ],
      ],
      ramPts: [
        [
          [0, 0],
          [10, 0],
        ],
      ],
    };
    const L = checks(st, R, dibujo);
    expect(checkDe(L)?.st).toBe('CUMPLE');
  });
});
