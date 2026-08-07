import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../lib/PlanoEngine/PlanoState';

const BLOCKED_MESSAGE =
  'El bajante con dirección "baja" solo puede recibir flujo. Conecta el ramal al extremo final (no al inicio).';

const SUBE_BLOCKED_MESSAGE =
  'El bajante con dirección "sube" solo puede entregar flujo. Conecta el ramal al extremo inicial (no al final).';

/**
 * Guardia centralizado para "extremo de ramal ↔ bajante" de dirección de flujo. Devuelve true si
 * la conexión está permitida, false si enrutaría el flujo al revés a través del bajante:
 * - un INICIO de ramal (pts[0]) en un bajante 'baja' (haría emitir a un bajante de solo-recibir), o
 * - un FIN de ramal (pts[last]) en un bajante 'sube' (haría recibir a un bajante de solo-emitir).
 *
 * Centralizarlo aquí significa que todo lugar que asigna r.ini = b.code o r.fin = b.code llama la
 * misma regla — sin esto, una corrección que solo guardara un camino dejaría que otros caminos
 * crearan en silencio la misma asociación inválida (un usuario arrastrando el ramal cerca del
 * bajante, o finishRamal coincidiendo por casualidad, etc.).
 *
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
 * En una división de mitad de cuerpo AF/AC/gas (existing/downstream/incoming encontrándose en
 * `jc`), decide cuál de los tres ramales MUESTRA el total UC combinado: aquel cuya dirección de
 * flujo (según su propio `_tribReversed`) DISCREPA de los otros dos — la unión siempre necesita
 * al menos un ramal fluyendo fuera de ella (junctionHasOutgoingFlow), así que con tres ramales la
 * división es siempre 2-contra-1; el disidente solitario es el que realmente lleva la demanda
 * combinada hacia adelante (o la recibe, según hacia dónde coincidan los otros dos), nunca fijo a
 * "existing" o "el auto-creado". Cae a `existing.id` si `incoming` no puede resolverse o los tres
 * coinciden (degenerado/sin minoría), para que los callers sigan teniendo un default sensato en
 * vez de comportamiento indefinido.
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
 * Regla de unión AF/AC/gas cuando un TRIBUTARIO participa: en general basta con "al menos una
 * salida" (`junctionHasOutgoingFlow`). Pero la dirección de un tributario es fija (ver
 * `autoSplitJunctionAndSumFlow`: siempre fluye DESDE la unión hacia el aparato) — así que
 * `existing` y `downstream`, al ser la misma línea partida en dos, siempre se reparten
 * exactamente 1 entrada + 1 salida entre ellos MIENTRAS compartan `_tribReversed`. Si el usuario
 * invierte SOLO uno de los dos después de creada la unión, ese reparto se rompe (0 o 2 entradas
 * entre ambos) — algo que "al menos una salida" nunca detecta, porque el tributario ya aporta su
 * propia salida fija sin importar qué pase con el resto. Aquí se exige exactamente 1 entrada
 * total en el grupo cuando hay un tributario tocando el punto; sin tributario, se delega en la
 * regla general (sin cambios para uniones ramal-ramal-ramal).
 * @param ramales - Ramales a considerar (mismo net que `net`).
 * @param net - Red a validar ('af' | 'ac' | 'gas').
 * @param pt - Punto de la unión.
 * @param tol - Tolerancia de distancia para "este extremo cae en pt".
 * @returns true si la unión respeta la regla (o no aplica).
 */
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
