import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { codoPolarityOk } from '../PlanoEngineDrawing';
import { aparatoEnExtremoInvalido } from '../PlanoEngineDrawing';
import { checkRamalAngles } from '../drawingAngles';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

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

describe('dirección de flujo — canónicos', () => {
  it('san: un ramal que cae a mitad de cuerpo SÍ se splitea (crea T), sin alerta de flujo', () => {
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
    // Rama que llega con flujo a favor del tronco (vector 8,8 dot 1,0 >0) — debe partir sin alerta.
    draw(engine, 'san', [
      [12, -8],
      [20, 0],
    ]);
    // El ramal que aterriza en el cuerpo parte a RS1 (crea la T) en lugar de bloquearse —
    // la dirección se auto-orienta en el split para tributarios; para ramales a favor no hay bloqueo.
    expect(engine.ramales.length).toBeGreaterThanOrEqual(3);
    expect(alerts.some((a) => /dirección/i.test(a))).toBe(false);
  });

  it('san: ramal contra flujo en T se bloquea', () => {
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
    draw(engine, 'san', [
      [28, -8],
      [20, 0],
    ]);
    expect(alerts.some((a) => /dirección/i.test(a))).toBe(true);
    expect(engine.ramales.length).toBe(1);
  });

  it('vent que llega al CUERPO de san NO dispara alerta de reventilado (Item 4)', () => {
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
    draw(engine, 'vent', [
      [20, 40],
      [20, 0],
    ]);
    // Item 4: vent conectado al CUERPO (no extremo) del san es conexión válida —
    // no debe aparecer la alerta de dirección de flujo, y el ramal se crea.
    expect(engine.ramales).toHaveLength(n + 1);
    expect(alerts.some((a) => /reventilado/i.test(a))).toBe(false);
  });

  it('vent que llega al EXTREMO de san se auto-orienta (ya no se bloquea)', () => {
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
    // Vent dibujado de afuera hacia el EXTREMO [0,0] del san: se invierte solo para fluir
    // alejándose (reventilado) en vez de bloquearse — orig. usuario, falsa alerta.
    draw(engine, 'vent', [
      [0, 40],
      [0, 0],
    ]);
    expect(engine.ramales).toHaveLength(n + 1);
    const vent = engine.ramales[engine.ramales.length - 1];
    expect(vent.pts[0]).toEqual([0, 0]);
    expect(alerts.some((a) => /reventilado/i.test(a))).toBe(false);
  });

  it('vent arrancando del EXTREMO de san en línea recta NO dispara alerta de ángulo', () => {
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
    // El vent continúa la línea del san (ángulo entre líneas 0°) — en el EXTREMO
    // no se valida ángulo: es una conexión válida.
    draw(engine, 'vent', [
      [0, 0],
      [-20, 0],
    ]);
    expect(engine.ramales).toHaveLength(n + 1);
    expect(alerts.some((a) => /ángulo|reventilado|dirección/i.test(a))).toBe(false);
  });

  it('vent en Y a 45° sobre el cuerpo de san (135° entre vectores de flujo) se permite', () => {
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
    // Vent nace del cuerpo en 135° respecto del flujo del san — ángulo de LÍNEA
    // = 45° (|cos| pliega) → Y válida.
    draw(engine, 'vent', [
      [20, 0],
      [5.858, 14.142],
    ]);
    expect(engine.ramales).toHaveLength(n + 1);
    expect(alerts.some((a) => /ángulo|reventilado|dirección/i.test(a))).toBe(false);
  });

  it('vent multi-segmento saliendo en Y (45°) de san NO dispara dirección de flujo', () => {
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
    // Primer trazo sale de san en 45° (Y válida), luego un segundo segmento dobla.
    draw(engine, 'vent', [
      [20, 0],
      [27.071, -7.071],
      [34.142, -7.071],
    ]);
    expect(engine.ramales).toHaveLength(n + 1);
    expect(alerts.some((a) => /dirección|reventilado/i.test(a))).toBe(false);
  });

  it('vent multi-segmento saliendo perpendicular (codo reventilado) de san NO dispara dirección de flujo', () => {
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
    // Primer trazo sale perpendicular (90°) del san — codo reventilado válido.
    draw(engine, 'vent', [
      [20, 0],
      [20, -10],
      [30, -10],
    ]);
    expect(engine.ramales).toHaveLength(n + 1);
    expect(alerts.some((a) => /dirección|reventilado/i.test(a))).toBe(false);
  });

  it('codoSube válido en cola del flujo e inválido en cabeza', () => {
    const ramal = mkRamal('R', 'af', [
      [0, 0],
      [40, 0],
    ]);
    expect(codoPolarityOk(ramal, [0, 0], 'codo90rmSube', 0.5)).toBe(true);
    expect(codoPolarityOk(ramal, [40, 0], 'codo90rmSube', 0.5)).toBe(false);
  });

  it('san: giro interno 45° (135°) se acepta', () => {
    const turn45: number[][] = [
      [0, 0],
      [10, 0],
      [17.071, -7.071],
    ];
    expect(checkRamalAngles(turn45, 'san')).toBe(true);
  });

  it('aparato solo en extremo libre — extremo conectado es inválido', () => {
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
    expect(
      aparatoEnExtremoInvalido([a, b] as unknown as PlanoRamal[], [], a as unknown as PlanoRamal),
    ).toBe(true);
  });
});
