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
    draw(engine, 'san', [
      [28, -8],
      [20, 0],
    ]);
    // El ramal que aterriza en el cuerpo parte a RS1 (crea la T) en lugar de bloquearse —
    // la dirección se auto-orienta en el split.
    expect(engine.ramales.length).toBeGreaterThanOrEqual(3);
    expect(alerts.some((a) => /dirección/i.test(a))).toBe(false);
  });

  it('vent que llega hacia unión san se bloquea', () => {
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
    expect(engine.ramales).toHaveLength(n);
    expect(alerts.some((a) => /reventilado/i.test(a))).toBe(true);
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
