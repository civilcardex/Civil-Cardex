import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Cobertura de regresión del flujo de unión trib-trib (af/ac/gas):
// - unión con mismo padre: permitida, AccesorioModal debe seguir abriéndose (selección de símbolo de tee)
// - unión con padre distinto: bloqueada ANTES del push, salta alerta, SIN modal, el ramal no se confirma

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[] = []): IPlanoEngineCore {
  const calls: string[] = [];
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    activeNet: 'af',
    tipoTramo: 'tributario',
    padreTributario: 'RAF_PADRE',
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { af: { ramal: 2, tributario: 1 }, ac: { ramal: 0, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: (t: string) => calls.push(`alert:${t}`),
    triggerAccesorioModal: () => calls.push('modal'),
    _renumberRamales: () => {},
  };
  (engine as unknown as { calls: string[] }).calls = calls;
  return engine as IPlanoEngineCore;
}

function makePadre(): PlanoRamal {
  return {
    id: 'RAF_PADRE',
    net: 'af',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
    ],
    totalL: 0,
    label: 'RAF2',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 5,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    bloqueado: true,
  } as PlanoRamal;
}

function makeTributario(id: string, padre: string | null): PlanoRamal {
  return {
    id,
    net: 'af',
    tipo: 'tributario',
    padre,
    pts: [
      [40, 0],
      [40, 30],
    ],
    totalL: 0,
    label: id,
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
    pendiente: 0,
    bloqueado: true,
  } as PlanoRamal;
}

describe('trib-trib join (same padre) — modal must still fire', () => {
  it('allows the join and triggers the AccesorioModal for the tee symbol', () => {
    const padre = makePadre();
    const t1 = makeTributario('T1', 'RAF_PADRE');
    const engine = makeEngine([padre, t1]);
    const calls = (engine as unknown as { calls: string[] }).calls;

    // T2 arranca en la unión compartida (40,0) — justo donde T1 también empieza en el extremo del padre.
    engine.activeRamal = {
      net: 'af',
      tipo: 'tributario',
      padre: 'RAF_PADRE',
      pts: [
        [40, 0],
        [60, 0],
      ],
    } as never;

    finishRamal(engine);

    // T2 debe quedar confirmado (committed)
    expect(engine.ramales.some((r) => r.padre === 'RAF_PADRE' && r.id !== 'T1')).toBe(true);
    // Sin alerta de padre equivocado
    expect(calls.some((c) => c.startsWith('alert'))).toBe(false);
    // El modal de selección de accesorio debe seguir abriéndose para que el usuario elija el tipo de tee
    expect(calls).toContain('modal');
  });
});

describe('trib-trib join (different padre) — blocked before push, no modal', () => {
  it('alerts, does NOT commit the ramal, and does NOT fire the modal', () => {
    const padre = makePadre();
    // T1 pertenece a un ramal padre DIFERENTE
    const t1 = makeTributario('T1', 'RAF_OTHER');
    const engine = makeEngine([padre, t1]);
    const calls = (engine as unknown as { calls: string[] }).calls;

    engine.activeRamal = {
      net: 'af',
      tipo: 'tributario',
      padre: 'RAF_PADRE',
      pts: [
        [40, 0],
        [60, 0],
      ],
    } as never;

    finishRamal(engine);

    // El tributario nuevo NO debe quedar confirmado
    expect(engine.ramales.filter((r) => r.padre === 'RAF_PADRE')).toHaveLength(0);
    // Salta la alerta de padre equivocado
    expect(calls.some((c) => c.startsWith('alert:'))).toBe(true);
    // SIN modal
    expect(calls).not.toContain('modal');
  });
});
