/**
 * Criterios de diseño de rociadores (NFPA 13-2025) y zona sísmica efectiva. Ej: con riesgo
 * leve, QR (cabeza de Respuesta Rápida) y techo de 5.30 m, el área baja de 1500 a 1066 ft².
 */
import { HZ } from './tables';
import { ceilE, isSi, num } from './hydraulics';
import type { Criterios, RciClas, RciRoc } from './types';

/** Área de diseño, rociadores requeridos y presión del rociador más remoto para una
 *  clasificación (riesgo, sistema, QR, techo…) y una geometría (K, Pmin, S, L en m). */
export function criterios(
  c: Pick<RciClas, 'riesgo' | 'sistema' | 'htecho' | 'qr' | 'constr' | 'techoIncl' | 'ocultoComb'>,
  ro: Pick<RciRoc, 'K' | 'Pmin' | 'S' | 'L'>,
): Criterios {
  const hz = HZ[c.riesgo] || HZ['Riesgo leve'];
  const K = num(ro.K) || 5.6,
    Pmin = num(ro.Pmin) || 7,
    S = num(ro.S) || 0,
    L = num(ro.L) || 0;
  const HtFt = (num(c.htecho) || 0) * 3.28084;
  const FSeco = c.sistema === 'Seco' ? 1.3 : 1;
  const RedQR =
    isSi(c.qr) && c.sistema === 'Húmedo' && hz.qr && HtFt <= 20
      ? HtFt <= 10
        ? 0.4
        : (55 - 1.5 * HtFt) / 100
      : 0;
  let Adis = RedQR > 0 ? Math.max(hz.a * (1 - RedQR), 768) : hz.a * FSeco;
  Adis *= isSi(c.techoIncl) ? 1.3 : 1;
  if (isSi(c.ocultoComb)) Adis = Math.max(Adis, 3000);
  const Llargo = (1.2 * Math.sqrt(Adis)) / 3.28084;
  const Acmax =
    c.constr === 'Combustible obstruida'
      ? hz.cco
      : c.constr === 'Combustible, elementos < 0,91 m'
        ? Math.min(hz.cnc, 130)
        : hz.cnc;
  const Areal = S > 0 && L > 0 ? (S * L) / 0.092903 : 0;
  const Nreq = Areal > 0 ? ceilE(Adis / Areal) : 0;
  const Nramal = S > 0 ? ceilE(Llargo / S) : 0;
  const Q1 = hz.d * Areal;
  const Prem = Math.max(Pmin, Math.pow(Q1 / K, 2));
  const Acorto = (Adis * 0.092903) / Llargo;
  const Nramales = Nramal > 0 ? ceilE(Nreq / Nramal) : 0;
  return {
    hz,
    K,
    Pmin,
    S,
    L,
    HtFt,
    FSeco,
    RedQR,
    Adis,
    Llargo,
    Acorto,
    Acmax,
    Areal,
    Nreq,
    Nramal,
    Nramales,
    Nultimo: Nreq - (Nramales - 1) * Nramal,
    Q1,
    Prem,
    Qteo: hz.d * Adis,
    Qmang: hz.hose,
    dmin: hz.dmin,
    dmax: hz.dmax,
  };
}

/** Zona de amenaza sísmica efectiva: la elegida, o con el perfil Colombia la que resulta de Aa
 *  y Av (NSR-10, apéndice A-4): baja si el mayor de Aa y Av es ≤ 0,10; intermedia si es ≤ 0,20;
 *  alta si es mayor. Ej: Aa 0.15 / Av 0.20 → "Intermedia". */
export function zonaSis(st: {
  meta?: { pais?: string };
  local?: { zonaSis?: string; parSismo?: string };
}): { z: string; auto: boolean; a?: number } {
  const ls = st.local || {},
    z = ls.zonaSis || '';
  if (z) return { z, auto: false };
  if ((st.meta || {}).pais !== 'Colombia') return { z: '', auto: false };
  const vs = (String(ls.parSismo || '').match(/\d+(?:[.,]\d+)?/g) || [])
    .map((v) => parseFloat(v.replace(',', '.')))
    .filter((v) => v > 0 && v < 1);
  if (!vs.length) return { z: '', auto: false };
  const a = Math.max(...vs);
  return { z: a <= 0.1 + 1e-9 ? 'Baja' : a <= 0.2 + 1e-9 ? 'Intermedia' : 'Alta', auto: true, a };
}
