import { describe, it, expect } from 'vitest';
import { updateElementById, updateSelected } from '../PlanoEngineSelectionEdit';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Montante af/ac: el diámetro va ligado al ramal conectado — nunca queda por debajo
// (misma verificación que bajantes/ramales sanitarios: alerta modal y no permite),
// y al subir arrastra a los ramales con diámetro menor.

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[]) {
  const alertas: { titulo: string; msg: string }[] = [];
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    activeNet: 'af',
    tipoTramo: 'ramal',
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: 'PVC-S', diametro: '', pendiente: 2 },
    _netCounts: {
      san: { ramal: 0, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 1, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    zoom: 1,
    _hiddenNets: new Set(),
    pxToM: (px) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: (t, m) => {
      alertas.push({ titulo: t, msg: m });
    },
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
  };
  return { engine: engine as IPlanoEngineCore, alertas };
}

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'RAF1',
    net: 'af',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
    ],
    totalL: 0,
    label: 'RAF1',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 20,
    labelY: 0,
    labelAngle: 0,
    material: 'PVC-S',
    diametro: '1/2"',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

const M = (o: Partial<PlanoBajante>): PlanoBajante =>
  ({
    id: 'MON1',
    net: 'af',
    tipo: 'montante',
    code: 'MON1',
    x: 40,
    y: 0,
    dNominal: '1/2"',
    recibeDeIds: [],
    alimentaIds: [],
    ...o,
  }) as unknown as PlanoBajante;

describe('montante af: diámetro ligado al ramal conectado', () => {
  it('updateElementById rechaza el montante por debajo del ramal (alerta + no permite)', () => {
    const { engine, alertas } = makeEngine(
      [R({ diametro: '3/4"' })],
      [M({ dNominal: '3/4"', alimentaIds: ['RAF1'] })],
    );
    updateElementById(engine, 'MON1', { dNominal: '1/2"' });
    expect(engine.bajantes[0].dNominal).toBe('3/4"');
    expect(
      alertas.some((a) => a.titulo === 'Diámetro no permitido' && a.msg.includes('montante')),
    ).toBe(true);
  });

  it('subir el montante arrastra al ramal (mismo diámetro)', () => {
    const { engine, alertas } = makeEngine(
      [R({ diametro: '1/2"' })],
      [M({ dNominal: '1/2"', alimentaIds: ['RAF1'] })],
    );
    updateElementById(engine, 'MON1', { dNominal: '3/4"' });
    expect(engine.bajantes[0].dNominal).toBe('3/4"');
    expect(engine.ramales[0].diametro).toBe('3/4"');
    expect(alertas).toHaveLength(0);
  });

  it('subir el ramal (vía alimentaIds) sigue subiendo al montante', () => {
    const { engine } = makeEngine(
      [R({ diametro: '1/2"' })],
      [M({ dNominal: '1/2"', alimentaIds: ['RAF1'] })],
    );
    engine.selId = 'RAF1';
    updateSelected(engine, { diametro: '3/4"' });
    expect(engine.ramales[0].diametro).toBe('3/4"');
    expect(engine.bajantes[0].dNominal).toBe('3/4"');
  });

  it('subir el montante NO arrastra a los ramales de recibeDeIds (aguas arriba jamás)', () => {
    // Doctrina unificada con convergirDiametroNodoPresion: el push del montante solo baja
    // por alimentaIds (nacen en él). RAF1 LLEGA al montante (recibeDeIds) — conserva 1/2".
    const { engine, alertas } = makeEngine(
      [
        R({ id: 'RAF1', label: 'RAF1', diametro: '1/2"', fin: 'MON1' }),
        R({ id: 'RAF3', label: 'RAF3', diametro: '1/2"', ini: 'MON1' }),
      ],
      [M({ dNominal: '1/2"', recibeDeIds: ['RAF1'], alimentaIds: ['RAF3'] })],
    );
    updateElementById(engine, 'MON1', { dNominal: '3"' });
    expect(engine.bajantes[0].dNominal).toBe('3"');
    expect(engine.ramales.find((r) => r.id === 'RAF3')!.diametro).toBe('3"');
    expect(engine.ramales.find((r) => r.id === 'RAF1')!.diametro).toBe('1/2"');
    expect(alertas).toHaveLength(0);
  });

  it('el rechazo del bajante sanitario sigue funcionando (regresión del gate)', () => {
    const rs1 = R({ id: 'RS1', net: 'san', label: 'RS1', diametro: '4"' });
    const b1: PlanoBajante = {
      ...(M({}) as object),
      id: 'B1',
      net: 'san',
      tipo: 'bajante',
      code: 'B1',
      dNominal: '2"',
      recibeDeIds: ['RS1'],
      alimentaIds: [],
    } as unknown as PlanoBajante;
    const { engine, alertas } = makeEngine([rs1], [b1]);
    updateElementById(engine, 'B1', { dNominal: '2"' });
    expect(engine.bajantes[0].dNominal).toBe('2"');
    expect(alertas.length).toBeGreaterThan(0);
  });
});
