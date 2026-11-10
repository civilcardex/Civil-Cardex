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
  const checkMin = (L: Verificacion[]) =>
    L.find((v) => v.lab === 'Distancia mínima ramal–muro ≥ 0,10 m');

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

  it('muro descubierto (a 4,9 m de todo ramal > Dmuro 1,7) → NO CUMPLE; el ramal interior no se juzga', () => {
    // Muro 1 a 4,9 m del ramal más cercano (descubierto); muro 2 pegado al ramal 2 (cubierto).
    // El ramal 1 está a 4,9 m de TODO muro — regla POR MURO: no se juzga (interior).
    const dibujo: DibujoPiso = {
      muros: [
        [
          [0, 5.1],
          [10, 5.1],
        ],
        [
          [0, 0.1],
          [10, 0.1],
        ],
      ],
      ramPts: [
        [
          [0, 0.2],
          [10, 0.2],
        ],
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
    expect(v?.val).toContain('4,90 m');
  });

  it('ramal interior lejos de todo muro (4,9 m) NO reprueba — el peor MURO manda, no el ramal', () => {
    // 2 muros cubiertos (ramal 2 a 0,2 y ramal 1 a 0,4 de ellos) + un ramal interior a 4,9 m.
    const dibujo: DibujoPiso = {
      muros: [
        [
          [0, 0.6],
          [10, 0.6],
        ],
        [
          [0, -0.2],
          [10, -0.2],
        ],
      ],
      ramPts: [
        [
          [0, 5],
          [10, 5],
        ],
        [
          [0, 0.2],
          [10, 0.2],
        ],
        [
          [0, 0],
          [10, 0],
        ],
      ],
    };
    const L = checks(st, R, dibujo);
    expect(checkDe(L)?.st).toBe('CUMPLE');
  });

  it('muro que cruza el ramal → máx CUMPLE (dist 0) pero MÍNIMO NO CUMPLE', () => {
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
    expect(checkDe(L)?.st).toBe('CUMPLE'); // máx: 0 ≤ Dmuro
    expect(checkMin(L)?.st).toBe('NO CUMPLE'); // mín: 0 < 0,10 — cruzar el muro viola
  });

  it('MÍNIMO: ramal pegado a 0,05 m del muro → NO CUMPLE', () => {
    const dibujo: DibujoPiso = {
      muros: [
        [
          [0, 0],
          [10, 0],
        ],
      ],
      ramPts: [
        [
          [0, 0.05],
          [10, 0.05],
        ],
      ],
    };
    const L = checks(st, R, dibujo);
    const v = checkMin(L);
    expect(v?.st).toBe('NO CUMPLE');
    expect(v?.val).toContain('1 de 1');
    expect(v?.val).toContain('0,05 m');
  });

  it('MÍNIMO: ramales a ≥ 0,10 m de todo muro → CUMPLE', () => {
    const dibujo: DibujoPiso = {
      muros: [
        [
          [0, 0],
          [10, 0],
        ],
      ],
      ramPts: [
        [
          [0, 0.15],
          [10, 0.15],
        ],
        [
          [0, 2],
          [10, 2],
        ],
      ],
    };
    const L = checks(st, R, dibujo);
    const v = checkMin(L);
    expect(v?.st).toBe('CUMPLE');
  });
});
