import { describe, it, expect } from 'vitest';
import { handleLineDown, finishRamal } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore } from '../PlanoState';

// Red vent nace en 2" (trazos a mano, tributarios y desde guía — igual que sus
// bajantes/montantes). Otras redes nacen vacías (cierran con "Diámetros pendientes").

function makeEngine(alerts: string[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    activeNet: 'vent',
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    snapMode: false,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 0, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px) => px,
    cmToPlanePx: (c) => c,
    cmToCanvasPx: (c) => c,
    toCvs: (x, y) => ({ x, y }),
    toPlane: (x, y) => ({ x, y }),
    realMmToCanvasPx: (mm) => mm,
    mm2cvs: (mm) => mm,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: ((t: string, m: string) => {
      alerts.push(`${t} | ${m}`);
    }) as never,
    triggerAccesorioModal: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
    zoom: 1,
    offX: 0,
    offY: 0,
    multiSel: [],
    snapToExisting: () => null,
    snapAngle: (_x, _y, _px, _py) => ({ x: _px, y: _py }),
    _snapToSegment: () => null,
    _ventFirstSegDir: null,
  };
  return engine as unknown as IPlanoEngineCore;
}

function drawNet(alerts: string[], net: string) {
  const eng = makeEngine(alerts);
  eng.activeNet = net;
  handleLineDown(eng, 0, 0);
  handleLineDown(eng, 100, 0);
  finishRamal(eng);
  return eng;
}

describe('vent nace en 2"', () => {
  it('ramal vent dibujado a mano nace con 2" y sin alerta', () => {
    const alerts: string[] = [];
    const eng = drawNet(alerts, 'vent');
    expect(alerts).toEqual([]);
    expect(eng.ramales).toHaveLength(1);
    expect(eng.ramales[0].diametro).toBe('2"');
  });

  it('ramal san sigue naciendo vacío (control)', () => {
    const alerts: string[] = [];
    const eng = drawNet(alerts, 'san');
    expect(eng.ramales).toHaveLength(1);
    expect(eng.ramales[0].diametro).toBe('');
  });
});
