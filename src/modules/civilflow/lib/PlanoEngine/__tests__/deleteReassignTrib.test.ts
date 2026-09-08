import { describe, it, expect } from 'vitest';
import { deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Ítem 4: al borrar un segmento en Y simple, el tributario sobreviviente se reasigna contra la
// estructura FINAL (debe tocar al nuevo padre) y se re-etiqueta T{nuevo}{padre} de inmediato —
// nunca queda como tributario de un elemento que no corresponde ni con el label del borrado.
function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    activeNet: 'san',
    nivelActual: { label: 'P2', n: 2, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    zoom: 1,
    snapMode: true,
    _loadedPlanId: null,
    _yeeFlashKey: null,
    _netCounts: { san: { ramal: 2, tributario: 1 } } as never,
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitDelete: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
  };
  return engine as IPlanoEngineCore;
}

const R = (o: Partial<PlanoRamal> & { id: string }): PlanoRamal =>
  ({
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
    ],
    totalL: 0,
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

describe('borrado en conjunto — tributario colgante cae, troncos sobreviven', () => {
  it('borrar RS1 cae con su tributario Tx; el tronco RS2 sobrevive', () => {
    const eng = makeEngine([
      R({
        id: 'RS1',
        label: 'RS1',
        pts: [
          [0, 0],
          [60, 0],
        ],
      }),
      R({
        id: 'RS2',
        label: 'RS2',
        pts: [
          [60, 0],
          [120, 0],
        ],
      }),
      R({
        id: 'Tx',
        label: 'T1RS1',
        tipo: 'tributario',
        padre: 'RS1',
        pts: [
          [60, 0],
          [60, 40],
        ],
      }),
    ]);
    deleteSelected(eng, ['RS1']);
    // Borrado en conjunto (regla vigente): el tributario Tx colgante cae con RS1; el tronco
    // RS2 sobrevive.
    expect(eng.ramales.find((r) => r.id === 'RS1')).toBeUndefined();
    expect(eng.ramales.find((r) => r.id === 'Tx')).toBeUndefined();
    expect(eng.ramales.find((r) => r.id === 'RS2')).toBeTruthy();
  });

  it('sin ramal conectado, cae solo el seleccionado + su tributario colgante (no adopta lejanos)', () => {
    const eng = makeEngine([
      R({
        id: 'RS1',
        label: 'RS1',
        pts: [
          [0, 0],
          [60, 0],
        ],
      }),
      R({
        id: 'RS9',
        label: 'RS9',
        pts: [
          [200, 200],
          [260, 200],
        ],
      }),
      R({
        id: 'Tx',
        label: 'T1RS1',
        tipo: 'tributario',
        padre: 'RS1',
        pts: [
          [60, 0],
          [60, 40],
        ],
      }),
    ]);
    deleteSelected(eng, ['RS1']);
    // RS9 está a >20px y no conecta: sobrevive. El tributario colgante cae con su padre.
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS9']);
  });
});
