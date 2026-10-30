// Factory ÚNICA de motor de pruebas (había ~117 copias de makeEngine con 9-20 campos cada
// una): Partial<IPlanoEngineCore> con los mínimos que la lógica lee en runtime; cada test
// añade sus overrides. Nuevos campos del core se agregan AQUÍ, no en 117 sitios.
import type { IPlanoEngineCore } from '../modules/civilflow/lib/PlanoEngine/PlanoState.ts';

export type EngineOverrides = Partial<IPlanoEngineCore>;

export function makeEngine(overrides: EngineOverrides = {}): IPlanoEngineCore {
  const base: EngineOverrides = {
    ramales: [],
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    activeNet: 'af',
    tipoTramo: 'ramal',
    _loadedPlanId: '',
    nivelActual: { label: 'P1', n: 0, npt: 0 },
    scaleM: 0.5,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    updateElementById: () => {},
    ...overrides,
  };
  return base as IPlanoEngineCore;
}
