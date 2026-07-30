import { describe, it, expect } from 'vitest';
import { collectConnectedGraph } from '../handleMouseDown';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

function makeRamal(id: string, net: string, pts: number[][]): PlanoRamal {
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
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    bloqueado: true,
  } as PlanoRamal;
}

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  return { ramales, bajantes: [] } as unknown as IPlanoEngineCore;
}

describe('collectConnectedGraph', () => {
  it('pulls in a vent ramal tapped into the INTERIOR vertex of a dragged san ramal', () => {
    const san = makeRamal('RS1', 'san', [
      [0, 0],
      [10, 0],
      [20, 0],
    ]);
    const vent = makeRamal('REV1', 'vent', [
      [10, 0],
      [10, 10],
    ]);
    const engine = makeEngine([san, vent]);

    const { ramales } = collectConnectedGraph(engine, san);

    expect(ramales.map((r) => r.id)).toContain('REV1');
  });

  it('cascades a second hop through the pulled-in ramal (not just direct neighbours)', () => {
    const san = makeRamal('RS1', 'san', [
      [0, 0],
      [10, 0],
      [20, 0],
    ]);
    const vent = makeRamal('REV1', 'vent', [
      [10, 0],
      [10, 10],
    ]);
    const vent2 = makeRamal('REV2', 'vent', [
      [10, 10],
      [15, 10],
    ]);
    const engine = makeEngine([san, vent, vent2]);

    const { ramales } = collectConnectedGraph(engine, san);

    expect(ramales.map((r) => r.id)).toEqual(expect.arrayContaining(['REV1', 'REV2']));
  });

  it('does not pull in an unrelated net that merely crosses nearby without a coincident point', () => {
    const san = makeRamal('RS1', 'san', [
      [0, 0],
      [10, 0],
      [20, 0],
    ]);
    const gas = makeRamal('RG1', 'gas', [
      [10, 5],
      [10, 15],
    ]);
    const engine = makeEngine([san, gas]);

    const { ramales } = collectConnectedGraph(engine, san);

    expect(ramales.map((r) => r.id)).not.toContain('RG1');
  });
});
