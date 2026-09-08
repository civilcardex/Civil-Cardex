import type { PlanoRamal } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { pointToSegmentDist } from './HitTester';
import { distToPolyline } from '../shared/geometry';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { sanFeederMinMsg, sanReceptorMaxMsg } from '../../utils/sanitaryDiamCompat';

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

// Red sanitaria: el receptor no puede quedar con menor diámetro que el mayor ramal que le
// descarga directo (regla inversa a presión: aguas abajo SIEMPRE >= aguas arriba). Corre en
// updateElementById vía guardDiametroNodo para que CUALQUIER camino de dibujo (menú
// contextual, TramoEditor) quede validado con alerta — igual que la tabla de diseño.
// Solo cuentan alimentadores tipo `ramal` (tributarios y bajantes no restringen).
export function sanReceptorDiametroPermitido(
  ramales: Array<{
    id: string;
    net?: string;
    tipo?: string;
    pts?: number[][];
    _tribReversed?: boolean;
    diametro?: string;
    label?: string;
    fin?: string;
    mergesFrom?: string[];
  }>,
  ramalId: string,
  newLabel: string,
): { ok: boolean; msg?: string } {
  const r = ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return { ok: true };
  const newIn = newLabel ? diamPulgFromLabel(newLabel) : 0;
  if (newIn <= 0) return { ok: true };
  const TOL = 2.0;
  const mergeSiblingPairs = new Set<string>();
  for (const q of ramales) {
    if (q.mergesFrom) mergeSiblingPairs.add([...q.mergesFrom].sort().join('|'));
  }
  let maxFeeder = 0;
  let feederLbl = '';
  for (const o of ramales) {
    // Alimentadores: ramales Y tributarios, con la regla de dirección — un receptor
    // TRIBUTARIO solo recibe de otros tributarios (un ramal nunca alimenta a un tributario).
    if (o.id === ramalId || o.net !== r.net || (o.tipo !== 'ramal' && o.tipo !== 'tributario'))
      continue;
    if (r.tipo === 'tributario' && o.tipo === 'ramal') continue;
    if (!o.pts || o.pts.length < 2) continue;
    if (mergeSiblingPairs.has([o.id, ramalId].sort().join('|'))) continue;
    const oIn = o.diametro ? diamPulgFromLabel(o.diametro) : 0;
    if (oIn <= 0) continue;
    // Destino de flujo del candidato sobre mi cuerpo: me descarga.
    const oDest = o._tribReversed ? o.pts[0] : o.pts[o.pts.length - 1];
    if (distToPolyline(oDest, r.pts) >= TOL) continue;
    // Si el candidato declara `fin` hacia OTRO elemento (bajante u otro ramal), su flujo va
    // allá, no a mí (co-sumideros al mismo bajante, continuación tipeada) — no me alimenta.
    const oFin = o.fin || '';
    if (oFin && oFin !== r.id && oFin !== r.label) continue;
    if (oIn > maxFeeder) {
      maxFeeder = oIn;
      feederLbl = o.label || o.id;
    }
  }
  if (maxFeeder > 0 && newIn < maxFeeder) {
    return { ok: false, msg: sanFeederMinMsg(feederLbl, maxFeeder) };
  }
  return { ok: true };
}

// Espejo de la regla anterior para el ALIMENTADOR: subir el diámetro de un ramal por encima
// de su receptor rompe el mismo invariante (aguas abajo >= aguas arriba) — sin este chequeo la
// regla era burlable editando el alimentador en vez del receptor. Solo aplica al SUBIR (la
// bajada la valida sanReceptorDiametroPermitido). Receptor = ramal del mismo net cuyo cuerpo
// pasa por el punto de descarga; si el ramal declara `fin` hacia un elemento que no es un
// ramal san del grupo (p. ej. un bajante), no hay receptor que restringir.
export function sanAlimentadorDiametroPermitido(
  ramales: Array<{
    id: string;
    net?: string;
    tipo?: string;
    pts?: number[][];
    _tribReversed?: boolean;
    diametro?: string;
    label?: string;
    fin?: string;
    mergesFrom?: string[];
  }>,
  ramalId: string,
  newLabel: string,
): { ok: boolean; msg?: string } {
  const r = ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return { ok: true };
  const newIn = newLabel ? diamPulgFromLabel(newLabel) : 0;
  if (newIn <= 0) return { ok: true };
  const curIn = r.diametro ? diamPulgFromLabel(r.diametro) : 0;
  if (newIn <= curIn) return { ok: true };
  // Primera asignación (el alimentador no tenía diámetro): libre aunque supere al receptor —
  // el usuario asigna el aparato y su diámetro de una vez; la validación aplica a partir de
  // la segunda edición (orig. usuario).
  if (curIn <= 0) return { ok: true };
  const TOL = 2.0;
  const rDest = r._tribReversed ? r.pts[0] : r.pts[r.pts.length - 1];
  // Receptor declarado por `fin` (referencia a OTRO ramal) o geométrico.
  let receptor: (typeof ramales)[number] | null = null;
  let recD = Infinity;
  const rFin = r.fin || '';
  if (rFin) {
    const declared = ramales.find(
      (q) => q.id !== ramalId && q.tipo === 'ramal' && (q.id === rFin || q.label === rFin),
    );
    if (declared) {
      receptor = declared;
      recD = declared.diametro ? diamPulgFromLabel(declared.diametro) : 0;
    }
    // `fin` hacia un bajante u otro elemento: el flujo sale de la red san — sin restricción.
  } else {
    const mergeSiblingPairs = new Set<string>();
    for (const q of ramales) {
      if (q.mergesFrom) mergeSiblingPairs.add([...q.mergesFrom].sort().join('|'));
    }
    for (const q of ramales) {
      if (q.id === ramalId || q.net !== r.net || q.tipo !== 'ramal') continue;
      if (!q.pts || q.pts.length < 2) continue;
      if (mergeSiblingPairs.has([q.id, ramalId].sort().join('|'))) continue;
      const d = distToPolyline(rDest, q.pts);
      if (d >= TOL) continue;
      if (d < recD) {
        recD = d;
        receptor = q;
      }
    }
  }
  if (receptor) {
    const recIn = receptor.diametro ? diamPulgFromLabel(receptor.diametro) : 0;
    if (recIn > 0 && newIn > recIn) {
      return {
        ok: false,
        msg: sanReceptorMaxMsg(receptor.label || receptor.id || '', recIn),
      };
    }
  }
  return { ok: true };
}

/** Invariante sanitario: el receptor no baja por debajo del mayor alimentador. La SUBIDA del
 *  alimentador por encima del receptor está permitida — se propaga automáticamente aguas
 *  abajo (propagarSanDiametroAguasAbajo) en vez de bloquearse (orig. usuario: no debe saltar
 *  alerta al cambiar el diámetro desde los tributarios que llegan). */
export function sanDiametroPermitido(
  ramales: Parameters<typeof sanReceptorDiametroPermitido>[0],
  ramalId: string,
  newLabel: string,
): { ok: boolean; msg?: string } {
  return sanReceptorDiametroPermitido(ramales, ramalId, newLabel);
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

/** ¿El extremo `epPt` del ramal está ocupado por OTRO ramal de la misma red? Detecta tanto
 *  extremo-con-extremo como empalmes sobre el cuerpo del otro ramal (un tributario nace
 *  sobre el cuerpo del padre, y un yee une el extremo al cuerpo sin dividirlo) — revisar
 *  solo extremos los dejaba pasar como "libres". */
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

/** ¿La polaridad del codo de montante (sube/baja) es coherente con el flujo del ramal en P?
 *  El codo sube solo puede ENTREGAR flujo (el flujo SALE de P hacia el codo) y el codo baja
 *  solo puede RECIBIR (el flujo LLEGA a P desde el codo). En el cuerpo del ramal, donde el
 *  flujo solo pasa de largo, ninguno de los dos es válido. */
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
// ramal sanitario sea 0° (continuación colineal), 45° (Y) o 90° (codo
// reventilado), dentro de ANGLE_EPS (0.5°). Antes, la conexión se permitía a
// 44°/46° porque solo se validaban los segmentos propios de cada ramal, no el
// ángulo ENTRE ellos. El 0° es continuación recta de la línea (trazo bien
// hecho) y no debe disparar la alerta.
// @returns true si el ángulo es 0°, 45° o 90° (±0.5°), false si no.
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
  // 0° (continuación colineal), 45° (Y) o 90° (codo reventilado) — estricto.
  return angleDeg <= 0.5 || Math.abs(angleDeg - 45) <= 0.5 || Math.abs(angleDeg - 90) <= 0.5;
}

/** Chequeo de dirección de flujo para san/ll/vent: cada extremo del ramal que toca otro
 *  ramal del mismo grupo debe fluir en el mismo sentido que él; y un ramal vent que toca
 *  san (codo reventilado) debe alejarse de la unión. @returns mensaje de violación o null
 *  si todo cumple. */
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

/** Tras cambiar el diámetro de un trazo san, propaga aguas abajo AL MAYOR (regla del usuario):
 *  en cada conexión, el receptor (ramal O tributario — trib→trib y ramal→trib propagan) se
 *  ajusta al mayor entre su diámetro y el de TODOS los alimentadores que llegan a él, y la
 *  cadena sigue por cualquier largo. Solo asigna cuando TODOS los llegadores del receptor ya
 *  tienen diámetro; nunca baja un diámetro (bajar el receptor manualmente lo bloquea la
 *  alerta de sanReceptorDiametroPermitido vía guardDiametroNodo). Converge por conjunto de
 *  procesados incluso con ciclos. `bajantes` (opcional) permite excluir pares CO-SUMIDERO:
 *  dos ramales que descargan (o nacen) en el MISMO bajante son laterales paralelos, no
 *  continuación uno del otro — subir uno no debe subir el otro. */
export function propagarSanDiametroAguasAbajo(
  ramales: Parameters<typeof sanReceptorDiametroPermitido>[0],
  ramalId: string,
  bajantes?: Array<{ recibeDeIds?: string[]; alimentaIds?: string[] }>,
): void {
  const start = ramales.find((x) => x.id === ramalId);
  if (!start || !start.pts || start.pts.length < 2) return;
  const TOL = 2.0;
  const esRedSan = (o: { tipo?: string }) => o.tipo === 'ramal' || o.tipo === 'tributario';
  // Dirección hidráulica (orig. usuario): un RAMAL nunca alimenta a un TRIBUTARIO. Un
  // tributario receptor solo recibe de otros tributarios; un ramal receptor recibe de
  // tributarios (trib→ramal) y de la continuación del tronco (ramal→ramal, piezas de split).
  const puedeAlimentar = (feeder: { tipo?: string }, rec: { tipo?: string }): boolean =>
    rec.tipo === 'ramal' || feeder.tipo === 'tributario';
  const mergeSiblingPairs = new Set<string>();
  for (const q of ramales) {
    if (q.mergesFrom) mergeSiblingPairs.add([...q.mergesFrom].sort().join('|'));
  }
  // Pares co-sumidero: comparten bajante (ambos en recibeDeIds o ambos en alimentaIds).
  const coSumidero = new Set<string>();
  for (const b of bajantes || []) {
    const llegan = b.recibeDeIds || [];
    for (let i = 0; i < llegan.length; i++)
      for (let j = i + 1; j < llegan.length; j++)
        coSumidero.add([llegan[i], llegan[j]].sort().join('|'));
    const nacen = b.alimentaIds || [];
    for (let i = 0; i < nacen.length; i++)
      for (let j = i + 1; j < nacen.length; j++)
        coSumidero.add([nacen[i], nacen[j]].sort().join('|'));
  }
  const esCoSumidero = (a: string, b: string): boolean => coSumidero.has([a, b].sort().join('|'));
  // Alimentadores de un receptor: trazos cuyo punto de descarga (destino de flujo) cae en su
  // cuerpo/extremos, sin contar las mitades de una misma división (hermanas mergesFrom) ni
  // trazos con `fin` declarado hacia otro elemento (co-sumideros). SOLO el destino de flujo:
  // con fallback de dos extremos una pieza de AGUAS ABAJO (su origen toca el cuerpo) se
  // contaba como llegadora y bloqueaba la compuerta de todos-asignados.
  const feedersOf = (rec: (typeof ramales)[0]): typeof ramales => {
    const out: typeof ramales = [];
    for (const o of ramales) {
      if (o.id === rec.id || o.net !== rec.net || !esRedSan(o)) continue;
      if (!puedeAlimentar(o, rec)) continue;
      if (!o.pts || o.pts.length < 2) continue;
      const oDest = o._tribReversed ? o.pts[0] : o.pts[o.pts.length - 1];
      if (distToPolyline(oDest, rec.pts!) >= TOL) continue;
      if (esCoSumidero(o.id, rec.id)) continue;
      // El `fin` declarado excluye solo si apunta a un TERCERO REMOTO. En uniones de split y
      // trib→trib los fin/ini quedan como referencias cruzadas ENTRE PARTICIPANTES de la misma
      // unión (RS1.fin="RS2", RS2.fin="RS1" apuntándose mutuamente — datos reales del usuario):
      // si el tramo declarado pasa por ESTA MISMA descarga, es contabilidad de la conexión y no
      // excluye. Solo un fin hacia un elemento remoto (co-sumidero al bajante, continuación
      // tipeada) sigue excluyendo.
      const oFin = o.fin || '';
      if (oFin && oFin !== rec.id && oFin !== rec.label) {
        const finT = ramales.find(
          (x) => (x.id === oFin || x.label === oFin) && x.pts && x.pts.length >= 2,
        );
        const finEnLaUnion =
          !!finT?.pts &&
          distToPolyline(oDest, finT.pts) < TOL &&
          distToPolyline(oDest, rec.pts!) < TOL;
        if (!finEnLaUnion) continue;
      }
      if (mergeSiblingPairs.has([o.id, rec.id].sort().join('|'))) continue;
      out.push(o);
    }
    return out;
  };
  const processed = new Set<string>();
  const queue: string[] = [start.id];
  while (queue.length > 0) {
    const curId = queue.shift()!;
    if (processed.has(curId)) continue;
    processed.add(curId);
    const cur = ramales.find((x) => x.id === curId);
    if (!cur || !cur.pts || cur.pts.length < 2) continue;
    const curPulg = diamPulgFromLabel(cur.diametro || '');
    if (curPulg <= 0) continue;
    // Descarga de cur: el destino de flujo; si no toca nada (bandera stale), el otro extremo.
    const destFlow = cur._tribReversed ? cur.pts[0] : cur.pts[cur.pts.length - 1];
    const destOther = cur._tribReversed ? cur.pts[cur.pts.length - 1] : cur.pts[0];
    const destOn = (q: typeof cur): boolean =>
      distToPolyline(destFlow, q.pts!) < TOL || distToPolyline(destOther, q.pts!) < TOL;
    // Receptor: tramo mismo net cuyo cuerpo/extremos toca mi descarga — con la misma regla de
    // dirección (el descargo de un ramal solo puede caer en OTRO ramal; la de un tributario,
    // en ramal o tributario). Dos pasadas: PRIMERO los que NACEN en mi descarga (su origen
    // toca el punto — continuación del tronco, RS3 en la unión RS1|RS2|RS3); si no hay, el
    // más cercano. Sin esto un HERMANO que también llega (RS2, origen lejano) podía ganar el
    // desempate por orden de array y "engullir" el caudal (orig. usuario).
    let receptor: typeof cur | null = null;
    let recD = Infinity;
    for (const q of ramales) {
      if (q.id === cur.id || q.net !== cur.net || !esRedSan(q)) continue;
      if (!puedeAlimentar(cur, q)) continue;
      if (esCoSumidero(cur.id, q.id)) continue;
      if (!q.pts || q.pts.length < 2) continue;
      const d = distToPolyline(destFlow, q.pts);
      if (d >= TOL) continue;
      const qOrigin = q._tribReversed ? q.pts[q.pts.length - 1] : q.pts[0];
      if (Math.hypot(qOrigin[0] - destFlow[0], qOrigin[1] - destFlow[1]) < TOL) {
        // nace aquí: candidato preferente inmediato.
        receptor = q;
        recD = d;
        break;
      }
      if (d < recD) {
        recD = d;
        receptor = q;
      }
    }
    if (!receptor) {
      for (const q of ramales) {
        if (q.id === cur.id || q.net !== cur.net || !esRedSan(q)) continue;
        if (!puedeAlimentar(cur, q)) continue;
        if (esCoSumidero(cur.id, q.id)) continue;
        if (!q.pts || q.pts.length < 2) continue;
        const d = distToPolyline(destOther, q.pts);
        if (d >= TOL) continue;
        const qOrigin = q._tribReversed ? q.pts[q.pts.length - 1] : q.pts[0];
        if (Math.hypot(qOrigin[0] - destOther[0], qOrigin[1] - destOther[1]) < TOL) {
          receptor = q;
          recD = d;
          break;
        }
        if (d < recD) {
          recD = d;
          receptor = q;
        }
      }
    }
    if (!receptor || !destOn(receptor)) continue;
    // El receptor toma el MAYOR de los llegadores que tengan diámetro asignado (orig. usuario,
    // regla vigente en marañas reales): los llegadores sin diámetro NO bloquean — una pieza
    // troncal sin llegadores propios (p. ej. T6RS8) congelaría toda la cadena con la compuerta
    // estricta "todos asignados". Nunca baja: solo escribe si el mayor supera al actual.
    const feeders = feedersOf(receptor);
    let maxPulg = 0;
    let maxLbl = '';
    for (const f of feeders) {
      const p = diamPulgFromLabel(f.diametro || '');
      if (p > maxPulg) {
        maxPulg = p;
        maxLbl = f.diametro || '';
      }
    }
    if (maxPulg > 0) {
      const recPulg = diamPulgFromLabel(receptor.diametro || '');
      // Asigna también al receptor VACÍO (recPulg 0): el caso típico es el trazo nuevo que
      // recibe de llegadores ya asignados.
      if (recPulg < maxPulg) receptor.diametro = maxLbl;
    }
    // El receptor continúa la cadena aguas abajo (subiera o no).
    queue.push(receptor.id);
  }
}
