import { describe, expect, it } from 'vitest';
import { indicesDeMotor } from '../engineIndices';
import type { IPlanoEngineCore } from '../PlanoState.ts';

/**
 * Los índices id→pieza del motor (indicesMotor.ts) quitan las búsquedas lineales dentro de
 * bucles: al arrastrar un grupo de N elementos, cada uno buscaba su ramal, bajante,
 * anotación, área, cota y guía recorriendo la lista completa.
 *
 * Estos tests fijan la SEMÁNTICA que debe conservarse: el PRIMERO gana (como un `.find`).
 */

function motor(): IPlanoEngineCore {
  return {
    ramales: [{ id: 'R1' }, { id: 'R2' }],
    bajantes: [{ id: 'B1' }],
    textAnnots: [{ id: 'T1' }],
    areas: [{ id: 'A1' }],
    dims: [{ id: 'D1' }],
    guideLines: [{ id: 'G1' }],
  } as unknown as IPlanoEngineCore;
}

describe('indicesDeMotor', () => {
  it('indexa cada tipo de pieza por su id', () => {
    const idx = indicesDeMotor(motor());
    expect(idx.ramales.get('R1')).toBeDefined();
    expect(idx.bajantes.get('B1')).toBeDefined();
    expect(idx.textos.get('T1')).toBeDefined();
    expect(idx.areas.get('A1')).toBeDefined();
    expect(idx.cotas.get('D1')).toBeDefined();
    expect(idx.guias.get('G1')).toBeDefined();
  });

  it('una pieza que no existe devuelve undefined (igual que un .find sin coincidencia)', () => {
    const idx = indicesDeMotor(motor());
    expect(idx.ramales.get('NO_EXISTE')).toBeUndefined();
  });

  it('si hay ids repetidos gana el PRIMERO (como un .find)', () => {
    const m = motor();
    (m.ramales as Array<{ id: string; valor?: number }>).push({
      id: 'R1',
      valor: 2,
    } as never);
    const idx = indicesDeMotor(m);
    expect((idx.ramales.get('R1') as { valor?: number }).valor).toBeUndefined();
  });

  it('un motor sin piezas devuelve índices vacíos (no revienta)', () => {
    const idx = indicesDeMotor({
      ramales: [],
      bajantes: [],
      textAnnots: [],
      areas: [],
      dims: [],
      guideLines: [],
    } as unknown as IPlanoEngineCore);
    expect(idx.ramales.size).toBe(0);
    expect(idx.bajantes.size).toBe(0);
  });
});
