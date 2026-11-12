/**
 * Verificaciones de rociadores: separaciones S/L, área por rociador, distancia a muro (DMR),
 * rociadores en operación y su caudal; y dos de criterios por tipología: duración de la
 * descarga y techo alto. Ej: S = 2,4 m con S máx. 4,6 → "2,4 ≤ 4,6 m" en CUMPLE.
 */
import { fmtEs as f1 } from '../fmtEs.ts';
import { num } from '../hydraulics';
import type { ChecksCtx } from './helpers';

/** Separación entre rociadores y entre ramales, área por rociador y distancia a muro (por
 *  tipología); rociadores en operación y caudal ≥ densidad × área (con red calculada). */
export function verificarRociadores(ctx: ChecksCtx): void {
  const { st, addT, cita, tpsRed } = ctx;
  addT('Separación entre rociadores 1,8 m ≤ S ≤ S máx.', cita, ['tipologias', 'pisos'], (t) => {
    const o = t.ro;
    return {
      st: o.S >= 1.8 && o.S <= o.hz.s ? 'CUMPLE' : 'NO CUMPLE',
      val: `${f1(o.S)} ≤ ${f1(o.hz.s)} m`,
      guide:
        o.S > o.hz.s
          ? `Reduzca S a ${f1(o.hz.s)} m o menos (añada rociadores en el ramal).`
          : 'Aumente S a 1,80 m o más, o use pantallas entre rociadores.',
    };
  });
  addT('Separación entre ramales 1,8 m ≤ L ≤ L máx.', cita, ['tipologias', 'pisos'], (t) => {
    const o = t.ro;
    return {
      st: o.L >= 1.8 && o.L <= o.hz.l ? 'CUMPLE' : 'NO CUMPLE',
      val: `${f1(o.L)} ≤ ${f1(o.hz.l)} m`,
      guide:
        o.L > o.hz.l
          ? `Reduzca L a ${f1(o.hz.l)} m o menos (añada un ramal).`
          : 'Aumente L a 1,80 m o más.',
    };
  });
  addT('Área por rociador ≤ cobertura máxima', cita, ['tipologias', 'pisos'], (t) => {
    const o = t.ro;
    return {
      st: o.Areal <= o.Acmax ? 'CUMPLE' : 'NO CUMPLE',
      val: `${f1(o.Areal, 0)} ≤ ${o.Acmax} ft²`,
      guide: `Reduzca S × L a ${f1(o.Acmax * 0.092903)} m² o menos. Con S = ${f1(o.S)} m, L ≤ ${f1((o.Acmax * 0.092903) / o.S)} m.`,
    };
  });
  addT('Distancia a muro ≤ S máx./2', cita, ['tipologias', 'pisos'], (t) => {
    /* DMR por piso (columna DMR de Pisos del edificio); sin valor propio cae a la global. */
    const dm = t.ro.Dmuro > 0 ? t.ro.Dmuro : null;
    return dm === null
      ? {
          st: 'PENDIENTE',
          val: 'Sin dato',
          guide: `Ingrese la distancia del último rociador al muro (columna DMR de Pisos del edificio): entre 0,10 m y ${f1(t.ro.hz.s / 2)} m.`,
        }
      : {
          st: dm <= t.ro.hz.s / 2 && dm >= 0.1 ? 'CUMPLE' : 'NO CUMPLE',
          val: `${f1(dm)} ≤ ${f1(t.ro.hz.s / 2)} m`,
          guide: `Ubique el último rociador a no más de ${f1(t.ro.hz.s / 2)} m del muro y a no menos de 0,10 m.`,
        };
  });
  const autoG = !!(st.auto && st.auto.on);
  addT(
    'Rociadores en operación ≥ requeridos por el área de diseño',
    'NFPA 13-2025 cap. 28',
    ['hidraulica'],
    (t) => ({
      st: t.Nop >= t.ro.Nreq ? 'CUMPLE' : 'NO CUMPLE',
      val: `${t.Nop} ≥ ${t.ro.Nreq}`,
      guide: autoG
        ? `Faltan ${t.ro.Nreq - t.Nop} rociadores con flujo conectados a la red. Agregue ramales en PLANO (del más remoto hacia el montante), aumente "Fluyen" o revise las conexiones de los nudos.`
        : `Faltan ${t.ro.Nreq - t.Nop} rociadores en el cálculo. Active la red automática o conecte más ramales (columna "Ramal conectado").`,
    }),
    tpsRed,
  );
  addT(
    'Caudal de rociadores ≥ densidad × área de diseño',
    'NFPA 13-2025 Tabla 19.2.3.1.1',
    ['hidraulica'],
    (t) => ({
      st: t.Qroc >= t.ro.Qteo - 0.01 ? 'CUMPLE' : 'NO CUMPLE',
      val: `${f1(t.Qroc, 1)} ≥ ${f1(t.ro.Qteo, 1)} gpm`,
      guide:
        'El caudal calculado no alcanza la densidad × área. Revise el K, la presión mínima y que todos los rociadores del área estén incluidos.',
    }),
    tpsRed,
  );
}

/** Duración de la descarga adoptada ≥ mínima de la tabla de densidad/área (NFPA 13). */
export function verificarDuracion(ctx: ChecksCtx): void {
  const { st, addT } = ctx;
  addT(
    'Duración adoptada ≥ mínima',
    'NFPA 13-2025 Tabla 19.2.3.1.1',
    ['entradas', 'mang.duracion'],
    (t) => {
      const o = t.ro,
        d = num(st.mang.duracion) || o.dmin;
      return {
        st: d >= o.dmin ? 'CUMPLE' : 'NO CUMPLE',
        val: `${d} ≥ ${o.dmin} min`,
        guide:
          o.dmin === o.dmax
            ? `Adopte una duración de ${o.dmin} min o más.`
            : `Adopte una duración de ${o.dmin} min o más (rango ${o.dmin} a ${o.dmax} min).`,
      };
    },
  );
}

/** Techo ≤ 9,14 m (30 ft): por encima aplican los criterios de techos altos de NFPA 13. */
export function verificarTecho(ctx: ChecksCtx): void {
  const { addT } = ctx;
  addT(
    'Techo ≤ 9,14 m (30 ft) para criterios estándar',
    'NFPA 13-2025 cap. 19',
    ['entradas', 'clas.htecho'],
    (t) => {
      const h = t.ro.HtFt / 3.28084;
      return {
        st: h <= 9.14 ? 'CUMPLE' : 'REVISAR',
        val: `${f1(h)} m`,
        guide:
          'Con techos de más de 9,14 m aplique los requisitos de techos altos de NFPA 13-2025 (densidad mínima y aumento de área según riesgo y K).',
      };
    },
  );
}
