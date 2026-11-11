/**
 * Verificaciones de almacenamiento (NFPA 13 cap. 20-25): el riesgo admite almacenamiento y la
 * altura de arrume queda dentro del alcance del aplicativo. Ej: Riesgo leve con almacenamiento
 * → "Riesgo leve / almacenamiento: Sí" en NO CUMPLE.
 */
import { fmtEs as f1 } from '../fmtEs.ts';
import { isSi, num } from '../hydraulics';
import type { ChecksCtx } from './helpers';

/** Riesgo NFPA 13 compatible con almacenamiento + altura de arrume ≤ 3,66 m. */
export function verificarAlmacenamiento(ctx: ChecksCtx): void {
  const { st, add, addT } = ctx;
  const c = st.clas;
  const almacen = isSi(c.almacen);
  const arr = num(c.arrumeH);
  addT(
    'Riesgo NFPA 13 compatible con almacenamiento',
    'NFPA 13-2025 cap. 4',
    ['entradas', 'clas.riesgo'],
    (t) => ({
      st: almacen && t.riesgo === 'Riesgo leve' ? 'NO CUMPLE' : 'CUMPLE',
      val: `${t.riesgo} / almacenamiento: ${c.almacen}`,
      guide:
        'Con almacenamiento no se admite Riesgo leve. Cambie la clasificación a Riesgo ordinario G2 como mínimo (arrume ≤ 3,66 m); si el arrume es mayor, diseñe con NFPA 13 cap. 20–25.',
    }),
  );
  add(
    'Altura de arrume dentro del alcance (≤ 3,66 m)',
    !almacen ? 'CUMPLE' : arr === null ? 'PENDIENTE' : arr > 3.66 ? 'NO CUMPLE' : 'CUMPLE',
    !almacen ? 'Sin almacenamiento' : arr === null ? 'Sin dato' : `${f1(arr)} m`,
    'NFPA 13-2025 cap. 20–25',
    arr === null
      ? 'Ingrese la altura máxima de arrume. Es obligatoria cuando hay almacenamiento.'
      : 'Arrume > 3,66 m: el diseño debe hacerse con NFPA 13 cap. 20–25 (CMDA, CMSA o ESFR). Este aplicativo no cubre ese caso.',
    ['entradas', 'clas.arrumeH'],
  );
}
