import { describe, it, expect } from 'vitest';
import { handleMontanteDown, handleCreateMontanteMidBody } from '../creations/montantes.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

// Montante rci (Red Contra Incendio) — FASE 2 RCI: nace con altDeriv 2.5 (altura de la
// derivación en m sobre el npt (nivel de piso topográfico), práctica NFPA) y código MRCIn
// (bmPfx de la red en planoNets). af (Agua Fría) NO trae altDeriv (no significa nada ahí).

function mkRamal(id: string, net: string, pts: number[][]): PlanoRamal {
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
    nSalidas: 1,
    material: '',
    diametro: '4"',
    bloqueado: false,
    showLength: true,
    showName: true,
    showGuide: true,
  } as PlanoRamal;
}

function makeEngine(
  ramales: PlanoRamal[],
  activeNet: string,
): { engine: IPlanoEngineCore; alerts: string[] } {
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
    activeNet,
    tipoTramo: 'ramal',
    snapMode: false,
    zoom: 1,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {},
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

describe('montante rci: altDeriv por defecto + código MRCI', () => {
  it('creado en EXTREMO de ramal rci → nace con altDeriv 2.5, code MRCI1, id MRCI1_rci', () => {
    // RRCI1: el montante cae sobre pts[0] (extremo de arranque).
    const rrci1 = mkRamal('RRCI1', 'rci', [
      [40, 0],
      [0, 0],
    ]);
    const { engine, alerts } = makeEngine([rrci1], 'rci');
    handleMontanteDown(engine, 40, 0);
    expect(alerts).toHaveLength(0);
    const mon = engine.bajantes[0];
    expect(mon?.net).toBe('rci');
    expect(mon?.tipo).toBe('montante');
    expect(mon?.code).toBe('MRCI1');
    expect(mon?.id).toBe('MRCI1_rci');
    expect(mon?.altDeriv).toBe(2.5);
    // El montante queda asociado al ramal (recibeDeIds + asocManual) como en af/ac.
    expect(mon?.recibeDeIds).toEqual(['RRCI1']);
  });

  it('segundo montante rci → numeración MRCI2 (consecutivo por red)', () => {
    const { engine } = makeEngine([], 'rci');
    handleMontanteDown(engine, 10, 10);
    handleMontanteDown(engine, 60, 60);
    expect(engine.bajantes.map((b) => b.code)).toEqual(['MRCI1', 'MRCI2']);
    expect(engine.bajantes.every((b) => b.altDeriv === 2.5)).toBe(true);
  });

  it('montante a MITAD de cuerpo de un ramal rci → también nace con altDeriv 2.5', () => {
    const rrci1 = mkRamal('RRCI1', 'rci', [
      [0, 0],
      [100, 0],
    ]);
    const { engine } = makeEngine([rrci1], 'rci');
    handleCreateMontanteMidBody(engine, 'RRCI1', 50, 0, 0);
    const mon = engine.bajantes[0];
    expect(mon?.code).toBe('MRCI1');
    expect(mon?.altDeriv).toBe(2.5);
    // La auto-tee acompañante vive en el vértice insertado (accMed del ramal).
    expect(rrci1.accMed?.accMed1).toBe('teeSube');
  });

  it('montante af (Agua Fría) NO trae altDeriv (el campo es solo de rci)', () => {
    const raf1 = mkRamal('RAF1', 'af', [
      [40, 0],
      [0, 0],
    ]);
    const { engine } = makeEngine([raf1], 'af');
    handleMontanteDown(engine, 40, 0);
    const mon = engine.bajantes[0];
    expect(mon?.net).toBe('af');
    expect(mon?.altDeriv).toBeUndefined();
  });
});
