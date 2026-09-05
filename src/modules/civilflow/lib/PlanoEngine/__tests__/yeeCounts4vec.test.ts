import { describe, it, expect } from 'vitest';
import { calcSanitaryAccessories } from '../networkSanitary';
import { loadFromStorage } from '../../../services/storageService';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    selId: null,
    activeNet: 'san',
    zoom: 1,
    _loadedPlanId: 1,
    _hiddenNets: new Set(),
    _netCounts: {
      san: { ramal: 1, tributario: 0 },
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
      [100, 0],
    ],
    totalL: 0,
    label: 'RS1',
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

describe('conteo yee 4 vectores en un punto', () => {
  it('primer recálculo cuenta simple; con bandera persistida cuenta doble y elimina la simple', () => {
    localStorage.clear();
    const tronco = R({
      pts: [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
    });
    const lat1 = R({
      id: 'T1RS1',
      tipo: 'tributario',
      diametro: '2"',
      pts: [
        [35.9, -14.1],
        [50, 0],
      ],
    });
    const lat2 = R({
      id: 'T2RS1',
      tipo: 'tributario',
      diametro: '2"',
      pts: [
        [64.1, -14.1],
        [50, 0],
      ],
    });
    const eng = makeEngine([tronco, lat1, lat2]);
    calcSanitaryAccessories(eng);
    const hidro1 = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      'tramo_hidro_data_v3',
      {},
    );
    // Primer recálculo SIN banderas: simple (el render aún no persistió la identidad).
    expect(hidro1['san_RS1_1']?.accesorios?.['yeeSimple']).toBe(1);

    // El render persiste la identidad [P,P] en los participantes → siguiente recálculo: doble.
    tronco.yeeDobleAt = [
      [50, 0],
      [50, 0],
    ];
    lat1.yeeDobleAt = [
      [50, 0],
      [50, 0],
    ];
    lat2.yeeDobleAt = [
      [50, 0],
      [50, 0],
    ];
    calcSanitaryAccessories(eng);
    const hidro2 = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      'tramo_hidro_data_v3',
      {},
    );
    // eslint-disable-next-line no-console
    console.log('HIDRO2:', JSON.stringify(hidro2));
    const all = JSON.stringify(hidro2);
    expect(all.includes('"yeeSimple"')).toBe(false);
    expect(all.includes('"yeeDoble"')).toBe(true);
  });

  it('yee doble cuyo punto PAR murió cuenta SIMPLE (no doble para siempre)', () => {
    localStorage.clear();
    // Tronco que TERMINA en la yee + 2 laterales (3 dirs, sin par colineal): la bandera
    // persistida mantiene la unión viva, pero con el punto PAR [80,20] muerto (sin geometría)
    // la pieza física restante es una Y simple — antes contaba doble para siempre.
    const tronco = R({
      pts: [
        [0, 0],
        [50, 0],
      ],
    });
    const lat1 = R({
      id: 'T1RS1',
      tipo: 'tributario',
      diametro: '2"',
      pts: [
        [35.9, -14.1],
        [50, 0],
      ],
    });
    const lat2 = R({
      id: 'T2RS1',
      tipo: 'tributario',
      diametro: '2"',
      pts: [
        [64.1, -14.1],
        [50, 0],
      ],
    });
    const eng = makeEngine([tronco, lat1, lat2]);
    tronco.yeeDobleAt = [
      [50, 0],
      [80, 20],
    ];
    lat1.yeeDobleAt = [
      [50, 0],
      [80, 20],
    ];
    lat2.yeeDobleAt = [
      [50, 0],
      [80, 20],
    ];
    calcSanitaryAccessories(eng);
    const hidro = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      'tramo_hidro_data_v3',
      {},
    );
    expect(hidro['san_RS1_1']?.accesorios?.['yeeSimple']).toBe(1);
    expect(JSON.stringify(hidro).includes('"yeeDoble"')).toBe(false);
  });

  it('doble→simple: quitar un lateral (sin tapón) borra yeeDoble y cuenta yeeSimple', () => {
    localStorage.clear();
    // Caso orig. usuario: yee doble en un punto [P,P]; se elimina UN lateral → la pieza es una
    // Y simple. Antes el conteo quedaba doble para siempre (yeeDoble nunca se borraba).
    const tronco = R({
      pts: [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
    });
    const lat1 = R({
      id: 'T1RS1',
      tipo: 'tributario',
      diametro: '2"',
      pts: [
        [35.9, -14.1],
        [50, 0],
      ],
    });
    const lat2 = R({
      id: 'T2RS1',
      tipo: 'tributario',
      diametro: '2"',
      pts: [
        [64.1, -14.1],
        [50, 0],
      ],
    });
    const eng = makeEngine([tronco, lat1, lat2]);
    for (const r of [tronco, lat1, lat2])
      r.yeeDobleAt = [
        [50, 0],
        [50, 0],
      ];
    calcSanitaryAccessories(eng);
    let hidro = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      'tramo_hidro_data_v3',
      {},
    );
    expect(hidro['san_RS1_1']?.accesorios?.['yeeDoble']).toBe(1);

    // Se quita T1RS1 (borrado del lateral, sin tapón — tributarios no tapan).
    eng.ramales = eng.ramales.filter((r) => r.id !== 'T1RS1');
    calcSanitaryAccessories(eng);
    hidro = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      'tramo_hidro_data_v3',
      {},
    );
    expect(hidro['san_RS1_1']?.accesorios?.['yeeSimple']).toBe(1);
    expect(hidro['san_RS1_1']?.accesorios?.['yeeDoble']).toBeUndefined();
  });

  it('doble con lateral TAPIADO sigue contando doble (brazo borrado con tapón)', () => {
    localStorage.clear();
    const tronco = R({
      pts: [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
    });
    const lat1 = R({
      id: 'T1RS1',
      tipo: 'tributario',
      diametro: '2"',
      pts: [
        [35.9, -14.1],
        [50, 0],
      ],
    });
    const lat2 = R({
      id: 'T2RS1',
      tipo: 'tributario',
      diametro: '2"',
      pts: [
        [64.1, -14.1],
        [50, 0],
      ],
      accesorioFin: 'tapon', // tapón del caso yee anclado en la unión
    });
    const eng = makeEngine([tronco, lat1, lat2]);
    for (const r of [tronco, lat1, lat2])
      r.yeeDobleAt = [
        [50, 0],
        [50, 0],
      ];
    // lat1 se fue; el tapón en la unión marca la pieza doble restante.
    eng.ramales = eng.ramales.filter((r) => r.id !== 'T1RS1');
    calcSanitaryAccessories(eng);
    const hidro = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      'tramo_hidro_data_v3',
      {},
    );
    expect(hidro['san_RS1_1']?.accesorios?.['yeeDoble']).toBe(1);
    expect(hidro['san_RS1_1']?.accesorios?.['yeeSimple']).toBeUndefined();
  });

  it('accesorio manual quitado del dibujo se BORRA del conteo (pase genérico)', () => {
    localStorage.clear();
    // teeTapon a mitad de ramal (accMed): contado → quitar el accMed → el conteo baja a 0.
    const tronco = R({
      pts: [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
      accMed: { accMed1: 'teeTapon' },
    });
    const eng = makeEngine([tronco]);
    calcSanitaryAccessories(eng);
    let hidro = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      'tramo_hidro_data_v3',
      {},
    );
    expect(hidro['san_RS1_1']?.accesorios?.['teeTapon']).toBe(1);

    tronco.accMed = {};
    calcSanitaryAccessories(eng);
    hidro = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      'tramo_hidro_data_v3',
      {},
    );
    expect(hidro['san_RS1_1']?.accesorios?.['teeTapon']).toBeUndefined();
  });
});
