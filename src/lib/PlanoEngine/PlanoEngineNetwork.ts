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
        bloqueado: true,
      });
    }
  }
}
