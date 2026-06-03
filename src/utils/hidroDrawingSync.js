import { matManning } from '../components/constants';

const SYNC_KEY = 'civilflow_dibujo_hidro_v1';
const TRAZOS_PREFIX = 'civilflow_trazos_';
const APARATOS_BY_TRAMO_KEY = 'civilflow_aparatos_by_tramo_v2';
const HIDRO_DATA_KEY = 'civilflow_tramo_hidro_data_v3';

const HIDRO_FAMILIES = new Set(['af', 'ac']);

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (_) { return fallback; }
}

function diamPulgFromLabel(d) {
  if (!d) return 0;
  const m = String(d).match(/(\d+)\s*[\u2013\u2014\/-]\s*(\d+)/);
  if (m) return parseFloat(m[1]) + parseFloat(m[2]) / (Math.pow(2, Math.min(m[2].length, 3)));
  const s = String(d).match(/(\d+(?:\.\d+)?)/);
  return s ? parseFloat(s[1]) : 0;
}

function buildSync(planos) {
  const out = { planes: {}, updatedAt: Date.now() };
  if (!Array.isArray(planos)) return out;

  for (const plano of planos) {
    if (!plano || plano.status !== 'confirmed') continue;
    if (plano.nivel == null) continue;
    const nivel = plano.nivel;
    const raw = safeParse(localStorage.getItem(TRAZOS_PREFIX + plano.id), null);
    if (!raw) continue;
    const data = typeof raw === 'string' ? safeParse(raw, {}) : raw;

    for (const family of ['af', 'ac']) {
      const ramales = [];
      const bajantes = [];
      for (const r of (data.ramales || [])) {
        if (r.net === family) {
          const rKey = family + '_' + r.id;
          ramales.push({
            id: r.id, label: r.label || r.id, tipo: r.tipo,
            padre: r.padre || null, totalL: r.totalL || 0,
            diametro: r.diametro || '', diamPulg: diamPulgFromLabel(r.diametro),
            pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
            material: r.material || '', maning: matManning(r.material),
            _aparatosKey: rKey,
          });
        }
      }
      const planoKey = `${family}_${nivel}`;
      if (ramales.length === 0) continue;
      out.planes[planoKey] = { planoId: plano.id, planoName: plano.name, ramales, bajantes };
    }
  }

  const rawAparatos = safeParse(localStorage.getItem(APARATOS_BY_TRAMO_KEY), {}) || {};
  const rawHidro = safeParse(localStorage.getItem(HIDRO_DATA_KEY), {}) || {};
  out.aparatosByTramo = {};
  out.hidroData = {};
  for (const [key, counts] of Object.entries(rawAparatos)) {
    if (!counts || typeof counts !== 'object') continue;
    const filtered = {};
    for (const [apId, n] of Object.entries(counts)) {
      const v = Number(n) || 0;
      if (v > 0) filtered[apId] = v;
    }
    if (Object.keys(filtered).length > 0) out.aparatosByTramo[key] = filtered;
  }
  for (const [key, val] of Object.entries(rawHidro)) {
    out.hidroData[key] = val;
  }

  return out;
}

export function writeHidroDrawingSync(planos) {
  try {
    const data = buildSync(planos);
    localStorage.setItem(SYNC_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    console.error('writeHidroDrawingSync error:', e);
    return null;
  }
}

export function readHidroDrawingSync() {
  return safeParse(localStorage.getItem(SYNC_KEY), { planes: {}, aparatosByTramo: {}, hidroData: {}, updatedAt: 0 });
}

export const HIDRO_SYNC_KEY = SYNC_KEY;
export const HIDRO_DATA_STORAGE_KEY = HIDRO_DATA_KEY;