import { describe, it, expect } from 'vitest';
import { selectAt } from '../PlanoEngineSelection';
import { hitTestRightClick } from '../PlanoEngineHitTesting';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Regresión: un CANAL de aguas lluvias es una canaleta de fondo — su zona de clic (rectángulo
// ×1.1) NO debe ganarle a un ramal que cruza esa zona. Antes del fix, selectAt/hitTestRightClick
// revisaban canales antes que ramales y un clic sobre un ramal dentro del rectángulo del canal
// seleccionaba el canal y cambiaba la red activa a aguas lluvias (o alertaba "Debe activar la
// red de aguas lluvias" si inactiva).

function makeRamal(over: Partial<PlanoRamal>): PlanoRamal {
  return {
    id: 'RAF1',
    net: 'af',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [0, 100],
    ],
    totalL: 100,
    label: 'RAF1',
    ini: '',
    fin: '',
    piso: 'P1',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    ...over,
  };
}

function makeCanal(x: number, y: number, w: number, h: number): PlanoBajante {
  return {
    id: 'C1',
    net: 'll',
    tipo: 'canal',
    code: 'C1',
    x,
    y,
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
    labelY: 0,
    bajR: 7 / 24,
    longitud: w / 10,
    base: h / 10,
    _canalBox: { x, y, w, h },
  } as PlanoBajante;
}

interface Outbox {
  selectedId: string | null;
  activeNet: string;
  alerts: string[];
}

function makeEngine(
  ramales: PlanoRamal[],
  bajantes: PlanoBajante[],
): {
  engine: IPlanoEngineCore;
  outbox: Outbox;
} {
  // El ramal cruza verticalmente el rectángulo del canal (0,0)-(100,60).
  const outbox: Outbox = { selectedId: null, activeNet: 'af', alerts: [] };
  const engine = {
    ramales,
    bajantes,
    areas: [],
    textAnnots: [],
    dims: [],
    guideLines: [],
    multiSel: [],
    selId: null as string | null,
    activeNet: 'af',
    zoom: 1,
    activeNetworks: new Set(['af', 'll']),
    checkActiveNet: undefined,
    toCvs: (x: number, y: number) => ({ x, y }),
    mm2cvs: (n: number) => (((n * 10) / 25.4) * 96) / 1000,
    realMmToCanvasPx: (n: number) => n,
    getBajantesFantasma: () => [] as PlanoBajante[],
    setActiveNet: (id: string) => {
      outbox.activeNet = id;
    },
    triggerAlert: (title: string, msg: string) => {
      outbox.alerts.push(`${title}: ${msg}`);
    },
    _emitSelect: (el: unknown) => {
      outbox.selectedId = (el as { id?: string } | null)?.id ?? null;
    },
    render: () => undefined,
    _isGhostSel: false,
    _hiddenNets: new Set<string>(),
    _markDirty: () => undefined,
    _selPointCvs: undefined,
  } as unknown as IPlanoEngineCore;
  return { engine, outbox };
}

describe('selectAt — canal vs ramal dentro de su rectángulo', () => {
  it('clic sobre el ramal dentro del canal selecciona el RAMAL y no cambia la red', () => {
    const ramal = makeRamal({});
    const { engine, outbox } = makeEngine([ramal], [makeCanal(0, 0, 100, 60)]);
    selectAt(engine, 0, 50);
    expect(outbox.selectedId).toBe('RAF1');
    expect(outbox.activeNet).toBe('af');
    expect(outbox.alerts).toEqual([]);
  });

  it('clic dentro del canal SIN ramal cerca selecciona el canal y cambia a ll', () => {
    const ramal = makeRamal({
      pts: [
        [300, 300],
        [300, 400],
      ],
    });
    const { engine, outbox } = makeEngine([ramal], [makeCanal(0, 0, 100, 60)]);
    selectAt(engine, 50, 30);
    expect(outbox.selectedId).toBe('C1');
    expect(outbox.activeNet).toBe('ll');
  });

  it('clic en el vacío no selecciona nada', () => {
    const { engine, outbox } = makeEngine([], [makeCanal(0, 0, 100, 60)]);
    selectAt(engine, 500, 500);
    expect(outbox.selectedId).toBeNull();
  });
});

describe('hitTestRightClick — canal vs ramal dentro de su rectángulo', () => {
  it('clic derecho sobre el ramal dentro del canal abre el menú del RAMAL', () => {
    const ramal = makeRamal({});
    const { engine } = makeEngine([ramal], [makeCanal(0, 0, 100, 60)]);
    const hit = hitTestRightClick(engine, 0, 50, 10, 10);
    expect(hit?.element.id).toBe('RAF1');
  });

  it('clic derecho dentro del canal sin ramal abre el menú del CANAL', () => {
    const { engine } = makeEngine([], [makeCanal(0, 0, 100, 60)]);
    const hit = hitTestRightClick(engine, 50, 30, 10, 10);
    expect(hit?.element.id).toBe('C1');
  });
});
