import { describe, it, expect } from 'vitest';
import { crearCtxSanJunction } from '../sanJunctionGeometry.ts';
import { detectarJunctiones } from '../sanJunctionDetect.ts';
import { limpiarYeesMuertas, validarTaponesGlobales } from '../sanTaponValidation.ts';
import { contarYeesYTees, contarAccesoriosPorRamal } from '../sanAccessoryCount.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';

/**
 * Caracterización de los módulos extraídos de sanAccessoriesCalc (extracción verbatim): la
 * geometría (ctx), la detección de uniones, la validación de tapones y el conteo por ramal.
 * El flujo completo (ordenas pases + storage) ya queda fijado por los tests de yees vía
 * networkSanitary → calcSanitaryAccessories; aquí se ejercita cada módulo directamente.
 */

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    selId: null,
    activeNet: 'san',
    zoom: 1,
    _loadedPlanId: 1,
    _hiddenNets: new Set(),
    _netCounts: {
      san: { ramal: 1, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    toPlane: (x, y) => ({ x, y }),
    toCvs: (x, y) => ({ x, y }),
    pxToM: (px: number) => px,
    render: () => {},
    _markDirty: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
  };
  return engine as IPlanoEngineCore;
}

const ramal = (o: object) => ({ id: 'RS1', net: 'san', tipo: 'ramal', ...o }) as never;

describe('sanJunctionGeometry (ctx compartido)', () => {
  it('dirsAt cuenta direcciones únicas en un punto (3 tuberías en T = 3)', () => {
    const eng = makeEngine([
      ramal({
        pts: [
          [0, 0],
          [10, 0],
        ],
      }),
      ramal({
        id: 'RS2',
        pts: [
          [10, 0],
          [10, 10],
        ],
      }),
      ramal({
        id: 'RS3',
        pts: [
          [10, 0],
          [20, 0],
        ],
      }),
    ]);
    const ctx = crearCtxSanJunction(
      eng,
      eng.ramales.filter((r) => r.net === 'san'),
    );
    expect(ctx.dirsAt([10, 0])).toBe(3);
    expect(ctx.dirsAt([0, 0])).toBe(1);
  });

  it('persistedYeePairs deduplica la bandera escrita en varios ramales', () => {
    const eng = makeEngine([
      ramal({
        yeeDobleAt: [
          [5, 5],
          [5, 6],
        ],
      }),
      ramal({
        id: 'RS2',
        yeeDobleAt: [
          [5, 5],
          [5, 6],
        ],
      }),
    ]);
    const ctx = crearCtxSanJunction(
      eng,
      eng.ramales.filter((r) => r.net === 'san'),
    );
    expect(ctx.persistedYeePts.length).toBe(4);
    expect(ctx.persistedYeePairs.length).toBe(1);
  });
});

describe('sanJunctionDetect (uniones yee/tee)', () => {
  it('T perpendicular registra tee en el ramal anfitrión', () => {
    const eng = makeEngine([
      ramal({
        pts: [
          [0, 0],
          [10, 0],
        ],
      }),
      ramal({
        id: 'RS2',
        pts: [
          [10, 0],
          [10, 10],
        ],
      }),
      ramal({
        id: 'RS3',
        pts: [
          [10, 0],
          [20, 0],
        ],
      }),
    ]);
    const ctx = crearCtxSanJunction(
      eng,
      eng.ramales.filter((r) => r.net === 'san'),
    );
    const res = detectarJunctiones(eng, ctx);
    expect(res.teeRamalIds.length).toBeGreaterThan(0);
    expect(res.junctionPositions.length).toBe(0);
  });

  it('Y a 45° registra yee en el host no-tributario', () => {
    const eng = makeEngine([
      ramal({
        pts: [
          [0, 0],
          [10, 0],
        ],
      }),
      ramal({
        id: 'RS2',
        pts: [
          [10, 0],
          [15, 5],
        ],
      }),
      ramal({
        id: 'RS3',
        pts: [
          [10, 0],
          [20, 0],
        ],
      }),
    ]);
    const ctx = crearCtxSanJunction(
      eng,
      eng.ramales.filter((r) => r.net === 'san'),
    );
    const res = detectarJunctiones(eng, ctx);
    expect(res.junctionRamalIds.length).toBe(1);
    expect(res.junctionPositions[0].x).toBe(10);
  });
});

describe('sanTaponValidation (tapones y banderas muertas)', () => {
  it('tapón en esquina L (2 direcciones) se retira; en extremo de stub (1 dir) se queda', () => {
    const eng = makeEngine([
      ramal({
        accesorioInicio: 'tapon',
        pts: [
          [0, 0],
          [10, 0],
        ],
      }),
      ramal({
        id: 'RS2',
        pts: [
          [0, 0],
          [0, 10],
        ],
      }),
      // Stub aparte con su tapón legítimo (1 sola dirección en el extremo).
      ramal({
        id: 'RS3',
        accesorioInicio: 'tapon',
        pts: [
          [30, 30],
          [40, 30],
        ],
      }),
    ]);
    const ctx = crearCtxSanJunction(
      eng,
      eng.ramales.filter((r) => r.net === 'san'),
    );
    validarTaponesGlobales(eng, ctx);
    // Tapón retirado en la esquina L: el codo de plano lo sustituye (assignCodoAfterBranchDelete).
    expect((eng.ramales[0] as unknown as { accesorioInicio: string }).accesorioInicio).toBe(
      'codo90rm',
    );
    expect((eng.ramales[2] as unknown as { accesorioInicio: string }).accesorioInicio).toBe(
      'tapon',
    );
  });

  it('limpiarYeesMuertas retira bandera cuya unión ya no existe', () => {
    const eng = makeEngine([
      ramal({
        pts: [
          [50, 50],
          [60, 50],
        ],
        yeeDobleAt: [
          [50, 50],
          [50, 51],
        ],
      }),
    ]);
    const ctx = crearCtxSanJunction(
      eng,
      eng.ramales.filter((r) => r.net === 'san'),
    );
    limpiarYeesMuertas(eng, ctx, []); // ninguna unión viva
    expect(
      (eng.ramales[0] as unknown as { yeeDobleAt: number[][] | undefined }).yeeDobleAt,
    ).toBeUndefined();
  });
});

describe('sanAccessoryCount (conteo por ramal)', () => {
  it('contarYeesYTees clasifica simple/doble por el par persistido', () => {
    const eng = makeEngine([
      ramal({
        pts: [
          [0, 0],
          [10, 0],
        ],
      }),
      ramal({
        id: 'RS2',
        pts: [
          [10, 0],
          [15, 5],
        ],
      }),
      ramal({
        id: 'RS3',
        pts: [
          [10, 0],
          [20, 0],
        ],
      }),
    ]);
    const ctx = crearCtxSanJunction(
      eng,
      eng.ramales.filter((r) => r.net === 'san'),
    );
    const junction = detectarJunctiones(eng, ctx);
    const { yeeCounts } = contarYeesYTees(ctx, junction);
    expect(yeeCounts['RS1']).toEqual({ simple: 1, doble: 0 });
  });

  it('contarAccesoriosPorRamal sincroniza sifón explícito con hidroData', () => {
    const eng = makeEngine([
      ramal({
        accesorioInicio: 'sifon',
        pts: [
          [0, 0],
          [10, 0],
        ],
      }),
    ]);
    const ctx = crearCtxSanJunction(
      eng,
      eng.ramales.filter((r) => r.net === 'san'),
    );
    const hidro: Record<
      string,
      { accesorios: Record<string, number>; Lh: number; nSalidas: number }
    > = {};
    const changed = contarAccesoriosPorRamal(
      ctx,
      { yeeCounts: {}, teeCounts: {} },
      eng.ramales.filter((r) => r.net === 'vent'),
      '1',
      hidro,
    );
    expect(changed).toBe(true);
    expect(hidro['san_RS1_1'].accesorios['sifon']).toBe(1);
    // ponytail: cada sifón implica un codo 90° sube (contrato del conteo).
    expect(hidro['san_RS1_1'].accesorios['codo90rmSube']).toBe(1);
  });

  it('contarAccesoriosPorRamal BORRA el sifón cuando el dibujo ya no lo tiene', () => {
    const eng = makeEngine([
      ramal({
        pts: [
          [0, 0],
          [10, 0],
        ],
      }),
    ]);
    const ctx = crearCtxSanJunction(
      eng,
      eng.ramales.filter((r) => r.net === 'san'),
    );
    const hidro: Record<
      string,
      { accesorios: Record<string, number>; Lh: number; nSalidas: number }
    > = {
      san_RS1_1: { accesorios: { sifon: 1, codo90rmSube: 1 }, Lh: 0, nSalidas: 0 },
    };
    const changed = contarAccesoriosPorRamal(ctx, { yeeCounts: {}, teeCounts: {} }, [], '1', hidro);
    expect(changed).toBe(true);
    expect(hidro['san_RS1_1'].accesorios['sifon']).toBeUndefined();
  });
});
