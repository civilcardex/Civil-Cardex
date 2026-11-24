// @vitest-environment jsdom
import { useEffect } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { renderEnJsdom } from '../../../../../test/render.tsx';
import type { PlanItem } from '../../../context/PlansContext.tsx';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoWorkData } from '../../../lib/PlanoEngine/PlanoPersistence.ts';
import {
  loadTrazosFromDB,
  saveTrazosToDB,
  saveToStorage,
} from '../../../services/storageService.ts';
import { useTrazosLoader } from '../useStrokesLoader.ts';

vi.mock('../../../services/storageService.ts', async (original) => ({
  ...(await original<typeof import('../../../services/storageService.ts')>()),
  loadTrazosFromDB: vi.fn(),
  saveTrazosToDB: vi.fn(),
}));
vi.mock('../../../utils/assocLayoutMigration.ts', () => ({
  migrateAssocLayoutOnLoad: vi.fn(),
  sweepMisplacedLdesvios: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

async function abrir(plano: Partial<PlanItem>) {
  const motor = {
    _loadedPlanId: plano.id,
    ramales: [],
    bajantes: [],
    areas: [],
    dims: [],
    textAnnots: [],
    scaleM: 0.5,
    definedScaleM: 0,
    workVersion: 6,
    loadWork(json: string) {
      const doc = JSON.parse(json) as PlanoWorkData;
      Object.assign(this, doc, { workVersion: doc.v });
    },
    setScaleM(scale: number) {
      this.scaleM = scale;
    },
    setDefinedScaleM(scale: number) {
      this.definedScaleM = scale;
    },
    reEncuadrarContenido: vi.fn(),
    render: vi.fn(),
  };
  function Probe() {
    const load = useTrazosLoader({
      plansRef: { current: [plano as PlanItem] },
      activeNetRef: { current: 'af' },
      setActiveNet: vi.fn(),
      setScaleM: vi.fn(),
    });
    useEffect(() => {
      void load(motor as unknown as PlanoEngine, plano.id!);
    }, [load]);
    return null;
  }
  const ui = await renderEnJsdom(<Probe />);
  await ui.flush();
  await ui.unmount();
  return motor;
}

it('reabrir el dibujo no lo reescala ni lo sube de nuevo aunque difiera del meta', async () => {
  const doc = {
    v: 6,
    ts: 123,
    scaleM: 0.669,
    ramales: [
      {
        id: 'R1',
        pts: [
          [10, 20],
          [40, 20],
        ],
      },
    ],
  };
  saveToStorage('trazos_101', doc);
  vi.mocked(loadTrazosFromDB).mockResolvedValueOnce(doc);
  const motor = await abrir({
    id: 101,
    scale: 90,
    origen: { x_px: 10, y_px: 20 },
    calGlobal: true,
  });
  expect(motor.scaleM).toBe(doc.scaleM);
  expect(motor.ramales).toEqual(doc.ramales);
  expect(saveTrazosToDB).not.toHaveBeenCalled();
});

it('un plano sin dibujo arranca con su calibración, no con el default de la fila SQL', async () => {
  vi.mocked(loadTrazosFromDB).mockResolvedValueOnce({ v: 6, scaleM: 0.5, ramales: [] });
  const motor = await abrir({ id: 102, scale: 100, definedScale: 0.75 });
  expect(motor).toMatchObject({ scaleM: 1, definedScaleM: 0.75, workVersion: 7 });
  expect(saveTrazosToDB).not.toHaveBeenCalled();
});
