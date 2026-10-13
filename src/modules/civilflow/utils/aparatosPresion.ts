import { loadFromStorage, saveToStorage } from '../services/storageService';

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
  /** Tributario: id del ramal padre en cuyo cuerpo desagua (su carga sube al padre).
   *  NOTA: `mergesFrom` (genealogía del split) se ignora aquí a propósito — la unión la
   *  deciden los clústeres geométricos + `padre`, que es lo que los tests pinnean. */
  padre?: string | null;
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
    window.dispatchEvent(new Event('storage'));
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
 * trazos en storage. Idempotente: solo escribe si algo cambió y despacha 'storage' para
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
  //      a) cada ENTRANTE aporta su CARGA a todas las SALIDAS;
  //      b) cada SALIDA aporta su BASE (aparatos propios) a las demás SALIDAS, salvo que
  //         ya le llegue su carga por esa vía (alcanzabilidad aguas arriba: sin doble conteo
  //         ni flujo invertido);
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
    const extremos: Array<{ key: string; pid: string; fin: 'cola' | 'cabeza'; p: number[] }> = [];
    for (const r of ramales) {
      // Tributario con padre conocido en SU plano: fuera de los clústeres (plegado §4).
      if (r.tipo === 'tributario' && r.padre && idsPorPlano.get(r.pid)?.has(r.padre)) continue;
      const c = colaDe(r);
      const h = cabezaDe(r);
      if (c) extremos.push({ key: r.key, pid: r.pid, fin: 'cola', p: c });
      if (h) extremos.push({ key: r.key, pid: r.pid, fin: 'cabeza', p: h });
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
    for (const idxs of clusters.values()) {
      if (idxs.length < 2) continue;
      const entrantes = idxs
        .filter((i) => extremos[i].fin === 'cabeza')
        .map((i) => extremos[i].key);
      const salidas = idxs.filter((i) => extremos[i].fin === 'cola').map((i) => extremos[i].key);
      const entSet = new Set(entrantes);
      for (const e of entrantes) {
        if (!cargaAdj.has(e)) cargaAdj.set(e, new Set());
        for (const s2 of salidas) {
          if (entSet.has(s2)) continue;
          addArista(e, s2, 'carga');
          cargaAdj.get(e)!.add(s2);
        }
      }
      for (const s1 of salidas) {
        for (const s2 of salidas) {
          if (s1 === s2 || entSet.has(s2)) continue;
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

  // 3b) Montantes/bajantes que alimentan cada ramal (MISMO plano): distancia en cola,
  //     r.ini = código, o recibeDeIds/alimentaIds explícitos.
  const upMonte = new Map<string, Cnt>();
  for (const r of ramales) {
    const cola = colaDe(r);
    const monte: Cnt = {};
    for (const b of bajes) {
      if (b.pid !== r.pid) continue;
      const code = b.code || b.id;
      const q = { x: b.x ?? 0, y: b.y ?? 0 };
      const porRef = (b.recibeDeIds || []).includes(r.id) || (b.alimentaIds || []).includes(r.id);
      const porDist = cola ? Math.hypot(cola[0] - q.x, cola[1] - q.y) <= 2 : false;
      if (porRef || porDist || (r.ini && r.ini === code)) {
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
