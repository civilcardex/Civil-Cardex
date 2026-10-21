/** Tipos y helpers puros de la propagación de presión (sin I/O): los compares y las aristas los comparten todas las fases. */
export type Cnt = Record<string, number>;

export interface RawRam {
  id: string;
  net: string;
  tipo?: string;
  pts?: number[][];
  _tribReversed?: boolean;
  ini?: string;
  fin?: string;
  /** Tributario: id del ramal padre en cuyo cuerpo desagua - sus aparatos SUBEN al padre para no contarse dos veces. */
  padre?: string | null;
  /** MergesFrom (genealogia del split: qué piezas se partieron para crear esta): pista de continuación, hoy solo informativa. */
  mergesFrom?: string[];
  /** Aparato asignado por extremo (dónde quedó dibujado): el down-trib y el lateral se distinguen
   *  por SI el aparato vive en el extremo de conexión con el padre. */
  aparatoInicio?: string;
  aparatoFin?: string;
}

export interface RawBaj {
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
  /** Asociación entre pisos (`${plan}|${id}` del elemento superior): su libro ucAplicado lo
   *  gobiernan apply/espejos/clear de la asociación - el refresco 5bis no lo toca. */
  origenId?: string | null;
  /** Asociación a bomba (misma protección del libro que origenId). */
  bombaEnId?: string | null;
  /** Trazo del montante (bajada entre pisos): para contacto geométrico con su alimentador. */
  pts?: number[][];
}

/** Ramal con su clave y su piso (la partición por plano: los ids se repiten entre pisos). */
export type RamalP = RawRam & { key: string; pid: string };
/** Bajante/montante con su piso. */
export type BajanteP = RawBaj & { pid: string };
/** Arista del grafo de propagación: `carga` = el total, `base` = solo lo propio. */
export interface Arista {
  from: string;
  to: string;
  tipo: 'carga' | 'base';
}
/** Tributario vertical abajo: continuación receptora de su unión. */
export interface DownTrib {
  padreKey: string;
  conn: number[];
  finConn: 'cola' | 'cabeza';
}

export const sumaCnt = (a: Cnt, b: Cnt): Cnt => {
  const out: Cnt = { ...a };
  for (const k of Object.keys(b)) out[k] = (out[k] || 0) + (b[k] || 0);
  return out;
};

export const cntVacio = (c: Cnt): boolean => Object.values(c).every((v) => !v);

/** Quita del mapa los aparatos que quedaron en 0 (al restar el libro previo sobran ceros). */
export const limpiar = (c: Cnt): Cnt => {
  const out: Cnt = {};
  for (const [k, v] of Object.entries(c)) if (v > 0) out[k] = v;
  return out;
};

export const cntIgual = (a: Cnt, b: Cnt): boolean => {
  const ka = Object.keys(a).filter((k) => a[k] > 0);
  const kb = Object.keys(b).filter((k) => b[k] > 0);
  return ka.length === kb.length && ka.every((k) => (a[k] || 0) === (b[k] || 0));
};

/** Cola de flujo del ramal: por dónde SALE el agua (el primer punto, o el último si el trazo está invertido, _tribReversed (flag de flujo invertido en tributario)). */
export function colaDe(r: RawRam): number[] | null {
  if (!r.pts || r.pts.length < 2) return null;
  return r._tribReversed ? r.pts[r.pts.length - 1] : r.pts[0];
}

/** Cabeza de flujo del ramal: por dónde ENTRA el agua (el extremo opuesto a la cola). */
export function cabezaDe(r: RawRam): number[] | null {
  if (!r.pts || r.pts.length < 2) return null;
  return r._tribReversed ? r.pts[0] : r.pts[r.pts.length - 1];
}

/** Suma del libro de herencia por aparato, tomando el MÁXIMO de cada entrada (el libro tiene
 *  una entrada por pieza que recibió la carga y todas llevan la misma). */
export function libroHeredadoDe(libro: Record<string, Record<string, number>> | undefined): Cnt {
  const out: Cnt = {};
  for (const m of Object.values(libro || {}))
    for (const [k, v] of Object.entries(m)) out[k] = Math.max(out[k] || 0, Number(v) || 0);
  return out;
}

/**
 * Estado compartido de la propagación: lo que cada fase produce y la siguiente consume.
 * Las fases lo reciben por parametro (nada global) para que se puedan probar por separado.
 */
export interface Ctx {
  net: 'af' | 'ac' | 'gas';
  disk: Record<string, Cnt>;
  libros: Record<string, Cnt>;
  librosTrib: Record<string, Cnt>;
  bajadasLibro: Record<string, number>;
  diag: Record<string, unknown>;
  ramales: RamalP[];
  bajes: BajanteP[];
  cargaBaj: Map<string, Cnt>;
  downTrib: Map<string, DownTrib>;
  padresDeDown: Set<string>;
  ramalesPorPlano: Map<string, Map<string, RamalP>>;
  aristas: Arista[];
  aristasPorDestino: Map<string, Arista[]>;
  cadenaTrib: Set<string>;
  transferencias: Map<string, string>;
  upMonte: Map<string, Cnt>;
  manualCrudoDe: Map<string, Cnt>;
  heredadoAsocDe: Map<string, Cnt>;
  foldDe: Map<string, Cnt>;
  manualDe: Map<string, Cnt>;
  /** Down-tribs receptores: su BASE en el DFS es SOLO su manual (el fold invertido ya vive
   *  dentro del manual - contarlo también duplicaría cada corrida). */
  bajadasDown: Set<string>;
  foldNDe: Map<string, Cnt>;
  totalDe: Map<string, Cnt>;
  heredadoDe: Map<string, Cnt>;
  tribFoldDe: Map<string, Cnt>;
  /** Índice id → pieza (para el DFS). */
  porKey: Map<string, RamalP>;
}

/** Distancia de un punto al segmento AB (proyeción sobre la recta). */
export const distSeg = (p: number[], a: number[], b: number[]): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t =
    l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

/** Distancia de un punto al trazo del padre (el segmento más cercano). */
export const distAPadre = (p: number[], padre: { pts?: number[][] }): number => {
  if (!padre.pts || padre.pts.length < 2) return Infinity;
  let m = Infinity;
  for (let i = 0; i < padre.pts.length - 1; i++) {
    m = Math.min(m, distSeg(p, padre.pts[i], padre.pts[i + 1]));
  }
  return m;
};

/**
 * Regla 3b (la ENTREGA): ¿el bajante/montante le entrega su carga a este ramal? ÚNICA fuente —
 * la usan la fase 3b de la propagación, el cierre de la herencia entre pisos y el panel.
 *  - Si el ramal ENTRA por la cabeza (o `fin` = su código) → NUNCA: es aguas arriba, y
 *    devolverle la carga cerraría un ciclo (el montante se alimentaría de sí mismo) y sus
 *    conteos se multiplicaban en cada corrida (orig. usuario: "se triplican").
 *  - Si SALE por la cola (o `ini` = su código, o el bajante lo lista en `alimentaIds`) → sí.
 *  - O está asociado a mano (`asocManual`) sin dirección de entrada → sí.
 */
export function bajanteEntregaSuCargaAlRamal(args: {
  ramalId: string;
  ramalIni?: string;
  ramalFin?: string;
  cola: number[] | null;
  cabeza: number[] | null;
  bajCode: string;
  bajX?: number;
  bajY?: number;
  alimentaIds?: string[];
  recibeDeIds?: string[];
  asocManual?: string[];
}): boolean {
  const { ramalId, ramalIni, ramalFin, cola, cabeza, bajCode, bajX, bajY } = args;
  const dist = (p: number[] | null): boolean =>
    !!p && bajX != null && bajY != null && Math.hypot(p[0] - bajX, p[1] - bajY) <= 2;
  // Orden de precedencia (concilia F-1 con la doctrina del apply entre pisos):
  //  1. `fin` = código del montante → el apply lo escribió a propósito: NUNCA recibe la
  //     carga por arriba (sus UDs llegan por el libro heredado — sin esto se duplicaba).
  //  2. Asociación MANUAL del checkbox (SecMontantes; no escribe fin) → hereda siempre (F-1).
  //  3. Veto direccional: ENTRA (cabeza o `recibeDeIds`) → no recibe; el resto, sí.
  if (ramalFin && ramalFin === bajCode) return false;
  if ((args.asocManual || []).includes(ramalId)) return true;
  const entraAlMonte =
    dist(cabeza) ||
    (ramalFin && ramalFin === bajCode) ||
    (args.recibeDeIds || []).includes(ramalId);
  if (entraAlMonte) return false; // aguas arriba
  if (dist(cola) || (ramalIni && ramalIni === bajCode)) return true;
  return (args.alimentaIds || []).includes(ramalId);
}
