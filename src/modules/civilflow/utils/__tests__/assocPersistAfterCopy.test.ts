import { describe, it, expect, beforeEach } from 'vitest';
import { saveToStorage, saveTrazosToDB } from '../../services/storageService';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { restaurarAsociacionesDesdeLocal } from '../crossFloorStorage';
import type { DrawingData } from '../drawingSync';

// Repro: tras copiar bajantes entre pisos (modo 'ambos' con fantasmas), el Ldesvio y el
// bajante fantasma del piso destino deben SOBREVIVIR al guardar y recargar.

beforeEach(() => {
  localStorage.clear();
});

type Doc = DrawingData & {
  bajantes?: Array<Record<string, unknown>>;
  ramales?: Array<Record<string, unknown>>;
  crossFloorGhosts?: Array<Record<string, unknown>>;
  origen?: unknown;
};

function docPiso1(): Doc {
  // Bajante fantasma del enlace (con su anillo + Ldesvio en el piso inferior) y un real.
  return {
    scaleM: 0.5,
    bajantes: [
      {
        id: 'BALL1',
        net: 'll',
        tipo: 'bajante',
        x: 100,
        y: 100,
        dNominal: '4"',
        descargaEnId: '2|BALL2',
      },
      {
        id: 'BALL2F',
        net: 'll',
        tipo: 'bajante',
        x: 300,
        y: 300,
        isFantasma: true,
        ghostData: { 'Piso 0': { direccion: 'sube' } },
        desplazamientos: { 'Piso 0': { dx: 12, dy: 0, Ldesvio: 'LD_BALL1' } },
      },
    ],
    ramales: [
      {
        id: 'LD_BALL1',
        net: 'll',
        tipo: 'ramal',
        pts: [
          [312, 300],
          [300, 300],
        ],
      },
    ],
    crossFloorGhosts: [],
  };
}

describe('persistencia de Ldesvio + fantasma tras copiar', () => {
  it('el doc destino conserva XFG copiado, fantasma y LD_ propio tras save→load', async () => {
    saveToStorage(TRAZOS_PREFIX + '1', docPiso1());
    // saveTrazosToDB es fire-and-forget con supabase real — en test solo interesa local.
    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + '1', JSON.stringify(docPiso1()));

    // Simula lo que hace el visor al cerrar: guarda el doc del piso 2 (destino) tal como
    // quedó la copia (con XFG copiado + fantasma preservado).
    const doc2: Doc = {
      scaleM: 0.5,
      bajantes: [
        { id: 'BALL1', net: 'll', tipo: 'bajante', x: 100, y: 100, dNominal: '4"' },
        {
          id: 'BALL2',
          net: 'll',
          tipo: 'bajante',
          x: 300,
          y: 300,
          isFantasma: true,
          ghostData: { 'Piso 1': { direccion: 'sube' } },
        },
      ],
      ramales: [
        {
          id: 'LD_BALL9',
          net: 'll',
          tipo: 'ramal',
          pts: [
            [10, 10],
            [20, 20],
          ],
        },
      ],
      crossFloorGhosts: [{ id: 'XFG_BALL1_1', net: 'll', x: 100, y: 100, layout: 2 }],
    };
    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + '2', JSON.stringify(doc2));

    // Repro del SWEEP: la copia preservó desplazamientos con Ldesvio del ORIGEN →
    // sweepMisplacedLdesvios ve "home" del LD_ en el piso 2 y BORRA el LD_ del piso 1.
    const { sweepMisplacedLdesvios } = await import('../assocLayoutMigration');
    (doc2.bajantes as Array<Record<string, unknown>>).push({
      id: 'BALL1C',
      net: 'll',
      tipo: 'bajante',
      x: 150,
      y: 100,
      desplazamientos: { 'Piso 1': { dx: 5, dy: 0, Ldesvio: 'LD_BALL1' } },
    });
    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + '2', JSON.stringify(doc2));
    sweepMisplacedLdesvios();
    // ASSERT real (antes quedaba en console.info y el test era tautológico): el LD_ del piso 1
    // es reclamado por BALL2F de ahí → el sweep NO debe borrarlo; con el 'home' viejo
    // (último gana) el claim de BALL1C (piso 2) lo habría mandado a borrar.
    const p1 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '1') || '{}');
    expect((p1.ramales || []).some((r: { id?: string }) => r.id === 'LD_BALL1')).toBe(true);

    // Recarga: el doc leído debe seguir teniendo todo.
    const reloaded = JSON.parse(
      localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '2') || '{}',
    ) as Doc;
    expect((reloaded.bajantes || []).some((b) => b.isFantasma === true)).toBe(true);
    expect((reloaded.ramales || []).some((r) => String(r.id).startsWith('LD_'))).toBe(true);
    expect((reloaded.crossFloorGhosts || []).length).toBe(1);
    void saveTrazosToDB;
  });
});

// GATE anti-stale del árbitro de carga (auditoría ronda 6 F6): la restauración anti-loss
// NO debe resucitar asociaciones desasociadas legítimamente en otro dispositivo (caché
// vieja + BD sin ellas + ts divergente >1 h), y SÍ debe restaurar con vaciado indicio
// (BD sin NINGÚN artefacto) o divergencia reciente.
describe('restaurarAsociacionesDesdeLocal — unión incondicional (Chain 1/2)', () => {
  const localConAsoc = {
    scaleM: 0.5,
    bajantes: [
      {
        id: 'BAN8',
        net: 'san',
        tipo: 'bajante',
        desplazamientos: { P1: { dx: -200, dy: -120, Ldesvio: 'LD_BAN9' } },
        ghostData: { P1: { direccion: 'sube' } },
      },
    ],
    ramales: [
      {
        id: 'LD_BAN9',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [1, 1],
        ],
      },
    ],
    crossFloorGhosts: [],
    ts: 1_000_000,
  };

  it('Chain 1: BD gana (ts mayor) con OTRO LD_ ajeno y sin anillo/LD_ propios → unión restaura', () => {
    const db = {
      scaleM: 0.5,
      bajantes: [{ id: 'BAN8', net: 'san', tipo: 'bajante' }],
      ramales: [
        {
          id: 'LD_OTRO',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [5, 5],
            [6, 6],
          ],
        },
      ],
      crossFloorGhosts: [],
      ts: localConAsoc.ts + 7200_000,
    };
    const restauradas = restaurarAsociacionesDesdeLocal(localConAsoc, db);
    expect(restauradas).toBe(true);
    expect((db.ramales as Array<{ id?: string }>).some((r) => r.id === 'LD_BAN9')).toBe(true);
    const baj = (
      db.bajantes as Array<{ id?: string; desplazamientos?: Record<string, unknown> }>
    ).find((x) => x.id === 'BAN8');
    expect(baj?.desplazamientos?.P1).toBeTruthy();
  });

  it('Chain 2: BD sin el bajante (renumerado) → se copia COMPLETO desde local (anillo incluido)', () => {
    const db = {
      scaleM: 0.5,
      bajantes: [{ id: 'BAN_OTRO', net: 'san', tipo: 'bajante' }],
      ramales: [
        {
          id: 'LD_BAN9',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
      crossFloorGhosts: [],
      ts: localConAsoc.ts + 600_000,
    };
    const restauradas = restaurarAsociacionesDesdeLocal(localConAsoc, db);
    expect(restauradas).toBe(true);
    const baj = (
      db.bajantes as Array<{ id?: string; desplazamientos?: Record<string, unknown> }>
    ).find((x: { id?: string }) => x.id === 'BAN8');
    expect(baj).toBeTruthy();
    expect(baj?.desplazamientos?.P1).toBeTruthy();
  });

  it('desasociación legítima (local sin piezas) → unión no resucita nada', () => {
    const db = {
      scaleM: 0.5,
      bajantes: [{ id: 'BAN8', net: 'san', tipo: 'bajante' }],
      ramales: [],
      crossFloorGhosts: [],
      ts: localConAsoc.ts + 600_000,
    };
    const localSinAsoc = {
      scaleM: 0.5,
      bajantes: [{ id: 'BAN8', net: 'san', tipo: 'bajante' }],
      ramales: [],
      crossFloorGhosts: [],
      ts: 1_000_000,
    };
    expect(restaurarAsociacionesDesdeLocal(localSinAsoc, db)).toBe(false);
    expect(db.ramales).toHaveLength(0);
  });
});

// CENTINELA multi-dispositivo (ronda 8 F-2, reemplaza el gate ciego de la ronda 5): caché
// STALE de un tercer dispositivo NO resucita lo que una desasociación legítima borró en
// origen+BD — la marca asocsClearedTs del doc BD lo corta. Caché POSTERIOR a la marca sí
// restaura (blind-spot layout-2 cubierto).
describe('restaurarAsociacionesDesdeLocal — gate por asocsClearedTs', () => {
  const localStale = {
    ts: 1_000,
    bajantes: [{ id: 'BAN1', net: 'll', tipo: 'bajante' }],
    ramales: [
      {
        id: 'LD_BAN1',
        net: 'll',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [1, 1],
        ],
      },
    ],
    crossFloorGhosts: [{ id: 'XFG_BAN1_1', layout: 2 }],
  };
  const dbDesasociado = {
    scaleM: 0.5,
    bajantes: [{ id: 'BAN1', net: 'll', tipo: 'bajante' }],
    ramales: [],
    crossFloorGhosts: [],
    asocsClearedTs: 2_000, // desasociado DESPUÉS de que la caché se copiara
  };

  it('caché stale (< marca) → NO resucita', async () => {
    const { restaurarAsociacionesDesdeLocal } = await import('../crossFloorStorage');
    expect(restaurarAsociacionesDesdeLocal(localStale, dbDesasociado)).toBe(false);
    expect(dbDesasociado.crossFloorGhosts).toHaveLength(0);
    expect(dbDesasociado.ramales).toHaveLength(0);
  });

  it('caché posterior a la marca → restaura (blind-spot layout-2 cubierto)', async () => {
    const { restaurarAsociacionesDesdeLocal } = await import('../crossFloorStorage');
    const db = { ...dbDesasociado };
    expect(restaurarAsociacionesDesdeLocal({ ...localStale, ts: 3_000 }, db)).toBe(true);
    expect(db.crossFloorGhosts).toHaveLength(1);
    expect((db.ramales as Array<{ id?: string }>).some((r) => r.id === 'LD_BAN1')).toBe(true);
  });

  it('sin marca (nunca se desasoció) → restaura (comportamiento anti-loss intacto)', async () => {
    const { restaurarAsociacionesDesdeLocal } = await import('../crossFloorStorage');
    const db = { scaleM: 0.5, bajantes: [], ramales: [], crossFloorGhosts: [] };
    expect(restaurarAsociacionesDesdeLocal(localStale, db)).toBe(true);
    expect(db.crossFloorGhosts).toHaveLength(1);
  });
});
