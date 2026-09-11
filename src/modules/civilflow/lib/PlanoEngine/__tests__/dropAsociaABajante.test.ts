import { describe, it, expect } from 'vitest';
import { handleDragUp } from '../handleDragUp';
import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../PlanoState';

// Soltar el extremo de un trazo SOBRE un bajante/caja asocia igual que dibujarlo ahí
// (recibeDeIds + fin). Y entrar a una caja no dispara alerta de ángulo ni rollback.

function makeEngine(
  ramales: PlanoRamal[],
  bajantes: PlanoBajante[],
  alerts: string[],
): IPlanoEngineCore {
  return {
    ramales,
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set<string>(),
    activeNet: 'san',
    tipoTramo: 'ramal',
    _loadedPlanId: '1',
    nivelActual: { label: 'P1', n: 1, npt: 0 } as never,
    _netCounts: { san: { ramal: 10, tributario: 0 } },
    zoom: 1,
    scaleM: 0.5,
    multiSel: [],
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: (t: string, m: string) => {
      alerts.push(`${t}|${m}`);
    },
    toCvs: (x: number, y: number) => ({ x, y }),
    cmToPlanePx: (cm: number) => ((cm / 100) * 96) / (2.54 * 0.5),
  } as unknown as IPlanoEngineCore;
}

const ramal = (o: Partial<PlanoRamal> & { id: string; pts: number[][] }): PlanoRamal =>
  ({
    net: 'san',
    tipo: 'ramal',
    padre: null,
    totalL: 10,
    label: o.id,
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

const bajante = (o: Partial<PlanoBajante> & { id: string; x: number; y: number }): PlanoBajante =>
  ({
    net: 'san',
    tipo: 'bajante',
    code: o.id,
    dNominal: '',
    recibeDeIds: [],
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    ...o,
  }) as unknown as PlanoBajante;

function dropEndpoint(eng: IPlanoEngineCore, ramalId: string, ptIdx: number, backup: number[][]) {
  (eng as unknown as Record<string, unknown>).ptDrag = { id: ramalId, ptIdx, linkedPts: null };
  (eng as unknown as Record<string, unknown>)._dragBackupPts = backup.map((p) => [...p]);
  (eng as unknown as Record<string, unknown>)._dragLinkedBackupPts = null;
  handleDragUp(eng);
}

describe('soltar extremo sobre bajante asocia', () => {
  it('llegada a BAN2 escribe recibeDeIds + fin sin alerta', () => {
    const alerts: string[] = [];
    const ban = bajante({ id: 'BAN2', x: 100, y: 0 });
    const r = ramal({
      id: 'RS7',
      pts: [
        [0, 0],
        [100, 0],
      ],
    });
    const eng = makeEngine([r], [ban], alerts);
    dropEndpoint(eng, 'RS7', 1, [
      [0, 0],
      [50, 0],
    ]);
    expect(alerts).toEqual([]);
    expect(ban.recibeDeIds).toEqual(['RS7']);
    expect(r.fin).toBe('BAN2');
    expect(r.pts).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it('salida desde BAN2 escribe alimentaIds + ini', () => {
    const alerts: string[] = [];
    const ban = bajante({ id: 'BAN2', x: 0, y: 0 });
    const r = ramal({
      id: 'RS7',
      pts: [
        [0, 0],
        [100, 0],
      ],
    });
    const eng = makeEngine([r], [ban], alerts);
    dropEndpoint(eng, 'RS7', 0, [
      [50, 0],
      [100, 0],
    ]);
    expect(alerts).toEqual([]);
    expect(ban.alimentaIds).toEqual(['RS7']);
    expect(r.ini).toBe('BAN2');
  });

  it('extremo ya asociado que se suelta dentro del símbolo no duplica', () => {
    const alerts: string[] = [];
    const ban = bajante({ id: 'BAN2', x: 100, y: 0, recibeDeIds: ['RS7'] });
    const r = ramal({
      id: 'RS7',
      pts: [
        [0, 0],
        [100, 0],
      ],
      fin: 'BAN2',
    });
    const eng = makeEngine([r], [ban], alerts);
    dropEndpoint(eng, 'RS7', 1, [
      [0, 0],
      [90, 0],
    ]);
    expect(alerts).toEqual([]);
    expect(ban.recibeDeIds).toEqual(['RS7']);
    expect(r.fin).toBe('BAN2');
    expect(r.pts).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });
});

describe('soltar en caja no alerta por ángulo', () => {
  it('trazo con quiebre real + extremo en caja: sin alerta, sin rollback, asociado', () => {
    const alerts: string[] = [];
    const caja = bajante({ id: 'CAN1', tipo: 'caja_san', code: 'CAN1', x: 210, y: 100 });
    // Quiebre de ~121° en (60,100) — inválido en san — pero el extremo cae en la caja.
    const r = ramal({
      id: 'RS7',
      pts: [
        [0, 0],
        [60, 100],
        [110, 100],
        [210, 100],
      ],
    });
    const eng = makeEngine([r], [caja], alerts);
    dropEndpoint(eng, 'RS7', 3, [
      [0, 0],
      [60, 100],
      [110, 100],
      [150, 100],
    ]);
    expect(alerts).toEqual([]);
    expect(r.pts).toEqual([
      [0, 0],
      [60, 100],
      [110, 100],
      [210, 100],
    ]);
    expect(caja.recibeDeIds).toEqual(['RS7']);
    expect(r.fin).toBe('CAN1');
  });
});
