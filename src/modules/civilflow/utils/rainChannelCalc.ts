import { BORDE_LIBRE_CANAL_CM, chequeoCanalLluvia, chequeoEmbocaduraLluvia } from './calcRainwater';
import { cDeCubierta, nDeCanal } from '../constants/engineeringDataMaterials';

/**
 * C\u00e1lculo hidr\u00e1ulico de UNA fila de canal de lluvias (sin React: se puede probar sola).
 *
 * Reglas (ped. del usuario, no se tocan al mover el c\u00f3digo):
 *  - C SOLO del material de cubierta del cat\u00e1logo (sin material -> 0 -> Q=0 y "No cumple").
 *  - Sin material de canal NO hay manning: la fila no calcula ni chequea nada.
 *  - Secci\u00f3n total y A efectiva siempre visibles (no dependen del c\u00e1lculo).
 *  - Embocadura: n\u00ba = bajantes asociados, D = el menor propuesto (conservador).
 */

/** Una fila de canal tal como la entrega el contexto de lluvias. */
export interface FilaCanal {
  id?: string;
  materialCubierta?: string;
  materialCanal?: string;
  muroVertical?: number;
  bordeLibreCm?: number;
  b?: number;
  h?: number;
  areaAcumulada?: number;
  [k: string]: unknown;
}

export interface ResultadoFilaCanal {
  Cder: number;
  nder: number | null;
  Qreal: number;
  Qmax: number;
  yn: number;
  velocidad: number;
  chequeo: string;
  totalStr: string;
  aEfectivaSiempre: number;
  /** Di\u00e1metros (pulg) de los bajantes asociados al canal. */
  ds: number[];
  /** Chequeo de embocadura. */
  emb: { Hreq: number; chequeo: string };
  /** El c\u00e1lculo hidr\u00e1ulico completo (null si la fila no calcula). */
  calc: ReturnType<typeof chequeoCanalLluvia> | null;
}

/**
 * Calcula la fila de un canal de lluvias.
 * @param c - la fila del canal (del contexto de lluvias).
 * @param diamPulgPorChip - di\u00e1metro en pulgadas de cada bajante asociado (por chip).
 * @param canalBajantes - chips de bajantes asociados por id de canal dibujado.
 */
export function calcularFilaCanal(
  c: FilaCanal,
  diamPulgPorChip: Record<string, number>,
  canalBajantes: Record<string, string[]>,
): ResultadoFilaCanal {
  const Cder = cDeCubierta(c.materialCubierta ?? '') ?? 0;
  const matCanal = c.materialCanal ?? '';
  const nder = nDeCanal(matCanal);
  const calc =
    matCanal && nder != null
      ? chequeoCanalLluvia({
          ...(c as Record<string, unknown>),
          coeficienteC: Cder,
          manning: nder,
          muroVertical: c.muroVertical ?? 0,
          bordeLibreCm: c.bordeLibreCm ?? BORDE_LIBRE_CANAL_CM,
        })
      : null;
  const { Qreal, Qmax, yn, velocidad, chequeo } = calc ?? {
    Qreal: 0,
    Qmax: 0,
    yn: 0,
    velocidad: 0,
    chequeo: '',
  };
  const bH = c.b || 0;
  const totalStr =
    bH > 0 || (c.h || 0) > 0
      ? `${bH}x${(c.h || 0) + (c.bordeLibreCm ?? BORDE_LIBRE_CANAL_CM)}`
      : '—';
  const aEfectivaSiempre = (c.areaAcumulada || 0) + 0.5 * (c.muroVertical || 0);
  const items = c.drawId ? canalBajantes[c.drawId as string] || [] : [];
  const ds = items.map((ch) => diamPulgPorChip[ch] || 0).filter((x) => x > 0);
  const emb = calc
    ? chequeoEmbocaduraLluvia({
        Qreal,
        numBajantes: items.length,
        diamPulg: ds.length ? Math.min(...ds) : 0,
        hUtilM: (c.h || 0) / 100,
      })
    : { Hreq: 0, chequeo: '' };
  return {
    Cder,
    nder,
    Qreal,
    Qmax,
    yn,
    velocidad,
    chequeo,
    totalStr,
    aEfectivaSiempre,
    ds,
    emb,
    calc,
  };
}
