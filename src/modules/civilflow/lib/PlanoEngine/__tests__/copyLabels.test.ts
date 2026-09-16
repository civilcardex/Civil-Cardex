import { describe, it, expect, beforeEach } from 'vitest';
import { copyDrawingFromPlan } from '../../../utils/copyDrawingFromPlan';
import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../PlanoState';

// Observación: qué labels llegan al piso destino al copiar bajante+ramal+tributario.

function makeEngine(): IPlanoEngineCore {
  return {
    _loadedPlanId: '2',
    ramales: [],
    bajantes: [],
    dims: [],
    areas: [],
    textAnnots: [],
    crossFloorGhosts: [],
    _hiddenNets: new Set<string>(),
    _netCounts: {},
    zoom: 1,
    scaleM: 0.5,
    nivelActual: { label: 'P2', n: 2, npt: 3200 },
    updateElementById: () => {},
    render: () => {},
    _markDirty: () => {},
    saveWork: () => ({ ramales: [], bajantes: [], dims: [] }),
  } as unknown as IPlanoEngineCore;
}

beforeEach(() => {
  localStorage.clear();
  // Origen piso 1: BAN1 + RS1 (conectado) + tributario T1RS1.
  localStorage.setItem(
    'civilflow_trazos_1',
    JSON.stringify({
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          label: 'RS1',
          pts: [
            [0, 0],
            [100, 0],
          ],
          ini: 'BAN1',
        },
        {
          id: 'T1RS1x',
          net: 'san',
          tipo: 'tributario',
          label: 'T1RS1',
          padre: 'RS1',
          pts: [
            [100, 0],
            [120, 40],
          ],
        },
      ],
      bajantes: [{ id: 'BAN1', net: 'san', tipo: 'bajante', code: 'BAN1', x: 0, y: 0 }],
    }),
  );
});

it('piso destino con BAN1 y RS1 ya existentes: copia toma BAN2 + RS2 y el tributario T1RS2', () => {
  const eng = makeEngine();
  eng.bajantes.push({
    id: 'BAN1',
    net: 'san',
    tipo: 'bajante',
    code: 'BAN1',
    x: 500,
    y: 500,
  } as never);
  eng.ramales.push({
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    label: 'RS1',
    pts: [
      [500, 500],
      [600, 500],
    ],
  } as never);
  copyDrawingFromPlan(eng as never, '2', '1', [
    { netId: 'san', tipos: new Set(['ramal', 'tributario', 'bajante']) },
  ]);
  // Consecutivos DEL PISO destino: bajante BAN2, ramal RS2, y el tributario referencia a su
  // padre RENOMBRADO (T1RS2, no T1RS1 del piso origen).
  expect(eng.bajantes.some((b) => b.id === 'BAN2' && b.code === 'BAN2')).toBe(true);
  const copiado = eng.ramales.find((r) => r.id === 'RS2') as PlanoRamal | undefined;
  expect(copiado?.label).toBe('RS2');
  expect(copiado?.ini).toBe('BAN2');
  const trib = eng.ramales.find((r) => r.tipo === 'tributario') as PlanoRamal | undefined;
  expect(trib?.label).toBe('T1RS2');
  expect(trib?.padre).toBe('RS2');
});

describe('copia', () => {
  it('observar labels tras copiar a piso 2', () => {
    const eng = makeEngine();
    const res = copyDrawingFromPlan(eng as never, '2', '1', [
      { netId: 'san', tipos: new Set(['ramal', 'tributario', 'bajante']) },
    ]);
    console.log(
      'COPIA:',
      JSON.stringify({
        ramales: eng.ramales.map((r: PlanoRamal) => ({
          id: r.id,
          label: r.label,
          ini: r.ini,
          padre: r.padre,
        })),
        bajantes: eng.bajantes.map((b: PlanoBajante) => ({ id: b.id, code: b.code })),
        res,
      }),
    );
    expect(true).toBe(true);
  });
});
