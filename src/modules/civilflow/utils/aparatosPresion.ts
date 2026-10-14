import { loadFromStorage, saveToStorage } from '../services/storageService';
import { EV_STORAGE } from '../utils/fixtureEvents';

// Propagación PERSISTENTE de aparatos en redes de presión (af/ac, orig. usuario): los aparatos
// "fluyen" con el agua — cada ramal RECIBE ESCRITO en su clave de conteos lo que hereda de
// aguas arriba: montantes (con su carga heredada del piso inferior vía ucAplicado) y ramales
// cuyas uniones de extremos lo alimentan (regla usuario RAF3 = montante-vía-RAF1 + lavamanos
// de RAF2). Todo el cómputo se particiona POR PLANO (los ids se repiten entre pisos y las
// copias bit-exactas comparten coordenadas: sin partición habría herencia fantasma cross-piso).
// Patrón libro + delta de los bajantes sanitarios, con DOS libros: `aparatos_heredados_v1`
// (herencia de uniones/montantes) y `aparatos_heredados_trib_v1` (plegado de tributarios).
// manual = actual − libroHer − libroTrib → re-correr es idempotente y quitar un aparato
// arriba baja solo abajo, sin re-sumarse nunca.

const APARATOS_KEY = 'aparatos_by_tramo_v2';
const HEREDADOS_KEY = 'aparatos_heredados_v1';
const HEREDADOS_TRIB_KEY = 'aparatos_heredados_trib_v1';
const TRAZOS_PREFIX = 'trazos_';

type Cnt = Record<string, number>;

interface RawRam {
  id: string;
  net: string;
  tipo?: string;
  pts?: number[][];
  _tribReversed?: boolean;
  ini?: string;
  fin?: string;
  /** Tributario: id del ramal padre en cuyo cuerpo desagua (su carga sube al padre). */
  padre?: string | null;
  /** Genealogía del split ([anfitrión, entrante]): SOLO se usa como pista de continuación
   *  (el downstream autocreado continúa la línea del anfitrión aunque doble en ángulo). */
  mergesFrom?: string[];
}

interface RawBaj {
  id: string;
  code?: string;
  net: string;
  tipo: string;
  x?: number;
  y?: number;
  ucAplicado?: Record<string, Cnt>;
  recibeDeIds?: string[];
  alimentaIds?: string[];
  /** Ramales asociados a mano (checkbox de la tabla): no declara dirección de flujo. */
  asocManual?: string[];
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

/**
 * ¿Hay camino de aristas 'carga' desde `origen` hasta `destino`? (BFS sobre el grafo de
 * herencia; evita doble conteo e inversión al filtrar aristas 'base'.)
 * @param adj - adyacencia origen→destinos de aristas de carga.
 * @param origen - clave del ramal donde empieza la búsqueda.
 * @param destino - clave del ramal buscado.
 * @returns true si el destino es alcanzable solo por vía de carga.
 */
function alcanzaPorCarga(adj: Map<string, Set<string>>, origen: string, destino: string): boolean {
  if (origen === destino) return true;
  const vistos = new Set<string>([origen]);
  const cola = [origen];
  while (cola.length > 0) {
    const actual = cola.pop() as string;
    for (const sig of adj.get(actual) || []) {
      if (sig === destino) return true;
      if (!vistos.has(sig)) {
        vistos.add(sig);
        cola.push(sig);
      }
    }
  }
  return false;
}

/**
 * Despacha el evento de refresco de conteos (tablas/panel re-lean storage). Siempre
 * tolerante: en tests sin `window` no debe tumbar la propagación.
 */
function despacharStorage(): void {
  try {
    window.dispatchEvent(new Event(EV_STORAGE));
  } catch {
    /* ignorar */
  }
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

/**
 * Corre la propagación completa de una red de presión (af/ac) sobre todos los planos con
 * trazos en storage. Idempotente: solo escribe si algo cambió y despacha EV_STORAGE para
 * refrescar tablas/panel. Nunca lanza (los callers la corren en efectos/debounce).
 * @param net - red de presión a propagar ('af' o 'ac').
 */
export function propagarAparatosPresion(net: 'af' | 'ac'): void {
  const disk = loadFromStorage<Record<string, Cnt>>(APARATOS_KEY, {}) || {};
  const libros = loadFromStorage<Record<string, Cnt>>(HEREDADOS_KEY, {}) || {};

  // 1) Recolectar ramales + bajantes de la red en TODOS los planos con trazos. Cada
  //    pieza viaja con su pid: los ids se repiten entre pisos y NADA puede llavearse por
  //    id pelado (orig. auditoría: herencia fantasma cross-piso).
  const ramales: Array<RawRam & { key: string; pid: string }> = [];
  const bajes: Array<RawBaj & { pid: string }> = [];
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
      ramales.push({ ...r, key: `${net}_${r.id}_${pid}`, pid });
    }
    for (const b of d.bajantes || []) {
      if (b.net === net) bajes.push({ ...b, pid });
    }
  }
  if (ramales.length === 0) {
    despacharStorage();
    return;
  }

  // 2) Carga de cada bajante/montante (por plano): clave exacta propia + libro ucAplicado
  //    (herencia del piso inferior). Sin scan por prefijo: contaba la semilla dos veces y
  //    mezclaba pisos. Solo fallback a la clave legacy sin sufijo cuando la exacta está vacía.
  const cargaBaj = new Map<string, Cnt>(); // `${id}|${pid}`
  for (const b of bajes) {
    let c: Cnt = { ...(disk[`${net}_${b.id}_${b.pid}`] || {}) };
    if (cntVacio(c)) c = { ...(disk[`${net}_${b.id}_P`] || {}) };
    for (const m of Object.values(b.ucAplicado || {})) c = sumaCnt(c, m);
    cargaBaj.set(`${b.id}|${b.pid}`, cntVacio(c) ? {} : c);
  }

  // 3) Aristas por CLÚSTERES de extremos (araña de ramales, orig. usuario), SIEMPRE
  //    dentro del mismo plano. Cada punto donde terminan/tocan 2+ trazos es una unión;
  //    ENTRANTE = cabeza en el punto (alimenta), SALIDA = cola en el punto (recibe):
  //      a) cada ENTRANTE aporta su CARGA solo a sus CONTINUACIONES (salida colineal con su
  //         llegada, o downstream autocreado con mergesFrom al entrante; sin continuación
  //         identificable, a todas — una rama lateral jamás recibe del entrante);
  //      b) cada SALIDA aporta su BASE solo a CONTINUACIONES (la rama lateral alimenta la
  //         línea principal; entre laterales o hacia laterales no hay aporte), salvo que ya
  //         le llegue su carga por esa vía (alcanzabilidad: sin doble conteo ni inversión);
  //    una pieza que es ENTRANTE en la unión jamás recibe de ella (dirección de flujo).
  //    Los TRIBUTARIOS con padre conocido no clusterizan: su carga sube por plegado (#14).
  interface Arista {
    from: string;
    to: string;
    tipo: 'carga' | 'base';
  }
  const idsPorPlano = new Map<string, Set<string>>();
  for (const r of ramales) {
    if (!idsPorPlano.has(r.pid)) idsPorPlano.set(r.pid, new Set());
    idsPorPlano.get(r.pid)!.add(r.id);
  }
  const aristas: Arista[] = [];
  {
    const aristaViva = new Set<string>();
    const addArista = (from: string, to: string, tipo: 'carga' | 'base'): void => {
      if (from === to) return;
      const k = `${tipo}|${from}|${to}`;
      if (aristaViva.has(k)) return;
      aristaViva.add(k);
      aristas.push({ from, to, tipo });
    };
    const ramalPorKey = new Map(ramales.map((r) => [r.key, r]));
    const dirSal = (r: (typeof ramales)[number]): number[] | null => {
      // Dirección de SALIDA en la cola: hacia el segundo vértice en sentido de flujo.
      const pts = r.pts;
      if (!pts || pts.length < 2) return null;
      const a = r._tribReversed ? pts[pts.length - 1] : pts[0];
      const b = r._tribReversed ? pts[pts.length - 2] : pts[1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      return l < 1e-9 ? null : [dx / l, dy / l];
    };
    const dirEnt = (r: (typeof ramales)[number]): number[] | null => {
      // Dirección de LLEGADA en la cabeza: desde el vértice previo en sentido de flujo.
      const pts = r.pts;
      if (!pts || pts.length < 2) return null;
      const a = r._tribReversed ? pts[1] : pts[pts.length - 2];
      const b = r._tribReversed ? pts[0] : pts[pts.length - 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      return l < 1e-9 ? null : [dx / l, dy / l];
    };
    const extremos: Array<{
      key: string;
      pid: string;
      fin: 'cola' | 'cabeza';
      p: number[];
      dir: number[] | null;
    }> = [];
    for (const r of ramales) {
      // Tributario con padre conocido en SU plano: fuera de los clústeres (plegado §4).
      if (r.tipo === 'tributario' && r.padre && idsPorPlano.get(r.pid)?.has(r.padre)) continue;
      const c = colaDe(r);
      const h = cabezaDe(r);
      if (c) extremos.push({ key: r.key, pid: r.pid, fin: 'cola', p: c, dir: dirSal(r) });
      if (h) extremos.push({ key: r.key, pid: r.pid, fin: 'cabeza', p: h, dir: dirEnt(r) });
    }
    // Clústeres por unión-find con tolerancia 0.5 (los splits comparten coordenada
    // exacta), particionados por plano.
    const padreDe = new Map(extremos.map((_, i) => [i, i]));
    const find = (i: number): number => {
      const p = padreDe.get(i);
      if (p === undefined || p === i) return i;
      const raiz = find(p);
      padreDe.set(i, raiz);
      return raiz;
    };
    const uni = (i: number, j: number): void => {
      padreDe.set(find(i), find(j));
    };
    for (let i = 0; i < extremos.length; i++) {
      for (let j = i + 1; j < extremos.length; j++) {
        if (extremos[i].pid !== extremos[j].pid) continue;
        if (
          Math.hypot(extremos[i].p[0] - extremos[j].p[0], extremos[i].p[1] - extremos[j].p[1]) <=
          0.5
        )
          uni(i, j);
      }
    }
    const clusters = new Map<number, number[]>();
    extremos.forEach((_, i) => {
      const raiz = find(i);
      if (!clusters.has(raiz)) clusters.set(raiz, []);
      clusters.get(raiz)!.push(i);
    });
    const cargaAdj = new Map<string, Set<string>>();
    // ¿La salida `s` continúa la línea del entrante `e`? Colinealidad llegada/salida
    // (~25°) o downstream autocreado con mergesFrom al entrante.
    const esContinuacion = (eIdx: number, sIdx: number): boolean => {
      const de = extremos[eIdx].dir;
      const ds = extremos[sIdx].dir;
      if (de && ds && de[0] * ds[0] + de[1] * ds[1] >= 0.9) return true;
      const sRam = ramalPorKey.get(extremos[sIdx].key);
      const eRam = ramalPorKey.get(extremos[eIdx].key);
      if (sRam?.mergesFrom && eRam && sRam.mergesFrom.includes(eRam.id)) return true;
      return false;
    };
    for (const idxs of clusters.values()) {
      if (idxs.length < 2) continue;
      const idxEnt = idxs.filter((i) => extremos[i].fin === 'cabeza');
      const idxSal = idxs.filter((i) => extremos[i].fin === 'cola');
      const entrantes = idxEnt.map((i) => extremos[i].key);
      const salidas = idxSal.map((i) => extremos[i].key);
      const entSet = new Set(entrantes);
      const contGlobal = new Set<string>();
      for (const e of idxEnt) {
        for (const s of idxSal) {
          if (entSet.has(extremos[s].key)) continue;
          if (esContinuacion(e, s)) contGlobal.add(extremos[s].key);
        }
      }
      for (const e of idxEnt) {
        const ek = extremos[e].key;
        if (!cargaAdj.has(ek)) cargaAdj.set(ek, new Set());
        let conts = idxSal
          .filter((s) => !entSet.has(extremos[s].key) && esContinuacion(e, s))
          .map((s) => extremos[s].key);
        // Sin continuación PROPIA: si el clúster tiene continuaciones de OTROS entrantes
        // (contGlobal), la carga sale por la línea principal — una lateral jamás recibe del
        // entrante (doctrina 3a; el reparto clásico a TODAS las salidas solo aplica cuando
        // NADIE tiene continuación, y el filtro de aristas base deja de chocar con la carga).
        if (conts.length === 0) {
          conts = contGlobal.size > 0 ? [...contGlobal] : salidas.filter((s2) => !entSet.has(s2));
        }
        for (const s2 of conts) {
          addArista(ek, s2, 'carga');
          cargaAdj.get(ek)!.add(s2);
        }
      }
      for (const s1 of salidas) {
        for (const s2 of salidas) {
          if (s1 === s2 || entSet.has(s2)) continue;
          // Solo hacia continuaciones (la lateral alimenta la principal; entre laterales
          // o hacia laterales no hay aporte). Sin continuación identificable: clásico.
          if (contGlobal.size > 0 && !contGlobal.has(s2)) continue;
          // Sin doble conteo ni inversión: si ya hay camino de carga entre ambas en
          // cualquier sentido, la base sobra (llega por la vía de carga).
          if (alcanzaPorCarga(cargaAdj, s1, s2) || alcanzaPorCarga(cargaAdj, s2, s1)) continue;
          addArista(s1, s2, 'base');
        }
      }
    }
  }
  // Índice por destino: el DFS ya no escanea todas las aristas por nodo.
  const aristasPorDestino = new Map<string, Arista[]>();
  for (const a of aristas) {
    if (!aristasPorDestino.has(a.to)) aristasPorDestino.set(a.to, []);
    aristasPorDestino.get(a.to)!.push(a);
  }

  // 3b) Montantes/bajantes que alimentan cada ramal (MISMO plano) — DIRECCIONAL (orig.
  //     usuario): SOLO si el ramal SALE del montante (contacto en la COLA del ramal,
  //     r.ini = código, o alimentaIds lo lista). Si el ramal ENTRA (contacto en la CABEZA,
  //     r.fin = código, recibeDeIds lo lista), NO recibe la carga del montante — sus
  //     aparatos quedan locales, con el cap de 1 manual.
  const upMonte = new Map<string, Cnt>();
  for (const r of ramales) {
    const cola = colaDe(r);
    const cabeza = cabezaDe(r);
    const monte: Cnt = {};
    for (const b of bajes) {
      if (b.pid !== r.pid) continue;
      const code = b.code || b.id;
      const q = { x: b.x ?? 0, y: b.y ?? 0 };
      const dist = (p: number[] | null): boolean => !!p && Math.hypot(p[0] - q.x, p[1] - q.y) <= 2;
      const saleDelMonte =
        dist(cola) || (r.ini && r.ini === code) || (b.alimentaIds || []).includes(r.id);
      const entraAlMonte =
        dist(cabeza) || (r.fin && r.fin === code) || (b.recibeDeIds || []).includes(r.id);
      // La asociación manual del checkbox (SecMontantes/canalesAsociados escribe recibeDeIds
      // sin dirección): hereda como el comportamiento previo, sin el veto de la regla 3b.
      const esAsocManual = (b.asocManual || []).includes(r.id);
      if (esAsocManual || (saleDelMonte && !entraAlMonte)) {
        const c = cargaBaj.get(`${b.id}|${b.pid}`);
        if (c && !cntVacio(c)) {
          for (const [k, v] of Object.entries(c)) monte[k] = (monte[k] || 0) + v;
        }
      }
    }
    upMonte.set(r.key, monte);
  }

  // 4) Manual verdadero + plegado de tributarios, en DOS fases sin mutar lo leído
  //    (orig. auditoría: el plegado in-place re-sumaba +1 por corrida y dependía del orden).
  //    Fase A: manual crudo = actual − libroHer − libroTrib.
  //    Fase B (hijos antes que padres): foldRecibido[K] = Σ hijos (manual + foldRecibido);
  //    manual[K] = manualCrudo[K] − foldRecibido[K]. TIRAF-n → RAF-n → salidas de la unión.
  const librosTrib = loadFromStorage<Record<string, Cnt>>(HEREDADOS_TRIB_KEY, {}) || {};
  const manualCrudoDe = new Map<string, Cnt>();
  for (const r of ramales) {
    const cur = disk[r.key] || {};
    const prev = libros[r.key] || {};
    const prevTrib = librosTrib[r.key] || {};
    const crudo: Cnt = {};
    for (const k of new Set([
      ...Object.keys(cur),
      ...Object.keys(prev),
      ...Object.keys(prevTrib),
    ])) {
      crudo[k] = Math.max(0, (cur[k] || 0) - (prev[k] || 0) - (prevTrib[k] || 0));
    }
    manualCrudoDe.set(r.key, cntVacio(crudo) ? {} : crudo);
  }
  // Hijos tributarios por padre (mismo plano): `${id}|${pid}`.
  const hijosDe = new Map<string, string[]>();
  const porKey = new Map(ramales.map((r) => [r.key, r]));
  for (const t of ramales) {
    if (t.tipo !== 'tributario' || !t.padre) continue;
    const padreKey = ramales.find((s) => s.pid === t.pid && s.id === t.padre)?.key;
    if (!padreKey) continue; // huérfano/legacy: participa en clústeres como fallback
    if (!hijosDe.has(padreKey)) hijosDe.set(padreKey, []);
    hijosDe.get(padreKey)!.push(t.key);
  }
  // Orden hijos-antes-que-padres (post-orden con corte de ciclo en links padre).
  const ordenHojasPrimero: string[] = [];
  {
    const visitado = new Set<string>();
    const enPila = new Set<string>();
    const visitar = (key: string): void => {
      if (visitado.has(key) || enPila.has(key)) return; // ciclo: corta
      enPila.add(key);
      for (const h of hijosDe.get(key) || []) visitar(h);
      enPila.delete(key);
      visitado.add(key);
      ordenHojasPrimero.push(key);
    };
    for (const r of ramales) visitar(r.key);
  }
  const manualDe = new Map<string, Cnt>(); // manual verdadero (sin plegado)
  const foldDe = new Map<string, Cnt>(); // plegado recibido de tributarios
  for (const key of ordenHojasPrimero) {
    let fold: Cnt = {};
    for (const h of hijosDe.get(key) || []) {
      fold = sumaCnt(fold, sumaCnt(manualDe.get(h) || {}, foldDe.get(h) || {}));
    }
    foldDe.set(key, fold);
    const crudo = manualCrudoDe.get(key) || {};
    const manual: Cnt = {};
    for (const k of new Set([...Object.keys(crudo), ...Object.keys(fold)])) {
      manual[k] = Math.max(0, (crudo[k] || 0) - (fold[k] || 0));
    }
    manualDe.set(key, cntVacio(manual) ? {} : manual);
  }

  // 5) DFS topológico con corte de ciclo: un ramal en pila (ciclo) aporta solo su base.
  //    Las aristas 'carga' aportan el total; las 'base', solo la base (sin inflación).
  const totalDe = new Map<string, Cnt>(); // carga que transporta (base + heredado)
  const heredadoDe = new Map<string, Cnt>();
  const estado = new Map<string, 0 | 1 | 2>(); // 0 nuevo · 1 en pila · 2 resuelto
  const baseDe = (key: string): Cnt => sumaCnt(manualDe.get(key) || {}, foldDe.get(key) || {});
  const calcDe = (key: string): Cnt => {
    const r = porKey.get(key);
    if (!r) return {};
    const st = estado.get(r.key) ?? 0;
    if (st === 2) return totalDe.get(r.key) || {};
    if (st === 1) return baseDe(r.key); // ciclo: corta con la base
    estado.set(r.key, 1);
    let h: Cnt = { ...(upMonte.get(r.key) || {}) };
    for (const a of aristasPorDestino.get(r.key) || []) {
      h = a.tipo === 'carga' ? sumaCnt(h, calcDe(a.from)) : sumaCnt(h, baseDe(a.from));
    }
    estado.set(r.key, 2);
    heredadoDe.set(r.key, h);
    const tot = sumaCnt(baseDe(r.key), h);
    totalDe.set(r.key, tot);
    return tot;
  };
  for (const r of ramales) calcDe(r.key);

  // 6) Delta idempotente por clave + libros nuevos. Solo escribe si algo cambió: en estado
  //    estable actual = manual + fold + her y los libros coinciden → cero escrituras.
  let dirty = false;
  for (const r of ramales) {
    const her = limpiar(heredadoDe.get(r.key) || {});
    const fold = limpiar(foldDe.get(r.key) || {});
    const prev = libros[r.key] || {};
    const prevFold = librosTrib[r.key] || {};
    const cur = disk[r.key] || {};
    const base = sumaCnt(manualDe.get(r.key) || {}, fold);
    const nuevo = limpiar(sumaCnt(base, her));
    if (!cntIgual(prev, her)) {
      if (cntVacio(her)) delete libros[r.key];
      else libros[r.key] = her;
      dirty = true;
    }
    if (!cntIgual(prevFold, fold)) {
      if (cntVacio(fold)) delete librosTrib[r.key];
      else librosTrib[r.key] = fold;
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
    saveToStorage(HEREDADOS_TRIB_KEY, librosTrib);
  }
  // El evento se despacha SIEMPRE (no solo si cambió algo): el panel derecho lee los conteos
  // de su estado React — sin evento tras una corrida limpia, un estado rancio (captura previa
  // a la limpieza) se quedaba pintado para siempre (orig. usuario: INO ×2 fantasma en RAF1).
  // Contrapartida consciente (auditoría #8): cada selección re-despacha aunque nada cambie;
  // los consumidores re-lean con debounce y el cálculo es barato. No revertir sin resolver
  // antes el estado rancio del panel (hallazgo #5).
  despacharStorage();
}

/**
 * Libro de herencia de una clave de tramo (herencia de uniones/montantes, sin plegado
 * de tributarios) — para UI: panel, tooltips, CalcUC.
 * @param key - clave de conteos del tramo (`fam_id_plan`).
 * @returns mapa aparato→unidades heredadas (vacío si no hay).
 */
export function leerHeredadosPresion(key: string): Cnt {
  const libros = loadFromStorage<Record<string, Cnt>>(HEREDADOS_KEY, {}) || {};
  return libros[key] || {};
}
