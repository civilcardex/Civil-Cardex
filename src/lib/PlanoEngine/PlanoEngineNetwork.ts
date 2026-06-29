import { NETS } from './PlanoState';
import type { PlanoRamal, PlanoBajante } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { loadFromStorage, saveToStorage } from '../../services/storageService';

export function getElementsByNet(engine: IPlanoEngineCore, netId: string): Array<{
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
        piso: (r as any).piso || '',
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
        totalL: (b as any).totalL || 0,
        segs: 0,
        piso: (b as any).piso || '',
        tipo: b.tipo || 'bajante',
        pendiente: (b as any).pendiente,
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
  engine.ramales = engine.ramales.filter(r => r.net !== netId);
  engine.bajantes = engine.bajantes.filter(b => b.net !== netId);
  engine.areas = engine.areas.filter(a => a.net !== netId);
  if (engine.textAnnots) engine.textAnnots.length = 0;
  if (engine.dims) engine.dims.length = 0;
  engine._netCounts[netId] = { ramal: 0, tributario: 0 };
  engine.activeRamal = null;
  if (engine.selId) {
    const stillExists = engine.ramales.find((r: any) => r.id === engine.selId)
      || engine.bajantes.find((b: any) => b.id === engine.selId);
    if (!stillExists) { engine.selId = null; engine._emitSelect(null); }
  }
  engine.render();
  engine._markDirty();
}

export function setPadreTributario(engine: IPlanoEngineCore, ramalId: string): void {
  if (engine.tipoTramo !== 'tributario') return;
  const padre = engine.ramales.find(r => r.id === ramalId && r.net === engine.activeNet && r.tipo === 'ramal');
  engine.padreTributario = padre ? padre.id : null;
  engine.render();
}

export function getPadreTributario(engine: IPlanoEngineCore): PlanoRamal | null {
  if (!engine.padreTributario) return null;
  return engine.ramales.find(r => r.id === engine.padreTributario) as PlanoRamal || null;
}

export function getRamalesPadre(engine: IPlanoEngineCore): PlanoRamal[] {
  return engine.ramales.filter(r => r.net === engine.activeNet && r.tipo === 'ramal') as unknown as PlanoRamal[];
}

export function setRamalDefaults(engine: IPlanoEngineCore, d: Partial<{ material: string; diametro: string; pendiente: number }> | null): void {
  engine._ramalDefaults = {
    material: d?.material || '',
    diametro: d?.diametro || '',
    pendiente: typeof d?.pendiente === 'number' ? d.pendiente : 0,
  };
}

export function getBajantesFantasma(engine: IPlanoEngineCore): PlanoBajante[] {
  if (!engine.nivelActual) return [];
  return engine.bajantes.filter(b => {
    if (b.desplazamientos && b.desplazamientos[engine.nivelActual!.label || '']) return true;
    const base = Math.min(b.nptBase || 0, b.nptCima || 0);
    const cima = Math.max(b.nptBase || 0, b.nptCima || 0);
    const npt = engine.nivelActual!.npt || 0;
    if (npt >= base && npt <= cima) {
      // Don't show direction ghost on the parent's own level
      if ((b as any).pisoBase === engine.nivelActual!.label) return false;
      return true;
    }
    const superior = engine.nptLevels
      .filter(l => (l.npt || 0) > npt)
      .sort((a, b) => (a.npt || 0) - (b.npt || 0))[0]?.npt;
    return superior !== undefined && (b.nptBase === superior || b.nptCima === superior);
  }) as unknown as PlanoBajante[];
}

export function _renumberRamales(engine: IPlanoEngineCore, netId: string): void {
  const net = NETS.find(n => n.id === netId);
  if (!net) return;
  const pfx = net.lbl;
  const ramalesNet = engine.ramales.filter(r => r.net === netId && r.tipo !== 'tributario');
  ramalesNet.sort((a, b) => {
    const na = parseInt((a.id || '').replace(pfx, ''), 10) || 0;
    const nb = parseInt((b.id || '').replace(pfx, ''), 10) || 0;
    return na - nb;
  });
  const keepIds = new Set(ramalesNet.map(r => r.id));

  const cleanOrphans = (storageKey: string) => {
    try {
      const data = loadFromStorage(storageKey, {}) as Record<string, unknown>;
      let changed = false;
      for (const k of Object.keys(data)) {
        const segs = k.split('_');
        if (segs.length >= 2 && segs[0] === netId && !keepIds.has(segs[1])) {
          delete data[k];
          changed = true;
        }
      }
      if (changed) saveToStorage(storageKey, data);
    } catch (e) { if (import.meta.env.DEV) console.error('PlanoEngine:', e); }
  };
  cleanOrphans('aparatos_by_tramo_v2');
  cleanOrphans('tramo_hidro_data_v3');

  ramalesNet.forEach((r, i) => {
    const oldId = r.id;
    const newId = pfx + (i + 1);
    if (oldId !== newId) {
      const migrateKeys = (storageKey: string) => {
        try {
          const data = loadFromStorage(storageKey, {}) as Record<string, unknown>;
          let changed = false;
          for (const k of Object.keys(data)) {
            const segs = k.split('_');
            const idx = segs.indexOf(oldId);
            if (idx >= 0) {
              segs[idx] = newId;
              const newK = segs.join('_');
              if (!data[newK]) data[newK] = data[k];
              delete data[k];
              changed = true;
            }
          }
          if (changed) saveToStorage(storageKey, data);
        } catch (e) { if (import.meta.env.DEV) console.error('PlanoEngine:', e); }
      };
      migrateKeys('aparatos_by_tramo_v2');
      migrateKeys('tramo_hidro_data_v3');
    }
    r.id = newId;
    r.label = newId;
    engine.ramales.filter(t => t.padre === oldId).forEach(t => { t.padre = newId; });
  });
  engine._netCounts[netId].ramal = ramalesNet.length;
  try { window.dispatchEvent(new Event('storage')); } catch { /* ignore */ }
}

export function _renumberBajantes(engine: IPlanoEngineCore, netId: string): void {
  const net = NETS.find(n => n.id === netId);
  const pfx = net ? net.bmPfx : 'BAJ';
  const bajantesNet = engine.bajantes.filter(b => b.tipo === 'bajante' && b.net === netId);
  bajantesNet.sort((a, b) => {
    const na = parseInt((a.id || '').replace(pfx, ''), 10) || 0;
    const nb = parseInt((b.id || '').replace(pfx, ''), 10) || 0;
    return na - nb;
  });
  bajantesNet.forEach((b, i) => {
    const newId = pfx + (i + 1);
    b.id = newId;
    b.code = newId;
  });
}

export function _renumberMontantes(engine: IPlanoEngineCore): void {
  const nets = Array.from(new Set(engine.bajantes.filter(b => b.tipo === 'montante').map(b => b.net || 'af')));
  for (const netId of nets) {
    const netDef = NETS.find(n => n.id === netId);
    const pfx = netDef?.bmPfx || 'MON';
    const montantes = engine.bajantes.filter(b => b.tipo === 'montante' && (b.net || 'af') === netId);
    montantes.sort((a, b) => {
      const na = parseInt((a.code || a.id || '').replace(pfx, '').replace('MON', ''), 10) || 0;
      const nb = parseInt((b.code || b.id || '').replace(pfx, '').replace('MON', ''), 10) || 0;
      return na - nb;
    });
    montantes.forEach((b, i) => {
      const idx = i + 1;
      b.id = `${pfx}${idx}_${netId}`;
      b.code = `${pfx}${idx}`;
    });
  }
}

export function _renumberAreas(engine: IPlanoEngineCore): void {
  engine.areas.sort((a, b) => {
    const na = parseInt((a.id || '').replace('AR', ''), 10) || parseInt((a.label || '').replace('AREA', ''), 10) || 0;
    const nb = parseInt((b.id || '').replace('AR', ''), 10) || parseInt((b.label || '').replace('AREA', ''), 10) || 0;
    return na - nb;
  });
  engine.areas.forEach((a, i) => {
    a.label = 'AREA' + (i + 1);
  });
}

export function calcSanitaryAccessories(engine: IPlanoEngineCore): void {
  const planId = engine._loadedPlanId;
  if (!planId) return;

  const sanRamales = engine.ramales.filter(r => r.net === 'san');
  const ventRamales = engine.ramales.filter(r => r.net === 'vent');
  const storageKey = 'tramo_hidro_data_v3';
  let hidroData: Record<string, any>;
  try {
    hidroData = loadFromStorage(storageKey, {}) as Record<string, any>;
  } catch {
    hidroData = {};
  }

  let changed = false;

  // 3. Calculate yee/tee junctions across the san network
  // Uses same logic as renderRamales.ts renderJunctions: checks both shared vertexes
  // and points on segments (projection onto segment)
  const DOUBLE_YEE_MM = 10;
  const junctionRamalIds: string[] = [];
  const junctionPositions: { x: number; y: number }[] = [];
  const junctionBranchCos: number[] = [];

  // Build a unique set of all san ramal vertexes
  const getPointKey = (x: number, y: number) => `${x.toFixed(3)}_${y.toFixed(3)}`;
  const vertexMap = new Map<string, number[]>();
  sanRamales.forEach(r => {
    (r.pts || []).forEach(pt => {
      vertexMap.set(getPointKey(pt[0], pt[1]), pt);
    });
  });

  // For each unique vertex, check all ramals for connection (vertex or segment)
  vertexMap.forEach((P) => {
    const vectors: { x: number; y: number }[] = [];

    sanRamales.forEach(rr => {
      if (!rr.pts) return;
      // Check if P is a vertex in this ramal
      let isVertex = false;
      for (let i = 0; i < rr.pts.length; i++) {
        if (Math.hypot(rr.pts[i][0] - P[0], rr.pts[i][1] - P[1]) < 0.5) {
          isVertex = true;
          if (i > 0) {
            const dx = rr.pts[i - 1][0] - P[0], dy = rr.pts[i - 1][1] - P[1];
            const len = Math.hypot(dx, dy);
            if (len > 0.1) vectors.push({ x: dx / len, y: dy / len });
          }
          if (i < rr.pts.length - 1) {
            const dx = rr.pts[i + 1][0] - P[0], dy = rr.pts[i + 1][1] - P[1];
            const len = Math.hypot(dx, dy);
            if (len > 0.1) vectors.push({ x: dx / len, y: dy / len });
          }
        }
      }
      // If not a vertex, check if P lies on a segment of this ramal
      if (!isVertex) {
        for (let i = 0; i < rr.pts.length - 1; i++) {
          const A = rr.pts[i], B = rr.pts[i + 1];
          const dx = B[0] - A[0], dy = B[1] - A[1];
          const lenSq = dx * dx + dy * dy;
          if (lenSq > 0.001) {
            let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = A[0] + t * dx, projY = A[1] + t * dy;
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

    // Deduplicate
    const uniq: typeof vectors = [];
    vectors.forEach(v => { if (!uniq.some(u => u.x * v.x + u.y * v.y > 0.99)) uniq.push(v); });
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

    if (isYee) {
      // Find the main ramal that passes through this vertex
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
        // Also check if this ramal's segment passes through P
        for (let k = 0; k < rr.pts.length - 1; k++) {
          const A = rr.pts[k], B = rr.pts[k + 1];
          const sdx = B[0] - A[0], sdy = B[1] - A[1];
          const sLenSq = sdx * sdx + sdy * sdy;
          if (sLenSq > 0.001) {
            let t = ((P[0] - A[0]) * sdx + (P[1] - A[1]) * sdy) / sLenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = A[0] + t * sdx, projY = A[1] + t * sdy;
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
  });

  // Count yeeSimple and yeeDoble
  const yeeCounts: Record<string, { simple: number; doble: number }> = {};
  const usedInDouble = new Set<number>();

  for (let i = 0; i < junctionPositions.length; i++) {
    for (let j = i + 1; j < junctionPositions.length; j++) {
      if (usedInDouble.has(i) || usedInDouble.has(j)) continue;
      const dist = Math.hypot(junctionPositions[j].x - junctionPositions[i].x, junctionPositions[j].y - junctionPositions[i].y);
      if (dist > DOUBLE_YEE_MM) continue;
      // Aligned check
      const dx = junctionPositions[j].x - junctionPositions[i].x;
      const dy = junctionPositions[j].y - junctionPositions[i].y;
      const len = Math.hypot(dx, dy);
      if (len > 0.1) {
        const sepDot = Math.abs(dx / len * (junctionPositions[i].x / Math.hypot(junctionPositions[i].x, junctionPositions[i].y || 1)) + dy / len * (junctionPositions[i].y / Math.hypot(junctionPositions[i].x, junctionPositions[i].y || 1)));
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

  for (const r of sanRamales) {
    let count45 = 0;
    let countVent = 0;

    // 1. Calculate 45-degree elbows
    if (r.pts && r.pts.length >= 3) {
      for (let i = 1; i < r.pts.length - 1; i++) {
        const p0 = r.pts[i - 1], p1 = r.pts[i], p2 = r.pts[i + 1];
        const ax = p1[0] - p0[0], ay = p1[1] - p0[1];
        const bx = p2[0] - p1[0], by = p2[1] - p1[1];
        const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
        if (lenA > 0 && lenB > 0) {
          const ux = -ax / lenA, uy = -ay / lenA; // B -> A
          const vx = bx / lenB, vy = by / lenB;   // B -> C
          const cosAngle = ux * vx + uy * vy;
          if (Math.abs(cosAngle + Math.cos(Math.PI / 4)) < 0.05) {
            count45++;
          }
        }
      }
    }

    // 2. Calculate vented elbows (codo reventilado)
    if (r.pts && r.pts.length >= 2) {
      for (const v of ventRamales) {
        if (!v.pts || v.pts.length < 2) continue;
        const end1 = v.pts[0];
        const end2 = v.pts[v.pts.length - 1];
        let connected = false;

        for (let i = 0; i < r.pts.length - 1; i++) {
          const [ax, ay] = r.pts[i];
          const [bx, by] = r.pts[i+1];
          const sDx = bx - ax, sDy = by - ay;
          const sLenSq = sDx * sDx + sDy * sDy;
          if (sLenSq < 0.0001) continue;

          for (const end of [end1, end2]) {
            let t = ((end[0] - ax) * sDx + (end[1] - ay) * sDy) / sLenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = ax + t * sDx, projY = ay + t * sDy;
            if (Math.hypot(end[0] - projX, end[1] - projY) < 0.5) {
              connected = true;
              break;
            }
          }
          if (connected) break;
        }

        if (connected) {
          countVent++;
        }
      }
    }

    // 4. Calculate codos from bajante connections (codo90rmSube / codo90rmBaja)
    let countSube = 0;
    let countBaja = 0;
    for (const baj of (engine.bajantes || [])) {
      if (baj.net !== 'san') continue;
      if (baj.recibeDeIds?.includes(r.id)) {
        if (baj.direccion === 'sube') {
          countSube++;
        } else if (baj.direccion === 'baja' || baj.direccion === undefined || baj.direccion === 'continua') {
          countBaja++;
        }
      }
    }

    const rKey = `san_${r.id}_${planId}`;
    if (!hidroData[rKey]) hidroData[rKey] = { accesorios: {}, Lh: 0, nSalidas: 0 };
    if (!hidroData[rKey].accesorios) hidroData[rKey].accesorios = {};

    const acc = hidroData[rKey].accesorios;
    
    // Only update if changed
    if (acc['codo45rc'] !== count45 || acc['codoReventilado'] !== countVent ||
        acc['codo90rmSube'] !== countSube || acc['codo90rmBaja'] !== countBaja) {
      if (count45 > 0) acc['codo45rc'] = count45; else delete acc['codo45rc'];
      if (countVent > 0) acc['codoReventilado'] = countVent; else delete acc['codoReventilado'];
      if (countSube > 0) acc['codo90rmSube'] = countSube; else delete acc['codo90rmSube'];
      if (countBaja > 0) acc['codo90rmBaja'] = countBaja; else delete acc['codo90rmBaja'];
      changed = true;
    }

    // Store yee counts
    const yee = yeeCounts[String(r.id)];
    if (yee) {
      if (acc['yeeSimple'] !== yee.simple) { acc['yeeSimple'] = yee.simple; changed = true; }
      if (acc['yeeDoble'] !== yee.doble) { acc['yeeDoble'] = yee.doble; changed = true; }
    } else {
      if ('yeeSimple' in acc) { delete acc['yeeSimple']; changed = true; }
      if ('yeeDoble' in acc) { delete acc['yeeDoble']; changed = true; }
    }
  }

  if (changed) {
    saveToStorage(storageKey, hidroData);
    try { window.dispatchEvent(new Event('storage')); } catch { /* ignore */ }
  }
}

export function autoDetectRamalConnections(engine: IPlanoEngineCore): void {
  const lvlLabel = engine.nivelActual?.label ?? '';
  for (const r of engine.ramales) {
    if (r.net !== 'af' && r.net !== 'ac') continue;
    const pts = r.pts || [];
    if (pts.length < 2) continue;
    
    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];
    
    const findConnectedBajante = (pt: number[]) => {
      for (const b of engine.bajantes) {
        if (b.net !== r.net) continue;
        const disp = b.desplazamientos?.[lvlLabel] || {};
        const bx = b.x + (disp.dx || 0);
        const by = b.y + (disp.dy || 0);
        const isExplicit = b.recibeDeIds && (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
        const dist = Math.hypot(pt[0] - bx, pt[1] - by);
        if (isExplicit) {
          const otherPt = pt === pStart ? pEnd : pStart;
          const otherDist = Math.hypot(otherPt[0] - bx, otherPt[1] - by);
          if (dist < otherDist) return b;
        } else if (dist < 2.0) {
          return b;
        }
      }
      return null;
    };
    
    const bStart = findConnectedBajante(pStart);
    const bEnd = findConnectedBajante(pEnd);
    
    let newIni = r.ini || '';
    let newFin = r.fin || '';

    if (bStart && bEnd) {
      const isStartCont = bStart.tipo === 'contador';
      const isStartMon = bStart.tipo === 'montante';
      const isEndCont = bEnd.tipo === 'contador';
      const isEndMon = bEnd.tipo === 'montante';
      
      if ((isStartCont && isEndMon) || (isStartMon && isEndCont)) {
        const cont = isStartCont ? bStart : bEnd;
        const mon = isStartMon ? bStart : bEnd;
        newIni = cont.code || cont.id;
        newFin = mon.code || mon.id;
      } else {
        newIni = bStart.code || bStart.id;
        newFin = bEnd.code || bEnd.id;
      }
    } else {
      if (bStart) {
        newIni = bStart.code || bStart.id;
      }
      if (bEnd) {
        newFin = bEnd.code || bEnd.id;
      }
    }

    if (r.ini !== newIni || r.fin !== newFin) {
      r.ini = newIni;
      r.fin = newFin;
    }
  }
}

/**
 * Auto-create a ramal between the nearest Red Pública and each Contador
 * that doesn't already have a connecting ramal. Runs on load for existing data.
 */
export function ensureRpCntRamal(engine: IPlanoEngineCore): void {
  const nets = ['af', 'ac'];
  for (const netId of nets) {
    const contadores = engine.bajantes.filter(b => b.tipo === 'contador' && b.net === netId);
    for (const cnt of contadores) {
      const rps = engine.bajantes.filter(b => b.tipo === 'red_publica' && b.net === netId);
      if (rps.length === 0) continue;
      let nearestRP = rps[0];
      let minDist = Infinity;
      for (const rp of rps) {
        const d = Math.hypot(rp.x - cnt.x, rp.y - cnt.y);
        if (d < minDist) { minDist = d; nearestRP = rp; }
      }
      const rpId = nearestRP.code || nearestRP.id;
      const cntId = cnt.code || cnt.id;
      const alreadyConnected = engine.ramales.some((r: any) =>
        r.net === netId && ((r.ini === rpId && r.fin === cntId) || (r.ini === cntId && r.fin === rpId))
      );
      if (alreadyConnected) continue;
      const net = NETS.find(n => n.id === netId);
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
        pts: [[nearestRP.x, nearestRP.y], [cnt.x, cnt.y]],
        totalL: +(engine.pxToM(Math.hypot(cnt.x - nearestRP.x, cnt.y - nearestRP.y))).toFixed(3),
        label: pfx + ramCnt,
        ini: rpId,
        fin: cntId,
        piso: engine.nivelActual?.n ?? '',
        dz: '',
        uc: 0,
        labelX: (nearestRP.x + cnt.x) / 2,
        labelY: (nearestRP.y + cnt.y) / 2,
        labelAngle: 0,
        material: '',
        diametro: '',
        pendiente: 1.5,
      });
    }
  }
}
