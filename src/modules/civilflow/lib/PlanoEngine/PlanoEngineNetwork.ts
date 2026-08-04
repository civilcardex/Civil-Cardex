import { NETS } from './PlanoState';
import type { PlanoRamal, PlanoBajante } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { segmentLooseIntersectionPoint, segmentStrictIntersectionPoint } from './drawingAngles';

export {
  _renumberRamales,
  _renumberBajantes,
  _renumberMontantes,
  _renumberAreas,
} from './networkRenumber';
export { calcSanitaryAccessories, calcHydroAccessories } from './networkSanitary';

export function getElementsByNet(
  engine: IPlanoEngineCore,
  netId: string,
): Array<{
  type: string;
  id: string;
  label: string;
  totalL: number;
  segs: number;
  piso: string;
  tipo: string;
  padre?: string | null;
  pendiente?: number;
  diametro?: string;
}> {
  const items: Array<{
    type: string;
    id: string;
    label: string;
    totalL: number;
    segs: number;
    piso: string;
    tipo: string;
    padre?: string | null;
    pendiente?: number;
    diametro?: string;
  }> = [];
  for (const r of engine.ramales) {
    if (r.net === netId) {
      items.push({
        type: 'ramal',
        id: r.id,
        label: r.label || r.id,
        totalL: r.totalL || 0,
        segs: r.pts ? Math.max(0, r.pts.length - 1) : 0,
        piso: r.piso || '',
        tipo: r.tipo || 'ramal',
        padre: r.padre || null,
        pendiente: r.pendiente,
        diametro: r.diametro,
      });
    }
  }
  for (const b of engine.bajantes) {
    if (b.net === netId) {
      items.push({
        type: 'bajante',
        id: b.id,
        label: b.code || b.id,
        totalL: b.totalL || 0,
        segs: 0,
        piso: b.piso || '',
        tipo: b.tipo || 'bajante',
        pendiente: b.pendiente,
        diametro: b.dNominal,
      });
    }
  }
  return items;
}

export function setNetHidden(engine: IPlanoEngineCore, netId: string, hidden: boolean): void {
  if (hidden) engine._hiddenNets.add(netId);
  else engine._hiddenNets.delete(netId);
  engine.render();
}

export function setNetLocked(engine: IPlanoEngineCore, netId: string, locked: boolean): void {
  if (locked) engine._lockedNets.add(netId);
  else engine._lockedNets.delete(netId);
  engine.render();
}

export function clearNet(engine: IPlanoEngineCore, netId: string): void {
  engine.ramales = engine.ramales.filter((r) => r.net !== netId);
  engine.bajantes = engine.bajantes.filter((b) => b.net !== netId);
  engine.areas = engine.areas.filter((a) => a.net !== netId);
  // Cross-floor ghosts (and their Ldesvio connector ramales) belong to the SAME net as their
  // source bajante — clearing that net leaves ghost dashlines pointing at bajantes that no
  // longer exist. Drop them together so no stale ghost outlives its parent.
  engine.crossFloorGhosts = engine.crossFloorGhosts.filter((g) => g.net !== netId);
  if (engine.selectedGhostId) {
    const stillExists = engine.crossFloorGhosts.find((g) => g.id === engine.selectedGhostId);
    if (!stillExists) {
      engine.selectedGhostId = null;
      engine._isGhostSel = false;
      engine._emitSelect(null);
    }
  }
  if (engine.textAnnots) engine.textAnnots.length = 0;
  if (engine.dims) engine.dims.length = 0;
  engine._netCounts[netId] = { ramal: 0, tributario: 0 };
  engine.activeRamal = null;
  if (engine.selId) {
    const stillExists =
      engine.ramales.find((r) => r.id === engine.selId) ||
      engine.bajantes.find((b) => b.id === engine.selId);
    if (!stillExists) {
      engine.selId = null;
      engine._emitSelect(null);
    }
  }
  engine.render();
  engine._markDirty();
}

export function setPadreTributario(engine: IPlanoEngineCore, ramalId: string | null): void {
  if (engine.tipoTramo !== 'tributario') return;
  const padre = engine.ramales.find(
    (r) => r.id === ramalId && r.net === engine.activeNet && r.tipo === 'ramal',
  );
  engine.padreTributario = padre ? padre.id : null;
  engine.render();
}

export function getPadreTributario(engine: IPlanoEngineCore): PlanoRamal | null {
  if (!engine.padreTributario) return null;
  return (engine.ramales.find((r) => r.id === engine.padreTributario) as PlanoRamal) || null;
}

export function getRamalesPadre(engine: IPlanoEngineCore): PlanoRamal[] {
  return engine.ramales.filter(
    (r) => r.net === engine.activeNet && r.tipo === 'ramal',
  ) as unknown as PlanoRamal[];
}

export function setRamalDefaults(
  engine: IPlanoEngineCore,
  d: Partial<{ material: string; diametro: string; pendiente: number }> | null,
): void {
  engine._ramalDefaults = {
    material: d?.material || '',
    diametro: d?.diametro || '',
    pendiente: typeof d?.pendiente === 'number' ? d.pendiente : 0,
  };
}

export function getBajantesFantasma(engine: IPlanoEngineCore): PlanoBajante[] {
  if (!engine.nivelActual) return [];
  return engine.bajantes.filter((b) => {
    if (
      b.tipo === 'contador' ||
      b.tipo === 'calentador' ||
      b.tipo === 'red_publica' ||
      b.tipo === 'canal'
    )
      return false;
    if (b.desplazamientos && b.desplazamientos[engine.nivelActual!.label || '']) return true;
    const base = Math.min(b.nptBase || 0, b.nptCima || 0);
    const cima = Math.max(b.nptBase || 0, b.nptCima || 0);
    const npt = engine.nivelActual!.npt || 0;
    if (npt >= base && npt <= cima) {
      // Don't show direction ghost on the parent's own level
      if (b.pisoBase === engine.nivelActual!.label) return false;
      return true;
    }
    const superior = engine.nptLevels
      .filter((l) => (l.npt || 0) > npt)
      .sort((a, b) => (a.npt || 0) - (b.npt || 0))[0]?.npt;
    return superior !== undefined && (b.nptBase === superior || b.nptCima === superior);
  }) as unknown as PlanoBajante[];
}

import { ACC_ABBR } from '../../utils/accessoryAbbreviations';
import { APARATOS_DEF } from '../../constants/engineeringDataFixtures';

// A codo reventilado junction is a 'vent' ramal endpoint coincident with a 'san' ramal point
// (see renderVentCodos.ts, which uses the same 0.5-unit threshold to draw the symbol there).
// Every other coincident-point drag sync in this engine (handleDragMove.ts) is same-net only,
// so dragging either side of this specific cross-net junction would otherwise tear it apart.
export function findCodoReventiladoLinks(
  engine: IPlanoEngineCore,
  ramal: PlanoRamal,
  ptIdx: number,
): { id: string; ptIdx: number }[] {
  const pt = ramal.pts[ptIdx];
  if (!pt) return [];
  const links: { id: string; ptIdx: number }[] = [];
  const isEndpoint = ptIdx === 0 || ptIdx === ramal.pts.length - 1;

  if (ramal.net === 'vent' && isEndpoint) {
    for (const other of engine.ramales) {
      if (other.net !== 'san' || !other.pts?.length) continue;
      for (let i = 0; i < other.pts.length; i++) {
        if (Math.hypot(other.pts[i][0] - pt[0], other.pts[i][1] - pt[1]) < 0.5) {
          links.push({ id: other.id, ptIdx: i });
        }
      }
    }
  } else if (ramal.net === 'san') {
    for (const other of engine.ramales) {
      if (other.net !== 'vent' || !other.pts?.length) continue;
      [0, other.pts.length - 1].forEach((oi) => {
        if (Math.hypot(other.pts[oi][0] - pt[0], other.pts[oi][1] - pt[1]) < 0.5) {
          links.push({ id: other.id, ptIdx: oi });
        }
      });
    }
  }
  return links;
}

export function autoDetectRamalConnections(engine: IPlanoEngineCore): void {
  const lvlLabel = engine.nivelActual?.label ?? '';
  const ACC_LABELS = ACC_ABBR;

  const findEndpointTarget = (
    r: PlanoRamal,
    pt: number[],
  ): { code: string; isAcc: boolean; ref: PlanoBajante | PlanoRamal | null } | null => {
    const ptDist = (b: { x: number; y: number }) => Math.hypot(pt[0] - b.x, pt[1] - b.y);

    const dispMap = (b: PlanoBajante) => {
      const disp = b.desplazamientos?.[lvlLabel] || {};
      return { x: b.x + (disp.dx || 0), y: b.y + (disp.dy || 0) };
    };

    let bestBaj: PlanoBajante | null = null;
    let bestBajDist = Infinity;
    for (const b of engine.bajantes) {
      if (b.net !== r.net) continue;
      const pos = dispMap(b);
      const d = ptDist(pos);
      if (d < bestBajDist) {
        bestBajDist = d;
        bestBaj = b;
      }
    }
    if (bestBaj && bestBajDist <= 0.5) {
      const code = bestBaj.code || bestBaj.id;
      return { code, isAcc: false, ref: bestBaj };
    }

    let bestRam: PlanoRamal | null = null;
    let bestRamDist = Infinity;
    for (const rr of engine.ramales) {
      if (rr === r) continue;
      if (rr.net !== r.net) continue;
      if (!rr.pts || rr.pts.length < 1) continue;
      for (const pt2 of rr.pts) {
        const d = ptDist({ x: pt2[0], y: pt2[1] });
        if (d < bestRamDist) {
          bestRamDist = d;
          bestRam = rr;
        }
      }
    }
    if (bestRam && bestRamDist <= 0.5) {
      const code = bestRam.label || bestRam.id;
      return { code, isAcc: false, ref: bestRam };
    }

    return null;
  };

  for (const r of engine.ramales) {
    const pts = r.pts || [];
    if (pts.length < 2) continue;

    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];

    const accIni = r.accesorioInicio;
    const appIni = r.aparatoInicio;
    let tStart = null;
    if (appIni) {
      const def = APARATOS_DEF.find((x) => x.id === appIni);
      const name = def ? def.sigla.replace(':', '').trim() : appIni;
      tStart = { code: name.toUpperCase(), isAcc: true, ref: null };
    } else if (accIni) {
      const name = ACC_LABELS[accIni] || accIni;
      tStart = { code: name.toUpperCase(), isAcc: true, ref: null };
    } else {
      tStart = findEndpointTarget(r, pStart);
      // Flow-direction guard: a 'baja' bajante at pts[0] would create the exact invalid state
      // shown in the issue report (RS5-P1 with arrow leaving a BAN4-P1 "Baja"). Drop tStart if
      // the auto-detected target is a 'baja' bajante — same rule the active-create path uses.
      if (tStart && tStart.ref && (tStart.ref as PlanoBajante).direccion === 'baja') {
        tStart = null;
      }
    }

    const accFin = r.accesorioFin;
    const appFin = r.aparatoFin;
    let tEnd = null;
    if (appFin) {
      const def = APARATOS_DEF.find((x) => x.id === appFin);
      const name = def ? def.sigla.replace(':', '').trim() : appFin;
      tEnd = { code: name.toUpperCase(), isAcc: true, ref: null };
    } else if (accFin) {
      const name = ACC_LABELS[accFin] || accFin;
      tEnd = { code: name.toUpperCase(), isAcc: true, ref: null };
    } else {
      tEnd = findEndpointTarget(r, pEnd);
    }

    let newIni = r.ini || '';
    let newFin = r.fin || '';

    if (tStart && tEnd && tStart.ref && tEnd.ref) {
      const refS = tStart.ref;
      const refE = tEnd.ref;
      const isStartCont = refS.tipo === 'contador';
      const isStartMon = refS.tipo === 'montante';
      const isEndCont = refE.tipo === 'contador';
      const isEndMon = refE.tipo === 'montante';

      if ((isStartCont && isEndMon) || (isStartMon && isEndCont)) {
        newIni = isStartCont ? tStart.code : tEnd.code;
        newFin = isStartMon ? tStart.code : tEnd.code;
      } else {
        newIni = tStart.code;
        newFin = tEnd.code;
      }
    } else {
      if (tStart) newIni = tStart.code;
      else newIni = '';
      if (tEnd) newFin = tEnd.code;
      else newFin = '';
    }

    if (r.ini !== newIni || r.fin !== newFin) {
      r.ini = newIni;
      r.fin = newFin;
    }
  }

  // Recalculate bilateral crossings for AF/AC ramales — two-pass: first collect into a map, then
  // assign to BOTH ramales (each ramal must keep its own crossings so collectConnectedGraph can
  // find the perpendicular neighbour during cascade drag). Doing this in one pass with a per-ramal
  // `bilateralCrossings = []` reset wiped out the OTHER ramal's crossings because we were setting
  // them inline — now we collect into a map and assign at the end so each ramal keeps its own.
  const crossingsByRamal = new Map<string, number[][]>();

  for (const r of engine.ramales) {
    if (r.net !== 'af' && r.net !== 'ac') continue;
    if (!r.pts || r.pts.length < 2) continue;
    const crossings: number[][] = [];
    for (let i = 0; i < r.pts.length - 1; i++) {
      const segA = r.pts[i];
      const segB = r.pts[i + 1];
      for (const other of engine.ramales) {
        if (other.id === r.id) continue;
        if (other.net !== r.net) continue;
        if (!other.pts || other.pts.length < 2) continue;
        for (let j = 0; j < other.pts.length - 1; j++) {
          const oA = other.pts[j];
          const oB = other.pts[j + 1];
          const crossPt = segmentStrictIntersectionPoint(segA, segB, oA, oB);
          if (!crossPt) continue;

          // Check perpendicularity: dot product ≈ 0
          const dxA = segB[0] - segA[0],
            dyA = segB[1] - segA[1];
          const dxB = oB[0] - oA[0],
            dyB = oB[1] - oA[1];
          const lenA = Math.hypot(dxA, dyA),
            lenB = Math.hypot(dxB, dyB);
          if (lenA < 0.001 || lenB < 0.001) continue;
          const dot = (dxA * dxB + dyA * dyB) / (lenA * lenB);
          if (Math.abs(dot) < 0.2) {
            const exists = crossings.some(
              (c) => Math.hypot(c[0] - crossPt[0], c[1] - crossPt[1]) < 0.01,
            );
            if (!exists) {
              crossings.push([crossPt[0], crossPt[1]]);
              // Track by PAIR (sorted "idA|idB") rather than by position. Positions change when the
              // ramales move (the original crossing slides to a new spot), but the PAIR stays stable
              // so we don't re-fire the modal after every drag.
              const [idA, idB] = [r.id, other.id].sort();
              const pairKey = `${idA}|${idB}`;
              const seenR = (r as unknown as { _seenBilateral?: string[] })._seenBilateral || [];
              const seenO =
                (other as unknown as { _seenBilateral?: string[] })._seenBilateral || [];
              const alreadySeen = seenR.includes(pairKey) || seenO.includes(pairKey);
              if (!seenR.includes(pairKey)) seenR.push(pairKey);
              if (!seenO.includes(pairKey)) seenO.push(pairKey);
              (r as unknown as { _seenBilateral?: string[] })._seenBilateral = seenR;
              (other as unknown as { _seenBilateral?: string[] })._seenBilateral = seenO;
              // Same pair-key for rejections: the rejection survives a drag too.
              const rejectedR =
                (r as unknown as { _rejectedBilateral?: string[] })._rejectedBilateral || [];
              const rejectedOther =
                (other as unknown as { _rejectedBilateral?: string[] })._rejectedBilateral || [];
              const alreadyRejected =
                rejectedR.includes(pairKey) || rejectedOther.includes(pairKey);
              if (!alreadySeen && !alreadyRejected) {
                // Modal target = the EXISTING ramal. Heuristic: if either side has prior pair-keys
                // (a previously-confirmed crossing), it's the existing one. Otherwise pick the
                // one that isn't the freshly drawn ramal — but we don't track draw time. Default
                // to `other` (the one iterated through in the inner loop).
                const targetId = other.id;
                const targetPoint = [crossPt[0], crossPt[1]];
                if (!engine._pendingBilateral || engine._pendingBilateral.ramalId === targetId) {
                  engine._pendingBilateral = { ramalId: targetId, point: targetPoint };
                }
              }
            }
          }
        }
      }
    }
    if (crossings.length > 0) {
      crossingsByRamal.set(r.id, crossings);
    }
  }

  // Second pass: assign crossings to each ramal (and merge in crossings found from the OTHER side).
  // Each crossing is shared between both ramales — we union both sides' detections.
  for (const r of engine.ramales) {
    if (r.net !== 'af' && r.net !== 'ac') continue;
    const own = crossingsByRamal.get(r.id) || [];
    const merged: number[][] = [...own];
    for (const other of engine.ramales) {
      if (other.id === r.id) continue;
      if (other.net !== r.net) continue;
      const otherCross = crossingsByRamal.get(other.id) || [];
      for (const c of otherCross) {
        if (!merged.some((m) => Math.hypot(m[0] - c[0], m[1] - c[1]) < 0.01)) {
          merged.push([c[0], c[1]]);
        }
      }
    }
    r.bilateralCrossings = merged;
  }
}

/**
 * Auto-create a ramal between the nearest Red Pública and each Contador
 * that doesn't already have a connecting ramal. Runs on load for existing data.
 */
export function recalcBilateralCrossings(engine: IPlanoEngineCore): void {
  const crossingsByRamal = new Map<string, number[][]>();
  const newPairs: [string, string][] = [];

  for (const r of engine.ramales) {
    if (r.net !== 'af' && r.net !== 'ac') continue;
    if (!r.pts || r.pts.length < 2) continue;
    const crossings: number[][] = [];
    for (let i = 0; i < r.pts.length - 1; i++) {
      const segA = r.pts[i];
      const segB = r.pts[i + 1];
      for (const other of engine.ramales) {
        if (other.id === r.id) continue;
        if (other.net !== r.net) continue;
        if (!other.pts || other.pts.length < 2) continue;
        for (let j = 0; j < other.pts.length - 1; j++) {
          const oA = other.pts[j];
          const oB = other.pts[j + 1];
          const crossPt = segmentLooseIntersectionPoint(segA, segB, oA, oB);
          if (!crossPt) continue;
          const dxA = segB[0] - segA[0];
          const dyA = segB[1] - segA[1];
          const dxB = oB[0] - oA[0];
          const dyB = oB[1] - oA[1];
          const lenA = Math.hypot(dxA, dyA);
          const lenB = Math.hypot(dxB, dyB);
          if (lenA < 0.001 || lenB < 0.001) continue;
          const dot = (dxA * dxB + dyA * dyB) / (lenA * lenB);
          if (Math.abs(dot) < 0.2) {
            const exists = crossings.some(
              (c) => Math.hypot(c[0] - crossPt[0], c[1] - crossPt[1]) < 0.01,
            );
            if (!exists) {
              crossings.push([crossPt[0], crossPt[1]]);
              newPairs.push([r.id, other.id]);
            }
          }
        }
      }
    }
    if (crossings.length > 0) {
      crossingsByRamal.set(r.id, crossings);
    }
  }

  for (const r of engine.ramales) {
    if (r.net !== 'af' && r.net !== 'ac') continue;
    const own = crossingsByRamal.get(r.id) || [];
    const merged: number[][] = [...own];
    for (const other of engine.ramales) {
      if (other.id === r.id) continue;
      if (other.net !== r.net) continue;
      const otherCross = crossingsByRamal.get(other.id) || [];
      for (const c of otherCross) {
        if (!merged.some((m) => Math.hypot(m[0] - c[0], m[1] - c[1]) < 0.01)) {
          merged.push([c[0], c[1]]);
        }
      }
    }
    r.bilateralCrossings = merged;
  }

  // Membership is sticky/append-only: once two ramales are ever caught in a strict perpendicular
  // crossing, they stay linked for drag-cascade-limiting purposes even if a later move nudges them
  // just past the strict re-test (see the field comment on bilateralPairIds in PlanoState.ts).
  for (const [aId, bId] of newPairs) {
    const a = engine.ramales.find((x) => x.id === aId);
    const b = engine.ramales.find((x) => x.id === bId);
    if (!a || !b) continue;
    if (!a.bilateralPairIds) a.bilateralPairIds = [];
    if (!a.bilateralPairIds.includes(bId)) a.bilateralPairIds.push(bId);
    if (!b.bilateralPairIds) b.bilateralPairIds = [];
    if (!b.bilateralPairIds.includes(aId)) b.bilateralPairIds.push(aId);
  }
}

export function ensureRpCntRamal(engine: IPlanoEngineCore): void {
  const nets = ['af', 'ac'];
  for (const netId of nets) {
    const contadores = engine.bajantes.filter((b) => b.tipo === 'contador' && b.net === netId);
    for (const cnt of contadores) {
      const rps = engine.bajantes.filter((b) => b.tipo === 'red_publica' && b.net === netId);
      if (rps.length === 0) continue;
      let nearestRP = rps[0];
      let minDist = Infinity;
      for (const rp of rps) {
        const d = Math.hypot(rp.x - cnt.x, rp.y - cnt.y);
        if (d < minDist) {
          minDist = d;
          nearestRP = rp;
        }
      }
      const rpId = nearestRP.code || nearestRP.id;
      const cntId = cnt.code || cnt.id;
      const alreadyConnected = engine.ramales.some(
        (r) =>
          r.net === netId &&
          ((r.ini === rpId && r.fin === cntId) || (r.ini === cntId && r.fin === rpId)),
      );
      if (alreadyConnected) continue;
      const net = NETS.find((n) => n.id === netId);
      const pfx = net ? net.lbl : 'R';
      if (!engine._netCounts[netId]) engine._netCounts[netId] = { ramal: 0, tributario: 0 };
      engine._netCounts[netId].ramal++;
      const ramCnt = engine._netCounts[netId].ramal;
      const ramId = pfx + ramCnt;
      engine.ramales.push({
        id: ramId,
        net: netId,
        _net: netId,
        tipo: 'ramal',
        padre: null,
        pts: [
          [nearestRP.x, nearestRP.y],
          [cnt.x, cnt.y],
        ],
        totalL: +engine.pxToM(Math.hypot(cnt.x - nearestRP.x, cnt.y - nearestRP.y)).toFixed(3),
        label: pfx + ramCnt,
        ini: rpId,
        fin: cntId,
        piso: String(engine.nivelActual?.n ?? ''),
        dz: '',
        uc: 0,
        labelX: (nearestRP.x + cnt.x) / 2,
        labelY: (nearestRP.y + cnt.y) / 2,
        labelAngle: 0,
        material: '',
        diametro: '',
        pendiente: 1.5,
        bloqueado: true,
      });
    }
  }
}
