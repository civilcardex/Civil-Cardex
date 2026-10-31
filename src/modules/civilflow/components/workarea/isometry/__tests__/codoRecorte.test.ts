import { describe, it, expect } from 'vitest';
import {
  CODO_RADIO,
  agrupaCodos,
  extremosVerticales,
  hayVerticalArriba,
  ladoDelCodo,
  preparaCodos,
  recortaVerticalAlCodo,
  unionDeGrupo,
  unionEnExtremo,
  verticalPasaAlOtroLado,
} from '../recorteCodo.ts';
import type { CodoPrep } from '../recorteCodo.ts';

// Reglas del codo 90° que NO son el arco (eso lo cubre codoIso.test):
//  · la vertical se recorta en la tangencia SOLO si el tubo muere en el codo (tee = pasante),
//  · el lado del arco es el de la vertical que sigue (u `origenId` cuando viene de arriba),
//  · un bajante con varios ramales produce un prep por ramal (antes solo el primero tenía codo),
//  · el vértice es la intersección con el tubo, no el extremo crudo del ramal.

/** Proyección de mentira: iso == pantalla y z ignorado (así las cuentas se leen a mano). */
const proyecta = (iso: { x: number; y: number }) => ({ sx: iso.x, sy: iso.y });
const isoDe = (x: number, y: number) => ({ x, y });

function preparar(
  ramales: Array<Record<string, unknown>>,
  bajantes: Array<Record<string, unknown>>,
) {
  return preparaCodos({
    bajantes: bajantes as never,
    ramales: ramales as never,
    proyecta,
    isoDe,
    nptMap: { 0: 0, 1: -2700 },
    prof: 0,
    getZPix: (z) => z,
    zoom: 1,
  });
}

function ramal(id: string, pts: number[][], extra: Record<string, unknown> = {}) {
  return { id, planId: '1', planNivel: 0, pts, ini: '', fin: '', ...extra };
}

function bajante(id: string, code: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    code,
    tipo: 'bajante',
    planId: '1',
    planNivel: 0,
    x: 100,
    y: 100,
    ...extra,
  };
}

describe('extremosVerticales · z de los dos extremos del tubo', () => {
  it('montante sin destino: stub de 1 m hacia arriba (z más negativo = más arriba)', () => {
    expect(extremosVerticales('montante', undefined, 0, 0)).toEqual({ baseZ: 0, cimaZ: -1000 });
  });

  it('bajante sin destino: stub de 1 m hacia abajo', () => {
    expect(extremosVerticales('bajante', undefined, 0, 0)).toEqual({ baseZ: 1000, cimaZ: 0 });
  });

  it('la dirección explícita manda sobre el default del tipo', () => {
    expect(extremosVerticales('bajante', 'sube', 0, 0)).toEqual({ baseZ: 0, cimaZ: -1000 });
    expect(extremosVerticales('montante', 'baja', 0, 0)).toEqual({ baseZ: 1000, cimaZ: 0 });
  });

  it('con destino en otro piso: extremos en el z de cada piso', () => {
    expect(extremosVerticales('bajante', 'baja', 0, -2700)).toEqual({
      baseZ: -2700,
      cimaZ: 0,
    });
    expect(extremosVerticales('montante', undefined, -2700, 0)).toEqual({
      baseZ: -2700,
      cimaZ: 0,
    });
  });
});

describe('ladoDelCodo · lado de la vertical que continúa', () => {
  it('la vertical sigue hacia arriba → arco arriba', () => {
    expect(
      ladoDelCodo({ sx: 100, sy: 400 }, { sx: 100, sy: 100 }, { sx: 100, sy: 400 }, false),
    ).toBe('arriba');
  });

  it('la vertical sigue hacia abajo → arco abajo', () => {
    expect(
      ladoDelCodo({ sx: 100, sy: 100 }, { sx: 100, sy: 400 }, { sx: 100, sy: 100 }, false),
    ).toBe('abajo');
  });

  it('empate de distancias: gana el extremo base (mismo criterio de siempre)', () => {
    expect(
      ladoDelCodo({ sx: 100, sy: 450 }, { sx: 100, sy: 350 }, { sx: 100, sy: 400 }, false),
    ).toBe('abajo');
  });

  it('origenId (recibe del piso superior) fuerza arriba aunque la vertical siga abajo', () => {
    expect(
      ladoDelCodo({ sx: 100, sy: 100 }, { sx: 100, sy: 400 }, { sx: 100, sy: 100 }, true),
    ).toBe('arriba');
  });
});

describe('recortaVerticalAlCodo · borra el tramo muerto unión → tangencia', () => {
  it('el extremo base cae en la unión: se mueve R hacia el lado del arco', () => {
    const r = recortaVerticalAlCodo(
      { sx: 100, sy: 400 },
      { sx: 100, sy: 100 },
      { sx: 100, sy: 400 },
      CODO_RADIO,
      'arriba',
    );
    expect(r.base).toEqual({ sx: 100, sy: 400 - CODO_RADIO });
    expect(r.cima).toEqual({ sx: 100, sy: 100 });
  });

  it('el extremo cima cae en la unión: se mueve R hacia abajo (x intacta)', () => {
    const r = recortaVerticalAlCodo(
      { sx: 100, sy: 100 },
      { sx: 100, sy: 400 },
      { sx: 100, sy: 400 },
      CODO_RADIO,
      'abajo',
    );
    expect(r.base).toEqual({ sx: 100, sy: 100 });
    expect(r.cima).toEqual({ sx: 100, sy: 400 + CODO_RADIO });
  });
});

describe('verticalPasaAlOtroLado · tee pasante no se recorta', () => {
  const union = { sx: 400, sy: 400 };

  it('arco abajo + otra vertical llega desde arriba terminando en la unión → pasante', () => {
    expect(verticalPasaAlOtroLado('abajo', union, [{ sx: 400, syMin: -1509, syMax: 400 }])).toBe(
      true,
    );
  });

  it('arco arriba + otra vertical llega desde abajo arrancando en la unión → pasante', () => {
    expect(verticalPasaAlOtroLado('arriba', union, [{ sx: 400, syMin: 400, syMax: 1107 }])).toBe(
      true,
    );
  });

  it('la misma vertical del arco (mismo lado) no cuenta como pasante', () => {
    expect(verticalPasaAlOtroLado('arriba', union, [{ sx: 400, syMin: -307, syMax: 400 }])).toBe(
      false,
    );
    expect(verticalPasaAlOtroLado('abajo', union, [{ sx: 400, syMin: 400, syMax: 1107 }])).toBe(
      false,
    );
  });

  it('otra columna en x distinta o que no toca la unión no cuenta', () => {
    expect(verticalPasaAlOtroLado('abajo', union, [{ sx: 430, syMin: -1509, syMax: 400 }])).toBe(
      false,
    );
    expect(verticalPasaAlOtroLado('abajo', union, [{ sx: 400, syMin: -1509, syMax: 380 }])).toBe(
      false,
    );
  });
});

describe('preparaCodos · un prep por ramal conectado', () => {
  it('dos ramales al mismo bajante (uno por fin, uno por geometría) → dos arcos', () => {
    const { porBajante, porRamal } = preparar(
      [
        ramal(
          'RAF1',
          [
            [300, 100],
            [100, 100],
          ],
          { fin: 'MAF1' },
        ),
        ramal('RAF2', [
          [250, 250],
          [100, 100],
        ]),
      ],
      [bajante('MAF1_af', 'MAF1', { tipo: 'montante' })],
    );
    const preps = porBajante.get('1:MAF1_af')!;
    expect(preps.map((p) => p.ramalId).sort()).toEqual(['RAF1', 'RAF2']);
    // Radio uniforme: el recorte del ramal deja su extremo a R del vértice (escala 1).
    expect(porRamal.get('1:RAF1:1')).toBeCloseTo(CODO_RADIO, 5);
    expect(porRamal.get('1:RAF2:1')).toBeCloseTo(CODO_RADIO, 5);
    for (const p of preps) expect(p.vertex).toEqual({ sx: 100, sy: 100 });
  });

  it('ramal conectado por ini: ladoExtremo 0 y dirección hacia el interior', () => {
    const { porBajante, porRamal } = preparar(
      [
        ramal(
          'RAF3',
          [
            [100, 100],
            [300, 100],
          ],
          { ini: 'MAF1' },
        ),
      ],
      [bajante('MAF1_af', 'MAF1', { tipo: 'montante' })],
    );
    const [prep] = porBajante.get('1:MAF1_af')!;
    expect(prep.ladoExtremo).toBe(0);
    expect(prep.dir.x).toBeCloseTo(1, 5);
    expect(prep.dir.y).toBeCloseTo(0, 5);
    expect(porRamal.get('1:RAF3:0')).toBeCloseTo(CODO_RADIO, 5);
  });

  it('el vértice es la intersección con el tubo, no el extremo crudo del ramal', () => {
    // El ramal termina 5 px a la derecha del tubo: el vértice cae en x=100 y el recorte
    // descuenta esos 5 px (R - 5) para que la tangencia quede exacta.
    const { porBajante, porRamal } = preparar(
      [
        ramal('RAF4', [
          [300, 100],
          [105, 100],
        ]),
      ],
      [bajante('MAF1_af', 'MAF1', { tipo: 'montante' })],
    );
    const [prep] = porBajante.get('1:MAF1_af')!;
    expect(prep.vertex.sx).toBeCloseTo(100, 5);
    expect(prep.vertex.sy).toBeCloseTo(100, 5);
    expect(porRamal.get('1:RAF4:1')).toBeCloseTo(CODO_RADIO - 5, 5);
  });

  it('ignora otros pisos, fantasmas y tipos sin tubo (canal/cajas/equipos)', () => {
    const ramales = [
      ramal(
        'RAF_OTRO_PISO',
        [
          [300, 100],
          [100, 100],
        ],
        { planNivel: 1, fin: 'MAF1' },
      ),
    ];
    const bajantes = [
      bajante('MAF1_af', 'MAF1', { tipo: 'montante' }),
      bajante('FANTASMA', 'FANTASMA', { _isCrossFloorGhost: true }),
      bajante('CANAL1', 'CANAL1', { tipo: 'canal' }),
      bajante('CAJA1', 'CAJA1', { tipo: 'caja_san' }),
    ];
    const { porBajante, porRamal } = preparar(ramales, bajantes);
    expect(porBajante.size).toBe(0);
    expect(porRamal.size).toBe(0);
  });
});

describe('preparaCodos · descarga entre pisos a un RAMAL', () => {
  /** Bajante del piso 1 que descarga en el ramal RAF1 del piso 0 (puntero `planId|ramalId`). */
  function descarga(ptsRamal: number[][], extra: Record<string, unknown> = {}) {
    return preparar(
      [ramal('RAF1', ptsRamal, { planId: '1', planNivel: 0, ...extra })],
      [
        bajante('BAN1', 'BAN1', {
          planId: '2',
          planNivel: 1,
          descargaEnId: '1|RAF1',
        }),
      ],
    );
  }

  it('ramal ALINEADO con la vertical: el tramo horizontal es el ramal y se recorta en su tangencia', () => {
    // El ramal nace justo en la vertical (dEnd = 0): como en el mismo piso, se recorta él.
    const { porBajante, porRamal } = descarga([
      [100, 100],
      [300, 100],
    ]);
    const [prep] = porBajante.get('2:BAN1')!;
    expect(prep.leg).toBe('ramal');
    expect(prep.ladoExtremo).toBe(0);
    expect(prep.vertex).toEqual({ sx: 100, sy: 100 });
    expect(prep.dir.x).toBeCloseTo(1, 5);
    expect(porRamal.get('1:RAF1:0')).toBeCloseTo(CODO_RADIO, 5);
  });

  it('ramal DESALINEADO: el tramo horizontal es el conector y el ramal no se recorta', () => {
    // El ramal arranca 40 px a la derecha: el codo se empalma con el conector recto.
    const { porBajante, porRamal } = descarga([
      [140, 100],
      [300, 100],
    ]);
    const [prep] = porBajante.get('2:BAN1')!;
    expect(prep.leg).toBe('conector');
    expect(prep.dTrimPlane).toBe(0);
    expect(prep.dir.x).toBeCloseTo(1, 5);
    expect(prep.dir.y).toBeCloseTo(0, 5);
    expect(porRamal.size).toBe(0);
  });

  it('conector más corto que el radio: el codo no aporta y se omite', () => {
    // 5 px de conector: el arco de radio 9 no cabe (quedaría una esquina inventada).
    const { porBajante } = descarga([
      [105, 100],
      [300, 100],
    ]);
    expect(porBajante.size).toBe(0);
  });

  it('solo dispara con el puntero de descarga y el planId del ramal correctos', () => {
    // Mismo id de ramal en OTRO plano: no es el destino.
    const { porBajante } = descarga(
      [
        [100, 100],
        [300, 100],
      ],
      { planId: '9' },
    );
    expect(porBajante.size).toBe(0);
  });
});

describe('agrupaCodos · dos esquinas de la misma columna', () => {
  function prep(sx: number, sy: number, ramalId: string): CodoPrep {
    return { vertex: { sx, sy }, dir: { x: 1, y: 0 }, dTrimPlane: 0, ramalId, ladoExtremo: 0 };
  }

  it('vértices a menos de la tolerancia van al mismo grupo; los lejanos a otro', () => {
    const grupos = agrupaCodos([prep(100, 100, 'A'), prep(100, 101, 'B'), prep(100, 400, 'C')]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].map((p) => p.ramalId)).toEqual(['A', 'B']);
    expect(grupos[1].map((p) => p.ramalId)).toEqual(['C']);
  });

  it('un grupo por esquina y cada uno con su unión promedio', () => {
    const grupos = agrupaCodos([prep(100, 100, 'A'), prep(100, 400, 'B'), prep(102, 400, 'C')]);
    expect(unionDeGrupo(grupos[0])).toEqual({ sx: 100, sy: 100 });
    expect(unionDeGrupo(grupos[1])).toEqual({ sx: 101, sy: 400 });
  });
});

describe('unionEnExtremo · el recorte de la vertical solo aplica en un extremo', () => {
  const base = { sx: 100, sy: 400 };
  const cima = { sx: 100, sy: 100 };

  it('unión sobre la base o sobre la cima → extremo', () => {
    expect(unionEnExtremo({ sx: 100, sy: 400 }, base, cima)).toBe(true);
    expect(unionEnExtremo({ sx: 101, sy: 100 }, base, cima)).toBe(true);
  });

  it('unión en medio de la columna → NO es extremo (recortarla acortaría de más)', () => {
    expect(unionEnExtremo({ sx: 100, sy: 250 }, base, cima)).toBe(false);
  });
});

describe('hayVerticalArriba · gate del origenId', () => {
  const union = { sx: 400, sy: 400 };

  it('una vertical dibujada que llega desde arriba habilita el arco hacia arriba', () => {
    expect(hayVerticalArriba(union, [{ sx: 400, syMin: -1509, syMax: 400 }])).toBe(true);
  });

  it('sin vertical arriba (solo la que baja desde la unión) → NO habilita', () => {
    expect(hayVerticalArriba(union, [{ sx: 400, syMin: 400, syMax: 1107 }])).toBe(false);
  });

  it('una vertical en otra x no cuenta', () => {
    expect(hayVerticalArriba(union, [{ sx: 430, syMin: -1509, syMax: 400 }])).toBe(false);
  });
});
