import { matManning } from '../components/constants';

const SYNC_KEY = 'civilflow_dibujo_sanitario_v1';
const TRAZOS_PREFIX = 'civilflow_trazos_';
const APARATOS_BY_TRAMO_KEY = 'civilflow_aparatos_by_tramo_v2';

const SAN_FAMILIES = new Set(['san', 'll']);

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

    const sanRamales = [];
    const sanBajantes = [];
    for (const r of (data.ramales || [])) {
      if (SAN_FAMILIES.has(r.net)) {
        const rKey = r.net + '_' + r.id;
        sanRamales.push({
          id: r.id, label: r.label || r.id, tipo: r.tipo,
          padre: r.padre || null, totalL: r.totalL || 0,
          diametro: r.diametro || '', diamPulg: diamPulgFromLabel(r.diametro),
          pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
          material: r.material || '', maning: matManning(r.material),
          _aparatosKey: rKey, _net: r.net,
        });
      }
    }
    for (const b of (data.bajantes || [])) {
      if (SAN_FAMILIES.has(b.net)) {
        const bKey = b.net + '_' + b.id;
        sanBajantes.push({
          id: b.id, code: b.code || b.id,
          dNominal: b.dNominal || '', diamPulg: diamPulgFromLabel(b.dNominal),
          hVert: b.hVert || 0, material: b.material || '',
          maning: matManning(b.material), _aparatosKey: bKey, _net: b.net,
        });
      }
    }

    if (sanRamales.length === 0 && sanBajantes.length === 0) continue;
    out.planes[nivel] = { planoId: plano.id, planoName: plano.name, ramales: sanRamales, bajantes: sanBajantes };
  }

  const aparatosByTramo = safeParse(localStorage.getItem(APARATOS_BY_TRAMO_KEY), {}) || {};
  out.aparatosByTramo = {};
  for (const [tramoId, counts] of Object.entries(aparatosByTramo)) {
    if (!counts || typeof counts !== 'object') continue;
    const filtered = {};
    for (const [apId, n] of Object.entries(counts)) {
      const v = Number(n) || 0;
      if (v > 0) filtered[apId] = v;
    }
    if (Object.keys(filtered).length > 0) out.aparatosByTramo[tramoId] = filtered;
  }

  return out;
}

export function writeSanDrawingSync(planos) {
  try {
    const data = buildSync(planos);
    localStorage.setItem(SYNC_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    console.error('writeSanDrawingSync error:', e);
    return null;
  }
}

export function readSanDrawingSync() {
  return safeParse(localStorage.getItem(SYNC_KEY), { planes: {}, aparatosByTramo: {}, updatedAt: 0 });
}

export const SAN_SYNC_KEY = SYNC_KEY;
export const APARATOS_BY_TRAMO_STORAGE_KEY = APARATOS_BY_TRAMO_KEY;

export function pisKeyForNivel(n) { return String(n); }
