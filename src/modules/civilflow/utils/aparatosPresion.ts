import { loadFromStorage, saveToStorage } from '../services/storageService';
import { EV_STORAGE } from '../utils/fixtureEvents';
import {
  APARATOS_HEREDADOS_KEY,
  APARATOS_HEREDADOS_TRIB_KEY,
  APARATOS_RESIDUO_BAK_KEY,
  TRAZOS_PREFIX,
  BAJADAS_RECEPTORAS_KEY,
} from '../constants/storage-keys';
import { devError } from '../../../utils/devError';

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
const HEREDADOS_KEY = APARATOS_HEREDADOS_KEY;
const HEREDADOS_TRIB_KEY = APARATOS_HEREDADOS_TRIB_KEY;
/** Bajadas ya marcadas como receptoras de su unión (persistente: siguen siéndolo aunque su clave se llene). */

type Cnt = Record<string, number>;

interface RawRam {
  id: string;
  net: string;
  tipo?: string;
  pts?: number[][];
  _tribReversed?: boolean;
  ini?: string;
  fin?: string;
  /** Tributario: id del ramal padre en cuyo cuerpo desagua — sus aparatos SUBEN al padre para no contarse dos veces. */
  padre?: string | null;
  /** MergesFrom (genealogia del split: qué piezas se partieron para crear esta): pista de continuación, hoy solo informativa. */
  mergesFrom?: string[];
  /** Aparato asignado por extremo (dónde quedó dibujado): el down-trib y el lateral se distinguen
   *  por SI el aparato vive en el extremo de conexión con el padre. */
  aparatoInicio?: string;
  aparatoFin?: string;
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
  /** Asociación hecha a mano por checkbox (no declara dirección de flujo: no se poda por geometría). */
  asocManual?: string[];
  /** Trazo del montante (bajada entre pisos): para contacto geométrico con su alimentador. */
  pts?: number[][];
}

const sumaCnt = (a: Cnt, b: Cnt): Cnt => {
  const out: Cnt = { ...a };
  for (const k of Object.keys(b)) out[k] = (out[k] || 0) + (b[k] || 0);
  return out;
};

const cntVacio = (c: Cnt): boolean => Object.values(c).every((v) => !v);

/** Quita del mapa los aparatos que quedaron en 0 (al restar el libro previo sobran ceros). */
const limpiar = (c: Cnt): Cnt => {
  const out: Cnt = {};
  for (const [k, v] of Object.entries(c)) if (v > 0) out[k] = v;
  return out;
};

const cntIgual = (a: Cnt, b: Cnt): boolean => {
  const ka = Object.keys(a).filter((k) => a[k] > 0);
  const kb = Object.keys(b).filter((k) => b[k] > 0);
  return ka.length === kb.length && ka.every((k) => (a[k] || 0) === (b[k] || 0));
};

/** Pisos que tienen dibujo guardado (ids leídos de las claves civilflow_trazos_*). */
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

/** ¿Existe un camino de CARGA (quién alimenta a quién) de un ramal a otro? BFS que además
 *  evita el doble conteo y los bucles.
 *  @param adj - adyacencia origen→destinos de aristas de carga.
 *  @param origen - clave del ramal inicial.
 *  @param destino - clave del ramal buscado.
 *  @returns true si el destino es alcanzable por vía de carga. */
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

/** Avisa a tablas y panel que los conteos cambiaron (tolerante si no hay window). */
function despacharStorage(): void {
  try {
    window.dispatchEvent(new Event(EV_STORAGE));
  } catch {
    /* ignorar */
  }
}

/** Cola de flujo del ramal: por dónde SALE el agua (el primer punto, o el último si el trazo está invertido, _tribReversed (flag de flujo invertido en tributario)). */
function colaDe(r: RawRam): number[] | null {
  if (!r.pts || r.pts.length < 2) return null;
  return r._tribReversed ? r.pts[r.pts.length - 1] : r.pts[0];
}

/** Cabeza de flujo del ramal: por dónde ENTRA el agua (el extremo opuesto a la cola). */
function cabezaDe(r: RawRam): number[] | null {
  if (!r.pts || r.pts.length < 2) return null;
  return r._tribReversed ? r.pts[0] : r.pts[r.pts.length - 1];
}

/** Reparte los aparatos de las redes af (Agua Fría)/ac (Agua Caliente)/gas (Gas): cada ramal
 *  ESCRIBE en su clave lo que hereda de aguas arriba (el montante, las uniones donde entra la
 *  tubería). Ej: RAF3 queda con el inodoro que le baja por RAF1 + el lavamanos propio de RAF2.
 *  Se puede correr mil veces: el resultado es el mismo. */
/** Diagnóstico de la última propagación (orig. usuario: pega este JSON para depurar el
 *  storage real — piezas, libros, bajadas, transferencias y aristas). */
let ultimaDiag: unknown = null;
export function diagUltimaPropagacion(): unknown {
  return ultimaDiag;
}

export function propagarAparatosPresion(net: 'af' | 'ac' | 'gas'): void {
  const disk = loadFromStorage<Record<string, Cnt>>(APARATOS_KEY, {}) || {};
  const libros = loadFromStorage<Record<string, Cnt>>(HEREDADOS_KEY, {}) || {};
  const bajadasLibro = loadFromStorage<Record<string, number>>(BAJADAS_RECEPTORAS_KEY, {}) || {};
  const librosTrib = loadFromStorage<Record<string, Cnt>>(APARATOS_HEREDADOS_TRIB_KEY, {}) || {};
  const diag: Record<string, unknown> = { net };

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
    diag.piezas = ramales.map((r) => ({
      id: r.id,
      key: r.key,
      tipo: r.tipo || '',
      padre: r.padre || '',
      rev: !!r._tribReversed,
      ini: r.ini || '',
      fin: r.fin || '',
      apI: r.aparatoInicio || '',
      apF: r.aparatoFin || '',
      pts: r.pts || [],
      disk: disk[r.key] || {},
      her: libros[r.key] || {},
    }));
    diag.bajLibro = { ...bajadasLibro };
  }
  if (ramales.length === 0) {
    // Sin piezas de la red: marcadores de ESTA red son fósiles (tramos borrados) — fuera.
    // Las otras redes conservan sus marcas (libro compartido cross-net: podarlo alternaba
    // bug/reparación en la 1ª selección tras reingresar — orig. usuario RAC3/RAC2).
    const fosiles = Object.keys(bajadasLibro).filter((k) => k.startsWith(`${net}_`));
    if (fosiles.length > 0) {
      for (const k of fosiles) delete bajadasLibro[k];
      saveToStorage(BAJADAS_RECEPTORAS_KEY, bajadasLibro);
    }
    despacharStorage();
    return;
  }
  const vivas = new Set(ramales.map((r) => r.key));
  // Poda de marcadores fósiles SOLO de la red actual. El libro es COMPARTIDO entre redes
  // — podar con `vivas` de una sola red borraba las marcas de las demás y la doctrina de
  // bajadas alternaba bug/reparación en cada secuencia (orig. usuario RAC3/RAC2).
  {
    const prefijo = `${net}_`;
    let podadas = false;
    for (const k of Object.keys(bajadasLibro)) {
      if (k.startsWith(prefijo) && !vivas.has(k)) {
        delete bajadasLibro[k];
        podadas = true;
      }
    }
    if (podadas) saveToStorage(BAJADAS_RECEPTORAS_KEY, bajadasLibro);
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
  // 2bis) Tributario VERTICAL HACIA ABAJO = continuación receptora (orig. usuario
  //      T1RAC6/T1RAC4, imágenes 2026-10-14): en su unión TODO el carga baja por él; el
  //      padre horizontal descarga su carga hacia abajo (pliegue INVERTIDO) y las salidas
  //      horizontales del clúster no acumulan carga ajena. Vertical-down = extremo lejano
  //      muy por debajo del punto de conexión (dy > 1 y domina sobre |dx|).
  const downTrib = new Map<
    string,
    { padreKey: string; conn: number[]; finConn: 'cola' | 'cabeza' }
  >();
  const padresDeDown = new Set<string>();
  /** Down-tribs receptores: su BASE en el DFS es SOLO su manual (el fold invertido ya vive
   *  dentro del manual — contarlo también duplicaría cada corrida). */
  const bajadasDown = new Set<string>();
  /** Tributarios de CADENA (uno conectado en la punta de otro): bajan en cascada — NO suben al padre (eso contaría dos veces). */
  const cadenaTrib = new Set<string>();
  /** Pieza horizontal "consumida" por una BAJADA: su carga propia se traslada a la bajada y su clave queda vacía (la bajada recibe TODO). */
  const transferencias = new Map<string, string>();
  const distSeg = (p: number[], a: number[], b: number[]): number => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t =
      l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const distAPadre = (p: number[], padre: (typeof ramales)[number]): number => {
    if (!padre.pts || padre.pts.length < 2) return Infinity;
    let m = Infinity;
    for (let i = 0; i < padre.pts.length - 1; i++) {
      m = Math.min(m, distSeg(p, padre.pts[i], padre.pts[i + 1]));
    }
    return m;
  };
  /**
   * Indiza los ramales por piso e id para buscarlos en 1 paso (antes buscar al padre de cada
   * tributario recorría toda la lista: en planos grandes era lentísimo).
   * @param lista - piezas recolectadas de todos los planos.
   * @returns mapa pid → (id → pieza).
   */
  const indicePorPlano = (
    lista: (typeof ramales)[number][],
  ): Map<string, Map<string, (typeof ramales)[number]>> => {
    const idx = new Map<string, Map<string, (typeof ramales)[number]>>();
    for (const r of lista) {
      let porPid = idx.get(r.pid);
      if (!porPid) {
        porPid = new Map();
        idx.set(r.pid, porPid);
      }
      porPid.set(r.id, r);
    }
    return idx;
  };
  const ramalesPorPlano = indicePorPlano(ramales);
  {
    for (const t of ramales) {
      if (t.tipo !== 'tributario' || !t.padre || !t.pts || t.pts.length < 2) continue;
      const padre = ramalesPorPlano.get(t.pid)?.get(t.padre);
      if (!padre) continue;
      const c = colaDe(t);
      const h = cabezaDe(t);
      if (!c || !h) continue;
      const dc = distAPadre(c, padre);
      const dh = distAPadre(h, padre);
      const conn = dc <= dh ? c : h;
      const far = dc <= dh ? h : c;
      const dy = far[1] - conn[1];
      // Doctrina UNIVERSAL down-trib (2026-10-14, orig. usuario): un tributario vertical
      // hacia abajo es la continuación receptora de su unión — sustituye el plegado hacia
      // arriba del caso "cabeza del trib en la unión" (auditoría #14) para esta geometría.
      if (dy > 1 && dy > 2 * Math.abs(far[0] - conn[0])) {
        downTrib.set(t.key, {
          padreKey: padre.key,
          conn,
          finConn: dc <= dh ? 'cola' : 'cabeza',
        });
        padresDeDown.add(padre.key);
      }
    }
  }
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
      esTrib: boolean;
    }> = [];
    for (const r of ramales) {
      if (r.tipo === 'tributario' && r.padre && idsPorPlano.get(r.pid)?.has(r.padre)) {
        const dn = downTrib.get(r.key);
        if (dn) {
          // Down-trib: extremo de conexión como SALIDA (recibe en la unión del padre) y
          // extremo lejano como ENTRANTE (alimenta la pieza que sigue abajo — cascada).
          const finLejano: 'cola' | 'cabeza' = dn.finConn === 'cola' ? 'cabeza' : 'cola';
          const pLejano = finLejano === 'cola' ? colaDe(r) : cabezaDe(r);
          extremos.push({
            key: r.key,
            pid: r.pid,
            fin: 'cola',
            p: dn.conn,
            dir: null,
            esTrib: true,
          });
          if (pLejano)
            extremos.push({
              key: r.key,
              pid: r.pid,
              fin: finLejano,
              p: pLejano,
              dir: null,
              esTrib: true,
            });
          continue;
        }
        // Lateral con aparato en el extremo de CONEXIÓN (doctrina #14): descarga EN la
        // unión — no clusteriza, su carga sube por plegado al padre.
        const c2 = colaDe(r);
        const h2 = cabezaDe(r);
        if (!c2 || !h2) continue;
        const padre = ramalesPorPlano.get(r.pid)?.get(r.padre || '');
        const dc2 = padre ? distAPadre(c2, padre) : Infinity;
        const dh2 = padre ? distAPadre(h2, padre) : Infinity;
        const aparatoEnConn =
          dc2 <= dh2
            ? r._tribReversed
              ? r.aparatoFin
              : r.aparatoInicio
            : r._tribReversed
              ? r.aparatoInicio
              : r.aparatoFin;
        if ((aparatoEnConn ?? '') !== '') continue;
        // Tributario de CADENA (sin aparato en la conexión): participa con AMBOS extremos —
        // la cascada entre tributarios la resuelve la regla de gravedad del clúster.
        cadenaTrib.add(r.key);
        extremos.push({ key: r.key, pid: r.pid, fin: 'cola', p: c2, dir: dirSal(r), esTrib: true });
        extremos.push({
          key: r.key,
          pid: r.pid,
          fin: 'cabeza',
          p: h2,
          dir: dirEnt(r),
          esTrib: true,
        });
        continue;
      }
      const c = colaDe(r);
      const h = cabezaDe(r);
      if (c)
        extremos.push({ key: r.key, pid: r.pid, fin: 'cola', p: c, dir: dirSal(r), esTrib: false });
      if (h)
        extremos.push({
          key: r.key,
          pid: r.pid,
          fin: 'cabeza',
          p: h,
          dir: dirEnt(r),
          esTrib: false,
        });
    }
    // Contacto trib-sobre-cuerpo-de-trib (orig. usuario T3RAC3 cae en el cuerpo de T2RAC3):
    // extremo virtual del ANFITRIÓN en el punto — el host recibe allí (la gravedad de la
    // cascada decide quién alimenta).
    for (const a of ramales) {
      if (a.tipo !== 'tributario' || !a.pts || a.pts.length < 2) continue;
      if (!idsPorPlano.get(a.pid)?.has(a.padre || '')) continue;
      for (const extremo of [colaDe(a), cabezaDe(a)]) {
        if (!extremo) continue;
        for (const b of ramales) {
          if (b.key === a.key || b.tipo !== 'tributario' || !b.pts || b.pts.length < 2) continue;
          if (b.pid !== a.pid) continue;
          const enBorde =
            Math.hypot(extremo[0] - b.pts[0][0], extremo[1] - b.pts[0][1]) < 0.5 ||
            Math.hypot(
              extremo[0] - b.pts[b.pts.length - 1][0],
              extremo[1] - b.pts[b.pts.length - 1][1],
            ) < 0.5;
          if (enBorde) continue;
          let toca = false;
          for (let i = 0; i < b.pts.length - 1 && !toca; i++) {
            toca = distSeg(extremo, b.pts[i], b.pts[i + 1]) < 0.5;
          }
          if (toca) {
            extremos.push({
              key: b.key,
              pid: b.pid,
              fin: 'cola',
              p: extremo,
              dir: null,
              esTrib: true,
            });
            break;
          }
        }
      }
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
      // Cascada trib-trib (orig. usuario T1RAC3→T4RAC3→T2RAC3): en una unión con ≥2 piezas
      // tributarias, TODO el carga va a la pieza cuyo EXTREMO LEJANO queda más ABAJO
      // (gravedad — la cadena desciende); empate: se prefiere la pieza cuya unión es su
      // COLA (dibujada desde aguas arriba). Sin aristas base.
      const tribEnCluster = [
        ...new Set(
          idxEnt
            .concat(idxSal)
            .filter((i) => extremos[i].esTrib)
            .map((i) => extremos[i].key),
        ),
      ];
      if (tribEnCluster.length >= 2) {
        const ptCluster = extremos[idxs[0]].p;
        const farYDe = (k: string): number => {
          const fuera = extremos.filter(
            (e2) =>
              e2.key === k && Math.hypot(e2.p[0] - ptCluster[0], e2.p[1] - ptCluster[1]) > 0.5,
          );
          if (fuera.length === 0) return ptCluster[1];
          return Math.max(...fuera.map((e2) => e2.p[1]));
        };
        const colaEnCluster = (k: string): boolean => idxSal.some((i) => extremos[i].key === k);
        // Orden por profundidad (extremo lejano más bajo = más abajo en la cadena) y aristas
        // SOLO entre eslabones consecutivos: cada pieza acumula lo de arriba sin dobles.
        const orden = [...tribEnCluster].sort((a, b) => {
          const fa = farYDe(a);
          const fb = farYDe(b);
          if (Math.abs(fa - fb) > 0.5) return fa - fb;
          return colaEnCluster(a) === colaEnCluster(b) ? 0 : colaEnCluster(a) ? 1 : -1;
        });
        if (orden.length >= 2) {
          for (let i = 0; i < orden.length - 1; i++) {
            addArista(orden[i], orden[i + 1], 'carga');
          }
          continue;
        }
      }
      // Doctrina down-trib (2bis): con tributario(s) vertical(es) hacia abajo en el clúster,
      // TODO el carga de los entrantes baja SOLO por ellos — las salidas horizontales no
      // reciben carga ni base (el horizontal es paso, la bajada es la continuación).
      const downs = idxSal.filter((i) => downTrib.has(extremos[i].key));
      // BAJADA GEOMÉTRICA (orig. usuario imagen RAC3): cualquier pieza del nudo cuyo
      // EXTREMO LEJANO queda por debajo del punto de unión (vertical dominante) y sin
      // carga propia (o marcada en corrida previa) es la continuación al piso de abajo —
      // receptora preferente. El FIN (cola/cabeza) es IRRELEVANTE: una bajada dibujada de
      // abajo hacia arriba quedaba clasificada ENTRANTE y la doctrina nunca la veía (orig.
      // usuario: RAC3 seguía habilitada y RAC4 acumulando). Con aparatos propios es lateral
      // de fixture (doctrina vieja).
      const ptJ = extremos[idxs[0]].p;
      const esBajadaGeo = (i: number): boolean => {
        const key = extremos[i].key;
        if (downTrib.has(key)) return false; // su propia rama down-trib ya la maneja
        const piece = ramalPorKey.get(key);
        if (!piece?.pts || piece.pts.length < 2) return false;
        const otro =
          Math.hypot(piece.pts[0][0] - ptJ[0], piece.pts[0][1] - ptJ[1]) > 0.5
            ? piece.pts[0]
            : piece.pts[piece.pts.length - 1];
        const dyGeo = otro[1] - ptJ[1];
        // Vertical ESTRICTA (una diagonal a 45° es lateral, no bajada — clúster mixto).
        if (!(dyGeo > 1 && dyGeo > 2 * Math.abs(otro[0] - ptJ[0]))) return false;
        // Marcada en corrida previa: sigue siendo bajada aunque su disco se haya llenado.
        if (bajadasLibro[key]) return true;
        const cnt = disk[key];
        return !cnt || cntVacio(cnt);
      };
      const bajadasGeo = [
        ...new Set(
          idxSal
            .filter(esBajadaGeo)
            .concat(idxEnt.filter(esBajadaGeo))
            .map((i) => i),
        ),
      ];
      const receptores = [
        ...new Set([
          ...downs,
          ...idxSal.filter((i) => bajadasGeo.includes(i)),
          ...idxEnt.filter((i) => bajadasGeo.includes(i)),
        ]),
      ];
      if (receptores.length > 0) {
        for (const e of idxEnt) {
          const ek = extremos[e].key;
          if (receptores.some((r) => extremos[r].key === ek)) continue;
          if (!cargaAdj.has(ek)) cargaAdj.set(ek, new Set());
          for (const d of receptores) {
            const dk = extremos[d].key;
            if (dk === ek) continue;
            addArista(ek, dk, 'carga');
            cargaAdj.get(ek)!.add(dk);
          }
        }
        // Las salidas horizontales del nudo se CONSUMEN: su carga propia pasa a la bajada.
        for (const s of idxSal) {
          const sk = extremos[s].key;
          if (entSet.has(sk)) continue;
          if (receptores.some((r) => extremos[r].key === sk)) continue;
          const rk = extremos[receptores[0]].key;
          transferencias.set(sk, rk);
        }
        // Marcar las bajadas receptoras (persistente — BAJADAS_RECEPTORAS_KEY, POR CLAVE).
        let marcadas = false;
        for (const ri of receptores) {
          const rkey = extremos[ri].key;
          if (!bajadasLibro[rkey]) {
            bajadasLibro[rkey] = 1;
            marcadas = true;
          }
        }
        if (marcadas) saveToStorage(BAJADAS_RECEPTORAS_KEY, bajadasLibro);
        continue;
      }
      // Unión SOLO DE SALIDAS (orig. usuario RAC6: todas las flechas hacia afuera): la
      // malla clásica duplicaba cada aparato (cada par se alcanzaba por carga Y base).
      // Doctrina: las piezas CON aparato propio alimentan a las VACÍAS — cada aparato
      // baja ×1 y las que tienen no reciben copias (estable entre corridas).
      if (idxEnt.length === 0 && salidas.length >= 2) {
        const manualDePieza = (k: string): Cnt => {
          const cur = disk[k] || {};
          const prev = libros[k] || {};
          const prevTrib = librosTrib[k] || {};
          const out: Cnt = {};
          for (const kk of new Set([
            ...Object.keys(cur),
            ...Object.keys(prev),
            ...Object.keys(prevTrib),
          ])) {
            out[kk] = Math.max(0, (cur[kk] || 0) - (prev[kk] || 0) - (prevTrib[kk] || 0));
          }
          return out;
        };
        const conCarga = salidas.filter((k) => !cntVacio(manualDePieza(k)));
        const vacias = salidas.filter((k) => !conCarga.includes(k));
        for (const s of conCarga) {
          if (!cargaAdj.has(s)) cargaAdj.set(s, new Set());
          for (const v of vacias) {
            addArista(s, v, 'base');
            cargaAdj.get(s)!.add(v);
          }
        }
        continue;
      }
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
    // SIN campo aparatoInicio/Fin NO hay aparato propio (orig. usuario dump 2026-10-15:
    // RAC2/RAC4/RAC5 arrastraban conteos fantasma de doctrinas viejas sin campo — el campo
    // que escribe la asignación es la única verdad de lo propio; el resto se limpia).
    // Los espejos de salida (cross-floor) tampoco tienen campo y tampoco son manual: caen
    // aquí de forma correcta. Solo se respalda lo que realmente se borra para recuperar
    // (ver APARATOS_RESIDUO_BAK_KEY: si la limpieza fue ilegítima, copiar su valor de vuelta
    // a `aparatos_by_tramo_v2` restaura los conteos).
    if (!r.aparatoInicio && !r.aparatoFin) {
      // Mecanismo, no residuo: el down-trib y las consumidas/padres reciben carga por
      // transferencia — su "crudo" reaparece cada corrida por diseño; respaldarlo/loguearlo
      // spamearía el backup y la consola en cada propagación estable.
      const esMecanismo =
        downTrib.has(r.key) || transferencias.has(r.key) || padresDeDown.has(r.key);
      if (!cntVacio(crudo) && !esMecanismo) {
        try {
          const bak = loadFromStorage<Record<string, Cnt>>(APARATOS_RESIDUO_BAK_KEY, {}) || {};
          bak[r.key] = { ...(bak[r.key] || {}), ...crudo };
          saveToStorage(APARATOS_RESIDUO_BAK_KEY, bak);
        } catch {
          /* sin respaldo (tests sin storage real) */
        }
        devError('[CF-PROP] residuo sin campo limpiado:', r.key, JSON.stringify(crudo));
      }
      manualCrudoDe.set(r.key, {});
      continue;
    }
    manualCrudoDe.set(r.key, cntVacio(crudo) ? {} : crudo);
  }
  // NOTA poda-por-crudo retirada: el manual del receptor incluye lo transferido de
  // corridas previas y es indistinguible de asignación manual en disco — podar por crudo
  // desestabiliza (oscila). El fósil por borrado lo cubre la poda de ausentes de arriba;
  // el receptor con aparato manual queda documentado como lateral pendiente (el panel lo
  // bloquea vía esPropagado en la mayoría de vías).
  // Hijos tributarios por padre (mismo plano): `${id}|${pid}`.
  const hijosDe = new Map<string, string[]>();
  const porKey = new Map(ramales.map((r) => [r.key, r]));
  for (const [consumida, receptor] of transferencias) {
    if (!hijosDe.has(receptor)) hijosDe.set(receptor, []);
    if (!hijosDe.get(receptor)!.includes(consumida)) hijosDe.get(receptor)!.push(consumida);
  }
  for (const t of ramales) {
    if (t.tipo !== 'tributario' || !t.padre) continue;
    const padreKey = ramalesPorPlano.get(t.pid)?.get(t.padre || '')?.key;
    if (!padreKey) continue; // huérfano/legacy: participa en clústeres como fallback
    // Consumida por una bajada: su carga ya va al receptor (evitar doble plegado).
    if (transferencias.has(t.key)) continue;
    // Cadena: su carga viaja por las aristas de cascada — plegar sería doble conteo.
    if (cadenaTrib.has(t.key)) continue;
    // Down-trib: pliegue INVERTIDO — el PADRE es su hijo (descarga toda su carga en él,
    // 2bis); no sube al padre como un tributario normal.
    if (downTrib.has(t.key)) {
      if (!hijosDe.has(t.key)) hijosDe.set(t.key, []);
      if (!hijosDe.get(t.key)!.includes(padreKey)) hijosDe.get(t.key)!.push(padreKey);
      continue;
    }
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
  // Fold invertido de cada down-trib (padre + consumidas de su unión): el libro del down
  // debe registrar EXACTO lo que su disco suma (si no, fase A diverge +consumida/corrida).
  const foldNDe = new Map<string, Cnt>();
  for (const key of ordenHojasPrimero) {
    let fold: Cnt = {};
    for (const h of hijosDe.get(key) || []) {
      // Consumida transferida a esta clave: su carga llega por el DFS como heredado del
      // receptor (ver calcDe) — plegarla aquí también la duplicaría en Σ y la escondería
      // del libro `her` que lee el panel (orig. test bajada-RAC3: lavav ×2).
      if (transferencias.get(h) === key) continue;
      fold = sumaCnt(fold, sumaCnt(manualDe.get(h) || {}, foldDe.get(h) || {}));
    }
    foldDe.set(key, fold);
    const crudo = manualCrudoDe.get(key) || {};
    const dn = downTrib.get(key);
    if (dn) {
      // Down-trib: TRANSFERENCIA — todo lo que cuelga de él (su padre y las piezas
      // consumidas en la unión) pasa a su clave por el fold invertido (con libro
      // librosTrib — idempotente). Los hijos CONSERVAN lo propio (patrón tributario).
      let foldN: Cnt = {};
      for (const h of hijosDe.get(key) || []) {
        foldN = sumaCnt(foldN, sumaCnt(manualDe.get(h) || {}, foldDe.get(h) || {}));
      }
      manualDe.set(key, sumaCnt(manualCrudoDe.get(key) || {}, foldN));
      foldNDe.set(key, foldN);
      bajadasDown.add(key);
      // Persistente: sin esto el down-trib aislado (sin clúster ≥2) perdía su marca al
      // recargar y la doctrina se auto-cancelaba en la corrida 2.
      if (!bajadasLibro[key]) {
        bajadasLibro[key] = 1;
        saveToStorage(BAJADAS_RECEPTORAS_KEY, bajadasLibro);
      }
      continue;
    }
    const manual: Cnt = {};
    for (const k of new Set([...Object.keys(crudo), ...Object.keys(fold)])) {
      manual[k] = Math.max(0, (crudo[k] || 0) - (fold[k] || 0));
    }
    // NOTA (transferencias bajada): la carga de las consumidas NO se suma aquí — llega por
    // el DFS como heredado del receptor (base de la consumida, ver calcDe). Sumarla aquí
    // TAMBIÉN duplicaba corrida tras corrida (orig. test bajada-RAC3: lavav ×3).
    manualDe.set(key, cntVacio(manual) ? {} : manual);
  }

  // 5) DFS topológico con corte de ciclo: un ramal en pila (ciclo) aporta solo su base.
  //    Las aristas 'carga' aportan el total; las 'base', solo la base (sin inflación).
  //    Doctrina mostrador (orig. usuario: lo propagado por tributarios cuenta en propia):
  //    la parte que llega por arista DESDE un tributario se registra en el libro TRIB
  //    (plegado, visible como propia), no en el HER (heredada) — el tributario es parte del
  //    subsistema del tramo, no un aguas-arriba ajeno. Lo heredado-ajeno que el trib a su
  //    vez transporta sí va al HER (honesto: no nació ahí).
  const totalDe = new Map<string, Cnt>(); // carga que transporta (base + heredado)
  const heredadoDe = new Map<string, Cnt>();
  const tribFoldDe = new Map<string, Cnt>(); // own trib por arista directa (libro TRIB)
  const estado = new Map<string, 0 | 1 | 2>(); // 0 nuevo · 1 en pila · 2 resuelto
  const baseDe = (key: string): Cnt =>
    sumaCnt(sumaCnt(manualDe.get(key) || {}, foldDe.get(key) || {}), tribFoldDe.get(key) || {});
  // Lo propio-real de una fuente trib (sin lo heredado-ajeno que transporta): crudo más
  // lo trib-recibido. NO manualDe: el down-trib absorbe el fold invertido en su manual y
  // hay que pelarlo (si no, duplica corrida a corrida lo del padre); lo trib-recibido
  // (tina de T5 en T1) sí viaja porque el receptor lo muestra como propio.
  const ownTribDe = (key: string): Cnt =>
    sumaCnt(
      sumaCnt(manualCrudoDe.get(key) || {}, foldDe.get(key) || {}),
      tribFoldDe.get(key) || {},
    );
  const calcDe = (key: string): Cnt => {
    const r = porKey.get(key);
    if (!r) return {};
    const st = estado.get(r.key) ?? 0;
    if (st === 2) return totalDe.get(r.key) || {};
    if (st === 1) return bajadasDown.has(r.key) ? manualDe.get(r.key) || {} : baseDe(r.key); // ciclo
    estado.set(r.key, 1);
    let h: Cnt = { ...(upMonte.get(r.key) || {}) };
    let hTrib: Cnt = {};
    for (const a of aristasPorDestino.get(r.key) || []) {
      const fromTrib = (porKey.get(a.from)?.tipo || '') === 'tributario';
      if (!fromTrib) {
        h = a.tipo === 'carga' ? sumaCnt(h, calcDe(a.from)) : sumaCnt(h, baseDe(a.from));
        continue;
      }
      // calcDe primero: puebla heredadoDe/tribFoldDe del trib (orden-independiente;
      // en ciclo el corte aporta solo su base, misma semántica que ramales).
      calcDe(a.from);
      h = sumaCnt(h, heredadoDe.get(a.from) || {});
      hTrib = sumaCnt(hTrib, ownTribDe(a.from));
    }
    // Consumidas transferidas a esta bajada (orig. usuario RAC4/RAC3): su base cuenta como
    // heredado del receptor — ellas CONSERVAN lo propio en su clave (asignar en RAC4 se ve
    // en su panel) y el panel/Σ las descuentan vía el libro `her`. El down-trib ya la trae
    // por su fold invertido (foldN): sumarla aquí también la duplicaría (tina ×2).
    if (!downTrib.has(r.key)) {
      for (const [consumida, receptor] of transferencias) {
        if (receptor === r.key) h = sumaCnt(h, baseDe(consumida));
      }
    }
    // Down-trib: el fold invertido ya vive DENTRO de su manual — la base es solo manual
    // (contar el foldDe también duplicaba la transferencia en cada corrida).
    const base = bajadasDown.has(r.key) ? manualDe.get(r.key) || {} : baseDe(r.key);
    estado.set(r.key, 2);
    heredadoDe.set(r.key, h);
    tribFoldDe.set(r.key, hTrib);
    const tot = sumaCnt(sumaCnt(base, h), hTrib);
    totalDe.set(r.key, tot);
    return tot;
  };
  for (const r of ramales) calcDe(r.key);

  // 5bis) Refresco de ucAplicado de montantes que RECIBEN (orig. usuario "+1 lavadero en
  //  MAC1"): su carga = la suma de los ramales que le llegan (recibeDeIds o contacto
  //  geométrico en su cabeza) — ANTES quedaba congelada en la asociación y se ponía rancia
  //  cuando la cadena cambiaba. Los montantes FUENTE (alimentaIds) no se tocan: su
  //  ucAplicado es la carga que ENTREGA al piso, no la que recibe.
  {
    const cambios = new Map<string, Map<string, Cnt>>();
    const macLog: string[] = [];
    for (const b of bajes) {
      if (b.tipo !== 'montante') continue;
      if (!(b.recibeDeIds || []).length) continue;
      const en = new Map<string, number[]>();
      if (b.pts && b.pts.length >= 2) en.set(`${b.pts[0][0]}|${b.pts[0][1]}`, b.pts[0]);
      let uc: Cnt = {};
      const vistos = new Set<string>();
      const alimenta = (p: number[] | undefined): void => {
        if (!p) return;
        for (const r of ramales) {
          if (r.pid !== b.pid || vistos.has(r.key) || !r.pts || r.pts.length < 2) continue;
          const toca =
            Math.hypot(r.pts[0][0] - p[0], r.pts[0][1] - p[1]) < 2 ||
            Math.hypot(r.pts[r.pts.length - 1][0] - p[0], r.pts[r.pts.length - 1][1] - p[1]) < 2;
          if (!toca) continue;
          vistos.add(r.key);
          uc = sumaCnt(uc, totalDe.get(r.key) || {});
        }
      };
      const rids = b.recibeDeIds || [];
      for (const rid of rids) {
        const r = ramales.find((x) => x.pid === b.pid && x.id === rid);
        if (r) {
          vistos.add(r.key);
          uc = sumaCnt(uc, totalDe.get(r.key) || {});
        }
      }
      for (const p of en.values()) alimenta(p);
      // Forma anidada por clave (la que escriben la asociación y lee upMonte).
      const ucNido = { [`${net}_${b.id}_${b.pid}`]: uc };
      const antes = JSON.stringify((b.ucAplicado || {})[`${net}_${b.id}_${b.pid}`] || {});
      if (JSON.stringify(uc) === antes) continue;
      macLog.push(b.code + ' ← ' + JSON.stringify(uc) + ' (antes ' + antes + ')');
      b.ucAplicado = ucNido;
      if (!cambios.has(b.pid)) cambios.set(b.pid, new Map());
      cambios.get(b.pid)!.set(b.id, uc);
    }
    diag.macRefresh = macLog;
    for (const [pid, monts] of cambios) {
      const raw = loadFromStorage<unknown>(`${TRAZOS_PREFIX}${pid}`, null);
      if (!raw) continue;
      let d = raw as {
        bajantes?: Array<{ id: string; ucAplicado?: Record<string, Cnt> }>;
      };
      if (typeof d === 'string') {
        try {
          d = JSON.parse(d);
        } catch {
          continue;
        }
      }
      if (!d || !d.bajantes) continue;
      for (const b of d.bajantes) {
        const uc = monts.get(b.id);
        if (uc) b.ucAplicado = { [`${net}_${b.id}_${pid}`]: uc };
      }
      saveToStorage(`${TRAZOS_PREFIX}${pid}`, d);
    }
  }

  // 6) Delta idempotente por clave + libros nuevos. Solo escribe si algo cambió: en estado
  //    estable actual = manual + fold + her y los libros coinciden → cero escrituras.
  //    El fold del libro fusiona plegado + aristas-trib (ambos cuentan como propia).
  let dirty = false;
  for (const r of ramales) {
    const her = limpiar(heredadoDe.get(r.key) || {});
    // Down-trib: su libro registra el fold invertido (lo mismo que su disco suma) — con el
    // foldDe general (que excluye consumidas) fase A divergía +consumida/corrida.
    const foldRecibido = bajadasDown.has(r.key)
      ? foldNDe.get(r.key) || {}
      : foldDe.get(r.key) || {};
    const fold = limpiar(sumaCnt(foldRecibido, tribFoldDe.get(r.key) || {}));
    const prev = libros[r.key] || {};
    const prevFold = librosTrib[r.key] || {};
    const cur = disk[r.key] || {};
    // Down-trib: el fold invertido ya vive dentro de su manual — la base del escritor es
    // manual MÁS lo trib-recibido por arista directa (sin él, la cascada que baja por un
    // down-trib se escribía al libro pero jamás al disco, orig. test cascada T2RAC3).
    // Contar ADEMÁS el foldDe duplicaba la transferencia (tina ×2) — ese sí queda fuera.
    // Límite conocido: trib que A LA VEZ es hijo plegado y trae arista al mismo down-padre
    // contaría doble (0 casos en la suite; el diag herTrib lo delataría).
    const base = bajadasDown.has(r.key)
      ? sumaCnt(manualDe.get(r.key) || {}, tribFoldDe.get(r.key) || {})
      : sumaCnt(manualDe.get(r.key) || {}, fold);
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
  diag.diskFinal = disk;
  diag.libros = libros;
  diag.librosTrib = librosTrib;
  diag.transferencias = [...transferencias.entries()];
  diag.aristas = aristas.map((a) => a.tipo + ':' + a.from + '→' + a.to);
  diag.bajadas = [...bajadasDown];
  // Bajantes AL FINAL: el ucAplicado refrescado por 5bis ya está aplicado.
  diag.bajantes = bajes.map((b) => ({
    id: b.id,
    code: b.code || b.id,
    tipo: b.tipo || '',
    x: b.x ?? 0,
    y: b.y ?? 0,
    alimentaIds: b.alimentaIds || [],
    recibeDeIds: b.recibeDeIds || [],
    ucAplicado: b.ucAplicado || {},
  }));
  ultimaDiag = diag;
}

/** ¿La red es de presión y por tanto propaga aparatos? Sí para agua fría, caliente y gas (af (Agua Fria)/ac (Agua Caliente)/gas (Gas)). */
export function esRedAparatosPresion(net: string): net is 'af' | 'ac' | 'gas' {
  return net === 'af' || net === 'ac' || net === 'gas';
}

/**
 * ¿La clave es un RECEPTOR (bajada o trib marcado)? Hoy sin lectores en el panel
 * (el bloqueo usa heredados no vacíos) — se conserva como API para el criterio por libro.
 * @param key - clave `net_id_pid` del tramo.
 * @returns true si el libro `bajadas_receptoras_v1` la marca.
 */
export function esReceptorPropagacion(key: string): boolean {
  const libro = loadFromStorage<Record<string, number>>(BAJADAS_RECEPTORAS_KEY, {}) || {};
  return !!libro[key];
}

/** Cuaderno de qué heredó cada tramo (sin contar el plegado de sus tributarios): lo usan el panel y la tabla de UC para mostrar "(+N)". */
export function leerHeredadosPresion(key: string): Cnt {
  const libros = loadFromStorage<Record<string, Cnt>>(HEREDADOS_KEY, {}) || {};
  return libros[key] || {};
}

/**
 * Plegado que recibió el tramo de sus tributarios (libro aparatos_heredados_trib_v1). Ej: RAC2 con T1RAC5 plegado -> {lavamanos: 1}.
 * @param key - clave `net_id_pid` del tramo.
 * @returns mapa aparato->unidades plegadas.
 */
export function leerFoldTribPresion(key: string): Cnt {
  const libros = loadFromStorage<Record<string, Cnt>>(HEREDADOS_TRIB_KEY, {}) || {};
  return libros[key] || {};
}

/**
 * Lee los dos libros de la propagación de UNA vez (una sola parseada por store): leerlos
 * por tramo serían N parseadas por render. Ej: con 200 tramos evita 400 JSON.parse.
 * @returns par de mapas (heredados, plegado) tal cual viven en storage.
 */
export function leerLibrosPresion(): {
  her: Record<string, Cnt>;
  fold: Record<string, Cnt>;
} {
  return {
    her: loadFromStorage<Record<string, Cnt>>(HEREDADOS_KEY, {}) || {},
    fold: loadFromStorage<Record<string, Cnt>>(HEREDADOS_TRIB_KEY, {}) || {},
  };
}

/**
 * UC (Unidades de Consumo) propias del tramo: lo que sirve él mismo, sin herencia de uniones ni plegado de tributarios. Ej: RAC5 con carga {lavamanos: 1} heredada -> propia {}.
 * @param carga - conteo de la clave (propio + heredado + plegado).
 * @param her - libro aparatos_heredados_v1 (herencia de uniones y montantes).
 * @param fold - libro aparatos_heredados_trib_v1 (plegado de tributarios).
 * @returns mapa aparato->unidades propias (nunca negativo).
 */
export function udPropiaDe(carga: Cnt, her: Cnt, fold: Cnt): Cnt {
  const out: Cnt = {};
  for (const k of new Set([...Object.keys(carga), ...Object.keys(her), ...Object.keys(fold)])) {
    const v = (carga[k] || 0) - (her[k] || 0) - (fold[k] || 0);
    if (v > 0) out[k] = v;
  }
  return out;
}
