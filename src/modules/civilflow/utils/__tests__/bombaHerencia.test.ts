import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys';
import {
  asociarBomba,
  quitarBomba,
  propagarHerenciaBomba,
  mapUdBombaDesdeTrazos,
} from '../bombaAssociation';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState';

// Herencia bomba→bajante: converge y no crece aunque las listas vengan mixtas; quitar con
// snapshot stale resta el libro vivo; asociar propaga sincrónicamente.

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.window) {
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
  }
  if (!g.document) {
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({}),
    };
  }
});

const APOS = 'civilflow_' + APARATOS_BY_TRAMO_KEY;

function seed() {
  // Piso 1: caja CAN1 (recibe RS1 + RS2 sucio, alimenta RS2) + bomba BOMAN-S1.
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      ramales: [
        {
          id: 'RS1',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [100, 0],
            [0, 0],
          ],
        },
        {
          id: 'RS2',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [60, 60],
          ],
        },
      ],
      bajantes: [
        {
          id: 'CAN1',
          net: 'san',
          tipo: 'caja_san',
          x: 0,
          y: 0,
          recibeDeIds: ['RS1', 'RS2'],
          alimentaIds: ['RS2'],
        },
        { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', recibeDeIds: [] },
      ],
    }),
  );
  // Piso 2: bajante BAN9 con ramal propio RS9.
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '2',
    JSON.stringify({
      ramales: [
        {
          id: 'RS9',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [50, 50],
            [30, 30],
          ],
        },
      ],
      bajantes: [{ id: 'BAN9', net: 'san', tipo: 'bajante', x: 30, y: 30, recibeDeIds: ['RS9'] }],
    }),
  );
  localStorage.setItem(
    APOS,
    JSON.stringify({ san_RS1_1: { ino: 10 }, san_RS2_1: { ino: 10 }, san_RS9_2: { lav: 1 } }),
  );
}

function makeEngine(loadedPlanId: string): IPlanoEngineCore {
  const engine: Record<string, unknown> = {
    ramales: [],
    bajantes: [],
    _loadedPlanId: loadedPlanId,
    render: () => {},
    _markDirty: () => {},
    updateElementById: (id: string, fields: Record<string, unknown>) => {
      const el = (engine.bajantes as Array<Record<string, unknown>>).find((x) => x.id === id);
      if (el) Object.assign(el, fields);
    },
  };
  return engine as never as IPlanoEngineCore;
}

const readApos = (): Record<string, Record<string, number>> =>
  JSON.parse(localStorage.getItem(APOS) || '{}');

beforeEach(() => {
  localStorage.clear();
  seed();
});

describe('propagarHerenciaBomba converge (anti suma-infinita)', () => {
  it('dos pasadas con listas mixtas: espejo exacto y sin crecimiento', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN9',
      net: 'san',
      tipo: 'bajante',
      x: 30,
      y: 30,
      recibeDeIds: ['RS9'],
      bombaEnId: '1|BOMAN-S1',
    } as never);
    const disk = readApos();
    expect(propagarHerenciaBomba(eng, '2', 'san', disk)).toBe(true);
    localStorage.setItem(APOS, JSON.stringify(disk));
    // Espejo = solo RS1 (RS2 es salida aunque esté en recibeDeIds)
    expect(readApos()['san_RS9_2']).toEqual({ lav: 1, ino: 10 });
    // Libro registrado en el vivo y ucAcum total
    const live = eng.bajantes.find((b) => b.id === 'BAN9') as unknown as {
      ucAplicado?: Record<string, Record<string, number>>;
      ucAcum?: number;
    };
    expect(live.ucAplicado?.['san_RS9_2']).toEqual({ ino: 10 });
    expect(live.ucAcum).toBe(10);
    // Segunda pasada: sin cambios (converge, no crece a 20/30…)
    const disk2 = readApos();
    expect(propagarHerenciaBomba(eng, '2', 'san', disk2)).toBe(false);
    expect(readApos()['san_RS9_2']).toEqual({ lav: 1, ino: 10 });
  });
});

describe('quitarBomba con snapshot stale', () => {
  it('resta el libro VIVO aunque el snapshot no lo traiga', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN9',
      net: 'san',
      tipo: 'bajante',
      x: 30,
      y: 30,
      recibeDeIds: ['RS9'],
      bombaEnId: '1|BOMAN-S1',
      ucAplicado: { san_RS9_2: { ino: 10 } },
    } as never);
    const disk = readApos();
    disk['san_RS9_2'] = { lav: 1, ino: 10 };
    localStorage.setItem(APOS, JSON.stringify(disk));
    // Snapshot viejo: con bombaEnId pero SIN ucAplicado
    const stale = { id: 'BAN9', net: 'san', bombaEnId: '1|BOMAN-S1' };
    quitarBomba(eng as never, stale as never, '2', []);
    expect(readApos()['san_RS9_2']).toEqual({ lav: 1 });
  });
});

describe('asociarBomba propaga sincrónicamente', () => {
  it('al marcar, los ramales del bajante ya traen las UDs (sin esperar al efecto)', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN9',
      net: 'san',
      tipo: 'bajante',
      x: 30,
      y: 30,
      recibeDeIds: ['RS9'],
      bombaEnId: null,
    } as never);
    const row = {
      planId: '1',
      id: 'BOMAN-S1',
      code: 'BOMAN-S1',
      caja: 'CAN1',
      nivel: 'S1',
      x: 10,
      y: 10,
      net: 'san',
    };
    asociarBomba(eng as never, { id: 'BAN9', net: 'san', bombaEnId: null }, '2', row, []);
    expect(readApos()['san_RS9_2']).toEqual({ lav: 1, ino: 10 });
    const live = eng.bajantes.find((b) => b.id === 'BAN9') as unknown as { bombaEnId?: string };
    expect(live.bombaEnId).toBe('1|BOMAN-S1');
  });
});

describe('sin crecimiento entre pasadas (el 1430 se sana solo)', () => {
  it('espejo→salidas→espejo converge al total real, no crece', () => {
    // Resto inflado de antes del fix en la salida RS2
    const disk0 = readApos();
    disk0['san_RS2_1'] = { ino: 40 };
    localStorage.setItem(APOS, JSON.stringify(disk0));
    for (let i = 0; i < 3; i++) {
      const m = mapUdBombaDesdeTrazos('1', 'BOMAN-S1', 'san');
      const disk = readApos();
      disk['san_BOMAN-S1_1'] = { ...m };
      disk['san_RS2_1'] = { ...m }; // el efecto re-espeja las salidas con el agregado
      localStorage.setItem(APOS, JSON.stringify(disk));
    }
    expect(readApos()['san_BOMAN-S1_1']).toEqual({ ino: 10 });
    expect(readApos()['san_RS2_1']).toEqual({ ino: 10 });
  });
});
