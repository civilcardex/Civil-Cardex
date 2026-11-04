/**
 * Bloque RCI (Red Contra Incendio) para la memoria de cálculo del Informe: corre el motor
 * sobre el estado guardado y lo aplana a una tabla compacta de 2 columnas (Concepto/Valor) —
 * misma forma en que gas agrega su tabla y ep la suya. Ej: construirInformeRci(
 * ejemploVerificacion()).tabla.rows termina con la fila ['Verificaciones', '… de 44 CUMPLE'].
 */
import { clasificar, compute, num } from '../../lib/rci/index.ts';
import type { RciState } from '../../lib/rci/types.ts';
import { devError } from '../../../../utils/devError.ts';
import type { MemoriaTable } from '../exportReportFinal.ts';

/** Lo que el Informe consume del bloque RCI: la tabla de la memoria y los fallos (labs de las
 *  verificaciones NO CUMPLE) para los chips del resumen. */
export interface RciInforme {
  tabla: MemoriaTable;
  fallos: string[];
}

/** Num con 2 decimales o '—' cuando el dato no llegó (0 legítimo se muestra como 0.00). */
const f2 = (n: number | null | undefined): string =>
  typeof n === 'number' && isFinite(n) ? n.toFixed(2) : '—';

/** Entero o '—'. Ej: gpm de la bomba cuando el estado aún no cierra la hidráulica. */
const f0 = (n: number | null | undefined): string =>
  typeof n === 'number' && isFinite(n) ? String(Math.round(n)) : '—';

/**
 * Corre compute() sobre el estado guardado y arma el bloque compacto. null = el estado no
 * alcanzó a calcular (datos incompletos) — el informe lo trata como 'Sin calcular', jamás
 * crashea la pestaña por un blob viejo.
 */
export function construirInformeRci(st: RciState): RciInforme | null {
  try {
    const R = compute(st, clasificar(st));
    const E = R.edif;
    const filas: (string | number)[][] = [
      ['Proyecto', st.meta.proyecto || '—'],
      ['Normativa', st.local.codLocal || '—'],
      ['Riesgo / sistema', `${st.clas.riesgo || '—'} · ${st.clas.sistema || '—'}`],
    ];
    // Resumen por tipología: área de diseño (ft², NFPA 13) + N de rociadores + punto de
    // operación en la derivación. Los pisos salen por ÍNDICE (g.pisos) → nombre; un índice
    // que ya no existe en rows (estado viejo) muestra '—', jamás un nombre inventado.
    for (const g of E.groups) {
      const pisos = g.pisos
        .map((i) => (st.pisos.rows[i] ? st.pisos.rows[i].nombre || `P${i + 1}` : '—'))
        .join(', ');
      const tip = E.typ[g.id];
      const deriv =
        tip && typeof tip.P === 'number' && typeof tip.Q === 'number'
          ? `${f0(tip.Q)} gpm @ ${f2(tip.P)} psi`
          : 'pendiente';
      filas.push([
        `Tipología ${g.id} (${pisos || 'sin pisos'})`,
        `Área ${f2(g.roc.Adis)} ft² · ${f0(g.roc.Nreq)} rociadores · Derivación ${deriv}`,
      ]);
    }
    const sia = R.sia;
    filas.push(
      ['Montante', `${st.mont.mat || '—'} DN ${E.dnM || st.mont.dn || '—'}`],
      [
        'Siamesa',
        sia ? `${f0(num(st.sia.entradas))} entradas · ${f0(sia.Q)} gpm @ ${f2(sia.P)} psi` : '—',
      ],
      [
        'Bomba',
        `${f0(R.bomba.Qnom)} gpm @ ${f2(R.bomba.Pnom)} psi · Motor ${f0(R.bomba.HPmot)} HP`,
      ],
      ['Tanque', `${f2(R.tanque.V)} m³`],
      ['Verificaciones', `${f0(R.count['CUMPLE'] ?? 0)} de ${f0(R.checks.length)} CUMPLE`],
    );
    return {
      tabla: { title: 'Red contra incendio (RCI)', headers: ['Concepto', 'Valor'], rows: filas },
      fallos: R.checks.filter((c) => c.st === 'NO CUMPLE').map((c) => c.lab),
    };
  } catch (e) {
    devError('construirInformeRci: el estado RCI guardado no se pudo calcular:', e);
    return null;
  }
}
