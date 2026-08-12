import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { codoPolarityOk } from '../PlanoEngineDrawing';
import { checkRamalAngles } from '../drawingAngles';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Ítems 2, 5, 12, 13: validaciones de dirección de flujo. El bloqueo se verifica por ABAJO:
// finishRamal no debe pushear el ramal violador y debe disparar triggerAlert.

function makeEngine(
  ramales: PlanoRamal[],
  bajantes: PlanoBajante[] = [],
  activeNet = 'san',
): { engine: IPlanoEngineCore; alerts: string[] } {
  const alerts: string[] = [];
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    activeNet,
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { [activeNet]: { ramal: 0, tributario: 0 }, vent: { ramal: 0, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: (t: string, m?: string) => alerts.push(m || t),
    _renumberRamales: () => {},
    _renumberMontantes: () => {},
    _renumberBajantes: () => {},
    _renumberAreas: () => {},
    _emitDelete: () => {},
  };
  return { engine: engine as IPlanoEngineCore, alerts };
}

function mkRamal(
  id: string,
  net: string,
  pts: number[][],
  uc = 0,
  tipo = 'ramal',
  padre: string | null = null,
): PlanoRamal {
  return {
    id,
    net,
    tipo,
    padre,
    pts,
    totalL: 0,
    label: id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    bloqueado: true,
  } as PlanoRamal;
}

function draw(engine: IPlanoEngineCore, net: string, pts: number[][]): void {
  engine.tipoTramo = 'ramal';
  engine.activeRamal = { net, tipo: 'ramal', padre: null, pts, totalL: 0, uc: 0 } as never;
  finishRamal(engine);
}

describe('ítem 2 — bloquear el trazo en dirección contraria (san/ll/vent)', () => {
  it('un ramal san que se une a mitad de cuerpo llegando contra el flujo del padre se bloquea', () => {
    const existing = mkRamal(
      'RS1',
      'san',
      [
        [0, 0],
        [40, 0],
      ],
      5,
    );
    const { engine, alerts } = makeEngine([existing], [], 'san');
    const n = engine.ramales.length;
    // llega desde el lado aguas abajo: flujo (28,-8)→(20,0) = hacia el punto, opuesto al flujo
    // del padre (derecha)
    draw(engine, 'san', [
      [28, -8],
      [20, 0],
    ]);
    expect(engine.ramales).toHaveLength(n); // sin push
    expect(engine.activeRamal).toBeNull(); // aborto limpio
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('un ramal san que CONTINÚA la línea del padre en el mismo sentido se acepta', () => {
    const existing = mkRamal(
      'RS1',
      'san',
      [
        [0, 0],
        [40, 0],
      ],
      5,
    );
    const { engine, alerts } = makeEngine([existing], [], 'san');
    const n = engine.ramales.length;
    draw(engine, 'san', [
      [40, 0],
      [80, 0],
    ]);
    expect(engine.ramales.length).toBe(n + 1);
    expect(alerts.length).toBe(0);
  });
});

describe('ítem 5 — codo reventilado: el vent debe alejarse de la unión', () => {
  it('un vent que llega sobre un punto san (flujo hacia la unión) se bloquea con la alerta', () => {
    const existing = mkRamal(
      'RS1',
      'san',
      [
        [0, 0],
        [40, 0],
      ],
      5,
    );
    const { engine, alerts } = makeEngine([existing], [], 'vent');
    const n = engine.ramales.length;
    // vent dibujado de arriba hacia el punto san: la flecha queda apuntando AL punto
    draw(engine, 'vent', [
      [20, 40],
      [20, 0],
    ]);
    expect(engine.ramales).toHaveLength(n);
    expect(alerts.some((a) => /reventilado/i.test(a))).toBe(true);
  });

  it('un vent que sale desde el punto san (cola en la unión, primer tramo en dirección san) se acepta', () => {
    const existing = mkRamal(
      'RS1',
      'san',
      [
        [0, 0],
        [40, 0],
      ],
      5,
    );
    const { engine, alerts } = makeEngine([existing], [], 'vent');
    const n = engine.ramales.length;
    // cola en (20,0), primer segmento paralelo al san, luego sube — reventilado válido
    draw(engine, 'vent', [
      [20, 0],
      [30, 0],
      [30, 10],
    ]);
    expect(engine.ramales.length).toBe(n + 1);
    expect(alerts.length).toBe(0);
  });
});

describe('ítem 12/13 — polaridad del codo de montante vs dirección de flujo', () => {
  const ramal = mkRamal('R', 'af', [
    [0, 0],
    [40, 0],
  ]);
  it('codoSube (entrega) es válido donde la COLA de la flecha apunta al extremo (el flujo sale) e inválido donde llega', () => {
    expect(codoPolarityOk(ramal, [0, 0], 'codo90rmSube', 0.5)).toBe(true);
    expect(codoPolarityOk(ramal, [40, 0], 'codo90rmSube', 0.5)).toBe(false);
    expect(codoPolarityOk(ramal, [0, 0], 'codoSube', 0.5)).toBe(true);
  });
  it('codoBaja (recibe) es válido donde la CABEZA de la flecha apunta al extremo (el flujo llega) e inválido donde sale', () => {
    expect(codoPolarityOk(ramal, [40, 0], 'codo90rmBaja', 0.5)).toBe(true);
    expect(codoPolarityOk(ramal, [0, 0], 'codo90rmBaja', 0.5)).toBe(false);
    expect(codoPolarityOk(ramal, [40, 0], 'codoBaja', 0.5)).toBe(true);
  });
  it('a mitad de cuerpo (flujo que pasa de largo) ninguno de los dos es válido', () => {
    expect(codoPolarityOk(ramal, [20, 0], 'codo90rmSube', 0.5)).toBe(false);
    expect(codoPolarityOk(ramal, [20, 0], 'codo90rmBaja', 0.5)).toBe(false);
  });
  it('un accesorio sin polaridad (p. ej. sifón) siempre es válido', () => {
    expect(codoPolarityOk(ramal, [40, 0], 'sifon', 0.5)).toBe(true);
  });
  it('codoSube/codoBaja siguen la cabeza/cola lógica aunque _tribReversed invierta el sentido físico', () => {
    // Tributario san/ll: pts físicamente van [0,0]→[40,0] pero la cabeza lógica está en pts[0]
    // porque el flujo va hacia la unión (sentido inverso al físico).
    const trib = mkRamal('RT', 'san', [
      [0, 0],
      [40, 0],
    ]);
    trib._tribReversed = true;
    // sube (entrega): cola lógica en [40,0] (flujo sale de ahí)
    expect(codoPolarityOk(trib, [40, 0], 'codo90rmSube', 0.5)).toBe(true);
    expect(codoPolarityOk(trib, [0, 0], 'codo90rmSube', 0.5)).toBe(false);
    // baja (recibe): cabeza lógica en [0,0] (flujo llega ahí)
    expect(codoPolarityOk(trib, [0, 0], 'codo90rmBaja', 0.5)).toBe(true);
    expect(codoPolarityOk(trib, [40, 0], 'codo90rmBaja', 0.5)).toBe(false);
  });
});

describe('ítem 6 — tolerancias de ángulo exactas (ANGLE_EPS ±0.5°)', () => {
  it('san: un giro interno de 45° (135°) se acepta; uno de 47° (133°) se rechaza', () => {
    const turn45: number[][] = [
      [0, 0],
      [10, 0],
      [17.071, -7.071],
    ];
    const turn47: number[][] = [
      [0, 0],
      [10, 0],
      [16.82, -7.314],
    ];
    expect(checkRamalAngles(turn45, 'san')).toBe(true);
    expect(checkRamalAngles(turn47, 'san')).toBe(false);
  });
  it('san: un giro de 90° se rechaza (solo 180°/135°)', () => {
    expect(
      checkRamalAngles(
        [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
        'san',
      ),
    ).toBe(false);
  });
  it('af: un segmento a 45° se acepta; a 47° se rechaza', () => {
    expect(
      checkRamalAngles(
        [
          [0, 0],
          [10, 10],
        ],
        'af',
      ),
    ).toBe(true);
    expect(
      checkRamalAngles(
        [
          [0, 0],
          [10, 10.72],
        ],
        'af',
      ),
    ).toBe(false);
  });
  it('gas: segmento a 90° se acepta; a 44° se rechaza (paso 90°)', () => {
    expect(
      checkRamalAngles(
        [
          [0, 0],
          [0, 10],
        ],
        'gas',
      ),
    ).toBe(true);
    expect(
      checkRamalAngles(
        [
          [0, 0],
          [7.2, 7.2],
        ],
        'gas',
      ),
    ).toBe(false);
  });
});
