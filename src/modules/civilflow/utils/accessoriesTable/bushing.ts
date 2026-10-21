import {
  compactYeeDiam,
  HYDRO_TEE_IDS,
  ramalHasManualCodoAt,
  ACC_MED_CODOS,
  TEES_ACC_MED,
  type HidroEntry,
} from '../sanFittingsCatalog.ts';
import { distToSegment } from '../../lib/shared/geometry';
import { fmtPulg } from '../formatUtils.ts';
import { diamPulgFromLabel } from '../diamPulgFromLabel.ts';
import type { RamalDibujo, TribDibujo, VentDibujo, BajanteDibujo } from './collection';
import type { AddAcc } from './counting.ts';
import type { YeeJunction } from './yees';

/**
 * Bloque 14: accesorios de bajante (codo 90º del bajante + Y simple/doble) y el bushing por
 * especificación (un ramal menor que conecta a un bajante de mayor diámetro).
 */
export function calcularBushing(
  net: 'san' | 'll' | 'af' | 'ac' | 'gas',
  bajanteDrawing: BajanteDibujo[],
  drawingRamales: RamalDibujo[],
  tribDrawing: TribDibujo[],
  ventRamales: VentDibujo[],
  yeeJunctions: YeeJunction[],
  ventYeeCombos: Record<string, string[]>,
  hidroData: Record<string, HidroEntry>,
  catalog: { id: string; nombre: string }[],
  pulgById: Record<string, number>,
  addAcc: AddAcc,
): {
  bajanteBushing: Record<string, number>;
  bajanteAutoPts: Array<{ x: number; y: number }>;
} {
  const bajanteBushing: Record<string, number> = {};
  const bajanteAutoPts: Array<{ x: number; y: number }> = [];
  for (const b of bajanteDrawing as Array<{
    id: string;
    diametro: string;
    x?: number;
    y?: number;
    net?: string;
    tipo?: string;
    recibeDeIds?: string[];
    planId?: string;
  }>) {
    const bNet = b.net || net;
    if (bNet !== net) continue;
    // Ítem: además de recibeDeIds (que puede estar incompleto — solo el primer ramal conectado),
    // detectar los ramales conectados GEOMÉTRICAMENTE (un extremo coincide con el bajante). Así
    // una conexión doble de 2 ramales físicos se cuenta como doble (Y doble + 2 codos 45°) aunque
    // recibeDeIds solo registre uno.
    const geomIds: string[] = [];
    if (b.x != null && b.y != null) {
      const allForPlan = [...drawingRamales, ...tribDrawing, ...ventRamales].filter(
        (r) => r.planId === b.planId,
      );
      for (const r of allForPlan) {
        if (!r.pts || r.pts.length < 2) continue;
        const eps = [r.pts[0], r.pts[r.pts.length - 1]];
        if (eps.some((p) => Math.hypot(p[0] - b.x!, p[1] - b.y!) < 0.5)) geomIds.push(r.id);
      }
    }
    const merged = new Set<string>([...(b.recibeDeIds || []), ...geomIds]);
    const ids = [...merged];
    if (ids.length === 0 || ids.length > 2) continue;
    const bDiamStr = fmtPulg(diamPulgFromLabel(b.diametro));
    if (!bDiamStr || bDiamStr === '—') continue;
    const bPulg = diamPulgFromLabel(b.diametro);
    // Collect ramal diams for this bajante (same plan)
    const ramalInfos: Array<{
      id: string;
      diamStr: string;
      pulg: number;
      pts?: number[][];
      accIni?: string;
      accFin?: string;
    }> = [];
    let missing = false;
    for (const rid of ids) {
      // Find ramal in drawingRamales/tribDrawing/ventRamales for same plan
      const allForPlan = [...drawingRamales, ...tribDrawing, ...ventRamales].filter(
        (r) => r.planId === b.planId,
      );
      const found = allForPlan.find((r) => r.id === rid) as
        | { diametro: string; pts: number[][]; accesorioInicio?: string; accesorioFin?: string }
        | undefined;
      if (!found) {
        // Fallback: try pulgById for diam
        const p = pulgById[rid] || pulgById[`${rid}-${b.planId}`] || 0;
        if (p > 0) {
          ramalInfos.push({ id: rid, diamStr: fmtPulg(p), pulg: p });
        } else {
          missing = true;
          break;
        }
      } else {
        const p = diamPulgFromLabel(found.diametro) || pulgById[rid] || 0;
        if (p <= 0) {
          missing = true;
          break;
        }
        ramalInfos.push({
          id: rid,
          diamStr: fmtPulg(p),
          pulg: p,
          pts: found.pts,
          accIni: found.accesorioInicio,
          accFin: found.accesorioFin,
        });
      }
    }
    if (missing || ramalInfos.length !== ids.length) continue;
    // Punto del bajante procesado (para no duplicar bushing con la yee geométrica del mismo punto).
    if (b.x != null && b.y != null) bajanteAutoPts.push({ x: b.x, y: b.y });
    // Cajas (caja_san/caja_ll) y bombas: CERO accesorios en el resumen (orig. usuario) — aunque
    // tengan dNominal asignado y 1–2 ramales conectados. El punto ya se registró arriba para que
    // la supresión de yees geométricas siga operando en ese punto.
    if (b.tipo === 'caja_san' || b.tipo === 'caja_ll' || b.tipo === 'bomba') continue;
    const codo45Id = bNet === 'gas' ? 'codos_45' : 'codo45rc';
    const ySimpleId = 'yeeSimple';
    const yDobleId = 'yeeDoble';
    if (ramalInfos.length === 1) {
      const r = ramalInfos[0];
      // Conexión ramal→bajante: yee simple (ramal×bajante, compactada) + codo 90° del
      // diámetro del bajante. Si el ramal ya trae codo manual en el extremo que toca al
      // bajante, ese cubre la pieza y no se auto-agrega otro.
      const yCombo = compactYeeDiam([r.diamStr, bDiamStr]);
      if (yCombo) addAcc(yCombo, ySimpleId, 1);
      if (!ramalHasManualCodoAt(r, b.x, b.y)) addAcc(bDiamStr, 'codo90rm', 1);
      if (r.pulg !== bPulg) {
        const max = Math.max(r.pulg, bPulg);
        const min = Math.min(r.pulg, bPulg);
        const bk = `${max}_${min}`;
        bajanteBushing[bk] = (bajanteBushing[bk] || 0) + 1;
      }
    } else if (ramalInfos.length === 2) {
      const r1 = ramalInfos[0];
      const r2 = ramalInfos[1];
      // Validate lateral equality
      if (Math.abs(r1.pulg - r2.pulg) > 0.01) {
        // lateral diam mismatch — skip Y double per spec (not allowed)
        // Still count codos but not Y
        const diam1 = `${r1.diamStr}×${bDiamStr}`;
        const diam2 = `${r2.diamStr}×${bDiamStr}`;
        addAcc(diam1, codo45Id, 1);
        addAcc(diam2, codo45Id, 1);
        // No Y double, no bushing? Could still have bushing per ramal? Spec says for double, bushing only if main vs lateral differ, not per ramal
        continue;
      }
      const lateralStr = r1.diamStr; // same as r2
      const lateralPulg = r1.pulg;
      const diam1 = `${r1.diamStr}×${bDiamStr}`;
      const diam2 = `${r2.diamStr}×${bDiamStr}`;
      addAcc(diam1, codo45Id, 1);
      addAcc(diam2, codo45Id, 1);
      const yDobleDiam = compactYeeDiam([lateralStr, lateralStr, bDiamStr]);
      if (yDobleDiam) addAcc(yDobleDiam, yDobleId, 1);
      if (Math.abs(lateralPulg - bPulg) > 0.01) {
        const max = Math.max(lateralPulg, bPulg);
        const min = Math.min(lateralPulg, bPulg);
        const bk = `${max}_${min}`;
        bajanteBushing[bk] = (bajanteBushing[bk] || 0) + 1;
      }
    }
  }

  // Bushing en brazos de yee con diámetros diferentes (san): por unión, un bushing por cada
  // par único (mayor,menor) entre sus brazos. Las uniones pegadas a un bajante ya procesado
  // arriba se saltan (el bloque bajante ya contó sus reducciones) para no duplicar.
  if (net === 'san') {
    const addYeeBushing = (arms: number[]) => {
      const uniq = [...new Set(arms.filter((p) => p > 0))];
      const seen = new Set<string>();
      for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
          if (uniq[i] === uniq[j]) continue;
          const k = `${Math.max(uniq[i], uniq[j])}_${Math.min(uniq[i], uniq[j])}`;
          if (seen.has(k)) continue;
          seen.add(k);
          bajanteBushing[k] = (bajanteBushing[k] || 0) + 1;
        }
      }
    };
    for (const j of yeeJunctions) {
      if (bajanteAutoPts.some((p) => Math.hypot(j.x - p.x, j.y - p.y) < 1.0)) continue;
      addYeeBushing([j.m1, j.m2, j.branch].map((d) => diamPulgFromLabel(d || '')));
    }
    for (const combos of Object.values(ventYeeCombos)) {
      for (const combo of combos) {
        addYeeBushing(combo.split('×').map((d) => diamPulgFromLabel(d)));
      }
    }
  }

  // Gas (y cualquier red sin `tramos`): los accesorios de extremo/inicio se leen directo del
  // dibujo (hidroData key `${net}_${id}_${planId}`, que calcHydroAccessories escribe).
  if (net === 'gas') {
    for (const r of drawingRamales) {
      const key = `gas_${r.id}_${r.planId}`;
      const srcAcc = hidroData[key]?.accesorios || {};
      const mainDiamStr = fmtPulg(diamPulgFromLabel(r.diametro) || pulgById[r.id] || 0);
      for (const a of catalog) {
        if (HYDRO_TEE_IDS.has(a.id)) continue;
        const v = srcAcc[a.id] || 0;
        if (v > 0) addAcc(mainDiamStr, a.id, v);
      }
    }
  }

  // Tees dibujadas a mitad de cuerpo (marcadores accMed) o en extremos (accesorioInicio/Fin) —
  // una por marcador. Nomenclatura (misma que la Y): se muestra el diámetro de CADA ramal que
  // compone la tee — Principal₁×Principal₂×Derivación. La derivación es el ramal cuyo extremo
  // toca el punto del marcador y NO es colineal con el host (tee en 90° o 45°); el segundo
  // brazo de la línea es la continuación colineal del host (reducción) o el propio host si no
  // hay reducción. Sin derivación se cae a una sola medida.
  if (net !== 'san') {
    const addTeeRow = (
      mainDiamStr: string,
      accId: string,
      pt: number[] | undefined,
      host: { id: string; pts: number[][] },
    ) => {
      let branchDiam = '';
      let contDiam = '';
      if (pt && host.pts.length >= 2) {
        const diamOf = (child: { id: string; diametro: string; planId: string }) =>
          fmtPulg(
            diamPulgFromLabel(child.diametro) ||
              pulgById[child.id] ||
              pulgById[`${child.id}-${child.planId}`] ||
              0,
          );
        // Dirección del host en el punto del marcador (el signo es irrelevante: se usa |dot|).
        let hdx = 0;
        let hdy = 0;
        for (let i = 0; i < host.pts.length - 1; i++) {
          const [ax, ay] = host.pts[i];
          const [bx, by] = host.pts[i + 1];
          if (distToSegment(pt, [ax, ay], [bx, by]) < 0.5) {
            hdx = bx - ax;
            hdy = by - ay;
            break;
          }
        }
        if (hdx === 0 && hdy === 0) {
          hdx = host.pts[1][0] - host.pts[0][0];
          hdy = host.pts[1][1] - host.pts[0][1];
        }
        const hLen = Math.hypot(hdx, hdy);
        const holders: {
          cont: { d: number; diam: string } | null;
          branch: { d: number; diam: string } | null;
        } = { cont: null, branch: null };
        const consider = (
          child: { pts: number[][]; id: string; diametro: string; planId: string },
          diamStr: string,
        ) => {
          if (!diamStr || diamStr === '—') return;
          for (const e of [child.pts[0], child.pts[child.pts.length - 1]]) {
            const d = Math.hypot(e[0] - pt[0], e[1] - pt[1]);
            if (d >= 1) continue;
            const [ea, eb] =
              e === child.pts[0]
                ? [child.pts[1], child.pts[0]]
                : [child.pts[child.pts.length - 2], child.pts[child.pts.length - 1]];
            const cDx = eb[0] - ea[0];
            const cDy = eb[1] - ea[1];
            const cLen = Math.hypot(cDx, cDy);
            if (cLen <= 0.1 || hLen <= 0.1) continue;
            const dot = Math.abs((hdx / hLen) * (cDx / cLen) + (hdy / hLen) * (cDy / cLen));
            if (dot >= 0.9) {
              // Colineal con el host: es la CONTINUACIÓN de la línea (reducción), no la
              // derivación — se usa como segundo brazo del diámetro.
              if (!holders.cont || d < holders.cont.d) holders.cont = { d, diam: diamStr };
            } else if (!holders.branch || d < holders.branch.d) {
              holders.branch = { d, diam: diamStr };
            }
          }
        };
        // El brazo de una tee es casi siempre un tributario (AF/AC) — se escanea primero para
        // que gane en empates de distancia; entre todos gana el extremo más cercano al marcador.
        for (const child of tribDrawing) {
          if (child.id === host.id) continue;
          consider(child, diamOf(child));
        }
        for (const child of drawingRamales) {
          if (child.id === host.id) continue;
          consider(child, diamOf(child));
        }
        branchDiam = holders.branch ? holders.branch.diam : '';
        contDiam = holders.cont ? holders.cont.diam : '';
      }
      if (branchDiam) addAcc(`${mainDiamStr}×${contDiam || mainDiamStr}×${branchDiam}`, accId, 1);
      else addAcc(mainDiamStr, accId, 1);
    };

    for (const r of drawingRamales) {
      const mainDiamStr = fmtPulg(diamPulgFromLabel(r.diametro) || pulgById[r.id] || 0);
      if (!mainDiamStr || mainDiamStr === '—') continue;
      if (r.accMed) {
        for (const [key, accId] of Object.entries(r.accMed)) {
          // Codons a mitad de ramal — columna propia "Codo medio 90°": en AF/AC el glifo ya no se
          // dibuja (el arco del quiebre es el codo), pero la pieza se compra y debe contarse.
          // El codo de 45° (auto-aplicado en quiebres de 45° de AF/AC) va en su fila de catálogo.
          if (ACC_MED_CODOS.has(accId)) {
            addAcc(mainDiamStr, 'codoMedio90', 1);
            continue;
          }
          if (accId === 'codo45rc') {
            addAcc(mainDiamStr, 'codo45rc', 1);
            continue;
          }
          if (!TEES_ACC_MED.has(accId)) continue;
          if (!catalog.some((a) => a.id === accId)) continue;
          const m = key.match(/^accMed(\d+)$/);
          const idx = m ? parseInt(m[1], 10) : -1;
          const pt = idx >= 0 ? r.pts[idx] : undefined;
          addTeeRow(mainDiamStr, accId, pt, r);
        }
      }
      if (r.accesorioInicio && TEES_ACC_MED.has(r.accesorioInicio)) {
        if (catalog.some((a) => a.id === r.accesorioInicio)) {
          addTeeRow(mainDiamStr, r.accesorioInicio, r.pts[0], r);
        }
      }
      if (r.accesorioFin && TEES_ACC_MED.has(r.accesorioFin)) {
        if (catalog.some((a) => a.id === r.accesorioFin)) {
          addTeeRow(mainDiamStr, r.accesorioFin, r.pts[r.pts.length - 1], r);
        }
      }
    }

    // Tributarios: sus tees de extremo no tienen derivación (la tee cierra la línea), así que
    // siempre van con una sola medida.
    for (const child of tribDrawing) {
      const mainDiamStr = fmtPulg(diamPulgFromLabel(child.diametro) || pulgById[child.id] || 0);
      if (!mainDiamStr || mainDiamStr === '—') continue;
      if (child.accMed) {
        for (const accId of Object.values(child.accMed)) {
          if (ACC_MED_CODOS.has(accId)) addAcc(mainDiamStr, 'codoMedio90', 1);
          else if (accId === 'codo45rc') addAcc(mainDiamStr, 'codo45rc', 1);
        }
      }
      for (const accId of [child.accesorioInicio || '', child.accesorioFin || '']) {
        if (!accId || !TEES_ACC_MED.has(accId)) continue;
        if (!catalog.some((a) => a.id === accId)) continue;
        addAcc(mainDiamStr, accId, 1);
      }
    }
  }

  return { bajanteBushing, bajanteAutoPts };
}
