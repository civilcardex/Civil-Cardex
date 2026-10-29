import { describe, it, expect, beforeAll } from 'vitest';

// @vitest-environment jsdom
import { handleEraseDown } from '../drawingErase.ts';
import PlanoEngineCtor from '../PlanoEngine.ts';
import type PlanoEngine from '../PlanoEngine.ts';
import type { PlanoRamal } from '../PlanoState.ts';

// Doctrina borrador 2026-10-29 (orig. usuario): el borrador sobre un ramal lo borra COMPLETO
// con sus accMed — antes recortaba/partía por los vértices con símbolo y el trazo quedaba
// troceado. Para recortar puntas existe deleteSegmentAt.

function mkEngine(ramal: Partial<PlanoRamal>): { eng: PlanoEngine; ramal: PlanoRamal } {
  const eng = new PlanoEngineCtor(
    { addEventListener: () => {}, removeEventListener: () => {}, style: {} } as never,
    null,
    {
      width: 800,
      height: 600,
      style: {},
      getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement,
  );
  const r = {
    id: 'RAF1',
    net: 'af',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [100, 0],
      [100, 100],
    ],
    totalL: 200,
    label: 'RAF1',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    nSalidas: 1,
    material: '',
    diametro: '',
    bloqueado: false,
    showLength: true,
    showName: true,
    showGuide: true,
    ...ramal,
  } as PlanoRamal;
  eng.ramales.push(r);
  return { eng, ramal: r };
}

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.window)
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      devicePixelRatio: 1,
    };
});

describe('borrador: ramal completo con sus símbolos', () => {
  it('clic del borrador sobre el CENTRO (vértice con accMed) borra el ramal COMPLETO', () => {
    const { eng, ramal } = mkEngine({
      accMed: { accMed1: 'teeSube' },
    });
    handleEraseDown(eng, 50, 5); // clic sobre el segmento horizontal, lejos del vértice
    expect(eng.ramales.some((x) => x.id === ramal.id)).toBe(false);
  });

  it('borra completo aunque el clic caiga sobre el vértice del símbolo (no parte)', () => {
    const { eng, ramal } = mkEngine({
      accMed: { accMed1: 'valvCompuerta' },
    });
    handleEraseDown(eng, 100, 100); // clic exacto sobre el vértice del símbolo
    expect(eng.ramales.some((x) => x.id === ramal.id)).toBe(false);
    expect(eng.ramales.filter((x) => x.net === 'af')).toHaveLength(0);
  });
});
