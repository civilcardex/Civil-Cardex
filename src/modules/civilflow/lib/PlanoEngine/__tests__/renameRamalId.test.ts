import { describe, it, expect, beforeEach } from 'vitest';
import { renameRamalId } from '../networkRenumber';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Convertir tributario en ramal renombra T1788... → RS8 en motor y storage (orig. usuario:
// las tablas mostraban el id viejo mientras el dibujo mostraba el label nuevo).
function setLocalStorage(key: string, val: unknown) {
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
    'civilflow_' + key,
    JSON.stringify(val),
  );
}

function resetStorage() {
  (globalThis as unknown as { localStorage: Storage }).localStorage = (() => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, String(v)),
      removeItem: (k: string) => m.delete(k),
      clear: () => m.clear(),
      key: (_i: number) => null,
      get length() {
        return m.size;
      },
    };
  })();
}

function getStore(key: string): Record<string, unknown> {
  const raw = (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(
    'civilflow_' + key,
  );
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'R',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
    ],
    totalL: 0,
    label: 'R',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    selId: 'T1788',
    _loadedPlanId: 1,
  };
  return engine as IPlanoEngineCore;
}

describe('renameRamalId', () => {
  beforeEach(() => {
    resetStorage();
    setLocalStorage('aparatos_by_tramo_v2', { san_T1788_1: { lv: 2 } });
    setLocalStorage('tramo_hidro_data_v3', {
      san_T1788_1: { accesorios: { codo90: 1 }, Lh: 3, nSalidas: 2 },
    });
  });

  it('migra motor y storage al nuevo id', () => {
    const trib = R({ id: 'T1788', tipo: 'tributario', padre: 'RS9', label: 'T1RS9' });
    const child = R({ id: 'D1', mergesFrom: ['RS9', 'T1788'], fin: 'T1788' });
    const baj = {
      id: 'B1',
      net: 'san',
      tipo: 'bajante',
      recibeDeIds: ['T1788'],
      descargaEnId: '1|RS9',
    } as unknown as PlanoBajante;
    const eng = makeEngine([trib, R({ id: 'RS9', label: 'RS9' }), child], [baj]);
    renameRamalId(eng, 'T1788', 'RS8', 'T1RS9');
    expect(trib.id).toBe('RS8');
    expect(child.mergesFrom).toEqual(['RS9', 'RS8']);
    expect(child.fin).toBe('RS8');
    expect(baj.recibeDeIds).toEqual(['RS8']);
    expect(eng.selId).toBe('RS8');
    const ap = getStore('aparatos_by_tramo_v2');
    expect(ap['san_RS8_1']).toEqual({ lv: 2 });
    expect(ap['san_T1788_1']).toBeUndefined();
    const hd = getStore('tramo_hidro_data_v3') as Record<string, { accesorios: unknown }>;
    expect(hd['san_RS8_1']).toBeDefined();
    expect(hd['san_T1788_1']).toBeUndefined();
  });

  it('migra gas_accesorios y dispara evento storage', () => {
    setLocalStorage('gas_accesorios', { T1788: { estufa: 2 } });
    const trib = R({
      id: 'T1788',
      net: 'gas',
      tipo: 'tributario',
      padre: 'RS9',
      label: 'T1RS9',
    });
    const eng = makeEngine([trib], []);
    // Sin este evento, FixturesPanel re-escribía su copia stale del mapa y resucitaba la
    // clave vieja — las UD del ramal convertido se reseteaban (orig. usuario).
    // (Entorno node sin window real: fake mínimo de EventTarget.)
    let fired = false;
    const listener = () => {
      fired = true;
    };
    const g = globalThis as unknown as { window?: unknown };
    const prevWindow = g.window;
    g.window = {
      addEventListener: (_t: string, fn: () => void) => void fn,
      removeEventListener: () => {},
      dispatchEvent: () => {
        listener();
        return true;
      },
    };
    renameRamalId(eng, 'T1788', 'RS8', 'T1RS9');
    g.window = prevWindow;
    expect(fired).toBe(true);
    const gas = getStore('gas_accesorios') as Record<string, Record<string, number>>;
    expect(gas['RS8']).toEqual({ estufa: 2 });
    expect(gas['T1788']).toBeUndefined();
  });

  it('no hace nada si el id ya es el nuevo', () => {
    const trib = R({ id: 'RS8', tipo: 'tributario', label: 'T1RS9' });
    const eng = makeEngine([trib], []);
    renameRamalId(eng, 'RS8', 'RS8');
    expect(trib.id).toBe('RS8');
    expect(getStore('aparatos_by_tramo_v2')['san_T1788_1']).toBeDefined();
  });

  it('si ambas claves existen (clave vieja resucitada) toma MAX por aparato, no suma', () => {
    setLocalStorage('aparatos_by_tramo_v2', {
      san_T1788_1: { lv: 2, ino: 1 },
      san_RS8_1: { lv: 2, duch: 3 },
    });
    const trib = R({ id: 'T1788', tipo: 'tributario', padre: 'RS9', label: 'T1RS9' });
    const eng = makeEngine([trib], []);
    renameRamalId(eng, 'T1788', 'RS8', 'T1RS9');
    const ap = getStore('aparatos_by_tramo_v2') as Record<string, Record<string, number>>;
    // Sumar daba { lv: 4, ... } — dos copias del conteo del MISMO ramal se duplicaban.
    expect(ap['san_RS8_1']).toEqual({ lv: 2, ino: 1, duch: 3 });
    expect(ap['san_T1788_1']).toBeUndefined();
  });
});
