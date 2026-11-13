import { describe, it, expect, beforeAll } from 'vitest';
import PlanoEngineCtor from '../PlanoEngine.ts';
import type PlanoEngine from '../PlanoEngine.ts';
import { deleteSelected } from '../deleteSelected.ts';

// H-06: la numeración ROC-N es CONSECUTIVA por piso (JSDoc de renumeraRociadores), pero
// borrar rociadores/ramales rci no re-estampaba → quedaban huecos ROC-1, ROC-3. Ahora el
// wrapper público de deleteSelected renumera UNA vez al final cuando hay ramales rci.

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) {
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
    } as never;
  }
  if (!g.window) {
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
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
        if (k === 'measureText') return () => ({ width: 10 });
        return () => {};
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return {
    width: 800,
    height: 600,
    getContext: () => ctxStub,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    style: {},
  };
}

function makeEngine(): PlanoEngine {
  const canv = makeCanvas();
  const cw = { addEventListener: () => {}, removeEventListener: () => {}, style: {} };
  return new PlanoEngineCtor(cw as never, null, canv as unknown as HTMLCanvasElement);
}

/** Ramal rci con rociadores ya numerados (como los deja renumeraRociadores): inicio + accMed. */
function seedRamalRci(
  eng: PlanoEngine,
  id: string,
  accMed: Record<string, string>,
  inicio = 'rociador#1',
): void {
  eng.activeNet = 'rci';
  eng.ramales.push({
    net: 'rci',
    tipo: 'ramal',
    padre: null,
    piso: '',
    dz: '',
    uc: 0,
    labelAngle: 0,
    material: '',
    diametro: '4"',
    pendiente: 2,
    bloqueado: false,
    ini: '',
    fin: '',
    id,
    label: id,
    totalL: 100,
    pts: [
      [0, 0],
      [100, 0],
    ],
    labelX: 50,
    labelY: 0,
    accesorioInicio: inicio,
    accMed,
  } as never);
}

/** Todos los valores de rociador#N visibles del piso (inicio de cada ramal + accMed), en orden. */
function etiquetasRoc(eng: PlanoEngine): string[] {
  const vals: string[] = [];
  for (const r of eng.ramales) {
    if (r.accesorioInicio && /^rociador#/.test(r.accesorioInicio)) vals.push(r.accesorioInicio);
    for (const v of Object.values(r.accMed || {})) if (/^rociador#/.test(v)) vals.push(v);
  }
  return vals;
}

describe('H-06: borrar ramales rci re-estampa ROC-N consecutivo', () => {
  it('borrar el ramal del ROC-1 deja ROC-2/ROC-3 re-estampados como ROC-1/ROC-2', () => {
    const eng = makeEngine();
    // Orden de creación: RRA (ROC-1) → RRB (ROC-2, ROC-3). Borrar RRA rompe la consecutiva.
    seedRamalRci(eng, 'RRA', {});
    seedRamalRci(eng, 'RRB', { accMed0: 'rociador#2', accMed1: 'rociador#3' }, 'codo');
    expect(etiquetasRoc(eng)).toEqual(['rociador#1', 'rociador#2', 'rociador#3']);

    deleteSelected(eng, ['RRA']);

    const labels = etiquetasRoc(eng);
    expect(labels).toEqual(['rociador#1', 'rociador#2']);
    // El glifo dibuja 'ROC-N' con el N del #: consecutiva restaurada.
    expect(labels.map((v) => `ROC-${v.split('#')[1]}`)).toEqual(['ROC-1', 'ROC-2']);
  });

  it('borrar en una red NO rci no toca la numeración de otros ramales', () => {
    const eng = makeEngine();
    seedRamalRci(eng, 'RRC', {});
    eng.activeNet = 'san';
    eng.ramales.push({
      net: 'san',
      tipo: 'ramal',
      padre: null,
      piso: '',
      dz: '',
      uc: 0,
      labelAngle: 0,
      material: '',
      diametro: '4"',
      pendiente: 2,
      bloqueado: false,
      ini: '',
      fin: '',
      id: 'RSA',
      label: 'RSA',
      totalL: 50,
      pts: [
        [0, 0],
        [50, 0],
      ],
      labelX: 25,
      labelY: 0,
    } as never);

    deleteSelected(eng, ['RSA']);

    expect(eng.ramales).toHaveLength(1);
    expect(etiquetasRoc(eng)).toEqual(['rociador#1']);
  });
});
