/**
 * Verificaciones sobre TODAS las tuberías (cada tipología y, aparte, montante + cuarto de
 * bombas + gabinetes, vía addR): accesorios especiales con catálogo, coeficiente C de
 * Hazen-Williams según NFPA 13, velocidad en tramos y presión en cada nudo. Ej: un accesorio
 * "Tee 45" sin catálogo → "Sin catálogo: Tee 45" en REVISAR.
 */
import { CDEF } from '../tables';
import { fmtEs as f1 } from '../fmtEs.ts';
import { num } from '../hydraulics';
import type { ChecksCtx } from './helpers';

/** Accesorios especiales reconocidos, coeficiente C según NFPA 13 y velocidad ≤ criterio. */
export function verificarTuberias(ctx: ChecksCtx): void {
  const { st, add, addR } = ctx;
  addR(
    'Accesorios especiales reconocidos en el catálogo',
    'Dato del fabricante',
    ['hidraulica'],
    (rs) => {
      const unk = [...new Set(rs.flatMap((r) => (r as { espUnk?: string[] }).espUnk || []))];
      return {
        st: unk.length ? 'REVISAR' : 'CUMPLE',
        val: unk.length ? `Sin catálogo: ${unk.join(', ')}` : 'Todos reconocidos',
        guide: `Agregue los códigos ${unk.join(', ')} al catálogo de accesorios especiales (Entradas → Tubería) o corrija la columna "Especiales". Mientras tanto no suman pérdida.`,
      };
    },
  );
  {
    const dif = Object.keys(st.cmat || {}).flatMap((m) =>
      [
        ['h', 'Húmedo'],
        ['s', 'Seco'],
      ]
        .map(([k, s]) => {
          const v = num((st.cmat as Record<string, Record<string, unknown>>)[m][k]);
          return v !== null && v > 0 && v !== CDEF(m, s)
            ? `${m} ${s.toLowerCase()}: ${v} (NFPA ${CDEF(m, s)})`
            : null;
        })
        .filter((x): x is string => x !== null),
    );
    add(
      'Coeficiente C de Hazen-Williams según NFPA 13',
      dif.length ? 'REVISAR' : 'CUMPLE',
      dif.length ? dif.join('; ') : 'Valores de NFPA 13 cap. 28',
      'NFPA 13-2025 cap. 28',
      'Se adoptó un C distinto del de la norma. Justifíquelo en la memoria (tubería existente, material listado, exigencia de la autoridad) o deje el campo vacío para usar el de NFPA 13.',
      ['entradas', 'tub.Vmax'],
    );
  }
  addR('Velocidad en todos los tramos ≤ criterio', 'Criterio de diseño', ['hidraulica'], (rs) => {
    const n = rs.filter((r) => (r as { chkV?: string }).chkV === 'V ALTA').length;
    return {
      st: n ? 'REVISAR' : 'CUMPLE',
      val: `${n} tramos con V > ${f1(num(st.tub.Vmax) || 6, 1)} m/s`,
      guide: 'Aumente el diámetro de los tramos marcados V ALTA.',
    };
  });
}

/** Presión en cada nudo dentro de límites (P BAJA / P ALTA marcados en la columna de presión). */
export function verificarPresionNudos(ctx: ChecksCtx): void {
  const { addR } = ctx;
  addR(
    'Presión en cada nudo dentro de límites',
    'NFPA 13-2025 cap. 28 / NFPA 14-2024',
    ['hidraulica'],
    (rs) => {
      const n = rs.filter(
        (r) =>
          (r as { chkP?: string }).chkP === 'P BAJA' || (r as { chkP?: string }).chkP === 'P ALTA',
      ).length;
      return {
        st: n ? 'NO CUMPLE' : 'CUMPLE',
        val: `${n} nudos fuera de límite`,
        guide:
          'Revise las filas marcadas en la columna de presión. P BAJA: aumente diámetros o la presión de arranque. P ALTA: reduzca la presión de bomba o use válvulas reductoras o reguladoras o componentes de mayor clase.',
      };
    },
  );
}
