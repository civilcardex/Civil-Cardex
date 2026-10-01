import { describe, it, expect, beforeEach } from 'vitest';
import { copyDrawingFromPlan } from '../../../utils/copyDrawingFromPlan';
import { TRAZOS_PREFIX } from '../../../constants/storage-keys';

// Copia entre pisos (definición usuario): el FANTASMA es el MISMO bajante renderizado
// desplazado (anillo de la asociación cuando dos bajantes no alinean) con dirección 'sube';
// el ORIGINAL es el mismo bajante en su posición base con 'baja'. El modal decide qué
// versión(es) copiar — posición + diámetro + caudal/UD viajan siempre.

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      scaleM: 0.5,
      bajantes: [
        {
          id: 'BALL1',
          net: 'll',
          tipo: 'bajante',
          x: 100,
          y: 100,
          dNominal: '4"',
          area_m2: 120,
          direccion: 'baja',
          desplazamientos: { 'Piso 0': { dx: 12, dy: -5, Ldesvio: 'LD_BALL1' } },
        },
      ],
      ramales: [],
      crossFloorGhosts: [],
    }),
  );
});

function makeEngine() {
  const eng = {
    ramales: [],
    bajantes: [],
    crossFloorGhosts: [],
    dims: [],
    _netCounts: { ll: { ramal: 0, tributario: 0 } },
    scaleM: 0.5,
    nivelActual: { label: 'P2', n: 1, npt: 320 },
    _dirty: false,
    _markDirty: () => {},
    render: () => {},
    setScaleM: (v: number) => {
      eng.scaleM = v;
    },
    saveWork: () => ({
      v: 6,
      scaleM: eng.scaleM,
      ramales: eng.ramales,
      dims: [],
      textAnnots: [],
      bajantes: eng.bajantes,
      areas: [],
      nptLevels: [],
      guideLines: [],
      crossFloorGhosts: eng.crossFloorGhosts,
    }),
  };
  return eng as never as Parameters<typeof copyDrawingFromPlan>[0];
}

const SEL = [{ netId: 'll', tipos: new Set(['bajante']) }];

type Baj = { id: string; code?: string; x: number; y: number; direccion?: string };

describe('copia por versión del bajante (modal)', () => {
  it('originales: SOLO la posición base, sin área', () => {
    const eng = makeEngine();
    copyDrawingFromPlan(eng, '2', '1', SEL, undefined, { fantasmas: 'originales' });
    const bajs = (eng as unknown as { bajantes: Baj[] }).bajantes;
    expect(bajs).toHaveLength(1);
    expect(bajs[0].x).toBe(100);
    expect(bajs[0].y).toBe(100);
    expect(bajs[0].direccion).toBe('baja');
    expect((bajs[0] as unknown as { area_m2?: number }).area_m2).toBeUndefined();
  });

  it('fantasmas: SOLO la posición desplazada con direccion sube', () => {
    const eng = makeEngine();
    copyDrawingFromPlan(eng, '2', '1', SEL, undefined, { fantasmas: 'fantasmas' });
    const bajs = (eng as unknown as { bajantes: Baj[] }).bajantes;
    expect(bajs).toHaveLength(1);
    expect(bajs[0].x).toBe(112);
    expect(bajs[0].y).toBe(95);
    expect(bajs[0].direccion).toBe('sube');
  });

  it('ambos: base + desplazada (2 copias)', () => {
    const eng = makeEngine();
    copyDrawingFromPlan(eng, '2', '1', SEL, undefined, { fantasmas: 'ambos' });
    const bajs = (eng as unknown as { bajantes: Baj[] }).bajantes;
    expect(bajs).toHaveLength(2);
    const posiciones = bajs.map((b) => `${b.x},${b.y}`).sort();
    expect(posiciones).toEqual(['100,100', '112,95']);
    expect(bajs.some((b) => b.direccion === 'sube')).toBe(true);
    expect(bajs.some((b) => b.direccion === 'baja')).toBe(true);
  });
});
