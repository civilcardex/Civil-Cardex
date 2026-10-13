// Checks de dirección de flujo y ventilación (yee/vent/codo polarity) + geometría de flujo.
// Extraídos verbatim de drawingFlow (des-monolitización 2026-10-06, ronda 6).
import type { PlanoRamal } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { esCaja } from './bajanteRules';

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
export function flowStartsAt(
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

export function pointOnRamalSegment(p: number[], a: number[], b: number[], tol: number): boolean {
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

export function sameNetGroupNet(a: string, b: string): boolean {
  return a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
}

// Item 5: valida que el ángulo de conexión entre un ramal de ventilación y un
// ramal sanitario sea 0° (continuación colineal), 45° (Y) o 90° (codo
// reventilado), dentro de ANGLE_EPS (0.5°). Antes, la conexión se permitía a
// 44°/46° porque solo se validaban los segmentos propios de cada ramal, no el
// ángulo ENTRE ellos. El 0° es continuación recta de la línea (trazo bien
// hecho) y no debe disparar la alerta.
// @returns true si el ángulo es 0°, 45° o 90° (±0.5°), false si no.
export function ventSanAngleOk(
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
    // CAJAS incluidas con SEMILADO (mismo criterio de asociación): que lleguen a la caja NO
    // las conecta entre sí — la dirección de flujo no se valida (orig. usuario).
    const epEnCajaOBajante = (engine.bajantes || []).some((b) => {
      if (b.net !== ram.net) return false;
      const circ = b._circ?.r || 8 * (engine.zoom || 1);
      const bTol = esCaja(b) ? circ / Math.SQRT2 / (engine.zoom || 1) + 0.5 : tol;
      return Math.hypot(b.x - ep[0], b.y - ep[1]) < bTol;
    });
    if (epEnCajaOBajante) continue;
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
      if (!crossVentSan) {
        // Tributario que se CONECTA (orig. usuario): su DESTINO de flujo debe caer en la
        // unión — llega al ramal/tributario principal, nunca drenan desde él. El dot-product
        // daba falsos positivos en laterales a 45° dibujados desde el lado contrario.
        // Un tributario que solo RECIBE la conexión (other tributario) no se valida aquí:
        // la prohibición ramal→tributario se aplica aparte.
        if (ram.tipo === 'tributario') {
          if (!flowEndsAt(ram, ep, tol)) {
            const principal = other.tipo === 'tributario' ? 'tributario' : 'ramal';
            return `El tributario que se conecta debe llevar la dirección de flujo hacia el ${principal} principal. Dibújalo desde el aparato hacia la conexión.`;
          }
          // Sentido (orig. usuario): el tributario no puede ENTRAR a la unión claramente en
          // contraria del anfitrión (llegando desde su lado aguas abajo, flecha contra el
          // flujo del trazo al que conecta — capturas ≥135°). Solo aplica si el anfitrión
          // ATRAVIESA la unión: si su flujo empieza o termina ahí, es convergencia de
          // fuentes (sin dirección de cruce contra la cual contrastar). Umbral cos < −0.6
          // (≈127°): laterales perpendiculares y obtusos moderados (cuerpos a 45° entre
          // tributarios) siguen pasando.
          const finTrib = flowVecAt(ram, ep, tol);
          const hostCrosses = !flowEndsAt(other, ep, tol) && !flowStartsAt(other, ep, tol);
          const fexHost = hostCrosses ? flowVecAt(other, ep, tol) : null;
          if (finTrib && fexHost) {
            const cos =
              (finTrib[0] * fexHost[0] + finTrib[1] * fexHost[1]) /
              (Math.hypot(finTrib[0], finTrib[1]) * Math.hypot(fexHost[0], fexHost[1]));
            if (cos < -0.6) {
              return 'El tributario llega en dirección contraria al trazo al que conecta. Dibújalo con el flujo entrando a la unión en el mismo sentido del ramal.';
            }
          }
          continue;
        }
        if (other.tipo === 'tributario') continue;
        if (!flowDirectionOkAt(ram, other, ep, tol)) {
          return 'El ramal que se conecta debe llevar la dirección de flujo del ramal principal. Dibújalo en el mismo sentido.';
        }
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
