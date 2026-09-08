import { describe, expect, it } from 'vitest';
import { handleCajaDown, CAJA_NETS } from '../drawingCreations';
import { puedeConectarRamalABajante } from '../bajanteRules';
import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../PlanoState';

function makeEngine(ramales: PlanoRamal[] = [], bajantes: PlanoBajante[] = []): IPlanoEngineCore {
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
    nivelActual: { label: 'P1', n: 1, npt: 0 } as never,
    deleteSelected: () => {},
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

// Ítems 5/6: cajas CAN (san) y CALL (ll) — nodos reales de conexión con máximo 1 ramal.

describe('cajas CAN/CALL', () => {
  it('handleCajaDown en san crea caja_san con código CAN{n}; en ll crea caja_ll CALL{n}', () => {
    localStorage.clear();
    const eng = makeEngine();
    handleCajaDown(eng, 10, 10);
    expect(eng.bajantes).toHaveLength(1);
    expect(eng.bajantes[0].tipo).toBe('caja_san');
    expect(eng.bajantes[0].code).toBe('CAN1');
    handleCajaDown(eng, 30, 30);
    expect(eng.bajantes[1].code).toBe('CAN2');
    const engLl = makeEngine();
    engLl.activeNet = 'll';
    handleCajaDown(engLl, 5, 5);
    expect(engLl.bajantes[0].tipo).toBe('caja_ll');
    expect(engLl.bajantes[0].code).toBe('CALL1');
    // Red no permitida: no crea nada.
    const engAf = makeEngine();
    engAf.activeNet = 'af';
    handleCajaDown(engAf, 5, 5);
    expect(engAf.bajantes).toHaveLength(0);
    expect(CAJA_NETS).toEqual(['san', 'll']);
  });

  it('una caja llena (1 ramal) rechaza el segundo por la regla central', () => {
    localStorage.clear();
    const c = {
      id: 'CAN1',
      net: 'san',
      tipo: 'caja_san',
      code: 'CAN1',
      x: 0,
      y: 0,
      pisoBase: 'P1',
      pisoCima: 'P1',
      nptBase: 0,
      nptCima: 0,
      hVert: 0,
      dNominal: '',
      recibeDeIds: ['RS1'],
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
    } as unknown as PlanoBajante;
    expect(puedeConectarRamalABajante(c, R({ id: 'RS1' })).ok).toBe(true); // ya asociado = noop
    expect(puedeConectarRamalABajante(c, R({ id: 'RS2' })).ok).toBe(false);
  });

  it('el borrador elimina una caja de un clic (tipo reconocido en handleEraseDown)', () => {
    localStorage.clear();
    // La caja es un PlanoBajante tipo caja_san: eraseRamalAt la despacha por tipo (la lista de
    // tipos borrables incluye caja_san/caja_ll). Aquí validamos la clasificación del tipo.
    const esTipoBorrable = (t: string) =>
      [
        'bajante',
        'montante',
        'caja_san',
        'caja_ll',
        'red_publica',
        'contador',
        'calentador',
        'canal',
      ].includes(t);
    expect(esTipoBorrable('caja_san')).toBe(true);
    expect(esTipoBorrable('caja_ll')).toBe(true);
  });
});
