import { describe, it, expect } from 'vitest';
import {
  findGuideCrossing,
  getPadreHostAngles,
  guideAngleAlertMessage,
  isGuideRelativeAngleValid,
  resolveGuideNet,
  buildTribFromGuide,
} from '../../../components/pdfViewer/drawingElementContextMenu/guideOps.ts';
import { recortarEnPrimerCruce, primerCruceEstricto } from '../intersectionTrim.ts';
import type { IPlanoEngineCore, PlanoRamal, PlanoGuideLine } from '../PlanoState.ts';
import type PlanoEngine from '../PlanoEngine.ts';

/**
 * Matriz de reglas por RED y recorte de excedentes.
 * Orig. usuario: (1) "la red seleccionada manda, nunca apliques reglas de otra red" — una guía
 * san que pasaba cerca de un ramal AF mostraba el mensaje de 90°; (2) en san/ll el giro válido es
 * 45° (sin snap también); (3) el trazo que se pasa del punto de unión se RECORTA en el cruce, no
 * se rechaza.
 */

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

function makeEngine(ramales: PlanoRamal[], net = 'san'): IPlanoEngineCore {
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
    activeNet: net,
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

const asEngine = (eng: IPlanoEngineCore): PlanoEngine => eng as unknown as PlanoEngine;
const guide = (pts: [number, number][], net = 'san'): PlanoGuideLine =>
  ({ id: 'GL1', net, pts }) as unknown as PlanoGuideLine;

describe('la red SELECCIONADA manda en la línea guía', () => {
  it('guía san que cruza un ramal AF (más cerca de la punta) usa el cruce san y su mensaje de 45°', () => {
    const af = R({
      id: 'RAF1',
      net: 'af',
      label: 'RAF1',
      pts: [
        [0, 110],
        [200, 110],
      ],
    });
    const san = R({
      id: 'RS1',
      net: 'san',
      label: 'RS1',
      pts: [
        [0, 100],
        [200, 100],
      ],
    });
    const eng = makeEngine([af, san]);
    const g = guide([
      [50, 20],
      [50, 120],
    ]);

    // Sin filtro (compat) el cruce elegido es el AF: está a 10 de la punta y el san a 20.
    expect(findGuideCrossing(asEngine(eng), g)?.ramalId).toBe('RAF1');
    // Con la red seleccionada, el AF no es candidato.
    expect(findGuideCrossing(asEngine(eng), g, 'san')?.ramalId).toBe('RS1');

    // Y el mensaje es el de la red seleccionada, no el de 90° de AF/AC.
    const msg = guideAngleAlertMessage('san', 'ramal');
    expect(msg).toContain('45°');
    expect(msg).not.toContain('90°');
    expect(resolveGuideNet(asEngine(eng), g)).toBe('san');
  });

  it('la red activa (seleccionada) manda sobre la red con la que se dibujó la guía', () => {
    const eng = makeEngine([], 'ac');
    expect(
      resolveGuideNet(
        asEngine(eng),
        guide(
          [
            [0, 0],
            [10, 10],
          ],
          'san',
        ),
      ),
    ).toBe('ac');
  });
});

describe('matriz angular por red (isGuideRelativeAngleValid)', () => {
  const host90 = Math.PI / 2; // anfitrión vertical
  const host0 = 0; // anfitrión horizontal

  it('presión: SOLO 90° contra el trazo, también sin snap', () => {
    expect(isGuideRelativeAngleValid([0, 0], [50, 0], host90, 'af', 'ramal', false)).toBe(true);
    expect(isGuideRelativeAngleValid([0, 0], [50, 0], host90, 'ac', 'ramal', false)).toBe(true);
    expect(isGuideRelativeAngleValid([0, 0], [50, 0], host90, 'gas', 'ramal', false)).toBe(true);
    // 45° contra el anfitrión NO vale en presión (antes, con snap apagado, entraba cualquiera).
    expect(isGuideRelativeAngleValid([0, 0], [50, 50], host0, 'af', 'ramal', false)).toBe(false);
    expect(isGuideRelativeAngleValid([0, 0], [50, 50], host0, 'gas', 'ramal', true)).toBe(false);
  });

  it('san/ll: giro de 45° (a un lado o al otro) y nada más', () => {
    expect(isGuideRelativeAngleValid([0, 0], [50, 50], host0, 'san', 'ramal', true)).toBe(true);
    expect(isGuideRelativeAngleValid([0, 0], [-50, 50], host0, 'san', 'ramal', true)).toBe(true);
    expect(isGuideRelativeAngleValid([0, 0], [-50, 50], host0, 'll', 'tributario', false)).toBe(
      true,
    );
    // 90° contra el anfitrión NO es válido en sanitaria.
    expect(isGuideRelativeAngleValid([0, 0], [50, 0], host90, 'san', 'ramal', true)).toBe(false);
    expect(isGuideRelativeAngleValid([-50, 0], [0, 0], host0, 'll', 'ramal', true)).toBe(false);
  });

  it('vent: conserva su ruteo libre de múltiplos de 45°', () => {
    expect(isGuideRelativeAngleValid([0, 0], [50, 0], host90, 'vent', 'ramal', true)).toBe(true);
    expect(isGuideRelativeAngleValid([0, 0], [50, 50], host0, 'vent', 'ramal', true)).toBe(true);
    expect(isGuideRelativeAngleValid([0, 0], [50, 10], host0, 'vent', 'ramal', true)).toBe(false);
  });

  it('los mensajes de alerta son los de la red (nunca los de otra)', () => {
    expect(guideAngleAlertMessage('af', 'ramal')).toContain('90°');
    expect(guideAngleAlertMessage('gas', 'tributario')).toContain('90°');
    expect(guideAngleAlertMessage('ll', 'ramal')).toContain('45°');
    expect(guideAngleAlertMessage('vent', 'tributario')).toContain('45°');
  });
});

describe('cruce de guía: estricto, en vértices y colineal', () => {
  it('un ramal que pasa a 8 px NO es un cruce (antes se proyectaba con 12 px de tolerancia)', () => {
    const eng = makeEngine([R({})]);
    expect(
      findGuideCrossing(
        asEngine(eng),
        guide([
          [20, -30],
          [50, -8],
        ]),
        'san',
      ),
    ).toBeNull();
  });

  it('en un vértice del padre devuelve los DOS segmentos incidentes (el válido se puede elegir)', () => {
    const padre = R({
      pts: [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
    });
    const angs = getPadreHostAngles(padre, [100, 0])
      .map((a) => Math.round(((((a * 180) / Math.PI) % 180) + 180) % 180))
      .sort((a, b) => a - b);
    expect(angs).toEqual([0, 90]);
  });

  it('guía colineal sobre el ramal: hay cruce (antes devolvía null)', () => {
    const eng = makeEngine([R({})]);
    const hit = findGuideCrossing(
      asEngine(eng),
      guide([
        [-50, 0],
        [150, 0],
      ]),
      'san',
    );
    expect(hit).not.toBeNull();
    expect(hit!.point[1]).toBeCloseTo(0, 6);
    expect(hit!.point[0]).toBeGreaterThanOrEqual(0);
    expect(hit!.point[0]).toBeLessThanOrEqual(100);
  });
});

describe('recorte del excedente en el primer cruce (intersectionTrim)', () => {
  const host = [
    {
      id: 'RS1',
      net: 'san',
      pts: [
        [50, -50],
        [50, 50],
      ],
    },
  ];

  it('corta justo en el cruce con el cuerpo del ramal', () => {
    const res = recortarEnPrimerCruce(
      [
        [0, 0],
        [100, 0],
      ],
      host,
      'san',
    );
    expect(res.cortado).toBe(true);
    expect(res.cruce?.ramalId).toBe('RS1');
    expect(res.pts[res.pts.length - 1]).toEqual([50, 0]);
  });

  it('el aterrizaje en la punta NO se recorta (es la unión)', () => {
    const res = recortarEnPrimerCruce(
      [
        [0, 0],
        [50, 0],
      ],
      host,
      'san',
    );
    expect(res.cortado).toBe(false);
    expect(
      primerCruceEstricto(
        [
          [0, 0],
          [50, 0],
        ],
        host,
        'san',
      ),
    ).toBeNull();
  });

  it('un contacto en el vértice del anfitrión no es un corte de cuerpo', () => {
    const vertice = [
      {
        id: 'RS2',
        net: 'san',
        pts: [
          [50, 0],
          [50, 50],
        ],
      },
    ];
    expect(
      primerCruceEstricto(
        [
          [0, 0],
          [100, 0],
        ],
        vertice,
        'san',
      ),
    ).toBeNull();
  });

  it('otra red no recorta', () => {
    const af = [
      {
        id: 'RAF1',
        net: 'af',
        pts: [
          [50, -50],
          [50, 50],
        ],
      },
    ];
    expect(
      recortarEnPrimerCruce(
        [
          [0, 0],
          [100, 0],
        ],
        af,
        'san',
      ).cortado,
    ).toBe(false);
  });

  it('dentro del cuadro de una caja no se recorta (entrar a la caja no es cruzar)', () => {
    const res = recortarEnPrimerCruce(
      [
        [0, 0],
        [100, 0],
      ],
      host,
      'san',
      {
        dentroDeCaja: (p) => Math.hypot(p[0] - 50, p[1]) < 20,
      },
    );
    expect(res.cortado).toBe(false);
  });
});

describe('tributario desde línea guía que se pasa del punto de unión', () => {
  it('se recorta en el tramo que atraviesa y forma la unión ahí', () => {
    // Padre horizontal af; un segundo ramal af paralelo 30 px arriba; la guía sube desde -80.
    const padre = R({
      id: 'RAF1',
      net: 'af',
      label: 'RAF1',
      pts: [
        [0, 0],
        [100, 0],
      ],
    });
    const paralelo = R({
      id: 'RAF2',
      net: 'af',
      label: 'RAF2',
      pts: [
        [60, -30],
        [100, -30],
      ],
    });
    const eng = makeEngine([padre, paralelo], 'af');
    const trib = buildTribFromGuide(asEngine(eng), padre, [80, 0], [80, -80], 'T1');
    expect(trib).not.toBeNull();
    const fin = trib!.pts[trib!.pts.length - 1];
    expect(fin[0]).toBeCloseTo(80, 6);
    expect(fin[1]).toBeCloseTo(-30, 6);
    // El ramal atravesado se partió en la unión (T real, no un cruce suelto).
    expect(eng.ramales.some((r) => r.mergesFrom?.[1] === trib!.id)).toBe(true);
  });
});
