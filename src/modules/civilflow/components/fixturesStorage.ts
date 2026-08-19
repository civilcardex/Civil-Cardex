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
    el.tipo === 'calentador'
  );
}
