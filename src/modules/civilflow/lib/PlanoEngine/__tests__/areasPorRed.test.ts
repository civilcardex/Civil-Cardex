import { describe, it, expect } from 'vitest';
import { _renumberAreas } from '../networkRenumber';
import { finishArea } from '../drawingUtils';
import type { IPlanoEngineCore } from '../PlanoState';

// Numeración de áreas POR RED (orig. usuario): cada red lleva su propia serie AREA1..N —
// borrar/crear en una red no altera la serie de las demás.

function makeEngine(): IPlanoEngineCore {
  return {
    areas: [],
    activeNet: 'll',
    activeArea: null,
    scaleM: 0.5,
    _emitSelect: () => {},
    _emitStatus: () => {},
    render: () => {},
    _markDirty: () => {},
  } as unknown as IPlanoEngineCore;
}

const area = (id: string, label: string, net: string) => ({
  id,
  pts: [
    [0, 0],
    [10, 0],
    [10, 10],
  ],
  color: '',
  label,
  labelX: 5,
  labelY: 5,
  labelAngle: 0,
  areaM2: 1,
  net,
});

describe('numeración de áreas por red', () => {
  it('_renumberAreas: cada red renumera su propia serie desde AREA1', () => {
    const eng = makeEngine();
    eng.areas = [
      area('AR300', 'AREA5', 'san'),
      area('AR200', 'AREA1', 'll'),
      area('AR100', 'AREA2', 'san'),
      area('AR400', 'AREA1', 'af'),
    ] as never;
    _renumberAreas(eng as never);
    const lbl = (id: string) => eng.areas.find((a) => a.id === id)?.label;
    // san por antigüedad de id: AR100→AREA1, AR300→AREA2
    expect(lbl('AR100')).toBe('AREA1');
    expect(lbl('AR300')).toBe('AREA2');
    // ll y af INDEPENDIENTES: ambas empiezan en AREA1
    expect(lbl('AR200')).toBe('AREA1');
    expect(lbl('AR400')).toBe('AREA1');
  });

  it('borrar un área de una red NO renumera las de la otra', () => {
    const eng = makeEngine();
    eng.areas = [
      area('AR100', 'AREA1', 'san'),
      area('AR200', 'AREA2', 'san'),
      area('AR300', 'AREA1', 'll'),
    ] as never;
    // Borra AREA1 de san
    eng.areas = eng.areas.filter((a) => a.id !== 'AR100');
    _renumberAreas(eng as never);
    expect(eng.areas.find((a) => a.id === 'AR200')?.label).toBe('AREA1');
    expect(eng.areas.find((a) => a.id === 'AR300')?.label).toBe('AREA1');
  });

  it('finishArea: el consecutivo cuenta SOLO las áreas de la red activa', () => {
    const eng = makeEngine();
    eng.areas = [area('AR100', 'AREA1', 'san'), area('AR200', 'AREA2', 'san')] as never;
    eng.activeNet = 'll';
    eng.activeArea = {
      pts: [
        [0, 0],
        [50, 0],
        [50, 50],
      ],
      color: '',
    } as never;
    finishArea(eng as never);
    const nueva = eng.areas[eng.areas.length - 1];
    expect(nueva.net).toBe('ll');
    expect(nueva.label).toBe('AREA1');
  });
});
