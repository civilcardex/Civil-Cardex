import { describe, it, expect, vi } from 'vitest';
import { eraseRamalAt } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

function mkRamal(
  id: string,
  net: string,
  pts: number[][],
  tipo = 'ramal',
  accMed?: Record<string, string>,
): PlanoRamal {
  return {
    id,
    net,
    tipo,
    padre: null,
    pts,
    totalL: 0,
    label: id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    nSalidas: 1,
    material: '',
    diametro: '',
    bloqueado: false,
    showLength: true,
    showName: true,
    showGuide: true,
    accMed,
  } as PlanoRamal;
}

function makeEngine(ramales: PlanoRamal[]): {
  engine: IPlanoEngineCore;
  deleteCalls: string[];
} {
  const deleteCalls: string[] = [];
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    activeNet: 'san',
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px: number) => px,
    toPlane: (x: number, y: number) => ({ x, y }),
    zoom: 1,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    _renumberRamales: () => {},
    _renumberMontantes: () => {},
    _renumberBajantes: () => {},
    _renumberAreas: () => {},
    _emitDelete: () => {},
    deleteSelected: () => {
      const id = engine.selId as string | null;
      deleteCalls.push(String(id));
      engine.ramales = engine.ramales.filter((r) => r.id !== id);
    },
  } as unknown as IPlanoEngineCore;
  return { engine, deleteCalls };
}

describe('borrador: clic en segmento intermedio divide, no borra todo', () => {
  it('ramal de 4 puntos: clic en el segmento medio divide en dos', () => {
    // Polilínea [[0,0],[40,0],[40,40],[80,40]] — 3 segmentos.
    const r = mkRamal('RS1', 'san', [
      [0, 0],
      [40, 0],
      [40, 40],
      [80, 40],
    ]);
    const { engine, deleteCalls } = makeEngine([r]);
    engine.selId = r.id;
    // Clic en el segmento intermedio [40,0]-[40,40] → punto medio [40,20].
    eraseRamalAt(engine, r, 40, 20);
    // No se borró el ramal completo.
    expect(deleteCalls).toHaveLength(0);
    // Quedan 2 ramales (mitad sup + mitad inf).
    expect(engine.ramales).toHaveLength(2);
    const up = engine.ramales.find((x) => x.id === r.id)!;
    const down = engine.ramales.find((x) => x.id !== r.id)!;
    expect(up.pts).toEqual([
      [0, 0],
      [40, 0],
    ]);
    expect(down.pts).toEqual([
      [40, 40],
      [80, 40],
    ]);
  });

  it('ramal de 2 puntos (1 segmento): clic borra completo', () => {
    const r = mkRamal('RS1', 'san', [
      [0, 0],
      [40, 0],
    ]);
    const { engine, deleteCalls } = makeEngine([r]);
    engine.selId = r.id;
    eraseRamalAt(engine, r, 20, 0);
    expect(deleteCalls).toHaveLength(1);
    expect(engine.ramales).toHaveLength(0);
  });

  it('clic en el segmento extremo recorta (no divide)', () => {
    const r = mkRamal('RS1', 'san', [
      [0, 0],
      [40, 0],
      [40, 40],
    ]);
    const { engine, deleteCalls } = makeEngine([r]);
    engine.selId = r.id;
    // Clic cerca del extremo [0,0] (segmento [0,0]-[40,0], lado del vértice 0).
    eraseRamalAt(engine, r, 5, 0);
    expect(deleteCalls).toHaveLength(0);
    expect(engine.ramales).toHaveLength(1);
    expect(r.pts).toEqual([
      [40, 0],
      [40, 40],
    ]);
  });
});
