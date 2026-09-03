import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calcSanitaryAccessories } from '../networkSanitary';
import { loadFromStorage } from '../../../services/storageService';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// REPRO punto 1: ramal/tributario con inodoro cambia símbolo codo90rmSube → codoReventilado.
// Esperado: hidroData pierde codo90rmSube y gana codoReventilado (sin vent geométrico).

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
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 1, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
    _loadedPlanId: 'p1',
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
      [40, 0],
    ],
    totalL: 1,
    label: 'RS1',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: 'PVC-S',
    diametro: '4"',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

const hidroOf = (id: string) =>
  (
    loadFromStorage('tramo_hidro_data_v3', {}) as Record<
      string,
      { accesorios: Record<string, number> }
    >
  )[`san_${id}_p1`]?.accesorios || {};

describe('repro inodoro codo90 → codoReventilado', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('ramal: cambia codo90 por reventilado sin vent geométrico', () => {
    const ramal = R({ accesorioFin: 'codo90rmSube', diametroFin: '4"' });
    const engine = makeEngine([ramal]);
    calcSanitaryAccessories(engine);
    expect(hidroOf('RS1')['codo90rmSube']).toBe(1);
    // cambio de símbolo
    ramal.accesorioFin = 'codoReventilado';
    calcSanitaryAccessories(engine);
    const acc = hidroOf('RS1');
    expect(acc['codo90rmSube'] || 0).toBe(0);
    expect(acc['codoReventilado']).toBe(1);
  });

  it('tributario: cambia codo90 por reventilado sin vent geométrico', () => {
    const trib = R({
      id: 'T9',
      tipo: 'tributario',
      padre: 'RS1',
      label: 'T1RS1',
      diametro: '4"',
      accesorioFin: 'codo90rmSube',
      diametroFin: '4"',
    });
    const engine = makeEngine([R({}), trib]);
    calcSanitaryAccessories(engine);
    expect(hidroOf('T9')['codo90rmSube']).toBe(1);
    trib.accesorioFin = 'codoReventilado';
    calcSanitaryAccessories(engine);
    const acc = hidroOf('T9');
    expect(acc['codo90rmSube'] || 0).toBe(0);
    expect(acc['codoReventilado']).toBe(1);
  });
});
