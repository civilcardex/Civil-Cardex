/**
 * Verificaciones de rociadores: separaciones S/L, área por rociador, distancia a muro (DMR),
 * rociadores en operación y su caudal; y dos de criterios por tipología: duración de la
 * descarga y techo alto. Ej: S = 2,4 m con S máx. 4,6 → "2,4 ≤ 4,6 m" en CUMPLE.
 */
import { fmtEs as f1 } from '../fmtEs.ts';
import { num } from '../hydraulics';
import { HZ } from '../tables';
import type { ChecksCtx } from './helpers';

/* S/L por FILA de Pisos del edificio (ped. usuario 2026-11-18): el chequeo lee las CELDAS
 * de la tabla — cada piso con rociadores debe cumplir 1,8 ≤ S/L ≤ máximo de SU riesgo.
 * Sin valor en la celda → PENDIENTE nombrando el piso (antes leía el agregado de
 * tipologías y mostraba «0,00» cuando la fila del representante estaba vacía). */
function chequearSl(ctx: ChecksCtx, k: 'S' | 'L'): void {
  const { st, add, cita } = ctx;
  const lab = `Separación entre ${k === 'S' ? 'rociadores' : 'ramales'} 1,8 m ≤ ${k} ≤ ${k} máx. (por piso)`;
  /* Riesgo por fila: el propio de la celda; vacío hereda el GLOBAL de Entradas (ped.
   *  usuario 2026-11-19: «ya está clasificado y aún aparece pendiente» — el filtro viejo
   *  contaba como sin clasificar las filas cuyo riesgo vive solo en clas.riesgo). */
  const riesgoG = st.clas.riesgo || 'Riesgo leve';
  const filas = (st.pisos.rows || [])
    .map((r, i) => ({ r, i, riesgo: r.riesgo || riesgoG }))
    .filter(({ r }) => r.riesgo !== 'Sin rociadores');
  if (!filas.length) {
    add(
      lab,
      'PENDIENTE',
      'Sin pisos con rociadores',
      cita,
      'Defina pisos en el plano o asigne riesgo en Pisos del edificio.',
      ['tipologias', 'pisos'],
    );
    return;
  }
  const pend: string[] = [];
  const mal: string[] = [];
  filas.forEach(({ r, i, riesgo }) => {
    const hz = HZ[riesgo] || HZ['Riesgo leve'];
    const max = k === 'S' ? hz.s : hz.l;
    const v = num(r[k]);
    const nom = r.nombre || `Piso ${i + 1}`;
    if (!v) pend.push(nom);
    else if (v < 1.8 - 1e-9 || v > max + 1e-9)
      mal.push(`${nom}: ${f1(v)} m (rango 1,8–${f1(max)} m)`);
  });
  if (mal.length) {
    add(
      lab,
      'NO CUMPLE',
      mal.slice(0, 4).join(' · ') + (mal.length > 4 ? ` · y ${mal.length - 4} más` : ''),
      cita,
      `Corrija la columna ${k} en Pisos del edificio: 1,80 m ≤ ${k} ≤ máximo del riesgo.`,
      ['tipologias', 'pisos'],
    );
  } else if (pend.length) {
    add(
      lab,
      'PENDIENTE',
      `Sin dato: ${pend.slice(0, 4).join(', ')}${pend.length > 4 ? ` y ${pend.length - 4} más` : ''}`,
      cita,
      `Defina la columna ${k} en Pisos del edificio (1,80 m ≤ ${k} ≤ máximo del riesgo).`,
      ['tipologias', 'pisos'],
    );
  } else {
    add(lab, 'CUMPLE', `${k} en rango en los ${filas.length} piso(s)`, cita, '', undefined);
  }
}

/** Separación entre rociadores y entre ramales, área por rociador y distancia a muro (por
 *  tipología); rociadores en operación y caudal ≥ densidad × área (con red calculada). */
export function verificarRociadores(ctx: ChecksCtx): void {
  const { st, addT, cita, tpsRed } = ctx;
  /* S y L se verifican contra las CELDAS de la tabla Pisos del edificio (una fila por piso). */
  chequearSl(ctx, 'S');
  chequearSl(ctx, 'L');
  addT('Área por rociador ≤ cobertura máxima', cita, ['tipologias', 'pisos'], (t) => {
    const o = t.ro;
    return {
      st: o.Areal <= o.Acmax ? 'CUMPLE' : 'NO CUMPLE',
      val: `${f1(o.Areal, 0)} ≤ ${o.Acmax} ft²`,
      guide: `Reduzca S × L a ${f1(o.Acmax * 0.092903)} m² o menos. Con S = ${f1(o.S)} m, L ≤ ${f1((o.Acmax * 0.092903) / o.S)} m.`,
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
        ? `Faltan ${t.ro.Nreq - t.Nop} rociadores con flujo conectados a la red. Agregue ramales en PLANO (del más remoto hacia el montante) o revise las conexiones de los nudos.`
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
