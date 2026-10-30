// Derivaciones PURAS del selector de aparato a mitad de ramal (extraídas de
// midRamalAccessorySelector para poder testearlas sin motor ni menú abierto).
// af/ac/gas guardan el aparato en aparatoInicio/Fin del ramal; san/ll en el libro de
// conteos de fixtures (clave `san_<id>_<planId>`).
import { AF_UC_IDS, AC_UC_IDS, APARATOS_DEF } from '../../../constants/engineeringDataFixtures.ts';
import { UD_BASE_INIT } from '../../../constants';
import { esAplicable } from '../../fixturesStorage.ts';

/** Ids de aparatos ofrecidos según la red (af/ac: UCs de presión; san: aplicables en orden
 *  UD; gas/ll: grupo 'g').
 *  Ej: 'af' → los ids de AF_UC_IDS en su orden de catálogo. */
export function aparatoIdsDeRed(net: string): string[] {
  if (net === 'af') return AF_UC_IDS;
  if (net === 'ac') return AC_UC_IDS;
  if (net === 'san') {
    const filtered = APARATOS_DEF.filter((ap) => esAplicable(ap, 'san', 'ud'));
    // Orden del libro de UDs (UD_BASE_INIT): mismo orden que muestra el panel derecho.
    // Default -1 = mismo efecto que el indexOf que reemplaza (ids fuera del libro al final).
    const pos = new Map<string, number>(UD_BASE_INIT.map((d, i): [string, number] => [d.id, i]));
    return filtered.sort((a, b) => (pos.get(a.id) ?? -1) - (pos.get(b.id) ?? -1)).map((a) => a.id);
  }
  return APARATOS_DEF.filter((a) => a.grupo === 'g').map((a) => a.id);
}

/** Extremo del ramal más cercano al clic: 'aparatoInicio' (p0) o 'aparatoFin' (último punto).
 *  Ej: clic a 10 px de p0 y 500 de pN → 'aparatoInicio'. */
export function extremoPorClic(
  pts: number[][] | undefined,
  x: number,
  y: number,
): 'aparatoInicio' | 'aparatoFin' {
  const dStart = pts && pts.length > 0 ? Math.hypot(pts[0][0] - x, pts[0][1] - y) : Infinity;
  const dEnd =
    pts && pts.length > 1
      ? Math.hypot(pts[pts.length - 1][0] - x, pts[pts.length - 1][1] - y)
      : Infinity;
  return dStart <= dEnd ? 'aparatoInicio' : 'aparatoFin';
}

/** Primer aparato del libro de conteos con cantidad > 0 (el que muestra el desplegable
 *  en san/ll, donde el aparato vive en el conteo de fixtures y no en campos del ramal). */
export function aparatoConConteo(curMap: Record<string, number>): string {
  return Object.keys(curMap).find((k) => (curMap[k] || 0) > 0) || '';
}

/** Asignados visibles san/ll desde el libro de conteos: solo ids con cantidad > 0
 *  (los aparatos COEXISTEN — sifón + inodoro son dos tarjetas, orig. usuario). */
export function asignadosDeConteos(
  aparatoIds: readonly string[],
  curMap: Record<string, number>,
): Array<{ id: string; n: number }> {
  return aparatoIds.filter((id) => (curMap[id] || 0) > 0).map((id) => ({ id, n: curMap[id] }));
}

/** Asignados visibles af/ac/gas: los campos aparatoInicio/Fin del MOTOR VIVO tienen
 *  prioridad sobre el snapshot (llega rancio si el aparato se asignó desde el panel). */
export function asignadosDeCampos(
  snapshot: { aparatoInicio?: string | null; aparatoFin?: string | null },
  vivo: { aparatoInicio?: string | null; aparatoFin?: string | null } | null | undefined,
): Array<{ id: string; n: number }> {
  const f0 = String(vivo?.aparatoInicio ?? (snapshot.aparatoInicio || ''));
  const f1 = String(vivo?.aparatoFin ?? (snapshot.aparatoFin || ''));
  return Array.from(new Set([f0, f1].filter(Boolean))).map((id) => ({ id, n: 1 }));
}

/** El aparato del extremo clicado; cae al otro extremo si el asignado vive allí.
 *  Ej: campo aparatoInicio vacío y aparatoFin='duc' con clic en inicio → 'duc'. */
export function preferirExtremo(
  fieldApp: 'aparatoInicio' | 'aparatoFin',
  appI: string,
  appF: string,
): string {
  return (fieldApp === 'aparatoInicio' ? appI || appF : appF || appI) || '';
}
