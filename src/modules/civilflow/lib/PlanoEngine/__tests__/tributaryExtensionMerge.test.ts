import { describe, it, expect } from 'vitest';
import { finishRamal, handleLineDown } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

function mkRamal(
  id: string,
  net: string,
  pts: number[][],
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
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    activeNet: 'san',
    tipoTramo: 'tributario',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    snapMode: true,
    zoom: 1,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { san: { ramal: 1, tributario: 1 }, vent: { ramal: 0, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    toPlane: (x: number, y: number) => ({ x, y }),
    toCvs: (x: number, y: number) => ({ x, y }),
    mm2cvs: (mm: number) => mm,
    snapToExisting: () => null,
    snapAngle: (_x: number, _y: number, px: number, py: number) => ({ x: px, y: py }),
    _snapToSegment: () => null,
    _ventFirstSegDir: null,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: (t: string, m?: string) => alerts.push(m || t),
    _renumberRamales: () => {},
    _renumberMontantes: () => {},
    _renumberBajantes: () => {},
    _renumberAreas: () => {},
    _emitDelete: () => {},
  } as unknown as IPlanoEngineCore;
  return { engine, alerts };
}

function drawTrib(engine: IPlanoEngineCore, pts: number[][]): void {
  engine.tipoTramo = 'tributario';
  engine.activeRamal = { net: 'san', tipo: 'tributario', padre: null, pts } as never;
  finishRamal(engine);
}

describe('extensión de tributario mergea en el mismo (no crea otro trazo)', () => {
  it('extender la punta libre de un tributario lo alarga, sin nuevo ramal ni alerta', () => {
    // RS1 tronco san; T1 tributario con tee en [40,0] y punta libre en [40,30].
    const rs1 = mkRamal('RS1', 'san', [
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
      'RS1',
    );
    const { engine, alerts } = makeEngine([rs1, t1]);
    const n = engine.ramales.length;
    // Nuevo trazo tributario desde la punta libre [40,30] en 45° hacia arriba-izquierda.
    drawTrib(engine, [
      [40, 30],
      [25, 45],
    ]);
    // No se creó un ramal nuevo: T1 se alargó (3 puntos, mismo id/etiqueta).
    expect(engine.ramales).toHaveLength(n);
    expect(t1.pts).toHaveLength(3);
    expect(t1.pts[2]).toEqual([25, 45]);
    // Sin alerta de dirección de flujo ni de ángulo.
    expect(alerts.some((a) => /flujo|dirección|ángulo/i.test(a))).toBe(false);
  });

  it('un segundo tributario llegando a la TEE del padre NO mergea (crea tributario nuevo)', () => {
    const rs1 = mkRamal('RS1', 'san', [
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
      'RS1',
    );
    const { engine } = makeEngine([rs1, t1]);
    const n = engine.ramales.length;
    // Trazo que llega a [40,0] — la tee con el padre, no la punta libre → no mergea.
    drawTrib(engine, [
      [40, 60],
      [40, 0],
    ]);
    // Se creó un tributario nuevo (no se fusionó con T1).
    expect(engine.ramales.length).toBeGreaterThan(n);
    expect(t1.pts).toHaveLength(2);
  });

  it('extender un ramal principal desde su cola (eStart) NO voltea el flujo', () => {
    // RS1: pts [[0,0],[40,0]], flujo eStart([0,0])→eEnd([40,0]). Ambos extremos libres.
    // Extender desde la cola [0,0] hacia [-15,15] (45°): nStart=[0,0]=eStart → modo
    // nStart-eStart. Antes esto revertía target.pts → el flujo se volteaba. Ahora se
    // revierte el trazo nuevo y target preserva su dirección.
    const rs1 = mkRamal('RS1', 'san', [
      [0, 0],
      [40, 0],
    ]);
    const { engine, alerts } = makeEngine([rs1]);
    const n = engine.ramales.length;
    // El trazo nuevo es tipo 'ramal' aquí (extender un ramal principal).
    engine.tipoTramo = 'ramal';
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [0, 0],
        [-15, 15],
      ],
    } as never;
    finishRamal(engine);
    // Mergea en RS1 (mismo id), sin nuevo ramal.
    expect(engine.ramales).toHaveLength(n);
    expect(rs1.pts).toHaveLength(3);
    // El flujo del target NO se voltea: eEnd original [40,0] sigue siendo el extremo
    // final del merged (la cola original [0,0] queda en el medio como vértice, y el
    // trazo nuevo revierte para alimentarla). merged = [-15,15, 0,0, 40,0].
    expect(rs1.pts[rs1.pts.length - 1]).toEqual([40, 0]);
    expect(rs1.pts[0]).toEqual([-15, 15]);
    expect(alerts.some((a) => /flujo|dirección|ángulo/i.test(a))).toBe(false);
  });

  it('handleLineDown: clic en el inicio de un ramal san y dibujar afuera NO voltea el flujo', () => {
    // Flujo real de UI: handleLineDown crea el trazo, finishRamal lo mergea.
    // RS1 san [[0,0],[40,0]]; clic en la cola [0,0] y dibujar hacia [-15,15].
    const rs1 = mkRamal('RS1', 'san', [
      [0, 0],
      [40, 0],
    ]);
    const { engine, alerts } = makeEngine([rs1]);
    engine.tipoTramo = 'ramal';
    const n = engine.ramales.length;
    handleLineDown(engine, 0, 0);
    handleLineDown(engine, -15, 15);
    finishRamal(engine);
    // Mergea en RS1 (mismo id), sin ramal nuevo.
    expect(engine.ramales).toHaveLength(n);
    expect(rs1.pts).toHaveLength(3);
    // Flujo NO volteado: eEnd original [40,0] sigue siendo el extremo final.
    expect(rs1.pts[rs1.pts.length - 1]).toEqual([40, 0]);
    expect(alerts.some((a) => /flujo|dirección|ángulo/i.test(a))).toBe(false);
  });
});
