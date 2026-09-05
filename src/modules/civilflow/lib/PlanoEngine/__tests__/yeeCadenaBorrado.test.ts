import { describe, expect, it } from 'vitest';
import { eraseRamalAt } from '../drawingErase';
import { deleteSelected as _deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Cadena completa del usuario: yee doble (tronco partido por los splits + 2 laterales) →
// borrar el 4º brazo → queda yee simple → borrar el lateral restante ("el trazo que creó la
// yee simple"). Esperado: sin tapón en ningún paso, y al final tronco SIN codo 45 fantasma.
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

const codosEn = (eng: IPlanoEngineCore): string[] => {
  const out: string[] = [];
  for (const r of eng.ramales) {
    for (const a of [r.accesorioInicio, r.accesorioFin]) if (a) out.push(`${r.id}:${a}`);
    for (const [k, v] of Object.entries(r.accMed || {})) out.push(`${r.id}:${k}:${v}`);
  }
  return out;
};

describe('cadena doble→simple→borrado final', () => {
  it('sin tapón al borrar el 4º brazo y sin codo 45 al borrar el lateral restante', () => {
    // Estado: tronco partido en RS1|RS3 (split del primer lateral), lateral RS4 en [50,0],
    // lateral RS2 en [60,0]. Bandera de doble de dos uniones [[50,0],[60,0]] en todos.
    const troncoA = R({
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
    const troncoB = R({
      id: 'RS3',
      label: 'RS3',
      pts: [
        [50, 0],
        [60, 0],
        [100, 0],
      ],
      mergesFrom: ['RS1', 'RS4'],
      yeeDobleAt: [
        [50, 0],
        [60, 0],
      ],
    });
    const lat1 = R({
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
    const lat2 = R({
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
    const eng = makeEngine([troncoA, troncoB, lat1, lat2]);

    // 1) borrar el 4º brazo (RS4) → sin tapón (reporte 1).
    eng.selId = 'RS4';
    eraseRamalAt(eng, lat1, 42.9, -7.1);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS1', 'RS3', 'RS2']);
    expect(codosEn(eng).filter((c) => c.endsWith('tapon'))).toEqual([]);

    // 2) borrar el lateral restante RS2 (creó la unión de [50,0]) → sin codo 45 (reporte 2).
    eng.selId = 'RS2';
    eraseRamalAt(eng, lat2, 67.1, -7.1);
    const ids = eng.ramales.map((r) => r.id);
    // eslint-disable-next-line no-console
    console.log('POST: ids=', JSON.stringify(ids), 'acc=', JSON.stringify(codosEn(eng)));
    expect(codosEn(eng).filter((c) => /codo/.test(c))).toEqual([]);
    expect(codosEn(eng).filter((c) => c.endsWith('tapon'))).toEqual([]);
  });
});
