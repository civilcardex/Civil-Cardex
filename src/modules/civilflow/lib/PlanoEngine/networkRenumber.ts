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
        // Solo limpiar huérfanos de ramales de esta red (prefijo pfx, ej. RS, RALL).
        // No borrar tributarios (T...), Ldesvio (LD_...), ni bajantes (BAN...), que tienen otro prefijo.
        if (
          segs.length >= 2 &&
          segs[0] === netId &&
          segs[1].startsWith(pfx) &&
          !keepIds.has(segs[1])
        ) {
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
            let newK: string | null = null;
            let isTributarySuffix = false;
            const idx = segs.indexOf(oldId);
            if (idx >= 0) {
              segs[idx] = newId;
              newK = segs.join('_');
            } else if (segs.length >= 2 && segs[1].startsWith('T') && segs[1].endsWith(oldId)) {
              // Tributario: T{n}{oldId} -> T{n}{newId}
              const m = segs[1].match(/^T(\d+)(.+)$/);
              if (m && m[2] === oldId) {
                segs[1] = `T${m[1]}${newId}`;
                newK = segs.join('_');
                isTributarySuffix = true;
              }
            }
            if (newK) {
              // Si la clave destino ya existe (colisión), FUSIONAR sumando conteos
              if (
                data[newK] &&
                data[k] &&
                typeof data[newK] === 'object' &&
                typeof data[k] === 'object'
              ) {
                const target = data[newK] as Record<string, unknown>;
                const source = data[k] as Record<string, unknown>;
                const merged: Record<string, unknown> = { ...target };
                for (const [sk, sv] of Object.entries(source)) {
                  if (
                    sk === 'accesorios' &&
                    typeof sv === 'object' &&
                    sv !== null &&
                    typeof merged[sk] === 'object' &&
                    merged[sk] !== null
                  ) {
                    const accTarget = merged[sk] as Record<string, number>;
                    const accSource = sv as Record<string, number>;
                    const accMerged: Record<string, number> = { ...accTarget };
                    for (const [ak, av] of Object.entries(accSource))
                      accMerged[ak] = (accMerged[ak] || 0) + ((av as number) || 0);
                    merged[sk] = accMerged;
                  } else if (typeof sv === 'number' && typeof merged[sk] === 'number') {
                    merged[sk] = (merged[sk] as number) + (sv as number);
                  } else if (merged[sk] === undefined) {
                    merged[sk] = sv;
                  } else if (
                    typeof sv === 'object' &&
                    sv !== null &&
                    typeof merged[sk] === 'object' &&
                    merged[sk] !== null
                  ) {
                    merged[sk] = { ...(merged[sk] as object), ...(sv as object) };
                  } else {
                    if (typeof sv === 'number' && typeof merged[sk] === 'number')
                      merged[sk] = (merged[sk] as number) + (sv as number);
                    else merged[sk] = sv;
                  }
                }
                data[newK] = merged;
              } else if (!data[newK]) {
                data[newK] = data[k];
              } else if (isTributarySuffix) {
                // Colisión de tributario: fusionar como arriba (ya manejado), si no hay colisión ya se copió
                // Si existe colisión y no es objeto (raro), sumar si son números
                if (typeof data[newK] === 'number' && typeof data[k] === 'number') {
                  (data[newK] as number) = (data[newK] as number) + (data[k] as number);
                }
              }
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
      // También migrar GAS y otros hidro que usan id directo
      migrateKeys('gas_accesorios');
    }
    r.id = newId;
    r.label = newId;
    // Actualizar padre y label de tributarios que apuntaban al viejo id
    engine.ramales
      .filter((t) => t.padre === oldId)
      .forEach((t) => {
        t.padre = newId;
        // Label T{n}{oldId} -> T{n}{newId}
        const m = t.label.match(/^T(\d+)(.+)$/);
        if (m && m[2] === oldId) {
          t.label = `T${m[1]}${newId}`;
        } else if (t.label.endsWith(oldId)) {
          t.label = t.label.slice(0, -oldId.length) + newId;
        }
      });
    // Tributarios cuyo label es T{n}{oldId} aunque su padre ya no sea oldId (por split), también deben renombrarse
    engine.ramales
      .filter((t) => t.tipo === 'tributario' && t.label.endsWith(oldId) && t.padre !== newId)
      .forEach((t) => {
        const m = t.label.match(/^T(\d+)(.+)$/);
        if (m && m[2] === oldId) {
          // Solo si el sufijo es exactamente oldId y el prefijo es T{n}
          // Verificar que el ramal padre actual tenga como raíz el oldId (vía rootTributarioLabel)
          // Para no renombrar tributarios de otros troncos que casualmente terminan igual
          const curPadreLabel = t.padre
            ? engine.ramales.find((rr) => rr.id === t.padre)?.label || ''
            : '';
          if (curPadreLabel === oldId || curPadreLabel.endsWith(oldId)) {
            t.label = `T${m[1]}${newId}`;
          }
        }
      });
    // Ítem 9/bug 1: un ramal renombrado puede ser parte de una DIVISIÓN (mergesFrom) — el
    // downstream de un split guarda [idUpstream, idDivisor]. Si se renombra cualquiera de ellos
    // sin migrar la referencia, el remerge posterior al borrar el divisor no encuentra el par
    // y el trazo queda partido en dos objetos (el bug reportado: "se borra solo uno de los
    // segmentos"). Se migran los mergesFrom de TODOS los ramales que apunten al id viejo.
    if (oldId !== newId) {
      for (const m of engine.ramales) {
        if (!m.mergesFrom) continue;
        m.mergesFrom = [
          m.mergesFrom[0] === oldId ? newId : m.mergesFrom[0],
          m.mergesFrom[1] === oldId ? newId : m.mergesFrom[1],
        ];
      }
    }
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
