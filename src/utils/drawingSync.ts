import { matManning } from '../constants';
import { safeParse } from './parseUtils';
import {
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  HYDRO_SYNC_KEY,
  SAN_SYNC_KEY,
  HYDRO_FAMILIES,
  SAN_FAMILIES,
} from '../constants/storage-keys';
import { diamPulgFromLabel } from './diamPulgFromLabel';

function buildSyncData(plans: any[], families: Set<string>, prefix: string, storageKey: string) {
  const out: any = { planes: {}, updatedAt: Date.now() };
  if (!Array.isArray(plans)) return out;

  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (plan.nivel == null) continue;
    const nivel = plan.nivel;
    const raw = safeParse(localStorage.getItem(TRAZOS_PREFIX + plan.id), null);
    if (!raw) continue;
    const data = (typeof raw === 'string' ? safeParse(raw, {}) : raw) as Record<string, any>;

    if (prefix) {
      for (const family of families) {
        const ramales: any[] = [];
        for (const r of (data.ramales || [])) {
          if (r.net === family) {
            const rKey = family + '_' + r.id;
            ramales.push({
              id: r.id, label: r.label || r.id, tipo: r.tipo,
              padre: r.padre || null, totalL: r.totalL || 0,
              ini: r.ini || '', fin: r.fin || '',
              diametro: r.diametro || '', diamPulg: diamPulgFromLabel(r.diametro),
              pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
              material: r.material || '', maning: matManning(r.material),
              dz: parseFloat(r.dz) || 0,
              _aparatosKey: rKey,
            });
          }
        }
        const planoKey = family + '_' + nivel;
        if (ramales.length === 0) continue;
        out.planes[planoKey] = { planoId: plan.id, planoName: plan.name, ramales, bajantes: [] };
      }
    } else {
      const ramales: any[] = [];
      const bajantes: any[] = [];
      for (const r of (data.ramales || [])) {
        if (families.has(r.net)) {
          const rKey = r.net + '_' + r.id;
          ramales.push({
            id: r.id, label: r.label || r.id, tipo: r.tipo,
            padre: r.padre || null, totalL: r.totalL || 0,
            ini: r.ini || '', fin: r.fin || '',
            diametro: r.diametro || '', diamPulg: diamPulgFromLabel(r.diametro),
            pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
            material: r.material || '', maning: matManning(r.material),
            _aparatosKey: rKey, _net: r.net,
          });
        }
      }
      for (const b of (data.bajantes || [])) {
        if (families.has(b.net)) {
          const bKey = b.net + '_' + b.id;
          bajantes.push({
            id: b.id, code: b.code || b.id,
            dNominal: b.dNominal || '', diamPulg: diamPulgFromLabel(b.dNominal),
            hVert: b.hVert || 0, material: b.material || '',
            maning: matManning(b.material), _aparatosKey: bKey, _net: b.net,
          });
        }
      }
      if (ramales.length === 0 && bajantes.length === 0) continue;
      out.planes[nivel] = { planoId: plan.id, planoName: plan.name, ramales, bajantes };
    }
  }

  const rawAparatos = safeParse(localStorage.getItem(APARATOS_BY_TRAMO_KEY), {}) || {};
  out.aparatosByTramo = {};
  for (const [key, counts] of Object.entries(rawAparatos)) {
    if (!counts || typeof counts !== 'object') continue;
    const filtered: Record<string, number> = {};
    for (const [apId, n] of Object.entries(counts)) {
      const v = Number(n) || 0;
      if (v > 0) filtered[apId] = v;
    }
    if (Object.keys(filtered).length > 0) out.aparatosByTramo[key] = filtered;
  }

  if (prefix) {
    const rawHidro = safeParse(localStorage.getItem(HYDRO_DATA_STORAGE_KEY), {}) || {};
    out.hidroData = {};
    for (const [key, val] of Object.entries(rawHidro)) {
      out.hidroData[key] = val;
    }
  }

  return out;
}

export function writeHydroDrawingSync(plans: any[]) {
  try {
    const data = buildSyncData(plans, HYDRO_FAMILIES, 'h', HYDRO_SYNC_KEY);
    localStorage.setItem(HYDRO_SYNC_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    console.error('writeHydroDrawingSync error:', e);
    return null;
  }
}

export function readHydroDrawingSync() {
  return safeParse(localStorage.getItem(HYDRO_SYNC_KEY), { planes: {}, aparatosByTramo: {}, hidroData: {}, updatedAt: 0 }) as {
    planes: Record<string, any>;
    aparatosByTramo: Record<string, any>;
    hidroData: Record<string, any>;
    updatedAt: number;
  };
}

export function writeSanDrawingSync(plans: any[]) {
  try {
    const data = buildSyncData(plans, SAN_FAMILIES, '', SAN_SYNC_KEY);
    localStorage.setItem(SAN_SYNC_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    console.error('writeSanDrawingSync error:', e);
    return null;
  }
}

export function readSanDrawingSync() {
  return safeParse(localStorage.getItem(SAN_SYNC_KEY), { planes: {}, aparatosByTramo: {}, updatedAt: 0 }) as {
    planes: Record<string, any>;
    aparatosByTramo: Record<string, any>;
    updatedAt: number;
  };
}

export { HYDRO_SYNC_KEY, SAN_SYNC_KEY, APARATOS_BY_TRAMO_KEY } from '../constants/storage-keys';

export { HYDRO_DATA_STORAGE_KEY } from '../constants/storage-keys';
