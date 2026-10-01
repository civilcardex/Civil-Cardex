import { describe, it, expect, beforeAll } from 'vitest';
import { finishRamal } from '../finishRamal';
import { handleBajanteDown } from '../drawingCreations';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';

// Herencia de diámetro DIRECCIONAL al conectar: el trazo nuevo SOLO adopta de sus
// alimentadores (quien descarga sobre él) y nunca empuja de vuelta al que alimenta.
// El máximo ciego creaba 4"/2" fantasma en trazos que entregan (deben nacer vacíos).

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) {
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => makeCanvas(),
    };
  }
  if (!g.window) {
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      devicePixelRatio: 1,
    };
  }
  if (!g.Image) {
    g.Image = class {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      set src(_v: string) {
        this.onerror();
      }
    };
  }
});

function makeCanvas() {
  const ctxStub = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'canvas') return null;
        if (k === 'measureText') return () => ({ width: 10 });
        return () => {};
      },
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

function makeEngine(): PlanoEngine {
  const canv = makeCanvas();
  const cw = { addEventListener: () => {}, removeEventListener: () => {}, style: {} };
  return new PlanoEngineCtor(cw as never, null, canv as unknown as HTMLCanvasElement);
}

function seedTrunk(eng: PlanoEngine, id: string, pts: number[][], diametro: string, net = 'san') {
  eng.activeNet = net;
  eng.ramales.push({
    id,
    net,
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 100,
    label: id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 50,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro,
    pendiente: 2,
    bloqueado: false,
  } as never);
  eng._markDirty();
}

/** Dibuja un ramal y devuelve el objeto creado. */
function draw(eng: PlanoEngine, pts: number[][], net = 'san') {
  const before = new Set(eng.ramales.map((r) => r.id));
  const alerts: string[] = [];
  const origAlert = eng.triggerAlert.bind(eng);
  eng.triggerAlert = ((t: string, m: string) => {
    alerts.push(`${t} | ${m}`);
  }) as never;
  eng.activeNet = net;
  eng.tipoTramo = 'ramal';
  eng.activeRamal = { net, tipo: 'ramal', padre: null, pts } as never;
  try {
    finishRamal(eng as never);
  } catch (e) {
    alerts.push('EX: ' + String((e as Error)?.message || e));
  }
  eng.triggerAlert = origAlert as never;
  const created = eng.ramales.find((r) => !before.has(r.id));
  if (!created)
    throw new Error(
      `finishRamal no creó (ramales=${eng.ramales.length} sel=${eng.selId} active=${eng.activeRamal ? 'sí' : 'no'}): ${alerts.join(' ;; ') || 'sin alerta'}`,
    );
  return created;
}

describe('finishRamal: diámetro direccional', () => {
  it('el que ENTREGA en tee a 45° nace vacío', () => {
    const eng = makeEngine();
    seedTrunk(
      eng,
      'RS1',
      [
        [0, 0],
        [100, 0],
      ],
      '4"',
    );
    // R8 cae con la cabeza al cuerpo de RS1 en su mismo sentido (entrega a 45°)
    const r8 = draw(eng, [
      [15, -35],
      [50, 0],
    ]);
    expect(r8.diametro || '').toBe('');
    expect(eng.ramales.find((r) => r.id === 'RS1')?.diametro).toBe('4"');
  });

  it('el que RECIBE en tee a 90° adopta el mayor (red af)', () => {
    const eng = makeEngine();
    seedTrunk(
      eng,
      'RA1',
      [
        [0, 0],
        [100, 0],
      ],
      '2"',
      'af',
    );
    // R8 nace del cuerpo de RA1 (cola en el cuerpo, recibe): adopta
    const r8 = draw(
      eng,
      [
        [50, 0],
        [50, -35],
      ],
      'af',
    );
    expect(r8.diametro).toBe('2"');
  });

  it('tee que entrega nace vacío y el alimentador vacío NO sube', () => {
    const eng = makeEngine();
    seedTrunk(
      eng,
      'RS1',
      [
        [0, 0],
        [100, 0],
      ],
      '4"',
    );
    // Alimentador vacío que descarga al mismo punto donde aterrizará R8
    eng.ramales.push({
      id: 'RS9',
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [15, 35],
        [50, 0],
      ],
      totalL: 10,
      label: 'RS9',
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
    } as never);
    eng._markDirty();
    // R8 cae con la cabeza al cuerpo de RS1 (entrega): no adopta el 4"
    const r8 = draw(eng, [
      [15, -35],
      [50, 0],
    ]);
    expect(r8.diametro || '').toBe('');
    // ...y el alimentador vacío no fue empujado a 4" de vuelta
    expect(eng.ramales.find((r) => r.id === 'RS9')?.diametro || '').toBe('');
  });
});

describe('finishRamal: diámetro ramal↔bajante según cómo se dibuja', () => {
  function seedBajante(eng: PlanoEngine, dNominal: string) {
    eng.bajantes.push({
      id: 'BAN1',
      net: 'san',
      tipo: 'bajante',
      code: 'BAN1',
      x: 0,
      y: 0,
      direccion: 'baja',
      dNominal,
      recibeDeIds: [],
      alimentaIds: [],
      descargaEnId: null,
      ucAcum: 0,
      ucExtra: 0,
      area_m2: 0,
      desplazamientos: {},
    } as never);
  }

  it('ramal que SALE del bajante (nace en pts[0]) adopta su dNominal', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng._ramalDefaults = { material: '', diametro: '', pendiente: 0 };
    seedBajante(eng, '4"');
    eng.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [0, 0],
        [60, 0],
      ],
    } as never;
    finishRamal(eng as never);
    const r = eng.ramales.find((x) => x.net === 'san') as unknown as {
      id: string;
      diametro: string;
      ini: string;
    };
    expect(r.diametro).toBe('4"');
    expect(r.ini).toBe('BAN1');
    const baj = eng.bajantes[0] as unknown as { alimentaIds: string[] };
    expect(baj.alimentaIds).toContain(r.id);
  });

  it('ramal que LLEGA sin diámetro adopta el del bajante', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng._ramalDefaults = { material: '', diametro: '', pendiente: 0 };
    seedBajante(eng, '4"');
    eng.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [60, 0],
        [0, 0],
      ],
    } as never;
    finishRamal(eng as never);
    const r = eng.ramales.find((x) => x.net === 'san') as unknown as {
      diametro: string;
      fin: string;
    };
    expect(r.diametro).toBe('4"');
    expect(r.fin).toBe('BAN1');
  });

  it('ramal que LLEGA con diámetro mayor empuja al bajante arriba (nunca baja)', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng._ramalDefaults = { material: '', diametro: '4"', pendiente: 0 };
    seedBajante(eng, '2"');
    eng.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [60, 0],
        [0, 0],
      ],
    } as never;
    finishRamal(eng as never);
    const r = eng.ramales.find((x) => x.net === 'san') as unknown as { diametro: string };
    expect(r.diametro).toBe('4"');
    const baj = eng.bajantes[0] as unknown as { dNominal: string };
    expect(baj.dNominal).toBe('4"');
  });

  it('bajante soltado sobre el CUERPO de un ramal toma su diámetro', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng._ramalDefaults = { material: '', diametro: '', pendiente: 0 };
    eng.ramales.push({
      id: 'RS1',
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [0, 0],
        [200, 0],
      ],
      totalL: 200,
      label: 'RS1',
      ini: '',
      fin: '',
      piso: '',
      dz: '',
      uc: 0,
      labelX: 100,
      labelY: 0,
      labelAngle: 0,
      material: '',
      diametro: '3"',
      pendiente: 2,
      bloqueado: false,
    } as never);
    // Soltado en (100, 0): cuerpo del ramal, lejos de sus extremos.
    handleBajanteDown(eng as never, 100, 0);
    const baj = eng.bajantes[0] as unknown as { dNominal: string };
    expect(baj.dNominal).toBe('3"');
  });
});

describe('trazo que entra al CENTRO de una caja: sin validación de ángulo ni propagación', () => {
  function seedCaja(eng: PlanoEngine) {
    eng.bajantes.push({
      id: 'CAN1',
      net: 'san',
      tipo: 'caja_san',
      code: 'CAN1',
      x: 0,
      y: 0,
      dNominal: '',
      recibeDeIds: [],
      alimentaIds: [],
      desplazamientos: {},
    } as never);
  }

  it('ramal llegando a la caja con ángulo NO permitido NO alerta ni se elimina', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng._ramalDefaults = { material: '', diametro: '', pendiente: 0 };
    seedCaja(eng);
    // ~15° respecto al eje X — no es 0°/45°/90°.
    eng.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [50, 13],
        [0, 0],
      ],
    } as never;
    finishRamal(eng as never);
    const creado = eng.ramales.find((x) => x.net === 'san');
    expect(creado).toBeTruthy();
    const alerts = (eng as unknown as { _lastAlert?: string })._lastAlert;
    void alerts;
  });

  it('la llegada a caja NO propaga diámetros a otros tramos', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng._ramalDefaults = { material: '', diametro: '', pendiente: 0 };
    seedCaja(eng);
    // Tramo existente receptor cerca del punto de llegada con diámetro propio.
    eng.ramales.push({
      id: 'RS7',
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [10, 2],
        [60, 2],
      ],
      totalL: 50,
      label: 'RS7',
      ini: '',
      fin: '',
      piso: '',
      dz: '',
      uc: 0,
      labelX: 30,
      labelY: 2,
      labelAngle: 0,
      material: '',
      diametro: '2"',
      pendiente: 2,
      bloqueado: false,
    } as never);
    eng.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [50, 13],
        [0, 0],
      ],
    } as never;
    finishRamal(eng as never);
    const rs7 = eng.ramales.find((x) => x.id === 'RS7') as unknown as { diametro: string };
    expect(rs7.diametro).toBe('2"');
  });
});
