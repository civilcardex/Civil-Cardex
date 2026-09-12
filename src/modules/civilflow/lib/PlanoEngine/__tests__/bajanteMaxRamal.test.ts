import { describe, it, expect } from 'vitest';
import { bumpBajanteToMaxRamal, followBajanteToMaxRamal } from '../drawingUtils';
import { updateSelected } from '../PlanoEngineSelection';
import { autoSplitJunctionAndSumFlow } from '../junctionAutoSplit';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// El bajante toma por defecto el mayor diámetro de sus ramales (solo sube, nunca baja).
describe('bumpBajanteToMaxRamal', () => {
  const ramales = [
    { id: 'RS1', diametro: '4"' },
    { id: 'RS2', diametro: '2"' },
    { id: 'RS3', diametro: '' },
  ];
  it('sube al mayor asociado cuando está vacío', () => {
    expect(bumpBajanteToMaxRamal(ramales, ['RS1', 'RS2'], '')).toBe('4"');
  });
  it('sube cuando el actual es menor', () => {
    expect(bumpBajanteToMaxRamal(ramales, ['RS1', 'RS2'], '2"')).toBe('4"');
  });
  it('no cambia cuando el actual ya es mayor o igual', () => {
    expect(bumpBajanteToMaxRamal(ramales, ['RS1'], '4"')).toBeNull();
    expect(bumpBajanteToMaxRamal(ramales, ['RS2'], '6"')).toBeNull();
  });
  it('ignora ramales sin diámetro o inexistentes', () => {
    expect(bumpBajanteToMaxRamal(ramales, ['RS3', 'ZZ'], '')).toBeNull();
    expect(bumpBajanteToMaxRamal(ramales, [], '')).toBeNull();
  });
});

describe('followBajanteToMaxRamal — sigue al máximo en ambas direcciones', () => {
  const ramales = [
    { id: 'RS1', diametro: '2"' },
    { id: 'RS2', diametro: '2"' },
  ];
  it('sigue hacia abajo cuando bajan todos', () => {
    // B1 en 4" siguiendo a RS1 4" → RS1 baja a 2", RS2 en 2": B1 queda en 2".
    expect(followBajanteToMaxRamal(ramales, ['RS1', 'RS2'], '4"', 'RS1', '4"', '2"')).toBe('2"');
  });
  it('sigue hacia arriba', () => {
    expect(followBajanteToMaxRamal(ramales, ['RS1', 'RS2'], '2"', 'RS1', '2"', '4"')).toBe('4"');
  });
  it('no baja del otro ramal mayor', () => {
    const rr = [
      { id: 'RS1', diametro: '2"' },
      { id: 'RS2', diametro: '4"' },
    ];
    expect(followBajanteToMaxRamal(rr, ['RS1', 'RS2'], '4"', 'RS1', '4"', '2"')).toBeNull();
  });
  it('oversize explícito se conserva salvo que el nuevo máximo lo supere', () => {
    expect(followBajanteToMaxRamal(ramales, ['RS1', 'RS2'], '6"', 'RS1', '4"', '2"')).toBeNull();
    expect(followBajanteToMaxRamal(ramales, ['RS1', 'RS2'], '6"', 'RS1', '2"', '8"')).toBe('8"');
  });
  it('vacío toma el nuevo máximo', () => {
    expect(followBajanteToMaxRamal(ramales, ['RS1'], '', 'RS1', '', '2"')).toBe('2"');
  });
});

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: 'RS1',
    activeNet: 'san',
    tipoTramo: 'ramal',
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: 'PVC-S', diametro: '', pendiente: 2 },
    _netCounts: {
      san: { ramal: 1, tributario: 1 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
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
    triggerAlert: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
  };
  return engine as IPlanoEngineCore;
}

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
    ],
    totalL: 0,
    label: 'RS1',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 20,
    labelY: 0,
    labelAngle: 0,
    material: 'PVC-S',
    diametro: '2"',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

const B = (o: Partial<PlanoBajante>): PlanoBajante =>
  ({
    id: 'B1',
    net: 'san',
    tipo: 'bajante',
    code: 'B1',
    x: 40,
    y: 0,
    dNominal: '2"',
    recibeDeIds: ['RS1'],
    ...o,
  }) as unknown as PlanoBajante;

describe('bajante sigue al mayor ramal al cambiar diámetros', () => {
  it('updateSelected (panel) sube el bajante al cambiar el ramal', () => {
    const eng = makeEngine([R({})], [B({})]);
    updateSelected(eng, { diametro: '4"' });
    expect(eng.ramales[0].diametro).toBe('4"');
    expect(eng.bajantes[0].dNominal).toBe('4"');
  });

  it('updateSelected (panel) baja el bajante si baja el máximo', () => {
    const eng = makeEngine([R({ diametro: '4"' })], [B({ dNominal: '4"' })]);
    updateSelected(eng, { diametro: '2"' });
    expect(eng.ramales[0].diametro).toBe('2"');
    expect(eng.bajantes[0].dNominal).toBe('2"');
  });

  it('updateSelected conserva el oversize explícito del bajante', () => {
    const eng = makeEngine(
      [R({ id: 'RS1', diametro: '4"' }), R({ id: 'RS2', diametro: '2"' })],
      [B({ dNominal: '6"', recibeDeIds: ['RS1', 'RS2'] })],
    );
    eng.selId = 'RS1';
    updateSelected(eng, { diametro: '2"' });
    expect(eng.bajantes[0].dNominal).toBe('6"');
  });

  it('split mueve la asociación al downstream y sube al mayor', () => {
    const rs1 = R({ diametro: '2"' });
    const trib = R({
      id: 'T1RS1',
      tipo: 'tributario',
      padre: 'RS1',
      pts: [
        [20, -20],
        [20, 0],
      ],
      label: 'T1RS1',
      diametro: '4"',
    });
    const eng = makeEngine([rs1, trib], [B({})]);
    autoSplitJunctionAndSumFlow(eng, trib);
    const downstream = eng.ramales.find((r) => r.mergesFrom?.[1] === 'T1RS1');
    expect(downstream).toBeDefined();
    expect(downstream!.diametro).toBe('4"');
    const baj = eng.bajantes[0];
    expect(baj.recibeDeIds).toContain(downstream!.id);
    expect(baj.dNominal).toBe('4"');
  });
});

describe('pushBajanteDiameterToRamales — el bajante arrastra al ramal y nunca queda debajo', () => {
  it('subir el bajante 2"→4" sube el ramal asociado', () => {
    const eng = makeEngine([R({})], [B({})]);
    eng.selId = 'B1';
    updateSelected(eng, { dNominal: '4"' });
    expect(eng.bajantes[0].dNominal).toBe('4"');
    expect(eng.ramales[0].diametro).toBe('4"');
  });

  it('bajar el bajante bajo el ramal se bloquea con alerta (primero el ramal)', () => {
    const alerts: string[] = [];
    const eng = makeEngine([R({ diametro: '4"' })], [B({ dNominal: '4"' })]);
    eng.triggerAlert = ((t: string, m: string) => alerts.push(`${t}|${m}`)) as never;
    eng.selId = 'B1';
    updateSelected(eng, { dNominal: '2"' });
    expect(alerts.length).toBeGreaterThan(0);
    expect(eng.bajantes[0].dNominal).toBe('4"');
    expect(eng.ramales[0].diametro).toBe('4"');
  });

  it('bajar el bajante sin quedar debajo se permite y arrastra al menor', () => {
    const eng = makeEngine(
      [R({ id: 'RS1', diametro: '4"' }), R({ id: 'RS2', diametro: '2"' })],
      [B({ dNominal: '6"', recibeDeIds: ['RS1', 'RS2'] })],
    );
    eng.selId = 'B1';
    updateSelected(eng, { dNominal: '4"' });
    expect(eng.bajantes[0].dNominal).toBe('4"');
    expect(eng.ramales.find((r) => r.id === 'RS1')!.diametro).toBe('4"');
    expect(eng.ramales.find((r) => r.id === 'RS2')!.diametro).toBe('4"');
  });

  it('ramal vacío no se rellena solo', () => {
    const eng = makeEngine([R({ diametro: '' })], [B({ dNominal: '2"' })]);
    eng.selId = 'B1';
    updateSelected(eng, { dNominal: '4"' });
    expect(eng.bajantes[0].dNominal).toBe('4"');
    expect(eng.ramales[0].diametro).toBe('');
  });

  it('otras redes no se tocan', () => {
    const eng = makeEngine(
      [R({ net: 'af', diametro: '2"' })],
      [B({ net: 'af', dNominal: '2"', recibeDeIds: ['RS1'] })],
    );
    eng.selId = 'B1';
    updateSelected(eng, { dNominal: '4"' });
    expect(eng.bajantes[0].dNominal).toBe('4"');
    expect(eng.ramales[0].diametro).toBe('2"');
  });
});
