import { describe, it, expect } from 'vitest';
import { handleGabineteDown } from '../creations/cabinet.ts';
import type { IPlanoEngineCore } from '../PlanoState.ts';

// Gabinete rci (Red Contra Incendio) — FASE 2 RCI: caja pequeña (GABn) que suelta la
// herramienta 'gab' (atajo 'J' con la red rci activa). SOLO rci (guard R6, espejo de los otros
// creadores); el montante que lo alimenta se asigna DESPUÉS en `montante` (código, ej: 'MRCI1').

function makeEngine(activeNet: string): IPlanoEngineCore {
  return {
    ramales: [],
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
    _netCounts: {},
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    pxToM: (px: number) => px,
    toPlane: (x: number, y: number) => ({ x, y }),
    toCvs: (x: number, y: number) => ({ x, y }),
    mm2cvs: (mm: number) => mm,
    snapToExisting: () => null,
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
  } as unknown as IPlanoEngineCore;
}

describe('gabinete: creación GABn', () => {
  it('en rci → GAB1 con net rci, tipo gabinete, seleccionado y sin montante asignado', () => {
    const eng = makeEngine('rci');
    handleGabineteDown(eng, 120, 80);
    const gab = eng.bajantes[0];
    expect(gab?.id).toBe('GAB1');
    expect(gab?.code).toBe('GAB1');
    expect(gab?.net).toBe('rci');
    expect(gab?.tipo).toBe('gabinete');
    expect(gab?.x).toBe(120);
    expect(gab?.y).toBe(80);
    expect(gab?.montante).toBeUndefined();
    expect(eng.selId).toBe('GAB1');
  });

  it('segundo gabinete → GAB2 (consecutivo)', () => {
    const eng = makeEngine('rci');
    handleGabineteDown(eng, 10, 10);
    handleGabineteDown(eng, 60, 60);
    expect(eng.bajantes.map((b) => b.code)).toEqual(['GAB1', 'GAB2']);
  });

  it('borrado GAB1 → el siguiente REUTILIZA el número libre (GAB1, no GAB3)', () => {
    const eng = makeEngine('rci');
    handleGabineteDown(eng, 10, 10);
    handleGabineteDown(eng, 60, 60);
    eng.bajantes = eng.bajantes.filter((b) => b.id !== 'GAB1');
    handleGabineteDown(eng, 90, 90);
    expect(eng.bajantes.map((b) => b.code)).toEqual(['GAB2', 'GAB1']);
  });

  it('guard de red: gabinete creado en rci, se cambia a san → clic con tool gab NO crea nada', () => {
    // ponytail: antes era net-agnostic (heredaba la red activa); el review R6 lo alineó con
    // handleCajaDown/handleBajanteDown — el gabinete es pieza de rci (Red Contra Incendio).
    const eng = makeEngine('rci');
    handleGabineteDown(eng, 10, 10);
    eng.activeNet = 'san';
    handleGabineteDown(eng, 60, 60);
    expect(eng.bajantes).toHaveLength(1);
    expect(eng.bajantes[0]?.net).toBe('rci');
  });

  it('numeración POR RED: un GAB de otra red no consume números (GAB1 libre)', () => {
    const eng = makeEngine('rci');
    // Residuo de otra red (id rancio de una era vieja): no participa en la numeración rci.
    eng.bajantes.push({
      id: 'GAB1',
      net: 'af',
      tipo: 'gabinete',
      code: 'GAB1',
      x: 0,
      y: 0,
      pisoBase: 'P1',
      pisoCima: 'P1',
      nptBase: 0,
      nptCima: 0,
      hVert: 0,
      dNominal: '',
      recibeDeIds: [],
      alimentaIds: [],
      descargaEnId: null,
      ucAcum: 0,
      ucExtra: 0,
      area_m2: 0,
      desplazamientos: {},
      lblOffX: 0,
      lblOffY: 0,
      labelAngle: 0,
      labelX: 0,
      labelY: 20,
      bajR: 7 / 24,
    } as never);
    handleGabineteDown(eng, 10, 10);
    expect(eng.bajantes.filter((b) => b.net === 'rci').map((b) => b.code)).toEqual(['GAB1']);
  });
});
