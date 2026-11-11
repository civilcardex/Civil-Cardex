/**
 * Verificación del arriostramiento antisísmico (NFPA 13 cap. 18 + norma local): si el país
 * exige sismo, deben estar la norma local, el parámetro de referencia y la zona de amenaza.
 * Ej: falta el parámetro → "Falta el parámetro sísmico de referencia" en PENDIENTE.
 */
import { zonaSis } from '../criteria';
import { isSi } from '../hydraulics';
import type { ChecksCtx } from './helpers';

/** Arriostramiento antisísmico: datos sísmicos completos cuando el requisito está activo. */
export function verificarSismo(ctx: ChecksCtx): void {
  const { st, add } = ctx;
  const ls = st.local;
  {
    const zs = zonaSis(st),
      falta: [string, string][] = [];
    if (isSi(ls.reqSismo)) {
      if (!ls.normSis) falta.push(['la norma sísmica local', 'local.normSis']);
      if (!ls.parSismo) falta.push(['el parámetro sísmico de referencia', 'local.parSismo']);
      if (!zs.z) falta.push(['la zona de amenaza sísmica', 'local.zonaSis']);
    }
    const sis = !isSi(ls.reqSismo) ? 'CUMPLE' : falta.length ? 'PENDIENTE' : 'CUMPLE';
    add(
      'Arriostramiento antisísmico',
      sis,
      !isSi(ls.reqSismo)
        ? 'No requerido'
        : falta.length
          ? `Falta ${falta.map((x) => x[0]).join(', ')}`
          : `Zona ${zs.z.toLowerCase()}${zs.auto ? ' (según NSR-10)' : ''} · ${ls.normSis} · ${ls.parSismo}: ubicación en Soportes sísmicos`,
      'NFPA 13-2025 cap. 18 + norma local',
      `Complete ${falta.map((x) => x[0]).join(', ')} en Entradas → Normativa local.`,
      falta.length ? ['entradas', falta[0][1]] : ['sismo'],
    );
  }
}
