import { describe, expect, it } from 'vitest';
import { puedeConectarRamalABajante, asociadosDeBajante } from '../bajanteRules';
import { finishRamal } from '../finishRamal';
import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../PlanoState';

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[] = []): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    textAnnots: [],
    areas: [],
    guideLines: [],
    selId: null,
    activeNet: 'san',
    zoom: 1,
    _loadedPlanId: 1,
    _hiddenNets: new Set(),
    _netCounts: {
      san: { ramal: 5, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    toPlane: (x, y) => ({ x, y }),
    toCvs: (x, y) => ({ x, y }),
    pxToM: (px: number) => px,
    render: () => {},
    _markDirty: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    triggerAlert: () => {},
    getBajantesFantasma: () => [],
    nivelActual: { label: 'P1', n: 1, npt: 0 } as never,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    triggerAccesorioModal: undefined as never,
  };
  return engine as IPlanoEngineCore;
}
const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'R',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [10, 0],
    ],
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
    diametro: '2"',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;
const B = (o: Partial<PlanoBajante>): PlanoBajante =>
  ({
    id: 'BAN1',
    net: 'san',
    tipo: 'bajante',
    code: 'BAN1',
    x: 0,
    y: 0,
    pisoBase: 'P1',
    pisoCima: 'P1',
    nptBase: 0,
    nptCima: 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: 0,
    labelY: 20,
    bajR: 7 / 24,
    ...o,
  }) as unknown as PlanoBajante;

describe('bajanteRules — tope de asociaciones (ítems 1/9)', () => {
  it('bajante con 2 ramales: el tercero es rechazado', () => {
    const baj = B({ recibeDeIds: ['RS1', 'RS2'] });
    const check = puedeConectarRamalABajante(baj, R({ id: 'RS3' }));
    expect(check.ok).toBe(false);
    expect(check.msg).toContain('máximo permitido');
  });

  it('caja con 1 ramal: el segundo es rechazado con su mensaje propio', () => {
    const caja = B({ tipo: 'caja_san', code: 'CAN1', id: 'CAN1', recibeDeIds: ['RS1'] });
    const check = puedeConectarRamalABajante(caja, R({ id: 'RS2' }));
    expect(check.ok).toBe(false);
    expect(check.msg).toContain('caja');
    // Y la caja llena cuenta AMBOS sentidos (alimenta + recibe)
    const caja2 = B({
      tipo: 'caja_ll',
      code: 'CALL1',
      id: 'CALL1',
      recibeDeIds: [],
      alimentaIds: ['RALL1'],
    });
    expect(puedeConectarRamalABajante(caja2, R({ id: 'RS9', net: 'll' })).ok).toBe(false);
  });

  it('un tributario NO puede llegar ni salir del bajante (regla solo-ramales)', () => {
    const baj = B({});
    const check = puedeConectarRamalABajante(baj, R({ id: 'T1RS1', tipo: 'tributario' }));
    expect(check.ok).toBe(false);
    expect(check.msg).toContain('Solo los ramales');
    // Y redes distintas tampoco.
    expect(puedeConectarRamalABajante(baj, R({ id: 'RAF1', net: 'af' })).ok).toBe(false);
  });

  it('inicio de ramal EN bajante permitido: finishRamal asocia vía alimentaIds + r.ini', () => {
    // activeRamal nace en [20,0] donde vive BAN1 y termina lejos — el extremo pts[0] es inicio.
    const baj = B({ x: 20, y: 0 });
    const eng = makeEngine([], [baj]);
    eng.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 0],
        [60, 0],
      ],
    } as never;
    finishRamal(eng);
    const r = eng.ramales[0];
    expect(baj.alimentaIds).toContain(r.id);
    expect(r.ini).toBe('BAN1');
    expect(baj.recibeDeIds).not.toContain(r.id);
    expect(r.fin).toBe('');
  });

  it('asociadosDeBajante une ambos sentidos sin duplicados', () => {
    const baj = B({ recibeDeIds: ['RS1'], alimentaIds: ['RS1', 'RS2'] });
    expect(asociadosDeBajante(baj)).toEqual(new Set(['RS1', 'RS2']));
  });
});
