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

describe('trib-trib join sobre el tronco — todos con padre = tronco (regla usuario)', () => {
  it('T1 y T2 adoptan al TRONCO del punto como padre y dispara el AccesorioModal', () => {
    const padre = makePadre();
    // T1 pertenece a un ramal padre DIFERENTE — al unir T2 con T1, T2 adopta el padre de T1
    // (regla del usuario: trib-trib → los padres quedan iguales).
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

    // Ambos tributarios del punto adoptan al tronco RAF_PADRE como padre (regla: los tres
    // llegan al mismo ramal → todos con ese padre).
    const t2 = engine.ramales.find((r) => r.id !== 'T1' && r.tipo === 'tributario');
    expect(t2).toBeDefined();
    expect(t2!.padre).toBe('RAF_PADRE');
    expect(t1.padre).toBe('RAF_PADRE');
    // NO salta alerta de padre equivocado
    expect(calls.some((c) => c.startsWith('alert:'))).toBe(false);
    // El modal de accesorio (symbol de unión) sigue abriéndose
    expect(calls).toContain('modal');
  });

  describe('relabelTribChain vía join — cadena completa re-etiquetada', () => {
    it('trib-trib aislado: los tributarios de la cadena toman la raíz ACTUAL del padre', () => {
      // T2RS1 tiene padre RS2 pero label vieja "T2RS1" (raíz RS1, arrastrada); T3RS1 cuelga de
      // T2RS1. Un tercer trib se une a T2RS1 en punto SIN tronco → la cadena entera re-etiqueta.
      const t1 = makeTributario('T2RS1', 'RS2');
      t1.pts = [
        [40, 30],
        [40, 0],
      ];
      const t3 = makeTributario('T3RS1', 'T2RS1');
      t3.pts = [
        [40, 60],
        [40, 30],
      ];
      const rs2 = makePadre();
      rs2.id = 'RS2';
      rs2.label = 'RS2';
      const engine = makeEngine([rs2, t1, t3]);
      const calls = (engine as unknown as { calls: string[] }).calls;
      (engine as unknown as { _debugRelabel?: boolean })._debugRelabel = true;

      engine.activeRamal = {
        net: 'af',
        tipo: 'tributario',
        padre: 'RAF_X',
        pts: [
          [40, 0],
          [60, 0],
        ],
      } as never;
      finishRamal(engine);

      expect(t1.label.endsWith('RS2')).toBe(true);
      expect(t3.label.endsWith('RS2')).toBe(true);
      expect(calls).toContain('modal');
    });
  });
});
