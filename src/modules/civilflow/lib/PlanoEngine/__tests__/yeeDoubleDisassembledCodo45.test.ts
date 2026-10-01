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

// Orig. usuario: desarmar una yee doble sanitaria borrando segmentos deja una sola conexión
// (segmento del brazo principal + segmento de la segunda conexión) en esquina — debe recibir el
// símbolo de codo 45 (y con él el conteo en la tabla de accesorios, vía codo45→codo45rc).

describe('codo 45 al desarmar yee doble', () => {
  it('recorte de extremo: esquina con salidas a 135° (espejo de la imagen del usuario)', () => {
    localStorage.clear();
    // Esquina en [0,0]: RS1 horizontal hacia la derecha, RS2 diagonal desde arriba-izquierda.
    // El brazo principal tenía un segmento extra a la izquierda de la esquina que se recorta.
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [-5, 0],
        [0, 0],
        [9.2, 0],
      ],
    });
    const rs2 = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [-7.42, -7.42],
        [0, 0],
      ],
    });
    const eng = makeEngine([rs1, rs2]);
    eng.selId = 'RS1';
    eraseRamalAt(eng, rs1, -5, 0);
    expect(eng.ramales.find((r) => r.id === 'RS1')!.pts).toEqual([
      [0, 0],
      [9.2, 0],
    ]);
    // El codo queda en el extremo que quedó ABIERTO (la esquina), no en el vértice recortado.
    expect(eng.ramales.find((r) => r.id === 'RS1')!.accesorioInicio).toBe('codo45');
  });

  it('recorte de extremo: esquina con salidas a 45° (caso espejo del probe)', () => {
    localStorage.clear();
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 40],
        [0, 60],
        [0, 100],
      ],
    });
    const rs2 = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [0, 60],
        [42.4, 102.4],
      ],
    });
    const t1 = R({
      id: 'T1',
      tipo: 'tributario',
      pts: [
        [-21.2, 81.2],
        [0, 60],
      ],
    });
    const t2 = R({
      id: 'T2',
      tipo: 'tributario',
      pts: [
        [21.2, 81.2],
        [0, 60],
      ],
    });
    const eng = makeEngine([rs1, rs2, t1, t2]);
    eng.selId = 'T1';
    eraseRamalAt(eng, t1, -21.2, 81.2);
    eng.selId = 'T2';
    eraseRamalAt(eng, t2, 21.2, 81.2);
    eng.selId = 'RS1';
    eraseRamalAt(eng, rs1, 0, 38);
    expect(eng.ramales.find((r) => r.id === 'RS1')!.accesorioInicio).toBe('codo45');
  });

  it('split de segmento intermedio: el punto de corte con tributario recibe su codo', () => {
    localStorage.clear();
    // Segmentos largos para que el clic (37.5,0) caiga a >10 de todo vértice y tome el loop
    // de segmentos (el de vértices gana siempre que haya uno a ≤10).
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [25, 0],
        [50, 0],
        [75, 0],
      ],
    });
    const t2 = R({
      id: 'T2',
      tipo: 'tributario',
      pts: [
        [21.5, 3.5],
        [25, 0],
      ],
    });
    const eng = makeEngine([rs1, t2]);
    eng.selId = 'RS1';
    eraseRamalAt(eng, rs1, 37.5, 0);
    // RS1 quedó partido: mitad superior [[0,0],[25,0]] + mitad inferior [[50,0],[75,0]] + T2.
    expect(eng.ramales).toHaveLength(3);
    const up = eng.ramales.find((r) => r.pts.length === 2 && r.pts[1][0] === 25)!;
    // Esquina en [25,0] entre la mitad superior y el tributario: ejes a 45°.
    expect(up.accesorioFin).toBe('codo45');
  });
});
