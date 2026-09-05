import { describe, it, expect } from 'vitest';
import { finishRamal } from '../finishRamal';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Vent recién dibujado que TERMINA en san (de afuera hacia adentro) se auto-orienta para
// fluir alejándose de la unión — antes disparaba "Dirección de flujo incorrecta" aunque el
// trazo conectaba bien (orig. usuario, alerta reventilado).
function makeEngine(ramales: PlanoRamal[], bajantes: IPlanoEngineCore['bajantes'] = []) {
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
    activeNet: 'vent',
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: 'PVC-V', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 1, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    zoom: 1,
    snapMode: true,
    _hiddenNets: new Set(),
    pxToM: (px) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: (t: string, m: string) => alerts.push(t + '|' + m),
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
  };
  (engine as unknown as { alerts: string[] }).alerts = alerts;
  return engine as IPlanoEngineCore;
}

const alertsOf = (eng: IPlanoEngineCore): string[] =>
  (eng as unknown as { alerts: string[] }).alerts;

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'R',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [],
    totalL: 0,
    label: 'R',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

function drawVent(eng: IPlanoEngineCore, pts: number[][]) {
  eng.activeRamal = { net: 'vent', tipo: 'ramal', pts } as never;
  finishRamal(eng);
  return eng.ramales.find((r) => r.net === 'vent' && r.id !== 'V0');
}

describe('vent dibujado hacia el san se auto-orienta', () => {
  it('termina en extremo san: se invierte solo, sin alerta', () => {
    const san = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [80, 0],
      ],
    });
    const eng = makeEngine([san]);
    const vent = drawVent(eng, [
      [80, -50],
      [80, 0],
    ]);
    expect(vent).toBeDefined();
    // Ahora nace en el punto sanitario y fluye hacia afuera.
    expect(vent!.pts[0]).toEqual([80, 0]);
    expect(vent!.pts[vent!.pts.length - 1]).toEqual([80, -50]);
    expect(alertsOf(eng).some((a) => a.startsWith('Dirección de flujo incorrecta'))).toBe(false);
  });

  it('nace en el san: no se toca', () => {
    const san = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [80, 0],
      ],
    });
    const eng = makeEngine([san]);
    const vent = drawVent(eng, [
      [80, 0],
      [80, -50],
    ]);
    expect(vent).toBeDefined();
    expect(vent!.pts[0]).toEqual([80, 0]);
    expect(alertsOf(eng).some((a) => a.startsWith('Dirección de flujo incorrecta'))).toBe(false);
  });

  it('termina en su propio bajante (stack): no se invierte', () => {
    const san = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [80, 0],
      ],
    });
    const eng = makeEngine(
      [san],
      [{ id: 'V1', net: 'vent', tipo: 'bajante', x: 80, y: -50, recibeDeIds: [] } as never],
    );
    const vent = drawVent(eng, [
      [80, 0],
      [80, -50],
    ]);
    expect(vent).toBeDefined();
    // Terminar en el stack vent es correcto: se conserva el orden dibujado.
    expect(vent!.pts[0]).toEqual([80, 0]);
  });
});
