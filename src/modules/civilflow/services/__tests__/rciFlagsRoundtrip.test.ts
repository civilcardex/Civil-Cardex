/** Round-trip de los flags de la ronda RCI en la cadena de BD: esMuro (guías/muros) y
 *  esRectFuego (rectángulo de fuego definido) deben sobrevivir mapper ida → fila → mapper
 *  vuelta — antes se perdían (sin columna ni campo en el mapper) y al recargar con caché
 *  fría los muros volvían grises. Ej: guideLineToRow→rowToGuideLine conserva esMuro. */
import { describe, it, expect } from 'vitest';
import { guideLineToRow, rowToGuideLine, areaToRow, rowToArea } from '../storage/planRowMappers.ts';
import type { PlanoGuideLine, PlanoArea } from '../../lib/PlanoEngine/PlanoState.ts';

const UID = 'user-1';
const PLANO = 12;

describe('round-trip BD de los flags RCI', () => {
  it('esMuro de la guía sobrevive ida y vuelta', () => {
    const guia: PlanoGuideLine = {
      id: 'GL1',
      net: 'rci',
      pts: [
        [0, 0],
        [100, 0],
      ],
      esMuro: true,
    };
    const row = guideLineToRow(PLANO, UID, guia);
    expect(row.es_muro).toBe(true);
    const deNuevo = rowToGuideLine(row as unknown as Record<string, unknown>);
    expect(deNuevo.esMuro).toBe(true);
    expect(deNuevo.id).toBe('GL1');
    expect(deNuevo.pts).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it('guía normal (sin esMuro) vuelve esMuro false — no contamina', () => {
    const guia: PlanoGuideLine = {
      id: 'GL2',
      net: 'af',
      pts: [
        [0, 0],
        [50, 0],
      ],
    };
    const deNuevo = rowToGuideLine(
      guideLineToRow(PLANO, UID, guia) as unknown as Record<string, unknown>,
    );
    expect(deNuevo.esMuro).toBe(false);
  });

  it('esRectFuego del área sobrevive ida y vuelta', () => {
    const area: PlanoArea = {
      id: 'AR1',
      pts: [
        [0, 0],
        [100, 0],
        [100, 80],
        [0, 80],
      ],
      color: 'rgba(0,220,229,0.12)',
      label: 'AREA1',
      labelX: 50,
      labelY: 40,
      labelAngle: 0,
      areaM2: 99.06,
      net: 'rci',
      esRectFuego: true,
    };
    const row = areaToRow(PLANO, UID, area);
    expect(row.es_rect_fuego).toBe(true);
    const deNuevo = rowToArea(row as unknown as Record<string, unknown>);
    expect(deNuevo.esRectFuego).toBe(true);
    expect(deNuevo.areaM2).toBeCloseTo(99.06);
  });

  it('área normal (sin esRectFuego) vuelve false — no contamina', () => {
    const area: PlanoArea = {
      id: 'AR2',
      pts: [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      color: '',
      label: 'AREA2',
      labelX: 5,
      labelY: 5,
      labelAngle: 0,
      areaM2: 1,
    };
    const deNuevo = rowToArea(areaToRow(PLANO, UID, area) as unknown as Record<string, unknown>);
    expect(deNuevo.esRectFuego).toBe(false);
  });
});
