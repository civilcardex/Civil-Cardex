import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys';
import { asociarBomba, quitarBomba, propagarHerenciaBomba } from '../bombaAssociation';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState';

// Desvío bomba→bajante superior (orig. usuario): desalineados, un ramal LD_ que SALE DE LA
// BOMBA en su piso — cuenta como cualquier ramal y ESPEJA las UDs de la bomba (lo mantiene
// fresco propagarHerenciaBomba) — más el anillo en la bomba; alineados, solo el marcador
// fantasma (sin LD ni anillo). quitarBomba limpia TODO.

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

function makeEngine(loadedPlanId: string): IPlanoEngineCore {
  const engine: Record<string, unknown> = {
    ramales: [],
    bajantes: [],
    crossFloorGhosts: [],
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

const trazosDe = (planId: string) =>
  JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + planId) || '{}') as {
    ramales?: Array<{ id: string; pts?: number[][] }>;
    bajantes?: Array<{
      id: string;
      desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
    }>;
    crossFloorGhosts?: Array<{ id: string; targetBajanteId?: string }>;
  };
const readApos = (): Record<string, Record<string, number>> =>
  JSON.parse(localStorage.getItem(APOS) || '{}');

const row = (x: number, y: number) => ({
  planId: '1',
  id: 'BOMAN-S1',
  code: 'BOMAN-S1',
  caja: 'CAN1',
  nivel: 'S1',
  nivelN: -1,
  x,
  y,
  net: 'san',
});

beforeEach(() => {
  localStorage.clear();
  // Trazos del piso de la bomba: ramales + bajantes en el MISMO documento (así lee el motor).
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
      ],
      bajantes: [
        {
          id: 'CAN1',
          net: 'san',
          tipo: 'caja_san',
          x: 0,
          y: 0,
          recibeDeIds: ['RS1'],
          alimentaIds: [],
        },
        {
          id: 'BOMAN-S1',
          net: 'san',
          tipo: 'bomba',
          cajaOrigenId: 'CAN1',
          x: 10,
          y: 10,
        },
      ],
    }),
  );
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '2',
    JSON.stringify({
      ramales: [],
      bajantes: [{ id: 'BAN9', net: 'san', tipo: 'bajante', x: 30, y: 30 }],
    }),
  );
  localStorage.setItem(APOS, JSON.stringify({ san_RS1_1: { ino: 10 } }));
});

describe('desvío bomba→bajante superior', () => {
  it('desalineados: LD sale de la bomba, anillo en la bomba, fantasma arriba, UDs espejo', () => {
    const eng = makeEngine('2');
    asociarBomba(
      eng as never,
      { id: 'BAN9', net: 'san', bombaEnId: null, x: 30, y: 30 },
      '2',
      row(10, 10),
      [],
    );

    // LD_BAN9 en el piso de la bomba, saliendo de (10,10) hacia (30,30).
    const pisoBomba = trazosDe('1');
    const ld = pisoBomba.ramales?.find((r) => r.id === 'LD_BAN9');
    expect(ld?.pts).toEqual([
      [10, 10],
      [30, 30],
    ]);
    // Anillo en la bomba apuntando al LD.
    const desp = pisoBomba.bajantes?.find((b) => b.id === 'BOMAN-S1')?.desplazamientos;
    const lvl = Object.keys(desp || {})[0];
    expect(desp?.[lvl]?.Ldesvio).toBe('LD_BAN9');
    expect(desp?.[lvl]?.dx).toBe(20);
    // Fantasma en el piso superior referenciando la bomba.
    const ghost = trazosDe('2').crossFloorGhosts?.find((g) => g.id === 'XFG_BOMAN-S1_1');
    expect(ghost?.targetBajanteId).toBe('BAN9');
    // Espejo de UDs del LD = agregado de la caja (RS1 → ino:10).
    expect(readApos()['san_LD_BAN9_1']).toEqual({ ino: 10 });
  });

  it('alineados: solo fantasma, sin LD ni anillo', () => {
    // Bomba en la MISMA posición que BAN9 (30,30).
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
        ],
        bajantes: [
          {
            id: 'CAN1',
            net: 'san',
            tipo: 'caja_san',
            x: 0,
            y: 0,
            recibeDeIds: ['RS1'],
            alimentaIds: [],
          },
          { id: 'BOMAN-S1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1', x: 30, y: 30 },
        ],
      }),
    );
    const eng = makeEngine('2');
    asociarBomba(
      eng as never,
      { id: 'BAN9', net: 'san', bombaEnId: null, x: 30, y: 30 },
      '2',
      row(30, 30),
      [],
    );

    const pisoBomba = trazosDe('1');
    expect(pisoBomba.ramales?.some((r) => r.id === 'LD_BAN9')).toBe(false);
    const desp = pisoBomba.bajantes?.find((b) => b.id === 'BOMAN-S1')?.desplazamientos;
    expect(Object.keys(desp || {}).length).toBe(0);
    expect(trazosDe('2').crossFloorGhosts?.some((g) => g.id === 'XFG_BOMAN-S1_1')).toBe(true);
  });

  it('quitarBomba limpia LD, anillo, fantasma y clave de aparatos', () => {
    const eng = makeEngine('2');
    asociarBomba(
      eng as never,
      { id: 'BAN9', net: 'san', bombaEnId: null, x: 30, y: 30 },
      '2',
      row(10, 10),
      [],
    );
    expect(readApos()['san_LD_BAN9_1']).toBeDefined();

    quitarBomba(
      eng as never,
      { id: 'BAN9', net: 'san', bombaEnId: '1|BOMAN-S1' } as never,
      '2',
      [],
    );

    const pisoBomba = trazosDe('1');
    expect(pisoBomba.ramales?.some((r) => r.id === 'LD_BAN9')).toBe(false);
    const desp = pisoBomba.bajantes?.find((b) => b.id === 'BOMAN-S1')?.desplazamientos;
    expect(Object.keys(desp || {}).length).toBe(0);
    expect(trazosDe('2').crossFloorGhosts?.some((g) => g.id === 'XFG_BOMAN-S1_1')).toBe(false);
    expect(readApos()['san_LD_BAN9_1']).toBeUndefined();
  });

  it('propagarHerenciaBomba mantiene el espejo del LD actualizado en vivo', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'BAN9',
      net: 'san',
      tipo: 'bajante',
      x: 30,
      y: 30,
      bombaEnId: '1|BOMAN-S1',
    } as never);
    // Nueva UD en la caja (RS1 pasa de ino:10 a ino:10 + lav:2 en su clave).
    const apos = readApos();
    apos['san_RS1_1'] = { ino: 10, lav: 2 };
    localStorage.setItem(APOS, JSON.stringify(apos));

    const disk = readApos();
    propagarHerenciaBomba(eng, '2', 'san', disk);
    expect(disk['san_LD_BAN9_1']).toEqual({ ino: 10, lav: 2 });
  });
});
