import { describe, it, expect } from 'vitest';
import { autoSplitJunctionAndSumFlow } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// C1: el bloqueo "los ramales no se conectan a tributarios" viaja por el RETORNO de
// autoSplitJunctionAndSumFlow, no por una bandera de instancia. Antes, las rutas de drag/guía
// fijaban la bandera sin consumirla y el siguiente ramal válido terminaba borrado.
function mkRamal(id: string, net: string, pts: number[][], tipo = 'ramal'): PlanoRamal {
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
  } as PlanoRamal;
}

function makeEngine(ramales: PlanoRamal[]): { engine: IPlanoEngineCore; alerts: string[] } {
  const alerts: string[] = [];
  const engine = {
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
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    pxToM: (px: number) => px,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: (t: string, m?: string) => alerts.push(m || t),
    _renumberRamales: () => {},
  } as unknown as IPlanoEngineCore;
  return { engine, alerts };
}

describe('autoSplitJunctionAndSumFlow — retorno blocked (C1)', () => {
  it('devuelve true y alerta cuando un ramal aterriza en el vértice de un tributario', () => {
    const t1 = mkRamal(
      'T1',
      'san',
      [
        [0, 0],
        [40, 0],
      ],
      'tributario',
    );
    const { engine, alerts } = makeEngine([t1]);
    const incoming = mkRamal('RS9', 'san', [
      [40, 0],
      [80, 0],
    ]);
    expect(autoSplitJunctionAndSumFlow(engine, incoming)).toBe(true);
    expect(alerts.some((a) => /tributarios/i.test(a))).toBe(true);
  });

  it('devuelve false para una conexión válida y no deja bandera residual en el engine', () => {
    const r1 = mkRamal('RS1', 'san', [
      [0, 0],
      [40, 0],
    ]);
    const { engine } = makeEngine([r1]);
    const incoming = mkRamal('RS9', 'san', [
      [40, 0],
      [80, 0],
    ]);
    expect(autoSplitJunctionAndSumFlow(engine, incoming)).toBe(false);
    expect((engine as unknown as Record<string, unknown>)._ramalConnBlocked).toBeUndefined();
  });

  it('no bloquea cuando el punto es vértice de un ramal normal Y de un tributario', () => {
    const r1 = mkRamal('RS1', 'san', [
      [0, 0],
      [40, 0],
    ]);
    const t1 = mkRamal(
      'T1',
      'san',
      [
        [40, 0],
        [40, 30],
      ],
      'tributario',
    );
    const { engine, alerts } = makeEngine([r1, t1]);
    const incoming = mkRamal('RS9', 'san', [
      [40, 0],
      [80, 0],
    ]);
    expect(autoSplitJunctionAndSumFlow(engine, incoming)).toBe(false);
    expect(alerts.some((a) => /tributarios/i.test(a))).toBe(false);
  });

  it('bloquea también el aterrizaje a mitad de CUERPO de un tributario', () => {
    const t1 = mkRamal(
      'T1',
      'san',
      [
        [0, 0],
        [80, 0],
      ],
      'tributario',
    );
    const { engine, alerts } = makeEngine([t1]);
    const incoming = mkRamal('RS9', 'san', [
      [40, 30],
      [40, 0],
    ]);
    expect(autoSplitJunctionAndSumFlow(engine, incoming)).toBe(true);
    expect(alerts.some((a) => /tributarios/i.test(a))).toBe(true);
  });
});
