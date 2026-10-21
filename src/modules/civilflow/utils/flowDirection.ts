import type { PlanoRamal } from '../lib/PlanoEngine/PlanoState.ts';

/** Ramal que muestra el total UC (Unidades de Consumo) en un split af (Agua Fria)/ac (Agua Caliente)/gas (Gas) (el que discrepa en flujo).
 *  @param jc - punto de unión.
 *  @param existing - ramal pre-división.
 *  @param downstream - ramal autocreado que continúa.
 *  @param incoming - ramal que aterrizó en el cuerpo.
 *  @param tol - tolerancia en px (default 2.0).
 *  @returns id del ramal que muestra el total. */
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

/** Regla de unión con tributario en af (Agua Fria)/ac (Agua Caliente)/gas (Gas) (exige una entrada exacta).
 *  @param ramales - ramales del mismo net.
 *  @param net - red a validar ('af' | 'ac' | 'gas').
 *  @param pt - punto de la unión.
 *  @param tol - tolerancia en px.
 *  @returns true si respeta la regla (o no aplica). */
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
  // 'entradas === 1' era más estricto que el mensaje de la alerta ("al menos un ramal
  // saliendo") y daba falso positivo con salida real + 2 entradas. La salida manda.
  if (entradas === 1) return true;
  return junctionHasOutgoingFlow(ramales, net, pt, tol);
}
