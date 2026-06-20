import { NETS } from './PlanoState';
import type { PlanoRamal, PlanoBajante } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoEngineTypes';
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
    if (b.desplazamientos && b.desplazamientos[engine.nivelActual!.label]) return true;
    const base = Math.min(b.nptBase || 0, b.nptCima || 0);
    const cima = Math.max(b.nptBase || 0, b.nptCima || 0);
    const npt = engine.nivelActual!.npt || 0;
    if (npt >= base && npt <= cima) {
      // Don't show direction ghost on the parent's own level
      if ((b as any).pisoBase === engine.nivelActual.label) return false;
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
  try { window.dispatchEvent(new Event('storage')); } catch (_) {}
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
  const montantes = engine.bajantes.filter(b => b.tipo === 'montante');
  montantes.sort((a, b) => {
    const na = parseInt((a.id || '').replace('MON', ''), 10) || 0;
    const nb = parseInt((b.id || '').replace('MON', ''), 10) || 0;
    return na - nb;
  });
  montantes.forEach((b, i) => {
    const newId = 'MON' + (i + 1);
    b.id = newId;
    b.code = newId;
  });
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
