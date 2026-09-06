import { describe, expect, it } from 'vitest';
import { eraseRamalAt } from '../drawingErase';
import { deleteSelected as _deleteSelected } from '../deleteSelected';
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
    deleteSelected: function (ids?: string[], opts?: { noMerge?: boolean }) {
      _deleteSelected(this as unknown as IPlanoEngineCore, ids, opts);
    },
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

// Yee doble canónica (fixture yeeCounts4vec): tronco pasante + 2 laterales a 45° en el MISMO
// punto; bandera yeeDobleAt degenerada [P,P] en tronco y laterales (la escribe calcSanitary-
// Accessories en todos los ramales que tocan la unión).
function yeeSetup() {
  const tronco = R({
    id: 'RS1',
    label: 'RS1',
    pts: [
      [0, 0],
      [50, 0],
      [100, 0],
    ],
  });
  const lat1 = R({
    id: 'T1RS1',
    tipo: 'tributario',
    pts: [
      [35.9, -14.1],
      [50, 0],
    ],
  });
  const lat2 = R({
    id: 'T2RS1',
    tipo: 'tributario',
    pts: [
      [64.1, -14.1],
      [50, 0],
    ],
  });
  for (const r of [tronco, lat1, lat2])
    r.yeeDobleAt = [
      [50, 0],
      [50, 0],
    ];
  return { tronco, lat1, lat2 };
}
const taponCount = (eng: IPlanoEngineCore) =>
  eng.ramales.reduce((n, r) => {
    let k = (r.accesorioInicio === 'tapon' ? 1 : 0) + (r.accesorioFin === 'tapon' ? 1 : 0);
    if (r.accMed) k += Object.values(r.accMed).filter((v) => v === 'tapon').length;
    return n + k;
  }, 0);

describe('mantenimiento de yee doble (borrar segmentos/laterales)', () => {
  it('borrar el brazo de la yee con el borrador: el ramal se elimina COMPLETO y el tapón queda en el sobreviviente', () => {
    localStorage.clear();
    const { tronco, lat1, lat2 } = yeeSetup();
    const eng = makeEngine([tronco, lat1, lat2]);
    eng.selId = 'RS1';
    // Clic del borrador sobre un segmento del tronco (multi-segmento): antes lo RECORTABA y el
    // resto quedaba desconectado en el plano; ahora el ramal del brazo se elimina completo.
    eraseRamalAt(eng, tronco, 25, 0);
    expect(eng.ramales.map((r) => r.id)).toEqual(['T1RS1', 'T2RS1']);
    // preserveYeeDobleAt deja el tapón en el sobreviviente colineal (T2, a 45° a favor).
    expect(eng.ramales.find((r) => r.id === 'T2RS1')!.accesorioFin).toBe('tapon');
  });

  it('borrar un LATERAL TRIBUTARIO de la doble: SÍ tapón (T1RS1/T1RS2, orig. usuario)', () => {
    localStorage.clear();
    // Regla consolidada: el lateral TRIBUTARIO borrado deja la pierna abierta → tapón en el
    // sobreviviente (a diferencia de los laterales RAMAL, que no tapan). Vertical o diagonal
    // da igual: el tributario siempre tapa.
    const { tronco, lat1, lat2 } = yeeSetup();
    const eng = makeEngine([tronco, lat1, lat2]);
    eng.selId = 'T1RS1';
    eraseRamalAt(eng, lat1, 35.9, -14.1);
    calcSanitaryAccessories(eng);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS1', 'T2RS1']);
    expect(taponCount(eng)).toBe(1);
    for (const r of eng.ramales)
      expect(r.yeeDobleAt).toEqual([
        [50, 0],
        [50, 0],
      ]);
  });

  it('borrar un LATERAL RAMAL de doble de dos uniones: SIN tapón ni conteo (RS2/RS4, orig. usuario)', () => {
    localStorage.clear();
    // Yee doble de dos uniones [P1,P2] con laterales RAMAL (no tributarios): tronco pasante
    // RS1, lateral RS4 arriba en P1, lateral RS2 abajo en P2. Borrar RS4 → sin tapón.
    const tronco = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [50, 0],
        [60, 0],
        [100, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const latA = R({
      id: 'RS4',
      label: 'RS4',
      pts: [
        [42.9, -7.1],
        [50, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const latB = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [67.1, -7.1],
        [60, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const eng = makeEngine([tronco, latA, latB]);
    eng.selId = 'RS4';
    eraseRamalAt(eng, latA, 42.9, -7.1);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS1', 'RS2']);
    expect(taponCount(eng)).toBe(0);
    calcSanitaryAccessories(eng);
    // Sin tapón no hay conteo de tapones en hidro.
    const hidro = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      'tramo_hidro_data_v3',
      {},
    );
    for (const k of Object.keys(hidro)) {
      expect(hidro[k]?.accesorios?.['tapon']).toBeUndefined();
    }
  });

  it('borrar un LATERAL RAMAL cura el tapón TRABADO de un estado anterior (pre-fix)', () => {
    localStorage.clear();
    // Estado del usuario: un tapón persistido de un borrado anterior (código viejo) quedó
    // anclado en la unión. Al borrar el lateral, removeTaponAtPt lo retira — verificado
    // ANTES del recálculo para atribuirlo a la limpieza, no a la validación de 2 direcciones.
    const tronco = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [50, 0],
        [60, 0],
        [100, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
      accMed: { accMed1: 'tapon' }, // tapón trabado en P1=[50,0]
    });
    const latA = R({
      id: 'RS4',
      label: 'RS4',
      pts: [
        [42.9, -7.1],
        [50, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const latB = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [67.1, -7.1],
        [60, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const eng = makeEngine([tronco, latA, latB]);
    eng.selId = 'RS4';
    eraseRamalAt(eng, latA, 42.9, -7.1);
    expect(taponCount(eng)).toBe(0);
    expect(tronco.accMed?.['accMed1']).toBeUndefined();
  });

  it('borrar un LATERAL RAMAL de doble en un punto [P,P]: SIN tapón (el tronco pasante la delata)', () => {
    localStorage.clear();
    const tronco = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [50, 0],
      ],
    });
    const latA = R({
      id: 'RS4',
      label: 'RS4',
      pts: [
        [42.9, -7.1],
        [50, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [50, 0],
      ],
    });
    const latB = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [57.1, 7.1],
        [50, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [50, 0],
      ],
      accesorioFin: 'tapon', // tapón trabado en la unión [50,0] (3 dirs: la validación NO lo quita)
    });
    const eng = makeEngine([tronco, latA, latB]);
    eng.selId = 'RS4';
    eraseRamalAt(eng, latA, 42.9, -7.1);
    // removeTaponAtPt retiró el tapón trabado ANTES de cualquier recálculo.
    expect(taponCount(eng)).toBe(0);
    calcSanitaryAccessories(eng);
    expect(taponCount(eng)).toBe(0);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS1', 'RS2']);
  });

  it('borrar el TRONCO de doble de dos uniones SÍ deja tapón (extremo abierto)', () => {
    localStorage.clear();
    const tronco = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [50, 0],
        [60, 0],
        [100, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const latA = R({
      id: 'RS4',
      label: 'RS4',
      pts: [
        [42.9, -7.1],
        [50, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const latB = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [67.1, -7.1],
        [60, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const eng = makeEngine([tronco, latA, latB]);
    eng.selId = 'RS1';
    eraseRamalAt(eng, tronco, 25, 0);
    calcSanitaryAccessories(eng);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS4', 'RS2']);
    // El tronco toca AMBAS uniones → pasa el filtro lateral/tronco y entra al anclaje del
    // tapón (el sobreviviente elegido depende del delPt; no se afirma cuál).
  });

  it('borrar el SEGMENTO TERMINAL del tronco (más allá de una unión) SÍ crea el tapón', () => {
    localStorage.clear();
    // Reporte usuario: yee doble de dos uniones; el tronco sigue más allá de P2. Borrar esa
    // pieza TERMINAL (colineal al eje) deja el extremo abierto → tapón (no es un lateral).
    const tronco = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [50, 0],
        [60, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const terminal = R({
      id: 'RS3',
      label: 'RS3',
      pts: [
        [60, 0],
        [100, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const latA = R({
      id: 'RS4',
      label: 'RS4',
      pts: [
        [42.9, -7.1],
        [50, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const latB = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [67.1, -7.1],
        [60, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const eng = makeEngine([tronco, terminal, latA, latB]);
    eng.selId = 'RS3';
    eraseRamalAt(eng, terminal, 80, 0);
    calcSanitaryAccessories(eng);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS1', 'RS4', 'RS2']);
    expect(taponCount(eng)).toBeGreaterThan(0);
  });

  it('borrar el SEGMENTO MEDIO de la doble: DOS tapones (un puerto por unión)', () => {
    localStorage.clear();
    // El tronco de la doble está partido: RS1 | RS5(medio) | RS3. Borrar el medio abre los
    // DOS puertos de la doble → un tapón por unión (antes solo se tapaba uno).
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [50, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const medio = R({
      id: 'RS5',
      label: 'RS5',
      pts: [
        [50, 0],
        [60, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const rs3 = R({
      id: 'RS3',
      label: 'RS3',
      pts: [
        [60, 0],
        [100, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const latA = R({
      id: 'RS4',
      label: 'RS4',
      pts: [
        [42.9, -7.1],
        [50, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const latB = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [67.1, -7.1],
        [60, 0],
      ],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const eng = makeEngine([rs1, medio, rs3, latA, latB]);
    eng.selId = 'RS5';
    eraseRamalAt(eng, medio, 55, 0);
    calcSanitaryAccessories(eng);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS1', 'RS3', 'RS4', 'RS2']);
    expect(taponCount(eng)).toBe(2);
  });

  it('tapón retirado en esquina L por la validación → el codo 45 lo sustituye', () => {
    localStorage.clear();
    // Estado final del desarme de la yee: esquina L (diagonal + horizontal) con el tapón del
    // caso yee anclado en el punto. La validación retira el tapón (2 direcciones) y el codo
    // de plano debe aparecer — antes el punto quedaba vacío.
    const r1 = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [0, 0],
        [50, 0],
      ],
      accesorioInicio: 'tapon',
    });
    const r2 = R({
      id: 'RS3',
      label: 'RS3',
      pts: [
        [-35.4, -35.4],
        [0, 0],
      ],
    });
    const eng = makeEngine([r1, r2]);
    calcSanitaryAccessories(eng);
    expect(taponCount(eng)).toBe(0);
    expect(eng.ramales.find((r) => r.id === 'RS2')!.accesorioInicio).toBe('codo45');
  });
});
