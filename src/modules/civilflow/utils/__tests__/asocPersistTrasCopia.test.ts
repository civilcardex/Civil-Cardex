import { describe, it, expect, beforeEach } from 'vitest';
import { saveToStorage, saveTrazosToDB } from '../../services/storageService';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
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
