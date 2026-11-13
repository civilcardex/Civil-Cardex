import { describe, it, expect, vi } from 'vitest';
import {
  sembrarRociadores,
  crearRamalesParalelos,
  verificaSRociadores,
  renumeraRociadores,
} from '../RCIAutoDraw.ts';
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
    expect(r.accesorioInicio).toBe('rociador#1');
    const marcadores = Object.values(r.accMed || {}).filter((v) => /^rociador#/.test(v));
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

  it('ramal MÁS CORTO que S: igual siembra la cabeza (no se queda sin ninguno)', () => {
    // 2 m (75.6 px) con S = 4.3 (162.5 px): cero puntos interiores, pero el extremo inicial
    // libre recibe el rociador de cabeza — antes el no-op temprano lo dejaba vacío (bug).
    const r = ramalDe('RRCI7', [
      [0, 0],
      [75.6, 0],
    ]);
    const eng = motorDe([r]);
    expect(sembrarRociadores(eng, 'RRCI7', 4.3)).toBe(1);
    expect(r.accesorioInicio).toBe('rociador#1');
    expect(Object.keys(r.accMed || {})).toHaveLength(0);
  });

  it('ramal corto con cabeza ocupada: no se siembra nada (retorno 0) y el menú avisa', () => {
    const r = ramalDe('RRCI8', [
      [0, 0],
      [75.6, 0],
    ]);
    r.accesorioInicio = 'codo';
    const eng = motorDe([r]);
    expect(sembrarRociadores(eng, 'RRCI8', 4.3)).toBe(0);
    expect(Object.values(r.accMed || {})).toHaveLength(0);
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

  it('IDEMPOTENTE: 2.ª llamada con el mismo S NO duplica rociadores (retorno 0)', () => {
    // 10 m, S = 2.5: primera pasada 4; segunda encuentra TODAS las posiciones ocupadas → 0.
    const r = ramalDe('RRCI9', [
      [0, 0],
      [755.9, 0],
    ]);
    const eng = motorDe([r]);
    expect(sembrarRociadores(eng, 'RRCI9', 2.5)).toBe(4);
    const antes = JSON.stringify(r.pts);
    expect(sembrarRociadores(eng, 'RRCI9', 2.5)).toBe(0);
    expect(JSON.stringify(r.pts)).toBe(antes);
    expect(Object.values(r.accMed || {}).filter((v) => /^rociador#/.test(v))).toHaveLength(3);
  });

  it('S inválido: no-op; ramal corto: solo la cabeza (no se queda sin rociadores)', () => {
    const r = ramalDe('RRCI3', [
      [0, 0],
      [20, 0],
    ]);
    const eng = motorDe([r]);
    expect(sembrarRociadores(eng, 'RRCI3', 0)).toBe(0);
    expect(sembrarRociadores(eng, 'RRCI3', 5)).toBe(1); // 20 px ≈ 0.53 m < 5 m: cabeza sí
    expect(r.accesorioInicio).toBe('rociador#1');
    expect(r.accMed).toBeUndefined();
  });

  it('NUMERACIÓN ROC-N: siembra estampa rociador#1… consecutivos POR PISO (cabeza primero)', () => {
    const a = ramalDe('RRCI1', [
      [0, 0],
      [755.9, 0],
    ]);
    const b = ramalDe('RRCI2', [
      [0, 200],
      [755.9, 200],
    ]);
    const eng = motorDe([a, b]);
    sembrarRociadores(eng, 'RRCI1', 2.5); // 4 rociadores → ROC-1..4
    sembrarRociadores(eng, 'RRCI2', 2.5); // 4 más → ROC-5..8
    expect(a.accesorioInicio).toBe('rociador#1');
    const numsA = Object.values(a.accMed || {}).map((v) => Number(v.split('#')[1]));
    expect(numsA).toEqual([2, 3, 4]); // vértice ASC
    expect(b.accesorioInicio).toBe('rociador#5');
    const numsB = Object.values(b.accMed || {}).map((v) => Number(v.split('#')[1]));
    expect(numsB).toEqual([6, 7, 8]);
  });

  it('renumeraRociadores: la numeración continúa al sembrar el paralelo (sin duplicar #)', () => {
    const base = ramalDe('RRCI1', [
      [0, 0],
      [755.9, 0],
    ]);
    const eng = motorDe([base]);
    sembrarRociadores(eng, 'RRCI1', 2.5); // base: rociador#1..4
    const { ids } = crearRamalesParalelos(eng, 'RRCI1', 3.2, 1, 'abajo', null);
    expect(ids).toEqual(['RRCI2']);
    const copia = eng.ramales.find((r) => r.id === 'RRCI2')!;
    sembrarRociadores(eng, 'RRCI2', 2.5); // la copia nace sin rociadores: continúa → #5..8
    const todos = eng.ramales
      .filter((r) => r.net === 'rci')
      .flatMap((r) => [
        ...(r.accesorioInicio && /^rociador#/.test(r.accesorioInicio) ? [r.accesorioInicio] : []),
        ...Object.values(r.accMed || {}),
      ])
      .map((v) => Number(String(v).split('#')[1]))
      .sort((x, y) => x - y);
    expect(todos).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(copia.accesorioInicio).toBe('rociador#5');
  });
});

describe('crearRamalesParalelos', () => {
  it('crea n paralelos a distancia L, atados al pie, en la DIRECCIÓN ABSOLUTA pedida', () => {
    const base = ramalDe('RRCI1', [
      [0, 0],
      [377.95, 0],
    ]);
    const r2 = ramalDe('RRCI2', [
      [1000, 1000],
      [1200, 1000],
    ]);
    const eng = motorDe([base, r2]);
    const { ids } = crearRamalesParalelos(eng, 'RRCI1', 3.2, 2, 'abajo', null);
    // COPIA PURA (ped. usuario): SIN conector — solo las n copias; la conexión la hace el
    // extractor por proximidad (tolPar). RRCI3/RRCI4 son las copias.
    expect(ids).toEqual(['RRCI3', 'RRCI4']);
    const px2m = (2.54 * 0.5) / 96;
    const p1 = eng.ramales.find((r) => r.id === 'RRCI3')!;
    expect(p1.pts[0][0]).toBe(0);
    expect(p1.pts[0][1] * px2m).toBeCloseTo(3.2, 1); // 'abajo' = +y en pantalla
    const p2 = eng.ramales.find((r) => r.id === 'RRCI4')!;
    expect(p2.pts[0][1] * px2m).toBeCloseTo(6.4, 1);
    // Dirección opuesta: 'arriba' = -y (aunque el trazo se dibuje →+x o →−x).
    const { ids: idsArr } = crearRamalesParalelos(eng, 'RRCI1', 3.2, 1, 'arriba', null);
    expect(idsArr).toEqual(['RRCI5']);
    const p6 = eng.ramales.find((r) => r.id === 'RRCI5')!;
    expect(p6.pts[0][1] * px2m).toBeCloseTo(-3.2, 1);
  });

  it('vertical: «derecha» sale siempre hacia +x sin importar el sentido del trazo', () => {
    // Trazo hacia ARRIBA (dy negativo) y otro hacia ABAJO — 'der' debe dar +x en ambos.
    const up = ramalDe('RRCI1', [
      [0, 0],
      [0, -377.95],
    ]);
    const down = ramalDe('RRCI2', [
      [0, 0],
      [0, 377.95],
    ]);
    const eng = motorDe([up, down]);
    crearRamalesParalelos(eng, 'RRCI1', 3.2, 1, 'der', null);
    crearRamalesParalelos(eng, 'RRCI2', 3.2, 1, 'der', null);
    const px2m = (2.54 * 0.5) / 96;
    // ids por llamada: [copia] — RRCI3 y RRCI4 (sin conector, copia pura).
    const a = eng.ramales.find((r) => r.id === 'RRCI3')!;
    const b = eng.ramales.find((r) => r.id === 'RRCI4')!;
    expect(a.pts[1][0] * px2m).toBeCloseTo(3.2, 1);
    expect(b.pts[1][0] * px2m).toBeCloseTo(3.2, 1);
  });

  it('sin L válida o ramal inexistente: no-op', () => {
    const base = ramalDe('RRCI1', [
      [0, 0],
      [100, 0],
    ]);
    const eng = motorDe([base]);
    expect(crearRamalesParalelos(eng, 'RRCI1', 0, 2, 'izq', null).ids).toEqual([]);
    expect(crearRamalesParalelos(eng, 'NOPE', 2, 2, 'der', null).ids).toEqual([]);
    expect(eng.ramales).toHaveLength(1);
  });
});

import { chequeoMurosTrazo } from '../RCIAutoDraw.ts';

describe('chequeoMurosTrazo (en vivo al terminar el trazo rci)', () => {
  it('muro sin ramal cerca → mensaje con la distancia y el Dmuro', () => {
    // Escala 0.5: 1 m = 75,59 px. Muro en y=0; trazo nuevo en y=200 px (2,65 m). El trazado
    // NO está en engine.ramales: finishRamal corre ANTES del push (como en producción).
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
    const err = chequeoMurosTrazo(
      eng,
      [
        [0, 200],
        [400, 200],
      ],
      1.7,
    );
    expect(err).toBeTruthy();
    expect(err).toContain('queda a 2,65 m del muro más cercano');
    expect(err).toContain('(DMR) es de 1,7 m');
  });

  it('SALÓN GRANDE (captura): trazo PEGADO al muro superior → null (proximidad ok)', () => {
    // Caja trazada como UNA guía: (0,0)→(1000,0)→(1000,600)→(0,600). Trazo pegado al muro
    // superior (y=100): cada tramo del trazado tiene su muro más cercano a ≤ Dmuro → el
    // trazado pasa. NO bloquean la vertical derecha ni el inferior (proximidad, ped.
    // usuario 2026-11-13: solo los muros que el trazado tiene cerca).
    const eng = motorDe(
      [
        ramalDe('RRCI1', [
          [130, 100],
          [880, 100],
        ]),
      ],
      [
        {
          id: 'GL1',
          net: 'rci',
          esMuro: true,
          pts: [
            [0, 0],
            [1000, 0],
            [1000, 600],
            [0, 600],
          ],
        },
      ],
    );
    expect(
      chequeoMurosTrazo(
        eng,
        [
          [130, 100],
          [880, 100],
        ],
        2,
      ),
    ).toBeNull();
  });

  it('SALÓN GRANDE: trazo CENTRAL lejos de todos los muros → bloquea por proximidad', () => {
    // El trazo está a ~2,17 m de TODOS los muros con Dmuro 2: el muro más cercano a cada
    // tramo supera la DMR → alerta (doctrina original: el trazado no debe alejarse de los
    // muros más de S máx/2).
    const eng = motorDe(
      [],
      [
        {
          id: 'GL1',
          net: 'rci',
          esMuro: true,
          pts: [
            [0, 0],
            [1000, 0],
            [1000, 600],
            [0, 600],
          ],
        },
      ],
    );
    const err = chequeoMurosTrazo(
      eng,
      [
        [400, 300],
        [600, 300],
      ],
      2,
    );
    expect(err).toBeTruthy();
    expect(err).toContain('queda a');
    expect(err).toContain('(DMR) es de 2 m');
  });

  it('MURO MÁS LARGO que la cobertura: el extremo descubierto bloquea aunque el punto más cercano cumpla', () => {
    // Caso del muro inferior (ped. usuario): el trazo solo cubre la MITAD izquierda (x≤200);
    // el punto (400,0) queda a 215 px ≈ 2,85 m del trazo > Dmuro 1,7 → alerta (antes la
    // distancia MÍNIMA 0,84 m validaba el muro entero).
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
    expect(
      chequeoMurosTrazo(
        eng,
        [
          [0, 80],
          [200, 80],
        ],
        1.7,
      ),
    ).toBeNull();
  });

  it('BANDA: solo los muros a ≤ 2·Dmuro del trazo se juzgan (los lejanos esperan su ramal)', () => {
    // Muro 1 a 2,65 m del trazo y muro 2 más lejos (10,58 m): el muro MÁS CERCANO manda —
    // NO se exige cumplir con todos los muros (imposible en un piso real).
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
        }, // ~10,58 m
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
    expect(err).toBeTruthy(); // muro EN banda (2,65 ≤ 3,4) y descubierto → bloquea
    expect(err).toContain('2,65');
    // Y si el muro más cercano queda DENTRO de Dmuro, pasa aunque haya otro muro lejos:
    // el lejano (6 m > banda 3,4 m) espera su propio ramal.
    const eng2 = motorDe(
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
        }, // 80 px = 1,06 m ≤ 1,7 ✓
        {
          id: 'GL2',
          net: 'rci',
          esMuro: true,
          pts: [
            [0, 800],
            [400, 800],
          ],
        }, // lejos
      ],
    );
    expect(
      chequeoMurosTrazo(
        eng2,
        [
          [0, 80],
          [400, 80],
        ],
        1.7,
      ),
    ).toBeNull();
  });

  it('RED EXISTENTE como referencia: el trazo pegado al ramal ya dibujado pasa aunque esté lejos del muro', () => {
    // Muro en y=0 y ramal rci existente en y=300 (a 3,97 m del muro). El trazo nuevo pegado
    // AL RAMAL (y=310) queda a 4,10 m del muro pero a 0,13 m de la red: pasa (ped. usuario:
    // los ramales que conectan con la red existente no bloquean por lejanía de muros).
    const eng = motorDe(
      [
        ramalDe('RRCI1', [
          [0, 300],
          [400, 300],
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
        [0, 310],
        [400, 310],
      ],
      1.7,
    );
    expect(err).toBeNull();
  });

  it('MÍNIMO: trazo pegado a un muro (< 0,10 m) → alerta aunque el Dmuro no aplique', () => {
    // Muro en y=0; trazo a 3 px ≈ 0,04 m (< 0,10). Dmuro incluso null → la mínima aplica igual.
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
    const err = chequeoMurosTrazo(
      eng,
      [
        [0, 3],
        [400, 3],
      ],
      null,
    );
    expect(err).toBeTruthy();
    expect(err).toContain('distancia mínima a muro es de 0,10 m');
  });

  it('MÍNIMO: trazo que CRUZA el muro (dist 0) → alerta', () => {
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
    const err = chequeoMurosTrazo(
      eng,
      [
        [150, -200],
        [150, 200],
      ],
      1.7,
    );
    expect(err).toBeTruthy();
    expect(err).toContain('0,00 m');
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

describe('S EXACTA entre rociadores (tolerancia solo numérica)', () => {
  it('siembra automática: huecos exactamente S → verificaSRociadores = null', () => {
    const r = ramalDe('RRCI1', [
      [0, 0],
      [755.9, 0],
    ]);
    const eng = motorDe([r]);
    sembrarRociadores(eng, 'RRCI1', 2.5);
    expect(verificaSRociadores(eng, 'RRCI1', 2.5)).toBeNull();
  });

  it('hueco MENOR que S (rociador manual a mitad): alerta con la desviación', () => {
    // 2 rociadores a ~1.25 m (la mitad de S): hueco 47.25 px < pasoPx 94.5 px.
    const r = ramalDe('RRCI2', [
      [0, 0],
      [400, 0],
    ]);
    r.accesorioInicio = 'rociador#1';
    r.accMed = { accMed1: 'rociador#2' };
    const eng = motorDe([r]);
    const err = verificaSRociadores(eng, 'RRCI2', 2.5);
    expect(err).toBeTruthy();
    expect(err).toContain('debe ser exactamente');
  });

  it('hueco MAYOR que S: también alerta', () => {
    const r = ramalDe('RRCI3', [
      [0, 0],
      [755.9, 0],
    ]);
    r.accesorioInicio = 'rociador#1';
    r.accMed = { accMed3: 'rociador#2' }; // 3 pasos ≈ 7.5 m con S 2.5
    const eng = motorDe([r]);
    expect(verificaSRociadores(eng, 'RRCI3', 2.5)).toBeTruthy();
  });
});

describe('tipo de rociador sincronizado con el símbolo', () => {
  it('cambiar el tipo (rociador→rociadorMontante) conserva ROC-N y NO toca la geometría', () => {
    const r = ramalDe('RRCI4', [
      [0, 0],
      [755.9, 0],
    ]);
    const eng = motorDe([r]);
    sembrarRociadores(eng, 'RRCI4', 2.5);
    const ptsAntes = JSON.stringify(r.pts);
    // El usuario cambia el tipo desde el desplegable (mismo gesto que midRamalAccessorySelector):
    const accMed = { ...(r.accMed || {}) };
    accMed['accMed1'] = 'rociadorMontante';
    eng.updateElementById('RRCI4', { accMed });
    renumeraRociadores(eng);
    // Geometría intacta (solo cambió el tipo del accesorio):
    expect(JSON.stringify(r.pts)).toBe(ptsAntes);
    // El ROC-N se conserva (renumera reasigna 1..4 en orden):
    expect(r.accMed?.['accMed1']).toBe('rociadorMontante#2');
    expect(r.accesorioInicio).toBe('rociador#1');
  });
});
