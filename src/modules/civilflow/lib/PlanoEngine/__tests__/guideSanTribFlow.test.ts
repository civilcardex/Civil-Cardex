import { describe, it, expect } from 'vitest';
import {
  buildTribFromGuide,
  resolveRamalEndsFromGuide,
} from '../../../components/pdfViewer/drawingElementContextMenu/guideOps';
import type { IPlanoEngineCore, PlanoRamal, PlanoGuideLine } from '../PlanoState';
import type PlanoEngine from '../PlanoEngine';

// Guía san sobre ramal este-oeste: el tributario nace [freeEnd → cruce] y drena HACIA la
// unión — su flecha debe apuntar al cruce (_tribReversed falsy) en todos los casos.
// Regresión orig. usuario: en unión extremo-con-extremo la flecha salía invertida.

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const alerts: string[] = [];
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    activeNet: 'san',
    _ramalDefaults: { material: 'PVC-S', diametro: '', pendiente: 2 },
    _netCounts: {
      san: { ramal: 1, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    zoom: 1,
    snapMode: true,
    pxToM: (px) => px,
    render: () => {},
    _markDirty: () => {},
    _emitSelect: () => {},
    triggerAlert: (t: string) => alerts.push(t),
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
  };
  (engine as unknown as { alerts: string[] }).alerts = alerts;
  return engine as IPlanoEngineCore;
}

const alertsOf = (eng: IPlanoEngineCore): string[] =>
  (eng as unknown as { alerts: string[] }).alerts;

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [100, 0],
    ],
    totalL: 0,
    label: 'RS1',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 50,
    labelY: 0,
    labelAngle: 0,
    material: 'PVC-S',
    diametro: '',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

const asEngine = (eng: IPlanoEngineCore): PlanoEngine => eng as unknown as PlanoEngine;

describe('guía san — tributario con flujo hacia la unión', () => {
  it('mitad de cuerpo a favor del flujo: flecha al cruce + split', () => {
    const padre = R({});
    const eng = makeEngine([padre]);
    const trib = buildTribFromGuide(asEngine(eng), padre, [50, 0], [30, -20], 'T1');
    expect(trib).not.toBeNull();
    expect(trib!._tribReversed).toBeFalsy();
    // El padre se partió (existing + downstream con mergesFrom).
    expect(eng.ramales.some((r) => r.mergesFrom?.[1] === trib!.id)).toBe(true);
    expect(alertsOf(eng).some((a) => a.includes('Dirección'))).toBe(false);
    // El padre/label del tributario es el ramal AUTO-CREADO (downstream), no el tramo aguas
    // arriba truncado — el tributario drena al segmento nuevo (orig. usuario: T2RS9 → T2RS8).
    const down = eng.ramales.find((r) => r.mergesFrom?.[1] === trib!.id)!;
    expect(trib!.padre).toBe(down.id);
    expect(trib!.label).toBe(`T1${down.label}`);
  });

  it('mitad de cuerpo en contra del flujo: flecha al cruce + split', () => {
    const padre = R({});
    const eng = makeEngine([padre]);
    const trib = buildTribFromGuide(asEngine(eng), padre, [50, 0], [70, -20], 'T2');
    expect(trib).not.toBeNull();
    expect(trib!._tribReversed).toBeFalsy();
    expect(eng.ramales.some((r) => r.mergesFrom?.[1] === trib!.id)).toBe(true);
  });

  it('extremo del padre en contra del flujo: flecha al cruce (sin split que la corrija)', () => {
    const padre = R({});
    const eng = makeEngine([padre]);
    // Cruce exacto en el vértice final del padre (lo que deja snapGuideCrossingToEndpoint).
    const trib = buildTribFromGuide(asEngine(eng), padre, [100, 0], [120, -20], 'T3');
    expect(trib).not.toBeNull();
    expect(trib!._tribReversed).toBeFalsy();
  });

  it('extremo del padre a favor del flujo: flecha al cruce', () => {
    const padre = R({});
    const eng = makeEngine([padre]);
    const trib = buildTribFromGuide(asEngine(eng), padre, [100, 0], [80, -20], 'T4');
    expect(trib).not.toBeNull();
    expect(trib!._tribReversed).toBeFalsy();
  });

  it('unión extremo-con-extremo: el receptor que nace en la unión es el padre (T2RS8, no T2RS7)', () => {
    // Escenario de la captura del usuario: RS7 termina en la unión y RS8 nace en ella — el
    // tributario que aterriza en el vértice (sin split) debe etiquetarse con RS8.
    const rs7 = R({
      id: 'RS7',
      label: 'RS7',
      pts: [
        [0, 0],
        [100, 0],
      ],
    });
    const rs8 = R({
      id: 'RS8',
      label: 'RS8',
      pts: [
        [100, 0],
        [200, 0],
      ],
    });
    const eng = makeEngine([rs7, rs8]);
    const trib = buildTribFromGuide(asEngine(eng), rs7, [100, 0], [120, -20], 'T5');
    expect(trib).not.toBeNull();
    expect(trib!.padre).toBe('RS8');
    expect(trib!.label).toBe('T1RS8');
  });

  it('unión extremo-con-extremo sin receptor aguas abajo: label del padre intacto', () => {
    // El cruce cae en el vértice INICIAL del padre (no nace ningún ramal allí) — nada que
    // re-asignar.
    const padre = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [100, 0],
        [200, 0],
      ],
    });
    const eng = makeEngine([padre]);
    const trib = buildTribFromGuide(asEngine(eng), padre, [100, 0], [120, -20], 'T6');
    expect(trib).not.toBeNull();
    expect(trib!.padre).toBe('RS1');
    expect(trib!.label).toBe('T1RS1');
  });
});

// "Crear ramal" debe anclar el extremo cercano al cruce exacto: si no, el ramal flota a >0.5px
// sin split/UD y el menú nunca ofrece "Convertir en tributario" (orig. usuario).
describe('guía — crear ramal ancla al cruce', () => {
  const guide = (pts: [number, number][]): PlanoGuideLine =>
    ({ id: 'GL1', net: 'san', pts }) as unknown as PlanoGuideLine;

  it('extremo corto del cruce se extiende hasta él', () => {
    const padre = R({});
    const eng = makeEngine([padre]);
    const { pts } = resolveRamalEndsFromGuide(
      asEngine(eng),
      guide([
        [50, -60],
        [50, -3],
      ]),
      {
        point: [50, 0],
        ramalId: 'RS1',
      },
    );
    expect(pts[0]).toEqual([50, -60]);
    // El cercano cae EXACTO sobre el cruce (antes quedaba en [50,-3], flotando).
    expect(pts[pts.length - 1]).toEqual([50, 0]);
  });

  it('cruce cerca del vértice ajusta al vértice exacto', () => {
    const padre = R({});
    const eng = makeEngine([padre]);
    const { pts } = resolveRamalEndsFromGuide(
      asEngine(eng),
      guide([
        [120, -30],
        [101, -1],
      ]),
      {
        point: [99, 0],
        ramalId: 'RS1',
      },
    );
    expect(pts[pts.length - 1]).toEqual([100, 0]);
  });

  it('sin cruce conserva los extremos de la guía', () => {
    const padre = R({});
    const eng = makeEngine([padre]);
    const { pts } = resolveRamalEndsFromGuide(
      asEngine(eng),
      guide([
        [200, 0],
        [260, 0],
      ]),
      null,
    );
    expect(pts[0]).toEqual([200, 0]);
    expect(pts[pts.length - 1]).toEqual([260, 0]);
  });

  it('ítem 2: guía en L produce ramal multisegmento anclado al cruce', () => {
    const padre = R({});
    const eng = makeEngine([padre]);
    const { pts } = resolveRamalEndsFromGuide(
      asEngine(eng),
      guide([
        [50, -60],
        [50, -30],
        [80, -30],
        [80, -3],
      ]),
      {
        point: [80, 0],
        ramalId: 'RS1',
      },
    );
    // Lado lejano completo (4 vértices + cruce anclado), flujo hacia el cruce.
    expect(pts.length).toBe(5);
    expect(pts[0]).toEqual([50, -60]);
    expect(pts[pts.length - 1]).toEqual([80, 0]);
  });
});
