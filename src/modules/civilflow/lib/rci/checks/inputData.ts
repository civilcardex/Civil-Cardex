/**
 * Verificaciones de calidad de los datos de entrada: tramos con datos completos y valores
 * dentro de rango (negativos, K/Pmin imposibles, tanque, bomba, mangueras, montante, redes).
 * Ej: un ramal sin diámetro → "1 tramos incompletos" en NO CUMPLE.
 */
import { fmtEs as f1 } from '../fmtEs.ts';
import { num } from '../hydraulics';
import type { FilaRoute } from '../types';
import type { ChecksCtx } from './helpers';

/** Tramos sin material/diámetro/longitud y datos de entrada fuera de rango: no detienen el
 *  cálculo, pero sus resultados no son válidos. Ej: margen de bomba −5 → "1 dato(s) fuera de rango". */
export function verificarDatosEntrada(ctx: ChecksCtx): void {
  const { st, R, add, addT, tpsRed, bldRows } = ctx;
  const bo = R.bomba;
  {
    const inc = (rs: FilaRoute[]) => rs.filter((r) => !r.ok).length,
      ib = inc(bldRows);
    addT(
      'Tramos con datos completos',
      '—',
      ['hidraulica'],
      (t) => {
        const n = inc(t.rows);
        return {
          st: n ? 'NO CUMPLE' : 'CUMPLE',
          val: `${n} tramos incompletos`,
          guide:
            'Complete material, diámetro y longitud de los tramos marcados en Hidráulica. Verifique que el diámetro exista para el material elegido.',
        };
      },
      tpsRed,
    );
    if (ib)
      add(
        'Tramos del montante y gabinetes con datos completos',
        'NO CUMPLE',
        `${ib} tramos incompletos`,
        '—',
        'Complete material, diámetro y longitud del montante, la ruta del cuarto de bombas o los gabinetes (Entradas → Montantes NFPA 14).',
        ['entradas', 'mont.dn'],
      );
  }
  /* Datos fuera de rango: no detienen el cálculo, pero sus resultados no son válidos */
  {
    const bad: string[] = [],
      paths: (string | undefined)[] = [],
      neg = (v: unknown, lab: string, pth?: string): void => {
        const x = num(v);
        if (x !== null && x < 0) {
          bad.push(`${lab} = ${f1(x)}`);
          paths.push(pth);
        }
      };
    const b = st.bomba || {};
    neg(b.margen, 'Margen de presión de la bomba', 'bomba.margen');
    neg(b.lSuc, 'Longitud de succión', 'bomba.lSuc');
    neg((st.tanque || {}).vextra, 'Volumen adicional del tanque', 'tanque.vextra');
    neg((st.mang || {}).duracion, 'Duración', 'mang.duracion');
    if (num(st.roc.K) !== null && num(st.roc.K)! <= 0)
      bad.push(`Factor K = ${f1(num(st.roc.K), 1)}`);
    if (num(st.roc.Pmin) !== null && num(st.roc.Pmin)! < 7)
      bad.push(`Presión mínima del rociador = ${f1(num(st.roc.Pmin), 1)} psi (NFPA 13: ≥ 7 psi)`);
    if (num(b.hmin) !== null && num(b.hmax) !== null && num(b.hmin)! > num(b.hmax)!)
      bad.push(
        `Nivel mínimo del tanque (${f1(num(b.hmin))} m) mayor que el máximo (${f1(num(b.hmax))} m)`,
      );
    if (num(b.fchurn) !== null && num(b.fchurn)! < 1)
      bad.push(`Factor de presión a caudal cero = ${f1(num(b.fchurn))} (debe ser ≥ 1)`);
    const M = st.mont || {};
    neg(M.hS, 'Altura de las salidas de manguera', 'mont.hS');
    neg(M.hD, 'Altura de la derivación del piso', 'mont.hD');
    (M.cuarto || []).forEach((r, i) =>
      neg(r.L, `Longitud del tramo ${i + 1} del cuarto de bombas`, 'mont.dn'),
    );
    Object.entries(st.redes || {}).forEach(([pl, red]) => {
      (red.ramales || []).forEach((r) =>
        neg(r.Lr, `Longitud del ramal ${r.nombre || '?'} (planta ${pl})`),
      );
      (red.tramos || []).forEach((t) =>
        neg(
          t.L,
          `Longitud del tramo ${(t as { nombre?: string }).nombre || `${t.de}→${t.a}`} (planta ${pl})`,
        ),
      );
    });
    if (!(bo.Pnom > 0))
      bad.push(
        'La bomba no tiene presión de diseño: revise la red de rociadores, el montante y la ruta del cuarto de bombas',
      );
    add(
      'Datos de entrada dentro de rango',
      bad.length ? 'NO CUMPLE' : 'CUMPLE',
      bad.length ? `${bad.length} dato(s) fuera de rango` : 'Sin datos fuera de rango',
      'Control de datos',
      `Corrija: ${bad.join('; ')}.`,
      paths.find(Boolean) ? ['entradas', paths.find(Boolean) as string] : ['entradas'],
    );
  }
}
