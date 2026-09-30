import { describe, it, expect, beforeAll } from 'vitest';
import {
  geometriaCanalDesdePuntos,
  geometriaCanalAncho,
  normalizarCanal,
  sanearCanalLegacy,
  sanearEsCanalIdFaltante,
  canalOBBDe,
  puntoEnCanalOBB,
  distPuntoACanalOBB,
  esquinasCanalOBB,
} from '../canalAssociation';
import { deleteSelected } from '../deleteSelected';
import { updateSelected } from '../PlanoEngineSelection';
import { _trySelRamalDrag } from '../mouseDownDrags';
import { handleCanalDown, commitCanalAncho } from '../drawingCreations';
import { handleKeyDown } from '../handleKeyDown';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';

// 8 ítems canal/lluvias: diagonal + base-corta + renumber + etiqueta persistente.

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
  if (!g.requestAnimationFrame) {
    g.requestAnimationFrame = () => 0;
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
  const eng = new PlanoEngineCtor(cw as never, null, canv as unknown as HTMLCanvasElement);
  eng.activeNetworks = new Set(['ll', 'recolectora']);
  eng.nivelActual = { label: 'P1', n: 1, npt: 0 } as never;
  return eng;
}

// pxToM stub: 1 unidad de plano = 1 cm (geometría pura, sin escala).
const pxToM = (d: number) => d / 100;

function cornersKey(obb: { x: number; y: number; w: number; h: number; angRad: number }): string {
  return esquinasCanalOBB(obb)
    .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
    .sort()
    .join('|');
}

describe('geometriaCanalDesdePuntos (ítem 4: diagonal con 2 clics)', () => {
  it('arrastre sobre el eje = esquinas opuestas clásicas, angulo 0', () => {
    const g = geometriaCanalDesdePuntos({ x: 0, y: 0 }, { x: 300, y: 40 }, pxToM)!;
    expect(g.angulo).toBe(0);
    expect(g.longitudCm).toBeCloseTo(300, 1);
    expect(g.baseCm).toBeCloseTo(40, 1);
    expect(g.flujo).toBe('derecha');
  });

  it('arrastre vertical = rect clásico con flujo abajo', () => {
    const g = geometriaCanalDesdePuntos({ x: 0, y: 0 }, { x: 30, y: 300 }, pxToM)!;
    expect(g.angulo).toBe(0);
    expect(g.flujo).toBe('abajo');
  });

  it('diagonal 45° = modo eje: angulo≈45, longitud=hipotenusa, base=lado corto', () => {
    const g = geometriaCanalDesdePuntos({ x: 0, y: 0 }, { x: 300, y: 300 }, pxToM)!;
    expect(g.angulo).toBeCloseTo(45, 0);
    expect(g.longitudCm).toBeCloseTo(Math.hypot(300, 300), 0);
    expect(g.baseCm).toBeCloseTo(300, 0);
    expect(g.x).toBe(0);
    expect(g.y).toBe(0);
  });

  it('doble-clic en el mismo sitio = null (degenerado)', () => {
    expect(geometriaCanalDesdePuntos({ x: 5, y: 5 }, { x: 5, y: 5 }, pxToM)).toBeNull();
  });
});

describe('normalizarCanal (ítem 5: base = lado corto)', () => {
  it('h>w rota -90° sin mover el rectángulo mundo', () => {
    const c: { x: number; y: number; longitud: number; base: number; angulo?: number } = {
      x: 10,
      y: 20,
      longitud: 40,
      base: 300,
      angulo: 0,
    };
    const antes = cornersKey(canalOBBDe(1, c));
    expect(normalizarCanal(1, c)).toBe(true);
    expect(c.longitud).toBe(300);
    expect(c.base).toBe(40);
    expect(c.angulo).toBe(-90);
    expect(cornersKey(canalOBBDe(1, c))).toBe(antes);
  });

  it('ya normal = no toca', () => {
    const c = { x: 10, y: 20, longitud: 300, base: 40, angulo: 0 };
    expect(normalizarCanal(1, c)).toBe(false);
    expect(c.angulo).toBe(0);
  });
});

describe('sanearCanalLegacy + canalMarco (mismo mundo que el AABB clásico)', () => {
  type CCanal = {
    x: number;
    y: number;
    longitud: number;
    base: number;
    angulo?: number;
    _canalFlowDir?: 'izquierda';
  };
  it('vertical legacy (base>longitud) → base-corta + 90°, mundo idéntico', () => {
    const legacy: CCanal = { x: 0, y: 0, longitud: 50, base: 200 };
    const antes = cornersKey(canalOBBDe(1, legacy));
    const c = { ...legacy };
    expect(sanearCanalLegacy(1, c)).toBe(true);
    expect(c.angulo).toBe(90);
    expect(c.longitud).toBe(200);
    expect(c.base).toBe(50);
    expect(cornersKey(canalOBBDe(1, c))).toBe(antes);
  });

  it('izquierda legacy inconsistente (base>longitud) → 90°, mundo idéntico al AABB', () => {
    // Ronda 9 C-6: la rama 'izquierda' no swapeaba dims en el caso h>w — re-anclaje con
    // marco 180° sacaba el rectángulo mundo de su sitio (fantasma oblicuo al cargar).
    const legacy: CCanal = {
      x: 40,
      y: 30,
      longitud: 50,
      base: 200,
      _canalFlowDir: 'izquierda',
    };
    const antes = cornersKey(canalOBBDe(1, legacy));
    const c = { ...legacy };
    expect(sanearCanalLegacy(1, c)).toBe(true);
    expect(c.angulo).toBe(90);
    expect(c.longitud).toBe(200);
    expect(c.base).toBe(50);
    expect(cornersKey(canalOBBDe(1, c))).toBe(antes);
  });

  it('horizontal legacy → angulo 0 sin mover nada', () => {
    const c: CCanal = { x: 5, y: 7, longitud: 200, base: 50 };
    sanearCanalLegacy(1, c);
    expect(c.angulo).toBe(0);
    expect(c.x).toBe(5);
    expect(c.longitud).toBe(200);
  });

  it('izquierda legacy → 180° con el mismo AABB', () => {
    const legacy: CCanal = { x: 0, y: 0, longitud: 200, base: 50, _canalFlowDir: 'izquierda' };
    const antes = cornersKey(canalOBBDe(1, legacy));
    const c = { ...legacy };
    sanearCanalLegacy(1, c);
    expect(c.angulo).toBe(180);
    expect(cornersKey(canalOBBDe(1, c))).toBe(antes);
  });

  it('idempotente: segunda pasada no toca', () => {
    const c: CCanal = { x: 50, y: 0, longitud: 200, base: 50, angulo: 90 };
    expect(sanearCanalLegacy(1, c)).toBe(false);
  });
});

describe('OBB diagonal: punto dentro/fuera y distancia', () => {
  // Canal diagonal 45°: origen (0,0), 200 x 40.
  const obb = canalOBBDe(1, { x: 0, y: 0, longitud: 200, base: 40, angulo: 45 });
  it('centro del eje dentro, esquinas AABB fuera', () => {
    const c = Math.SQRT1_2;
    expect(puntoEnCanalOBB(obb, 100 * c, 100 * c)).toBe(true);
    // Esquina del AABB (200,0): fuera del rombo.
    expect(puntoEnCanalOBB(obb, 200, 0)).toBe(false);
  });
  it('distancia 0 dentro, >0 fuera', () => {
    const c = Math.SQRT1_2;
    expect(distPuntoACanalOBB(obb, 100 * c, 100 * c)).toBe(0);
    expect(distPuntoACanalOBB(obb, 200, 0)).toBeGreaterThan(0);
  });
});

describe('sanearEsCanalIdFaltante (ítem 2: marca sobrevive sin migración)', () => {
  const canales = [{ id: 'CNL1-P1', x: 0, y: 0, longitud: 300, base: 40, angulo: 0 }];
  type CRamal = { id: string; net: string; tipo: string; pts: number[][]; esCanalId?: string };
  it('un extremo en la BOCA (borde corto) → marca', () => {
    // Ronda 9 C-2: la inferencia se restringe a la boca — un extremo en mitad del cuerpo
    // ya no marca (colector que pasa bajo el glifo quedaba fuera de las tablas).
    const ramales: CRamal[] = [
      {
        id: 'RS9',
        net: 'll',
        tipo: 'ramal',
        pts: [
          [0, 10],
          [10, 500],
        ],
      },
    ];
    expect(sanearEsCanalIdFaltante(1, ramales, canales)).toBe(1);
    expect(ramales[0].esCanalId).toBe('CNL1-P1');
  });
  it('extremo dentro del cuerpo (no boca) → sin marca (C-2)', () => {
    const ramales: CRamal[] = [
      {
        id: 'RS9',
        net: 'll',
        tipo: 'ramal',
        pts: [
          [100, 10],
          [100, 500],
        ],
      },
    ];
    expect(sanearEsCanalIdFaltante(1, ramales, canales)).toBe(0);
    expect(ramales[0].esCanalId).toBeUndefined();
  });
  it('dos extremos dentro → sin marca (ambiguo)', () => {
    const ramales: CRamal[] = [
      {
        id: 'RS9',
        net: 'll',
        tipo: 'ramal',
        pts: [
          [10, 10],
          [20, 20],
        ],
      },
    ];
    expect(sanearEsCanalIdFaltante(1, ramales, canales)).toBe(0);
    expect(ramales[0].esCanalId).toBeUndefined();
  });
  it('marca existente no se pisa', () => {
    const ramales: CRamal[] = [
      {
        id: 'RS9',
        net: 'll',
        tipo: 'ramal',
        pts: [
          [999, 999],
          [999, 999],
        ],
        esCanalId: 'CNL2',
      },
    ];
    expect(sanearEsCanalIdFaltante(1, ramales, canales)).toBe(0);
    expect(ramales[0].esCanalId).toBe('CNL2');
  });
});

describe('fase de ancho diagonal — 3er clic (ancho libre)', () => {
  const eje = { x1: 0, y1: 0, x2: 300, y2: 0 };
  it('ancho = distancia perpendicular del clic al eje, del lado del clic', () => {
    const g = geometriaCanalAncho(eje, { x: 150, y: 50 }, pxToM, 1)!;
    expect(g.baseCm).toBeCloseTo(50, 0);
    expect(g.longitudCm).toBeCloseTo(300, 0);
    expect(g.angulo).toBe(0);
    // Lado +Y: origen intacto, clic sobre el borde lejano.
    expect(g.x).toBe(0);
    expect(g.y).toBe(0);
    const obb = canalOBBDe(1, { x: g.x, y: g.y, longitud: g.longitudCm, base: g.baseCm });
    expect(puntoEnCanalOBB(obb, 150, 50)).toBe(true);
  });
  it('lado −Y: origen desplazado, mismo ángulo, clic sobre el borde', () => {
    const g = geometriaCanalAncho(eje, { x: 150, y: -50 }, pxToM, 1)!;
    expect(g.baseCm).toBeCloseTo(50, 0);
    expect(g.angulo).toBe(0);
    expect(g.y).toBeCloseTo(-50, 6);
    const obb = canalOBBDe(1, { x: g.x, y: g.y, longitud: g.longitudCm, base: g.baseCm });
    expect(puntoEnCanalOBB(obb, 150, -50)).toBe(true);
  });
  it('clic sobre el eje = ancho mínimo 1cm (no degenera)', () => {
    const g = geometriaCanalAncho(eje, { x: 150, y: 0 }, pxToM, 1)!;
    expect(g.baseCm).toBe(1);
    expect(g.longitudCm).toBeCloseTo(300, 0);
  });
  it('eje degenerado = null', () => {
    const g = geometriaCanalAncho({ x1: 5, y1: 5, x2: 5, y2: 5 }, { x: 9, y: 9 }, pxToM, 1);
    expect(g).toBeNull();
  });
  it('eje diagonal conserva el ángulo y el largo', () => {
    const g = geometriaCanalAncho(
      { x1: 0, y1: 0, x2: 300, y2: 300 },
      { x: 150, y: 250 },
      pxToM,
      1,
    )!;
    expect(g.angulo).toBeCloseTo(45, 0);
    expect(g.longitudCm).toBeCloseTo(Math.hypot(300, 300), 0);
    expect(g.baseCm).toBeGreaterThan(1);
  });

  it('flujo motor: 2º clic diagonal NO crea (fija eje), 3º crea delgado', () => {
    const eng = makeEngine();
    handleCanalDown(eng as never, 0, 0);
    // Eje diagonal 45° en px de plano (scaleM 0.5: 424px ≈ 5.6m).
    handleCanalDown(eng as never, 300, 300);
    expect(eng.bajantes.filter((b) => b.tipo === 'canal')).toHaveLength(0);
    expect(eng._canalEje).toEqual({ x1: 0, y1: 0, x2: 300, y2: 300 });
    // 3er clic apenas fuera del eje → canal DELGADO (antes: ancho fijo = lado corto).
    const d = Math.SQRT1_2;
    commitCanalAncho(eng as never, 150 - 8 * d, 150 + 8 * d);
    const canales = eng.bajantes.filter((b) => b.tipo === 'canal');
    expect(canales).toHaveLength(1);
    expect(eng._canalEje).toBeNull();
    // 8px ⊥ al eje a scaleM 0.5 ≈ 10.6cm — delgado de verdad, no los ~300 del arrastre.
    expect(canales[0].base).toBeLessThan(30);
    expect(canales[0].base).toBeGreaterThanOrEqual(1);
    expect(canales[0].angulo).toBeCloseTo(45, 0);
  });

  it('Escape cancela la fase de ancho sin crear', () => {
    const eng = makeEngine();
    eng.tool = 'canal';
    handleCanalDown(eng as never, 0, 0);
    handleCanalDown(eng as never, 300, 300);
    expect(eng._canalEje).not.toBeNull();
    handleKeyDown(
      eng as never,
      {
        key: 'Escape',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: { tagName: 'CANVAS' },
        preventDefault: () => {},
      } as unknown as KeyboardEvent,
    );
    expect(eng._canalEje).toBeNull();
    expect(eng.bajantes.filter((b) => b.tipo === 'canal')).toHaveLength(0);
  });
});

describe('renumeración de canales al borrar (ítem 6)', () => {
  function crear(eng: PlanoEngine, x1: number, y1: number, x2: number, y2: number): string {
    (eng as { _canalStart: unknown })._canalStart = null;
    handleCanalDown(eng as never, x1, y1);
    handleCanalDown(eng as never, x2, y2);
    const last = eng.bajantes[eng.bajantes.length - 1];
    return last.id;
  }

  it('borrar el intermedio compacta y el próximo no duplica', () => {
    const eng = makeEngine();
    // Canales de 300x40cm a scaleM 0.5: 300cm → ~448px. Separados en X.
    const a = crear(eng, 0, 0, 500, 60);
    const b = crear(eng, 600, 0, 1100, 60);
    const c = crear(eng, 1200, 0, 1700, 60);
    expect([a, b, c]).toEqual(['CNL1-P1', 'CNL2-P1', 'CNL3-P1']);
    // Ramal del canal intermedio + bajante con canalId, para verificar cascada/remap.
    eng.ramales.push({
      id: 'RX',
      net: 'll',
      tipo: 'ramal',
      pts: [
        [700, 10],
        [700, 400],
      ],
      esCanalId: b,
      label: 'RS9',
      labelX: 700,
      labelY: 200,
      labelAngle: 0,
      totalL: 1,
    } as never);
    eng.bajantes.push({
      id: 'BAN9-P1',
      code: 'BAN9-P1',
      net: 'll',
      tipo: 'bajante',
      x: 700,
      y: 400,
      canalId: b,
      recibeDeIds: ['RX'],
      alimentaIds: [],
    } as never);
    // Ruta individual (selId): cascada + compacta.
    eng.selId = b;
    deleteSelected(eng as never);
    const ids = eng.bajantes.filter((x) => x.tipo === 'canal').map((x) => x.id);
    expect(ids).toEqual(['CNL1-P1', 'CNL2-P1']);
    expect(eng.ramales.some((r) => r.id === 'RX')).toBe(false);
    const ban = eng.bajantes.find((x) => x.id === 'BAN9-P1');
    expect(ban?.canalId).toBeNull();
    // El próximo nace CNL3 (max+1), sin duplicar.
    const d = crear(eng, 1800, 0, 2300, 60);
    expect(d).toBe('CNL3-P1');
    expect(new Set(eng.bajantes.map((x) => x.id)).size).toBe(eng.bajantes.length);
  });

  it('ruta en conjunto también compacta y remapea esCanalId del sobreviviente', () => {
    const eng = makeEngine();
    crear(eng, 0, 0, 500, 60);
    crear(eng, 600, 0, 1100, 60);
    eng.ramales.push({
      id: 'RY',
      net: 'll',
      tipo: 'ramal',
      pts: [
        [700, 10],
        [700, 400],
      ],
      esCanalId: 'CNL2-P1',
      label: 'RS9',
      labelX: 700,
      labelY: 200,
      labelAngle: 0,
      totalL: 1,
    } as never);
    deleteSelected(eng as never, ['CNL2-P1']);
    // CNL2 borrado: su ramal cae; CNL1 sobrevive (sin tocar).
    expect(eng.bajantes.filter((x) => x.tipo === 'canal').map((x) => x.id)).toEqual(['CNL1-P1']);
    expect(eng.ramales.some((r) => r.id === 'RY')).toBe(false);
  });
});

describe('etiqueta manual intacta (ítem 2)', () => {
  function ramalFijo(labelMoved?: boolean) {
    return {
      id: 'RS1',
      net: 'll',
      tipo: 'ramal',
      label: 'RS1',
      pts: [
        [0, 0],
        [100, 0],
      ],
      labelX: 999,
      labelY: 888,
      labelAngle: 0,
      labelMoved,
      totalL: 5,
    } as never;
  }

  it('updateSelected con pts NO recentra si labelMoved', () => {
    const eng = makeEngine();
    eng.ramales.push(ramalFijo(true));
    eng.selId = 'RS1';
    updateSelected(eng as never, {
      pts: [
        [0, 0],
        [200, 0],
      ],
    });
    const r = eng.ramales[0] as { labelX: number; labelY: number };
    expect(r.labelX).toBe(999);
    expect(r.labelY).toBe(888);
  });

  it('updateSelected con pts SÍ recentra si nunca se movió', () => {
    const eng = makeEngine();
    eng.ramales.push(ramalFijo(false));
    eng.selId = 'RS1';
    updateSelected(eng as never, {
      pts: [
        [0, 0],
        [200, 0],
      ],
    });
    const r = eng.ramales[0] as { labelX: number; labelY: number };
    expect(r.labelX).toBe(100);
    expect(r.labelY).toBe(0);
  });

  it('_trySelRamalDrag cede ante la etiqueta propia (ramal corto)', () => {
    const eng = makeEngine();
    // Ramal de 30px: etiqueta al centro, a <15px de ambos extremos.
    eng.ramales.push({
      id: 'RS1',
      net: 'll',
      tipo: 'ramal',
      label: 'RS1',
      pts: [
        [0, 0],
        [30, 0],
      ],
      labelX: 15,
      labelY: 0,
      labelAngle: 0,
      totalL: 1,
      _labelBox: { cx: 15, cy: -20, minX: 0, minY: -30, maxX: 30, maxY: -10 },
    } as never);
    const sel = eng.ramales[0];
    const lp = eng.toCvs(15, 0);
    // Clic en el centro de la etiqueta (lejos de la caja este frame, cerca del centro):
    // NO agarra vértice — el loop de etiquetas decide.
    expect(_trySelRamalDrag(eng as never, lp.x, lp.y, sel as never, false)).toBe(false);
  });
});
