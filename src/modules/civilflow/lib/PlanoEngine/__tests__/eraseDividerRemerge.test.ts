import { describe, expect, it } from 'vitest';
import { eraseRamalAt } from '../drawingErase';
import { deleteSelected as _deleteSelected } from '../deleteSelected';
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

// Orig. usuario: borrar con el borrador el trazo que PARTIÓ un ramal debe re-unir las mitades
// en un solo ramal. El borrador usaba noMerge incondicional para ramales de 1 segmento, lo que
// saltaba remergeSplitRamales y el ramal seguía partido (RS4|RS5 colineales).

describe('borrar el divisor con el borrador re-un el ramal', () => {
  it('divisor de 1 segmento borrado → mitades colineales vuelven a ser una, sin vértice fantasma', () => {
    localStorage.clear();
    const existing = R({
      id: 'RS4',
      label: 'RS4',
      pts: [
        [0, 0],
        [50, 0],
      ],
    });
    const downstream = R({
      id: 'RS5',
      label: 'RS5',
      pts: [
        [50, 0],
        [100, 0],
      ],
      mergesFrom: ['RS4', 'DIV'],
    });
    const divisor = R({
      id: 'DIV',
      label: 'DIV',
      pts: [
        [50, 0],
        [80, 30],
      ],
    });
    const eng = makeEngine([existing, downstream, divisor]);
    eng.selId = 'DIV';
    eraseRamalAt(eng, divisor, 80, 30);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS4']);
    // El vértice de la vieja unión [50,0] se sana (colineal + grado 2): el ramal queda como
    // un segmento limpio — borrarlo después no lo parte por la vieja conexión.
    expect(eng.ramales[0].pts).toEqual([
      [0, 0],
      [100, 0],
    ]);
    expect(eng.ramales[0].mergesFrom).toBeUndefined();
  });

  it('ramal re-unido multi-segmento: borrar un segmento NO lo parte por las viejas uniones', () => {
    localStorage.clear();
    // Línea con un quiebre real en [70,0] (no colineal → el heal lo conserva) y la unión
    // fantasma en [40,0] (colineal → el heal lo elimina).
    const existing = R({
      id: 'RS4',
      label: 'RS4',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const downstream = R({
      id: 'RS5',
      label: 'RS5',
      pts: [
        [40, 0],
        [70, 0],
        [70, 30],
      ],
      mergesFrom: ['RS4', 'DIV'],
    });
    const divisor = R({
      id: 'DIV',
      label: 'DIV',
      pts: [
        [40, 0],
        [70, 30],
      ],
    });
    const eng = makeEngine([existing, downstream, divisor]);
    eng.selId = 'DIV';
    eraseRamalAt(eng, divisor, 70, 30);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS4']);
    expect(eng.ramales[0].pts).toEqual([
      [0, 0],
      [70, 0],
      [70, 30],
    ]);
    // Borrar un segmento del ramal re-unido: sin vértice fantasma NO hay split — solo recorte.
    eraseRamalAt(eng, eng.ramales[0], 55, 0);
    expect(eng.ramales).toHaveLength(1);
    expect(eng.ramales[0].pts).toEqual([
      [0, 0],
      [70, 0],
    ]);
  });

  it('ramal de 1 segmento que NO es divisor sigue borrándose quirúrgicamente (sin re-unión)', () => {
    localStorage.clear();
    // Dos ramales colineales que se tocan SIN mergesFrom y con un tercero tocando el punto
    // (grado 3): borrar uno con el borrador no debe fundir los otros dos (mergeCollinearPairs
    // exige grado 2) — comportamiento previo intacto.
    const a = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [50, 0],
      ],
    });
    const b = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [50, 0],
        [100, 0],
      ],
    });
    const dead = R({
      id: 'DEAD',
      label: 'DEAD',
      pts: [
        [50, 0],
        [80, 30],
      ],
    });
    const eng = makeEngine([a, b, dead]);
    eng.selId = 'DEAD';
    eraseRamalAt(eng, dead, 80, 30);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS1', 'RS2']);
  });
});
