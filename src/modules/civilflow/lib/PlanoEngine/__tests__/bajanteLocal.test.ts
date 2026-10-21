import { describe, it, expect } from 'vitest';
import { dedupPorId, mergeBajanteDedup } from '../PlanoPersistence.ts';
import { bajanteLocalDe, claveBajante, dedupPorClave } from '../../../utils/bajanteLocal.ts';
import { numDeBajante } from '../../../utils/keys.ts';

// El id de un bajante/montante SOLO es único dentro de un piso: el motor guarda en el mismo
// array el bajante real del piso abierto y la PROYECCIÓN de otro piso que atraviesa esta
// altura (mismo id tras un renombre). Con dedup por id ganaba la proyección: el autosave
// escribía su geometría y `saveTrazosToDB` subía ese error a Supabase (CRÍTICO, 2026-10-21).

describe('claveBajante · identidad por piso', () => {
  it('el id igual en pisos distintos son claves distintas', () => {
    const real = { id: 'MAC1_ac', pisoBase: 'Piso 1' };
    const proyeccion = { id: 'MAC1_ac', pisoBase: 'Piso 2' };
    expect(claveBajante(real)).not.toBe(claveBajante(proyeccion));
  });

  it('el mismo id en el mismo piso es la misma clave', () => {
    expect(claveBajante({ id: 'MAC1_ac', pisoBase: 'Piso 1' })).toBe(
      claveBajante({ id: 'MAC1_ac', pisoBase: 'Piso 1' }),
    );
  });

  it('un elemento sin id no colisiona con otro sin id', () => {
    // Sin id NO hay clave: la copia se conserva (igual que dedupPorId, que no registra
    // la clave vacía). Si devolviera '|' (truthy) el dedup fusionaría piezas distintas.
    expect(claveBajante({})).toBe('');
    const out = dedupPorClave([{ pisoBase: 'Piso 1' }, { pisoBase: 'Piso 1' }], claveBajante);
    expect(out).toHaveLength(2);
  });
});

describe('dedupPorClave · el guardado conserva el montante REAL, no la proyección', () => {
  it('conserva las dos copias de otros pisos (no son la misma pieza)', () => {
    const out = dedupPorClave(
      [
        { id: 'MAC1_ac', pisoBase: 'Piso 1', x: 120 },
        { id: 'MAC1_ac', pisoBase: 'Piso 2', x: 300 },
      ],
      claveBajante,
    );
    expect(out).toHaveLength(2);
  });

  it('con la proyección DESPUÉS, el guardado no se lleva la geometría del fantasma', () => {
    // Reproduce el incidente: la proyección venía después en el array y `dedupPorId`
    // conservaba la ÚLTIMA -> el montante real de Piso 1 perdía x/y y su pisoBase.
    const out = dedupPorClave(
      [
        { id: 'MAC1_ac', pisoBase: 'Piso 1', x: 120, y: 80 },
        { id: 'MAC1_ac', pisoBase: 'Piso 2', x: 300, y: 40 },
      ],
      claveBajante,
    );
    const real = out.find((b) => b.pisoBase === 'Piso 1');
    expect(real).toBeDefined();
    expect(real!.x).toBe(120);
    expect(real!.y).toBe(80);
  });

  it('los duplicados REALES del mismo piso se siguen fusionando (keep-last + merge)', () => {
    const out = dedupPorClave(
      [
        { id: 'BAN2', pisoBase: 'Piso 1', x: 9 },
        { id: 'BAN2', pisoBase: 'Piso 1', x: 7, ucAplicado: { san_RS2_1: { sif: 2 } } },
      ],
      claveBajante,
      mergeBajanteDedup,
    );
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(7);
    // El merge de asociación sigue viva: el libro de la copia 1 no se pierde.
    expect(out[0].ucAplicado).toEqual({ san_RS2_1: { sif: 2 } });
  });

  it('dedupPorId (ramales, donde el id SÍ es único) no cambia de comportamiento', () => {
    const out = dedupPorId([{ id: 'RAF1' }, { id: 'RAF1', x: 2 }]);
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(2);
  });
});

describe('bajanteLocalDe · se resuelve el del PISO ABIERTO', () => {
  const motor = {
    nivelActual: { label: 'Piso 1' },
    bajantes: [
      { id: 'MAC1_ac', pisoBase: 'Piso 2', x: 300, tipo: 'montante' },
      { id: 'MAC1_ac', pisoBase: 'Piso 1', x: 120, tipo: 'montante' },
    ],
  };

  it('devuelve el del piso abierto aunque la proyección vaya primero', () => {
    const b = bajanteLocalDe(motor, 'MAC1_ac');
    expect(b?.pisoBase).toBe('Piso 1');
    expect(b?.x).toBe(120);
  });

  it('sin coincidencia con el piso abierto cae al primero que coincida', () => {
    const b = bajanteLocalDe({ ...motor, nivelActual: { label: 'Piso 9' } }, 'MAC1_ac');
    expect(b?.pisoBase).toBe('Piso 2');
  });

  it('si no existe ninguno, devuelve undefined', () => {
    expect(bajanteLocalDe(motor, 'NO_EXISTE')).toBeUndefined();
  });

  it('un motor sin bajantes no rompe', () => {
    expect(bajanteLocalDe({ nivelActual: { label: 'Piso 1' } }, 'MAC1_ac')).toBeUndefined();
  });
});

describe('numDeBajante · un único criterio de numeración', () => {
  it('lee el número aunque el id traiga sufijo de piso', () => {
    // Antes el regex del FINAL del id veía el 1 del piso y creaba ids duplicados.
    expect(numDeBajante('BAN9-P1', 'BAN')).toBe(9);
    expect(numDeBajante('BAN9', 'BAN')).toBe(9);
  });

  it('un id sin número devuelve 0', () => {
    expect(numDeBajante('BAJ', 'BAN')).toBe(0);
    expect(numDeBajante('', 'BAN')).toBe(0);
  });
});
