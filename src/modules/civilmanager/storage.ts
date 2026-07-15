import { devError } from '../../utils/devError';
import {
  CARGOS_DEFAULTS,
  CATEGORIAS_APU,
  CATEGORIAS_INSUMO,
  COMENTARIOS_APU_DEFAULTS,
  ORIGENES,
  PREST_DEFAULTS,
  TIPO_EQUIPO,
  TRANSP_UNIDADES,
  UNIDADES,
  cargoCodigoDefault,
  perfilesPaisDefault,
} from './seedData';
import type { CivilManagerState } from './types';

const DB_NAME = 'CivilManagerDB';
const STORE_NAME = 'state';
const DB_VERSION = 1;
const RECORD_KEY = 'civilmanager';
const SCHEMA_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'k' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = null; reject(request.error); };
    request.onblocked = () => { dbPromise = null; reject(new Error('IndexedDB blocked')); };
  });
  return dbPromise;
}

export function defaultState(): CivilManagerState {
  return {
    schemaVersion: SCHEMA_VERSION,
    factoresPrestaciones: PREST_DEFAULTS.map(p => ({ ...p, id: crypto.randomUUID() })),
    cargos: CARGOS_DEFAULTS.map((c, i) => ({ ...c, id: crypto.randomUUID(), codigo: cargoCodigoDefault(i) })),
    cuadrillas: [],
    equipos: [],
    insumos: [],
    apus: [],
    presupuestos: [],
    proveedores: [],
    categorias_apu: CATEGORIAS_APU.map(c => ({ ...c })),
    config_listas: {
      unidades: UNIDADES.slice(),
      categorias_insumo: CATEGORIAS_INSUMO.slice(),
      categorias_apu: CATEGORIAS_APU.map(c => ({ codigo: c.codigo, categoria: c.categoria, desc: c.desc })),
      tipos_equipo: TIPO_EQUIPO.slice(),
      origenes: ORIGENES.slice(),
      unidades_transporte: TRANSP_UNIDADES.slice(),
      perfiles_pais: perfilesPaisDefault(),
      tipos_unidad: [],
    },
    config: {
      pais: 'CO',
      moneda: 'COP',
      salario_base: 1750905,
      auxilio_transporte: 147674,
      ibc_tope: 25,
      pct_administracion: 10,
      pct_imprevistos: 3,
      pct_utilidad: 6,
      herr_pct: 5,
      dias_mes: 25,
      horas_mes: 182,
      unidad: 'mes',
      vr_resumido: false,
      usar_en_cada_apu: true,
      usar_fp_en_apu: false,
      comentarios_apu: { ...COMENTARIOS_APU_DEFAULTS },
    },
  };
}

/** Normaliza datos parcialmente cargados (ej. una versión anterior del schema) rellenando defaults. Reemplaza el sistema de ~40 migraciones ad-hoc del prototipo. */
export function migrateState(raw: Partial<CivilManagerState> | null | undefined): CivilManagerState {
  const base = defaultState();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    factoresPrestaciones: raw.factoresPrestaciones?.length ? raw.factoresPrestaciones : base.factoresPrestaciones,
    cargos: raw.cargos?.length ? raw.cargos : base.cargos,
    categorias_apu: raw.categorias_apu?.length ? raw.categorias_apu : base.categorias_apu,
    config_listas: { ...base.config_listas, ...(raw.config_listas || {}) },
    config: { ...base.config, ...(raw.config || {}), comentarios_apu: { ...base.config.comentarios_apu, ...(raw.config?.comentarios_apu || {}) } },
  };
}

export async function civilManagerLoad(): Promise<CivilManagerState | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      req.onsuccess = () => {
        const record = req.result as { k: string; d: Partial<CivilManagerState> } | undefined;
        resolve(record ? migrateState(record.d) : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    devError('civilManagerStorage load:', e);
    return null;
  }
}

export async function civilManagerSave(state: CivilManagerState): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ k: RECORD_KEY, d: state });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    devError('civilManagerStorage save:', e);
  }
}
