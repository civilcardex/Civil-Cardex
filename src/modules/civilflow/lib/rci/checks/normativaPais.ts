/**
 * Verificación del código local del país: el código de normativa local debe estar registrado y,
 * si el país exige rociadores o montantes, el artículo correspondiente. Ej: código vacío →
 * "Sin código" en PENDIENTE.
 */
import { isSi } from '../hydraulics';
import type { ChecksCtx } from './helpers';

/** Exigencia del código local registrada (código + artículo si el país lo exige). */
export function verificarNormativaPais(ctx: ChecksCtx): void {
  const { st, add, cita } = ctx;
  const ls = st.local;
  const codOk =
    ls.codLocal && !(isSi(ls.exigeRoc) && !ls.refRoc) && !(isSi(ls.exigeSP) && !ls.refSP);
  add(
    'Exigencia del código local registrada',
    codOk ? 'CUMPLE' : 'PENDIENTE',
    ls.codLocal || 'Sin código',
    `Código local del país (${cita})`,
    codOk
      ? ''
      : 'Registre el código local y, si exige rociadores o montantes, el artículo correspondiente (precargados del perfil del país; editables).',
    ['entradas', 'local.codLocal'],
  );
}
