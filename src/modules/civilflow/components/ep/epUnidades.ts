/** Unidades de PRESENTACIÓN del EPC (Equipo de Presión): m.c.a. (columna de agua), bar, psi
 *  y kPa. Solo convierten lo que se VE — el motor (epEngine) y el guardado (EPData/BD) siguen
 *  SIEMPRE en m.c.a., así que cambiar de unidad nunca mueve un valor de diseño.
 *  Factores del HTML de referencia: 1 m.c.a. = 0,0980665 bar = 1,42197 psi = 9,80665 kPa.
 *  Ej: fmtUn(51, 'bar') → '5.00' (51 m.c.a. ≈ 5 bar). */
export type EpUn = 'mca' | 'bar' | 'psi' | 'kpa';

/** Factor de conversión desde m.c.a. + sufijo + decimales por unidad de presión. Ej: EP_UNI.bar.f = 0.0980665 → 51 m.c.a. ≈ 5 bar. */
export const EP_UNI: Record<EpUn, { f: number; s: string; d: number }> = {
  mca: { f: 1, s: 'm.c.a.', d: 1 },
  bar: { f: 0.0980665, s: 'bar', d: 2 },
  psi: { f: 1.42197, s: 'psi', d: 1 },
  kpa: { f: 9.80665, s: 'kPa', d: 0 },
};

/** Orden de las unidades en el selector de presión del módulo ep (Equipo de Presión). */
export const EP_UNIDADES: EpUn[] = ['mca', 'bar', 'psi', 'kpa'];

/** Campos de EPData que son PRESIÓN en m.c.a. y participan de la conversión (los data-p="1"
 *  del HTML de referencia). Quedan fuera los caudales (L/s), cotas (m), altitud/temp y el
 *  NPSH (que el HTML de referencia deja fijo en m.c.a.). */
const CAMPOS_PRESION: ReadonlySet<string> = new Set([
  'hfac',
  'hfacs',
  'hfotros',
  'pred',
  'hfcis',
  'pmin',
  'pmax',
  'poffmax',
  'margen',
  'dif',
]);

/** ¿El campo de EPData se convierte al cambiar la unidad? Ej: esCampoPresion('pmin') → true. */
export function esCampoPresion(field: string): boolean {
  return CAMPOS_PRESION.has(field);
}

/** m.c.a. → unidad activa (número). Ej: aUnidad(51, 'bar') ≈ 5.00. */
export function aUnidad(vMca: number, un: EpUn): number {
  return vMca * EP_UNI[un].f;
}

/** Unidad activa → m.c.a. (para commitear un input). Ej: aMca(5, 'bar') ≈ 50.98. */
export function aMca(vUn: number, un: EpUn): number {
  return vUn / EP_UNI[un].f;
}

/** Valor en m.c.a. formateado en la unidad activa ('—' si no es finito). Ej:
 *  fmtUn(51, 'bar') → '5.00' · fmtUn(51, 'kpa') → '500' · fmtUn(2.5, 'mca') → '2.5'. */
export function fmtUn(vMca: number | null | undefined, un: EpUn, dec?: number): string {
  if (vMca == null || !isFinite(vMca)) return '—';
  return (vMca * EP_UNI[un].f).toFixed(dec ?? EP_UNI[un].d);
}

/** Etiqueta de la unidad activa. Ej: unS('kpa') → 'kPa'. */
export function unS(un: EpUn): string {
  return EP_UNI[un].s;
}
