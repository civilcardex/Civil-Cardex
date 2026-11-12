/**
 * Tests del extractor RCI: la planta sintética imita la del ejemplo de verificación del motor
 * (3 ramales con 5/5/6 rociadores, T1 entre nudos, T2 hacia el montante, techo 5.30 y altDeriv
 * 2.50 → bajada 2.80) y ejercita la HU: orden por NPT, orden de dibujo remoto primero, ids
 * estables, nudos A…derivación, merge por id (nunca por nombre) y huérfanos sin borrarse.
 */
import { describe, expect, it } from 'vitest';
import { ejemploVerificacion } from '../../../lib/rci/index.ts';
import type { PisoRow } from '../../../lib/rci/types.ts';
import type { DrawingData, RawElement } from '../../drawingSyncTypes.ts';
import { extraerGris, mezclarOverrides, RCI_FORMAT_VERSION } from '../extract.ts';
import type { PisoRciFuente } from '../extract.ts';

/** Un trazo rci con `n` rociadores dibujados en sus primeros n vértices. */
function ramalRci(
  id: string,
  pts: number[][],
  totalL: number,
  rociadores: number,
  extra: Partial<RawElement> = {},
): RawElement {
  const accMed: Record<string, string> = {};
  for (let i = 0; i < rociadores; i++) accMed[`accMed${i}`] = 'rociador';
  return { id, net: 'rci', tipo: 'ramal', pts, totalL, accMed, ...extra };
}

/** El montante rci de la planta, en el pie de la bajada (default: sin altDeriv — manda el 2.5). */
function montanteRci(extra: Partial<RawElement> = {}): RawElement {
  return { id: 'm1', net: 'rci', tipo: 'montante', code: 'MRCI1', x: 5.79, y: 0, ...extra };
}

/** Planta del ejemplo: T1 (A→B, 3.87 m) + T2 (B→montante, 1.92 m de planta), R2 colineal en A
 *  (18.67 m, 5 rociadores), R1 perpendicular en A (22.20 m, 5), R3 perpendicular en B (26.07, 6). */
function docP1(): DrawingData {
  return {
    ramales: [
      {
        id: 't1',
        net: 'rci',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [3.87, 0],
        ],
        totalL: 3.87,
      },
      {
        id: 't2',
        net: 'rci',
        tipo: 'ramal',
        pts: [
          [3.87, 0],
          [5.79, 0],
        ],
        totalL: 1.92,
      },
      ramalRci(
        'r2',
        [
          [-18.67, 0],
          [-14.936, 0],
          [-11.202, 0],
          [-7.468, 0],
          [-3.734, 0],
          [0, 0],
        ],
        18.67,
        5,
      ),
      ramalRci(
        'r1',
        [
          [0, -22.2],
          [0, -17.76],
          [0, -13.32],
          [0, -8.88],
          [0, -4.44],
          [0, 0],
        ],
        22.2,
        5,
      ),
      ramalRci(
        'r3',
        [
          [3.87, -26.07],
          [3.87, -21.725],
          [3.87, -17.38],
          [3.87, -13.035],
          [3.87, -8.69],
          [3.87, -4.345],
          [3.87, 0],
        ],
        26.07,
        6,
      ),
    ],
    bajantes: [montanteRci()],
  };
}

/** Los 3 pisos del ejemplo (P1 0.00 / P2 6.10 / P3 12.20); solo P1 tiene trazos. */
function pisosEjemplo(doc: DrawingData | null = docP1()): PisoRciFuente[] {
  return [
    { planId: 'p3', label: 'P3', npt: 12.2, doc: null },
    { planId: 'p1', label: 'P1', npt: 0, doc },
    { planId: 'p2', label: 'P2', npt: 6.1, doc: null },
  ];
}

/** Planta con CONECTOR manual (doctrina HTML: «trace los tramos de nudo a nudo»): tronco con
 *  2 ramales (A y B) + trazo sin rociadores que une los extremos remotos de ambos → fila T.
 *  `conHuérfano` añade un trazo suelto que NO toca la red (sigue avisando). */
function docConector(conector: number[][] | null, huérfano: number[][] | null = null): DrawingData {
  const ramales: RawElement[] = [
    {
      id: 't1',
      net: 'rci',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [5.79, 0],
      ],
      totalL: 5.79,
    },
    ramalRci(
      'r1',
      [
        [0, -10],
        [0, 0],
      ],
      10,
      2,
    ),
    ramalRci(
      'r2',
      [
        [3.87, -10],
        [3.87, 0],
      ],
      10,
      2,
    ),
  ];
  if (conector)
    ramales.push({
      id: 'c1',
      net: 'rci',
      tipo: 'ramal',
      pts: conector,
      totalL: 3.87,
    });
  if (huérfano)
    ramales.push({
      id: 'h1',
      net: 'rci',
      tipo: 'ramal',
      pts: huérfano,
      totalL: 2.13,
    });
  return { ramales, bajantes: [montanteRci()] };
}

describe('extraerGris — tramos entre nudos trazados a mano (conectores sin rociadores)', () => {
  const { estado, avisos } = extraerGris(
    pisosEjemplo(
      docConector(
        [
          [0, -10],
          [3.87, -10],
        ],
        [
          [3.87, -26],
          [6, -26],
        ],
      ),
    ),
  );
  const red = estado.redes['p1'];

  it('el conector que une los extremos remotos de R1 y R2 se exporta como fila T entre sus nudos', () => {
    /* Tronco: T1 (A→B) y T2 (B→C derivación, con bajada). Conector: T3 (A→B). */
    expect(red.tramos.map((t) => t.nombre)).toEqual(['T1', 'T2', 'T3']);
    expect(red.tramos[2]).toMatchObject({ de: 'A', a: 'B', id: 'p1|c1' });
    expect(Number(red.tramos[2].L)).toBeCloseTo(3.87, 6);
    expect(Number(red.tramos[2].desgPlanta)).toBeCloseTo(3.87, 6);
  });

  it('el conector NO dispara el aviso de tramo sin rociadores fuera de la ruta', () => {
    const solo = extraerGris(
      pisosEjemplo(
        docConector([
          [0, -10],
          [3.87, -10],
        ]),
      ),
    );
    expect(solo.avisos.map((a) => a.msg).join('\n')).not.toContain('sin rociadores no conectan');
  });

  it('el trazo suelto (sin dos contactos) SÍ avisa como huérfano', () => {
    expect(avisos.map((a) => a.msg).join('\n')).toContain('1 tramo(s) sin rociadores no conectan');
  });

  it('conector a MITAD del tronco: crea nudo nuevo (letra tras la derivación) y corta las piezas', () => {
    const { estado: e2 } = extraerGris(
      pisosEjemplo(
        docConector([
          [0, -10],
          [2, 0],
        ]),
      ),
    );
    const r2 = e2.redes['p1'];
    /* A(0), B(3.87), deriv C(5.79) + nudo nuevo D en pos 2 → tronco en 3 piezas + conector. */
    expect(Object.keys(r2.nodos || {}).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(r2.tramos.map((t) => `${t.nombre}:${t.de}-${t.a}`)).toEqual([
      'T1:A-D',
      'T2:D-B',
      'T3:B-C',
      'T4:A-D',
    ]);
  });
});

describe('extraerGris — estructura contra el ejemplo de verificación', () => {
  const { estado, montDibujo, avisos } = extraerGris(pisosEjemplo());

  it('pisos: uno por plano, ordenados por NPT ascendente, con id estable = planId', () => {
    expect(estado.pisos.rows.map((f) => f.nombre)).toEqual(['P1', 'P2', 'P3']);
    expect(estado.pisos.rows.map((f) => Number(f.npt))).toEqual([0, 6.1, 12.2]);
    expect(estado.pisos.rows.map((f) => (f as PisoRow & { planId: string }).planId)).toEqual([
      'p1',
      'p2',
      'p3',
    ]);
  });

  it('red bajo la clave del planId; ramales en orden de dibujo (remoto primero) con 5/5/6 rociadores', () => {
    const red = estado.redes['p1'];
    expect(red).toBeTruthy();
    expect(estado.redes['p2']).toBeUndefined();
    expect(red.ramales.map((r) => r.nombre)).toEqual(['R1', 'R2', 'R3']);
    expect(red.ramales.map((r) => Number(r.dib))).toEqual([5, 5, 6]);
    expect(red.ramales.map((r) => r.con)).toEqual(['A', 'A', 'B']);
    expect(red.ramales.map((r) => Number(r.Lr))).toEqual([18.67, 22.2, 26.07]);
    /* Ids estables = planId|idTrazo (no los nombres: R2 del dibujo no se llama R2 aquí). */
    expect(red.ramales.map((r) => r.id)).toEqual(['p1|r2', 'p1|r1', 'p1|r3']);
    /* R1 colineal con el tronco no gira (sin tee); los perpendiculares sí (tee auto). */
    expect(Number(red.ramales[0].tee)).toBe(0);
    expect(Number(red.ramales[1].tee)).toBe(1);
    expect(Number(red.ramales[2].tee)).toBe(1);
  });

  it('nudos A, B, C con la derivación como última letra; zRam = techo 5.30', () => {
    const red = estado.redes['p1'];
    expect(Object.keys(red.nodos || {})).toEqual(['A', 'B', 'C']);
    expect(red.raiz).toBe('C');
    expect(Number(red.zRam)).toBe(5.3);
    expect(red.nodos?.A?.z).toBe('');
    expect(Number(red.nodos?.C?.z)).toBe(2.5);
  });

  it('T2 hacia la derivación: L = 1.92 de planta + 2.80 de bajada (5.30 − 2.50) y 2 codos', () => {
    const red = estado.redes['p1'];
    expect(red.tramos.map((t) => t.nombre)).toEqual(['T1', 'T2']);
    expect(red.tramos[0]).toMatchObject({ de: 'A', a: 'B', id: 'p1|t1' });
    expect(Number(red.tramos[0].L)).toBeCloseTo(3.87, 6);
    expect(Number(red.tramos[1].L)).toBeCloseTo(4.72, 6);
    expect(Number(red.tramos[1].desgPlanta)).toBeCloseTo(1.92, 6);
    expect(Number(red.tramos[1].desgBajada)).toBeCloseTo(2.8, 6);
    expect(Number(red.tramos[1].c90)).toBe(2);
    expect(Number(red.tramos[1].tee)).toBe(0);
  });

  it('montante presente con altDeriv por defecto (2.5) y material/diámetro por defecto', () => {
    expect(estado.montantes).toHaveLength(1);
    expect(estado.montantes[0]).toMatchObject({ id: 'p1|m1', nombre: 'MRCI1', pisos: [0] });
    expect(Number(estado.mont.hD)).toBe(2.5);
    expect(estado.mont.mat).toBe('Acero SCH 10');
    expect(estado.mont.dn).toBe('auto');
    expect(montDibujo).toEqual({ mat: null, dn: null, altDeriv: null });
    expect(avisos).toEqual([]);
  });

  it('altDeriv dibujada en el montante manda sobre el default (contrato Fase 2)', () => {
    const doc = docP1();
    doc.bajantes = [montanteRci({ altDeriv: 2.8 })];
    const g = extraerGris(pisosEjemplo(doc));
    expect(Number(g.estado.mont.hD)).toBe(2.8);
    expect(g.montDibujo.altDeriv).toBe(2.8);
    /* La bajada del T2 se recalcula: 5.30 − 2.80 = 2.50 → L = 1.92 + 2.50 = 4.42. */
    expect(Number(g.estado.redes['p1'].tramos[1].L)).toBeCloseTo(4.42, 6);
    /* Con opciones.techo la tipología manda: 3.00 − 2.80 = 0.20 de bajada. */
    const g2 = extraerGris(pisosEjemplo(doc), { techo: 3 });
    expect(Number(g2.estado.redes['p1'].tramos[1].desgBajada)).toBeCloseTo(0.2, 6);
  });

  it('opciones.techo de la tipología manda: zRam = techo y la bajada se recalcula', () => {
    /* HtFt de la tipología = 4.0 m (13.12 ft): zRam nace con el techo real, no con el 5.30. */
    const g = extraerGris(pisosEjemplo(), { techo: 4 });
    expect(Number(g.estado.redes['p1'].zRam)).toBe(4);
    /* Bajada: 4.00 − 2.50 = 1.50 → T2 L = 1.92 + 1.50 = 3.42. */
    expect(Number(g.estado.redes['p1'].tramos[1].desgBajada)).toBeCloseTo(1.5, 6);
    expect(Number(g.estado.redes['p1'].tramos[1].L)).toBeCloseTo(3.42, 6);
  });
});

describe('extraerGris — ronda-trip idempotente (ids estables)', () => {
  it('dos extracciones de los mismos trazos producen el mismo estado', () => {
    const a = extraerGris(pisosEjemplo());
    const b = extraerGris(pisosEjemplo());
    expect(JSON.stringify(a.estado.redes)).toEqual(JSON.stringify(b.estado.redes));
    expect(JSON.stringify(a.estado.pisos.rows)).toEqual(JSON.stringify(b.estado.pisos.rows));
    expect(JSON.stringify(a.estado.montantes)).toEqual(JSON.stringify(b.estado.montantes));
  });
});

describe('mezclarOverrides — lo amarillo sobrevive por id estable', () => {
  it('primera exportación sin prev: estado gris completo, sin huérfanos, formatVersion 1', () => {
    const m1 = mezclarOverrides(extraerGris(pisosEjemplo()), null);
    expect(m1.formatVersion).toBe(RCI_FORMAT_VERSION);
    expect(RCI_FORMAT_VERSION).toBe(1);
    expect(m1.huerfanos).toEqual([]);
    expect(m1.estado.redes['p1'].ramales).toHaveLength(3);
  });

  it('fluyen/diámetro/tanque/notas digitados sobreviven a una re-exportación', () => {
    const m1 = mezclarOverrides(extraerGris(pisosEjemplo()), null);
    const prev = m1.estado;
    prev.redes['p1'].ramales[0].fluyen = 3;
    prev.redes['p1'].ramales[0].dn = '1"';
    prev.redes['p1'].ramales[2].S = 3.5;
    prev.redes['p1'].tramos[1].esp = 'DF';
    prev.tanque.vextra = 5;
    prev.notas = 'mis notas';
    prev.pisos.rows[0].riesgo = 'Riesgo ordinario';
    prev.pisos.rows[0].Dmuro = '1.75';

    /* Renombrar en el DIBUJO (code/label): el id interno no cambia. */
    const docRen = docP1();
    (docRen.ramales![2] as RawElement).code = 'R-99';
    (docRen.ramales![2] as RawElement).label = 'ramal renombrado';
    (docRen.bajantes![0] as RawElement).code = 'MRCI-2';
    const g2 = extraerGris(pisosEjemplo(docRen));
    const m2 = mezclarOverrides(g2, prev);

    expect(m2.estado.redes['p1'].ramales[0].fluyen).toBe(3);
    expect(m2.estado.redes['p1'].ramales[0].dn).toBe('1"');
    expect(m2.estado.redes['p1'].ramales[2].S).toBe(3.5);
    expect(m2.estado.redes['p1'].tramos[1].esp).toBe('DF');
    expect(m2.estado.tanque.vextra).toBe(5);
    expect(m2.estado.notas).toBe('mis notas');
    /* El nombre se regenera (no tomó el code renombrado) y el piso renombrado conserva lo digitado. */
    expect(m2.estado.redes['p1'].ramales[0].nombre).toBe('R1');
    expect(m2.estado.pisos.rows[0].nombre).toBe('P1');
    expect(m2.estado.pisos.rows[0].riesgo).toBe('Riesgo ordinario');
    /* DMR digitada por piso sobrevive a la re-extracción (antes caía y sembrarRci
     * re-sembraba la global — el valor "volvía a 2" al re-ingresar). */
    expect(m2.estado.pisos.rows[0].Dmuro).toBe('1.75');
    expect(m2.estado.montantes[0].nombre).toBe('MRCI-2');
    expect(m2.huerfanos).toEqual([]);
  });

  it('secciones amarillas completas del ejemplo de verificación sobreviven', () => {
    const m1 = mezclarOverrides(extraerGris(pisosEjemplo()), null);
    const ej = ejemploVerificacion();
    const prev = {
      ...m1.estado,
      meta: ej.meta,
      clas: ej.clas,
      bomba: ej.bomba,
      sia: ej.sia,
      notas: ej.notas,
    };
    const m2 = mezclarOverrides(extraerGris(pisosEjemplo()), prev);
    expect(m2.estado.meta.proyecto).toContain('Ejemplo de verificación');
    expect(m2.estado.clas.riesgo).toBe('Riesgo leve');
    expect(Number(m2.estado.bomba.margen)).toBe(0.1);
    expect(m2.estado.notas).toContain('T2');
  });

  it('id eliminado del gris → huérfanos con sus datos, sin borrarlos del prev', () => {
    const m1 = mezclarOverrides(extraerGris(pisosEjemplo()), null);
    const prev = m1.estado;
    prev.redes['p1'].ramales[2].fluyen = 2;

    const docSin = docP1();
    docSin.ramales = docSin.ramales!.filter((r) => r.id !== 'r3');
    const m3 = mezclarOverrides(extraerGris(pisosEjemplo(docSin)), prev);

    expect(m3.estado.redes['p1'].ramales).toHaveLength(2);
    /* Sin R3 el nudo B desaparece: el tronco se coalesce en un solo T1 (p1|t1) y el row previo
       del T2 (p1|t2) queda sin dueño — la HU exige avisar, no borrar en silencio. */
    expect(m3.huerfanos).toHaveLength(2);
    expect(m3.huerfanos[0]).toMatchObject({ tipo: 'ramal', red: 'p1', id: 'p1|r3', nombre: 'R3' });
    expect(
      m3.huerfanos[0].fila && Number((m3.huerfanos[0].fila as { fluyen: number }).fluyen),
    ).toBe(2);
    expect(m3.huerfanos[1]).toMatchObject({ tipo: 'tramo', red: 'p1', id: 'p1|t2', nombre: 'T2' });
    /* El prev no se muta: los datos digitados siguen vivos en él (la UI decide qué hacer). */
    expect(prev.redes['p1'].ramales[2].fluyen).toBe(2);
    expect(prev.redes['p1'].tramos).toHaveLength(2);
  });

  it('hD digitado del montante sobrevive cuando el dibujo no trae altDeriv, y el dibujo manda cuando sí', () => {
    const m1 = mezclarOverrides(extraerGris(pisosEjemplo()), null);
    const prev = m1.estado;
    prev.mont.hD = 3.1;
    /* Dibujo silente: sobrevive lo digitado. */
    const m2 = mezclarOverrides(extraerGris(pisosEjemplo()), prev);
    expect(Number(m2.estado.mont.hD)).toBe(3.1);
    /* Dibujo con altDeriv: manda el dibujo. */
    const doc = docP1();
    doc.bajantes = [montanteRci({ altDeriv: 2.2 })];
    const m3 = mezclarOverrides(extraerGris(pisosEjemplo(doc)), prev);
    expect(Number(m3.estado.mont.hD)).toBe(2.2);
  });

  it('raiz/zRam/cota de derivación digitados en la red sobreviven; nudo nuevo del gris se añade', () => {
    const m1 = mezclarOverrides(extraerGris(pisosEjemplo()), null);
    const prev = m1.estado;
    prev.redes['p1'].raiz = 'B';
    prev.redes['p1'].zRam = 4.2;
    prev.redes['p1'].nodos!['C'].z = 2.9;
    delete prev.redes['p1'].nodos!.B; // nudo nuevo para el merge: lo aporta el gris

    const m2 = mezclarOverrides(extraerGris(pisosEjemplo()), prev);
    expect(m2.estado.redes['p1'].raiz).toBe('B');
    expect(Number(m2.estado.redes['p1'].zRam)).toBe(4.2);
    expect(Number(m2.estado.redes['p1'].nodos?.C?.z)).toBe(2.9);
    /* El nudo B reaparece con la cota del dibujo (vacía) y A sigue sin cota digitada. */
    expect(m2.estado.redes['p1'].nodos?.B?.z).toBe('');
    expect(m2.estado.redes['p1'].nodos?.A?.z).toBe('');
  });

  it('red sin prev en el merge (clave nueva) sale completa del gris', () => {
    const m1 = mezclarOverrides(extraerGris(pisosEjemplo()), null);
    const prev = m1.estado;
    prev.redes['p1'].zRam = 4.2;
    delete (prev.redes as Record<string, unknown>)['p1'];

    const m2 = mezclarOverrides(extraerGris(pisosEjemplo()), prev);
    expect(Number(m2.estado.redes['p1'].zRam)).toBe(5.3);
    expect(m2.estado.redes['p1'].raiz).toBe('C');
    expect(Number(m2.estado.redes['p1'].nodos?.C?.z)).toBe(2.5);
  });

  it('el orden manual de ramales (moverRamal) sobrevive al re-merge; el gris aporta por id', () => {
    const m1 = mezclarOverrides(extraerGris(pisosEjemplo()), null);
    const prev = m1.estado;
    /* [R1(p1|r2), R2(p1|r1), R3(p1|r3)] → [p1|r3, p1|r2, p1|r1] con fluyen digitado. */
    const [a, b, c] = prev.redes['p1'].ramales;
    prev.redes['p1'].ramales = [c, a, b];
    prev.redes['p1'].ramales[0].fluyen = 4;

    const m2 = mezclarOverrides(extraerGris(pisosEjemplo()), prev);
    expect(m2.estado.redes['p1'].ramales.map((r) => r.id)).toEqual(['p1|r3', 'p1|r2', 'p1|r1']);
    expect(Number(m2.estado.redes['p1'].ramales[0].fluyen)).toBe(4);
    /* La geometría gris sigue atada al id (dib 6/5/5) aunque el orden haya cambiado. */
    expect(m2.estado.redes['p1'].ramales.map((r) => Number(r.dib))).toEqual([6, 5, 5]);
    expect(m2.huerfanos).toEqual([]);
  });

  it('ramal nuevo del gris entra al final del orden previo', () => {
    /* El prev se construyó con un dibujo sin R3 (p1|r3); el dibujo de HOY lo trae. */
    const docSin = docP1();
    docSin.ramales = docSin.ramales!.filter((r) => r.id !== 'r3');
    const prev = mezclarOverrides(extraerGris(pisosEjemplo(docSin)), null).estado;

    const m2 = mezclarOverrides(extraerGris(pisosEjemplo()), prev);
    expect(m2.estado.redes['p1'].ramales.map((r) => r.id)).toEqual(['p1|r2', 'p1|r1', 'p1|r3']);
    expect(m2.huerfanos).toEqual([]);
  });
});
