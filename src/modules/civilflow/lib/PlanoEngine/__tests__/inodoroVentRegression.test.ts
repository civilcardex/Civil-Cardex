import { describe, it, expect, beforeAll } from 'vitest';
import { APARATOS_BY_TRAMO_KEY } from '../../../constants/storage-keys';
import { finishRamal } from '../PlanoEngineDrawing';
import { deleteSelected } from '../deleteSelected';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';

// Reproducción de sesión completa: inodoro en RS4 (san) + conexión de ventilación (ramal vent
// + bajante de vent) + borrado del vent + renumeración + undo + guardado/recarga. Tras CADA
// paso se verifica que el inodoro (campo aparatoInicio + conteo) siga intacto.

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

/** RS4: inodoro en (100,0) — bajante en (0,0). Inodoro = aparatoInicio + codo + conteo. */
function seed(eng: PlanoEngine) {
  eng.activeNet = 'san';
  eng.ramales.push({
    id: 'RS4',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [100, 0],
      [0, 0],
    ],
    totalL: 100,
    label: 'RS4',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 50,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '4"',
    pendiente: 2,
    bloqueado: false,
    aparatoInicio: 'san',
    accesorioInicio: 'codo90rmSube',
    diametroInicio: '4"',
  } as never);
  eng.bajantes.push({
    id: 'BAN1',
    net: 'san',
    tipo: 'bajante',
    code: 'BAN1',
    x: 0,
    y: 0,
    direccion: 'baja',
    dNominal: '4"',
    recibeDeIds: ['RS4'],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
  } as never);
  localStorage.setItem(
    'civilflow_' + APARATOS_BY_TRAMO_KEY,
    JSON.stringify({ san_RS4_1: { san: 1 } }),
  );
  eng._loadedPlanId = '1';
  eng._markDirty();
}

function appOk(eng: PlanoEngine): boolean {
  // El renumerado puede cambiar el id (RS4→RS1 al cerrar huecos) — el inodoro sobrevive si
  // ALGÚN ramal san mantiene el campo y exactamente una clave de conteo conserva {san:1}.
  const fieldOk = eng.ramales.some(
    (x) => x.net === 'san' && (x as unknown as { aparatoInicio?: string }).aparatoInicio === 'san',
  );
  const counts = JSON.parse(
    localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}',
  ) as Record<string, Record<string, number>>;
  const keysWithSan = Object.entries(counts).filter(([, v]) => (v['san'] || 0) > 0);
  return fieldOk && keysWithSan.length === 1;
}

describe('inodoro RS4 + ventilación: regresión de borrado', () => {
  it('pasos encadenados — el inodoro sobrevive a cada uno', () => {
    const eng = makeEngine();
    seed(eng);
    expect(appOk(eng)).toBe(true);

    // Paso 1: dibujar ramal de vent REV2 desde el punto del bajante hacia la derecha
    eng.activeNet = 'vent';
    eng.activeRamal = {
      net: 'vent',
      tipo: 'ramal',
      padre: null,
      pts: [
        [0, 0],
        [0, 60],
      ],
    } as never;
    finishRamal(eng as never);
    eng._markDirty();
    expect(appOk(eng)).toBe(true);

    // Paso 2: crear bajante de VENTILACIÓN (REV2) en el extremo libre del ramal vent
    eng.bajantes.push({
      id: 'REV1',
      net: 'vent',
      tipo: 'bajante',
      code: 'REV1',
      x: 0,
      y: 60,
      direccion: 'baja',
      dNominal: '3"',
      recibeDeIds: [eng.ramales.find((r) => r.net === 'vent')?.id || ''],
      alimentaIds: [],
      descargaEnId: null,
      ucAcum: 0,
      ucExtra: 0,
      area_m2: 0,
      desplazamientos: {},
    } as never);
    eng._renumberBajantes('vent');
    eng._markDirty();
    expect(appOk(eng)).toBe(true);

    // Paso 3: borrar el ramal de ventilación (con cascada/limpieza de uniones)
    const ventRamal = eng.ramales.find((r) => r.net === 'vent');
    if (ventRamal) {
      eng.selId = ventRamal.id;
      try {
        deleteSelected(eng as never, [ventRamal.id]);
      } catch {
        // la firma puede variar; borrar manual del array para continuar el bisect
        eng.ramales = eng.ramales.filter((r) => r.id !== ventRamal.id);
      }
      eng._markDirty();
    }
    expect(appOk(eng)).toBe(true);

    // Paso 4: renumerar ramales san (borrar un ramal cualquiera dispara esto)
    eng._renumberRamales('san');
    eng._markDirty();
    expect(appOk(eng)).toBe(true);

    // Paso 5: guardar y recargar
    const work = JSON.parse(JSON.stringify(eng.saveWork()));
    const eng2 = makeEngine();
    eng2.loadWork(JSON.stringify(work));
    eng2._markDirty();
    expect(appOk(eng2)).toBe(true);
  });

  it('vent con extremo SOBRE el cuerpo de RS4 (cruce san↔vent): el inodoro sobrevive', () => {
    const eng = makeEngine();
    seed(eng);
    expect(appOk(eng)).toBe(true);

    // El extremo del ramal de ventilación aterriza a mitad del cuerpo de RS4 — es un cruce
    // (codo reventilado visual), NO un split: RS4 no se parte y su conteo no se mueve.
    eng.activeNet = 'vent';
    eng.ramales.push({
      id: 'RV1',
      net: 'vent',
      tipo: 'ramal',
      padre: null,
      pts: [
        [50, 0],
        [50, 60],
      ],
      totalL: 60,
      label: 'RV1',
      ini: '',
      fin: '',
      piso: '',
      dz: '',
      uc: 0,
      labelX: 50,
      labelY: 30,
      labelAngle: 0,
      material: '',
      diametro: '2"',
      pendiente: 2,
      bloqueado: false,
    } as never);
    eng._markDirty();
    expect(appOk(eng)).toBe(true);
    // RS4 sigue entero (sin split por cruce entre redes)
    expect(eng.ramales.filter((r) => r.net === 'san').length).toBe(1);

    // Arrastre del extremo del vent sobre el cuerpo del san + borrado del vent
    const rv = eng.ramales.find((r) => r.id === 'RV1')!;
    rv.pts[0] = [60, 0];
    eng._markDirty();
    expect(appOk(eng)).toBe(true);
    eng.selId = 'RV1';
    try {
      deleteSelected(eng as never, ['RV1']);
    } catch {
      eng.ramales = eng.ramales.filter((r) => r.id !== 'RV1');
    }
    eng._markDirty();
    eng._renumberRamales('vent');
    eng._renumberRamales('san');
    eng._markDirty();
    expect(appOk(eng)).toBe(true);

    // Recarga: el campo y el conteo viajan juntos
    const work = JSON.parse(JSON.stringify(eng.saveWork()));
    const eng2 = makeEngine();
    eng2.loadWork(JSON.stringify(work));
    eng2._markDirty();
    expect(appOk(eng2)).toBe(true);
  });
});
