import { describe, it, expect } from 'vitest';
import {
  findGuideCrossing,
  resolveRamalEndsFromGuide,
  debeVoltearRamalDeGuia,
} from '../../../components/pdfViewer/drawingElementContextMenu/guideOps.ts';
import {
  autoSplitJunctionAndSumFlow,
  flipRamalFlow,
  ramalFlowDirectionCheck,
} from '../PlanoEngineDrawing.ts';
import { recortarEnPrimerCruce } from '../intersectionTrim.ts';
import type { IPlanoEngineCore, PlanoRamal, PlanoGuideLine } from '../PlanoState.ts';
import type PlanoEngine from '../PlanoEngine.ts';

/**
 * Sentido del ramal creado desde línea guía en redes de presión.
 * Orig. usuario: "no debe salir [el modal 'Sentido del tramo nuevo'] cuando se hace un ramal desde
 * la línea guía en redes de presión; se debe voltear como se hace cuando el trazo se hace manual".
 *
 * La guía deja el cruce al FINAL del trazo (útil para san/ll, que drenan hacia la conexión), así
 * que en af/ac/gas el ramal nacía ENTRANDO a la tee. Con dos entradas y sin aparato/fuente en los
 * extremos lejanos (regla 5 del re-enraizado) el motor abría el modal en vez de resolverlo. El
 * dibujo manual desde el tronco deja el ramal SALIENDO de la unión; aquí se replica volteándolo
 * antes del split.
 */

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'RAF1',
    net: 'af',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 100],
      [200, 100],
    ],
    totalL: 0,
    label: 'RAF1',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 100,
    labelY: 100,
    labelAngle: 0,
    material: 'PVC-U',
    diametro: '',
    pendiente: 0,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

function makeEngine(ramales: PlanoRamal[]): { eng: IPlanoEngineCore; alerts: string[] } {
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
    activeNet: 'af',
    _ramalDefaults: { material: 'PVC-U', diametro: '', pendiente: 0 },
    _hiddenNets: new Set<string>(),
    _netCounts: {
      san: { ramal: 0, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 1, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    zoom: 1,
    snapMode: true,
    pxToM: (px: number) => px,
    _loadedPlanId: null,
    render: () => {},
    _markDirty: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    triggerAlert: (t: string) => alerts.push(t),
    getBajantesFantasma: () => [],
    pauseHistory: () => {},
    resumeHistory: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
  } as unknown as IPlanoEngineCore;
  return { eng: engine, alerts };
}

const guide = (pts: [number, number][], net = 'af'): PlanoGuideLine =>
  ({ id: 'GL1', net, pts }) as unknown as PlanoGuideLine;

/** Secuencia de "Crear ramal a partir de línea guía": cruce → orientación de la guía → recorte. */
function trazoDeGuia(eng: IPlanoEngineCore, net: string, pts: [number, number][]) {
  const g = guide(pts, net);
  const crossing = findGuideCrossing(eng as PlanoEngine, g, net);
  let guidePts = resolveRamalEndsFromGuide(eng as PlanoEngine, g, crossing).pts;
  const recorte = recortarEnPrimerCruce(guidePts, eng.ramales, net);
  if (recorte.cortado) guidePts = recorte.pts;
  return { crossing, pts: guidePts };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('ramal desde guía en presión — sentido sin modal', () => {
  it('af: el ramal SALE de la unión y el modal de sentido no sale', async () => {
    const { eng, alerts } = makeEngine([R({})]);
    // Guía vertical que aterriza sobre el cuerpo del tronco af (y = 100).
    const { crossing, pts } = trazoDeGuia(eng, 'af', [
      [50, 20],
      [50, 180],
    ]);
    expect(crossing?.ramalId).toBe('RAF1');

    const newRamal = R({ id: 'RAF2', label: 'RAF2', pts });
    // La guía deja el cruce al final: hay que voltear (misma regla que el trazo manual).
    expect(debeVoltearRamalDeGuia(eng as PlanoEngine, newRamal.pts, 'af')).toBe(true);
    flipRamalFlow(newRamal);
    expect(newRamal.pts[0]).toEqual([50, 100]); // nace EN la unión
    // Ya volteado no se vuelve a voltear (idempotente).
    expect(debeVoltearRamalDeGuia(eng as PlanoEngine, newRamal.pts, 'af')).toBe(false);
    // La validación de dirección que corre antes del push también pasa: el ramal sale de la
    // unión y el tronco corre perpendicular (dot 0, nunca contraflujo).
    expect(ramalFlowDirectionCheck(eng, newRamal, [], 0.5)).toBeNull();

    eng.ramales.push(newRamal);
    autoSplitJunctionAndSumFlow(eng, newRamal);
    await tick();

    expect(alerts).not.toContain('Sentido del tramo nuevo');
    expect(alerts).not.toContain('Conexión sin salida');
    // La T se formó: el tronco quedó partido y el tramo nuevo figura como entrante del split.
    expect(eng.ramales.some((r) => r.mergesFrom?.includes('RAF2'))).toBe(true);
  });

  it('af: sin voltear (comportamiento viejo) el motor pide el sentido — causa raíz', async () => {
    const { eng, alerts } = makeEngine([R({})]);
    const { pts } = trazoDeGuia(eng, 'af', [
      [50, 20],
      [50, 180],
    ]);
    const newRamal = R({ id: 'RAF2', label: 'RAF2', pts });
    // Sin el flip el ramal ENTRA a la tee (dos entradas sin aparato/fuente → regla 5).
    eng.ramales.push(newRamal);
    autoSplitJunctionAndSumFlow(eng, newRamal);
    await tick();

    expect(alerts).toContain('Sentido del tramo nuevo');
  });

  it('la regla depende de la red: san drena HACIA la conexión (no se voltea al llegar)', () => {
    const { eng } = makeEngine([
      R({
        id: 'RS1',
        net: 'san',
        label: 'RS1',
        pts: [
          [0, 100],
          [200, 100],
        ],
      }),
    ]);
    const haciaLaRed: number[][] = [
      [50, 20],
      [50, 100],
    ];
    expect(debeVoltearRamalDeGuia(eng as PlanoEngine, haciaLaRed, 'san')).toBe(false);
    const desdeLaRed: number[][] = [
      [50, 100],
      [50, 20],
    ];
    expect(debeVoltearRamalDeGuia(eng as PlanoEngine, desdeLaRed, 'san')).toBe(true);
  });

  it('no voltea si el ramal termina en el vértice del tronco o en el aire', () => {
    const { eng } = makeEngine([R({})]);
    const alVértice: number[][] = [
      [80, 60],
      [50, 20],
      [0, 100],
    ];
    expect(debeVoltearRamalDeGuia(eng as PlanoEngine, alVértice, 'af')).toBe(false);
    const alAire: number[][] = [
      [50, 20],
      [50, 300],
    ];
    expect(debeVoltearRamalDeGuia(eng as PlanoEngine, alAire, 'af')).toBe(false);
  });
});
