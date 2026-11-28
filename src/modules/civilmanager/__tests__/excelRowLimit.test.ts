import { describe, expect, it } from 'vitest';
import { FILAS_TOPE_XLSX, hojaTruncada } from '../excelRowLimit.ts';

// H-05 (plan 2026-11-27): con sheetRows = tope + 1, el rango !ref revela si la hoja traía
// más filas de las leídas. 4.999/5.000 filas pasan; 5.001 se rechaza ANTES de tocar estado.
describe('límite de filas de la hoja Excel (H-05)', () => {
  it.each<[string, number]>([
    ['A1:J4999', 4999],
    ['A1:J5000', 5000],
    ['A1:J5001', 5001],
  ])('rango %s (%s filas leídas)', (ref, filas) => {
    expect(hojaTruncada(ref)).toBe(filas > FILAS_TOPE_XLSX);
  });

  it('los rangos que empiezan más abajo se miden por su largo, no por la última fila', () => {
    // Hoja recortada que empieza en la fila 3000: 2500 filas leídas → no truncada aunque
    // la última fila (5499) supere el tope absoluto.
    expect(hojaTruncada('A3000:J5499')).toBe(false);
    expect(hojaTruncada('A3000:J8000')).toBe(true);
  });
});
