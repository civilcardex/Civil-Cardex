/**
 * Verificación del montante sp (standpipe, NFPA 14): diámetro mínimo de 4 pulgadas cuando el
 * montante está activo. Ej: sp.diam = 3" activo → "3 pulg" en NO CUMPLE.
 */
import { num } from '../hydraulics';
import type { ChecksCtx } from './helpers';

/** Diámetro del montante ≥ 4" (6" en sistema combinado salvo justificación hidráulica). */
export function verificarMontantesSp(ctx: ChecksCtx): void {
  const { st, R, add } = ctx;
  const spA = R.sp.activo;
  add(
    'Diámetro del montante ≥ 4"',
    !spA ? 'CUMPLE' : (num(st.sp.diam) || 0) >= 4 ? 'CUMPLE' : 'NO CUMPLE',
    spA ? `${st.sp.diam} pulg` : 'No aplica',
    'NFPA 14-2024',
    'Use montante de 4" como mínimo (6" en sistema combinado, salvo que se justifique con cálculo hidráulico).',
    ['entradas', 'sp.diam'],
  );
}
