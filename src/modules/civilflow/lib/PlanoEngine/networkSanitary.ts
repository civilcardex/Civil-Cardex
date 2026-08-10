import type { IPlanoEngineCore } from './PlanoState';
import { loadFromStorage, saveToStorage } from '../../services/storageService';

interface HidroTramoEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}

export function calcSanitaryAccessories(engine: IPlanoEngineCore): void {
  const planId = engine._loadedPlanId;
  if (!planId) return;

  const sanRamales = engine.ramales.filter((r) => r.net === 'san');
  const ventRamales = engine.ramales.filter((r) => r.net === 'vent');
  const storageKey = 'tramo_hidro_data_v3';
  let hidroData: Record<string, HidroTramoEntry>;
  try {
    hidroData = loadFromStorage(storageKey, {}) as Record<string, HidroTramoEntry>;
  } catch {
    hidroData = {};
  }

  let changed = false;

  const DOUBLE_YEE_MM = 10;
  const junctionRamalIds: string[] = [];
  const junctionPositions: { x: number; y: number }[] = [];
  const junctionBranchCos: number[] = [];
  const teeRamalIds: string[] = [];

  const getPointKey = (x: number, y: number) => `${x.toFixed(3)}_${y.toFixed(3)}`;
  const vertexMap = new Map<string, number[]>();
  sanRamales.forEach((r) => {
    (r.pts || []).forEach((pt) => {
      vertexMap.set(getPointKey(pt[0], pt[1]), pt);
    });
  });

  vertexMap.forEach((P) => {
    const vectors: { x: number; y: number }[] = [];

    sanRamales.forEach((rr) => {
      if (!rr.pts) return;
      let isVertex = false;
      for (let i = 0; i < rr.pts.length; i++) {
        if (Math.hypot(rr.pts[i][0] - P[0], rr.pts[i][1] - P[1]) < 0.5) {
          isVertex = true;
          if (i > 0) {
            const dx = rr.pts[i - 1][0] - P[0],
              dy = rr.pts[i - 1][1] - P[1];
            const len = Math.hypot(dx, dy);
            if (len > 0.1) vectors.push({ x: dx / len, y: dy / len });
          }
          if (i < rr.pts.length - 1) {
            const dx = rr.pts[i + 1][0] - P[0],
              dy = rr.pts[i + 1][1] - P[1];
            const len = Math.hypot(dx, dy);
            if (len > 0.1) vectors.push({ x: dx / len, y: dy / len });
          }
        }
      }
      if (!isVertex) {
        for (let i = 0; i < rr.pts.length - 1; i++) {
          const A = rr.pts[i],
            B = rr.pts[i + 1];
          const dx = B[0] - A[0],
            dy = B[1] - A[1];
          const lenSq = dx * dx + dy * dy;
          if (lenSq > 0.001) {
            let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = A[0] + t * dx,
              projY = A[1] + t * dy;
            const dist = Math.hypot(P[0] - projX, P[1] - projY);
            const lenA = Math.hypot(A[0] - P[0], A[1] - P[1]);
            const lenB = Math.hypot(B[0] - P[0], B[1] - P[1]);
            if (dist < 0.5 && lenA > 0.5 && lenB > 0.5) {
              vectors.push({ x: (A[0] - P[0]) / lenA, y: (A[1] - P[1]) / lenA });
              vectors.push({ x: (B[0] - P[0]) / lenB, y: (B[1] - P[1]) / lenB });
            }
          }
        }
      }
    });

    const uniq: typeof vectors = [];
    vectors.forEach((v) => {
      if (!uniq.some((u) => u.x * v.x + u.y * v.y > 0.99)) uniq.push(v);
    });
    if (uniq.length < 3 || uniq.length > 4) return;

    let bestPair = { i: -1, j: -1, dot: 1 };
    for (let i = 0; i < uniq.length; i++)
      for (let j = i + 1; j < uniq.length; j++) {
        const d = uniq[i].x * uniq[j].x + uniq[i].y * uniq[j].y;
        if (d < bestPair.dot) bestPair = { i, j, dot: d };
      }
    if (bestPair.dot >= -0.9) return;

    const branches = uniq.filter((_, k) => k !== bestPair.i && k !== bestPair.j);
    if (branches.length === 0) return;
    const cosVal = branches[0].x * uniq[bestPair.j].x + branches[0].y * uniq[bestPair.j].y;
    const isYee = Math.abs(cosVal) >= 0.4 && Math.abs(cosVal) <= 0.85;
    const isTee = Math.abs(cosVal) < 0.15;

    if (isYee) {
      for (const rr of sanRamales) {
        if (!rr.pts) continue;
        for (let k = 0; k < rr.pts.length; k++) {
          if (Math.hypot(rr.pts[k][0] - P[0], rr.pts[k][1] - P[1]) < 0.5) {
            junctionRamalIds.push(String(rr.id));
            junctionPositions.push({ x: P[0], y: P[1] });
            junctionBranchCos.push(cosVal);
            return;
          }
        }
        for (let k = 0; k < rr.pts.length - 1; k++) {
          const A = rr.pts[k],
            B = rr.pts[k + 1];
          const sdx = B[0] - A[0],
            sdy = B[1] - A[1];
          const sLenSq = sdx * sdx + sdy * sdy;
          if (sLenSq > 0.001) {
            let t = ((P[0] - A[0]) * sdx + (P[1] - A[1]) * sdy) / sLenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = A[0] + t * sdx,
              projY = A[1] + t * sdy;
            if (Math.hypot(P[0] - projX, P[1] - projY) < 0.5) {
              junctionRamalIds.push(String(rr.id));
              junctionPositions.push({ x: P[0], y: P[1] });
              junctionBranchCos.push(cosVal);
              return;
            }
          }
        }
      }
    }

    if (isTee) {
      for (const rr of sanRamales) {
        if (!rr.pts) continue;
        for (let k = 0; k < rr.pts.length; k++) {
          if (Math.hypot(rr.pts[k][0] - P[0], rr.pts[k][1] - P[1]) < 0.5) {
            teeRamalIds.push(String(rr.id));
            return;
          }
        }
        for (let k = 0; k < rr.pts.length - 1; k++) {
          const A = rr.pts[k],
            B = rr.pts[k + 1];
          const sdx = B[0] - A[0],
            sdy = B[1] - A[1];
          const sLenSq = sdx * sdx + sdy * sdy;
          if (sLenSq > 0.001) {
            let t = ((P[0] - A[0]) * sdx + (P[1] - A[1]) * sdy) / sLenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = A[0] + t * sdx,
              projY = A[1] + t * sdy;
            if (Math.hypot(P[0] - projX, P[1] - projY) < 0.5) {
              teeRamalIds.push(String(rr.id));
              return;
            }
          }
        }
      }
    }
  });

  const yeeCounts: Record<string, { simple: number; doble: number }> = {};
  const usedInDouble = new Set<number>();

  for (let i = 0; i < junctionPositions.length; i++) {
    for (let j = i + 1; j < junctionPositions.length; j++) {
      if (usedInDouble.has(i) || usedInDouble.has(j)) continue;
      const dist = Math.hypot(
        junctionPositions[j].x - junctionPositions[i].x,
        junctionPositions[j].y - junctionPositions[i].y,
      );
      if (dist > DOUBLE_YEE_MM) continue;
      const dx = junctionPositions[j].x - junctionPositions[i].x;
      const dy = junctionPositions[j].y - junctionPositions[i].y;
      const len = Math.hypot(dx, dy);
      if (len > 0.1) {
        const sepDot = Math.abs(
          (dx / len) *
            (junctionPositions[i].x /
              Math.hypot(junctionPositions[i].x, junctionPositions[i].y || 1)) +
            (dy / len) *
              (junctionPositions[i].y /
                Math.hypot(junctionPositions[i].x, junctionPositions[i].y || 1)),
        );
        if (sepDot < 0.85) continue;
      }
      usedInDouble.add(i);
      usedInDouble.add(j);
      const id = junctionRamalIds[i];
      if (!yeeCounts[id]) yeeCounts[id] = { simple: 0, doble: 0 };
      yeeCounts[id].doble += 1;
    }
  }

  for (let i = 0; i < junctionPositions.length; i++) {
    if (usedInDouble.has(i)) continue;
    const id = junctionRamalIds[i];
    if (!yeeCounts[id]) yeeCounts[id] = { simple: 0, doble: 0 };
    yeeCounts[id].simple += 1;
  }

  const teeCounts: Record<string, number> = {};
  for (const id of teeRamalIds) {
    if (!teeCounts[id]) teeCounts[id] = 0;
    teeCounts[id]++;
  }

  for (const r of sanRamales) {
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
          if (Math.abs(cosAngle + Math.cos(Math.PI / 4)) < 0.05) {
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
            if (Math.abs(dot - Math.cos(Math.PI / 4)) < 0.15) {
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
    let hasBajanteSube = false;
    let hasBajanteBaja = false;
    for (const baj of engine.bajantes || []) {
      if (baj.net !== 'san') continue;
      if (baj.recibeDeIds?.includes(r.id)) {
        if (baj.direccion === 'sube') {
          countSube++;
          hasBajanteSube = true;
        } else if (
          baj.direccion === 'baja' ||
          baj.direccion === undefined ||
          baj.direccion === 'continua'
        ) {
          countBaja++;
          hasBajanteBaja = true;
        }
      }
    }

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

      const processAcc = (accType: string | undefined) => {
        if (accType === 'sifon') countSifonTrib++;
        else if (accType === 'codoSube') countSubeTrib++;
        else if (accType === 'codoBaja') countBajaTrib++;
      };

      processAcc(r.accesorioInicio);
      processAcc(r.accesorioFin);

      if (
        acc['sifon'] !== countSifonTrib ||
        acc['codoReventilado'] !== countVentTrib ||
        acc['codo90rmSube'] !== countSubeTrib ||
        acc['codo90rmBaja'] !== countBajaTrib
      ) {
        if (countSifonTrib > 0) acc['sifon'] = countSifonTrib;
        else delete acc['sifon'];
        if (countVentTrib > 0) acc['codoReventilado'] = countVentTrib;
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
      if ('yeeSimple' in acc) {
        delete acc['yeeSimple'];
        changed = true;
      }
      if ('yeeDoble' in acc) {
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
      // codo reventilado — solo cuando no hay una bajante del mismo sentido que ya aportó ese
      // codo: la unión a bajante se cuenta en el loop de arriba y su campo de extremo suele
      // rellenarse solo como glifo visual (drawingCreations), así que contarlo aquí lo duplicaría.
      // El codo reventilado de extremo solo se cuenta si no hay unión vent↔san detectada
      // geométricamente (countVent), que es la misma unión que ese campo representa.
      if (!hasBajanteSube) {
        if (r.accesorioInicio === 'codo90rmSube' || r.accesorioInicio === 'codoSube') countSube++;
        if (r.accesorioFin === 'codo90rmSube' || r.accesorioFin === 'codoSube') countSube++;
      }
      if (!hasBajanteBaja) {
        if (r.accesorioInicio === 'codo90rmBaja' || r.accesorioInicio === 'codoBaja') countBaja++;
        if (r.accesorioFin === 'codo90rmBaja' || r.accesorioFin === 'codoBaja') countBaja++;
      }
      if (countVent === 0) {
        if (r.accesorioInicio === 'codoReventilado') countVent++;
        if (r.accesorioFin === 'codoReventilado') countVent++;
      }

      if (acc['sifon'] !== (countSifonRamal || undefined)) {
        if (countSifonRamal > 0) acc['sifon'] = countSifonRamal;
        else delete acc['sifon'];
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
        if (acc['yeeSimple'] !== yeeSimpleTotal) {
          acc['yeeSimple'] = yeeSimpleTotal;
          changed = true;
        }
        if (yee && acc['yeeDoble'] !== yee.doble) {
          acc['yeeDoble'] = yee.doble;
          changed = true;
        } else if (!yee && 'yeeDoble' in acc) {
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
  }

  if (changed) {
    saveToStorage(storageKey, hidroData);
    try {
      window.dispatchEvent(new Event('storage'));
    } catch {
      /* ignorar */
    }
  }
}

/**
 * Cuenta los accesorios a mitad de ramal (accMed*) y de extremo (accesorioInicio/Fin) en
 * las redes de agua (AF, AC, LL) y los escribe en tramo_hidro_data_v3 para que la tabla
 * "Accesorios por ramal" se complete correctamente en esas redes.
 * Replica la estructura usada por calcSanitaryAccessories pero generalizada para que se
 * cuente cualquier valor de accMed (p. ej. codo90rmSube, valvCompuerta, llaveTerminal).
 */
export function calcHydroAccessories(engine: IPlanoEngineCore): void {
  const planId = engine._loadedPlanId;
  if (!planId) return;

  // Recuento genérico de accMed/accesorios de extremo — aplica a todas las redes menos 'san',
  // que tiene su propia detección de uniones basada en ángulos en calcSanitaryAccessories (arriba).
  const HYDRO_NETS = ['af', 'ac', 'll', 'vent', 'gas', 'recolectora', 'rci', 'rec', 'bom'];
  const ramales = engine.ramales.filter((r) => HYDRO_NETS.includes(r.net));
  if (ramales.length === 0) return;

  const storageKey = 'tramo_hidro_data_v3';
  let hidroData: Record<string, HidroTramoEntry>;
  try {
    hidroData = loadFromStorage(storageKey, {}) as Record<string, HidroTramoEntry>;
  } catch {
    hidroData = {};
  }

  let changed = false;

  for (const r of ramales) {
    const rKey = `${r.net}_${r.id}_${planId}`;
    if (!hidroData[rKey]) hidroData[rKey] = { accesorios: {}, Lh: 0, nSalidas: 0 };
    if (!hidroData[rKey].accesorios) hidroData[rKey].accesorios = {};
    const acc = hidroData[rKey].accesorios;

    const TEE_LADO_ALIAS = new Set(['teeTapon', 'teeLlaveTerminal', 'teeSube', 'teeBaja']);
    const counts: Record<string, number> = {};
    const bump = (acc: string | undefined) => {
      if (!acc) return;
      counts[acc] = (counts[acc] || 0) + 1;
      if (TEE_LADO_ALIAS.has(acc)) counts['teeLado'] = (counts['teeLado'] || 0) + 1;
    };
    bump(r.accesorioInicio);
    bump(r.accesorioFin);
    if (r.accMed) {
      for (const val of Object.values(r.accMed)) {
        if (!val) continue;
        bump(val);
      }
    }

    // Las bajantes de LL (aguas lluvias) funcionan igual que las de SAN — un codo90rmSube/Baja
    // se infiere según la dirección a la que esté PUESTA actualmente la bajante conectada,
    // recalculado de nuevo cada vez (como hace calcSanitaryAccessories con SAN) en lugar de un
    // único escrito que queda obsoleto si la dirección cambia después. El equivalente de montante
    // en AF/AC en cambio vuelve a sincronizar un valor escrito de accesorioInicio/Fin al cambiar
    // la dirección (BajanteDirectionSelector de DrawingElementContextMenu.tsx), ya que el codo de
    // un montante vive en un campo de glifo visual ya existente — las bajantes de LL no tienen ese
    // escrito en absoluto, así que no hay nada que sincronizar; se calcula aquí en su lugar.
    if (r.net === 'll') {
      for (const baj of engine.bajantes) {
        if (baj.net !== 'll' || baj.tipo !== 'bajante') continue;
        if (!baj.recibeDeIds?.includes(r.id)) continue;
        const codoId =
          baj.direccion === 'sube'
            ? 'codo90rmSube'
            : baj.direccion === 'baja'
              ? 'codo90rmBaja'
              : null;
        if (codoId) counts[codoId] = (counts[codoId] || 0) + 1;
      }
    }

    // Item 8: en AF/AC, un aparato (distinto de nevera) en un extremo implica un codo 90° sube
    // implícito — se dibuja junto al aparato y se cuenta como accesorio. La nevera queda
    // excluida porque su acometida no sube.
    if (r.net === 'af' || r.net === 'ac') {
      for (const app of [r.aparatoInicio, r.aparatoFin]) {
        if (app && app !== 'nev') {
          counts['codo90rmSube'] = (counts['codo90rmSube'] || 0) + 1;
        }
      }
    }

    const customKeys = new Set(Object.keys(counts));
    const storedKeys = new Set(Object.keys(acc));
    const allKeys = new Set([...customKeys, ...storedKeys]);
    for (const k of allKeys) {
      const desired = counts[k] || 0;
      const current = acc[k] || 0;
      if (desired !== current) {
        if (desired > 0) acc[k] = desired;
        else delete acc[k];
        changed = true;
      }
    }
  }

  if (changed) {
    saveToStorage(storageKey, hidroData);
    try {
      window.dispatchEvent(new Event('storage'));
    } catch {
      /* ignorar */
    }
  }
}
