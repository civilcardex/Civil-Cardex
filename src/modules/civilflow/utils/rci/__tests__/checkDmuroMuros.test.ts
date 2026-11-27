import { describe, it, expect } from 'vitest';
import { checks, type DibujoPiso } from '../../../lib/rci/checks.ts';
import { compute, ejemploVerificacion } from '../../../lib/rci/index.ts';
import type { Verificacion } from '../../../lib/rci/types.ts';

const st = ejemploVerificacion();
const R = compute(st);
/* La fila DMR («Distancia de ramales a muros ≤ DMR») ya NO existe aquí (ped. usuario
 * 2026-11-27): ese chequeo vive SOLO en el dibujo (RCIAutoDraw.chequeoMurosTrazo). Quedan
 * la distancia MÍNIMA rociador–muro y el cruce de tubería. */
const checkMin = (L: Verificacion[]) =>
  L.find((v) => v.lab === 'Distancia mínima ramal–muro ≥ 0,10 m');

describe('verificación de dibujo: mínimo rociador–muro y cruce (la DMR es solo del dibujo)', () => {
  it('sin dibujo no aparecen las verificaciones (motor puro intacto)', () => {
    expect(checkMin(R.checks)).toBeUndefined();
    expect(R.checks.some((v) => v.lab.includes('muro'))).toBe(false);
  });

  it('sin muros marcados no hay filas de muro', () => {
    const L = checks(st, R, {
      muros: [],
      ramPts: [
        [
          [0, 0],
          [10, 0],
        ],
      ],
    });
    expect(checkMin(L)).toBeUndefined();
    expect(L.find((v) => v.lab === 'Cruce de tubería con muro')).toBeUndefined();
  });

  it('rociador estándar pegado al muro → MÍNIMO NO CUMPLE', () => {
    const dibujo: DibujoPiso = {
      muros: [
        [
          [0, 0],
          [10, 0],
        ],
      ],
      ramPts: [
        [
          [0, 1],
          [10, 1],
        ],
      ],
      rocPts: [{ x: 5, y: 0.05, tipo: 'montante', fluye: true, ramalId: 'RRCI1' }],
    };
    const L = checks(st, R, dibujo);
    expect(checkMin(L)?.st).toBe('NO CUMPLE');
    expect(checkMin(L)?.val).toContain('0,05 m');
  });

  it('MÍNIMO: ramal pegado a 0,05 m del muro → NO CUMPLE (vértices como centros)', () => {
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
    expect(v?.val).toContain('2 de 2');
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

  it('mide la perpendicular desde el CENTRO del rociador', () => {
    const dibujo: DibujoPiso = {
      muros: [
        [
          [0, 2],
          [10, 2],
        ],
      ],
      ramPts: [
        [
          [0, 0],
          [10, 0],
        ],
      ],
      rocPts: [{ x: 5, y: 0.4, tipo: 'colgante', fluye: true, ramalId: 'RRCI1' }],
    };
    const L = checks(st, R, dibujo);
    expect(checkMin(L)?.st).toBe('CUMPLE'); // 0,40 m ≥ 0,10 m
  });

  it('muro que cruza el ramal → se informa SOLO en la fila de cruce', () => {
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
    expect(checkMin(L)?.st).toBe('CUMPLE');
    const cruce = L.find((v) => v.lab === 'Cruce de tubería con muro');
    expect(cruce?.st).toBe('NO CUMPLE');
    expect(cruce?.val).toContain('1 cruce');
  });

  it('cruce de tubería–muro: CUMPLE sin cruces aunque el ramal pase cerca', () => {
    const L = checks(st, R, {
      muros: [
        [
          [0, 3],
          [10, 3],
        ],
      ],
      ramPts: [
        [
          [0, 0.2],
          [10, 0.2],
        ],
      ],
    });
    expect(L.find((v) => v.lab === 'Cruce de tubería con muro')?.st).toBe('CUMPLE');
    expect(checkMin(L)?.st).toBe('CUMPLE');
  });
});
