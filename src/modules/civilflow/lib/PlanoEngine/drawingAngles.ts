import { pointToSegmentDist } from './HitTester';
import type { IPlanoEngineCore } from './PlanoState';

// Sanitaria y ventilación comparten uniones como una sola subred — el mismo helper que usa el
// arrastre en cascada, elevado aquí para que todo camino de detección pueda revisar contra
// ambas al buscar si un accesorio ya quedó resuelto.
function sameNetGroup(a: string, b: string): boolean {
  return a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
}

/** Valida que todos los ángulos de los segmentos y los giros internos de un ramal cumplan las
 *  reglas de su red (45° o 90° según el caso). @returns true si es válido. */
export function checkRamalAngles(pts: number[][], net: string, tipo?: string): boolean {
  if (pts.length < 2) return true;
  const isSanOrLl = net === 'san' || net === 'll';
  const isGas = net === 'gas';
  const isTributarioAcAf = (net === 'af' || net === 'ac') && tipo === 'tributario';

  if (!isSanOrLl) {
    const requiredStep = isTributarioAcAf || isGas ? 90 : 45;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const dx = x2 - x1,
        dy = y2 - y1;
      if (Math.hypot(dx, dy) < 0.1) continue;
      const deg = Math.round(((((Math.atan2(dy, dx) * 180) / Math.PI) % 360) + 360) % 360);
      const rem = deg % requiredStep;
      if (rem > 1 && rem < requiredStep - 1) {
        return false;
      }
    }
  }

  for (let i = 0; i < pts.length - 2; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[i + 2];

    const dx1 = x2 - x1,
      dy1 = y2 - y1;
    const dx2 = x3 - x2,
      dy2 = y3 - y2;
    if (Math.hypot(dx1, dy1) < 0.1 || Math.hypot(dx2, dy2) < 0.1) continue;

    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);
    const dot = dx1 * dx2 + dy1 * dy2;
    const cosVal = dot / (len1 * len2);
    const turnAngle = (Math.acos(Math.max(-1, Math.min(1, cosVal))) * 180) / Math.PI;
    const internalAngle = 180 - turnAngle;

    if (isSanOrLl) {
      if (internalAngle < 134) {
        return false;
      }
    } else if (isGas) {
      if (Math.abs(internalAngle - 90) > 10 && Math.abs(internalAngle - 180) > 1) {
        return false;
      }
    } else {
      if (internalAngle < 50) {
        return false;
      }
    }
  }

  return true;
}

/** ¿Se cruzan dos segmentos (a1-a2, b1-b2)? Excluye los casos donde solo se tocan por un
 *  extremo. @returns true si se cruzan estrictamente por el interior. */
export function segmentsIntersect(a1: number[], a2: number[], b1: number[], b2: number[]): boolean {
  const [x1, y1] = a1,
    [x2, y2] = a2,
    [x3, y3] = b1,
    [x4, y4] = b2;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-10) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return false;
  const ix = x1 + t * (x2 - x1);
  const iy = y1 + t * (y2 - y1);
  const dA1 = Math.hypot(ix - x1, iy - y1);
  const dA2 = Math.hypot(ix - x2, iy - y2);
  const dB1 = Math.hypot(ix - x3, iy - y3);
  const dB2 = Math.hypot(ix - x4, iy - y4);
  if (dA1 < 0.001 || dA2 < 0.001 || dB1 < 0.001 || dB2 < 0.001) return false;
  return true;
}

/** Devuelve el ángulo (en grados, -90..90) del primer segmento de una lista de puntos — sirve
 *  para orientar la etiqueta del ramal. */
export function _firstSegmentAngle(pts: number[][]): number {
  if (pts.length < 2) return 0;
  const dx = pts[1][0] - pts[0][0];
  const dy = pts[1][1] - pts[0][1];
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return Math.round(angle);
}

/** Pega el cursor a los puntos de proyección de 45° sobre los segmentos de otro ramal (para
 *  conectar tributarios al padre). @returns el punto pegado o null. */
export function snapTributaryToPadre45Deg(
  cursorX: number,
  cursorY: number,
  lastX: number,
  lastY: number,
  pts: number[][],
  threshold: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let minD = Infinity;

  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const dx = x2 - x1,
      dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) continue;
    const len = Math.sqrt(lenSq);
    const ux = dx / len,
      uy = dy / len;

    const tLast = ((lastX - x1) * dx + (lastY - y1) * dy) / lenSq;
    const projX = x1 + tLast * dx;
    const projY = y1 + tLast * dy;

    const perpDist = Math.hypot(lastX - projX, lastY - projY);

    const q1x = projX + ux * perpDist;
    const q1y = projY + uy * perpDist;
    const q2x = projX - ux * perpDist;
    const q2y = projY - uy * perpDist;

    const checkPoint = (qx: number, qy: number) => {
      const t = ((qx - x1) * dx + (qy - y1) * dy) / lenSq;
      if (t >= 0 && t <= 1) {
        const d = Math.hypot(cursorX - qx, cursorY - qy);
        if (d < minD && d <= threshold) {
          minD = d;
          best = { x: qx, y: qy };
        }
      }
    };
    checkPoint(q1x, q1y);
    checkPoint(q2x, q2y);
    checkPoint(projX, projY);
  }
  return best;
}

// Detecta un codo formado donde el extremo de ESTE ramal se encuentra con el extremo de OTRO
// ramal en (aproximadamente) el mismo punto — a diferencia del chequeo de vértice interno
// (puntos consecutivos del MISMO ramal), esto cubre dos ramales dibujados por separado que se
// unen extremo con extremo, o un arrastre que alinea el extremo de un ramal con el de otro.
/** Detecta cuándo el extremo de un ramal se encuentra con el extremo de otro ramal dibujado por
 *  separado, formando una unión de codo. @returns ángulo y id del otro ramal, o null. */
export function detectJunctionAccesorio(
  engine: IPlanoEngineCore,
  ramalId: string,
  epIdx: number,
): { angleDeg: number; otherRamalId: string } | null {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return null;
  const ep = r.pts[epIdx];
  const otherIdxInR = epIdx === 0 ? 1 : r.pts.length - 2;
  const awayRx = r.pts[otherIdxInR][0] - ep[0],
    awayRy = r.pts[otherIdxInR][1] - ep[1];
  const lenR = Math.hypot(awayRx, awayRy);
  if (lenR < 0.001) return null;

  const TOL = 0.5;
  for (const r2 of engine.ramales) {
    if (r2.id === r.id || !sameNetGroup(r2.net, r.net)) continue;
    if (!r2.pts || r2.pts.length < 2) continue;
    for (const j of [0, r2.pts.length - 1]) {
      const p2 = r2.pts[j];
      if (Math.hypot(p2[0] - ep[0], p2[1] - ep[1]) >= TOL) continue;
      const otherIdxInR2 = j === 0 ? 1 : r2.pts.length - 2;
      const awayR2x = r2.pts[otherIdxInR2][0] - p2[0],
        awayR2y = r2.pts[otherIdxInR2][1] - p2[1];
      const lenR2 = Math.hypot(awayR2x, awayR2y);
      if (lenR2 < 0.001) continue;
      const dot = (awayRx * awayR2x + awayRy * awayR2y) / (lenR * lenR2);
      const rawAngle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
      const turnAngle = 180 - rawAngle;
      if (Math.abs(turnAngle - 45) < 5 || Math.abs(turnAngle - 90) < 5) {
        const snapped = Math.abs(turnAngle - 45) < Math.abs(turnAngle - 90) ? 45 : 90;
        return { angleDeg: snapped, otherRamalId: r2.id };
      }
    }
  }
  return null;
}

export interface AccesorioTrigger {
  ramalId: string;
  angleDeg: number;
  junctionIndex: number;
  point: number[];
  net: string;
  isTee: boolean;
}

// Fuente única de verdad para "¿este ramal necesita el modal de selección de accesorio ahora
// mismo?" — se usa tanto justo después de dibujar un ramal como al terminar un arrastre, porque
// una unión puede crearse de cualquiera de las dos formas (dos ramales unidos al dibujar, o
// arrastrando uno hasta otro). Se salta una unión que ya tiene accesorio/aparato resuelto para
// no molestar en cada arrastre posterior una vez que el usuario ya respondió.
/** Determina si un ramal necesita el modal de selección de accesorio (tee/codo/yee) en alguno de
 *  sus extremos o vértices interiores sin resolver. @returns info del disparador o null. */
export function detectAccesorioTrigger(
  engine: IPlanoEngineCore,
  ramalId: string,
): AccesorioTrigger | null {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return null;

  const lastIdx = r.pts.length - 1;
  const endpointResolved = (idx: number) =>
    idx === 0 ? !!(r.accesorioInicio || r.aparatoInicio) : !!(r.accesorioFin || r.aparatoFin);

  for (const epIdx of [0, lastIdx]) {
    if (endpointResolved(epIdx)) continue;
    const ep = r.pts[epIdx];
    const tee = isTeeAtEndpoint(ep, engine, r.id, r.net);
    if (tee.isTee && tee.throughRamalId) {
      // Tee ya resuelta: si CUALQUIER ramal en esta unión ya tiene accesorio (colocado por una
      // selección anterior del modal), no volver a disparar el popup.
      const TOL = 0.5;
      let alreadyResolved = false;
      for (const rr of engine.ramales) {
        if (!sameNetGroup(rr.net, r.net) || !rr.pts || rr.id === r.id) continue;
        if (rr.accesorioInicio && Math.hypot(rr.pts[0][0] - ep[0], rr.pts[0][1] - ep[1]) < TOL) {
          alreadyResolved = true;
          break;
        }
        if (
          rr.accesorioFin &&
          Math.hypot(rr.pts[rr.pts.length - 1][0] - ep[0], rr.pts[rr.pts.length - 1][1] - ep[1]) <
            TOL
        ) {
          alreadyResolved = true;
          break;
        }
        if (rr.accMed) {
          for (const [k, v] of Object.entries(rr.accMed)) {
            const m = k.match(/^accMed(\d+)$/);
            if (!m || !v) continue;
            const p = rr.pts[parseInt(m[1], 10)];
            if (p && Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL) {
              alreadyResolved = true;
              break;
            }
          }
          if (alreadyResolved) break;
        }
      }
      if (alreadyResolved) continue;
      return {
        ramalId: tee.throughRamalId,
        angleDeg: 90,
        junctionIndex: -1,
        point: ep,
        net: r.net,
        isTee: true,
      };
    }
  }

  const isGas = r.net === 'gas';
  for (const epIdx of [0, lastIdx]) {
    if (endpointResolved(epIdx)) continue;
    const ep = r.pts[epIdx];
    // Si algún OTRO ramal en este extremo ya lleva un accesorio, la unión está resuelta — no
    // abrir el modal otra vez solo porque aquí también exista un ángulo de codo.
    let epAlreadyResolved = false;
    {
      const TOL = 0.5;
      for (const rr of engine.ramales) {
        if (!sameNetGroup(rr.net, r.net) || !rr.pts || rr.id === r.id) continue;
        if (rr.accesorioInicio && Math.hypot(rr.pts[0][0] - ep[0], rr.pts[0][1] - ep[1]) < TOL) {
          epAlreadyResolved = true;
          break;
        }
        if (
          rr.accesorioFin &&
          Math.hypot(rr.pts[rr.pts.length - 1][0] - ep[0], rr.pts[rr.pts.length - 1][1] - ep[1]) <
            TOL
        ) {
          epAlreadyResolved = true;
          break;
        }
        if (rr.accMed) {
          for (const [k, v] of Object.entries(rr.accMed)) {
            const m = k.match(/^accMed(\d+)$/);
            if (!m || !v) continue;
            const p = rr.pts[parseInt(m[1], 10)];
            if (p && Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL) {
              epAlreadyResolved = true;
              break;
            }
          }
          if (epAlreadyResolved) break;
        }
      }
    }
    if (epAlreadyResolved) continue;
    const junction = detectJunctionAccesorio(engine, r.id, epIdx);
    if (junction) {
      return {
        ramalId: junction.otherRamalId,
        angleDeg: junction.angleDeg,
        junctionIndex: -1,
        point: r.pts[epIdx],
        net: r.net,
        isTee: isGas ? true : false,
      };
    }
  }

  if (r.pts.length >= 3) {
    for (let i = 1; i < lastIdx; i++) {
      // accMed es un mapa anidado con llaves 'accMed<i>' en PlanoRamal (PlanoState.ts:245) — la
      // lectura plana anterior r['accMed<i>'] nunca coincidía en silencio, así que los vértices
      // que ya tenían accesorio podían volver a disparar el modal. Leer la llave anidada.
      if (r.accMed?.[`accMed${i}`]) continue;
      const prev = r.pts[i - 1];
      const curr = r.pts[i];
      const next = r.pts[i + 1];
      const d1x = curr[0] - prev[0],
        d1y = curr[1] - prev[1];
      const d2x = next[0] - curr[0],
        d2y = next[1] - curr[1];
      const len1 = Math.hypot(d1x, d1y),
        len2 = Math.hypot(d2x, d2y);
      if (len1 < 0.001 || len2 < 0.001) continue;
      const dot = (d1x * d2x + d1y * d2y) / (len1 * len2);
      const cosVal = Math.max(-1, Math.min(1, dot));
      const angleDeg = (Math.acos(cosVal) * 180) / Math.PI;
      if (Math.abs(angleDeg - 45) < 5 || Math.abs(angleDeg - 90) < 5) {
        const snapped = Math.abs(angleDeg - 45) < Math.abs(angleDeg - 90) ? 45 : 90;
        if (snapped === 45) {
          // En AF/AC/gas un quiebre interior de 45° solo admite el codo de 45° — no hay nada que
          // elegir, así que se aplica solo (marcador accMed → símbolo en el quiebre + conteo en
          // el resumen) sin abrir el modal de selección. El gas no tiene codo de 45° en su
          // catálogo: se registra su codo estándar para que el conteo y el símbolo existan.
          if (!r.accMed) r.accMed = {};
          r.accMed[`accMed${i}`] = r.net === 'gas' ? 'codos_90_std' : 'codo45rc';
          engine._markDirty();
          return null;
        }
        return {
          ramalId: r.id,
          angleDeg: snapped,
          junctionIndex: i,
          point: curr,
          net: r.net,
          isTee: isGas ? true : false,
        };
      }
    }
  }

  return null;
}

// Devuelve a qué ramal EXISTENTE (no el recién dibujado/arrastrado, `currentRamalId`) debe
// asignarse la tee — el accesorio siempre pertenece al ramal que ya estaba, nunca al que se
// acaba de crear. Prefiere el ramal sobre cuyo CUERPO (mitad de segmento, no uno de sus propios
// extremos) cae el punto de la unión — ese es sin ambigüedad "el ramal al que se le hace la
// tee" — y si los tres segmentos se encuentran exactamente extremo con extremo (ningún cuerpo
// es el "pasante"), cae a cualquier otro ramal que comparta el punto.
/** ¿Este punto forma una unión tee? — al menos 3 segmentos de ramales existentes se encuentran
 *  aquí, y sobre el cuerpo de cuál ramal cae la unión. @returns bandera isTee y el id del ramal
 *  pasante. */
export function isTeeAtEndpoint(
  ep: number[],
  engine: IPlanoEngineCore,
  currentRamalId: string,
  net: string,
): { isTee: boolean; throughRamalId: string | null } {
  const TOL = 0.5;
  let segmentCount = 0;
  let throughRamalId: string | null = null;
  let anyOtherRamalId: string | null = null;
  for (const r of engine.ramales) {
    if (!sameNetGroup(r.net, net)) continue;
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const p1 = r.pts[i];
      const p2 = r.pts[i + 1];
      const dist = pointToSegmentDist(ep[0], ep[1], p1[0], p1[1], p2[0], p2[1]);
      if (dist < TOL) {
        const atP1 = Math.hypot(ep[0] - p1[0], ep[1] - p1[1]) < TOL;
        const atP2 = Math.hypot(ep[0] - p2[0], ep[1] - p2[1]) < TOL;
        if (atP1 || atP2) {
          segmentCount++;
          if (r.id !== currentRamalId) {
            // Preferir un ramal que NO fue creado automáticamente por una división (sin
            // mergesFrom) sobre el tramo posterior que sí lo fue — el accesorio debe ir en el
            // ramal existente real.
            if (
              !anyOtherRamalId ||
              (!r.mergesFrom && engine.ramales.find((x) => x.id === anyOtherRamalId)?.mergesFrom)
            ) {
              anyOtherRamalId = r.id;
            }
          }
        } else {
          segmentCount += 2;
          if (r.id !== currentRamalId) {
            // Misma regla que anyOtherRamalId: preferir un ramal que NO fue creado por una
            // división (sin mergesFrom) — el accesorio debe aterrizar en el ramal existente
            // real, no en el tramo posterior que creó la división.
            if (
              !throughRamalId ||
              (!r.mergesFrom && engine.ramales.find((x) => x.id === throughRamalId)?.mergesFrom)
            ) {
              throughRamalId = r.id;
            }
          }
        }
      }
    }
  }
  return { isTee: segmentCount >= 3, throughRamalId: throughRamalId ?? anyOtherRamalId };
}
