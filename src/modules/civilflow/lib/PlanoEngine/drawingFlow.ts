import type { PlanoRamal } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { pointToSegmentDist } from './HitTester';

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

/** ¿El flujo del candidato en `ep` coincide con el del ramal que toca (dot > 0)? Regla
 *  san/ll/vent: el ramal que se conecta fluye en el mismo sentido que el ramal principal. */
export function flowDirectionOkAt(
  incoming: { pts: number[][]; _tribReversed?: boolean },
  other: { pts: number[][]; _tribReversed?: boolean },
  ep: number[],
  tol: number,
): boolean {
  const fin = flowVecAt(incoming, ep, tol);
  const fex = flowVecAt(other, ep, tol);
  if (!fin || !fex) return false;
  return fin[0] * fex[0] + fin[1] * fex[1] > 0;
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
  const eps = [ram.pts[0], ram.pts[ram.pts.length - 1]];
  for (const ep of eps) {
    for (const other of candidates) {
      if (other.id === ram.id || !sameNetGroupNet(other.net, ram.net)) continue;
      if (!other.pts || other.pts.length < 2) continue;
      const oEps = [other.pts[0], other.pts[other.pts.length - 1]];
      let touches = oEps.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < tol);
      if (!touches) {
        for (let i = 0; i < other.pts.length - 1; i++) {
          if (pointOnRamalSegment(ep, other.pts[i], other.pts[i + 1], tol)) {
            touches = true;
            break;
          }
        }
      }
      if (!touches) continue;
      // Ítem 5: unión vent↔san (codo reventilado) — el flujo del vent debe ALEJARSE de la unión.
      if (other.net === 'san' && ventFlowsIntoJunction(ram, ep, tol)) {
        return 'El ramal de ventilación debe fluir alejándose de la unión reventilado (san → vent). Dibújalo saliendo desde el punto sanitario.';
      }
      if (ram.net === 'san' && ventFlowsIntoJunction(other, ep, tol)) {
        return 'El ramal de ventilación debe fluir alejándose de la unión reventilado (san → vent). Dibújalo saliendo desde el punto sanitario.';
      }
      if (!flowDirectionOkAt(ram, other, ep, tol)) {
        return 'El ramal que se conecta debe llevar la dirección de flujo del ramal principal. Dibújalo en el mismo sentido.';
      }
    }
  }
  return null;
}
