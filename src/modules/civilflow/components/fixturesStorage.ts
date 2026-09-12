import { NETS } from '../lib/PlanoEngine/PlanoState';
import { APARATOS_DEF, UD_BASE_INIT, AF_UC_IDS, AC_UC_IDS } from '../constants';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import {
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys';

export const GAS_ID = 'gas';

export const UNIDAD = {
  uc: 'UC',
  ud: 'UD',
  qgas: 'm³/h',
};

export const SAN_UD_IDS = new Set(UD_BASE_INIT.map((d) => d.id));

export type CountsMap = Record<string, Record<string, number>>;
export interface HidroDataEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}
export type HidroDataMap = Record<string, HidroDataEntry>;
export type GasAccMap = Record<string, Record<string, number>>;

export function loadAll(): CountsMap {
  return loadFromStorage(APARATOS_BY_TRAMO_KEY, {}) as CountsMap;
}

export function saveAll(map: CountsMap) {
  saveToStorage(APARATOS_BY_TRAMO_KEY, map);
}

export function loadHidroData(): HidroDataMap {
  return loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
}

export function saveHidroData(map: HidroDataMap) {
  saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
}

export function loadGasAcc(): GasAccMap {
  const raw = loadFromStorage<GasAccMap>(GAS_ACC_KEY, {});
  const next: GasAccMap = { ...raw };
  for (const [tramoId, map] of Object.entries(next)) {
    if (!map || typeof map !== 'object') continue;
    const vals = Object.values(map).filter((v) => typeof v === 'number');
    if (vals.length === 0 || vals.every((v) => v <= 0)) {
      delete next[tramoId];
    }
  }
  return next;
}

export function saveGasAcc(map: GasAccMap) {
  saveToStorage(GAS_ACC_KEY, map);
}

export type ApUnitKey = 'qgas' | 'uc_ac' | 'uc_af' | 'ud';

export function unitFor(netId: string): ApUnitKey | null {
  const net = NETS.find((n) => n.id === netId);
  if (!net) return null;
  if (netId === GAS_ID) return 'qgas';
  if (net.ucType === 'uc') return netId === 'ac' ? 'uc_ac' : 'uc_af';
  if (net.ucType === 'ud') return 'ud';
  return null;
}

export function esAplicable(
  ap: (typeof APARATOS_DEF)[number],
  netId: string,
  unitKey: ApUnitKey | null,
) {
  if (netId === GAS_ID) return ap.grupo === 'g' && (ap.qgas || 0) > 0;
  if (unitKey === 'ud') return SAN_UD_IDS.has(ap.id);
  if (unitKey === 'uc_af') return AF_UC_IDS.includes(ap.id);
  if (unitKey === 'uc_ac') return AC_UC_IDS.includes(ap.id);
  return false;
}

export interface SelectableTarget {
  id?: string;
  tipo?: string;
  label?: string;
  code?: string;
  mergesFrom?: [string, string];
  net?: string;
  pts?: number[][];
  _tribReversed?: boolean;
}

export function isCountableTarget(el: SelectableTarget | null): boolean {
  if (!el) return false;
  return (
    el.id?.startsWith('R') ||
    el.id?.startsWith('B') ||
    el.id?.startsWith('T') ||
    // Cajas CAN/CALL (aguas negras/lluvias): panel de UDs en modo solo lectura.
    el.tipo === 'caja_san' ||
    el.tipo === 'caja_ll' ||
    // Ldesvio entre pisos: espejo de las UDs del bajante (seleccionable pero de solo lectura).
    el.id?.startsWith('LD_') ||
    el.tipo === 'calentador'
  );
}

interface BajanteLikeSalida {
  id: string;
  code?: string;
  net: string;
  x: number;
  y: number;
  _circ?: { r?: number };
  recibeDeIds?: string[];
  alimentaIds?: string[];
}
interface RamalLikeSalida {
  id: string;
  net?: string;
  tipo?: string;
  pts?: number[][];
  _tribReversed?: boolean;
  ini?: string;
}

/** JSON con claves ordenadas (comparar mapas sin falsos positivos por orden de inserción).
 *  Se usa para recargar estado solo si el contenido cambió y no entrar en loop sync→reload. */
export function stableStringify(m: unknown): string {
  return JSON.stringify(m, (_k, v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v as unknown;
    const o = v as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) sorted[k] = o[k];
    return sorted;
  });
}
/** Suma por aparato del libro de herencia cross-floor (`ucAplicado`) de un bajante — lo
 *  mismo que muestra el panel del bajante asociado (currentMap suma este libro). Vacío si no
 *  hay libro. */
export function libroHeredadoSumado(baj: {
  ucAplicado?: Record<string, Record<string, number>>;
}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of Object.values(baj.ucAplicado || {}))
    for (const [k, v] of Object.entries(m)) out[k] = (out[k] || 0) + (v as number);
  return out;
}

/** Valor a espejar en los ramales de SALIDA de un bajante: EXACTAMENTE lo que muestra su
 *  panel — libro de herencia si lo hay (bajante asociado entre pisos), si no el agregado
 *  del árbol. null = nada que copiar (vacío). Antes el espejo usaba solo el árbol y la
 *  salida quedaba en 0 con el bajante lleno por herencia (orig. usuario). */
export function aggParaEspejoSalida(
  treeAgg: Record<string, number>,
  libro: Record<string, number>,
): Record<string, number> | null {
  const agg = Object.keys(libro).length ? libro : treeAgg;
  return Object.keys(agg).length ? { ...agg } : null;
}

/** Ids de los ramales que SALEN (nacen) del bajante/caja dado. Salida = extremo de nacimiento
 *  en el elemento y el otro extremo lejos, o referencia explícita (alimentaIds / r.ini = código).
 *  La referencia explícita manda: un ramal de salida con `_tribReversed` invertía la geometría
 *  cola/cabeza y dejaba de detectarse — el agregado del bajante volvía a caminar su subárbol y
 *  re-fusionaba las UDs en su propia clave de salida (crecían en cada pasada, orig. usuario:
 *  "la caja AN duplica las UDs del ramal de salida"). */
export function idsSalidasDeBajante(
  baj: BajanteLikeSalida,
  ramales: RamalLikeSalida[],
  zoom: number,
): Set<string> {
  const out = new Set<string>();
  const tol = (baj._circ?.r || 8 * (zoom || 1)) / (zoom || 1) + 1;
  const code = baj.code || baj.id;
  for (const r of ramales) {
    if (r.tipo === 'tributario' || (r.net ?? '') !== baj.net) continue;
    // Referencia explícita: nace en este elemento — salida sin ambigüedad geométrica.
    if ((baj.alimentaIds || []).includes(r.id) || (r.ini && r.ini === code)) {
      out.add(r.id);
      continue;
    }
    if (!r.pts || r.pts.length < 2) continue;
    const t = r._tribReversed ? r.pts[r.pts.length - 1] : r.pts[0];
    const h = r._tribReversed ? r.pts[0] : r.pts[r.pts.length - 1];
    const tailAt = Math.hypot(t[0] - baj.x, t[1] - baj.y) < tol;
    const headAt = Math.hypot(h[0] - baj.x, h[1] - baj.y) < tol;
    if (tailAt && !headAt) {
      out.add(r.id);
      continue;
    }
    // Caso ambiguo (AMBOS extremos dentro de la tolerancia — p.ej. cajas, cuyo _circ es la
    // semidiagonal del cuadro y se traga ramales cortos): decide la DIRECCIÓN DE FLUJO —
    // es salida si el extremo de DESCARGA está lejos del elemento.
    if (tailAt && headAt) {
      const hDist = Math.hypot(h[0] - baj.x, h[1] - baj.y);
      const tDist = Math.hypot(t[0] - baj.x, t[1] - baj.y);
      if (hDist > tDist) out.add(r.id);
    }
  }
  return out;
}
