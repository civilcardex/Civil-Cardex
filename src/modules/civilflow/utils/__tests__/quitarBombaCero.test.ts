import { describe, it, expect, beforeEach } from 'vitest';
import { asociarBomba, quitarBomba } from '../bombaAssociation';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { PlanoBajante } from '../../lib/PlanoEngine/PlanoState';

// Al DESASOCIAR la bomba, el bajante debe quedar en 0 UD: libro restado de las claves,
// clave propia (espejo `san_<bajId>_<plan>` escrita por propagarHerenciaBomba) ELIMINADA
// y ucAcum en 0 (orig. usuario: tras desasociar seguía mostrando el heredado viejo).

function resetLS() {
  (globalThis as unknown as { localStorage: Storage }).localStorage = (() => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, String(v)),
      removeItem: (k: string) => m.delete(k),
      clear: () => m.clear(),
      key: (i: number) => Array.from(m.keys())[i] ?? null,
      get length() {
        return m.size;
      },
    };
  })();
  (globalThis as unknown as { window: unknown }).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function mockEng(bajantes: Partial<PlanoBajante>[]): PlanoEngine {
  const updates: Array<Record<string, unknown>> = [];
  return {
    _loadedPlanId: '1',
    bajantes,
    ramales: [],
    updateElementById: (_id: string, u: Record<string, unknown>) => {
      updates.push(u);
    },
    __updates: updates,
  } as unknown as PlanoEngine & { __updates: Array<Record<string, unknown>> };
}

// Sótano (plan 0): caja CAN0 con UD; piso 1 (plan 1): bajante BAN1 + bomba BOMAN-1.
function seed() {
  localStorage.setItem(
    'civilflow_trazos_0',
    JSON.stringify({
      ramales: [{ id: 'RS0', net: 'san', tipo: 'ramal', padre: null }],
      bajantes: [{ id: 'CAN0', net: 'san', tipo: 'caja_san', recibeDeIds: ['RS0'] }],
    }),
  );
  localStorage.setItem(
    'civilflow_trazos_1',
    JSON.stringify({
      ramales: [],
      bajantes: [
        { id: 'CAN1', net: 'san', tipo: 'caja_san' },
        { id: 'BOMAN-1', net: 'san', tipo: 'bomba', cajaOrigenId: 'CAN1' },
        { id: 'BAN1', net: 'san', tipo: 'bajante', recibeDeIds: ['RS1'] },
      ],
    }),
  );
  localStorage.setItem(
    'civilflow_aparatos_by_tramo_v2',
    JSON.stringify({ san_RS0_0: { lvm: 2 }, san_BAN1_1: { lvm: 2 } }),
  );
}

describe('quitarBomba — el bajante vuelve a 0 UD', () => {
  beforeEach(() => resetLS());

  it('asociar escribe espejo+libro; quitar borra la clave propia y deja ucAcum en 0', () => {
    seed();
    const plans = [
      { id: 0, nivel: 0, status: 'confirmed' },
      { id: 1, nivel: 1, status: 'confirmed' },
    ];
    const baj = { id: 'BAN1', net: 'san', tipo: 'bajante', recibeDeIds: ['RS1'] } as PlanoBajante;
    const eng = mockEng([baj]);

    asociarBomba(eng, baj, '1', { id: 1, nivel: 1 } as never, plans as never);
    const aposTrasAsociar = JSON.parse(
      localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '{}',
    );
    // La herencia trajo la UD de la caja del sótano (espejo propio + ramal receptor).
    expect(aposTrasAsociar.san_BAN1_1).toEqual({ lvm: 2 });

    // El campo queda puesto por updateElementById en el flujo real — simularlo antes de quitar.
    baj.bombaEnId = '0|BOMAN-1';
    quitarBomba(eng, baj, '1', plans as never);
    const apos = JSON.parse(localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '{}');
    expect(apos.san_BAN1_1).toBeUndefined(); // espejo propio eliminado → panel en 0
    expect(apos.san_RS0_0).toEqual({ lvm: 2 }); // el origen no se toca
    // El campo y el acumulador quedaron limpios vía updateElementById.
    const upd = (eng as unknown as { __updates: Array<Record<string, unknown>> }).__updates.at(-1);
    expect(upd).toMatchObject({ bombaEnId: null, ucAcum: 0 });
  });
});
