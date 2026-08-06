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

describe('vent tapping onto a straight (no-bend) san run — real production data', () => {
  it("RS2 (a plain 2-point san run) pulls in REV2, whose endpoint sits on RS2's body but not on either of its stored vertices", () => {
    // Coordenadas exactas extraídas del localStorage real del usuario (civilflow_trazos_...).
    // RS2 es un tramo horizontal perfectamente recto SIN ningún vértice cerca del punto de tope de
    // REV2 — el tope queda a ~0.18 unidades de la línea en perpendicular, pero a ~44-66 unidades
    // del punto almacenado real más cercano de RS2. touchesAt (punto contra punto) jamás puede
    // coincidir aquí; solo punto contra segmento lo logra.
    const rs2 = makeRamal('RS2', 'san', [
      [749.2612743545122, 850.3992421667824],
      [858.9923864194926, 850.3992421667824],
    ]);
    const rev2 = makeRamal('REV2', 'vent', [
      [749.555392001571, 894.0462991951603],
      [793.0236519089697, 850.5780392877616],
    ]);
    const engine = makeEngine([rs2, rev2]);

    const { ramales } = collectConnectedGraph(engine, rs2);

    expect(ramales.map((r) => r.id)).toContain('REV2');
  });

  it('RS3 similarly pulls in REV3 (second real pair from the same plan)', () => {
    const rs3 = makeRamal('RS3', 'san', [
      [877.1031274385326, 799.9127457192915],
      [954.3980665820751, 799.9127457192915],
    ]);
    const rev3 = makeRamal('REV3', 'vent', [
      [894.7636778972483, 828.1237548936034],
      [923.0951689642326, 799.7922638266191],
    ]);
    const engine = makeEngine([rs3, rev3]);

    const { ramales } = collectConnectedGraph(engine, rs3);

    expect(ramales.map((r) => r.id)).toContain('REV3');
  });
});
