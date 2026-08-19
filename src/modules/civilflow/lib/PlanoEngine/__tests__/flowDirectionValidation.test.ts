import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { codoPolarityOk } from '../PlanoEngineDrawing';
import { ramalExtremoOcupado, extremoEntrelazado } from '../PlanoEngineDrawing';
import { aparatoEnExtremoInvalido } from '../PlanoEngineDrawing';
import { checkRamalAngles } from '../drawingAngles';
import { rootTributarioLabel, allocTributaryNumber } from '../PlanoState';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';
import { setPadreTributario, getRamalesPadre } from '../PlanoEngineNetwork';
import { GAS_ACCESORIOS } from '../../../constants/engineeringDataAccessories';
import { LE_K } from '../../../constants/index';
import { ACC_ABBR } from '../../../utils/accessoryAbbreviations';

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

describe('ítem 10 — tributario anidado: consecutivo contra el ramal RAÍZ', () => {
  const ramales: PlanoRamal[] = [
    mkRamal('RS1', 'san', [
      [0, 0],
      [40, 0],
    ]),
    mkRamal(
      'T1RS1',
      'san',
      [
        [10, 0],
        [10, -10],
      ],
      0,
      'tributario',
      'RS1',
    ),
    mkRamal(
      'T2RS1',
      'san',
      [
        [10, -10],
        [10, -20],
      ],
      0,
      'tributario',
      'T1RS1',
    ),
  ];

  it('rootTributarioLabel resuelve la cadena completa hasta el primer no-tributario', () => {
    expect(rootTributarioLabel(ramales, 'T2RS1')).toBe('RS1');
    expect(rootTributarioLabel(ramales, 'T1RS1')).toBe('RS1');
    expect(rootTributarioLabel(ramales, 'RS1')).toBe('RS1');
    expect(rootTributarioLabel(ramales, null)).toBe('');
  });

  it('el siguiente tributario de un anidado compite con el consecutivo GLOBAL del raíz (T3RS1, no T1T1RS1)', () => {
    // labels usados: RS1, T1RS1, T2RS1 → el primer libre con sufijo RS1 es T3
    expect(allocTributaryNumber({ ramales }, 'RS1')).toBe(3);
  });

  it('una cadena con ciclo (padre que apunta a sí mismo) no cuelga y cae al fallback vacío', () => {
    const cyclic = [...ramales];
    (cyclic[2] as PlanoRamal).padre = cyclic[2].id;
    expect(rootTributarioLabel(cyclic, 'T2RS1')).toBe('');
  });

  it('setPadreTributario acepta un tributario como padre y getRamalesPadre lo lista', () => {
    const { engine } = makeEngine(ramales, [], 'san');
    engine.tipoTramo = 'tributario';
    setPadreTributario(engine, 'T1RS1');
    expect(engine.padreTributario).toBe('T1RS1');
    const candidatos = getRamalesPadre(engine).map((r) => r.id);
    expect(candidatos).toContain('RS1');
    expect(candidatos).toContain('T1RS1');
    // null limpia la selección
    setPadreTributario(engine, null);
    expect(engine.padreTributario).toBeNull();
  });

  it('setPadreTributario ignora ramales de OTRA red activa', () => {
    const mixed = [
      ...ramales,
      mkRamal('RG1', 'gas', [
        [0, 0],
        [10, 0],
      ]),
    ];
    const { engine } = makeEngine(mixed, [], 'san');
    engine.tipoTramo = 'tributario';
    setPadreTributario(engine, 'RG1');
    expect(engine.padreTributario).toBeNull();
  });
});

describe('ítem 7 — variantes de codo gas (estándar/radio largo × horizontal/sube/baja)', () => {
  const CODO_IDS = [
    'codos_90_std',
    'codos_90_std_sube',
    'codos_90_std_baja',
    'codos_90_rl',
    'codos_90_rl_sube',
    'codos_90_rl_baja',
  ];

  it('GAS_ACCESORIOS define las 6 variantes; los ids originales quedan como HORIZONTAL (retrocompatibilidad)', () => {
    const ids = GAS_ACCESORIOS.map((a) => a.id);
    for (const id of CODO_IDS) expect(ids).toContain(id);
    const std = GAS_ACCESORIOS.find((a) => a.id === 'codos_90_std');
    expect(std?.nombre || '').toMatch(/estándar/i);
    expect(std?.nombre || '').toMatch(/horizontal/i);
    const rl = GAS_ACCESORIOS.find((a) => a.id === 'codos_90_rl');
    expect(rl?.nombre || '').toMatch(/radio largo/i);
    expect(rl?.nombre || '').toMatch(/horizontal/i);
  });

  it('LE_K tiene longitud equivalente para las 6 (std=30, rl=20)', () => {
    const le = LE_K as Record<string, number>;
    for (const id of CODO_IDS) expect(typeof le[id]).toBe('number');
    expect(le.codos_90_std_sube).toBe(30);
    expect(le.codos_90_rl_baja).toBe(20);
  });

  it('ACC_ABBR tiene abreviatura para cada variante', () => {
    for (const id of CODO_IDS) expect(ACC_ABBR[id]).toBeTruthy();
    expect(ACC_ABBR.codos_90_std_sube).toBe('C90S_SUB');
    expect(ACC_ABBR.codos_90_rl_baja).toBe('C90L_BAJ');
  });
});

describe('ítem — aparato solo en extremo libre: detección de conexión', () => {
  const lib = (pts: number[][]) => ({ id: 'RAF1', net: 'af', pts });

  it('detecta extremo-a-extremo con otro ramal del mismo net', () => {
    const a = lib([
      [0, 0],
      [2, 0],
    ]);
    const b = {
      id: 'RAF2',
      net: 'af',
      pts: [
        [2, 0],
        [4, 0],
      ],
    };
    expect(ramalExtremoOcupado([a, b], a, [2, 0])).toBe(true);
  });

  it('detecta empalme sobre el CUERPO de otro ramal (tributario sobre el padre)', () => {
    const padre = lib([
      [0, 0],
      [6, 0],
    ]);
    const tri = {
      id: 'T1RAF1',
      net: 'af',
      pts: [
        [3, 0],
        [3, -2],
      ],
    };
    expect(ramalExtremoOcupado([padre, tri], tri, [3, 0])).toBe(true);
  });

  it('detecta vértice INTERMEDIO de otro ramal (ramal que pasa por el punto)', () => {
    const pasa = {
      id: 'RAF3',
      net: 'af',
      pts: [
        [0, 0],
        [3, 0],
        [6, 0],
      ],
    };
    const a = lib([
      [3, 0],
      [3, -2],
    ]);
    expect(ramalExtremoOcupado([pasa, a], a, [3, 0])).toBe(true);
  });

  it('no detecta ramales paralelos sin contacto real (más allá de la tolerancia 0.5)', () => {
    const a = lib([
      [0, 0],
      [6, 0],
    ]);
    const b = {
      id: 'RAF4',
      net: 'af',
      pts: [
        [0, 0.6],
        [6, 0.6],
      ],
    };
    expect(ramalExtremoOcupado([a, b], a, [6, 0])).toBe(false);
  });

  it('ignora ramales de otro net en el mismo punto', () => {
    const a = lib([
      [0, 0],
      [2, 0],
    ]);
    const b = {
      id: 'RS1',
      net: 'san',
      pts: [
        [2, 0],
        [4, 0],
      ],
    };
    expect(ramalExtremoOcupado([a, b], a, [2, 0])).toBe(false);
  });

  it('detecta bajante con desplazamiento (posición dibujada)', () => {
    const a = lib([
      [0, 0],
      [2, 0],
    ]);
    const bj = { id: 'B1', net: 'af', x: 2, y: 0, desplazamientos: { d: { dx: 0.25, dy: 0 } } };
    expect(extremoEntrelazado([a], [bj], a, [2.25, 0])).toBe(true);
  });

  it('aparatoEnExtremoInvalido: aparato en extremo libre con flujo entrante = válido', () => {
    const a = {
      id: 'RAF1',
      net: 'af',
      pts: [
        [0, 0],
        [2, 0],
      ],
      aparatoFin: 'lv',
    };
    expect(aparatoEnExtremoInvalido([a], [], a)).toBe(false);
  });

  it('aparatoEnExtremoInvalido: aparato en extremo conectado a otra red = inválido', () => {
    const a = {
      id: 'RAF1',
      net: 'af',
      pts: [
        [0, 0],
        [2, 0],
      ],
      aparatoInicio: 'lv',
    };
    const b = {
      id: 'RAF2',
      net: 'af',
      pts: [
        [0, 0],
        [0, -1],
      ],
    };
    expect(aparatoEnExtremoInvalido([a, b], [], a)).toBe(true);
  });

  it('aparatoEnExtremoInvalido: flujo en contra del extremo aparatado (invertido) = inválido', () => {
    const a = {
      id: 'RAF1',
      net: 'af',
      pts: [
        [0, 0],
        [2, 0],
      ],
      _tribReversed: true,
      aparatoInicio: 'lv',
    };
    // _tribReversed: el flujo termina en pts[0]; el aparato en pts[0] recibe → válido.
    expect(aparatoEnExtremoInvalido([a], [], a)).toBe(false);
    const b = { ...a, aparatoInicio: undefined, aparatoFin: 'lv' };
    // aparato en pts[last] con flujo terminando en pts[0] → en contra → inválido.
    expect(aparatoEnExtremoInvalido([b], [], b)).toBe(true);
  });
});
