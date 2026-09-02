import type { PlanoRamal } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { pointToSegmentDist } from './HitTester';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';

// Validación de diámetros en nodos de redes de presión (salida ≤ entrada), sobre el estado VIVO
// del motor. Corre en updateElementById para que CUALQUIER camino que escriba `diametro`
// (menú contextual del canvas, editores, etc.) quede validado — no solo las tablas de diseño.
// La entrada llega al ORIGEN de flujo del ramal y las salidas salen de su DESTINO (con
// _tribReversed); cada salida se revisa de forma independiente contra la entrada más restrictiva.
export function diametroCambioPermitido(
  ramales: Array<{
    id: string;
    net?: string;
    pts?: number[][];
    _tribReversed?: boolean;
    diametro?: string;
  }>,
  ramalId: string,
  newLabel: string,
): { ok: boolean; msg?: string } {
  const r = ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return { ok: true };
  const newIn = newLabel ? diamPulgFromLabel(newLabel) : 0;
  if (newIn <= 0) return { ok: true };
  const TOL = 2.0;
  const myOrigin = r._tribReversed ? r.pts[r.pts.length - 1] : r.pts[0];
  const myDest = r._tribReversed ? r.pts[0] : r.pts[r.pts.length - 1];
  const touches = (pts: number[][], pt: number[]): 'endpoint' | 'body' | null => {
    const p0 = pts[0];
    const p1 = pts[pts.length - 1];
    if (Math.hypot(p0[0] - pt[0], p0[1] - pt[1]) < TOL) return 'endpoint';
    if (Math.hypot(p1[0] - pt[0], p1[1] - pt[1]) < TOL) return 'endpoint';
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0],
        ay = pts[i][1],
        bx = pts[i + 1][0],
        by = pts[i + 1][1];
      const dx = bx - ax,
        dy = by - ay,
        len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) continue;
      const t = ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / len2;
      if (t <= 0 || t >= 1) continue;
      if (Math.hypot(pt[0] - (ax + t * dx), pt[1] - (ay + t * dy)) < TOL) return 'body';
    }
    return null;
  };
  let maxParent = 0;
  let parentLbl = '';
  let maxChild = 0;
  let childLbl = '';
  for (const o of ramales) {
    if (o.id === ramalId || o.net !== r.net || !o.pts || o.pts.length < 2) continue;
    const oRev = !!o._tribReversed;
    const oOrigin = oRev ? o.pts[o.pts.length - 1] : o.pts[0];
    const oDest = oRev ? o.pts[0] : o.pts[o.pts.length - 1];
    const oIn = o.diametro ? diamPulgFromLabel(o.diametro) : 0;
    if (oIn <= 0) continue;
    // Entrada: el destino de flujo del otro cae en mi origen (o su cuerpo pasa por mi origen)
    const feedsMe =
      Math.hypot(oDest[0] - myOrigin[0], oDest[1] - myOrigin[1]) < TOL ||
      touches(o.pts, myOrigin) === 'body';
    // Salida: el origen de flujo del otro cae en mi destino o sobre mi cuerpo (unión T)
    const iFeedIt =
      Math.hypot(oOrigin[0] - myDest[0], oOrigin[1] - myDest[1]) < TOL ||
      touches(r.pts, oOrigin) === 'body';
    if (feedsMe && oIn > maxParent) {
      maxParent = oIn;
      parentLbl = o.diametro || '';
    }
    if (iFeedIt && oIn > maxChild) {
      maxChild = oIn;
      childLbl = o.diametro || '';
    }
  }
  if (maxParent > 0 && newIn > maxParent) {
    return {
      ok: false,
      msg: `El diámetro de salida no puede ser mayor que el de entrada (${parentLbl}). Selecciona un diámetro menor o igual al del tramo aguas arriba.`,
    };
  }
  if (maxChild > 0 && newIn < maxChild) {
    return {
      ok: false,
      msg: `El diámetro de entrada no puede ser menor que el de salida (${childLbl}) ya asignado aguas abajo. Selecciona un diámetro mayor o reduce primero la salida.`,
    };
  }
  return { ok: true };
}

export function flipRamalFlow(ram: PlanoRamal): void {
  ram.pts = [...ram.pts].reverse();
  const tmpAcc = ram.accesorioInicio;
  ram.accesorioInicio = ram.accesorioFin;
  ram.accesorioFin = tmpAcc;
  const tmpDiam = ram.diametroInicio;
  ram.diametroInicio = ram.diametroFin;
  ram.diametroFin = tmpDiam;
  const tmpApp = ram.aparatoInicio;
  ram.aparatoInicio = ram.aparatoFin;
  ram.aparatoFin = tmpApp;
  const tmpIniFin = ram.ini;
  ram.ini = ram.fin;
  ram.fin = tmpIniFin;
  // Las claves accMed se desplazan porque los vértices interiores se reindexan con el nuevo
  // orden.
  if (ram.accMed) {
    const oldMed = ram.accMed;
    const len = ram.pts.length;
    const newMed: Record<string, string> = {};
    for (const [k, v] of Object.entries(oldMed)) {
      const m = k.match(/^accMed(\d+)$/);
      if (!m) continue;
      const oldIdx = parseInt(m[1], 10);
      const newIdx = len - 1 - oldIdx;
      newMed[`accMed${newIdx}`] = v;
    }
    ram.accMed = newMed;
  }
}

// ————— Helpers compartidos de dirección de flujo (ítems 2, 5, 12, 13) —————

/** Vector de flujo (px, sin normalizar) del ramal en el punto dado — dirección del segmento
 *  más cercano al punto, con la convención de renderRamales.ts (fluye de pts[0] hacia el último
 *  punto, invertido si _tribReversed). @returns null si el punto cae fuera del ramal por más de
 *  tol. */
export function flowVecAt(
  ram: { pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  tol = 1,
): [number, number] | null {
  if (!ram.pts || ram.pts.length < 2) return null;
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let i = 0; i < ram.pts.length - 1; i++) {
    const [ax, ay] = ram.pts[i];
    const [bx, by] = ram.pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) continue;
    const t = ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / lenSq;
    const tc = Math.max(0, Math.min(1, t));
    const px = ax + tc * dx;
    const py = ay + tc * dy;
    const d = Math.hypot(pt[0] - px, pt[1] - py);
    if (d < bestD) {
      bestD = d;
      best = [dx, dy];
    }
  }
  if (!best || bestD > tol) return null;
  return ram._tribReversed ? [-best[0], -best[1]] : best;
}

/** ¿El flujo del ramal TERMINA en el punto P (P es el extremo aguas abajo de la dirección de
 *  flujo)? */
export function flowEndsAt(
  ram: { pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  tol: number,
): boolean {
  if (!ram.pts || ram.pts.length < 2) return false;
  const head = ram.pts[ram.pts.length - 1];
  const tail = ram.pts[0];
  const atHead = Math.hypot(head[0] - pt[0], head[1] - pt[1]) < tol;
  const atTail = Math.hypot(tail[0] - pt[0], tail[1] - pt[1]) < tol;
  if (!atTail && !atHead) return false;
  const atLogicalHead = ram._tribReversed ? atTail : atHead;
  return atLogicalHead;
}

/** ¿El flujo del ramal COMIENZA en el punto P (P es el extremo aguas arriba)? */
function flowStartsAt(
  ram: { pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  tol: number,
): boolean {
  if (!ram.pts || ram.pts.length < 2) return false;
  const head = ram.pts[ram.pts.length - 1];
  const tail = ram.pts[0];
  const atHead = Math.hypot(head[0] - pt[0], head[1] - pt[1]) < tol;
  const atTail = Math.hypot(tail[0] - pt[0], tail[1] - pt[1]) < tol;
  if (!atTail && !atHead) return false;
  const atLogicalTail = ram._tribReversed ? atHead : atTail;
  return atLogicalTail;
}

/** ¿El extremo `epPt` del ramal está ocupado por OTRO ramal de la misma red?
 *  ("Ocupado" en el sentido del ítem 13/5: el ramal se creó para conectar otro ramal.)
 *  Detecta tanto extremo-a-extremo como empalme sobre el CUERPO del otro ramal (un tributario
 *  nace sobre el cuerpo del padre con snap 45°, y un yee/empalme une el extremo al cuerpo de
 *  otro ramal sin dividirlo — el check de solo extremos los dejaba pasar como "libres"). */
export function ramalExtremoOcupado(
  ramales: Array<{ id: string; net?: string; pts?: number[][] }>,
  ramal: { id: string; net?: string },
  epPt: number[],
): boolean {
  const TOL = 0.5;
  for (const other of ramales) {
    if (other.id === ramal.id || other.net !== ramal.net) continue;
    const pts = other.pts;
    if (!pts || pts.length < 2) continue;
    if (Math.hypot(pts[0][0] - epPt[0], pts[0][1] - epPt[1]) < TOL) return true;
    if (Math.hypot(pts[pts.length - 1][0] - epPt[0], pts[pts.length - 1][1] - epPt[1]) < TOL)
      return true;
    for (let i = 0; i < pts.length - 1; i++) {
      if (
        pointToSegmentDist(epPt[0], epPt[1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <
        TOL
      )
        return true;
    }
  }
  return false;
}

/** ¿El extremo `epPt` del ramal está ENTRELAZADO con la red? — extremo/cuerpo de OTRO ramal del
 *  mismo net, o una bajante/montante del mismo net montada en ese punto (incluyendo la
 *  posición DESPLAZADA del bajante: el extremo del ramal se ancla donde el bajante se DIBUJA). */
export function extremoEntrelazado(
  ramales: Array<{ id: string; net?: string; pts?: number[][] }>,
  bajantes: Array<{
    net?: string;
    x: number;
    y: number;
    desplazamientos?: Record<string, { dx?: number; dy?: number }>;
  }>,
  ramal: { id: string; net?: string },
  epPt: number[],
): boolean {
  const TOL = 0.5;
  if (ramalExtremoOcupado(ramales, ramal, epPt)) return true;
  for (const b of bajantes) {
    if (b.net !== ramal.net) continue;
    if (Math.hypot(b.x - epPt[0], b.y - epPt[1]) < TOL) return true;
    for (const d of Object.values(b.desplazamientos || {})) {
      if (Math.hypot(b.x + (d.dx || 0) - epPt[0], b.y + (d.dy || 0) - epPt[1]) < TOL) return true;
    }
  }
  return false;
}

/** ¿El ramal (af/ac/gas) tiene un aparato en un extremo INVÁLIDO? — extremo conectado a la red
 *  (T/Y/bajante) o flujo en contra del extremo aparatado. Reutilizado por el bloqueo al
 *  asignar, el bloqueo al invertir dirección y el barrido de estados persistidos. */
export function aparatoEnExtremoInvalido(
  ramales: Array<{ id: string; net?: string; pts?: number[][] }>,
  bajantes: Array<{
    net?: string;
    x: number;
    y: number;
    desplazamientos?: Record<string, { dx?: number; dy?: number }>;
  }>,
  r: {
    id: string;
    net?: string;
    pts?: number[][];
    _tribReversed?: boolean;
    aparatoInicio?: string;
    aparatoFin?: string;
  },
): boolean {
  if (r.net !== 'af' && r.net !== 'ac' && r.net !== 'gas') return false;
  const pts = r.pts;
  if (!pts || pts.length < 2) return false;
  const bad = (pt: number[], app: string | undefined) =>
    Boolean(app) &&
    (extremoEntrelazado(ramales, bajantes, r, pt) ||
      !flowEndsAt({ pts, _tribReversed: r._tribReversed }, pt, 0.5));
  return bad(pts[0], r.aparatoInicio) || bad(pts[pts.length - 1], r.aparatoFin);
}

/** ¿La polaridad del codo de montante (codo90rmSube/codo90rmBaja, codoSube/codoBaja) es
 *  coherente con la dirección de flujo del ramal en P? El codo sube solo puede ENTREGAR flujo
 *  (la cola de la flecha de flujo apunta al extremo P: el flujo SALE de P hacia el codo);
 *  el codo baja solo puede RECIBIR flujo (la cabeza de la flecha apunta al extremo P: el flujo
 *  LLEGA a P desde el codo). En el cuerpo (flujo que pasa de largo, ni llega ni sale) ninguno de
 *  los dos es válido. */
export function codoPolarityOk(
  ramal: { pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  accId: string,
  tol: number,
): boolean {
  const isSube = accId === 'codo90rmSube' || accId === 'codoSube';
  const isBaja = accId === 'codo90rmBaja' || accId === 'codoBaja';
  if (!isSube && !isBaja) return true;
  if (isSube) return flowStartsAt(ramal, pt, tol);
  return flowEndsAt(ramal, pt, tol);
}

/** ¿El flujo del ramal de ventilación LLEGA a una unión con sanitaria (codo reventilado)? En
 *  la unión reventilado el flujo del vent debe ALEJARSE de la unión (san→vent); que llegue a
 *  ella es una violación. */
export function ventFlowsIntoJunction(
  vent: { net?: string; pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  tol: number,
): boolean {
  if (vent.net !== 'vent' || !vent.pts || vent.pts.length < 2) return false;
  return flowEndsAt(vent, pt, tol);
}

/** ¿El flujo del candidato en `ep` coincide con el del ramal que toca (dot >= 0)? Regla
 *  san/ll/vent: el ramal que se conecta fluye en el mismo sentido que el ramal principal.
 *  Perpendicular (T 90°) se permite (dot 0); solo contraflujo (dot <0) se bloquea. */
export function flowDirectionOkAt(
  incoming: { pts: number[][]; _tribReversed?: boolean },
  other: { pts: number[][]; _tribReversed?: boolean },
  ep: number[],
  tol: number,
): boolean {
  const fin = flowVecAt(incoming, ep, tol);
  const fex = flowVecAt(other, ep, tol);
  if (!fin || !fex) return false;
  return fin[0] * fex[0] + fin[1] * fex[1] >= 0;
}

function pointOnRamalSegment(p: number[], a: number[], b: number[], tol: number): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return Math.hypot(p[0] - a[0], p[1] - a[1]) < tol;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  if (t < 0.02 || t > 0.98) return false;
  const px = a[0] + t * dx;
  const py = a[1] + t * dy;
  return Math.hypot(p[0] - px, p[1] - py) < tol;
}

function sameNetGroupNet(a: string, b: string): boolean {
  return a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
}

// Item 5: valida que el ángulo de conexión entre un ramal de ventilación y un
// ramal sanitario sea exactamente 45° (Y) o 90° (codo reventilado), dentro de
// ANGLE_EPS (0.5°). Antes, la conexión se permitía a 44°/46° porque solo se
// validaban los segmentos propios de cada ramal, no el ángulo ENTRE ellos.
// @returns true si el ángulo es 45° o 90° (±0.5°), false si no.
function ventSanAngleOk(
  vent: { pts: number[][]; _tribReversed?: boolean },
  san: { pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  tol: number,
): boolean {
  const vVec = flowVecAt(vent, pt, tol);
  if (!vVec) return true; // no se puede medir — no bloquear
  const sVec = flowVecAt(san, pt, tol);
  if (!sVec) return true;
  const vLen = Math.hypot(vVec[0], vVec[1]);
  const sLen = Math.hypot(sVec[0], sVec[1]);
  if (vLen < 1e-9 || sLen < 1e-9) return true;
  const cosAngle = (vVec[0] * sVec[0] + vVec[1] * sVec[1]) / (vLen * sLen);
  // Ángulo de LÍNEA (0–90°): |cos| pliega 135°→45° — una Y a 45° dibujada "hacia
  // atrás" respecto del flujo del san es igualmente válida.
  const clamped = Math.min(1, Math.abs(cosAngle));
  const angleDeg = (Math.acos(clamped) * 180) / Math.PI;
  // 45° (Y) o 90° (codo reventilado) — estricto, sin tolerancia arbitraria.
  return Math.abs(angleDeg - 45) <= 0.5 || Math.abs(angleDeg - 90) <= 0.5;
}

/** Chequeo de dirección de flujo para san/ll/vent: cada extremo del ramal que toca otro ramal
 *  del mismo grupo (extremo o cuerpo) debe fluir en el mismo sentido que ese ramal; y un ramal
 *  vent que toca san (codo reventilado) debe alejarse de la unión. `extra` cubre el candidato
 *  cuando aún no está en engine.ramales (finishRamal pre-push). @returns mensaje de violación
 *  o null si todo cumple. */
export function ramalFlowDirectionCheck(
  engine: IPlanoEngineCore,
  ram: PlanoRamal,
  extra: PlanoRamal[],
  tol: number,
): string | null {
  if (!ram.pts || ram.pts.length < 2) return null;
  const candidates = [...engine.ramales, ...extra];
  // Ítem 5: vent multi-segmento solo valida 1º trazo (conectado a san), resto ruteo libre
  let eps: number[][] = [ram.pts[0], ram.pts[ram.pts.length - 1]];
  if (ram.net === 'vent' && ram.pts.length > 2) {
    const isFirstNearSan = candidates.some(
      (c) =>
        c.net === 'san' &&
        c.pts &&
        (c.pts.some((p) => Math.hypot(p[0] - eps[0][0], p[1] - eps[0][1]) < tol) ||
          c.pts.some(
            (_, i) =>
              i < c.pts!.length - 1 &&
              Math.hypot(eps[0][0] - c.pts![i][0], eps[0][1] - c.pts![i][1]) < tol,
          )),
    );
    const isLastNearSan = candidates.some(
      (c) =>
        c.net === 'san' &&
        c.pts &&
        (c.pts.some((p) => Math.hypot(p[0] - eps[1][0], p[1] - eps[1][1]) < tol) ||
          c.pts.some(
            (_, i) =>
              i < c.pts!.length - 1 &&
              Math.hypot(eps[1][0] - c.pts![i][0], eps[1][1] - c.pts![i][1]) < tol,
          )),
    );
    if (isFirstNearSan && !isLastNearSan) eps = [eps[0]];
    else if (!isFirstNearSan && isLastNearSan) eps = [eps[1]];
    else if (isFirstNearSan && isLastNearSan)
      eps = [eps[0]]; // ambos cerca, solo uno
    else eps = []; // ninguno cerca de san, no validar
    if (eps.length === 0) return null;
  }
  for (const ep of eps) {
    // Dos ramales que drenan al MISMO bajante no forman una unión ramal-ramal: cada uno
    // conecta al bajante por separado (hasta 2 permitidos, orig. #14). Si el extremo está
    // montado sobre un bajante del mismo net, no validar la dirección contra otros ramales
    // en ese punto — sus vectores (desde lados opuestos hacia el bajante) son opuestos y
    // dispararían una falsa advertencia de dirección de flujo.
    const epAtBajante = (engine.bajantes || []).some(
      (b) => b.net === ram.net && Math.hypot(b.x - ep[0], b.y - ep[1]) < tol,
    );
    if (epAtBajante) continue;
    // Un brazo lateral TRIBUTARIO en una unión de 3+ ramales (yee/tee, p. ej. el brazo de una yee
    // doble) define su dirección por topología, no por dot product entre vectores — un brazo en 45°
    // puede tener dot ≤0 contra el tronco. Saltar la validación de dirección ahí SOLO para
    // tributarios; un ramal normal (tipo 'ramal') en san/ll SIEMPRE debe validarse contra el flujo
    // del ramal al que se conecta (no puede ir en contra).
    if (ram.tipo === 'tributario') {
      let junctionCount = 0;
      for (const c of candidates) {
        if (!c.pts || c.pts.length < 2) continue;
        const cEps = [c.pts[0], c.pts[c.pts.length - 1]];
        if (
          cEps.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < tol) ||
          c.pts.some(
            (_, i) =>
              i < c.pts!.length - 1 && pointOnRamalSegment(ep, c.pts![i], c.pts![i + 1], tol),
          )
        )
          junctionCount++;
      }
      if (junctionCount >= 3) continue;
    }
    for (const other of candidates) {
      if (other.id === ram.id || !sameNetGroupNet(other.net, ram.net)) continue;
      // ponytail: vent-vent no flow check per spec (only vent-san revent)
      if (ram.net === 'vent' && other.net === 'vent') continue;
      if (!other.pts || other.pts.length < 2) continue;
      const oEps = [other.pts[0], other.pts[other.pts.length - 1]];
      const touchesEndpoint = oEps.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < tol);
      // Item 4: la alerta de dirección de flujo vent↔san (codo reventilado) solo
      // aplica cuando el vent se conecta a un EXTREMO del ramal sanitario. Si se
      // conecta al CUERPO (punto intermedio) del san, la conexión es válida y no
      // debe mostrar la alerta de flujo — el vent nace del cuerpo del san
      // (Y/codo sobre el cuerpo), no de su extremo.
      const crossVentSan =
        (ram.net === 'vent' && other.net === 'san') || (ram.net === 'san' && other.net === 'vent');
      // Item 5: el ángulo de conexión vent↔san debe ser 45° (Y) o 90° (codo
      // reventilado) estricto (±0.5°) SOLO cuando el vent nace del CUERPO del
      // san. En el EXTREMO no se valida ángulo: arrancar el trazo de ventilación
      // desde el extremo de un ramal sanitario es válido a cualquier ángulo
      // (el vent continúa la línea). 44°/46° y equivalentes se rechazan en cuerpo.
      if (crossVentSan && !touchesEndpoint) {
        if (!ventSanAngleOk(ram, other, ep, tol)) {
          return 'El ángulo de conexión entre ventilación y sanitaria debe ser 45° o 90°. Ajusta el ángulo con línea guía.';
        }
        // Conexión al cuerpo del san → no validar dirección de flujo (item 4).
        continue;
      }
      // Para uniones no-vent↔san, también aceptar contacto por cuerpo (T/Y sobre
      // el cuerpo del otro ramal).
      let touchesBody = false;
      if (!touchesEndpoint) {
        for (let i = 0; i < other.pts.length - 1; i++) {
          if (pointOnRamalSegment(ep, other.pts[i], other.pts[i + 1], tol)) {
            touchesBody = true;
            break;
          }
        }
      }
      if (!touchesEndpoint && !touchesBody) continue;
      // Ítem 5: unión vent↔san (codo reventilado) — el flujo del vent debe ALEJARSE de la unión.
      if (other.net === 'san' && ventFlowsIntoJunction(ram, ep, tol)) {
        return 'El ramal de ventilación debe fluir alejándose de la unión reventilado (san → vent). Dibújalo saliendo desde el punto sanitario.';
      }
      if (ram.net === 'san' && ventFlowsIntoJunction(other, ep, tol)) {
        return 'El ramal de ventilación debe fluir alejándose de la unión reventilado (san → vent). Dibújalo saliendo desde el punto sanitario.';
      }
      // La semántica vent↔san (codo reventilado / Y) ya se validó arriba: el vent debe fluir
      // ALEJÁNDOSE de la unión. El chequeo genérico de "mismo sentido" (dot >= 0) no aplica a
      // ese par: un vent conectado a san sale a 45°/90° contra el flujo sanitario (Y / codo
      // reventilado), así que su dot contra el san es negativo y lo señalaba como falsa
      // violación de dirección aunque estuviera dibujado correctamente (Ítem 5 del .md).
      if (!crossVentSan && !flowDirectionOkAt(ram, other, ep, tol)) {
        return 'El ramal que se conecta debe llevar la dirección de flujo del ramal principal. Dibújalo en el mismo sentido.';
      }
    }
  }
  return null;
}
