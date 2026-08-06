import { describe, it, expect } from 'vitest';
import { getBajantesFantasma } from '../PlanoEngineNetwork';
import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState';

// Cobertura de caracterización de bajantes "fantasma" entre pisos — un bajante dibujado en un piso
// que atraviesa varios niveles (nptBase..nptCima) debe aparecer como fantasma en cada piso que
// cruza (salvo su propio pisoBase, donde se dibuja como bajante real) y en el piso inmediatamente
// superior a su cima, para que el usuario vea dónde termina. Es el mecanismo detrás de
// "asociar bajante entre pisos".

function makeBajante(over: Partial<PlanoBajante>): PlanoBajante {
  return {
    id: 'B1',
    net: 'san',
    tipo: 'bajante',
    code: 'B1',
    x: 0,
    y: 0,
    pisoBase: 'P1',
    pisoCima: 'P1',
    nptBase: 0,
    nptCima: 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: 0,
    labelY: 0,
    bajR: 7 / 24,
    ...over,
  } as PlanoBajante;
}

function makeEngine(
  bajantes: PlanoBajante[],
  nivelActual: { label: string; n: number; npt: number },
  nptLevels: { label: string; npt: number }[],
): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    bajantes,
    nivelActual: nivelActual as unknown as IPlanoEngineCore['nivelActual'],
    nptLevels: nptLevels as unknown as IPlanoEngineCore['nptLevels'],
  };
  return engine as IPlanoEngineCore;
}

describe('getBajantesFantasma — cross-floor ghost visibility', () => {
  it('does NOT show a ghost on the bajante own base floor', () => {
    const b = makeBajante({ pisoBase: 'P1', nptBase: 0, pisoCima: 'P3', nptCima: 600 });
    const engine = makeEngine([b], { label: 'P1', n: 1, npt: 0 }, [
      { label: 'P1', npt: 0 },
      { label: 'P2', npt: 300 },
      { label: 'P3', npt: 600 },
    ]);

    expect(getBajantesFantasma(engine)).toEqual([]);
  });

  it('shows a ghost on an intermediate floor the bajante spans through', () => {
    const b = makeBajante({ pisoBase: 'P1', nptBase: 0, pisoCima: 'P3', nptCima: 600 });
    const engine = makeEngine([b], { label: 'P2', n: 2, npt: 300 }, [
      { label: 'P1', npt: 0 },
      { label: 'P2', npt: 300 },
      { label: 'P3', npt: 600 },
    ]);

    const ghosts = getBajantesFantasma(engine);
    expect(ghosts.map((g) => g.id)).toEqual(['B1']);
  });

  it('shows a ghost on its own top floor (pisoCima) since that is not pisoBase', () => {
    const b = makeBajante({ pisoBase: 'P1', nptBase: 0, pisoCima: 'P3', nptCima: 600 });
    const engine = makeEngine([b], { label: 'P3', n: 3, npt: 600 }, [
      { label: 'P1', npt: 0 },
      { label: 'P2', npt: 300 },
      { label: 'P3', npt: 600 },
    ]);

    expect(getBajantesFantasma(engine).map((g) => g.id)).toEqual(['B1']);
  });

  it('does not show a ghost on a floor entirely outside its vertical span, with no explicit override', () => {
    const b = makeBajante({ pisoBase: 'P1', nptBase: 0, pisoCima: 'P2', nptCima: 300 });
    const engine = makeEngine([b], { label: 'P3', n: 3, npt: 600 }, [
      { label: 'P1', npt: 0 },
      { label: 'P2', npt: 300 },
      { label: 'P3', npt: 600 },
    ]);

    expect(getBajantesFantasma(engine)).toEqual([]);
  });

  it('an explicit desplazamientos override on the current floor forces the ghost to show regardless of vertical span', () => {
    const b = makeBajante({
      pisoBase: 'P1',
      nptBase: 0,
      pisoCima: 'P1',
      nptCima: 0,
      desplazamientos: { P5: { dx: 10, dy: 10 } },
    });
    const engine = makeEngine([b], { label: 'P5', n: 5, npt: 1200 }, [
      { label: 'P1', npt: 0 },
      { label: 'P5', npt: 1200 },
    ]);

    expect(getBajantesFantasma(engine).map((g) => g.id)).toEqual(['B1']);
  });

  it('excludes contador/calentador/red_publica symbols even when they span floors', () => {
    const b = makeBajante({
      tipo: 'contador',
      pisoBase: 'P1',
      nptBase: 0,
      pisoCima: 'P3',
      nptCima: 600,
    });
    const engine = makeEngine([b], { label: 'P2', n: 2, npt: 300 }, [
      { label: 'P1', npt: 0 },
      { label: 'P2', npt: 300 },
      { label: 'P3', npt: 600 },
    ]);

    expect(getBajantesFantasma(engine)).toEqual([]);
  });
});
