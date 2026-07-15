import { NETS } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { devError } from '../../../../utils/devError';

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
    } catch (e) { devError('PlanoEngine:', e); }
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
        } catch (e) { devError('PlanoEngine:', e); }
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
    const pfx = netDef?.bmType === 'montante' ? (netDef?.bmPfx || 'MON') : ('M' + (netDef?.lbl || 'MON'));
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
