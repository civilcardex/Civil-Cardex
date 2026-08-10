import { NETS } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { devError } from '../../../../utils/devError';
import {
  ldesvioIdFor,
  isLdesvioRamalId,
  renameBajanteAcrossFloorReferences,
} from '../../utils/associateBajanteAcrossFloors';

export function _renumberRamales(engine: IPlanoEngineCore, netId: string): void {
  const net = NETS.find((n) => n.id === netId);
  if (!net) return;
  const pfx = net.lbl;
  const ramalesNet = engine.ramales.filter(
    (r) => r.net === netId && r.tipo !== 'tributario' && !isLdesvioRamalId(r.id),
  );
  ramalesNet.sort((a, b) => {
    const na = parseInt((a.id || '').replace(pfx, ''), 10) || 0;
    const nb = parseInt((b.id || '').replace(pfx, ''), 10) || 0;
    return na - nb;
  });
  // Los Ldesvio conservan su label como un ramal manual más: sus números quedan ocupados y la
  // renumeración de los ramales reales salta esos huecos (nunca se les roba el número).
  const ldesvioTaken = new Set<number>();
  for (const r of engine.ramales) {
    if (r.net !== netId || r.tipo === 'tributario') continue;
    if (!isLdesvioRamalId(r.id)) continue;
    const m = (r.label || r.id)?.match(new RegExp('^' + pfx + '(\\d+)$'));
    if (!m) continue;
    ldesvioTaken.add(parseInt(m[1], 10));
  }
  const used = new Set<number>(ldesvioTaken);
  const keepIds = new Set(ramalesNet.map((r) => r.id));

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
    } catch (e) {
      devError('PlanoEngine:', e);
    }
  };
  cleanOrphans('aparatos_by_tramo_v2');
  cleanOrphans('tramo_hidro_data_v3');

  ramalesNet.forEach((r) => {
    let n = 1;
    while (used.has(n)) n++;
    used.add(n);
    const oldId = r.id;
    const newId = pfx + n;
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
        } catch (e) {
          devError('PlanoEngine:', e);
        }
      };
      migrateKeys('aparatos_by_tramo_v2');
      migrateKeys('tramo_hidro_data_v3');
    }
    r.id = newId;
    r.label = newId;
    engine.ramales
      .filter((t) => t.padre === oldId)
      .forEach((t) => {
        t.padre = newId;
      });
  });
  let maxN = 0;
  for (const n of used) if (n > maxN) maxN = n;
  engine._netCounts[netId].ramal = maxN;
  try {
    window.dispatchEvent(new Event('storage'));
  } catch {
    /* ignore */
  }
}

export function _renumberBajantes(engine: IPlanoEngineCore, netId: string): void {
  const net = NETS.find((n) => n.id === netId);
  const pfx = net ? net.bmPfx : 'BAJ';
  const bajantesNet = engine.bajantes.filter((b) => b.tipo === 'bajante' && b.net === netId);
  bajantesNet.sort((a, b) => {
    const na = parseInt((a.id || '').replace(pfx, ''), 10) || 0;
    const nb = parseInt((b.id || '').replace(pfx, ''), 10) || 0;
    return na - nb;
  });
  const thisPlanId = String(engine._loadedPlanId ?? '');
  bajantesNet.forEach((b, i) => {
    const oldId = b.id;
    const newId = pfx + (i + 1);
    if (oldId === newId) return;
    b.id = newId;
    b.code = newId;

    // Al renumerar un bajante cambia su id, y TODAS las referencias a ese id (el ramal Ldesvio,
    // el fantasma del otro piso, los punteros descargaEnId/origenId) se buscan por el id viejo.
    // Si no se actualizan todas juntas, la asociación entre pisos queda huérfana para siempre:
    // cada búsqueda posterior usa el id NUEVO y nunca encuentra las referencias viejas.
    const oldLd = ldesvioIdFor(oldId);
    const newLd = ldesvioIdFor(newId);
    const oldPointer = `${thisPlanId}|${oldId}`;
    const newPointer = `${thisPlanId}|${newId}`;
    for (const r of engine.ramales) {
      if (r.net !== netId) continue;
      if (r.id === oldLd) r.id = newLd;
      if (r.ini === oldId) r.ini = newId;
      if (r.fin === oldId) r.fin = newId;
    }
    for (const other of engine.bajantes) {
      if (other.descargaEnId === oldPointer) other.descargaEnId = newPointer;
      if (other.origenId === oldPointer) other.origenId = newPointer;
    }
    if (b.desplazamientos) {
      for (const lvlKey of Object.keys(b.desplazamientos)) {
        if (b.desplazamientos[lvlKey]?.Ldesvio === oldLd) {
          b.desplazamientos[lvlKey] = { ...b.desplazamientos[lvlKey], Ldesvio: newLd };
        }
      }
    }
    for (const g of engine.crossFloorGhosts) {
      if (g.sourcePlanId === thisPlanId && g.sourceBajanteId === oldId) {
        g.sourceBajanteId = newId;
        g.id = `XFG_${newId}_${thisPlanId}`;
      }
      if (g.targetBajanteId === oldId) g.targetBajanteId = newId;
    }
    // También hay que actualizar el storage de los OTROS pisos (no están cargados en memoria,
    // así que los parches de arriba no los alcanzan) — se hace piso por piso leyendo y
    // reescribiendo sus datos guardados.
    renameBajanteAcrossFloorReferences(thisPlanId, oldId, newId);
  });
}

export function _renumberMontantes(engine: IPlanoEngineCore): void {
  const nets = Array.from(
    new Set(engine.bajantes.filter((b) => b.tipo === 'montante').map((b) => b.net || 'af')),
  );
  for (const netId of nets) {
    const netDef = NETS.find((n) => n.id === netId);
    const pfx =
      netDef?.bmType === 'montante' ? netDef?.bmPfx || 'MON' : 'M' + (netDef?.lbl || 'MON');
    const montantes = engine.bajantes.filter(
      (b) => b.tipo === 'montante' && (b.net || 'af') === netId,
    );
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
    const na =
      parseInt((a.id || '').replace('AR', ''), 10) ||
      parseInt((a.label || '').replace('AREA', ''), 10) ||
      0;
    const nb =
      parseInt((b.id || '').replace('AR', ''), 10) ||
      parseInt((b.label || '').replace('AREA', ''), 10) ||
      0;
    return na - nb;
  });
  engine.areas.forEach((a, i) => {
    a.label = 'AREA' + (i + 1);
  });
}
