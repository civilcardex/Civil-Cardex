import { describe, expect, it, beforeEach } from 'vitest';
import { applyBajanteAssociation } from '../../../utils/bajanteAssociation';
import { migrateAssocLayoutOnLoad } from '../../../utils/associateBajanteAcrossFloors';
import type { IPlanoEngineCore } from '../PlanoState';

// Layout de asociación entre pisos (orig. usuario): fantasma (anillo) + Ldesvio en el piso
// INFERIOR; marcadores (círculo punteado + línea) en el piso SUPERIOR.

function makeEngine(loadedPlanId: string): IPlanoEngineCore {
  return {
    _loadedPlanId: loadedPlanId,
    bajantes: [],
    ramales: [],
    crossFloorGhosts: [],
    nivelActual: { label: 'P2', n: 2, npt: 3 },
    scaleM: 0.5,
    updateElementById: () => {},
    render: () => {},
    _markDirty: () => {},
  } as unknown as IPlanoEngineCore;
}

interface Trazos {
  ramales?: Array<{ id: string; pts?: number[][] }>;
  bajantes?: Array<{
    id: string;
    x?: number;
    y?: number;
    desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
    ghostData?: Record<string, { direccion?: string; labelX?: number; labelY?: number }>;
  }>;
  crossFloorGhosts?: Array<{
    id: string;
    x: number;
    y: number;
    code?: string;
    sourcePlanId: string;
    sourceBajanteId: string;
    targetBajanteId?: string;
  }>;
  assocLayout?: number;
}

const read = (planId: string): Trazos =>
  JSON.parse(localStorage.getItem('civilflow_trazos_' + planId) || '{}') as Trazos;

const seedAsoc = () => {
  localStorage.clear();
  const set = (k: string, v: unknown) => localStorage.setItem('civilflow_' + k, JSON.stringify(v));
  // Superior plan 2 (BAN9 en 100,80), inferior plan 1 (BAN8 en 300,200) — no alineados.
  set('trazos_2', {
    ramales: [],
    bajantes: [{ id: 'BAN9', net: 'san', tipo: 'bajante', x: 100, y: 80 }],
  });
  set('trazos_1', {
    ramales: [],
    bajantes: [{ id: 'BAN8', net: 'san', tipo: 'bajante', x: 300, y: 200 }],
  });
};

const endpoint = (
  planId: string,
  id: string,
  x: number,
  y: number,
  nivelN: number,
  npt: number,
) => ({
  planId,
  id,
  x,
  y,
  net: 'san',
  dNominal: '4"',
  code: id,
  nivelN,
  npt,
});

describe('asociación entre pisos — lados (layout nuevo)', () => {
  beforeEach(seedAsoc);

  it('fantasma+Ldesvio en el piso INFERIOR; marcadores en el SUPERIOR', () => {
    const eng = makeEngine('2');
    const plans = [
      { id: '1', status: 'confirmed' },
      { id: '2', status: 'confirmed' },
    ] as unknown as Parameters<typeof applyBajanteAssociation>[3];
    applyBajanteAssociation(
      eng,
      endpoint('2', 'BAN9', 100, 80, 2, 3),
      endpoint('1', 'BAN8', 300, 200, 1, 0),
      plans,
    );
    const lower = read('1');
    const upper = read('2');
    // Inferior: Ldesvio con la geometría A→B y anillo (desplazamientos) sobre BAN8 apuntando
    // a la posición de BAN9; sin ghost.
    const ld = lower.ramales?.find((r) => r.id === 'LD_BAN9');
    expect(ld?.pts).toEqual([
      [100, 80],
      [300, 200],
    ]);
    const desp = lower.bajantes?.find((b) => b.id === 'BAN8')?.desplazamientos ?? {};
    const entries = Object.values(desp);
    expect(entries.some((d) => d.Ldesvio === 'LD_BAN9' && d.dx === -200 && d.dy === -120)).toBe(
      true,
    );
    expect(lower.crossFloorGhosts ?? []).toHaveLength(0);
    // Superior: ghost-marcador referenciando al inferior, anclado en sus coords; sin Ldesvio.
    const ghost = (upper.crossFloorGhosts ?? [])[0];
    expect(ghost?.sourcePlanId).toBe('1');
    expect(ghost?.sourceBajanteId).toBe('BAN8');
    expect(ghost?.targetBajanteId).toBe('BAN9');
    expect(ghost?.x).toBe(300);
    expect(ghost?.y).toBe(200);
    expect(upper.ramales ?? []).toHaveLength(0);
    // Marca de versión en ambos pisos.
    expect(lower.assocLayout).toBe(2);
    expect(upper.assocLayout).toBe(2);
  });
});

describe('migración automática del layout viejo', () => {
  beforeEach(() => {
    seedAsoc();
    const set = (k: string, v: unknown) =>
      localStorage.setItem('civilflow_' + k, JSON.stringify(v));
    // Layout VIEJO: ghost en el piso inferior (sourced del superior) + Ldesvio y anillo en el
    // piso superior.
    set('trazos_1', {
      ramales: [],
      bajantes: [{ id: 'BAN8', net: 'san', tipo: 'bajante', x: 300, y: 200 }],
      crossFloorGhosts: [
        {
          id: 'XFG_BAN9_2',
          net: 'san',
          code: 'BAN9',
          x: 100,
          y: 80,
          dNominal: '4"',
          direccion: 'sube',
          parentDireccion: 'baja',
          piso: 'P2',
          sourcePlanId: '2',
          sourceBajanteId: 'BAN9',
          targetBajanteId: 'BAN8',
        },
      ],
    });
    set('trazos_2', {
      ramales: [
        {
          id: 'LD_BAN9',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [100, 80],
            [300, 200],
          ],
        },
      ],
      bajantes: [
        {
          id: 'BAN9',
          net: 'san',
          tipo: 'bajante',
          x: 100,
          y: 80,
          desplazamientos: { P2: { dx: 200, dy: 120, Ldesvio: 'LD_BAN9' } },
        },
      ],
    });
  });

  it('mueve Ldesvio+anillo al inferior y el ghost-marcador al superior', () => {
    migrateAssocLayoutOnLoad('1', 'P1');
    const lower = read('1');
    const upper = read('2');
    // Inferior: Ldesvio movido, anillo sobre BAN8 con clave del nivel actual, ghost fuera.
    expect(lower.ramales?.some((r) => r.id === 'LD_BAN9')).toBe(true);
    const desp = lower.bajantes?.find((b) => b.id === 'BAN8')?.desplazamientos ?? {};
    expect(desp['P1']).toEqual({ dx: -200, dy: -120, Ldesvio: 'LD_BAN9' });
    expect(lower.crossFloorGhosts ?? []).toHaveLength(0);
    // Superior: ghost-marcador nuevo, sin Ldesvio, anillo viejo del superior limpiado.
    const ghost = (upper.crossFloorGhosts ?? [])[0];
    expect(ghost?.sourceBajanteId).toBe('BAN8');
    expect(ghost?.targetBajanteId).toBe('BAN9');
    expect(ghost?.x).toBe(300);
    expect(ghost?.y).toBe(200);
    expect(upper.ramales ?? []).toHaveLength(0);
    expect(upper.bajantes?.find((b) => b.id === 'BAN9')?.desplazamientos ?? {}).toEqual({});
    expect(lower.assocLayout).toBe(2);
    expect(upper.assocLayout).toBe(2);
  });

  it('es idempotente (segunda pasada no duplica nada)', () => {
    migrateAssocLayoutOnLoad('1', 'P1');
    migrateAssocLayoutOnLoad('1', 'P1');
    const lower = read('1');
    const upper = read('2');
    expect(lower.ramales?.filter((r) => r.id === 'LD_BAN9')).toHaveLength(1);
    expect(upper.crossFloorGhosts ?? []).toHaveLength(1);
  });
});

// Alineados verticalmente (orig. usuario): NO se crea Ldesvio ni anillo/etiqueta de fantasma —
// el bajante inferior ya está en su sitio; el marcador del superior queda suprimido en render.
const setLS = (k: string, v: unknown) =>
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
    'civilflow_' + k,
    JSON.stringify(v),
  );

describe('asociación entre pisos — alineados', () => {
  beforeEach(seedAsoc);

  it('alineados: sin anillo y sin Ldesvio en el inferior; ghost-marcador en el superior', () => {
    setLS('civilflow_trazos_1', {
      ramales: [],
      bajantes: [{ id: 'BAN8', net: 'san', tipo: 'bajante', x: 100, y: 80 }],
    });
    const eng = makeEngine('2');
    const plans = [
      { id: '1', status: 'confirmed' },
      { id: '2', status: 'confirmed' },
    ] as unknown as Parameters<typeof applyBajanteAssociation>[3];
    applyBajanteAssociation(
      eng,
      endpoint('2', 'BAN9', 100, 80, 2, 3),
      endpoint('1', 'BAN8', 100, 80, 1, 0),
      plans,
    );
    const lower = read('1');
    const upper = read('2');
    expect(lower.ramales ?? []).toHaveLength(0);
    const b8 = lower.bajantes?.find((b) => b.id === 'BAN8');
    expect(Object.keys(b8?.desplazamientos ?? {})).toHaveLength(0);
    expect((upper.crossFloorGhosts ?? []).length).toBe(1);
  });
});

// Desasociar revierte la herencia: el agregado del superior que se SUMÓ a los ramales del
// inferior se resta, la clave del Ldesvio se borra y ucAcum vuelve a 0.

describe('migración pasada 2 — persistencia', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Anillo transferido al piso inferior (pasada 2, vista desde el piso SUPERIOR sin abrir el
  // inferior): antes de la corrección las mutaciones sobre lowerData no se guardaban —
  // markAssocLayout/removeCrossFloorGhost re-cargaban fresco y las pisaban.
  it('migrando desde el superior, el anillo queda PERSISTIDO en el bajante inferior', () => {
    const set = (k: string, v: unknown) =>
      localStorage.setItem('civilflow_' + k, JSON.stringify(v));
    set('trazos_2', {
      ramales: [
        {
          id: 'LD_BAN9',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [100, 80],
            [300, 200],
          ],
        },
      ],
      bajantes: [
        {
          id: 'BAN9',
          net: 'san',
          tipo: 'bajante',
          x: 100,
          y: 80,
          descargaEnId: '1|BAN8',
          desplazamientos: { P2: { dx: 200, dy: 120, Ldesvio: 'LD_BAN9' } },
        },
      ],
    });
    set('trazos_1', {
      ramales: [],
      bajantes: [{ id: 'BAN8', net: 'san', tipo: 'bajante', x: 300, y: 200 }],
    });
    migrateAssocLayoutOnLoad('2', 'P2');
    const lower = read('1');
    const upper = read('2');
    // LD movido al inferior; anillo viejo del superior fuera.
    expect(lower.ramales?.some((r) => r.id === 'LD_BAN9')).toBe(true);
    expect(upper.ramales ?? []).toHaveLength(0);
    expect(upper.bajantes?.find((b) => b.id === 'BAN9')?.desplazamientos ?? {}).toEqual({});
    // El anillo en BAN8 sobrevive al guardado (no solo la mutación en memoria).
    const b8 = lower.bajantes?.find((b) => b.id === 'BAN8');
    expect(b8?.desplazamientos?.['P2']).toEqual({ dx: -200, dy: -120, Ldesvio: 'LD_BAN9' });
    expect(b8?.ghostData?.['P2']?.direccion).toBe('sube');
    expect(lower.assocLayout).toBe(2);
    expect(upper.assocLayout).toBe(2);
  });

  // Cadena de 3 pisos (plan 2 intermedio: lower de BAN7 y upper de BAN8): la pasada 2 guardaba
  // el plan con el array de ramales leído ANTES de la pasada 1 — el LD_BAN7 recién movido a
  // plan 2 se borraba.
  it('plan intermedio conserva el LD creado por la pasada 1', () => {
    const set = (k: string, v: unknown) =>
      localStorage.setItem('civilflow_' + k, JSON.stringify(v));
    // Plan 3 (superior): BAN7 alineado con BAN9; LD_BAN7 y ghost viejo viven donde el layout
    // viejo los puso — LD en el superior (plan 3), ghost en el inferior (plan 2).
    set('trazos_3', {
      ramales: [
        {
          id: 'LD_BAN7',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [150, 100],
            [150, 100],
          ],
        },
      ],
      bajantes: [{ id: 'BAN7', net: 'san', tipo: 'bajante', x: 150, y: 100 }],
    });
    set('trazos_2', {
      ramales: [
        {
          id: 'LD_BAN9',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [150, 100],
            [300, 200],
          ],
        },
      ],
      bajantes: [
        {
          id: 'BAN9',
          net: 'san',
          tipo: 'bajante',
          x: 150,
          y: 100,
          descargaEnId: '1|BAN8',
        },
      ],
      crossFloorGhosts: [
        {
          id: 'XFG_BAN7_3',
          net: 'san',
          code: 'BAN7',
          x: 150,
          y: 100,
          dNominal: '4"',
          direccion: 'sube',
          parentDireccion: 'baja',
          piso: 'P3',
          sourcePlanId: '3',
          sourceBajanteId: 'BAN7',
          targetBajanteId: 'BAN9',
        },
      ],
    });
    set('trazos_1', {
      ramales: [],
      bajantes: [{ id: 'BAN8', net: 'san', tipo: 'bajante', x: 300, y: 200 }],
    });
    migrateAssocLayoutOnLoad('2', 'P2');
    const mid = read('2');
    // El LD_BAN7 (creado en plan 2 por la pasada 1) SOBREVIVE al saveData de la pasada 2;
    // el LD_BAN9 se fue al piso 1.
    expect(mid.ramales?.some((r) => r.id === 'LD_BAN7')).toBe(true);
    expect(mid.ramales?.some((r) => r.id === 'LD_BAN9')).toBe(false);
    expect(read('1').ramales?.some((r) => r.id === 'LD_BAN9')).toBe(true);
    expect(read('3').ramales ?? []).toHaveLength(0);
  });
});
