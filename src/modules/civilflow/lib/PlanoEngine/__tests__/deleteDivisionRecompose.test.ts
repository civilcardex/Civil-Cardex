import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Ítem 5: al borrar el ramal que PARTIÓ a otro, el original debe recuperar su continuidad; y al
// borrar después el ramal original completo, deben eliminarse TODOS sus segmentos (no uno solo).

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
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px) => px,
    cmToPlanePx: (c) => c,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    triggerAccesorioModal: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
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
    totalL: 0,
    label: o.id || 'RS1',
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
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

describe('Ítem 5 — división y eliminación', () => {
  it('borrar el divisor re-úne el ramal original en uno solo', () => {
    const padre = R({ id: 'RS1' });
    const engine = makeEngine([padre]);
    engine.tipoTramo = 'ramal';
    // Divisor vertical que cae a mitad de cuerpo del RS1 (en (20,0)) — crea upstream/downstream.
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    // Tras dividir: RS1 se parte en 2 + el divisor = 3 ramales.
    expect(engine.ramales.length).toBe(3);
    const divisor = engine.ramales.find((r) => r.pts[0][1] === 40);
    expect(divisor).toBeDefined();
    const merged = engine.ramales.find((r) => r.mergesFrom);
    expect(merged).toBeDefined();

    // Borrar el divisor → el original se re-úne en UN ramal continuo.
    deleteSelected(engine, [divisor!.id]);
    const sanRamales = engine.ramales.filter((r) => r.net === 'san');
    expect(sanRamales).toHaveLength(1);
    const remerged = sanRamales[0];
    expect(remerged.pts).toEqual([
      [0, 0],
      [20, 0],
      [40, 0],
    ]);
  });

  it('borrar después el ramal original completo elimina TODOS sus segmentos', () => {
    const padre = R({ id: 'RS1' });
    const engine = makeEngine([padre]);
    engine.tipoTramo = 'ramal';
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    const divisor = engine.ramales.find((r) => r.pts[0][1] === 40);
    deleteSelected(engine, [divisor!.id]);
    // Ahora hay un solo ramal re-unido; borrarlo debe eliminar todo.
    const remerged = engine.ramales.filter((r) => r.net === 'san')[0];
    deleteSelected(engine, [remerged.id]);
    expect(engine.ramales.filter((r) => r.net === 'san')).toHaveLength(0);
  });

  it('borrar la MITAD downstream de una división elimina toda la división (sin huérfanos)', () => {
    const padre = R({ id: 'RS1' });
    const engine = makeEngine([padre]);
    engine.tipoTramo = 'ramal';
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    const downstream = engine.ramales.find((r) => r.mergesFrom)!;
    // Borrar la mitad downstream (no el divisor ni el upstream) → expande a la división completa.
    deleteSelected(engine, [downstream.id]);
    const sanRamales = engine.ramales.filter((r) => r.net === 'san');
    // Solo debe quedar el upstream original (RS1 truncado) o nada de la división; sin huérfanos.
    expect(sanRamales.every((r) => !r.mergesFrom)).toBe(true);
  });

  it('división encadenada (2 divisores): borrar ambos re-úne en uno y luego el original se borra completo', () => {
    const padre = R({ id: 'RS1' });
    const engine = makeEngine([padre]);
    engine.tipoTramo = 'ramal';
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [30, 40],
        [30, 0],
      ],
    } as never;
    finishRamal(engine);
    const divisores = engine.ramales.filter((r) => r.pts[0][1] === 40 && r.pts[1][1] === 0);
    expect(divisores.length).toBe(2);
    for (const d of divisores) deleteSelected(engine, [d.id]);
    const sanRamales = engine.ramales.filter((r) => r.net === 'san');
    expect(sanRamales).toHaveLength(1);
    deleteSelected(engine, [sanRamales[0].id]);
    expect(engine.ramales.filter((r) => r.net === 'san')).toHaveLength(0);
  });

  it('borrar el divisor con un drift en la unión no debe dejar segmento huérfano (merge ciego sano)', () => {
    const padre = R({ id: 'RS1' });
    const engine = makeEngine([padre]);
    engine.tipoTramo = 'ramal';
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    // Tras dividir: 3 ramales. El downstream empieza exactamente en [20,0].
    const divisor = engine.ramales.find((r) => r.pts[0][1] === 40)!;
    const upstream = engine.ramales.find((r) => r.id !== divisor.id && !r.mergesFrom);
    const downstream = engine.ramales.find((r) => r.mergesFrom)!;
    expect(upstream).toBeDefined();
    expect(downstream).toBeDefined();
    // Simulamos un drift pequeño (>0.5) en el punto de la unión (p. ej. por un arrastre previo)
    // — antes el remerge abortaba (gap > 0.5) y quedaba la mitad huérfana tras borrar el divisor.
    downstream.pts[0] = [20.8, 0];
    deleteSelected(engine, [divisor.id]);
    const sanRamales = engine.ramales.filter((r) => r.net === 'san');
    // El merge cierra el pequeño drift (vuelve a la cuadrícula) y deja UN ramal continuo (sin huérfanos).
    expect(sanRamales).toHaveLength(1);
    expect(sanRamales[0].pts).toEqual([
      [0, 0],
      [20, 0],
      [40, 0],
    ]);
  });

  it('borrar el ramal original con la división aún presente elimina TODA la división', () => {
    const padre = R({ id: 'RS1' });
    const engine = makeEngine([padre]);
    engine.tipoTramo = 'ramal';
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    // División presente: upstream (RS1), downstream (mergesFrom), divisor. Borrar el ORIGINAL
    // (upstream) sin quitar antes el divisor → deben eliminarse TODOS (upstream+downstream+divisor).
    expect(engine.ramales.length).toBe(3);
    const upstream = engine.ramales.find((r) => r.id === 'RS1')!;
    deleteSelected(engine, [upstream.id]);
    expect(engine.ramales.filter((r) => r.net === 'san')).toHaveLength(0);
  });
});
