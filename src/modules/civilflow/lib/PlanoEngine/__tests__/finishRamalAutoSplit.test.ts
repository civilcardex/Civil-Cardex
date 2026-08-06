import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Cobertura de caracterización para las dos rutas de creación de ramal más comunes que tenían
// cero cobertura: un ramal simple (sin empalme) y un ramal cuyo extremo cae a mitad del cuerpo de
// un ramal existente — la ruta de auto-split/merge (autoSplitJunctionAndSumFlow) que causó el bug
// UD/UC investigado antes en esta sesión. Ambas pasan por finishRamal, el punto de entrada real
// que usa handleMouseDown/handleDragUp cuando el usuario termina de dibujar.

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[] = []): IPlanoEngineCore {
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
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { af: { ramal: 0, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
  };
  return engine as IPlanoEngineCore;
}

describe('finishRamal — simple ramal, no junction', () => {
  it('creates a single new ramal with an incrementing label and no split occurs', () => {
    const engine = makeEngine([]);
    engine.activeRamal = {
      net: 'af',
      tipo: 'ramal',
      padre: null,
      pts: [
        [0, 0],
        [40, 0],
      ],
    } as never;

    finishRamal(engine);

    expect(engine.ramales).toHaveLength(1);
    const r = engine.ramales[0];
    expect(r.pts).toEqual([
      [0, 0],
      [40, 0],
    ]);
    expect(r.bloqueado).toBe(true);
    expect(engine.selId).toBe(r.id);
    expect(engine.activeRamal).toBeNull();
  });
});

describe('finishRamal — mid-body junction triggers autoSplitJunctionAndSumFlow', () => {
  it('splits the existing ramal at the junction and creates a downstream ramal with combined uc and no auto-assigned diametro', () => {
    const existing: PlanoRamal = {
      id: 'RAF_EXIST',
      net: 'af',
      tipo: 'ramal',
      padre: null,
      pts: [
        [0, 0],
        [40, 0],
      ],
      totalL: 0,
      label: 'RAF1',
      ini: '',
      fin: '',
      piso: '',
      dz: '',
      uc: 5,
      labelX: 0,
      labelY: 0,
      labelAngle: 0,
      material: '',
      diametro: '1/2" — 12.7 mm',
      pendiente: 0,
      bloqueado: true,
    } as PlanoRamal;
    const engine = makeEngine([existing]);
    // El ramal entrante termina justo a mitad del cuerpo de `existing` en (20,0) — una T verdadera.
    engine.activeRamal = {
      net: 'af',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    engine._ramalDefaults = { material: '', diametro: '3/4" — 19.1 mm', pendiente: 0 };

    finishRamal(engine);

    // existing (tramo aguas arriba) se encoge a [0,0]-[20,0]
    const upstream = engine.ramales.find((r) => r.id === 'RAF_EXIST')!;
    expect(upstream.pts).toEqual([
      [0, 0],
      [20, 0],
    ]);

    // se crea un ramal aguas abajo que hereda el resto del recorrido original
    expect(engine.ramales).toHaveLength(3); // aguas arriba + entrante + aguas abajo
    const created = engine.ramales.filter((r) => r.mergesFrom);
    expect(created).toHaveLength(1);
    const merged = created[0];
    const incoming = engine.ramales.find((r) => r.id === merged.mergesFrom![1])!;
    expect(merged.mergesFrom).toEqual(['RAF_EXIST', incoming.id]);
    expect(merged.pts[0]).toEqual([20, 0]);
    expect(merged.pts[merged.pts.length - 1]).toEqual([40, 0]);
    // uc sumado de ambos ramales convergentes (uc original de aguas arriba=5 + uc del entrante=0)
    expect(merged.uc).toBe(5 + (incoming.uc || 0));
    // AF/AC/gas: el diámetro se deja en blanco para que el usuario lo elija explícitamente, no se auto-asigna
    // al mayor de los dos ramales convergentes.
    expect(merged.diametro).toBe('');
  });
});
