// Constructores del SyncDataResult: ruta prefijada (planes nuevos) y legacy sin prefijo.
// Extraídos verbatim de drawingSync (des-monolitización 2026-10-06).
import { matManning } from '../constants';
import { loadFromStorage } from '../services/storageService';
import {
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys';
import { diamPulgFromLabel } from './diamPulgFromLabel';
import type {
  SyncPlanInput,
  TraceData,
  HidroDataEntry,
  RamalSyncObj,
  SyncDataResult,
} from './drawingSyncTypes';
// Constructores del SyncDataResult: ruta prefijada (planes nuevos) y legacy sin prefijo.
// Extraídos verbatim de drawingSync.

function collectAparatos(out: SyncDataResult) {
  const rawAparatos = loadFromStorage<Record<string, unknown>>(APARATOS_BY_TRAMO_KEY, {});
  out.aparatosByTramo = {};
  for (const [key, counts] of Object.entries(rawAparatos)) {
    if (!counts || typeof counts !== 'object') continue;
    out.aparatosByTramo[key] = counts;
  }
}

function inferNivelFromDrawing(data: TraceData): string {
  const all = [...(data.ramales || []), ...(data.bajantes || [])];
  for (const el of all) {
    if (el.piso) return el.piso;
  }
  return '0';
}

export function buildPrefixedSyncData(
  plans: SyncPlanInput[],
  families: Set<string>,
): SyncDataResult {
  const out: SyncDataResult = { planes: {}, updatedAt: Date.now() };
  if (!Array.isArray(plans)) return out;

  const rawHidro =
    loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {}) || {};

  for (const plan of plans) {
    if (!plan || plan.id === undefined) continue;
    const raw = loadFromStorage<TraceData | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data) as TraceData;
      } catch {
        continue;
      }
    }
    const nivel = String(plan.nivel ?? inferNivelFromDrawing(data));

    for (const family of families) {
      const ramales: unknown[] = [];
      for (const r of data.ramales || []) {
        if (r.net === family) {
          const rKey = family + '_' + r.id + '_' + plan.id;

          ramales.push({
            id: r.id,
            label: r.label || r.id,
            tipo: r.tipo,
            padre: r.padre || null,
            totalL: r.totalL || 0,
            ini: r.ini || '',
            fin: r.fin || '',
            diametro: r.diametro || '',
            diamPulg: diamPulgFromLabel(r.diametro),
            pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
            material: r.material || '',
            maning: matManning(r.material || ''),
            dz: parseFloat(r.dz ?? r.lvert ?? '0') || 0,
            piso: r.piso || nivel,
            _aparatosKey: rKey,
            _net: r.net || family,
            pts: r.pts || [],
            lvert: parseFloat(r.lvert ?? r.dz ?? '0') || 0,
            nSalidas: r.nSalidas || 0,
            descargaEnId: r.descargaEnId || null,
            accesorioInicio: r.accesorioInicio || '',
            accesorioFin: r.accesorioFin || '',
            diametroInicio: r.diametroInicio || '',
            diametroFin: r.diametroFin || '',
            aparatoInicio: r.aparatoInicio || '',
            aparatoFin: r.aparatoFin || '',
            yeeDobleAt: (r as { yeeDobleAt?: number[][] }).yeeDobleAt,
          });
        }
      }
      // Clave con planId: dos planos podían compartir nivel (o caer ambos al fallback '0'
      // sin confirmar) y el segundo SOBRESCRIBÍA al primero — sus ramales desaparecían de
      // las tablas. El nivel viaja en el valor; los lectores ya lo prefieren a la clave.
      const bajantes = (data.bajantes || [])
        .filter((b) => b.net === family)
        .map((b) => ({
          id: b.id,
          code: b.code || b.id,
          tipo: b.tipo,
          net: b.net,
          x: b.x,
          y: b.y,
          pisoBase: b.pisoBase,
          pisoCima: b.pisoCima,
        }));
      // Mantener el plano prefijado incluso con cero ramales cuando el piso aloja bajantes (p.
      // ej. un calentador anclado en el dibujo AF sin ramal AC dibujado aún) — buildTramos
      // genera el stub sintético AC-01-{calId} por plano prefijado, y sin él los fixtures del
      // calentador nunca llegan a las tablas de selección de calentador.
      if (ramales.length === 0 && bajantes.length === 0) continue;
      out.planes[`${family}_${nivel}_${plan.id}`] = {
        planoId: plan.id,
        planoName: plan.name || '',
        nivel,
        npt: plan.npt ?? parseInt(nivel),
        ramales,
        bajantes,
      };
    }
  }

  collectAparatos(out);

  out.hidroData = {};
  for (const [key, val] of Object.entries(rawHidro)) {
    out.hidroData[key] = val;
  }

  return out;
}

export function buildNonPrefixedSyncData(
  plans: SyncPlanInput[],
  families: Set<string>,
): SyncDataResult {
  const out: SyncDataResult = { planes: {}, updatedAt: Date.now() };
  if (!Array.isArray(plans)) return out;

  for (const plan of plans) {
    if (!plan || plan.id === undefined) continue;
    const raw = loadFromStorage<TraceData | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data) as TraceData;
      } catch {
        continue;
      }
    }
    const nivel = String(plan.nivel ?? inferNivelFromDrawing(data));

    const ramales: unknown[] = [];
    const bajantes: unknown[] = [];
    for (const r of data.ramales || []) {
      if (families.has(r.net)) {
        const rKey = r.net + '_' + r.id + '_' + plan.id;
        const ramalObj: RamalSyncObj = {
          id: r.id,
          label: r.label || r.id,
          tipo: r.tipo,
          padre: r.padre || null,
          totalL: r.totalL || 0,
          ini: r.ini || '',
          fin: r.fin || '',
          diametro: r.diametro || '',
          diamPulg: diamPulgFromLabel(r.diametro),
          pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
          material: r.material || '',
          maning: matManning(r.material || ''),
          piso: r.piso || nivel,
          _aparatosKey: rKey,
          _net: r.net,
          nSalidas: r.nSalidas || 0,
          descargaEnId: r.descargaEnId || null,
          aparatoInicio: r.aparatoInicio || '',
          aparatoFin: r.aparatoFin || '',
        };
        if (r.caudal !== undefined) ramalObj.caudal = r.caudal;
        if (r.accMed) ramalObj.accMed = r.accMed;
        const yeeRaw = (r as { yeeDobleAt?: number[][] }).yeeDobleAt;
        if (yeeRaw) ramalObj.yeeDobleAt = yeeRaw;
        ramales.push(ramalObj);
      }
    }
    for (const b of data.bajantes || []) {
      if (families.has(b.net)) {
        const bKey = b.net + '_' + b.id + '_' + plan.id;
        bajantes.push({
          id: b.id,
          code: b.code || b.id,
          tipo: b.tipo || 'bajante',
          dNominal: b.dNominal || '',
          diamPulg: diamPulgFromLabel(b.dNominal),
          hVert: b.hVert || 0,
          material: b.material || '',
          maning: matManning(b.material || ''),
          _aparatosKey: bKey,
          _net: b.net,
          recibeDeIds: b.recibeDeIds || [],
          descargaEnId: b.descargaEnId || null,
          area_m2: b.area_m2 || 0,
          pisoBase: b.pisoBase || '',
          pisoCima: b.pisoCima || '',
          nSalidas: b.nSalidas || 0,
          bajR: b.bajR ?? 7 / 24,
          bajDprop: b.bajDprop,
          ventDprop: b.ventDprop,
          bajLong: b.bajLong,
          bajFDarcy: b.bajFDarcy,
          aparato: b.aparato || '',
        });
      }
    }
    if (ramales.length === 0 && bajantes.length === 0) continue;
    out.planes[String(plan.id)] = {
      planoId: plan.id,
      planoName: plan.name || '',
      nivel: String(plan.nivel || ''),
      npt: plan.npt || 0,
      ramales,
      bajantes,
    };
  }

  collectAparatos(out);

  return out;
}

export const hasNumericPlanSuffix = (key: string): boolean => {
  const lastUnderscore = key.lastIndexOf('_');
  return lastUnderscore > 0 && /^\d+$/.test(key.slice(lastUnderscore + 1));
};

// Una clave aparato/hidro es huérfana solo si el ramal/bajante NO existe en NINGÚN plano
// legible: se conserva si algún key válido coincide exactamente (clave `net_id_planId` con su
// plan) o comparte el prefijo del elemento (`net_id`, o el mismo `net_id` en otro plan — un
// plan puede tener trazos locales desactualizados y re-sincronizarse después desde la BD).
export const isOrphanKey = (key: string, validKeys: Set<string>): boolean => {
  const base = hasNumericPlanSuffix(key) ? key.slice(0, key.lastIndexOf('_')) : key;
  for (const vk of validKeys) {
    if (vk === key || vk.startsWith(base + '_')) return false;
  }
  return true;
};
