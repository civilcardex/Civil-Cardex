import { describe, it, expect } from 'vitest';
import { handleMontanteDown } from '../creations/montantes.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

function mkRamal(id: string, pts: number[][]): PlanoRamal {
  return {
    id,
    net: 'af',
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
    nSalidas: 1,
    material: '',
    diametro: '1/2"',
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
    activeNet: 'af',
    tipoTramo: 'ramal',
    snapMode: false,
    zoom: 1,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { af: { ramal: 1, tributario: 1 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    pxToM: (px: number) => px,
    getBajantesFantasma: () => [],
    toPlane: (x: number, y: number) => ({ x, y }),
    toCvs: (x: number, y: number) => ({ x, y }),
    mm2cvs: (mm: number) => mm,
    snapToExisting: () => null,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: (t: string) => alerts.push(t),
    _renumberRamales: () => {},
    _renumberMontantes: () => {},
    _renumberBajantes: () => {},
    _renumberAreas: () => {},
    _emitDelete: () => {},
  } as unknown as IPlanoEngineCore;
  return { engine, alerts };
}

describe('montante en extremo de ramal: dirección auto-detectada', () => {
  it('en la COLA del flujo (ramal entrega) → direccion sube + codo90rmSube, sin alerta', () => {
    // RAF1: pts[0] es la cola de la flecha (el flujo SALE de ahí hacia el montante).
    const raf1 = mkRamal('RAF1', [
      [40, 0],
      [0, 0],
    ]);
    const { engine, alerts } = makeEngine([raf1]);
    handleMontanteDown(engine, 40, 0);
    expect(alerts).toHaveLength(0);
    const mon = engine.bajantes[0];
    expect(mon?.direccion).toBe('sube');
    expect(raf1.accesorioInicio).toBe('codo90rmSube');
  });

  it('en la CABEZA del flujo (ramal recibe) → direccion baja + codo90rmBaja, sin alerta', () => {
    // RAF1: pts[last] es la cabeza (el flujo LLEGA al extremo donde cae el montante).
    const raf1 = mkRamal('RAF1', [
      [0, 0],
      [40, 0],
    ]);
    const { engine, alerts } = makeEngine([raf1]);
    handleMontanteDown(engine, 40, 0);
    expect(alerts).toHaveLength(0);
    const mon = engine.bajantes[0];
    expect(mon?.direccion).toBe('baja');
    expect(raf1.accesorioFin).toBe('codo90rmBaja');
  });

  it('sin ramal conectado: sin dirección (la elige el usuario)', () => {
    const { engine } = makeEngine([]);
    handleMontanteDown(engine, 10, 10);
    const mon = engine.bajantes[0];
    expect(mon).toBeTruthy();
    expect(mon?.direccion).toBeUndefined();
  });
});
