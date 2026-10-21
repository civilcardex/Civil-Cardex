import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pines del movimiento 3 (rediseño FixturesPanel): mutarInc/mutarDec con MOTOR (spies que
// registran el ORDEN updateElementById → render → _markDirty → evento) y stores REALES.

const mockStorage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: (i: number) => Object.keys(mockStorage)[i] ?? null,
});
const eventos: string[] = [];
vi.stubGlobal('window', {
  dispatchEvent: (e: Event) => {
    eventos.push(e.type);
  },
  setTimeout: (fn: () => void) => {
    fn();
    return 0;
  },
  clearTimeout: () => {},
});

import {
  mutarInc,
  mutarDec,
  type FixtureMutationCtx,
} from '../../components/aparatos/useAparatoMutaciones.ts';
import { loadAll, saveAll } from '../../components/aparatosAlmacenamiento.ts';

const PLAN = 5;
const KEY = `san_RAF1_${PLAN}`;

type Ramal = {
  id: string;
  label?: string;
  net: string;
  tipo: string;
  pts: number[][];
  diametro?: string;
  aparatoInicio?: string | null;
  aparatoFin?: string | null;
  accesorioInicio?: string;
  accesorioFin?: string;
  diametroInicio?: string;
  diametroFin?: string;
  fixtures?: Record<string, number>;
  [k: string]: unknown;
};

/** Motor con spies: cada acción empuja a `orden` para verificar la secuencia del snapshot. */
function makeEngine(ramales: Ramal[]) {
  const orden: string[] = [];
  const alertas: string[] = [];
  const engine = {
    ramales,
    bajantes: [] as Array<Record<string, unknown>>,
    _loadedPlanId: PLAN,
    pauseHistory: () => orden.push('pause'),
    resumeHistory: () => orden.push('resume'),
    render: () => orden.push('render'),
    _markDirty: () => orden.push('dirty'),
    triggerAlert: (t: string) => alertas.push(t),
    updateElementById: (id: string, fields: Record<string, unknown>) => {
      orden.push(`update:${id}`);
      const r = ramales.find((x) => x.id === id);
      if (r) Object.assign(r, fields);
    },
  };
  return { engine: engine as unknown as Record<string, unknown> & Ramal, orden, alertas };
}

function ctxDe(engine: unknown, overrides: Partial<FixtureMutationCtx> = {}): FixtureMutationCtx {
  return {
    netId: 'san',
    storageKey: KEY,
    target: { id: 'RAF1', tipo: 'ramal' } as FixtureMutationCtx['target'],
    mergeKeys: null,
    esEspejoBajante: false,
    esPropagado: false,
    rejillasArea: false,
    ownTotal: 0,
    counts: {},
    setCounts: () => {},
    engineRef: { current: engine } as FixtureMutationCtx['engineRef'],
    selElement: null,
    setSelElement: undefined,
    esPropio: (apId) => (loadAll()[KEY]?.[apId] || 0) > 0,
    ...overrides,
  };
}

function seedClave(apId: string, n: number): void {
  const disk = loadAll();
  saveAll({ ...disk, [KEY]: { ...(disk[KEY] || {}), [apId]: n } });
}

describe('mutarInc / mutarDec (pines movimiento 3, motor real)', () => {
  it('inc san: glifo en el extremo libre + clave en disco + ORDEN update→render→dirty→evento', () => {
    // Flujo hacia head: el aparato va en aparatoFin.
    const raf1: Ramal = {
      id: 'RAF1',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [40, 0],
      ],
      diametro: '4"',
    };
    const { engine, orden } = makeEngine([raf1]);
    mutarInc(ctxDe(engine), 'inodoro');
    // En SAN el panel escribe diámetro central (inodoro→4") + accesorio de extremo (codo
    // sube) — el campo aparatoFin es de af/ac/gas.
    expect(raf1.diametro).toBe('4"');
    expect(raf1.accesorioInicio === 'codo90rmSube' || raf1.accesorioFin === 'codo90rmSube').toBe(
      true,
    );
    expect(loadAll()[KEY]?.['inodoro']).toBe(1);
    // ORDEN del snapshot: pausa → updates → render → resume → dirty → evento.
    expect(orden.indexOf('update:RAF1')).toBeGreaterThan(orden.indexOf('pause'));
    expect(orden.indexOf('render')).toBeGreaterThan(orden.indexOf('update:RAF1'));
    expect(orden.indexOf('resume')).toBeGreaterThan(orden.indexOf('render'));
    expect(orden.indexOf('dirty')).toBeGreaterThan(orden.indexOf('resume'));
    expect(eventos[eventos.length - 1]).toBe('aparatos-clear');
  });

  it('inc con esEspejoBajante: guard total (ni glifo ni disco)', () => {
    const raf1: Ramal = {
      id: 'RAF1',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [40, 0],
      ],
      diametro: '4"',
    };
    const { engine } = makeEngine([raf1]);
    mutarInc(ctxDe(engine, { esEspejoBajante: true }), 'inodoro');
    expect(raf1.aparatoFin).toBeUndefined();
    expect(loadAll()[KEY]).toBeUndefined();
  });

  it('inc con mergeKeys en gas: alerta "Unión de ramales" y sin cambios', () => {
    const raf1: Ramal = {
      id: 'RAF1',
      net: 'gas',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [40, 0],
      ],
    };
    const { engine, alertas } = makeEngine([raf1]);
    mutarInc(
      ctxDe(engine, {
        netId: 'gas',
        mergeKeys: ['RG1|RG2'],
        target: { id: 'RAF1' } as FixtureMutationCtx['target'],
      }),
      'estufa',
    );
    expect(alertas.some((a) => a === 'Unión de ramales')).toBe(true);
    expect(loadAll()[KEY]).toBeUndefined();
  });

  it('dec de unidad HEREDADA (esPropagado, no propio): alerta y disco intacto', () => {
    // Heredada = visible en el ESTADO del panel pero sin carga propia en disco.
    const raf1: Ramal = {
      id: 'RAF1',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [40, 0],
      ],
      aparatoFin: 'inodoro',
    };
    const { engine, alertas } = makeEngine([raf1]);
    mutarDec(ctxDe(engine, { esPropagado: true, counts: { [KEY]: { inodoro: 1 } } }), 'inodoro');
    expect(alertas.some((a) => a === 'Unidades propagadas')).toBe(true);
    expect(raf1.aparatoFin).toBe('inodoro');
  });

  it('dec PROPIO a cero: limpia aparatoFin + fixtures=undefined + borra la clave', () => {
    seedClave('inodoro', 1); // disco: carga propia (esPropio lee el disco)
    const raf1: Ramal = {
      id: 'RAF1',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [40, 0],
      ],
      aparatoFin: 'inodoro',
      fixtures: { inodoro: 1 },
    };
    const { engine } = makeEngine([raf1]);
    mutarDec(ctxDe(engine, { counts: { [KEY]: { inodoro: 1 } } }), 'inodoro');
    expect(raf1.aparatoFin).toBeNull();
    expect(raf1.fixtures).toBeUndefined();
    expect(loadAll()[KEY]).toBeUndefined();
  });

  it('límite 1 aparato por ramal (ownTotal>=1): alerta y sin segundo conteo', () => {
    seedClave('inodoro', 1);
    const raf1: Ramal = {
      id: 'RAF1',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [40, 0],
      ],
      diametro: '4"',
      aparatoFin: 'inodoro',
    };
    const { engine, alertas } = makeEngine([raf1]);
    mutarInc(ctxDe(engine, { ownTotal: 1 }), 'lavamanos');
    expect(alertas.some((a) => a === 'Máximo 1 aparato por ramal-tributario')).toBe(true);
    expect(loadAll()[KEY]?.['lavamanos']).toBeUndefined();
  });
});
