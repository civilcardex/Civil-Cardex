import { loadFromStorage, saveToStorage } from '../services/storageService';

// Propagación PERSISTENTE de aparatos en redes de presión (af/ac, orig. usuario): los aparatos
// "fluyen" con el agua — cada ramal RECIBE ESCRITO en su clave de conteos lo que hereda de
// aguas arriba: montantes (con su carga heredada del piso inferior vía ucAplicado), ramales
// que llegan con su cabeza de flujo a la unión de su cola, y HERMANOS de la misma unión con
// carga propia (regla usuario RAF3 = montante-vía-RAF1 + aparato de RAF2).
// Patrón libro + delta de los bajantes sanitarios: `aparatos_heredados_v1` guarda qué se le
// aplicó a cada clave; delta = max(0, actual − prevAplicado) + nuevo → los manuales nunca se
// tocan, re-correr es idempotente y quitar un aparato arriba baja solo abajo.

const APARATOS_KEY = 'aparatos_by_tramo_v2';
const HEREDADOS_KEY = 'aparatos_heredados_v1';
const TRAZOS_PREFIX = 'trazos_';

type Cnt = Record<string, number>;

interface RawRam {
  id: string;
  net: string;
  pts?: number[][];
  _tribReversed?: boolean;
  ini?: string;
  fin?: string;
}

interface RawBaj {
  id: string;
  code?: string;
  net: string;
  tipo: string;
  x?: number;
  y?: number;
  ucAplicado?: Record<string, Cnt>;
}

/** Suma dos mapas de conteos. */
const sumaCnt = (a: Cnt, b: Cnt): Cnt => {
  const out: Cnt = { ...a };
  for (const k of Object.keys(b)) out[k] = (out[k] || 0) + (b[k] || 0);
  return out;
};

/** ¿Los conteos están vacíos? */
const cntVacio = (c: Cnt): boolean => Object.values(c).every((v) => !v);

/** Quita claves con valor ≤ 0 (el delta deja ceros al restar el libro previo). */
const limpiar = (c: Cnt): Cnt => {
  const out: Cnt = {};
  for (const [k, v] of Object.entries(c)) if (v > 0) out[k] = v;
  return out;
};

/** ¿Dos mapas de conteos tienen el mismo contenido? */
const cntIgual = (a: Cnt, b: Cnt): boolean => {
  const ka = Object.keys(a).filter((k) => a[k] > 0);
  const kb = Object.keys(b).filter((k) => b[k] > 0);
  return ka.length === kb.length && ka.every((k) => (a[k] || 0) === (b[k] || 0));
};

/** Planes con trazos en storage (ids desde las claves civilflow_trazos_*). */
function idsDePlanos(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`civilflow_${TRAZOS_PREFIX}`)) {
        out.push(k.slice(`civilflow_${TRAZOS_PREFIX}`.length));
      }
    }
  } catch {
    return [];
  }
  return out;
}

/** Cola de flujo del ramal (pts[0], o el último si va invertido). */
function colaDe(r: RawRam): number[] | null {
  if (!r.pts || r.pts.length < 2) return null;
  return r._tribReversed ? r.pts[r.pts.length - 1] : r.pts[0];
}

/** Cabeza de flujo del ramal (el extremo opuesto a la cola). */
function cabezaDe(r: RawRam): number[] | null {
  if (!r.pts || r.pts.length < 2) return null;
  return r._tribReversed ? r.pts[0] : r.pts[r.pts.length - 1];
}

/** Corre la propagación completa de una red de presión. Idempotente: solo escribe si algo
 *  cambió y despacha 'storage' para refrescar tablas/panel. */
export function propagarAparatosPresion(net: 'af' | 'ac'): void {
  const disk = loadFromStorage<Record<string, Cnt>>(APARATOS_KEY, {}) || {};
  const libros = loadFromStorage<Record<string, Cnt>>(HEREDADOS_KEY, {}) || {};

  // 1) Recolectar ramales + bajantes de la red en TODOS los planos con trazos.
  const ramales: Array<RawRam & { key: string }> = [];
  const bajes: Array<RawBaj> = [];
  for (const pid of idsDePlanos()) {
    const raw = loadFromStorage<{ ramales?: RawRam[]; bajantes?: RawBaj[] } | string | null>(
      `${TRAZOS_PREFIX}${pid}`,
      null,
    );
    if (!raw) continue;
    let d = raw as { ramales?: RawRam[]; bajantes?: RawBaj[] };
    if (typeof raw === 'string') {
      try {
        d = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    for (const r of d.ramales || []) {
      if (r.net !== net) continue;
      ramales.push({ ...r, key: `${net}_${r.id}_${pid}` });
    }
    for (const b of d.bajantes || []) {
      if (b.net === net) bajes.push(b);
    }
  }
  if (ramales.length === 0) {
    return;
  }

  // 2) Carga de cada bajante/montante: clave propia + libro ucAplicado (herencia del piso
  //    inferior). Los ramales que nacen de él la reciben como raíz.
  const cargaBaj = new Map<string, Cnt>();
  for (const b of bajes) {
    let c: Cnt = { ...(disk[`${net}_${b.id}_P`] || {}) };
    // La clave del bajante lleva el planId de SU plano — se resuelve escaneando el disk.
    for (const [k, v] of Object.entries(disk)) {
      if (k.startsWith(`${net}_${b.id}_`)) c = sumaCnt(c, v);
    }
    for (const m of Object.values(b.ucAplicado || {})) c = sumaCnt(c, m);
    cargaBaj.set(b.id, cntVacio(c) ? {} : c);
  }

  // 3) Aristas por ramal: montante en su cola / entrantes por cabeza / hermanos de unión.
  const upMonte = new Map<string, Cnt>(); // carga de montantes directos en la cola
  const upsDe = new Map<string, string[]>(); // ramales que llegan con la cabeza
  const sibsDe = new Map<string, string[]>(); // hermanos de la misma unión (aportan su base)
  for (const r of ramales) {
    const cola = colaDe(r);
    const monte: Cnt = {};
    const ups: string[] = [];
    const sibs: string[] = [];
    if (cola) {
      for (const b of bajes) {
        const code = b.code || b.id;
        const q = { x: b.x ?? 0, y: b.y ?? 0 };
        if (Math.hypot(cola[0] - q.x, cola[1] - q.y) <= 2 || (r.ini && r.ini === code)) {
          const c = cargaBaj.get(b.id);
          if (c && !cntVacio(c)) {
            for (const [k, v] of Object.entries(c)) monte[k] = (monte[k] || 0) + v;
          }
        }
      }
      for (const u of ramales) {
        if (u.id === r.id) continue;
        const uh = cabezaDe(u);
        if (!uh) continue;
        if (Math.hypot(uh[0] - cola[0], uh[1] - cola[1]) <= 0.5) ups.push(u.key);
      }
      for (const s2 of ramales) {
        if (s2.id === r.id) continue;
        const st = colaDe(s2);
        if (!st) continue;
        // Hermano: también nace en esta unión (su cola aquí). Aporta su carga base.
        if (Math.hypot(st[0] - cola[0], st[1] - cola[1]) <= 0.5) sibs.push(s2.key);
      }
    }
    upMonte.set(r.key, monte);
    upsDe.set(r.key, ups);
    sibsDe.set(r.key, sibs);
  }

  // 4) Base propia de cada ramal = actual − prevAplicado (lo manual nunca se toca).
  const baseDe = new Map<string, Cnt>();
  for (const r of ramales) {
    const cur = disk[r.key] || {};
    const prev = libros[r.key] || {};
    const base: Cnt = {};
    for (const k of new Set([...Object.keys(cur), ...Object.keys(prev)])) {
      base[k] = Math.max(0, (cur[k] || 0) - (prev[k] || 0));
    }
    baseDe.set(r.key, cntVacio(base) ? {} : base);
  }

  // 5) DFS topológico con corte de ciclo: un ramal en pila (ciclo) aporta solo su base.
  //    Los hermanos aportan su BASE (no su total) para no inflarse en cadena.
  const totalDe = new Map<string, Cnt>(); // carga que transporta (base + heredado)
  const heredadoDe = new Map<string, Cnt>();
  const porKey = new Map(ramales.map((r) => [r.key, r]));
  const estado = new Map<string, 0 | 1 | 2>(); // 0 nuevo · 1 en pila · 2 resuelto
  const calcDe = (key: string): Cnt => {
    const r = porKey.get(key);
    if (!r) return {};
    const st = estado.get(r.key) ?? 0;
    if (st === 2) return totalDe.get(r.key) || {};
    if (st === 1) return baseDe.get(r.key) || {}; // ciclo: corta con la base
    estado.set(r.key, 1);
    let h: Cnt = { ...(upMonte.get(r.key) || {}) };
    for (const uk of upsDe.get(r.key) || []) h = sumaCnt(h, calcDe(uk));
    for (const sk of sibsDe.get(r.key) || []) h = sumaCnt(h, baseDe.get(sk) || {});
    estado.set(r.key, 2);
    heredadoDe.set(r.key, h);
    const tot = sumaCnt(baseDe.get(r.key) || {}, h);
    totalDe.set(r.key, tot);
    return tot;
  };
  for (const r of ramales) calcDe(r.key);

  // 6) Delta idempotente por clave + libro nuevo. Solo escribe si algo cambió.
  let dirty = false;
  for (const r of ramales) {
    const her = heredadoDe.get(r.key) || {};
    const prev = libros[r.key] || {};
    const cur = disk[r.key] || {};
    const base: Cnt = {};
    for (const k of new Set([...Object.keys(cur), ...Object.keys(prev)])) {
      base[k] = Math.max(0, (cur[k] || 0) - (prev[k] || 0));
    }
    const nuevo = limpiar(sumaCnt(base, her));
    const herLimpio = limpiar(her);
    if (!cntIgual(prev, herLimpio)) {
      if (cntVacio(herLimpio)) delete libros[r.key];
      else libros[r.key] = herLimpio;
      dirty = true;
    }
    if (!cntIgual(cur, nuevo)) {
      if (cntVacio(nuevo)) delete disk[r.key];
      else disk[r.key] = nuevo;
      dirty = true;
    }
  }
  if (dirty) {
    saveToStorage(APARATOS_KEY, disk);
    saveToStorage(HEREDADOS_KEY, libros);
    try {
      window.dispatchEvent(new Event('storage'));
    } catch {
      /* ignorar */
    }
  }
}

/** Libro de herencia de una clave de tramo (para UI: panel "HEREDADOS", tooltips, CalcUC). */
export function leerHeredadosPresion(key: string): Cnt {
  const libros = loadFromStorage<Record<string, Cnt>>(HEREDADOS_KEY, {}) || {};
  return libros[key] || {};
}
