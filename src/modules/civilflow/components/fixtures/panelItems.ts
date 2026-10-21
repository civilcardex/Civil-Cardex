import { APARATOS_DEF, UD_BASE_INIT } from '../../constants';
import { esAplicable } from '../fixturesStorage.ts';

type ApUnitKey = 'qgas' | 'uc_ac' | 'uc_af' | 'ud';

/** Un aparato del catálogo con su override de la red aplicado. */
export type AparatoItem = (typeof APARATOS_DEF)[number] & { [k: string]: unknown };

/** El override de la red aplicada (lo que el usuario fijó en el panel de aparatos). */
export type ApsItem = { id: string; ud?: number; ucaf?: number; ucac?: number };

/**
 * Lista los aparatos de una red con su valor propio o el override aplicado por el usuario.
 * Ej: san/ud devuelve los aparatos ordenados por UD_BASE_INIT (Unidades de Descarga base).
 * @param netId - red: 'san' | 'll' | 'af' | 'ac' | 'gas'.
 * @param unitKey - unidad de la tabla: 'ud' | 'uc_af' | 'uc_ac'.
 * @param aps - overrides de la red aplicada.
 */
export function itemsDelPanel(
  netId: string,
  unitKey: ApUnitKey | null,
  aps: ApsItem[],
): AparatoItem[] {
  if (!unitKey) return [];
  const filtered = APARATOS_DEF.filter((ap) => esAplicable(ap, netId, unitKey));
  const APS_FIELD: Record<string, 'ud' | 'ucaf' | 'ucac'> = {
    ud: 'ud',
    uc_af: 'ucaf',
    uc_ac: 'ucac',
  };
  const apsField = APS_FIELD[unitKey] || null;
  // Índice por id: el override se busca UNA vez por aparato (antes: un `find` por aparato
  // sobre la lista de overrides -> O(n²) con muchas redes aplicadas).
  const porId = new Map(aps.map((p) => [p.id, p]));
  let result = filtered;
  if (apsField && unitKey) {
    result = filtered.map((ap) => {
      const fromAps = porId.get(ap.id);
      const valor = (ap as unknown as Record<string, unknown>)[unitKey];
      return fromAps ? ({ ...ap, [unitKey]: fromAps[apsField] || valor } as AparatoItem) : ap;
    });
  }
  if (unitKey === 'ud') {
    const order = UD_BASE_INIT.map((d) => d.id);
    const posicion = new Map(order.map((id, i) => [id, i]));
    return [...result].sort((a, b) => (posicion.get(a.id) ?? 999) - (posicion.get(b.id) ?? 999));
  }
  return [...result].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
}
