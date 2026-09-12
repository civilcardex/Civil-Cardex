import { describe, it, expect } from 'vitest';
import { dedupPorId } from '../PlanoPersistence';

// Datos de sesiones con bugs viejos traen el mismo elemento DOS veces en un piso: el RPC
// save_plano_data rechaza el insert entero ("ON CONFLICT DO UPDATE cannot affect row a second
// time", 500) y React se queja de keys duplicadas; las dos copias además se pelean escribiendo
// la herencia en cada pasada (bucle de setState). El dedup conserva la ÚLTIMA aparición.

describe('dedupPorId', () => {
  it('conserva la última aparición y el orden de la primera', () => {
    const out = dedupPorId([
      { id: 'BAN2', x: 1 },
      { id: 'RS1' },
      { id: 'BAN2', x: 2, descargaEnId: '0|BAN1' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ id: 'BAN2', x: 2, descargaEnId: '0|BAN1' });
    expect(out[1]).toEqual({ id: 'RS1' });
  });

  it('no colisionan ids prefijos (BAN1 vs BAN10) ni elementos sin id', () => {
    const out = dedupPorId([{ id: 'BAN1' }, { id: 'BAN10' }, { foo: 1 }, { foo: 2 }]);
    expect(out).toHaveLength(4);
  });

  it('sin duplicados devuelve el mismo contenido', () => {
    const lista = [{ id: 'a' }, { id: 'b' }];
    expect(dedupPorId(lista)).toEqual(lista);
  });
});
