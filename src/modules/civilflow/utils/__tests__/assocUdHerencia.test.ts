import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  TRAZOS_PREFIX,
} from '../../constants/storage-keys';
import { applyBajanteAssociation, clearBajanteAssociation } from '../bajanteAssociation';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState';

// Repro bug 2: al asociar bajantes entre pisos, las UDs del piso superior deben llegar
// automáticamente al piso inferior: fantasma, Ldesvio y bajante original. Además, bug 1:
// el inodoro del ramal del piso superior debe sobrevivir a ciclos asociar/desasociar.

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) {
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({}),
    };
  }
  if (!g.window) {
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
  }
});

const PLANS = [
  { id: '1', name: 'P1', nivel: 0, npt: 0, status: 'confirmed' },
  { id: '2', name: 'P2', nivel: 1, npt: 320, status: 'confirmed' },
] as never[];

function seedStorage() {
  // Piso superior (plan 2): BAN1 con ramal RS4 (inodoro = 1 UD san)
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '2',
    JSON.stringify({
      ramales: [
        {
          id: 'RS4',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [100, 0],
            [0, 0],
          ],
          aparatoInicio: 'san',
          diametro: '4"',
          label: 'RS4',
        },
      ],
      bajantes: [
        {
          id: 'BAN1',
          net: 'san',
          tipo: 'bajante',
          x: 0,
          y: 0,
          recibeDeIds: ['RS4'],
          dNominal: '4"',
        },
      ],
    }),
  );
  // Piso inferior (plan 1): bajante BAN2 con un ramal RS1 propio
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [50, 50],
            [30, 30],
          ],
          label: 'RS1',
          diametro: '2"',
        },
      ],
      bajantes: [
        {
          id: 'BAN2',
          net: 'san',
          tipo: 'bajante',
          x: 30,
          y: 30,
          recibeDeIds: ['RS1'],
          dNominal: '4"',
        },
      ],
    }),
  );
  localStorage.setItem(
    'civilflow_' + APARATOS_BY_TRAMO_KEY,
    JSON.stringify({ san_RS4_2: { san: 1 }, san_RS1_1: { lav: 1 } }),
  );
}

function makeEngine(loadedPlanId: string): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    activeNet: 'san',
    tipoTramo: 'ramal',
    _loadedPlanId: loadedPlanId,
    nivelActual: { label: 'P2', n: 1, npt: 320 } as never,
    scaleM: 0.5,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    updateElementById: () => {},
  };
  // El motor vivo manda sobre el storage: el stub aplica los campos para ejercitar esa vía.
  engine.updateElementById = ((id: string, fields: Record<string, unknown>) => {
    const el = [...(engine.bajantes || []), ...(engine.ramales || [])].find(
      (x) => (x as { id: string }).id === id,
    );
    if (el) Object.assign(el, fields);
  }) as never;
  return engine as IPlanoEngineCore;
}

function apos(): Record<string, Record<string, number>> {
  return JSON.parse(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}');
}

function bookOf(planId: string, bajId: string): Record<string, Record<string, number>> {
  const t = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + planId) || '{}');
  const b = (t.bajantes || []).find((x: { id: string }) => x.id === bajId);
  return b?.ucAplicado || {};
}

beforeEach(() => {
  localStorage.clear();
  seedStorage();
});

describe('asociación entre pisos: herencia de UDs', () => {
  it('flujo A — asociar desde el piso SUPERIOR cargado: Ldesvio + bajante inferior reciben UDs', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      recibeDeIds: ['RS4'],
      dNominal: '4"',
      descargaEnId: null,
    } as never);

    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN1',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 1,
        npt: 320,
      },
      {
        planId: '1',
        id: 'BAN2',
        x: 40,
        y: 40,
        net: 'san',
        dNominal: '4"',
        code: 'BAN2',
        nivelN: 0,
        npt: 0,
      },
      PLANS,
    );

    const a = apos();
    // Ldesvio en el piso inferior con las UDs del superior
    expect(a['san_LD_BAN1_1']).toEqual({ san: 1 });
    // Libro de herencia en el bajante destino
    const book = bookOf('1', 'BAN2');
    const total = Object.values(book).reduce(
      (s, m) => s + Object.values(m).reduce((x, v) => x + (v as number), 0),
      0,
    );
    expect(total).toBeGreaterThan(0);
    // ucAcum del bajante destino
    const t1 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '1') || '{}');
    const b2 = (t1.bajantes || []).find((x: { id: string }) => x.id === 'BAN2');
    expect(b2?.ucAcum).toBe(1);
    // El inodoro del piso superior sobrevive
    expect(a['san_RS4_2']).toEqual({ san: 1 });
  });

  it('flujo B — asociar desde el piso INFERIOR cargado (source no cargado)', () => {
    const eng = makeEngine('1');
    eng.bajantes.push({
      id: 'BAN2',
      net: 'san',
      tipo: 'bajante',
      x: 30,
      y: 30,
      recibeDeIds: ['RS1'],
      dNominal: '4"',
      origenId: null,
    } as never);

    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN1',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 1,
        npt: 320,
      },
      {
        planId: '1',
        id: 'BAN2',
        x: 30,
        y: 30,
        net: 'san',
        dNominal: '4"',
        code: 'BAN2',
        nivelN: 0,
        npt: 0,
      },
      PLANS,
    );

    const a = apos();
    expect(a['san_LD_BAN1_1']).toEqual({ san: 1 });
    const t1 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '1') || '{}');
    const b2 = (t1.bajantes || []).find((x: { id: string }) => x.id === 'BAN2');
    expect(b2?.ucAcum).toBe(1);
    expect(a['san_RS4_2']).toEqual({ san: 1 });
  });

  it('ciclo asociar → desasociar → reasociar: el inodoro del superior sobrevive y la herencia queda estable', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      recibeDeIds: ['RS4'],
      dNominal: '4"',
      descargaEnId: '1|BAN2',
    } as never);

    const src = {
      planId: '2',
      id: 'BAN1',
      x: 0,
      y: 0,
      net: 'san',
      dNominal: '4"',
      code: 'BAN1',
      nivelN: 1,
      npt: 320,
    };
    const tgt = {
      planId: '1',
      id: 'BAN2',
      x: 40,
      y: 40,
      net: 'san',
      dNominal: '4"',
      code: 'BAN2',
      nivelN: 0,
      npt: 0,
    };

    applyBajanteAssociation(eng, src, tgt, PLANS);
    expect(apos()['san_RS4_2']).toEqual({ san: 1 });

    clearBajanteAssociation(eng, '2', 'BAN1', 'san', '1|BAN2', PLANS);
    expect(apos()['san_RS4_2']).toEqual({ san: 1 });

    applyBajanteAssociation(eng, src, tgt, PLANS);
    const a = apos();
    expect(a['san_RS4_2']).toEqual({ san: 1 });
    // La re-herencia no duplica: el LD vale exactamente el agregado del superior
    expect(a['san_LD_BAN1_1']).toEqual({ san: 1 });
  });

  it('storage STALE (recibeDeIds vacío en disco, vigentes en el motor): la herencia usa el motor vivo', () => {
    // El usuario conectó RS4 al bajante y asoció de inmediato — el autosave (debounce 1.5 s)
    // aún no volcó recibeDeIds al storage. Antes de la corrección, la herencia leía SOLO
    // storage: agg vacío → el enlace se creaba con CERO unidades (bug 2 reportado).
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({
        ramales: [
          {
            id: 'RS4',
            net: 'san',
            tipo: 'ramal',
            pts: [
              [100, 0],
              [0, 0],
            ],
            aparatoInicio: 'san',
            diametro: '4"',
            label: 'RS4',
          },
        ],
        bajantes: [
          { id: 'BAN1', net: 'san', tipo: 'bajante', x: 0, y: 0, recibeDeIds: [], dNominal: '4"' },
        ],
      }),
    );
    const eng = makeEngine('2');
    eng.ramales.push({
      id: 'RS4',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [100, 0],
        [0, 0],
      ],
      aparatoInicio: 'san',
      diametro: '4"',
    } as never);
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      recibeDeIds: ['RS4'],
      dNominal: '4"',
      descargaEnId: null,
    } as never);

    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN1',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 1,
        npt: 320,
      },
      {
        planId: '1',
        id: 'BAN2',
        x: 40,
        y: 40,
        net: 'san',
        dNominal: '4"',
        code: 'BAN2',
        nivelN: 0,
        npt: 0,
      },
      PLANS,
    );

    const a = apos();
    expect(a['san_LD_BAN1_1']).toEqual({ san: 1 });
    const t1 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '1') || '{}');
    const b2 = (t1.bajantes || []).find((x: { id: string }) => x.id === 'BAN2');
    expect(b2?.ucAcum).toBe(1);
    expect(a['san_RS4_2']).toEqual({ san: 1 });
  });

  it('escenario B — ALINEADOS (sin fantasma/LD): el original recibe las UDs y re-aplicar no duplica', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 40,
      y: 40,
      recibeDeIds: ['RS4'],
      dNominal: '4"',
      descargaEnId: null,
    } as never);
    const src = {
      planId: '2',
      id: 'BAN1',
      x: 40,
      y: 40,
      net: 'san',
      dNominal: '4"',
      code: 'BAN1',
      nivelN: 1,
      npt: 320,
    };
    const tgt = {
      planId: '1',
      id: 'BAN2',
      x: 40,
      y: 40,
      net: 'san',
      dNominal: '4"',
      code: 'BAN2',
      nivelN: 0,
      npt: 0,
    };

    const r1 = applyBajanteAssociation(eng, src, tgt, PLANS);
    expect(r1.aligned).toBe(true);
    // Sin Ldesvio: ninguna clave LD en ningún piso
    expect(apos()['san_LD_BAN1_1']).toBeUndefined();
    // El ramal propio del inferior conserva lo suyo (lav:1) + hereda el inodoro
    expect(apos()['san_RS1_1']).toEqual({ lav: 1, san: 1 });
    const t1 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '1') || '{}');
    expect((t1.bajantes || []).find((x: { id: string }) => x.id === 'BAN2')?.ucAcum).toBe(1);

    // Re-procesar la misma asociación NO duplica (idempotente por libro de herencia)
    applyBajanteAssociation(eng, src, tgt, PLANS);
    expect(apos()['san_RS1_1']).toEqual({ lav: 1, san: 1 });
    expect(apos()['san_LD_BAN1_1']).toBeUndefined();
    expect(apos()['san_RS4_2']).toEqual({ san: 1 });
  });

  it('en VIVO — aparato nuevo arriba + manual abajo: re-aplicar reemplaza sin duplicar ni borrar', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      recibeDeIds: ['RS4'],
      dNominal: '4"',
      descargaEnId: null,
    } as never);
    const src = {
      planId: '2',
      id: 'BAN1',
      x: 0,
      y: 0,
      net: 'san',
      dNominal: '4"',
      code: 'BAN1',
      nivelN: 1,
      npt: 320,
    };
    const tgt = {
      planId: '1',
      id: 'BAN2',
      x: 40,
      y: 40,
      net: 'san',
      dNominal: '4"',
      code: 'BAN2',
      nivelN: 0,
      npt: 0,
    };
    applyBajanteAssociation(eng, src, tgt, PLANS);
    expect(apos()['san_RS1_1']).toEqual({ lav: 1, san: 1 });

    // Manual posterior en el piso inferior + aparato nuevo en el superior
    const a0 = apos();
    a0['san_RS1_1'] = { ...a0['san_RS1_1'], duc: 1 };
    a0['san_RS4_2'] = { san: 1, sif: 1 };
    localStorage.setItem('civilflow_' + APARATOS_BY_TRAMO_KEY, JSON.stringify(a0));

    applyBajanteAssociation(eng, src, tgt, PLANS);
    const a = apos();
    // LD = agregado nuevo exacto (sin duplicar el san viejo)
    expect(a['san_LD_BAN1_1']).toEqual({ san: 1, sif: 1 });
    // Destino: manual (lav, duc) intacto + herencia nueva exacta
    expect(a['san_RS1_1']).toEqual({ lav: 1, san: 1, sif: 1, duc: 1 });
    // El superior no se toca
    expect(a['san_RS4_2']).toEqual({ san: 1, sif: 1 });
  });

  it('hidro heredado no se duplica al re-aplicar y el clear lo restaura', () => {
    localStorage.setItem(
      'civilflow_' + HYDRO_DATA_STORAGE_KEY,
      JSON.stringify({ san_RS4_2: { accesorios: { codo90rmSube: 1 }, Lh: 0, nSalidas: 0 } }),
    );
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      recibeDeIds: ['RS4'],
      dNominal: '4"',
      descargaEnId: null,
    } as never);
    const src = {
      planId: '2',
      id: 'BAN1',
      x: 0,
      y: 0,
      net: 'san',
      dNominal: '4"',
      code: 'BAN1',
      nivelN: 1,
      npt: 320,
    };
    const tgt = {
      planId: '1',
      id: 'BAN2',
      x: 40,
      y: 40,
      net: 'san',
      dNominal: '4"',
      code: 'BAN2',
      nivelN: 0,
      npt: 0,
    };
    const hydro = () =>
      JSON.parse(localStorage.getItem('civilflow_' + HYDRO_DATA_STORAGE_KEY) || '{}');

    applyBajanteAssociation(eng, src, tgt, PLANS);
    expect(hydro()['san_LD_BAN1_1']?.accesorios).toEqual({ codo90rmSube: 1 });
    expect(hydro()['san_RS1_1']?.accesorios).toEqual({ codo90rmSube: 1 });

    applyBajanteAssociation(eng, src, tgt, PLANS);
    expect(hydro()['san_RS1_1']?.accesorios).toEqual({ codo90rmSube: 1 });

    clearBajanteAssociation(eng, '2', 'BAN1', 'san', '1|BAN2', PLANS);
    const h = hydro();
    expect(h['san_LD_BAN1_1']).toBeUndefined();
    expect(h['san_RS1_1']).toBeUndefined();
    // Aparatos: LD fuera, destino con lo suyo, superior intacto
    const a = apos();
    expect(a['san_LD_BAN1_1']).toBeUndefined();
    expect(a['san_RS1_1']).toEqual({ lav: 1 });
    expect(a['san_RS4_2']).toEqual({ san: 1 });
  });

  it('agregado COMPLETO: tributarios + clave propia + cadena extremo-con-extremo; espejo excluido', () => {
    // BAN1-P2 con 24 UDs repartidas: RS4 (inodoro 4) + T1RS4 (2 lav) + cadena RS5→RS4 (sif 6)
    // + clave propia (duc 12). RS9 es espejo de salida con 9 manuales que NO deben sumarse.
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({
        ramales: [
          {
            id: 'RS4',
            net: 'san',
            tipo: 'ramal',
            pts: [
              [100, 0],
              [0, 0],
            ],
            label: 'RS4',
            diametro: '4"',
          },
          {
            id: 'T1RS4',
            net: 'san',
            tipo: 'tributario',
            padre: 'RS4',
            pts: [
              [100, 0],
              [120, 20],
            ],
            label: 'T1RS4',
          },
          {
            id: 'RS5',
            net: 'san',
            tipo: 'ramal',
            pts: [
              [200, 0],
              [100, 0],
            ],
            label: 'RS5',
            diametro: '2"',
          },
          {
            id: 'RS9',
            net: 'san',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [60, 60],
            ],
            label: 'RS9',
            diametro: '4"',
          },
        ],
        bajantes: [
          {
            id: 'BAN1',
            net: 'san',
            tipo: 'bajante',
            x: 0,
            y: 0,
            recibeDeIds: ['RS4'],
            alimentaIds: ['RS9'],
            dNominal: '4"',
          },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({
        san_RS4_2: { san: 4 },
        san_T1RS4_2: { lav: 2 },
        san_RS5_2: { sif: 6 },
        san_BAN1_2: { duc: 12 },
        san_RS9_2: { san: 9 },
        san_RS1_1: { lav: 1 },
      }),
    );
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      recibeDeIds: ['RS4'],
      alimentaIds: ['RS9'],
      dNominal: '4"',
      descargaEnId: null,
    } as never);

    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN1',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 1,
        npt: 320,
      },
      {
        planId: '1',
        id: 'BAN2',
        x: 40,
        y: 40,
        net: 'san',
        dNominal: '4"',
        code: 'BAN2',
        nivelN: 0,
        npt: 0,
      },
      PLANS,
    );

    const a = apos();
    // 4 + 2 + 6 + 12 = 24 (el espejo RS9 con 9 NO suma)
    expect(a['san_LD_BAN1_1']).toEqual({ san: 4, lav: 2, sif: 6, duc: 12 });
    // RS1 conserva su lav:1 manual + hereda (lav:2 del tributario incluido)
    expect(a['san_RS1_1']).toEqual({ lav: 3, san: 4, sif: 6, duc: 12 });
    const t1 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '1') || '{}');
    expect((t1.bajantes || []).find((x: { id: string }) => x.id === 'BAN2')?.ucAcum).toBe(24);
    // El superior no se toca (ni su espejo)
    expect(a['san_RS9_2']).toEqual({ san: 9 });
  });

  it('sin tope: 12 ramales heredan los 12', () => {
    const ramales = Array.from({ length: 12 }, (_, i) => ({
      id: `RS${i + 1}`,
      net: 'san',
      tipo: 'ramal',
      pts: [
        [100 + i * 5, 0],
        [0, 0],
      ],
      label: `RS${i + 1}`,
      diametro: '2"',
    }));
    const counts: Record<string, Record<string, number>> = {};
    for (let i = 0; i < 12; i++) counts[`san_RS${i + 1}_2`] = { lav: 1 };
    counts['san_RS1_1'] = { lav: 1 };
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({
        ramales,
        bajantes: [
          {
            id: 'BAN1',
            net: 'san',
            tipo: 'bajante',
            x: 0,
            y: 0,
            recibeDeIds: ramales.map((r) => r.id),
            dNominal: '4"',
          },
        ],
      }),
    );
    localStorage.setItem('civilflow_' + APARATOS_BY_TRAMO_KEY, JSON.stringify(counts));
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      recibeDeIds: ramales.map((r) => r.id),
      dNominal: '4"',
      descargaEnId: null,
    } as never);

    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN1',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 1,
        npt: 320,
      },
      {
        planId: '1',
        id: 'BAN2',
        x: 40,
        y: 40,
        net: 'san',
        dNominal: '4"',
        code: 'BAN2',
        nivelN: 0,
        npt: 0,
      },
      PLANS,
    );
    expect(apos()['san_LD_BAN1_1']).toEqual({ lav: 12 });
  });

  it('cambiar de asociado actualiza el inferior y limpia el enlace viejo (sin clear manual)', () => {
    // Segundo superior BAN2-P2 con RS9 {duc:5}
    const t2 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '2') || '{}');
    t2.bajantes.push({
      id: 'BAN2',
      net: 'san',
      tipo: 'bajante',
      x: 5,
      y: 5,
      recibeDeIds: ['RS9'],
      dNominal: '4"',
    });
    t2.ramales.push({
      id: 'RS9',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [60, 5],
        [5, 5],
      ],
      label: 'RS9',
      diametro: '2"',
    });
    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + '2', JSON.stringify(t2));
    const a0 = apos();
    a0['san_RS9_2'] = { duc: 5 };
    localStorage.setItem('civilflow_' + APARATOS_BY_TRAMO_KEY, JSON.stringify(a0));

    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      recibeDeIds: ['RS4'],
      dNominal: '4"',
      descargaEnId: null,
    } as never);
    const tgt = {
      planId: '1',
      id: 'BAN2',
      x: 40,
      y: 40,
      net: 'san',
      dNominal: '4"',
      code: 'BAN2',
      nivelN: 0,
      npt: 0,
    };
    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN1',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 1,
        npt: 320,
      },
      tgt,
      PLANS,
    );
    expect(apos()['san_LD_BAN1_1']).toEqual({ san: 1 });

    // Cambiar al otro superior SIN clear manual: el apply limpia el conflicto solo
    eng.bajantes.push({
      id: 'BAN2',
      net: 'san',
      tipo: 'bajante',
      x: 5,
      y: 5,
      recibeDeIds: ['RS9'],
      dNominal: '4"',
      descargaEnId: null,
    } as never);
    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN2',
        x: 5,
        y: 5,
        net: 'san',
        dNominal: '4"',
        code: 'BAN2',
        nivelN: 1,
        npt: 320,
      },
      tgt,
      PLANS,
    );
    const a = apos();
    // El inferior refleja el NUEVO agregado exacto (sin restos del viejo ni duplicados)
    expect(a['san_LD_BAN1_1']).toBeUndefined();
    expect(a['san_LD_BAN2_1']).toEqual({ duc: 5 });
    expect(a['san_RS1_1']).toEqual({ lav: 1, duc: 5 });
    // El viejo origen quedó sin puntero
    const up = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '2') || '{}');
    expect(
      (up.bajantes || []).find((x: { id: string }) => x.id === 'BAN1')?.descargaEnId ?? null,
    ).toBeNull();
    expect((up.bajantes || []).find((x: { id: string }) => x.id === 'BAN2')?.descargaEnId).toBe(
      '1|BAN2',
    );
  });

  it('cruzados: desasociar uno NO toca el otro (LD, anillo, ghost, libro, conteos)', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      x: 0,
      y: 0,
      recibeDeIds: ['RS4'],
      dNominal: '4"',
      descargaEnId: null,
    } as never);
    // Enlace 1: BAN1-P1 ← BAN2-P2 (upper BAN2-P2). Sembrar BAN2-P2 con RS9 {duc:5}.
    const t2 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '2') || '{}');
    t2.bajantes.push({
      id: 'BAN2',
      net: 'san',
      tipo: 'bajante',
      x: 5,
      y: 5,
      recibeDeIds: ['RS9'],
      dNominal: '4"',
    });
    t2.ramales.push({
      id: 'RS9',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [60, 5],
        [5, 5],
      ],
      label: 'RS9',
      diametro: '2"',
    });
    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + '2', JSON.stringify(t2));
    const ax = apos();
    ax['san_RS9_2'] = { duc: 5 };
    localStorage.setItem('civilflow_' + APARATOS_BY_TRAMO_KEY, JSON.stringify(ax));
    eng.bajantes.push({
      id: 'BAN2',
      net: 'san',
      tipo: 'bajante',
      x: 5,
      y: 5,
      recibeDeIds: ['RS9'],
      dNominal: '4"',
      descargaEnId: null,
    } as never);

    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN2',
        x: 5,
        y: 5,
        net: 'san',
        dNominal: '4"',
        code: 'BAN2',
        nivelN: 1,
        npt: 320,
      },
      {
        planId: '1',
        id: 'BAN1',
        x: 40,
        y: 40,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 0,
        npt: 0,
      },
      PLANS,
    );
    // Enlace 2: BAN2-P1 ← BAN1-P2 (upper BAN1-P2 con RS4 {san:1})
    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN1',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 1,
        npt: 320,
      },
      {
        planId: '1',
        id: 'BAN2',
        x: 30,
        y: 30,
        net: 'san',
        dNominal: '4"',
        code: 'BAN2',
        nivelN: 0,
        npt: 0,
      },
      PLANS,
    );
    expect(apos()['san_LD_BAN2_1']).toEqual({ duc: 5 });
    expect(apos()['san_LD_BAN1_1']).toEqual({ san: 1 });

    // Desasociar el enlace 1: el 2 queda intacto en TODO
    clearBajanteAssociation(eng, '2', 'BAN2', 'san', '1|BAN1', PLANS);
    const a = apos();
    expect(a['san_LD_BAN2_1']).toBeUndefined();
    expect(a['san_LD_BAN1_1']).toEqual({ san: 1 });
    // Ramal LD del 2 sigue en trazos del piso 1; el del 1 fuera
    const p1 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '1') || '{}');
    const ids1 = (p1.ramales || []).map((r: { id: string }) => r.id);
    expect(ids1).toContain('LD_BAN1');
    expect(ids1).not.toContain('LD_BAN2');
    // Anillo del 2 sobre BAN2-P1 intacto; ucAcum del 2 intacto; punteros del 2 intactos
    const b2p1 = (p1.bajantes || []).find((x: { id: string }) => x.id === 'BAN2');
    expect(JSON.stringify(b2p1?.desplazamientos || {})).toContain('LD_BAN1');
    expect(b2p1?.ucAcum).toBe(1);
    expect(b2p1?.origenId).toBe('2|BAN1');
    const p2 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '2') || '{}');
    expect((p2.bajantes || []).find((x: { id: string }) => x.id === 'BAN1')?.descargaEnId).toBe(
      '1|BAN2',
    );
    // Ghost del 2 en el piso 2 intacto
    const ghosts2 = (p2.crossFloorGhosts || []) as { sourceBajanteId: string }[];
    expect(ghosts2.some((g) => g.sourceBajanteId === 'BAN2')).toBe(true);
    // El 1 sí se limpió: ucAcum 0 y sin herencia colgada. RS1 es ramal de BAN2-P1
    // (enlace 2), así que conserva su herencia {san:1} + su manual {lav:1}.
    expect((p1.bajantes || []).find((x: { id: string }) => x.id === 'BAN1')?.ucAcum ?? 0).toBe(0);
    expect(a['san_RS1_1']).toEqual({ lav: 1, san: 1 });
  });
});
