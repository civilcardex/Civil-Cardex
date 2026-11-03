/** Equivalencia de ESTADO FINAL de los barridos batch de fantasmas entrepisos (H-6): N llamadas
 *  individuales y 1 llamada batch sobre el MISMO storage deben dejar el localStorage IDÉNTICO
 *  (byte a byte) — solo cambia CUÁNDO se lee/guarda cada piso (1 vez en vez de N). */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import {
  removeCrossFloorGhostsBySource,
  removeCrossFloorGhostsBySourceBatch,
  updateCrossFloorGhostPositionBySource,
  updateCrossFloorGhostPositionBySourceBatch,
  updateCrossFloorGhostFieldBySource,
  updateCrossFloorGhostFieldBySourceBatch,
} from '../crossFloorStorage.ts';

// El diario de trazos escribe claves de diagnóstico (con stack, distinto por camino) y el push a
// BD es async: fuera de alcance — aquí se compara el ESTADO LOCAL de los pisos.
vi.mock('../../services/storage/trazosJournal.ts', () => ({
  journalTrazos: () => {},
  leerJournalTrazos: () => [],
  limpiarJournalTrazos: () => {},
}));
vi.mock('../../services/storageService.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/storageService.ts')>();
  return { ...actual, saveTrazosToDB: () => Promise.resolve() };
});

// ts congelado: saveData estampa Date.now() en cada guardado — con el stub, individual y batch
// escriben el MISMO ts y el volcado completo es comparable.
const TS_FIJO = 1_700_000_000_000;

const keyDe = (planId: string): string => 'civilflow_' + TRAZOS_PREFIX + planId;

/** Escenario: 10 pisos, 20 fantasmas del origen '1' repartidos en los pisos 2..9, fantasmas de
 *  otros orígenes que deben sobrevivir, un ghost del mismo piso 1 (skip) y el piso 10 SIN
 *  ghosts (no debe tocarse: sin lectura-escritura, sin ts nuevo). */
function seed(): Record<string, string> {
  const claves: Record<string, string> = {};
  claves['civilflow_plans_meta'] = JSON.stringify(
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      origen: { x_px: 100 + (i + 1) * 10, y_px: 50 + (i + 1) * 7 },
    })),
  );
  // BANk vive como ghost en el piso ((k−1) % 8) + 2 → pisos 2..9 con 2-3 ghosts cada uno.
  const pisoDe = (k: number): number => ((k - 1) % 8) + 2;
  const ghostOrigen1 = (k: number): Record<string, unknown> => ({
    id: `XFG_BAN${k}_1`,
    net: 'af',
    code: `BAN${k}`,
    x: 10 + k,
    y: 20 + 2 * k,
    dNominal: k === 5 ? '2"' : '3"',
    ...(k === 9 ? {} : { parentDireccion: 'O-E' }),
    piso: 'P1',
    sourcePlanId: '1',
    sourceBajanteId: `BAN${k}`,
    targetBajanteId: `TGT${k}`,
    layout: 2,
  });
  for (let p = 1; p <= 10; p++) {
    const doc: Record<string, unknown> = { ts: 1000 + p, assocLayout: 2, scaleM: 0.5 };
    if (p === 1) {
      doc.bajantes = Array.from({ length: 20 }, (_, i) => ({ id: `BAN${i + 1}`, x: i, y: i }));
      doc.ramales = [
        {
          id: 'LD_BAN1',
          label: 'RAF1',
          pts: [
            [0, 0],
            [5, 5],
          ],
        },
      ];
      // Mismo piso origen: el barrido lo SALTA — este ghost debe sobrevivir.
      doc.crossFloorGhosts = [
        {
          id: 'XFG_BAN1_1_mismo',
          net: 'af',
          sourcePlanId: '1',
          sourceBajanteId: 'BAN1',
          targetBajanteId: 'MISMO_PISO',
          x: 1,
          y: 2,
        },
      ];
    } else if (p <= 9) {
      const ghosts: Record<string, unknown>[] = [];
      for (let k = 1; k <= 20; k++) if (pisoDe(k) === p) ghosts.push(ghostOrigen1(k));
      if (p === 3)
        ghosts.push({
          id: 'XFG_MAC2_2',
          net: 'af',
          sourcePlanId: '2',
          sourceBajanteId: 'MAC2',
          targetBajanteId: 'BAN9',
          x: 7,
          y: 8,
          dNominal: '4"',
        });
      if (p === 4)
        ghosts.push({
          id: 'XFG_MAC3_3',
          net: 'ac',
          sourcePlanId: '3',
          sourceBajanteId: 'MAC3',
          targetBajanteId: 'BAN1',
          x: 9,
          y: 9,
          dNominal: '2"',
        });
      if (p === 6)
        ghosts.push({
          id: 'XFG_BAN500_1',
          net: 'af',
          sourcePlanId: '1',
          sourceBajanteId: 'BAN500',
          targetBajanteId: 'TGT500',
          x: 3,
          y: 4,
          dNominal: '3"',
        });
      doc.crossFloorGhosts = ghosts;
    }
    // p === 10: SIN crossFloorGhosts (caso borde — el barrido no debe tocarlo).
    claves[keyDe(String(p))] = JSON.stringify(doc);
  }
  return claves;
}

const IDS_20 = Array.from({ length: 20 }, (_, i) => `BAN${i + 1}`);

/** Vuelca TODO el localStorage a un string determinista (claves ordenadas). */
function volcar(): string {
  const claves: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) claves.push(k);
  }
  claves.sort();
  return JSON.stringify(claves.map((k) => [k, localStorage.getItem(k)]));
}

/** Carga la semilla en localStorage, corre la operación y devuelve el volcado completo. */
function correrEnCopia(semilla: Record<string, string>, ejecutar: () => void): string {
  localStorage.clear();
  for (const [k, v] of Object.entries(semilla)) localStorage.setItem(k, v);
  ejecutar();
  return volcar();
}

beforeAll(() => {
  vi.spyOn(Date, 'now').mockReturnValue(TS_FIJO);
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
});

describe('equivalencia individual N vs batch 1 — removeCrossFloorGhostsBySource', () => {
  it('20 llamadas individuales y 1 batch de 20 ids dejan el localStorage IDÉNTICO', () => {
    const semilla = seed();
    const individual = correrEnCopia(semilla, () => {
      for (const id of IDS_20) removeCrossFloorGhostsBySource('1', id);
    });
    let eliminados = -1;
    const batch = correrEnCopia(semilla, () => {
      eliminados = removeCrossFloorGhostsBySourceBatch('1', IDS_20);
    });
    expect(eliminados).toBe(20);
    expect(batch).toBe(individual);
  });

  it('el batch borra los fantasmas del origen y conserva los de otros orígenes', () => {
    correrEnCopia(seed(), () => {
      removeCrossFloorGhostsBySourceBatch('1', IDS_20);
    });
    const floor2 = JSON.parse(localStorage.getItem(keyDe('2')) || '{}') as {
      crossFloorGhosts?: Array<{ sourcePlanId: string; sourceBajanteId: string }>;
    };
    expect(floor2.crossFloorGhosts?.filter((g) => g.sourcePlanId === '1')).toEqual([]);
    // Otro origen (piso 2 → MAC2 en piso 3): sobrevive; id del origen fuera de la lista
    // (BAN500 en piso 6): sobrevive.
    const floor3 = JSON.parse(localStorage.getItem(keyDe('3')) || '{}') as {
      crossFloorGhosts?: Array<{ sourceBajanteId: string }>;
    };
    expect(floor3.crossFloorGhosts?.map((g) => g.sourceBajanteId)).toContain('MAC2');
    const floor6 = JSON.parse(localStorage.getItem(keyDe('6')) || '{}') as {
      crossFloorGhosts?: Array<{ sourceBajanteId: string }>;
    };
    expect(floor6.crossFloorGhosts?.map((g) => g.sourceBajanteId)).toContain('BAN500');
    // Mismo piso origen: salteado — su ghost sobrevive en el piso 1.
    const floor1 = JSON.parse(localStorage.getItem(keyDe('1')) || '{}') as {
      crossFloorGhosts?: Array<{ sourceBajanteId: string }>;
    };
    expect(floor1.crossFloorGhosts?.map((g) => g.sourceBajanteId)).toContain('BAN1');
  });

  it('ids inexistentes: ni un byte cambia y devuelve 0', () => {
    const semilla = seed();
    const intacto = correrEnCopia(semilla, () => {});
    let eliminados = -1;
    const trasBatch = correrEnCopia(semilla, () => {
      eliminados = removeCrossFloorGhostsBySourceBatch('1', ['BAN999', 'BAN888']);
    });
    expect(eliminados).toBe(0);
    expect(trasBatch).toBe(intacto);
  });

  it('el piso SIN ghosts (10) queda byte a byte igual al seed (sin ts nuevo)', () => {
    const semilla = seed();
    correrEnCopia(semilla, () => {
      removeCrossFloorGhostsBySourceBatch('1', IDS_20);
      updateCrossFloorGhostPositionBySourceBatch(
        '1',
        IDS_20.map((id, i) => ({ bajanteId: id, x: 100 + i, y: 200 + i })),
      );
    });
    expect(localStorage.getItem(keyDe('10'))).toBe(semilla[keyDe('10')]);
  });
});

describe('equivalencia individual N vs batch 1 — updateCrossFloorGhostPositionBySource', () => {
  it('20 llamadas individuales y 1 batch de 20 items dejan el localStorage IDÉNTICO', () => {
    const semilla = seed();
    const individual = correrEnCopia(semilla, () => {
      IDS_20.forEach((id, i) =>
        updateCrossFloorGhostPositionBySource('1', id, 300 + i, 400 + 2 * i),
      );
    });
    const batch = correrEnCopia(semilla, () => {
      updateCrossFloorGhostPositionBySourceBatch(
        '1',
        IDS_20.map((id, i) => ({ bajanteId: id, x: 300 + i, y: 400 + 2 * i })),
      );
    });
    expect(batch).toBe(individual);
    // Y el re-anclaje realmente ocurrió (frame del anfitrión, no coords crudas).
    correrEnCopia(semilla, () => {
      updateCrossFloorGhostPositionBySourceBatch('1', [{ bajanteId: 'BAN1', x: 300, y: 400 }]);
    });
    const floor2 = JSON.parse(localStorage.getItem(keyDe('2')) || '{}') as {
      crossFloorGhosts?: Array<{ sourceBajanteId: string; x: number; y: number }>;
    };
    const g = floor2.crossFloorGhosts?.find((x) => x.sourceBajanteId === 'BAN1');
    // origen 1 = (110,57), origen 2 = (120,64): (300−110+120, 400−57+64) = (310, 407).
    expect(g).toMatchObject({ x: 310, y: 407 });
  });

  it('id inexistente: sin cambios', () => {
    const semilla = seed();
    const intacto = correrEnCopia(semilla, () => {});
    const trasBatch = correrEnCopia(semilla, () => {
      updateCrossFloorGhostPositionBySourceBatch('1', [{ bajanteId: 'BAN999', x: 1, y: 1 }]);
    });
    expect(trasBatch).toBe(intacto);
  });
});

describe('equivalencia individual N vs batch 1 — updateCrossFloorGhostFieldBySource', () => {
  it('5 llamadas individuales y 1 batch de 5 items dejan el localStorage IDÉNTICO', () => {
    const semilla = seed();
    const items = [
      { bajanteId: 'BAN1', field: 'dNominal' as const, value: '4"' },
      { bajanteId: 'BAN9', field: 'parentDireccion' as const, value: 'N-S' },
      { bajanteId: 'BAN5', field: 'dNominal' as const, value: '2"' }, // igual al actual: sin cambio
      { bajanteId: 'BAN17', field: 'dNominal' as const, value: '2"' },
      { bajanteId: 'BAN20', field: 'parentDireccion' as const, value: 'E-O' },
    ];
    const individual = correrEnCopia(semilla, () => {
      for (const it of items)
        updateCrossFloorGhostFieldBySource('1', it.bajanteId, it.field, it.value);
    });
    const batch = correrEnCopia(semilla, () => {
      updateCrossFloorGhostFieldBySourceBatch('1', items);
    });
    expect(batch).toBe(individual);
  });

  it('el batch aplica los cambios (y el no-cambio no toca su ghost)', () => {
    correrEnCopia(seed(), () => {
      updateCrossFloorGhostFieldBySourceBatch('1', [
        { bajanteId: 'BAN1', field: 'dNominal', value: '4"' },
        { bajanteId: 'BAN9', field: 'parentDireccion', value: 'N-S' },
      ]);
    });
    const floor2 = JSON.parse(localStorage.getItem(keyDe('2')) || '{}') as {
      crossFloorGhosts?: Array<Record<string, unknown>>;
    };
    const g1 = floor2.crossFloorGhosts?.find((x) => x.sourceBajanteId === 'BAN1');
    expect(g1).toMatchObject({ dNominal: '4"' });
    const g9 = floor2.crossFloorGhosts?.find((x) => x.sourceBajanteId === 'BAN9');
    expect(g9).toMatchObject({ parentDireccion: 'N-S' });
  });

  it('id inexistente: sin cambios', () => {
    const semilla = seed();
    const intacto = correrEnCopia(semilla, () => {});
    const trasBatch = correrEnCopia(semilla, () => {
      updateCrossFloorGhostFieldBySourceBatch('1', [
        { bajanteId: 'BAN999', field: 'dNominal', value: '1"' },
      ]);
    });
    expect(trasBatch).toBe(intacto);
  });
});
