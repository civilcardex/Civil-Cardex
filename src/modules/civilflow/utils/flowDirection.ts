import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../lib/PlanoEngine/PlanoState';

const BLOCKED_MESSAGE =
  'El bajante con dirección "baja" solo puede recibir flujo. Conecta el ramal al extremo final (no al inicio).';

const SUBE_BLOCKED_MESSAGE =
  'El bajante con dirección "sube" solo puede entregar flujo. Conecta el ramal al extremo inicial (no al final).';

/**
 * Regla central para conectar un extremo de ramal a un bajante según la dirección de flujo.
 * Devuelve false si enrutaría el flujo al revés por el bajante: un INICIO de ramal en un
 * bajante 'baja' (que solo recibe), o un FIN de ramal en un bajante 'sube' (que solo emite).
 * Centralizada aquí para que todos los caminos que asignan ini/fin apliquen la misma regla.
 * @param engine  Instancia del núcleo del engine.
 * @param r       Ramal cuyo extremo se está conectando.
 * @param epIdx   Qué extremo: 0 para pts[0] (INICIO — el lado de origen), lastIdx para pts[fin].
 * @param b       Bajante al que se está conectando.
 * @returns true si la conexión está bien; false si debe bloquearse.
 */
export function isRamalBajanteConnectionAllowed(
  engine: IPlanoEngineCore,
  _r: PlanoRamal,
  epIdx: 0 | number,
  b: PlanoBajante,
): boolean {
  if (epIdx === 0 && b.direccion === 'baja') {
    if (engine.triggerAlert) {
      engine.triggerAlert('Dirección de flujo inconsistente', BLOCKED_MESSAGE);
    }
    return false;
  }
  if (b.direccion === 'sube' && epIdx !== 0) {
    if (engine.triggerAlert) {
      engine.triggerAlert('Dirección de flujo inconsistente', SUBE_BLOCKED_MESSAGE);
    }
    return false;
  }
  return true;
}

/**
 * En una división de mitad de cuerpo AF/AC/gas, decide cuál de los tres ramales muestra el
 * total UC combinado: el que discrepa en dirección de flujo de los otros dos (siempre hay
 * uno, porque la unión necesita al menos una salida). Si no se puede resolver (unión
 * degenerada), cae al id de `existing` para que los llamadores tengan un default sensato.
 * @param jc - Coordenadas del punto de unión.
 * @param existing - El ramal pre-división (mitad aguas arriba tras la truncación).
 * @param downstream - El ramal auto-creado que continúa más allá de `jc`.
 * @param incoming - El ramal cuyo extremo aterrizó en el cuerpo de `existing`, si es resoluble.
 * @param tol - Tolerancia de distancia para "el origen/destino de este ramal está en jc".
 * @returns El id del ramal que debería mostrar el total combinado.
 */
export function resolveJunctionEntrant(
  jc: number[],
  existing: { id: string; pts?: number[][]; _tribReversed?: boolean },
  downstream: { id: string; pts?: number[][]; _tribReversed?: boolean },
  incoming: { id: string; pts?: number[][]; _tribReversed?: boolean } | undefined,
  tol = 2.0,
): string {
  if (!existing.pts || existing.pts.length < 2) return existing.id;
  if (!downstream.pts || downstream.pts.length < 2) return existing.id;
  if (!incoming || !incoming.pts || incoming.pts.length < 2) return existing.id;
  const flowsOutOfJc = (ram: { pts: number[][]; _tribReversed?: boolean }) => {
    const origin = ram._tribReversed ? ram.pts[ram.pts.length - 1] : ram.pts[0];
    return Math.hypot(origin[0] - jc[0], origin[1] - jc[1]) < tol;
  };
  const candidates = [
    { id: existing.id, pts: existing.pts, _tribReversed: existing._tribReversed },
    { id: downstream.id, pts: downstream.pts, _tribReversed: downstream._tribReversed },
    { id: incoming.id, pts: incoming.pts, _tribReversed: incoming._tribReversed },
  ];
  const flags = candidates.map(flowsOutOfJc);
  const outCount = flags.filter(Boolean).length;
  if (outCount === 1) return candidates[flags.indexOf(true)].id;
  if (outCount === 2) return candidates[flags.indexOf(false)].id;
  return existing.id;
}

export function junctionHasOutgoingFlow(
  ramales: Pick<PlanoRamal, 'net' | 'pts' | '_tribReversed'>[],
  net: string,
  pt: number[],
  tol = 0.5,
): boolean {
  let touching = 0;
  let hasOutgoing = false;
  for (const r of ramales) {
    if (r.net !== net || !r.pts || r.pts.length < 2) continue;
    const p0 = r.pts[0];
    const p1 = r.pts[r.pts.length - 1];
    const originPt = r._tribReversed ? p1 : p0;
    const destPt = r._tribReversed ? p0 : p1;
    const atOrigin = Math.hypot(originPt[0] - pt[0], originPt[1] - pt[1]) < tol;
    const atDest = Math.hypot(destPt[0] - pt[0], destPt[1] - pt[1]) < tol;
    let bodyTouch = false;
    if (!atOrigin && !atDest) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, ay] = r.pts[i];
        const [bx, by] = r.pts[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 0.0001) continue;
        const t = ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / lenSq;
        if (t < 0 || t > 1) continue;
        const px = ax + t * dx;
        const py = ay + t * dy;
        if (Math.hypot(pt[0] - px, pt[1] - py) < tol) {
          bodyTouch = true;
          break;
        }
      }
    }
    if (!atOrigin && !atDest && !bodyTouch) continue;
    touching++;
    // Un ramal que PASA POR pt a mitad de cuerpo (no termina ahí) continúa más allá de la unión
    // en su propia dirección de flujo — esa continuación es en sí una pierna saliente, igual que
    // un ramal cuyo origen propio queda exactamente en pt. Solo un ramal cuyo DESTINO de flujo
    // (y nada más allá) cae en pt no aporta pierna saliente aquí.
    if (atOrigin || bodyTouch) hasOutgoing = true;
  }
  if (touching < 2) return true;
  return hasOutgoing;
}

/**
 * Regla de unión AF/AC/gas cuando un TRIBUTARIO participa. Su dirección es fija (fluye desde
 * la unión hacia el aparato), así que las dos mitades del ramal partido deben repartir una
 * entrada y una salida entre sí; si el usuario invirtió solo una, se rompe el reparto y la
 * regla general no lo detecta — aquí se exige exactamente una entrada cuando hay tributario.
 * @param ramales - Ramales a considerar (mismo net que `net`).
 * @param net - Red a validar ('af' | 'ac' | 'gas').
 * @param pt - Punto de la unión.
 * @param tol - Tolerancia de distancia para "este extremo cae en pt".
 * @returns true si la unión respeta la regla (o no aplica).
 */
export function directNeighborRamales(
  ramales: Pick<PlanoRamal, 'id' | 'net' | 'pts'>[],
  ramal: Pick<PlanoRamal, 'id' | 'net' | 'pts'>,
  tol = 0.5,
): Pick<PlanoRamal, 'id' | 'net' | 'pts'>[] {
  if (!ramal.pts || ramal.pts.length < 2) return [];
  const a0 = ramal.pts[0];
  const a1 = ramal.pts[ramal.pts.length - 1];
  const touch = (ep: number[]) =>
    Math.hypot(a0[0] - ep[0], a0[1] - ep[1]) < tol ||
    Math.hypot(a1[0] - ep[0], a1[1] - ep[1]) < tol;
  return ramales.filter(
    (r) =>
      r.id !== ramal.id &&
      r.net === ramal.net &&
      r.pts &&
      r.pts.length >= 2 &&
      (touch(r.pts[0]) || touch(r.pts[r.pts.length - 1])),
  );
}

export function junctionHasIncomingFlow(
  ramales: Pick<PlanoRamal, 'net' | 'pts' | '_tribReversed'>[],
  net: string,
  pt: number[],
  tol = 0.5,
): boolean {
  let touching = 0;
  let hasIncoming = false;
  for (const r of ramales) {
    if (r.net !== net || !r.pts || r.pts.length < 2) continue;
    const p0 = r.pts[0];
    const p1 = r.pts[r.pts.length - 1];
    const originPt = r._tribReversed ? p1 : p0;
    const destPt = r._tribReversed ? p0 : p1;
    const atOrigin = Math.hypot(originPt[0] - pt[0], originPt[1] - pt[1]) < tol;
    const atDest = Math.hypot(destPt[0] - pt[0], destPt[1] - pt[1]) < tol;
    let bodyTouch = false;
    if (!atOrigin && !atDest) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, ay] = r.pts[i];
        const [bx, by] = r.pts[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 0.0001) continue;
        const t = ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / lenSq;
        if (t < 0 || t > 1) continue;
        const px = ax + t * dx;
        const py = ay + t * dy;
        if (Math.hypot(pt[0] - px, pt[1] - py) < tol) {
          bodyTouch = true;
          break;
        }
      }
    }
    if (!atOrigin && !atDest && !bodyTouch) continue;
    touching++;
    if (atDest || bodyTouch) hasIncoming = true;
  }
  if (touching < 2) return true;
  return hasIncoming;
}

export function junctionRespectsTributarioDirection(
  ramales: Pick<PlanoRamal, 'net' | 'pts' | '_tribReversed' | 'tipo'>[],
  net: string,
  pt: number[],
  tol = 0.5,
): boolean {
  let touching = 0;
  let hasTributario = false;
  let entradas = 0;
  for (const r of ramales) {
    if (r.net !== net || !r.pts || r.pts.length < 2) continue;
    const p0 = r.pts[0];
    const p1 = r.pts[r.pts.length - 1];
    const originPt = r._tribReversed ? p1 : p0;
    const destPt = r._tribReversed ? p0 : p1;
    const atOrigin = Math.hypot(originPt[0] - pt[0], originPt[1] - pt[1]) < tol;
    const atDest = Math.hypot(destPt[0] - pt[0], destPt[1] - pt[1]) < tol;
    if (!atOrigin && !atDest) continue;
    touching++;
    if (r.tipo === 'tributario') hasTributario = true;
    if (atDest && !atOrigin) entradas++;
  }
  if (touching < 2) return true;
  if (!hasTributario) return junctionHasOutgoingFlow(ramales, net, pt, tol);
  return entradas === 1;
}
