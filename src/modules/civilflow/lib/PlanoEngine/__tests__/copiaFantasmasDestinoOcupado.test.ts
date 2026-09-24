import { describe, it, expect, beforeEach } from 'vitest';
import { copyDrawingFromPlan } from '../../../utils/copyDrawingFromPlan';
import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY } from '../../../constants/storage-keys';
import { loadFromStorage } from '../../../services/storageService';

// Bug "destino ocupado" (auditoría ronda 5 W-1/W-2): el mapa de offsets de fantasmas se
// keyeaba por id YA renumerado y el lookup buscaba por id viejo — los clones jamás se
// generaban cuando el destino tenía bajantes previos de esa red (renumerado ≠ identidad).
// Y el modo "solo fantasmas" spliceba las copias y reportaba éxito igual (conteo srcAll).

beforeEach(() => {
  localStorage.clear();
  // Origen (piso 1): BALL1 en (100,100) con anillo {dx:12,dy:-5}.
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
          direccion: 'baja',
          desplazamientos: { 'Piso 0': { dx: 12, dy: -5, Ldesvio: 'LD_BALL1' } },
        },
      ],
      ramales: [],
      crossFloorGhosts: [],
    }),
  );
  // Conteos del origen (copyStoreKeys los siembra en el destino).
  localStorage.setItem(
    'civilflow_' + APARATOS_BY_TRAMO_KEY,
    JSON.stringify({ ll_BALL1_1: { inodoro: 1 } }),
  );
});

/** Destino (piso 2) que YA tiene un bajante ll previo → el renumerado NUNCA es identidad. */
function makeEngineDestinoOcupado() {
  const eng = {
    ramales: [],
    bajantes: [{ id: 'BALL1', net: 'll', tipo: 'bajante', x: 900, y: 900, dNominal: '4"' }],
    crossFloorGhosts: [],
    dims: [],
    _netCounts: { ll: { ramal: 0, tributario: 0 } },
    scaleM: 0.5,
    nivelActual: { label: 'P2', n: 1, npt: 320 },
    _dirty: false,
    _markDirty: () => {},
    render: () => {},
    setScaleM: () => {},
    saveWork: () => ({
      v: 6,
      scaleM: 0.5,
      ramales: [],
      dims: [],
      textAnnots: [],
      bajantes: [],
      areas: [],
      nptLevels: [],
      guideLines: [],
      crossFloorGhosts: [],
    }),
  };
  return eng as never as Parameters<typeof copyDrawingFromPlan>[0];
}

const SEL = [{ netId: 'll', tipos: new Set(['bajante']) }];
type Baj = { id: string; x: number; y: number; direccion?: string; recibeDeIds?: string[] };

describe('copia fantasma con destino ocupado (renumerado ≠ identidad)', () => {
  it('"ambos": base renombrada + clon desplazado, ambos presentes', () => {
    const eng = makeEngineDestinoOcupado();
    const res = copyDrawingFromPlan(eng, '2', '1', SEL, undefined, { fantasmas: 'ambos' });
    const bajs = (eng as unknown as { bajantes: Baj[] }).bajantes;
    // Previo BALL1 + base BALL2 + clon BALL3 = 3 (antes: solo el previo + base = 2).
    expect(bajs).toHaveLength(3);
    const clon = bajs.find((b) => b.id !== 'BALL1' && b.direccion === 'sube');
    expect(clon).toBeDefined();
    // Clon = base (transformada a la escala/offset del destino; mismas coords que la base)
    // DESPLAZADA por el anillo (12,-5).
    const base = bajs.find((b) => b.id !== 'BALL1' && b.direccion === 'baja');
    expect(base).toBeDefined();
    expect(clon!.x).toBe(base!.x + 12);
    expect(clon!.y).toBe(base!.y - 5);
    expect(res.copied).toBe(2);
  });

  it('"fantasmas" con anillo: solo el clon queda, la base se retira, conteo = 1', () => {
    const eng = makeEngineDestinoOcupado();
    const res = copyDrawingFromPlan(eng, '2', '1', SEL, undefined, { fantasmas: 'fantasmas' });
    const bajs = (eng as unknown as { bajantes: Baj[] }).bajantes;
    // Previo + clon: la base renombrada NO queda.
    expect(bajs).toHaveLength(2);
    expect(bajs.every((b) => b.id === 'BALL1' || b.direccion === 'sube')).toBe(true);
    expect(res.copied).toBe(1);
    // Las claves de conteos de la base retirada se purgan (no quedan UDs huérfanas).
    const aparatos = loadFromStorage<Record<string, unknown>>(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      {},
    );
    expect(Object.keys(aparatos).some((k) => k.endsWith('_2') && k.includes('BALL'))).toBe(false);
  });

  it('XFG residual + clon del mismo bajante: la proyección redundante se retira', () => {
    const eng = makeEngineDestinoOcupado();
    // El destino proyectaba el XFG de BALL1 del piso origen; al copiar con clon, quedaban
    // TRES glifos con el mismo código (XFG + base + clon) — el XFG redundante sale.
    (eng as unknown as { crossFloorGhosts: unknown[] }).crossFloorGhosts = [
      {
        id: 'XFG_BALL1_1',
        code: 'BALL1',
        net: 'll',
        sourcePlanId: '1',
        sourceBajanteId: 'BALL1',
        targetBajanteId: 'BALL1',
        layout: 2,
      },
    ];
    copyDrawingFromPlan(eng, '2', '1', SEL, undefined, { fantasmas: 'ambos' });
    const bajs = (eng as unknown as { bajantes: Baj[] }).bajantes;
    expect(bajs).toHaveLength(3); // previo + base + clon
    const ghosts = (eng as unknown as { crossFloorGhosts: Array<{ code?: string }> })
      .crossFloorGhosts;
    expect(ghosts).toHaveLength(0); // el XFG de BALL1 es redundante: materializado x2 aquí
  });

  it('"fantasmas" sin anillo en el origen: NADA se copia y copied=0 (sin éxito falso)', () => {
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
            direccion: 'baja',
          },
        ],
        ramales: [],
        crossFloorGhosts: [],
      }),
    );
    const eng = makeEngineDestinoOcupado();
    const res = copyDrawingFromPlan(eng, '2', '1', SEL, undefined, { fantasmas: 'fantasmas' });
    const bajs = (eng as unknown as { bajantes: Baj[] }).bajantes;
    // Solo el bajante previo del destino: cero copia, cero éxito falso.
    expect(bajs).toHaveLength(1);
    expect(res.copied).toBe(0);
  });
});
