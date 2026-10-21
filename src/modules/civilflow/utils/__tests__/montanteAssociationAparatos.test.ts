import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  APARATOS_BY_TRAMO_KEY,
  APARATOS_HEREDADOS_KEY,
  TRAZOS_PREFIX,
} from '../../constants/storage-keys.ts';
import { applyBajanteAssociation, clearBajanteAssociation } from '../bajanteAssociation';
import { propagarAparatosPresion } from '../propagation';
import { buildTramos } from '../buildTramos.ts';
import { collectSourceAgg } from '../bajanteAssocShared.ts';
import { handleMontanteDown } from '../../lib/PlanoEngine/creations/montantes.ts';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState.ts';

// MONTANTES asociados entre pisos: deben ir TOMANDO los mismos aparatos. Si el montante del
// piso 2 tiene 3 UC y se asocia a uno del piso 1, el de abajo queda con 3 UC — y lo mismo el
// Ldesvio y el bajante fantasma que se crean al associar.

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
  // Piso SUPERIOR (plan 2): montante MAF1 con el ramal RAF1 que trae 3 UC (2 inodoros + 1 lav).
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '2',
    JSON.stringify({
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [100, 0],
            [0, 0],
          ],
          label: 'RAF1',
          diametro: '1/2"',
        },
      ],
      bajantes: [
        {
          id: 'MAF1',
          net: 'af',
          tipo: 'montante',
          x: 0,
          y: 0,
          recibeDeIds: ['RAF1'],
          dNominal: '3/4"',
        },
      ],
    }),
  );
  // Piso INFERIOR (plan 1): montante MAF2 con su propio ramal RAF2.
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      ramales: [
        {
          id: 'RAF2',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [50, 50],
            [30, 30],
          ],
          label: 'RAF2',
          diametro: '1/2"',
        },
      ],
      bajantes: [
        {
          id: 'MAF2',
          net: 'af',
          tipo: 'montante',
          x: 30,
          y: 30,
          recibeDeIds: ['RAF2'],
          alimentaIds: ['RAF2'],
          dNominal: '3/4"',
        },
      ],
    }),
  );
  // 3 UC del piso superior en el ramal que alimenta al montante + aparatos PROPIOS del
  // montante destino (los que él sirve en su piso — no son herencia).
  localStorage.setItem(
    'civilflow_' + APARATOS_BY_TRAMO_KEY,
    JSON.stringify({ af_RAF1_2: { ino: 2, lvm: 1 }, af_MAF2_1: { lvp: 2 } }),
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
    activeNet: 'af',
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

function doc(planId: string): {
  bajantes?: Array<Record<string, unknown>>;
  ramales?: Array<Record<string, unknown>>;
  crossFloorGhosts?: Array<Record<string, unknown>>;
} {
  return JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + planId) || '{}');
}

const SRC = {
  planId: '2',
  id: 'MAF1',
  x: 0,
  y: 0,
  net: 'af',
  dNominal: '3/4"',
  code: 'MAF1',
  nivelN: 1,
  npt: 320,
  tipo: 'montante',
};
const TGT = {
  planId: '1',
  id: 'MAF2',
  x: 30,
  y: 30,
  net: 'af',
  dNominal: '3/4"',
  code: 'MAF2',
  nivelN: 0,
  npt: 0,
  tipo: 'montante',
};

/** Asocia desde el piso SUPERIOR cargado (flujo A de la UI). */
function asociar(): IPlanoEngineCore {
  const eng = makeEngine('2');
  eng.bajantes.push({
    id: 'MAF1',
    net: 'af',
    tipo: 'montante',
    x: 0,
    y: 0,
    recibeDeIds: ['RAF1'],
    dNominal: '3/4"',
  } as never);
  applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);
  return eng;
}

beforeEach(() => {
  localStorage.clear();
  seedStorage();
});

describe('asociación entre pisos de MONTANTES: los mismos aparatos', () => {
  it('el Ldesvio creado queda con los 3 UC', () => {
    asociar();
    expect(apos()['af_LD_MAF1_1']).toEqual({ ino: 2, lvm: 1 });
  });

  it('el bajante fantasma queda con los 3 UC (los que bajan por el enlace)', () => {
    asociar();
    const ghosts = doc('2').crossFloorGhosts || [];
    expect(ghosts.length).toBeGreaterThan(0);
    expect(ghosts[0].aparatos).toEqual({ ino: 2, lvm: 1 });
    expect(ghosts[0].ucAcum).toBe(3);
  });

  it('la fila del montante destino en Cálculo UC muestra los 3 UC', () => {
    asociar();
    const d1 = doc('1');
    const b2 = (d1.bajantes || []).find((b) => b.id === 'MAF2') as Record<string, unknown>;
    const tramos = buildTramos(
      'af',
      {
        af_0: {
          planoId: '1',
          ramales: (d1.ramales || []) as never,
          bajantes: (d1.bajantes || []) as never,
        },
      },
      {},
      apos(),
    );
    const fila = tramos.find((t) => t.id === 'MAF2');
    expect(fila).toBeDefined();
    expect(fila!.fixturesAgg).toEqual({ ino: 2, lvm: 1 });
    // El montante destino queda con los MISMOS 3 UC, ni uno más (ni el doble).
    expect(b2.origenId).toBe('2|MAF1');
  });

  it('el libro del asociado es SOLO el grupo (sin mezclar lo propio del montante destino)', () => {
    asociar();
    const b2 = (doc('1').bajantes || []).find((b) => b.id === 'MAF2') as Record<string, unknown>;
    const libro = b2.ucAplicado as Record<string, Record<string, number>>;
    // El montante destino tiene aparatos PROPIOS (lvp ×2) y RAF2 es ramal alimenta: la
    // entrada del libro es el grupo puro del superior — el panel del asociado muestra solo
    // lo heredado (4.5 UC en el dibujo real, no propio + heredado).
    expect(libro['af_RAF2_1']).toEqual({ ino: 2, lvm: 1 });
    expect(libro['af_LD_MAF1_1']).toEqual({ ino: 2, lvm: 1 });
  });

  it('desasociar deja el montante destino sin UC heredados', () => {
    const eng = asociar();
    clearBajanteAssociation(eng, '2', 'MAF1', 'af', '1|MAF2', PLANS);
    expect(apos()['af_LD_MAF1_1']).toBeUndefined();
    const d1 = doc('1');
    const b2 = (d1.bajantes || []).find((b) => b.id === 'MAF2') as Record<string, unknown>;
    const libro = b2?.ucAplicado as Record<string, Record<string, number>> | undefined;
    expect(Object.keys(libro || {}).length).toBe(0);
  });

  it('la corrida posterior conserva la herencia (el refresco local no pisa el libro del asociado)', () => {
    asociar();
    // Ramal propio del piso de abajo CON aparato (campo + conteo): su total local era lo que
    // el refresco 5bis usaba para REEMPLAZAR el libro del asociado, matando la herencia en
    // la primera corrida posterior (se dispara en cada selección, 250 ms tras asociar).
    const d1 = doc('1');
    const r2 = (d1.ramales || []).find((r) => r.id === 'RAF2') as Record<string, unknown>;
    r2.aparatoFin = 'lvr';
    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + '1', JSON.stringify(d1));
    const a = apos();
    a['af_RAF2_1'] = { lvr: 1 };
    localStorage.setItem('civilflow_' + APARATOS_BY_TRAMO_KEY, JSON.stringify(a));

    propagarAparatosPresion('af');

    // El libro del montante destino conserva las entradas de la asociación (el grupo del
    // piso superior) — no fue reemplazado por los totales locales del piso de abajo.
    const b2 = (doc('1').bajantes || []).find((b) => b.id === 'MAF2') as Record<string, unknown>;
    const libro = b2.ucAplicado as Record<string, Record<string, number>>;
    expect(libro['af_LD_MAF1_1']).toEqual({ ino: 2, lvm: 1 });
    expect(libro['af_RAF2_1']).toEqual({ ino: 2, lvm: 1 });
    // El Ldesvio sigue con el grupo (la corrida no lo limpia como residuo).
    expect(apos()['af_LD_MAF1_1']).toEqual({ ino: 2, lvm: 1 });
  });
});

// La carga del montante superior NO siempre vive en su clave propia: a veces vive en los
// RAMALES que él alimenta (dibujados desde el montante hacia el aparato — la cola pts[0]
// queda sobre el montante). El panel los suma (agregadoBajante); la herencia los excluía
// como "espejos de salida" (doctrina de bajantes sanitarios) y la asociación bajaba VACÍA.
describe('la carga en los ramales que el montante ALIMENTA también baja', () => {
  /** Piso 2: MAC1 en (0,0) y su ramal RAF1 dibujado DESDE el montante (cola en él). */
  function seedRamalServido(
    disk: Record<string, Record<string, number>>,
    hered?: Record<string, Record<string, number>>,
  ) {
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({
        ramales: [
          {
            id: 'RAF1',
            net: 'af',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [100, 0],
            ],
            label: 'RAF1',
          },
        ],
        bajantes: [{ id: 'MAC1', net: 'af', tipo: 'montante', x: 0, y: 0 }],
      }),
    );
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '1',
      JSON.stringify({
        ramales: [],
        bajantes: [{ id: 'MAC2', net: 'af', tipo: 'montante', x: 30, y: 30 }],
      }),
    );
    localStorage.setItem('civilflow_' + APARATOS_BY_TRAMO_KEY, JSON.stringify(disk));
    if (hered) localStorage.setItem('civilflow_' + APARATOS_HEREDADOS_KEY, JSON.stringify(hered));
  }

  const SRC1 = { ...SRC, id: 'MAC1', code: 'MAC1' };
  const TGT1 = { ...TGT, id: 'MAC2', code: 'MAC2' };

  beforeEach(() => {
    localStorage.clear();
  });

  it('el ramal dibujado desde el montante (sin listas) hereda sus aparatos', () => {
    seedRamalServido({ af_RAF1_2: { duch: 1, lvm: 2 } });
    const eng = makeEngine('2');
    eng.bajantes.push({ id: 'MAC1', net: 'af', tipo: 'montante', x: 0, y: 0 } as never);
    applyBajanteAssociation(eng, SRC1 as never, TGT1 as never, PLANS);

    // Las tres piezas del enlace llevan el grupo: Ldesvio, fantasma y libro del destino.
    expect(apos()['af_LD_MAC1_1']).toEqual({ duch: 1, lvm: 2 });
    const ghosts = doc('2').crossFloorGhosts || [];
    expect(ghosts[0].aparatos).toEqual({ duch: 1, lvm: 2 });
    const b2 = (doc('1').bajantes || []).find((b) => b.id === 'MAC2') as Record<string, unknown>;
    expect(b2.ucAplicado).toEqual({ af_LD_MAC1_1: { duch: 1, lvm: 2 } });
    expect(b2.ucAcum).toBe(3);
  });

  it('lo propio del ramal servido se descuenta del heredado de upMonte (ni doble ni falta)', () => {
    // El montante lleva {lvm:1} en su clave y upMonte le entrega a RAF1: el disco del
    // ramal muestra {lvm:1 (heredado), duch:1 (propio)}. El grupo que baja es la unión —
    // el lvm del montante UNA vez, el duch del ramal UNA vez.
    seedRamalServido(
      { af_MAC1_2: { lvm: 1 }, af_RAF1_2: { lvm: 1, duch: 1 } },
      { af_RAF1_2: { lvm: 1 } },
    );
    const eng = makeEngine('2');
    eng.bajantes.push({ id: 'MAC1', net: 'af', tipo: 'montante', x: 0, y: 0 } as never);
    applyBajanteAssociation(eng, SRC1 as never, TGT1 as never, PLANS);

    expect(apos()['af_LD_MAC1_1']).toEqual({ lvm: 1, duch: 1 });
  });

  it('REPRO capturas: los ramales viejos en alimentaIds NO inflan el grupo (4.5, no 15.5)', () => {
    // Estado real del usuario: la carga verdadera (4.5 UC) vive en la CLAVE PROPIA del
    // montante superior; los ramales listados en alimentaIds arrastran conteos de la era
    // en que los aparatos se asignaban a ramales (con aparatoInicio/Fin, que nada limpia).
    // El panel del superior los excluye (4.50 ✓) — la herencia también debe excluirlos
    // (abajo se veía 15.5 = 4.5 + junk).
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({
        ramales: [
          {
            id: 'RAFA',
            net: 'af',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [100, 0],
            ],
            label: 'RAFA',
            aparatoFin: 'duc',
          },
        ],
        bajantes: [
          {
            id: 'MAC1',
            net: 'af',
            tipo: 'montante',
            x: 0,
            y: 0,
            alimentaIds: ['RAFA'],
          },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '1',
      JSON.stringify({
        ramales: [],
        bajantes: [{ id: 'MAC2', net: 'af', tipo: 'montante', x: 30, y: 30 }],
      }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({
        af_MAC1_2: { duc: 1, lvro: 1, lvm: 1, lvp: 1, tin: 1 },
        af_RAFA_2: { duc: 2, lvro: 2, lvm: 4, lvp: 1, tin: 4 },
      }),
    );
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'MAC1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      alimentaIds: ['RAFA'],
    } as never);
    applyBajanteAssociation(eng, SRC1 as never, TGT1 as never, PLANS);

    // Las tres piezas llevan SOLO el grupo real del superior — sin el junk de los ramales.
    expect(apos()['af_LD_MAC1_1']).toEqual({ duc: 1, lvro: 1, lvm: 1, lvp: 1, tin: 1 });
    const ghosts = doc('2').crossFloorGhosts || [];
    expect(ghosts[0].aparatos).toEqual({ duc: 1, lvro: 1, lvm: 1, lvp: 1, tin: 1 });
    const b2 = (doc('1').bajantes || []).find((b) => b.id === 'MAC2') as Record<string, unknown>;
    expect(b2.ucAplicado).toEqual({ af_LD_MAC1_1: { duc: 1, lvro: 1, lvm: 1, lvp: 1, tin: 1 } });
    expect(b2.ucAcum).toBe(5);
  });

  it('REPRO triplicado por libro: el libro rancio del STORAGE del superior no gana al árbol', () => {
    // La cura (block-2/apply) reescribe el libro del piso de ABAJO, pero el libro rancio del
    // STORAGE del piso SUPERIOR nadie lo re-escribe nunca (5bis salta a los asociados) — y
    // collectSourceAgg lo mezclaba con máximo en cada pase: el grupo salía 15.5 otra vez con
    // el panel superior en 4.5. Regla nueva: con árbol presente, el libro ramal-claveado
    // queda silenciado (solo mezcla el passthrough sin ramales — cadena).
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({
        ramales: [
          {
            id: 'RAFA',
            net: 'af',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [100, 0],
            ],
            label: 'RAFA',
            aparatoFin: 'duc',
          },
        ],
        bajantes: [
          {
            id: 'MAC1',
            net: 'af',
            tipo: 'montante',
            x: 0,
            y: 0,
            alimentaIds: ['RAFA'],
            ucAplicado: {
              af_LD_MAC1_1: { duc: 3, lvro: 3, lvm: 5, lvp: 2, tin: 5 },
              af_RAFA_2: { duc: 3, lvro: 3, lvm: 5, lvp: 2, tin: 5 },
            },
          },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '1',
      JSON.stringify({
        ramales: [],
        bajantes: [{ id: 'MAC2', net: 'af', tipo: 'montante', x: 30, y: 30 }],
      }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({
        af_MAC1_2: { duc: 1, lvro: 1, lvm: 1, lvp: 1, tin: 1 },
        af_RAFA_2: { duc: 2, lvro: 2, lvm: 4, lvp: 1, tin: 4 },
      }),
    );
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'MAC1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      alimentaIds: ['RAFA'],
      ucAplicado: {
        af_LD_MAC1_1: { duc: 3, lvro: 3, lvm: 5, lvp: 2, tin: 5 },
        af_RAFA_2: { duc: 3, lvro: 3, lvm: 5, lvp: 2, tin: 5 },
      },
    } as never);
    applyBajanteAssociation(eng, SRC1 as never, TGT1 as never, PLANS);

    // El grupo que baja = el árbol fresco (clave propia 4.5 UC), NO el libro rancio.
    expect(apos()['af_LD_MAC1_1']).toEqual({ duc: 1, lvro: 1, lvm: 1, lvp: 1, tin: 1 });
    const b2 = (doc('1').bajantes || []).find((b) => b.id === 'MAC2') as Record<string, unknown>;
    expect(b2.ucAcum).toBe(5);
  });
});

// Crear un MONTANTE en el extremo de un ramal debe RECOGER los aparatos de ese ramal: el
// ramal entra al montante (su `fin` = el código del montante) → el montante arrastra su carga
// y el ramal NO puede recibir la del montante (sería un ciclo: el montante se alimentaría de
// sí mismo y los conteos se multiplicaban — orig. usuario: "los montantes ya no recogen los
// aparatos" y "se triplican").
describe('montante creado en el extremo de un ramal: recoge sus aparatos', () => {
  /** Piso con un ramal af que trae 1 UC y su extremo final. */
  function seedRamalConAparato(): void {
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({
        ramales: [
          {
            id: 'RAF1',
            net: 'af',
            tipo: 'ramal',
            pts: [
              [0, 0],
              [100, 0],
            ],
            label: 'RAF1',
            diametro: '1/2"',
            // El campo de aparato es lo que marca el conteo como PROPIO: sin él la
            // propagación lo limpia por "residuo de doctrinas viejas".
            aparatoFin: 'lvm',
          },
        ],
        bajantes: [],
      }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ af_RAF1_2: { lvm: 1 } }),
    );
  }

  function motor(): IPlanoEngineCore {
    const eng = makeEngine('2');
    eng.ramales = [
      {
        id: 'RAF1',
        net: 'af',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [100, 0],
        ],
        label: 'RAF1',
        diametro: '1/2"',
        aparatoFin: 'lvm',
      } as never,
    ];
    (eng as unknown as { snapMode: boolean }).snapMode = false;
    (eng as unknown as { zoom: number }).zoom = 1;
    (eng as unknown as { _renumberMontantes: () => void })._renumberMontantes = () => {};
    return eng;
  }

  beforeEach(() => {
    localStorage.clear();
    seedRamalConAparato();
  });

  it('el montante nace enlazado al ramal (recibeDeIds + asocManual) y con su código en el inicio', () => {
    const eng = motor();
    // El extremo por donde SALE el flujo (la cola): el montante lo alimenta (codo 'sube').
    handleMontanteDown(eng, 0, 0);
    const mon = eng.bajantes.find((b) => b.tipo === 'montante');
    expect(mon).toBeDefined();
    expect(mon!.recibeDeIds).toContain('RAF1');
    expect((mon as { asocManual?: string[] }).asocManual).toContain('RAF1');
    const ramal = eng.ramales.find((r) => r.id === 'RAF1');
    expect(ramal?.ini).toBe(mon!.code);
  });

  it('el aparato del ramal NO se multiplica: el ramal no recibe la carga del montante', () => {
    const eng = motor();
    handleMontanteDown(eng, 0, 0);
    const mon = eng.bajantes.find((b) => b.tipo === 'montante')!;
    propagarAparatosPresion('af');
    const disk = JSON.parse(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}');
    // El ramal conserva SOLO su aparato propio (nada de ciclo con el montante).
    expect(disk['af_RAF1_2']).toEqual({ lvm: 1 });
    // Y el grupo del montante (lo que baja al piso siguiente) = el aparato del ramal, UNA vez.
    const { agg } = collectSourceAgg({
      net: 'af',
      planId: '2',
      bajId: mon.id,
      liveBaj: mon as never,
      liveRamales: eng.ramales as never,
      counts: disk,
      hidro: {},
    });
    expect(agg).toEqual({ lvm: 1 });
  });

  it('un ramal que LLEGA al montante aporta sus aparatos al grupo (y no recibe su carga)', () => {
    // El ramal entra por su extremo final (r.fin = el código del montante): el montante
    // arrastra su carga y el ramal NO puede recibir la del montante (ciclo).
    const eng = motor();
    eng.ramales[0].ini = '';
    eng.ramales[0].fin = 'MAF1';
    eng.bajantes.push({
      id: 'MAF1',
      code: 'MAF1',
      net: 'af',
      tipo: 'montante',
      x: 100,
      y: 0,
      recibeDeIds: ['RAF1'],
      asocManual: ['RAF1'],
      dNominal: '1/2"',
    } as never);
    propagarAparatosPresion('af');
    const disk = JSON.parse(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}');
    expect(disk['af_RAF1_2']).toEqual({ lvm: 1 });
    const { agg } = collectSourceAgg({
      net: 'af',
      planId: '2',
      bajId: 'MAF1',
      liveBaj: eng.bajantes.find((b) => b.id === 'MAF1') as never,
      liveRamales: eng.ramales as never,
      counts: disk,
      hidro: {},
    });
    expect(agg).toEqual({ lvm: 1 });
  });
});
// REPRO del usuario: el montante tiene 3 aparatos y el ramal que le sirve YA LLEVA esa carga
// (upMonte se la entregó: quedó en su disco y en el libro de heredados). Al sumar el cierre de
// `recibeDeIds` con la clave COMPLETA del ramal, la carga se contaba DOS veces (3 → 6) y el
// grupo que bajaba al piso de abajo salía triplicado.
describe('REPRO: el ramal que el montante alimenta NO se cuenta dos veces', () => {
  const SRC1 = { ...SRC, id: 'MAC1', code: 'MAC1' };
  const TGT1 = { ...TGT, id: 'MAC2', code: 'MAC2' };

  /** Piso SUPERIOR: MAC1 con 3 UC propios y RAF1 (su cola a 8 px — fuera de la tolerancia de 2). */
  function seedAsoc(disk: Record<string, Record<string, number>>): void {
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({
        ramales: [
          {
            id: 'RAF1',
            net: 'af',
            tipo: 'ramal',
            pts: [
              [8, 0],
              [100, 0],
            ],
            label: 'RAF1',
          },
        ],
        bajantes: [
          {
            id: 'MAC1',
            net: 'af',
            tipo: 'montante',
            x: 0,
            y: 0,
            recibeDeIds: ['RAF1'],
            asocManual: ['RAF1'],
          },
        ],
      }),
    );
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '1',
      JSON.stringify({
        ramales: [],
        bajantes: [{ id: 'MAC2', net: 'af', tipo: 'montante', x: 30, y: 30 }],
      }),
    );
    localStorage.setItem('civilflow_' + APARATOS_BY_TRAMO_KEY, JSON.stringify(disk));
    // El libro de heredados: lo que upMonte entregó al ramal.
    localStorage.setItem(
      'civilflow_' + APARATOS_HEREDADOS_KEY,
      JSON.stringify({ af_RAF1_2: { lvm: 3 } }),
    );
  }

  function asociar(): IPlanoEngineCore {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'MAC1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
      asocManual: ['RAF1'],
    } as never);
    applyBajanteAssociation(eng, SRC1 as never, TGT1 as never, PLANS);
    return eng;
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('el grupo que baja es el del montante (3 UC), no el doble', () => {
    seedAsoc({ af_MAC1_2: { lvm: 3 }, af_RAF1_2: { lvm: 3 } });
    asociar();
    expect(apos()['af_LD_MAC1_1']).toEqual({ lvm: 3 });
    const b2 = (doc('1').bajantes || []).find((b) => b.id === 'MAC2') as Record<string, unknown>;
    expect(b2.ucAcum).toBe(3);
  });

  it('lo PROPIO del ramal suma una vez (lo que le entregó el montante no)', () => {
    // El ramal tiene además un aparato suyo (duch): grupo = 3 (montante) + 1 (propio) = 4.
    seedAsoc({ af_MAC1_2: { lvm: 3 }, af_RAF1_2: { lvm: 3, duch: 1 } });
    asociar();
    expect(apos()['af_LD_MAC1_1']).toEqual({ lvm: 3, duch: 1 });
    const b2 = (doc('1').bajantes || []).find((b) => b.id === 'MAC2') as Record<string, unknown>;
    expect(b2.ucAcum).toBe(4);
  });

  it('es idempotente: repetir la asociación no vuelve a multiplicar', () => {
    seedAsoc({ af_MAC1_2: { lvm: 3 }, af_RAF1_2: { lvm: 3 } });
    asociar();
    asociar();
    expect(apos()['af_LD_MAC1_1']).toEqual({ lvm: 3 });
    const b2 = (doc('1').bajantes || []).find((b) => b.id === 'MAC2') as Record<string, unknown>;
    expect(b2.ucAcum).toBe(3);
  });

  it('un ramal de aguas arriba conserva su heredado (unión) en el grupo', () => {
    // El ramal ENTRA al montante (cabeza sobre él) y trae la carga de una unión (her) más un
    // aparato suyo: el grupo debe llevar las dos — solo se resta lo entregado por el montante.
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '2',
      JSON.stringify({
        ramales: [
          {
            id: 'RAF1',
            net: 'af',
            tipo: 'ramal',
            pts: [
              [100, 0],
              [0, 0],
            ],
            label: 'RAF1',
          },
        ],
        bajantes: [{ id: 'MAC1', net: 'af', tipo: 'montante', x: 0, y: 0, recibeDeIds: ['RAF1'] }],
      }),
    );
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '1',
      JSON.stringify({
        ramales: [],
        bajantes: [{ id: 'MAC2', net: 'af', tipo: 'montante', x: 30, y: 30 }],
      }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ af_RAF1_2: { lvm: 3, duch: 1 } }),
    );
    localStorage.setItem(
      'civilflow_' + APARATOS_HEREDADOS_KEY,
      JSON.stringify({ af_RAF1_2: { lvm: 3 } }),
    );
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'MAC1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
    } as never);
    applyBajanteAssociation(eng, SRC1 as never, TGT1 as never, PLANS);
    expect(apos()['af_LD_MAC1_1']).toEqual({ lvm: 3, duch: 1 });
  });
});
