import { describe, it, expect } from 'vitest';
import { autoSplitJunctionAndSumFlow } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// 'Conexión sin entrada' RETIRADA (orig. usuario: lavamanos+tina con flechas hacia sus
// extremos = ninguna pieza ENTRA a la T — el split igual se forma para propagar al rack).
function mkRamal(
  id: string,
  net: string,
  pts: number[][],
  extra: Partial<PlanoRamal> = {},
): PlanoRamal {
  return {
    id,
    net,
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label: id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    material: '',
    diametro: '',
    bloqueado: false,
    ...extra,
  } as PlanoRamal;
}

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  return {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    activeNet: 'ac',
    tipoTramo: 'ramal',
    padreTributario: null,
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    pxToM: (px: number) => px,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
  } as unknown as IPlanoEngineCore;
}

describe('autoSplit sin ramal entrante (doctrina 2026-10-15)', () => {
  // T con las 3 ramas apuntando HACIA AFUERA del punto (cola en el nudo = salidas): la
  // configuración del usuario (lavamanos+tina hacia RAC6) ya no se bloquea ni se salta.
  it('el split SE FORMA aunque ninguna pieza entre al nudo', () => {
    // RAC5 horizontal con cola en el nudo [100,0]; T1RAC4 vertical hacia abajo (cola arriba).
    const rac5 = mkRamal('RAC5', 'ac', [
      [100, 0],
      [40, 0],
    ]);
    const t1rac4 = mkRamal('T1RAC4', 'ac', [
      [100, 0],
      [100, 60],
    ]);
    const engine = makeEngine([rac5, t1rac4]);
    const incoming = mkRamal('RAC1', 'ac', [
      [160, 0],
      [100, 0],
    ]);
    const alerts: string[] = [];
    const eng = engine as unknown as { triggerAlert: (t: string, m?: string) => void };
    eng.triggerAlert = (t: string, m?: string) => alerts.push(m || t);
    // El caller (junctionAutoSplit/finishRamal) agrega el incoming ANTES de partir.
    engine.ramales.push(incoming);
    const blocked = autoSplitJunctionAndSumFlow(engine, incoming);
    expect(blocked).toBe(false);
    expect(alerts.some((a) => /sin entrada/i.test(a))).toBe(false);
    // El nudo quedó partido: las piezas del usuario + la continuación existen.
    expect(engine.ramales.length).toBeGreaterThanOrEqual(3);
  });
});
