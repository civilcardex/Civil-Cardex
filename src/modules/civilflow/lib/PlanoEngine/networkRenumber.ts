import { NETS } from './PlanoState.ts';
import type { IPlanoEngineCore } from './PlanoState.ts';
import { loadFromStorage, saveToStorage } from '../../services/storageService.ts';
import {
  APARATOS_BY_TRAMO_KEY,
  APARATOS_HEREDADOS_KEY,
  APARATOS_HEREDADOS_TRIB_KEY,
  APARATOS_RESIDUO_BAK_KEY,
  BAJADAS_RECEPTORAS_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../../constants/storage-keys.ts';
import { devError } from '../../../../utils/devError.ts';
import { mezclarMax } from '../../utils/propagation/counting.ts';
import {
  ldesvioIdFor,
  isLdesvioRamalId,
  renameBajanteAcrossFloorReferences,
} from '../../utils/associateBajanteAcrossFloors';

import {
  keyPlanSuffixOf,
  isPlanKeyFor,
  renombrarIdEnClave,
  numDeBajante,
} from '../../utils/keys.ts';
import { EV_STORAGE } from '../../utils/fixtureEvents.ts';
export { keyPlanSuffixOf, isPlanKeyFor };

/** Renumera los ramales y tributarios de una red para que no queden huecos (RAF1, RAF3, RAF4 →
 *  RAF1, RAF2, RAF3) y arrastra las claves de unidades de consumo (UD) de cada uno, para que los
 *  conteos no se queden en el id viejo.
 *  Ej: tras borrar RAF2, el RAF3 pasa a llamarse RAF2 sin perder sus aparatos. */
export function _renumberRamales(engine: IPlanoEngineCore, netId: string): void {
  const net = NETS.find((n) => n.id === netId);
  if (!net) return;
  const pfx = net.lbl;
  const ownPlan = engine._loadedPlanId ?? null;
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
        // Solo claves del piso cargado: las de otros pisos no se tocan aunque el id no
        // exista aquí (cada piso numera RS1..RSn por su cuenta).
        if (!isPlanKeyFor(k, ownPlan)) continue;
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
  // Los libros de la propagación viajan con el disco: sin esto, renumerar dejaba sus
  // claves huérfanas y lo propagado se volvía "manual" (fase A sin memoria) — la Σ
  // explotaba (orig. usuario: ducha/tina ×4 con filas en 1).
  cleanOrphans(APARATOS_HEREDADOS_KEY);
  cleanOrphans(APARATOS_HEREDADOS_TRIB_KEY);
  cleanOrphans(APARATOS_RESIDUO_BAK_KEY);
  // Libro de bajadas receptoras: mismas claves `${net}_${id}_${pid}` (valores numéricos) —
  // sin esto la marca de bajada quedaba huérfana tras el renumerado y la poda la tiraba.
  cleanOrphans(BAJADAS_RECEPTORAS_KEY);

  // Los blobs se leen UNA vez por renumerado: antes, `migrateKeys` hacía load+save por
  // CADA ramal (5 blobs × N ramales = 200 JSON.parse del blob COMPLETO en un solo clic;
  // con 50 KB por blob eran ~10 MB de parseo). Ahora se mutan en memoria y se graban
  // una vez al final.
  const STORES_A_MIGRAR = [
    'aparatos_by_tramo_v2',
    'tramo_hidro_data_v3',
    'gas_accesorios',
    APARATOS_HEREDADOS_KEY,
    APARATOS_HEREDADOS_TRIB_KEY,
  ];
  const storeCache = new Map<string, Record<string, unknown>>();
  const storeDirty = new Set<string>();
  for (const sk of STORES_A_MIGRAR) {
    try {
      storeCache.set(sk, loadFromStorage(sk, {}) as Record<string, unknown>);
    } catch {
      storeCache.set(sk, {});
    }
  }

  ramalesNet.forEach((r) => {
    let n = 1;
    while (used.has(n)) n++;
    used.add(n);
    const oldId = r.id;
    const newId = pfx + n;
    if (oldId !== newId) {
      const migrateKeys = (storageKey: string) => {
        try {
          const data = storeCache.get(storageKey);
          if (!data) return;
          let changed = false;
          for (const k of Object.keys(data)) {
            // Solo claves del piso cargado: renombrar RS4→RS1 aquí no debe mover ni fusionar
            // `san_RS4_<otroPlano>` ni `san_T1RS4_<otroPlano>` (los labels de tributario se
            // repiten por piso).
            if (!isPlanKeyFor(k, ownPlan)) continue;
            const newK = renombrarIdEnClave(k, oldId, newId);
            const isTributarySuffix = newK != null && !k.split('_').includes(oldId);
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
          if (changed) storeDirty.add(storageKey);
        } catch (e) {
          devError('PlanoEngine:', e);
        }
      };
      migrateKeys('aparatos_by_tramo_v2');
      migrateKeys('tramo_hidro_data_v3');
      // También migrar GAS y otros hidro que usan id directo
      migrateKeys('gas_accesorios');
      // Libros de propagación (misma fusión por suma que el resto del bloque).
      migrateKeys(APARATOS_HEREDADOS_KEY);
      migrateKeys(APARATOS_HEREDADOS_TRIB_KEY);
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
  // Un solo guardado por blob (antes: uno por ramal).
  for (const sk of storeDirty) {
    const data = storeCache.get(sk);
    if (data) saveToStorage(sk, data);
  }
  let maxN = 0;
  for (const n of used) if (n > maxN) maxN = n;
  engine._netCounts[netId].ramal = maxN;
  try {
    window.dispatchEvent(new Event(EV_STORAGE));
  } catch {
    /* ignore */
  }
}

/** Renumera los bajantes de una red sin huecos (BAN1, BAN3 → BAN1, BAN2) y actualiza las
 *  referencias que apuntan a ellos, incluidas las de otros pisos y las del menú de asociación.
 *  Ej: al borrar un bajante, los siguientes suben un número y siguen enlazados. */
export function _renumberBajantes(engine: IPlanoEngineCore, netId: string): void {
  const net = NETS.find((n) => n.id === netId);
  const pfx = net ? net.bmPfx : 'BAJ';
  const bajantesNet = engine.bajantes.filter((b) => b.tipo === 'bajante' && b.net === netId);
  bajantesNet.sort((a, b) => {
    const na = numDeBajante(a.id, pfx);
    const nb = numDeBajante(b.id, pfx);
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

/** Renumera los montantes de todas las redes (AF/AC), cada una por separado con su propio
 *  consecutivo, y MUEVE todo lo que cuelga del id: extremos de ramal (ini/fin por código),
 *  punteros entre pisos (origenId/descargaEnId `plan|id`), ramal LDesvio, anillos, fantasmas
 *  XFG (motor + pisos vecinos vía renameBajanteAcrossFloorReferences) y las claves de UDs
 *  del piso cargado. Ej: dos montantes MAC1 y MAC3 pasan a MAC1 y MAC2 sin perder ni una
 *  referencia (antes el renombre dejaba punteros y aparatos huérfanos — orig. usuario). */
export function _renumberMontantes(engine: IPlanoEngineCore): void {
  const nets = Array.from(
    new Set(engine.bajantes.filter((b) => b.tipo === 'montante').map((b) => b.net || 'af')),
  );
  const thisPlanId = String(engine._loadedPlanId ?? '');
  for (const netId of nets) {
    const netDef = NETS.find((n) => n.id === netId);
    const pfx =
      netDef?.bmType === 'montante' ? netDef?.bmPfx || 'MON' : 'M' + (netDef?.lbl || 'MON');
    const montantes = engine.bajantes.filter(
      (b) => b.tipo === 'montante' && (b.net || 'af') === netId,
    );
    montantes.sort((a, b) => {
      const na = numDeBajante(a.code || a.id, pfx);
      const nb = numDeBajante(b.code || b.id, pfx);
      return na - nb;
    });
    montantes.forEach((b, i) => {
      const oldId = b.id;
      const newId = `${pfx}${i + 1}_${netId}`;
      const oldCode = b.code || '';
      const newCode = `${pfx}${i + 1}`;
      if (oldId === newId && oldCode === newCode) return;
      b.id = newId;
      b.code = newCode;
      const oldLd = ldesvioIdFor(oldId);
      const newLd = ldesvioIdFor(newId);
      // Motor: extremos de ramal (la creación escribe el CÓDIGO en ini/fin; también por id
      // por si el doc viene de una era sin sufijo de red) y punteros de asociación.
      for (const r of engine.ramales) {
        if (r.net !== netId) continue;
        if (r.id === oldLd) r.id = newLd;
        if (oldCode && r.ini === oldCode) r.ini = newCode;
        if (oldCode && r.fin === oldCode) r.fin = newCode;
        if (r.ini === oldId) r.ini = newId;
        if (r.fin === oldId) r.fin = newId;
      }
      const ptrViejo = `${thisPlanId}|${oldId}`;
      const ptrNuevo = `${thisPlanId}|${newId}`;
      for (const other of engine.bajantes) {
        if (other.descargaEnId === ptrViejo) other.descargaEnId = ptrNuevo;
        if (other.origenId === ptrViejo) other.origenId = ptrNuevo;
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
      // Pisos vecinos: LD/punteros/fantasmas en sus storage (no están en memoria).
      renameBajanteAcrossFloorReferences(thisPlanId, oldId, newId);
      // Claves de UDs del piso cargado siguen al renombre (aparatos asignados al montante y
      // la clave del LDesvio): sin esto el renombrado perdía sus aparatos y el id reutilizado
      // nacía con la carga del borrado.
      try {
        const aparatos = loadFromStorage<Record<string, Record<string, number>>>(
          APARATOS_BY_TRAMO_KEY,
          {},
        );
        const hidro = loadFromStorage<Record<string, unknown>>(HYDRO_DATA_STORAGE_KEY, {});
        const sujeto = (k: string): string | null => {
          const pre = `${netId}_`;
          if (k.startsWith(`${pre}${oldId}_`))
            return k.replace(`${pre}${oldId}_`, `${pre}${newId}_`);
          if (k.startsWith(`${pre}LD_${oldId}_`))
            return k.replace(`${pre}LD_${oldId}_`, `${pre}LD_${newId}_`);
          return null;
        };
        let toco = false;
        for (const store of [aparatos, hidro] as Array<Record<string, unknown>>) {
          for (const k of Object.keys(store)) {
            // Solo claves del piso cargado: renumerar MAF2 en A no debe mover
            // `af_MAF1_<planB>` (mismo patrón que _renumberRamales arriba).
            if (!isPlanKeyFor(k, thisPlanId)) continue;
            const nk = sujeto(k);
            if (!nk) continue;
            if (!store[nk]) {
              store[nk] = store[k];
              delete store[k];
              toco = true;
            } else {
              // El destino YA existe (clave huérfana del montante borrado): se fusiona por
              // máximo y se borra la clave vieja. Antes no se copiaba NADA: el montante nuevo
              // conservaba su clave vieja y la clave del borrado quedaba con sus conteos.
              const dst = store[nk] as Record<string, number>;
              const src = store[k] as Record<string, number>;
              const out = { ...dst };
              for (const [k2, v2] of Object.entries(src)) {
                out[k2] = Math.max(Number(out[k2]) || 0, Number(v2) || 0);
              }
              store[nk] = out;
              delete store[k];
              toco = true;
            }
          }
        }
        if (toco) {
          saveToStorage(APARATOS_BY_TRAMO_KEY, aparatos);
          saveToStorage(HYDRO_DATA_STORAGE_KEY, hidro);
        }
      } catch (e) {
        devError('[RENUMBER] claves de montante:', e);
      }
    });
  }
  try {
    window.dispatchEvent(new Event(EV_STORAGE));
  } catch {
    /* ignore */
  }
}

/** Cambia el nombre de una tubería y arregla todas las referencias para que nada quede colgando:
 *  la genealogía del split (mergesFrom) y las listas de ramales que llegan (recibeDeIds). */
export function renameRamalId(
  engine: IPlanoEngineCore,
  oldId: string,
  newId: string,
  oldLabel?: string,
): void {
  if (!oldId || !newId || oldId === newId) return;
  const replaceRef = (v: string | null | undefined): string | null | undefined => {
    if (v == null) return v;
    if (v === oldId || (oldLabel && v === oldLabel)) return newId;
    if (v.endsWith('|' + oldId)) return v.slice(0, v.length - oldId.length) + newId;
    if (oldLabel && v.endsWith('|' + oldLabel))
      return v.slice(0, v.length - oldLabel.length) + newId;
    return v;
  };
  for (const r of engine.ramales) {
    if (r.id === oldId) {
      r.id = newId;
      continue;
    }
    if (r.padre === oldId) r.padre = newId;
    if (r.mergesFrom)
      r.mergesFrom = [
        r.mergesFrom[0] === oldId ? newId : r.mergesFrom[0],
        r.mergesFrom[1] === oldId ? newId : r.mergesFrom[1],
      ];
    if (r.ini === oldId) r.ini = newId;
    if (r.fin === oldId) r.fin = newId;
  }
  for (const b of engine.bajantes) {
    if (b.recibeDeIds?.includes(oldId))
      b.recibeDeIds = b.recibeDeIds.map((x) => (x === oldId ? newId : x));
    if (b.descargaEnId) {
      const nd = replaceRef(b.descargaEnId);
      if (nd !== undefined) b.descargaEnId = nd;
    }
  }
  if (engine.selId === oldId) engine.selId = newId;
  // Storage del plano cargado: las claves son `${net}_${ramalId}_${planId}`.
  const planId = engine._loadedPlanId;
  if (planId != null) {
    const netOf = (id: string) => engine.ramales.find((r) => r.id === id)?.net || '';
    const net = netOf(newId);
    if (net) {
      // Aparatos: { aparatoId: cantidad }. El id nuevo casi nunca tiene clave propia — se MUEVE
      // tal cual; solo si el destino ya tenía datos independientes se suma (sumar siempre
      // duplicaba las UD al deshacer y reconvertir el mismo tributario).
      try {
        const all =
          (loadFromStorage(APARATOS_BY_TRAMO_KEY, {}) as Record<string, Record<string, number>>) ||
          {};
        const from = `${net}_${oldId}_${planId}`;
        const to = `${net}_${newId}_${planId}`;
        if (all[from] !== undefined && from !== to) {
          if (all[to] === undefined) {
            all[to] = all[from];
          } else {
            // Mismo ramal, dos copias del conteo (p. ej. clave vieja resucitada por el estado
            // stale de FixturesPanel): MAX por aparato — sumar duplicaba las UD al reconvertir.
            all[to] = mezclarMax(all[to] || {}, all[from]);
          }
          delete all[from];
          saveToStorage(APARATOS_BY_TRAMO_KEY, all);
        }
      } catch (e) {
        devError('PlanoEngine:', e);
      }
      // Libros de la propagación (mapas aparato→n como aparatos): misma migración
      // mover-o-MAX — sin esto lo propagado se volvía "manual" tras convertir (Σ ×N).
      for (const bk of [APARATOS_HEREDADOS_KEY, APARATOS_HEREDADOS_TRIB_KEY]) {
        try {
          const bl = (loadFromStorage(bk, {}) as Record<string, Record<string, number>>) || {};
          const fromB = `${net}_${oldId}_${planId}`;
          const toB = `${net}_${newId}_${planId}`;
          if (bl[fromB] !== undefined && fromB !== toB) {
            if (bl[toB] === undefined) {
              bl[toB] = bl[fromB];
            } else {
              bl[toB] = mezclarMax(bl[toB] || {}, bl[fromB]);
            }
            delete bl[fromB];
            saveToStorage(bk, bl);
          }
        } catch (e) {
          devError('PlanoEngine:', e);
        }
      }
      // Libro de bajadas receptoras: valores NUMÉRICOS (1) — mover la marca tal cual,
      // conservando el destino si ya estaba marcado (mover-o-dejar, no MAX de objetos).
      try {
        const bl = (loadFromStorage(BAJADAS_RECEPTORAS_KEY, {}) as Record<string, number>) || {};
        const fromB = `${net}_${oldId}_${planId}`;
        const toB = `${net}_${newId}_${planId}`;
        if (bl[fromB] !== undefined && fromB !== toB) {
          if (bl[toB] === undefined) bl[toB] = bl[fromB];
          delete bl[fromB];
          saveToStorage(BAJADAS_RECEPTORAS_KEY, bl);
        }
      } catch (e) {
        devError('PlanoEngine:', e);
      }
      // Hidro guarda { accesorios, Lh, nSalidas }: fusionar accesorios por suma y conservar
      // escalares del destino si existen.
      try {
        const all =
          (loadFromStorage(HYDRO_DATA_STORAGE_KEY, {}) as Record<
            string,
            {
              accesorios?: Record<string, number>;
              Lh?: number;
              nSalidas?: number;
            }
          >) || {};
        const from = `${net}_${oldId}_${planId}`;
        const to = `${net}_${newId}_${planId}`;
        const src = all[from];
        if (src !== undefined && from !== to) {
          const dst = all[to];
          if (dst === undefined) {
            all[to] = src;
          } else {
            // Mismo ramal, dos copias: MAX por accesorio y por escalar (sumar duplicaba).
            const acc = mezclarMax(dst.accesorios || {}, src.accesorios || {});
            all[to] = {
              accesorios: acc,
              Lh: Math.max(dst.Lh ?? 0, src.Lh ?? 0),
              nSalidas: Math.max(dst.nSalidas ?? 0, src.nSalidas ?? 0),
            };
          }
          delete all[from];
          saveToStorage(HYDRO_DATA_STORAGE_KEY, all);
        }
      } catch (e) {
        devError('PlanoEngine:', e);
      }
    }
  }
  // Gas usa claves de ramal peladas (sin red ni plano) — misma migración mover-o-sumar que
  // aparatos/hidro.
  try {
    const all = loadFromStorage(GAS_ACC_KEY, {}) as Record<string, Record<string, number>>;
    if (all[oldId] !== undefined && oldId !== newId) {
      if (all[newId] === undefined) {
        all[newId] = all[oldId];
      } else {
        // Mismo ramal, dos copias: MAX por aparato (sumar duplicaba).
        all[newId] = mezclarMax(all[newId] || {}, all[oldId]);
      }
      delete all[oldId];
      saveToStorage(GAS_ACC_KEY, all);
    }
  } catch (e) {
    devError('PlanoEngine:', e);
  }
  // FixturesPanel cachea el mapa de aparatos/hidro/gas en estado de React y lo re-escribe
  // entero en cada cambio (saveAll en un effect). Sin este evento — que el storage nativo NO
  // dispara en la misma pestaña — su copia stale resucitaba la clave vieja y borraba la
  // migrada: las UD del ramal convertido se reseteaban (orig. usuario). Mismo patrón que
  // _renumberRamales.
  try {
    window.dispatchEvent(new Event(EV_STORAGE));
  } catch {
    /* ignore */
  }
}

/** Renumera las áreas de cada red (A1, A3 → A1, A2) según su orden en el dibujo, que es el orden en
 *  que las ve el usuario al recorrer la tubería. */
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
  // Numeración POR RED (orig. usuario): cada red numera sus áreas AREA1..N de forma
  // independiente — borrar/crear en una red no altera la serie de las demás.
  const porRed = new Map<string, IPlanoEngineCore['areas']>();
  engine.areas.forEach((a) => {
    const k = a.net || '';
    const arr = porRed.get(k) || [];
    arr.push(a);
    porRed.set(k, arr);
  });
  porRed.forEach((arr) => {
    arr.forEach((a, i) => {
      // Solo compactar labels AUTO (AREA n): pisar labels personalizados del usuario
      // (sector de rejillas: "COCINA", "TERRAZA"…) borraba su nombre al borrar un área
      // (orig. usuario: "se renombran todas las otras áreas").
      if (/^AREA\d+$/.test(a.label || '')) a.label = 'AREA' + (i + 1);
    });
  });
}
