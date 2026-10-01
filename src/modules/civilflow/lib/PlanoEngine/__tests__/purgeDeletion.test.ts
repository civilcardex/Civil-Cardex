import { describe, it, expect, beforeAll } from 'vitest';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';
import { saveToStorage, loadFromStorage } from '../../../services/storageService';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../../../constants/storage-keys';

// Borrar un ramal/tributario debe purgar TODO su estado asociado del piso (conteos de aparatos,
// accesorios hidro/gas): la renumeración REUTILIZA ids (RS1/T1RS1) y, sin purga, el trazo
// redibujado nacía "ya con aparato" y al asignar otro se contaba doble (orig. usuario).
// Las claves de OTROS pisos con el mismo id NO se tocan.

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document)
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => makeCanvas(),
    };
  if (!g.window)
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      devicePixelRatio: 1,
    };
  if (!g.Image)
    g.Image = class {
      onload = () => {};
      onerror = () => {};
      set src(_v: string) {
        this.onerror();
      }
    };
});

function makeCanvas() {
  const ctxStub = new Proxy(
    {},
    {
      get: (_t, k) =>
        k === 'canvas' ? null : k === 'measureText' ? () => ({ width: 10 }) : () => {},
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return {
    width: 800,
    height: 600,
    style: {},
    getContext: () => ctxStub,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
}
function mk(id: string, label: string, pts: number[][], extra: Record<string, unknown> = {}) {
  return {
    id,
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    nSalidas: 1,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 2,
    bloqueado: false,
    ...extra,
  };
}
function makeEngine(planId: string): PlanoEngine {
  const canv = makeCanvas();
  const cw = { addEventListener: () => {}, removeEventListener: () => {}, style: {} };
  const eng = new PlanoEngineCtor(cw as never, null, canv as unknown as HTMLCanvasElement);
  eng._loadedPlanId = planId;
  return eng;
}

function seedConteosRS1(): void {
  saveToStorage(APARATOS_BY_TRAMO_KEY, {
    san_RS1_7: { san: 1 }, // piso cargado — debe purgarse
    san_RS1_8: { san: 1 }, // OTRO piso con el mismo id — debe sobrevivir
  });
  saveToStorage(HYDRO_DATA_STORAGE_KEY, {
    san_RS1_7: { accesorios: { codo90rmSube: 1 }, Lh: 0, nSalidas: 0 },
  });
  saveToStorage(GAS_ACC_KEY, { RS1: { cocina: 1 } });
}

describe('borrado purga el estado asociado del piso', () => {
  it('borrado en conjunto (ids): purga aparatos/hidro/gas de RS1 en el piso 7, no del 8', () => {
    const eng = makeEngine('7');
    eng.activeNet = 'san';
    eng.ramales.push(
      mk('RS1', 'RS1', [
        [100, 100],
        [300, 100],
      ]) as never,
    );
    seedConteosRS1();

    eng.deleteSelected(['RS1']);

    const aparatos = loadFromStorage<Record<string, Record<string, number>>>(
      APARATOS_BY_TRAMO_KEY,
      {},
    );
    expect(aparatos['san_RS1_7']).toBeUndefined();
    expect(aparatos['san_RS1_8']).toEqual({ san: 1 }); // otro piso intacto
    const hidro = loadFromStorage<Record<string, unknown>>(HYDRO_DATA_STORAGE_KEY, {});
    expect(hidro['san_RS1_7']).toBeUndefined();
    const gas = loadFromStorage<Record<string, Record<string, number>>>(GAS_ACC_KEY, {});
    expect(gas['RS1']).toBeUndefined();
  });

  it('el contenido del SOBREVIVIENTE renombrado (RS2→RS1) migra limpio: sin doble conteo', () => {
    const eng = makeEngine('7');
    eng.activeNet = 'san';
    eng.ramales.push(
      mk(
        'RS1',
        'RS1',
        [
          [100, 100],
          [300, 100],
        ],
        { accesorioFin: 'codo90rmSube' },
      ) as never,
      mk(
        'RS2',
        'RS2',
        [
          [300, 100],
          [600, 100],
        ],
        { accesorioInicio: 'sifon' },
      ) as never,
    );
    seedConteosRS1();
    // Conteo PROPIO del sobreviviente RS2 (su sifón) — es lo que debe migrar con el rename.
    saveToStorage(APARATOS_BY_TRAMO_KEY, {
      san_RS1_7: { san: 1 },
      san_RS1_8: { san: 1 },
      san_RS2_7: { sif: 1 },
    });

    eng.deleteSelected(['RS1']);
    // RS2 sobrevive y la renumeración lo renombra RS1 — su CONTEO propio (sif) migra con el
    // rename; el aparato del RS1 borrado (san:1) NO vuelve.
    expect(eng.ramales.map((r) => r.id)).toContain('RS1');
    const aparatos = loadFromStorage<Record<string, Record<string, number>>>(
      APARATOS_BY_TRAMO_KEY,
      {},
    );
    expect(aparatos['san_RS1_7']).toEqual({ sif: 1 });
    expect(aparatos['san_RS1_7']?.['san']).toBeUndefined();
  });

  it('redibujar el mismo id tras borrar arranca SIN aparatos (simulación del flujo usuario)', () => {
    const eng = makeEngine('7');
    eng.activeNet = 'san';
    eng.ramales.push(
      mk('RS1', 'RS1', [
        [100, 100],
        [300, 100],
      ]) as never,
    );
    seedConteosRS1();

    eng.deleteSelected(['RS1']);
    // El usuario redibuja: la renumeración reasigna RS1 al trazo nuevo.
    eng.ramales.push(
      mk('RS1', 'RS1', [
        [100, 100],
        [300, 100],
      ]) as never,
    );
    eng._markDirty();

    const aparatos = loadFromStorage<Record<string, Record<string, number>>>(
      APARATOS_BY_TRAMO_KEY,
      {},
    );
    expect(aparatos['san_RS1_7']).toBeUndefined();
  });

  it('borrado individual (selId) purga también los tributarios que caen en cascada', () => {
    const eng = makeEngine('7');
    eng.activeNet = 'san';
    eng.ramales.push(
      mk('RS1', 'RS1', [
        [100, 100],
        [300, 100],
      ]) as never,
      mk(
        'T1RS1',
        'T1RS1',
        [
          [300, 100],
          [340, 180],
        ],
        {
          tipo: 'tributario',
          padre: 'RS1',
        },
      ) as never,
    );
    saveToStorage(APARATOS_BY_TRAMO_KEY, {
      san_RS1_7: { san: 1 },
      san_T1RS1_7: { lvm: 1 },
    });

    eng.selId = 'RS1';
    eng.deleteSelected();

    const aparatos = loadFromStorage<Record<string, Record<string, number>>>(
      APARATOS_BY_TRAMO_KEY,
      {},
    );
    expect(aparatos['san_RS1_7']).toBeUndefined();
    expect(aparatos['san_T1RS1_7']).toBeUndefined();
  });

  it('MULTI-borrado (Supr): cada ramal seleccionado purga su propia clave de aparatos', () => {
    const eng = makeEngine('7');
    eng.activeNet = 'san';
    eng.ramales.push(
      mk(
        'RS1',
        'RS1',
        [
          [100, 100],
          [300, 100],
        ],
        { accesorioFin: 'codo90rmSube' },
      ) as never,
      mk(
        'RS2',
        'RS2',
        [
          [300, 100],
          [600, 100],
        ],
        { accesorioFin: 'codo90rmSube' },
      ) as never,
      mk(
        'T1RS2',
        'T1RS2',
        [
          [600, 100],
          [640, 180],
        ],
        {
          tipo: 'tributario',
          padre: 'RS2',
        },
      ) as never,
    );
    saveToStorage(APARATOS_BY_TRAMO_KEY, {
      san_RS1_7: { san: 1 }, // inodoro en RS1
      san_RS2_7: { lav: 1 }, // lavamanos en RS2
      san_T1RS2_7: { lvd: 1 }, // lavavajillas en el tributario (cae por padre)
    });

    // El teclado llama exactamente esto con this.multiSel.
    eng.deleteSelected(['RS1', 'RS2']);

    const aparatos = loadFromStorage<Record<string, Record<string, number>>>(
      APARATOS_BY_TRAMO_KEY,
      {},
    );
    expect(aparatos['san_RS1_7']).toBeUndefined();
    expect(aparatos['san_RS2_7']).toBeUndefined();
    expect(aparatos['san_T1RS2_7']).toBeUndefined();
    // Y el redraw con ids reutilizados arranca limpio.
    eng.ramales.push(
      mk('RS1', 'RS1', [
        [100, 100],
        [300, 100],
      ]) as never,
    );
    eng._markDirty();
    expect(
      loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {})[
        'san_RS1_7'
      ],
    ).toBeUndefined();
  });
});
