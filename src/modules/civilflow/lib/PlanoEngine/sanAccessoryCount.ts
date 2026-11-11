/**
 * Conteo de accesorios por ramal san/vent y escritura de la hidráulica (tramo_hidro_data):
 * yees simples/dobles, tees, codos 45°, codos reventilados (con la detección geométrica
 * vent↔san), sifones, sube/baja y el pase genérico OWNED_ACC que borra del storage los
 * accesorios que el dibujo ya no tiene. Extraído verbatim de sanAccessoriesCalc.ts.
 * Ej: 2 codos y una tee en RAF1 aparecen en la fila 2" del resumen de accesorios.
 */
import type { PlanoRamal } from './PlanoState.ts';
import { ANGLE_EPS } from './drawingAngles.ts';
import type { SanJunctionCtx } from './sanJunctionGeometry.ts';
import type { SanJunctionResult } from './sanJunctionDetect.ts';

/** Entrada de hidráulica por tramo san/ll: accesorios contados, longitud horizontal (m) y
 *  n.º de salidas. Ej: {accesorios:{c90:2,tee:1}, Lh:6.4, nSalidas:3} alimenta el resumen
 *  de accesorios por diámetro. */
export interface HidroTramoEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}

/** Regla del usuario (definición fija): Yee doble SOLO cuando las DOS derivaciones caen en
 *  el MISMO punto (4 direcciones = 2 salidas laterales en un solo glifo). Dos uniones
 *  separadas —aunque estén pegadas— son SIEMPRE yees simples. La bandera [P,P] persistida
 *  preserva la identidad a través del render; un lateral tapiado mantiene la doble viva.
 *  Ej: yeeCounts['RS1'] = {simple: 2, doble: 1}. */
export function contarYeesYTees(
  ctx: SanJunctionCtx,
  junction: SanJunctionResult,
): {
  yeeCounts: Record<string, { simple: number; doble: number }>;
  teeCounts: Record<string, number>;
} {
  const yeeCounts: Record<string, { simple: number; doble: number }> = {};
  for (let i = 0; i < junction.junctionPositions.length; i++) {
    const id = junction.junctionRamalIds[i];
    if (!yeeCounts[id]) yeeCounts[id] = { simple: 0, doble: 0 };
    const P = junction.junctionPositions[i];
    const pt = [P.x, P.y];
    const pair = ctx.pairOf(pt);
    const branches = ctx.dirsAt(pt) - 2;
    const isDoble =
      !!pair &&
      (branches >= 2 ||
        ctx.taponAnchoredAt(pt) ||
        ctx.taponAnchoredAt(pair.a) ||
        ctx.taponAnchoredAt(pair.b));
    if (isDoble) yeeCounts[id].doble += 1;
    else yeeCounts[id].simple += 1;
  }
  const teeCounts: Record<string, number> = {};
  for (const id of junction.teeRamalIds) {
    if (!teeCounts[id]) teeCounts[id] = 0;
    teeCounts[id]++;
  }
  return { yeeCounts, teeCounts };
}

/** Pase por cada ramal san: calcula sus conteos y sincroniza hidroData[rKey].accesorios.
 *  Devuelve `changed` (si el storage cambió y hay que guardar). */
export function contarAccesoriosPorRamal(
  ctx: SanJunctionCtx,
  conteos: {
    yeeCounts: Record<string, { simple: number; doble: number }>;
    teeCounts: Record<string, number>;
  },
  ventRamales: PlanoRamal[],
  planId: string,
  hidroData: Record<string, HidroTramoEntry>,
): boolean {
  const { yeeCounts, teeCounts } = conteos;
  let changed = false;

  for (const r of ctx.sanRamales) {
    let count45 = 0;
    let countVent = 0;

    if (r.pts && r.pts.length >= 3) {
      for (let i = 1; i < r.pts.length - 1; i++) {
        const p0 = r.pts[i - 1],
          p1 = r.pts[i],
          p2 = r.pts[i + 1];
        const ax = p1[0] - p0[0],
          ay = p1[1] - p0[1];
        const bx = p2[0] - p1[0],
          by = p2[1] - p1[1];
        const lenA = Math.hypot(ax, ay),
          lenB = Math.hypot(bx, by);
        if (lenA > 0 && lenB > 0) {
          const ux = -ax / lenA,
            uy = -ay / lenA;
          const vx = bx / lenB,
            vy = by / lenB;
          const cosAngle = ux * vx + uy * vy;
          // Item 5: 45° estricto. Tolerancia = ANGLE_EPS (0.5°) en espacio de coseno
          // (~0.006) — absorbe solo error de punto flotante, no dibujo libre. Antes
          // usaba 0.05 (~2.9°) que permitía 44°/46°; ahora solo admite 45° ± 0.5°.
          if (
            Math.abs(cosAngle + Math.cos(Math.PI / 4)) <
            1 - Math.cos(Math.PI / 4 + (ANGLE_EPS * Math.PI) / 180)
          ) {
            count45++;
          }
        }
      }
    }

    // Item 7: una unión vent↔san se clasifica por el ángulo de aproximación — en Y (≈45°) es una
    // yee con los diámetros de ambos ramales; perpendicular (≈90°) es un codo reventilado. Sin
    // esta distinción, toda conexión vent↔san contaba como codo reventilado, incluso cuando era
    // una Y.
    let countVentY = 0;
    if (r.pts && r.pts.length >= 2) {
      for (const v of ventRamales) {
        if (!v.pts || v.pts.length < 2) continue;
        const end1 = v.pts[0];
        const end2 = v.pts[v.pts.length - 1];
        let connected = false;
        let junctionSegDx = 0,
          junctionSegDy = 0;

        for (let i = 0; i < r.pts.length - 1; i++) {
          const [ax, ay] = r.pts[i];
          const [bx, by] = r.pts[i + 1];
          const sDx = bx - ax,
            sDy = by - ay;
          const sLenSq = sDx * sDx + sDy * sDy;
          if (sLenSq < 0.0001) continue;

          for (const end of [end1, end2]) {
            let t = ((end[0] - ax) * sDx + (end[1] - ay) * sDy) / sLenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = ax + t * sDx,
              projY = ay + t * sDy;
            if (Math.hypot(end[0] - projX, end[1] - projY) < 0.5) {
              connected = true;
              junctionSegDx = sDx;
              junctionSegDy = sDy;
              break;
            }
          }
          if (connected) break;
        }

        if (connected) {
          // Dirección de aproximación del vent hacia la unión (desde el extremo lejano hacia el
          // extremo que toca al san).
          const vLen = Math.hypot(end2[0] - end1[0], end2[1] - end1[1]);
          const segLen = Math.hypot(junctionSegDx, junctionSegDy);
          if (vLen > 0.1 && segLen > 0.1) {
            const dot = Math.abs(
              (junctionSegDx / segLen) * ((end2[0] - end1[0]) / vLen) +
                (junctionSegDy / segLen) * ((end2[1] - end1[1]) / vLen),
            );
            // |cos| ≈ √2/2 → 45° (Y); |cos| ≈ 0 → 90° (codo reventilado).
            // Item 5: 45° estricto — tolerancia ANGLE_EPS (0.5°) en espacio de coseno.
            // Antes usaba 0.15 (~8.6°) que permitía 44°/46°; ahora solo admite 45° ± 0.5°.
            const cos45 = Math.cos(Math.PI / 4);
            const tol45 = Math.cos(((45 - ANGLE_EPS) * Math.PI) / 180) - cos45;
            if (Math.abs(dot - cos45) < tol45) {
              countVentY++;
            } else {
              countVent++;
            }
          } else {
            countVent++;
          }
        }
      }
    }

    let countSube = 0;
    let countBaja = 0;
    // ponytail: bajante connection does NOT auto-create a codo (render never draws it, orig #4).
    // Only persisted accesorio (aparato/montante) counts — removes the "extra codo 90".

    const rKey = `san_${r.id}_${planId}`;
    if (!hidroData[rKey]) hidroData[rKey] = { accesorios: {}, Lh: 0, nSalidas: 0 };
    if (!hidroData[rKey].accesorios) hidroData[rKey].accesorios = {};

    const acc = hidroData[rKey].accesorios;

    if (r.tipo === 'tributario') {
      let countSifonTrib = 0;
      // Reutiliza la detección geométrica vent→san de arriba (idéntica a la rama no-tributario
      // de abajo) en lugar de leer un accesorioInicio/Fin almacenado — los tributarios nunca
      // tuvieron ese campo autogenerado para este tipo de unión, así que confiar en él dejaba el
      // contador permanentemente en cero cuando el lado sanitario de un codo reventilado era un
      // tributario y no un ramal normal.
      const countVentTrib = countVent;
      let countSubeTrib = 0;
      let countBajaTrib = 0;
      let countVentTribExplicit = 0;

      const processAcc = (accType: string | undefined) => {
        if (accType === 'sifon') countSifonTrib++;
        else if (accType === 'codoSube' || accType === 'codo90rmSube') countSubeTrib++;
        else if (accType === 'codoBaja' || accType === 'codo90rmBaja') countBajaTrib++;
        else if (accType === 'codoReventilado') countVentTribExplicit++;
      };

      processAcc(r.accesorioInicio);
      processAcc(r.accesorioFin);
      // ponytail: cada sifón implica un codo 90° sube (mismo conteo que FixturesPanel bump).
      countSubeTrib += countSifonTrib;
      // Un codo reventilado puesto explícito en el extremo (p. ej. inodoro que cambia codo 90°
      // sube → codo reventilado) cuenta aunque no haya vent geométrico tocando — espejo de la
      // rama ramal (`if (countVent === 0)`): si ya hay detección geométrica, el explícito es la
      // misma unión y no se suma para no duplicar.
      const countVentTribTotal = countVentTrib > 0 ? countVentTrib : countVentTribExplicit;

      if (
        acc['sifon'] !== countSifonTrib ||
        acc['codoReventilado'] !== countVentTribTotal ||
        acc['codo90rmSube'] !== countSubeTrib ||
        acc['codo90rmBaja'] !== countBajaTrib
      ) {
        if (countSifonTrib > 0) acc['sifon'] = countSifonTrib;
        else delete acc['sifon'];
        if (countVentTribTotal > 0) acc['codoReventilado'] = countVentTribTotal;
        else delete acc['codoReventilado'];
        if (countSubeTrib > 0) acc['codo90rmSube'] = countSubeTrib;
        else delete acc['codo90rmSube'];
        if (countBajaTrib > 0) acc['codo90rmBaja'] = countBajaTrib;
        else delete acc['codo90rmBaja'];
        changed = true;
      }

      if ('codo45rc' in acc) {
        delete acc['codo45rc'];
        changed = true;
      }
      // Yees de uniones ENTRE tributarios (todos los brazos son T, p. ej. T1RS3+T3RS1+T2RS1):
      // el host del conteo cae en el primer tributario del punto — si este tributario ES host
      // de una yee, el recuento la conserva; si no, se limpia la clave (anti-duplicado de
      // siempre). Antes el borrado incondicional hacía desaparecer la yee del resumen
      // (orig. usuario: contaba 2 de 3 — la unión entre tributarios se perdía).
      const yeeOwn = yeeCounts[String(r.id)];
      if (yeeOwn?.simple) {
        if (acc['yeeSimple'] !== yeeOwn.simple) {
          acc['yeeSimple'] = yeeOwn.simple;
          changed = true;
        }
      } else if ('yeeSimple' in acc) {
        delete acc['yeeSimple'];
        changed = true;
      }
      if (yeeOwn?.doble) {
        if (acc['yeeDoble'] !== yeeOwn.doble) {
          acc['yeeDoble'] = yeeOwn.doble;
          changed = true;
        }
      } else if ('yeeDoble' in acc) {
        delete acc['yeeDoble'];
        changed = true;
      }
      if ('tee' in acc) {
        delete acc['tee'];
        changed = true;
      }
    } else {
      // Cuenta sifones desde los accesorios extremos del ramal
      let countSifonRamal = 0;
      if (r.accesorioInicio === 'sifon') countSifonRamal++;
      if (r.accesorioFin === 'sifon') countSifonRamal++;
      // Cuenta accesorios explícitos a mitad de ramal (accMed*, asignados con clic derecho sobre
      // el cuerpo del ramal). codoReventilado se excluye deliberadamente — ya se contó arriba
      // mediante la detección geométrica vent→san (countVent), y los accesorios a mitad de ramal
      // ya no se pueden asignar manualmente en cuerpos san, así que cualquier codoReventilado en
      // accMed es esa misma unión autodetectada; contarlo aquí de nuevo lo duplicaría.
      if (r.accMed) {
        for (const val of Object.values(r.accMed)) {
          if (val === 'sifon') countSifonRamal++;
          else if (val === 'codo90rmSube') countSube++;
          else if (val === 'codo90rmBaja') countBaja++;
        }
      }

      // Cuenta accesorios de extremo colocados directamente (clic derecho) — codo 90° sube/baja y
      // codo reventilado. Sin gating por bajante: el bajante no auto-crea codo, así que todo codo
      // persistido (aparato o montante) se cuenta una sola vez.
      if (r.accesorioInicio === 'codo90rmSube' || r.accesorioInicio === 'codoSube') countSube++;
      if (r.accesorioFin === 'codo90rmSube' || r.accesorioFin === 'codoSube') countSube++;
      if (r.accesorioInicio === 'codo90rmBaja' || r.accesorioInicio === 'codoBaja') countBaja++;
      if (r.accesorioFin === 'codo90rmBaja' || r.accesorioFin === 'codoBaja') countBaja++;
      // ponytail: cada sifón implica un codo 90° sube (mismo conteo que FixturesPanel bump).
      countSube += countSifonRamal;
      if (countVent === 0) {
        if (r.accesorioInicio === 'codoReventilado') countVent++;
        if (r.accesorioFin === 'codoReventilado') countVent++;
      }

      if (acc['sifon'] !== (countSifonRamal || undefined)) {
        if (countSifonRamal > 0) acc['sifon'] = countSifonRamal;
        else delete acc['sifon'];
        changed = true;
      }
      // Tapón: reconteo desde el dibujo (extremos + accMed) — igual que sifón. Así el conteo
      // se repara solo cuando el caso yee doble desaparece y la limpieza de arriba retira los
      // tapones huérfanos (orig. usuario: el tapón quedaba contado para siempre).
      let countTapon = 0;
      if (r.accesorioInicio === 'tapon') countTapon++;
      if (r.accesorioFin === 'tapon') countTapon++;
      if (r.accMed) {
        for (const val of Object.values(r.accMed)) if (val === 'tapon') countTapon++;
      }
      if (acc['tapon'] !== (countTapon || undefined)) {
        if (countTapon > 0) acc['tapon'] = countTapon;
        else delete acc['tapon'];
        changed = true;
      }
      if (
        acc['codo45rc'] !== count45 ||
        acc['codoReventilado'] !== countVent ||
        acc['codo90rmSube'] !== countSube ||
        acc['codo90rmBaja'] !== countBaja
      ) {
        if (count45 > 0) acc['codo45rc'] = count45;
        else delete acc['codo45rc'];
        if (countVent > 0) acc['codoReventilado'] = countVent;
        else delete acc['codoReventilado'];
        if (countSube > 0) acc['codo90rmSube'] = countSube;
        else delete acc['codo90rmSube'];
        if (countBaja > 0) acc['codo90rmBaja'] = countBaja;
        else delete acc['codo90rmBaja'];
        changed = true;
      }

      const yee = yeeCounts[String(r.id)];
      const yeeSimpleTotal = (yee ? yee.simple : 0) + countVentY;
      if (yee || countVentY > 0) {
        if (yeeSimpleTotal > 0) {
          if (acc['yeeSimple'] !== yeeSimpleTotal) {
            acc['yeeSimple'] = yeeSimpleTotal;
            changed = true;
          }
        } else if ('yeeSimple' in acc) {
          // La unión pasó a doble (bandera persistida): la clave simple a 0 se elimina.
          delete acc['yeeSimple'];
          changed = true;
        }
        // yeeDoble PROPIETARIO: se escribe el conteo real (pares geométricos + dobles con 4
        // direcciones o lateral tapiado) y se ELIMINA cuando ya no queda ninguna. Antes se
        // conservaba a propósito y doble→simple nunca se reflejaba en el conteo (orig. usuario).
        const dobleTotal = yee ? yee.doble : 0;
        if (dobleTotal > 0) {
          if (acc['yeeDoble'] !== dobleTotal) {
            acc['yeeDoble'] = dobleTotal;
            changed = true;
          }
        } else if ('yeeDoble' in acc) {
          delete acc['yeeDoble'];
          changed = true;
        }
      } else {
        if ('yeeSimple' in acc) {
          delete acc['yeeSimple'];
          changed = true;
        }
        if ('yeeDoble' in acc) {
          delete acc['yeeDoble'];
          changed = true;
        }
      }

      const tee = teeCounts[String(r.id)] || 0;
      if (acc['tee'] !== tee) {
        if (tee > 0) acc['tee'] = tee;
        else delete acc['tee'];
        changed = true;
      }
    }

    // Pase genérico de propiedad: TODO accesorio manual del dibujo (extremos + accMed) sin
    // recuento geométrico propio se cuenta directo desde los campos y se BORRA del storage
    // cuando el dibujo ya no lo tiene. Antes los conteos solo se sumaban (modal/bump) y un
    // accesorio quitado (split, heal, borrado) quedaba contado para siempre (orig. usuario:
    // conteos que no bajan). Las claves con recuento geométrico propio quedan excluidas.
    const OWNED_ACC = new Set([
      'sifon',
      'tapon',
      'codo45rc',
      'codoReventilado',
      'codo90rmSube',
      'codo90rmBaja',
      'tee',
      'yeeSimple',
      'yeeDoble',
    ]);
    const aliasAccId = (a: string) =>
      a === 'codoSube' ? 'codo90rmSube' : a === 'codoBaja' ? 'codo90rmBaja' : a;
    const drawn: Record<string, number> = {};
    for (const a of [r.accesorioInicio, r.accesorioFin]) {
      if (!a) continue;
      const id = aliasAccId(a);
      if (!OWNED_ACC.has(id)) drawn[id] = (drawn[id] || 0) + 1;
    }
    if (r.accMed) {
      for (const val of Object.values(r.accMed)) {
        if (!val) continue;
        const id = aliasAccId(val);
        if (!OWNED_ACC.has(id)) drawn[id] = (drawn[id] || 0) + 1;
      }
    }
    const accKeys = new Set([...Object.keys(acc), ...Object.keys(drawn)]);
    for (const k of accKeys) {
      if (OWNED_ACC.has(k)) continue;
      const d = drawn[k] || 0;
      if ((acc[k] || 0) !== d) {
        if (d > 0) acc[k] = d;
        else delete acc[k];
        changed = true;
      }
    }
  }

  return changed;
}
