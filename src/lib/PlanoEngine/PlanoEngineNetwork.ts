import { NETS } from './PlanoState';
import type { PlanoRamal, PlanoBajante } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';

export { _renumberRamales, _renumberBajantes, _renumberMontantes, _renumberAreas } from './networkRenumber';
export { calcSanitaryAccessories } from './networkSanitary';

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
    const stillExists = engine.ramales.find((r) => r.id === engine.selId)
      || engine.bajantes.find((b) => b.id === engine.selId);
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
    if (b.tipo === 'contador' || b.tipo === 'calentador' || b.tipo === 'red_publica') return false;
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


import { ACC_ABBR } from "../../utils/accessoryAbbreviations";

export function autoDetectRamalConnections(engine: IPlanoEngineCore): void {
  const lvlLabel = engine.nivelActual?.label ?? '';
  const ACC_LABELS = ACC_ABBR;

  const findEndpointTarget = (r: PlanoRamal, pt: number[]): { code: string; isAcc: boolean; ref: PlanoBajante | PlanoRamal | null } | null => {
    const ptDist = (b: { x: number; y: number }) => Math.hypot(pt[0] - b.x, pt[1] - b.y);

    const dispMap = (b: any) => {
      const disp = b.desplazamientos?.[lvlLabel] || {};
      return { x: b.x + (disp.dx || 0), y: b.y + (disp.dy || 0) };
    };

    let bestBaj: PlanoBajante | null = null;
    let bestBajDist = Infinity;
    for (const b of engine.bajantes) {
      if (b.net !== r.net) continue;
      const pos = dispMap(b);
      const d = ptDist(pos);
      if (d < bestBajDist) { bestBajDist = d; bestBaj = b; }
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
        if (d < bestRamDist) { bestRamDist = d; bestRam = rr; }
      }
    }
    if (bestRam && bestRamDist <= 0.5) {
      const code = bestRam.label || bestRam.id;
      return { code: `${code}-CI`, isAcc: false, ref: bestRam };
    }

    return null;
  };

  for (const r of engine.ramales) {
    const pts = r.pts || [];
    if (pts.length < 2) continue;

    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];

    const accIni = (r as any).accesorioInicio;
    const accFin = (r as any).accesorioFin;
    const tStart = accIni ? { code: ACC_LABELS[accIni] || accIni, isAcc: true, ref: null } : findEndpointTarget(r, pStart);
    const tEnd = accFin ? { code: ACC_LABELS[accFin] || accFin, isAcc: true, ref: null } : findEndpointTarget(r, pEnd);

    let newIni = r.ini || '';
    let newFin = r.fin || '';

    if (tStart && tEnd && tStart.ref && tEnd.ref) {
      const refS = tStart.ref as any;
      const refE = tEnd.ref as any;
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
      if (tEnd) newFin = tEnd.code;
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
      const alreadyConnected = engine.ramales.some((r) =>
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
        bloqueado: true,
      });
    }
  }
}
