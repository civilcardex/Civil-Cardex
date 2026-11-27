/**
 * Verificación del montante sp (standpipe, NFPA 14): diámetro mínimo de 4 pulgadas cuando el
 * montante está activo. Ej: sp.diam = 3" activo → "3 pulg" en NO CUMPLE.
 */
import { num } from '../hydraulics';
import type { ChecksCtx } from './helpers';
import { diamPulgFromLabel } from '../../../utils/diamInchesFromLabel.ts';
import { RCI_STANDPIPE_MIN } from '../tables.ts';

/** Diámetro del montante ≥ 4" (6" en sistema combinado salvo justificación hidráulica). */
export function verificarMontantesSp(ctx: ChecksCtx): void {
  const { st, R, add } = ctx;
  const spA = R.sp.activo;
  const minConfigurado = num(st.sp.diam) ?? RCI_STANDPIPE_MIN;
  const montante = diamPulgFromLabel(
    st.mont.dn && st.mont.dn !== 'auto' ? st.mont.dn : R.edif.dnM || '',
  );
  const minimo = spA ? Math.max(RCI_STANDPIPE_MIN, minConfigurado) : RCI_STANDPIPE_MIN;
  const invalido =
    (spA && minConfigurado < RCI_STANDPIPE_MIN) || (montante > 0 && montante < minimo);
  add(
    'Diámetro del montante ≥ 4"',
    invalido ? 'NO CUMPLE' : montante > 0 || !spA ? 'CUMPLE' : 'PENDIENTE',
    montante > 0
      ? `${montante} pulg · mínimo ${minimo} pulg`
      : spA
        ? `Mínimo ${minimo} pulg`
        : 'No aplica',
    'NFPA 14-2024',
    'Use montante de 4" como mínimo (6" en sistema combinado, salvo que se justifique con cálculo hidráulico).',
    ['entradas', minConfigurado < RCI_STANDPIPE_MIN ? 'sp.diam' : 'mont.dn'],
  );
}
