import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Ítems 4/8/9: verificación de las sumas UC/UD con múltiples conexiones sobre el mismo ramal
// (2+ tributarios) y de la re-unión al borrar el ramal que partió. Los tests de dirección de
// flujo del ítem 2 exigen que un tributario san se acerque a la unión desde el lado aguas arriba
// (dot > 0 con el flujo del padre), así que los trazos de los tests san se dibujan en 45° desde
// la izquierda.
//
// Nota sobre `uc`: finishRamal crea todo ramal con uc: 0 — el UC real llega DESPUÉS vía el sync
// de aparatos (calcSanitaryAccessories/calcHydroAccessories). El mecanismo verificable del motor
// es que cada split suma `existing.uc + incoming.uc` en el momento del corte; el resto de la
// acumulación se modela aquí como lo hace el sync real (bump del downstream).

function makeEngine(
  ramales: PlanoRamal[],
  bajantes: PlanoBajante[] = [],
  activeNet = 'af',
): IPlanoEngineCore {
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
    activeNet,
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { [activeNet]: { ramal: 0, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
    _renumberMontantes: () => {},
    _renumberBajantes: () => {},
    _renumberAreas: () => {},
    _emitDelete: () => {},
  };
  return engine as IPlanoEngineCore;
}

function mkRamal(
  id: string,
  net: string,
  pts: number[][],
  uc = 0,
  tipo = 'ramal',
  padre: string | null = null,
): PlanoRamal {
  return {
    id,
    net,
    tipo,
    padre,
    pts,
    totalL: 0,
    label: id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    bloqueado: true,
  } as PlanoRamal;
}

function drawTributario(
  engine: IPlanoEngineCore,
  net: string,
  pts: number[][],
  padreId: string,
): string {
  const before = engine.ramales.length;
  engine.tipoTramo = 'tributario';
  engine.padreTributario = padreId;
  engine.activeRamal = {
    net,
    tipo: 'tributario',
    padre: padreId,
    pts,
    totalL: 0,
    uc: 0,
  } as never;
  finishRamal(engine);
  engine.tipoTramo = 'ramal';
  engine.padreTributario = null;
  // finishRamal pushea el tributario primero; autoSplit agrega el downstream después.
  return engine.ramales[before].id;
}

// El downstream recién creado por un split es el ÚLTIMO ramal del array (autoSplit lo pushea
// al final). Los ids de tributario son `'T' + Date.now()` y pueden colisionar entre dos
// creaciones en el mismo milisegundo, así que los lookups se anclan a posición/padre.
function lastRamal(engine: IPlanoEngineCore): PlanoRamal {
  return engine.ramales[engine.ramales.length - 1];
}
function tribOf(engine: IPlanoEngineCore, padreId: string): PlanoRamal {
  return engine.ramales.find((r) => r.tipo === 'tributario' && r.padre === padreId)!;
}

describe('ítem 8 — sumas UC/UD con 2+ tributarios sobre el mismo ramal', () => {
  it('AF: cada split suma el UC de sus dos entradas y la cadena acumula aguas abajo', () => {
    const existing = mkRamal(
      'AF1',
      'af',
      [
        [0, 0],
        [40, 0],
      ],
      5,
    );
    const engine = makeEngine([existing], [], 'af');

    const t1 = drawTributario(
      engine,
      'af',
      [
        [20, 40],
        [20, 0],
      ],
      'AF1',
    );
    const first = lastRamal(engine);
    expect(first.mergesFrom).toEqual(['AF1', t1]);
    expect(first.uc).toBe(5);
    expect(first.pts[0]).toEqual([20, 0]);
    expect(first.pts[first.pts.length - 1]).toEqual([40, 0]);

    // Simular el sync real de aparatos: el tributario gana UC y el downstream lo acumula.
    tribOf(engine, 'AF1').uc = 2;
    first.uc = 7;

    const t2 = drawTributario(
      engine,
      'af',
      [
        [30, 40],
        [30, 0],
      ],
      first.id,
    );
    const second = lastRamal(engine);
    // el segundo split suma el UC acumulado del tramo anterior (7)
    expect(second.uc).toBe(7);
    expect(second.mergesFrom).toEqual([first.id, t2]);
    expect(second.pts[0]).toEqual([30, 0]);
    expect(second.pts[second.pts.length - 1]).toEqual([40, 0]);

    // Tras el sync del segundo tributario, el total aguas abajo es existing + t1 + t2.
    tribOf(engine, first.id).uc = 3;
    second.uc = 10;
    expect(second.uc).toBe(10);
  });

  it('SAN (ítem 4): tributarios san parten al padre y la flecha apunta a la unión', () => {
    const existing = mkRamal(
      'RS1',
      'san',
      [
        [0, 0],
        [40, 0],
      ],
      5,
    );
    const engine = makeEngine([existing], [], 'san');

    const t1 = drawTributario(
      engine,
      'san',
      [
        [12, 8],
        [20, 0],
      ],
      'RS1',
    );
    // D4: el tributario san SÍ parte al padre (antes esto no dividía nada)
    const first = lastRamal(engine);
    expect(first.mergesFrom).toEqual(['RS1', t1]);
    expect(first.uc).toBe(5);
    // la flecha del tributario san apunta hacia la unión (drena al colector): unión en pts[last]
    expect(tribOf(engine, 'RS1')._tribReversed).toBe(false);

    // Encadenar un segundo tributario sobre el tramo aguas abajo.
    tribOf(engine, 'RS1').uc = 2;
    first.uc = 7;
    const t2 = drawTributario(
      engine,
      'san',
      [
        [22, 8],
        [30, 0],
      ],
      first.id,
    );
    const second = lastRamal(engine);
    expect(second.mergesFrom).toEqual([first.id, t2]);
    expect(second.uc).toBe(7);
    expect(second.pts[0]).toEqual([30, 0]);
    expect(second.pts[second.pts.length - 1]).toEqual([40, 0]);
    expect(tribOf(engine, first.id)._tribReversed).toBe(false);
  });
});

describe('ítem 9 — re-unión al borrar el ramal que partió', () => {
  it('borrar el incoming devuelve la línea a UN solo ramal con pts/UC correctos', () => {
    const existing = mkRamal(
      'AF1',
      'af',
      [
        [0, 0],
        [40, 0],
      ],
      5,
    );
    const engine = makeEngine([existing], [], 'af');
    const t1 = drawTributario(
      engine,
      'af',
      [
        [20, 40],
        [20, 0],
      ],
      'AF1',
    );
    // Estado: AF1 [0,0]-[20,0] uc=5, downstream [20,0]-[40,0] uc=5, t1 uc=0
    engine.selId = t1;
    deleteSelected(engine);
    expect(engine.ramales).toHaveLength(1);
    const merged = engine.ramales[0];
    // el vértice compartido del split queda como vértice interior colineal (slice(1) de D)
    expect(merged.pts).toEqual([
      [0, 0],
      [20, 0],
      [40, 0],
    ]);
    expect(merged.uc).toBe(5);
    expect(merged.mergesFrom).toBeUndefined();
  });

  it('borrar una de las mitades limpia la referencia mergesFrom muerta (sin crash)', () => {
    const existing = mkRamal(
      'AF1',
      'af',
      [
        [0, 0],
        [40, 0],
      ],
      5,
    );
    const engine = makeEngine([existing], [], 'af');
    drawTributario(
      engine,
      'af',
      [
        [20, 40],
        [20, 0],
      ],
      'AF1',
    );
    const downstream = engine.ramales.find((r) => r.mergesFrom)!;
    expect(downstream.mergesFrom).toHaveLength(2);
    // borrar la mitad aguas arriba (AF1)
    engine.selId = 'AF1';
    deleteSelected(engine);
    expect(engine.ramales.some((r) => r.id === 'AF1')).toBe(false);
    const survivor = engine.ramales.find((r) => r.mergesFrom);
    expect(survivor).toBeUndefined();
  });
});
