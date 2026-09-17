import { describe, it, expect, beforeAll } from 'vitest';
import { finishRamal } from '../finishRamal';
import { handleBajanteDown } from '../drawingCreations';
import { deleteSelected } from '../deleteSelected';
import { moverAsociacionCanal, ramalesDelCanal } from '../canalAssociation';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';

// Ramal de canal (orig. usuario): la asociación canal↔bajante vive SOLO en ramales que el
// usuario dibuja desde dentro del canal hacia un bajante. Nada automático por cercanía.

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

/** Canal ll de 200cm x 50cm en (0,0): rect de plano ≈151 x 37.8 px (scaleM 0.5). */
function seedCanal(eng: PlanoEngine) {
  eng.bajantes.push({
    id: 'CNL1-P1',
    code: 'CNL1-P1',
    net: 'll',
    tipo: 'canal',
    x: 0,
    y: 0,
    longitud: 200,
    base: 50,
    altura: 20,
  } as never);
}

function draw(eng: PlanoEngine, pts: number[][]) {
  const before = new Set(eng.ramales.map((r) => r.id));
  const alerts: string[] = [];
  const origAlert = eng.triggerAlert.bind(eng);
  eng.triggerAlert = ((t: string, m: string) => {
    alerts.push(`${t} | ${m}`);
  }) as never;
  eng.activeNet = 'll';
  eng.tipoTramo = 'ramal';
  eng.activeRamal = { net: 'll', tipo: 'ramal', padre: null, pts } as never;
  try {
    finishRamal(eng as never);
  } catch (e) {
    alerts.push('EX: ' + String((e as Error)?.message || e));
  }
  eng.triggerAlert = origAlert as never;
  const created = eng.ramales.find((r) => !before.has(r.id));
  if (!created) throw new Error(`finishRamal no creó: ${alerts.join(' ;; ') || 'sin alerta'}`);
  return created;
}

const IN_PT = [75, 19]; // dentro del rect del canal
const OUT_PT = [75, 300]; // lejos, debajo del canal

describe('ramal de canal', () => {
  it('dibujado canal→fuera: marca esCanalId, codo 90° baja, S=2%, D=2"', () => {
    const eng = makeEngine();
    seedCanal(eng);
    const r = draw(eng, [IN_PT, OUT_PT]);
    expect(r.esCanalId).toBe('CNL1-P1');
    expect(r.accesorioInicio).toBe('codo90rmBaja');
    expect(r.pendiente).toBe(2);
    expect(r.diametro).toBe('2"');
    // Sin voltear: el inicio sigue siendo el extremo del canal
    expect(r.pts[0]).toEqual(IN_PT);
  });

  it('ramal de canal con ángulo libre (no 45°) → se crea SIN alerta de ángulo', () => {
    const eng = makeEngine();
    seedCanal(eng);
    const alerts: string[] = [];
    const origAlert = eng.triggerAlert.bind(eng);
    eng.triggerAlert = ((t: string) => {
      alerts.push(t);
    }) as never;
    // Segmento recto a ~31° — ilegal en ll si no fuera ramal de canal
    const r = draw(eng, [
      [75, 19],
      [160, 70],
    ]);
    eng.triggerAlert = origAlert as never;
    expect(r.esCanalId).toBe('CNL1-P1');
    expect(alerts.filter((a) => a.includes('Ángulo'))).toHaveLength(0);
  });

  it('dibujado fuera→canal: se INVIERTE para que el flujo nazca en el canal', () => {
    const eng = makeEngine();
    seedCanal(eng);
    const r = draw(eng, [OUT_PT, IN_PT]);
    expect(r.esCanalId).toBe('CNL1-P1');
    expect(r.pts[0]).toEqual(IN_PT);
    expect(r.pts[r.pts.length - 1]).toEqual(OUT_PT);
  });

  it('trazo con AMBOS extremos dentro del canal → sin marca', () => {
    const eng = makeEngine();
    seedCanal(eng);
    const r = draw(eng, [
      [20, 10],
      [120, 20],
    ]);
    expect(r.esCanalId).toBeUndefined();
    expect(r.accesorioInicio).toBeUndefined();
  });

  it('SIN auto-asociación: soltar un bajante ll dentro del canal NO lo asocia', () => {
    const eng = makeEngine();
    seedCanal(eng);
    eng.activeNet = 'll';
    handleBajanteDown(eng as never, 75, 19);
    const baj = eng.bajantes.find((b) => b.tipo === 'bajante');
    expect(baj).toBeTruthy();
    expect(baj?.canalId ?? null).toBeNull();
  });

  it('asociación explícita: moverAsociacionCanal escribe recibeDeIds (diámetro del ramal intacto)', () => {
    const eng = makeEngine();
    seedCanal(eng);
    const r = draw(eng, [IN_PT, OUT_PT]);
    eng.bajantes.push({
      id: 'BAN1-P1',
      code: 'BAN1-P1',
      net: 'll',
      tipo: 'bajante',
      x: 200,
      y: 420,
      dNominal: '4"',
      recibeDeIds: [],
    } as never);
    moverAsociacionCanal(eng as never, r.id, 'BAN1-P1');
    const baj = eng.bajantes.find((b) => b.id === 'BAN1-P1');
    expect(baj?.recibeDeIds).toContain(r.id);
    // _markDirty puede reemplazar la entrada en engine.ramales — leer referencia fresca.
    const rFresco = eng.ramales.find((x) => x.id === r.id);
    // El diámetro del ramal NO se espeja con el bajante (default 2" editable, orig. usuario)
    expect(rFresco?.diametro).toBe('2"');
    // Desasociar: la membresía (fuente de verdad de la asociación) se va
    moverAsociacionCanal(eng as never, r.id, null);
    expect(baj?.recibeDeIds).not.toContain(r.id);
  });

  it('bajante ya lleno (2 asociaciones): el ramal de canal conecta igual, sin "Bajante completo"', () => {
    const eng = makeEngine();
    seedCanal(eng);
    const seedRamal = (id: string) =>
      eng.ramales.push({
        id,
        net: 'll',
        tipo: 'ramal',
        padre: null,
        pts: [
          [75, 300],
          [100, 320],
        ],
        totalL: 10,
        label: id,
        ini: '',
        fin: 'BAN1-P1',
        piso: '',
        dz: '',
        uc: 0,
        labelX: 90,
        labelY: 310,
        labelAngle: 0,
        material: '',
        diametro: '2"',
        pendiente: 2,
        bloqueado: false,
      } as never);
    seedRamal('RX1');
    seedRamal('RX2');
    eng.bajantes.push({
      id: 'BAN1-P1',
      code: 'BAN1-P1',
      net: 'll',
      tipo: 'bajante',
      x: 75,
      y: 300,
      dNominal: '4"',
      recibeDeIds: ['RX1', 'RX2'],
      alimentaIds: [],
    } as never);
    const before = new Set(eng.ramales.map((r) => r.id));
    const alerts: string[] = [];
    const origAlert = eng.triggerAlert.bind(eng);
    eng.triggerAlert = ((t: string, m: string) => {
      alerts.push(`${t} | ${m}`);
    }) as never;
    eng.activeNet = 'll';
    eng.tipoTramo = 'ramal';
    eng.activeRamal = {
      net: 'll',
      tipo: 'ramal',
      padre: null,
      pts: [IN_PT, [75, 300]],
    } as never;
    try {
      finishRamal(eng as never);
    } catch (e) {
      alerts.push('EX: ' + String((e as Error)?.message || e));
    }
    eng.triggerAlert = origAlert as never;
    const r = eng.ramales.find((x) => !before.has(x.id));
    expect(r).toBeTruthy();
    expect(alerts.join(';;')).not.toContain('Bajante completo');
    const baj = eng.bajantes.find((b) => b.id === 'BAN1-P1');
    expect(baj?.recibeDeIds).toContain(r!.id);
  });

  it('borrar el canal arranca sus ramales de canal', () => {
    const eng = makeEngine();
    seedCanal(eng);
    const r = draw(eng, [IN_PT, OUT_PT]);
    expect(ramalesDelCanal(eng as never, 'CNL1-P1')).toHaveLength(1);
    deleteSelected(eng as never, ['CNL1-P1']);
    expect(eng.bajantes.some((b) => b.id === 'CNL1-P1')).toBe(false);
    expect(eng.ramales.some((x) => x.id === r.id)).toBe(false);
  });

  it('un ramal NORMAL de ll (sin canal en ningún extremo) no se marca', () => {
    const eng = makeEngine();
    seedCanal(eng);
    const r = draw(eng, [
      [400, 300],
      [500, 300],
    ]);
    expect(r.esCanalId).toBeUndefined();
  });
});
