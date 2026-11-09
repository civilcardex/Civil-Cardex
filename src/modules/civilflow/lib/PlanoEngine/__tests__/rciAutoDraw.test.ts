import { describe, it, expect, vi } from 'vitest';
import { sembrarRociadores, crearRamalesParalelos } from '../rciAutoDraw.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

/** Engine mínimo para las funciones de dibujo automático: escala 0.5 m/px estándar
 *  (cmToPlanePx: 1 m = 37.79 px aprox), ramales en el array vivo y no-op de render/dirty. */
function motorDe(ramales: PlanoRamal[], guideLines: unknown[] = []): IPlanoEngineCore {
  return {
    ramales,
    guideLines,
    scaleM: 0.5,
    nivelActual: { n: 1, label: 'P1' } as never,
    _ramalDefaults: { material: '', diametro: '' } as never,
    pxToM: (px: number) => (px / 96) * 2.54 * 0.5,
    updateElementById: vi.fn((id: string, fields: Record<string, unknown>) => {
      const r = ramales.find((x) => x.id === id);
      if (r) Object.assign(r, fields);
    }),
    render: vi.fn(),
    _markDirty: vi.fn(),
  } as unknown as IPlanoEngineCore;
}

/** Ramal recto de 10 m en x (a escala 0.5: 377.95 px) con los campos obligatorios. */
function ramalDe(id: string, pts: number[][]): PlanoRamal {
  return {
    id,
    net: 'rci',
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label: id,
    ini: '',
    fin: '',
    piso: '1',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 2,
  } as PlanoRamal;
}

describe('sembrarRociadores', () => {
  it('siembra ⌊L/S⌋+1 rociadores desde el inicio del trazo (extremo + accMed cada S)', () => {
    // 10 m con S = 2.5 m → rociador en 0, 2.5, 5, 7.5 (el de 10 caería sobre el fin) = 4.
    const r = ramalDe('RRCI1', [
      [0, 0],
      [755.9, 0],
    ]);
    const eng = motorDe([r]);
    const n = sembrarRociadores(eng, 'RRCI1', 2.5);
    expect(n).toBe(4);
    expect(r.accesorioInicio).toBe('rociador');
    const marcadores = Object.values(r.accMed || {}).filter((v) => v === 'rociador');
    expect(marcadores).toHaveLength(3);
  });

  it('con accesorioInicio propio (ej: codo) el retorno NO cuenta un rociador fantasma', () => {
    // 10 m con S = 2.5 → 3 accMed; el inicio ya tenía 'codo' (se conserva) → retorno 3.
    const r = ramalDe('RRCI4', [
      [0, 0],
      [755.9, 0],
    ]);
    r.accesorioInicio = 'codo';
    const eng = motorDe([r]);
    expect(sembrarRociadores(eng, 'RRCI4', 2.5)).toBe(3);
    expect(r.accesorioInicio).toBe('codo');
  });

  it('los vértices accMed quedan a distancia S del inicio (no del final) y desplazan claves previas', () => {
    // 10 m, S = 2.5; claves accMed previas se recorren sin perderse.
    const r = ramalDe('RRCI2', [
      [0, 0],
      [755.9, 0],
    ]);
    r.accMed = { accMed0: 'teeDirecto' }; // accesorio en el vértice 0 (inicio)
    const eng = motorDe([r]);
    sembrarRociadores(eng, 'RRCI2', 2.5);
    // Con 3 inserciones en índices 1..3, la vieja accMed0 permanece en 0.
    expect(r.accMed?.accMed0).toBe('teeDirecto');
    // Primer vértice interior ≈ 2.5 m del origen (94.5 px).
    const px2m = (2.54 * 0.5) / 96;
    const p1 = r.pts[1];
    expect(p1[0] * px2m).toBeCloseTo(2.5, 1);
  });

  it('S vacío o ramal corto: no-op', () => {
    const r = ramalDe('RRCI3', [
      [0, 0],
      [20, 0],
    ]);
    const eng = motorDe([r]);
    expect(sembrarRociadores(eng, 'RRCI3', 0)).toBe(0);
    expect(sembrarRociadores(eng, 'RRCI3', 5)).toBe(0); // 20 px ≈ 0.53 m < 5 m
    expect(r.accMed).toBeUndefined();
  });
});

describe('crearRamalesParalelos', () => {
  it('crea n paralelos a distancia L con ids consecutivos y el lado elegido', () => {
    // Base horizontal y+: normal (-dy,dx) apunta a -y (izquierda del trazo hacia +x).
    const base = ramalDe('RRCI1', [
      [0, 0],
      [377.95, 0],
    ]);
    const r2 = ramalDe('RRCI2', [
      [1000, 1000],
      [1200, 1000],
    ]);
    const eng = motorDe([base, r2]);
    const ids = crearRamalesParalelos(eng, 'RRCI1', 3.2, 2, 'izq');
    expect(ids).toEqual(['RRCI3', 'RRCI4']);
    const px2m = (2.54 * 0.5) / 96;
    const p1 = eng.ramales.find((r) => r.id === 'RRCI3')!;
    expect(p1.pts[0][1] * px2m).toBeCloseTo(3.2, 1); // 'izq' = (-dy,dx): +y para un trazo →+x
    const p2 = eng.ramales.find((r) => r.id === 'RRCI4')!;
    expect(p2.pts[0][1] * px2m).toBeCloseTo(6.4, 1);
    // Lado derecho: -y (normal invertida).
    const der = crearRamalesParalelos(eng, 'RRCI1', 3.2, 1, 'der');
    expect(der).toEqual(['RRCI5']);
    const p5 = eng.ramales.find((r) => r.id === 'RRCI5')!;
    expect(p5.pts[0][1] * px2m).toBeCloseTo(-3.2, 1);
  });

  it('sin L válida o ramal inexistente: no-op', () => {
    const base = ramalDe('RRCI1', [
      [0, 0],
      [100, 0],
    ]);
    const eng = motorDe([base]);
    expect(crearRamalesParalelos(eng, 'RRCI1', 0, 2, 'izq')).toEqual([]);
    expect(crearRamalesParalelos(eng, 'NOPE', 2, 2, 'der')).toEqual([]);
    expect(eng.ramales).toHaveLength(1);
  });
});

import { chequeoMurosTrazo } from '../rciAutoDraw.ts';

describe('chequeoMurosTrazo (en vivo al terminar el trazo rci)', () => {
  it('muro sin ramal cerca → mensaje con la distancia y el Dmuro', () => {
    // Escala 0.5: 1 m = 75,59 px. Muro en y=0; trazo nuevo en y=200 px (2,65 m).
    const eng = motorDe(
      [
        ramalDe('RRCI1', [
          [0, 200],
          [400, 200],
        ]),
      ],
      [
        {
          id: 'GL1',
          net: 'rci',
          esMuro: true,
          pts: [
            [0, 0],
            [400, 0],
          ],
        },
      ],
    );
    const err = chequeoMurosTrazo(
      eng,
      [
        [0, 200],
        [400, 200],
      ],
      1.7,
    );
    expect(err).toBeTruthy();
    expect(err).toContain('quedaría a 2,65 m del ramal más cercano');
    expect(err).toContain('(Dmuro) es de 1,7 m');
  });

  it('trazo que cubre el muro (≤ Dmuro) → null (se crea)', () => {
    const eng = motorDe(
      [],
      [
        {
          id: 'GL1',
          net: 'rci',
          esMuro: true,
          pts: [
            [0, 0],
            [400, 0],
          ],
        },
      ],
    );
    // Trazo a 80 px ≈ 1,06 m del muro (≤ 1,7).
    const err = chequeoMurosTrazo(
      eng,
      [
        [0, 80],
        [400, 80],
      ],
      1.7,
    );
    expect(err).toBeNull();
  });

  it('BANDA: muro lejos del trazo (> 2·Dmuro) NO bloquea aunque siga descubierto', () => {
    // Muro 1 en banda (a 2,65 m del trazo, descubierto) y muro 2 a 6 m (fuera de banda —
    // su ramal vendrá después). El chequeo en vivo SOLO juzga la banda del trazo; la
    // cobertura total del piso la juzga la verificación de tabla.
    const eng = motorDe(
      [],
      [
        {
          id: 'GL1',
          net: 'rci',
          esMuro: true,
          pts: [
            [0, 0],
            [400, 0],
          ],
        }, // 200 px del trazo
        {
          id: 'GL2',
          net: 'rci',
          esMuro: true,
          pts: [
            [0, 800],
            [400, 800],
          ],
        }, // ~6 m, fuera
      ],
    );
    const err = chequeoMurosTrazo(
      eng,
      [
        [0, 200],
        [400, 200],
      ],
      1.7,
    );
    expect(err).toBeTruthy(); // el muro DE la banda sí bloquea
    // Y con SOLO el muro fuera de banda → null (no bloquea el primer trazo del piso).
    const eng2 = motorDe(
      [],
      [
        {
          id: 'GL2',
          net: 'rci',
          esMuro: true,
          pts: [
            [0, 800],
            [400, 800],
          ],
        },
      ],
    );
    expect(
      chequeoMurosTrazo(
        eng2,
        [
          [0, 200],
          [400, 200],
        ],
        1.7,
      ),
    ).toBeNull();
  });

  it('muro de la banda ya cubierto por un ramal existente → null', () => {
    const eng = motorDe(
      [
        ramalDe('RRCI1', [
          [0, 0],
          [400, 0],
        ]),
      ], // pegado al muro (0 px)
      [
        {
          id: 'GL1',
          net: 'rci',
          esMuro: true,
          pts: [
            [0, 0],
            [400, 0],
          ],
        },
      ],
    );
    const err = chequeoMurosTrazo(
      eng,
      [
        [0, 200],
        [400, 200],
      ],
      1.7,
    );
    expect(err).toBeNull();
  });

  it('sin muros o sin Dmuro → null (no bloquea)', () => {
    const eng = motorDe([
      ramalDe('RRCI1', [
        [0, 0],
        [100, 0],
      ]),
    ]);
    expect(
      chequeoMurosTrazo(
        eng,
        [
          [0, 200],
          [400, 200],
        ],
        null,
      ),
    ).toBeNull();
    const eng2 = motorDe(
      [],
      [
        {
          id: 'GL1',
          net: 'rci',
          pts: [
            [0, 0],
            [400, 0],
          ],
        },
      ],
    ); // guía sin esMuro
    expect(
      chequeoMurosTrazo(
        eng2,
        [
          [0, 200],
          [400, 200],
        ],
        1.7,
      ),
    ).toBeNull();
  });
});
