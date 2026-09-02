import { describe, it, expect, beforeAll } from 'vitest';
import { updateElementById } from '../PlanoEngineSelection';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// updateCrossFloorGhostFieldBySource (invocado por updateElementById al cambiar
// dNominal) itera localStorage — en environment 'node' no existe. Stub vacío.
beforeAll(() => {
  (globalThis as Record<string, unknown>).localStorage = {
    length: 0,
    key: () => null,
  };
});

function mkRamal(id: string, net: string, pts: number[][], diametro = ''): PlanoRamal {
  return {
    id,
    net,
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label: id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    nSalidas: 1,
    material: '',
    diametro,
    bloqueado: false,
    showLength: true,
    showName: true,
    showGuide: true,
  } as PlanoRamal;
}

function mkBaj(
  id: string,
  net: string,
  x: number,
  y: number,
  dNominal: string,
  recibeDeIds: string[] = [],
): PlanoBajante {
  return {
    id,
    net,
    tipo: 'bajante',
    code: id,
    x,
    y,
    pisoBase: 'P2',
    pisoCima: 'P2',
    nptBase: 0,
    nptCima: 0,
    hVert: 0,
    dNominal,
    recibeDeIds,
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: x,
    labelY: y + 20,
  } as PlanoBajante;
}

// Topología espejo del plano reportado: dos bajantes de ventilación (REV2, REV3)
// conectados al MISMO bajante sanitario (BAN1) vía cadena
// vent bajante → vent ramal → san ramal → san bajante.
function makeScene(): {
  engine: IPlanoEngineCore;
  rev2: PlanoBajante;
  rev3: PlanoBajante;
  rev4: PlanoBajante;
} {
  const ramales: PlanoRamal[] = [
    mkRamal('RS1', 'san', [
      [0, 0],
      [40, 0],
    ]),
    mkRamal('RS2', 'san', [
      [80, 0],
      [40, 0],
    ]),
    mkRamal('V1', 'vent', [
      [0, 0],
      [0, 20],
    ]),
    mkRamal('V2', 'vent', [
      [80, 0],
      [80, 20],
    ]),
    mkRamal('V3', 'vent', [
      [120, 0],
      [120, 20],
    ]),
  ];
  const ban1 = mkBaj('BAN1', 'san', 40, 0, '4"', ['RS1', 'RS2']);
  const ban2 = mkBaj('BAN2', 'san', 120, 0, '4"', ['RS3']);
  const rev2 = mkBaj('REV2', 'vent', 0, 20, '2"', ['V1']);
  const rev3 = mkBaj('REV3', 'vent', 80, 20, '3"', ['V2']);
  const rev4 = mkBaj('REV4', 'vent', 120, 20, '2"', ['V3']);
  const engine = {
    ramales,
    bajantes: [ban1, ban2, rev2, rev3, rev4],
    nivelActual: { label: 'P2', n: 2, npt: 0 },
    _loadedPlanId: 'p1',
    triggerAlert: () => {},
    render: () => {},
    _emitSelect: () => {},
    _markDirty: () => {},
  } as unknown as IPlanoEngineCore;
  return { engine, rev2, rev3, rev4 };
}

describe('sincronización de diámetros entre bajantes de ventilación (Item 2)', () => {
  it('cambiar REV2 propaga a REV3 (mismo san bajante por cadena de ramales)', () => {
    const { engine, rev2, rev3 } = makeScene();
    updateElementById(engine, rev2.id, { dNominal: '4"' });
    expect(rev2.dNominal).toBe('4"');
    expect(rev3.dNominal).toBe('4"');
  });

  it('cambiar REV3 propaga a REV2 (independientemente de cuál se modifique)', () => {
    const { engine, rev2, rev3 } = makeScene();
    updateElementById(engine, rev3.id, { dNominal: '6"' });
    expect(rev3.dNominal).toBe('6"');
    expect(rev2.dNominal).toBe('6"');
  });

  it('REV4 (otro san bajante) NO se ve afectado', () => {
    const { engine, rev2, rev4 } = makeScene();
    updateElementById(engine, rev2.id, { dNominal: '3"' });
    expect(rev4.dNominal).toBe('2"');
  });

  it('diamPulg del sincronizado queda coherente con dNominal', () => {
    const { engine, rev2, rev3 } = makeScene();
    updateElementById(engine, rev2.id, { dNominal: '4"' });
    expect(rev3.diamPulg).toBe(4);
  });

  // Caso real del plano reportado: el bajante san se montó sobre el CUERPO del
  // ramal san (split). Las mitades no están en recibeDeIds ni tienen ini/fin —
  // solo comparten posición con el bajante. La resolución debe caminar aguas
  // abajo por geometría.
  it('sync funciona cuando el bajante partió el ramal san por el cuerpo (split)', () => {
    const ramales: PlanoRamal[] = [
      mkRamal('RS1', 'san', [
        [0, 0],
        [40, 0],
      ]),
      mkRamal('rX2', 'san', [
        [80, 0],
        [40, 0],
      ]),
      mkRamal('V1', 'vent', [
        [0, 0],
        [0, 20],
      ]),
      mkRamal('V2', 'vent', [
        [80, 0],
        [80, 20],
      ]),
    ];
    const ban1 = mkBaj('BAN1', 'san', 40, 0, '4"', []);
    const rev2 = mkBaj('REV2', 'vent', 0, 20, '2"', ['V1']);
    const rev3 = mkBaj('REV3', 'vent', 80, 20, '3"', ['V2']);
    const engine = {
      ramales,
      bajantes: [ban1, rev2, rev3],
      nivelActual: { label: 'P2', n: 2, npt: 0 },
      _loadedPlanId: 'p1',
      triggerAlert: () => {},
      render: () => {},
      _emitSelect: () => {},
      _markDirty: () => {},
    } as unknown as IPlanoEngineCore;
    updateElementById(engine, rev2.id, { dNominal: '4"' });
    expect(rev3.dNominal).toBe('4"');
    // y en el otro sentido
    updateElementById(engine, rev3.id, { dNominal: '3"' });
    expect(rev2.dNominal).toBe('3"');
  });
});
