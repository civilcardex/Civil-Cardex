import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from './PlanoState';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';
import {
  removeCrossFloorGhostsBySource,
  isLdesvioRamalId,
} from '../../utils/associateBajanteAcrossFloors';
import { clearBajanteAssociation } from '../../utils/bajanteAssociation';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { HYDRO_DATA_STORAGE_KEY } from '../../constants/storage-keys';
import { _midpoint } from './PlanoEngineDrawing';

/**
 * Borrado con cascada: elimina selección, limpia ghosts/Ldesvíos entre pisos,
 * recalcula longitudes y renumera. Usado por `PlanoEngine.deleteSelected()`.
 */

import { cascadeMontanteAssociation, type HidroDataEntry } from './deleteCascade';
import { cleanupJunctionsAfterRamalDelete, cleanupTeeMarkersAt } from './deleteJunctionCleanup';
import { remergeSplitRamales } from './deleteRemerge';
import { isDeletedYeeDoblePart, preserveYeeDobleAt, splitMembersFor } from './deleteYeePreserve';

// Orig. usuario #2: al borrar un trazo, sus tributarios se REASIGNAN al ramal del otro lado de
// la unión si existe (p. ej. el otro brazo de una yee doble, o la continuación del paso), en vez
// de borrarse junto con él. El ramal hermano comparte un punto de unión con `deleted` (mismo net,
// no tributario) y sigue existiendo tras el borrado.
// Yee doble: los dos brazos están a ~10 unidades a lo largo del tronco, no comparten vértice
// exacto — se busca primero coincidencia exacta (0.5) y en segunda pasada hasta 20px.
function reassignTributariosToHermano(
  engine: IPlanoEngineCore,
  deleted: PlanoRamal,
  toDelete?: Set<string>,
): void {
  if (!deleted.pts?.length) return;
  const TOL = 0.5;
  const LARGE = 20;
  const isCandidate = (o: PlanoRamal) =>
    o.id !== deleted.id &&
    o.net === deleted.net &&
    o.tipo !== 'tributario' &&
    !toDelete?.has(o.id) &&
    !!o.pts?.length;
  const deletedEps = [deleted.pts[0], deleted.pts[deleted.pts.length - 1]];
  const findByTol = (tol: number): PlanoRamal | undefined => {
    let best: PlanoRamal | undefined;
    let bestD = Infinity;
    for (const o of engine.ramales) {
      if (!isCandidate(o)) continue;
      const oEps = [o.pts[0], o.pts[o.pts.length - 1]];
      for (const de of deletedEps) {
        for (const oe of oEps) {
          const d = Math.hypot(de[0] - oe[0], de[1] - oe[1]);
          if (d < tol && d < bestD) {
            bestD = d;
            best = o;
          }
        }
      }
    }
    return best;
  };
  const hermano = findByTol(TOL) ?? findByTol(LARGE);
  if (!hermano) return;
  for (const t of engine.ramales) {
    if (t.tipo === 'tributario' && t.padre === deleted.id) {
      t.padre = hermano.id;
    }
  }
}

export function deleteSelected(
  engine: IPlanoEngineCore,
  ids?: string[],
  opts?: { noMerge?: boolean },
): void {
  if (ids && ids.length > 0) {
    engine._yeeFlashKey = null;
    const netsToRenumber = new Set<string>();
    const bajNetsToRenumber = new Set<string>();
    let renumberAreas = false;
    const toDelete = new Set<string>(ids);
    // "Borrar trazo" (opts.noMerge) borra SOLO el ramal indicado: no expande mitades de
    // split ni re-úne el tronco — necesario para el borrado parcial de una yee doble
    // (orig. #2), donde borrar un brazo lateral no debe colapsar la yee completa.
    if (!opts?.noMerge) {
      for (const id of [...ids]) {
        for (const extra of splitMembersFor(engine, id)) toDelete.add(extra);
      }
    }
    const deletedRamalIds = new Set<string>();
    for (const id of toDelete) {
      const idxR = engine.ramales.findIndex((r) => r.id === id);
      if (idxR >= 0) {
        const deleted = engine.ramales[idxR];
        deletedRamalIds.add(deleted.id);
        const wasYeeDoblePart = isDeletedYeeDoblePart(engine, deleted);
        const isDivisor = engine.ramales.some(
          (r) => r.mergesFrom && r.mergesFrom[1] === deleted.id,
        );
        // Orig. usuario #2: reasignar tributarios al ramal del otro lado de la unión si existe.
        // Y doble: borrar solo el segmento, no todo el conjunto conectado ni tribs laterales
        if (wasYeeDoblePart) {
          reassignTributariosToHermano(engine, deleted, toDelete);
          engine.ramales = engine.ramales.filter((r) => r.id !== deleted.id);
        } else {
          reassignTributariosToHermano(engine, deleted, toDelete);
          engine.ramales = engine.ramales.filter(
            (r) => r.id !== deleted.id && r.padre !== deleted.id,
          );
        }
        preserveYeeDobleAt(engine, deleted);
        // Y doble lateral → tapón (cuando se borra tributario parte de Y doble, el host queda con extremo abierto)
        if (!deleted.yeeDobleAt && wasYeeDoblePart) {
          try {
            const host = engine.ramales.find(
              (x) => x.yeeDobleAt && x.yeeDobleAt.length === 2 && x.net === 'san',
            );
            if (host && deleted.pts?.length) {
              const delEnd = deleted.pts[deleted.pts.length - 1];
              const d0h = Math.hypot(host.pts[0][0] - delEnd[0], host.pts[0][1] - delEnd[1]);
              const d1h = Math.hypot(
                host.pts[host.pts.length - 1][0] - delEnd[0],
                host.pts[host.pts.length - 1][1] - delEnd[1],
              );
              // si el tributario tocaba cerca del host (dentro 20), asumimos Y doble
              if (Math.min(d0h, d1h) < 25) {
                const planId2 = engine._loadedPlanId;
                const accField2 = d0h <= d1h ? 'accesorioInicio' : 'accesorioFin';
                const diamField2 = d0h <= d1h ? 'diametroInicio' : 'diametroFin';
                if (!host[accField2]) {
                  (host as unknown as Record<string, unknown>)[accField2] = 'tapon';
                  if (!host[diamField2])
                    (host as unknown as Record<string, unknown>)[diamField2] = '2"';
                  if (planId2 != null) {
                    const map3 = loadFromStorage<Record<string, HidroDataEntry>>(
                      HYDRO_DATA_STORAGE_KEY,
                      {},
                    );
                    const kHost = `san_${host.id}_${planId2}`;
                    if (!map3[kHost]) map3[kHost] = { accesorios: {}, Lh: 0, nSalidas: 0 };
                    if (!map3[kHost].accesorios) map3[kHost].accesorios = {};
                    map3[kHost].accesorios['tapon'] = (map3[kHost].accesorios['tapon'] || 0) + 1;
                    saveToStorage(HYDRO_DATA_STORAGE_KEY, map3);
                  }
                }
              }
            }
          } catch {
            /* ignore */
          }
        }
        // Ítem 9: si este ramal había partido a otro (incoming de una división mergesFrom), se
        // re-une la línea que quedó en dos mitades. Para "Borrar trazo" (noMerge) se salta:
        // el tronco de la yee doble debe quedar intacto (solo se borra el brazo lateral).
        // Yee doble: el brazo principal se borra individualmente (sin re-unir); el lateral sí re-une.
        if (!opts?.noMerge && !(wasYeeDoblePart && !isDivisor)) {
          remergeSplitRamales(engine, deleted.id, deleted.uc || 0);
        }
        if (deleted.pts?.length) cleanupJunctionsAfterRamalDelete(engine, deleted);
        netsToRenumber.add(deleted.net);
        // Limpia las referencias al ramal borrado en los bajantes
        for (const b of engine.bajantes) {
          if (b.recibeDeIds) {
            b.recibeDeIds = b.recibeDeIds.filter((rid) => rid !== deleted.id);
          }
          if (b.descargaEnId) {
            const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
            if (parts[parts.length - 1] === deleted.id) b.descargaEnId = null;
          }
          // Si este ramal era el conector Ldesvio de un desplazamiento fantasma, al fantasma ya
          // no le queda tubería hacia el padre — se quita el desplazamiento (y su fantasma).
          if (b.desplazamientos) {
            for (const lvlKey of Object.keys(b.desplazamientos)) {
              if (b.desplazamientos[lvlKey].Ldesvio === deleted.id) {
                const sourceBajanteId = b.id;
                delete b.desplazamientos[lvlKey];
                if (b.ghostData) delete b.ghostData[lvlKey];
                // Borrar también el fantasma punteado del piso inferior
                if (isLdesvioRamalId(deleted.id)) {
                  removeCrossFloorGhostsBySource(engine._loadedPlanId, sourceBajanteId);
                }
              }
            }
          }
        }
        // Ldesvio borrado directamente (sin desplazamiento asociado) — limpiar fantasmas huérfanos
        if (isLdesvioRamalId(deleted.id)) {
          const sourceBajanteId = deleted.id.slice(3);
          removeCrossFloorGhostsBySource(engine._loadedPlanId, sourceBajanteId);
        }
        continue;
      }
      const idxB = engine.bajantes.findIndex((b) => b.id === id);
      if (idxB >= 0) {
        const deleted: PlanoBajante = engine.bajantes[idxB];
        // Borrar un canal debe desasociar sus bajantes — si no, su canalId seguiría apuntando a
        // un id que ya no existe (o peor, a un canal futuro que llegue a reutilizarlo).
        if (deleted.tipo === 'canal') {
          for (const b of engine.bajantes) {
            if (b.canalId === deleted.id) b.canalId = null;
          }
        } else {
          // Borrar un bajante debe quitar la asociación externa que cualquier canal tenga sobre él.
          for (const c of engine.bajantes) {
            if (c.tipo === 'canal' && c.bajanteExternoId === deleted.id) c.bajanteExternoId = null;
          }
        }
        const lvl = engine.nivelActual?.label ?? '';
        // Si isFantasma=true, se trata como borrado del padre (limpia TODOS los niveles)
        if (!deleted.isFantasma && engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
          const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
          if (lDesvioId) {
            engine.ramales = engine.ramales.filter((r) => r.id !== lDesvioId);
            netsToRenumber.add(deleted.net);
          }
          delete deleted.desplazamientos[lvl];
          if (deleted.ghostData) delete deleted.ghostData[lvl];
        } else {
          // Limpia los ramales Ldesvio y los desplazamientos fantasma
          if (deleted.desplazamientos) {
            for (const lvlKey of Object.keys(deleted.desplazamientos)) {
              const d = deleted.desplazamientos[lvlKey];
              if (d.Ldesvio) {
                engine.ramales = engine.ramales.filter((r) => r.id !== d.Ldesvio);
                netsToRenumber.add(deleted.net);
              }
            }
          }
          // Limpia las referencias en otros bajantes
          for (const other of engine.bajantes) {
            if (other.recibeDeIds) {
              other.recibeDeIds = other.recibeDeIds.filter((rid) => rid !== deleted.id);
            }
            if (other.descargaEnId === deleted.id) {
              other.descargaEnId = null;
            } else if (other.descargaEnId?.includes('|')) {
              const parts = other.descargaEnId.split('|');
              if (parts[1] === deleted.id) other.descargaEnId = null;
            }
          }
          engine.bajantes.splice(idxB, 1);
          cascadeMontanteAssociation(engine, deleted);
          // Un montante a mitad de cuerpo siempre escribió un marcador de tee (accMed) en su
          // ramal huésped al crearse — borrar el montante sin esto dejaba ese glifo/conteo para
          // siempre, porque nada más vuelve a revisar accMed una vez escrito.
          if (deleted.tipo === 'montante') cleanupTeeMarkersAt(engine, [deleted.x, deleted.y]);
          if (deleted.tipo === 'bajante') bajNetsToRenumber.add(deleted.net);
          else if (deleted.tipo === 'montante') bajNetsToRenumber.add('montante');
          else if (deleted.tipo === 'red_publica') bajNetsToRenumber.add('red_publica');
          else if (deleted.tipo === 'contador') bajNetsToRenumber.add('contador');
          // Limpia los fantasmas entre pisos de OTROS pisos que referencian este bajante
          if (engine._loadedPlanId != null)
            removeCrossFloorGhostsBySource(engine._loadedPlanId, deleted.id);
        }
        continue;
      }
      const idxGhost = engine.crossFloorGhosts.findIndex((g) => g.id === id);
      if (idxGhost >= 0) {
        const g = engine.crossFloorGhosts[idxGhost];
        // Un fantasma es la mitad visual de un enlace entre pisos — borrarlo debe tumbar el
        // enlace COMPLETO: el puntero inverso origenId del piso destino, el desplazamiento del
        // origen (con su ramal Ldesvio) y el fantasma mismo en storage. El piso destino es el
        // que está cargado (los fantasmas solo se dibujan ahí), así que clearBajanteAssociation
        // también arregla el estado vivo del motor. `plans` no está disponible a nivel de motor:
        // el origenId null del destino aterriza en storage por el flujo normal de guardado
        // sucio, y la caché de dibujo sincronizada se reconstruye en el próximo syncDrawings.
        clearBajanteAssociation(
          engine,
          g.sourcePlanId,
          g.sourceBajanteId,
          g.net,
          `${String(engine._loadedPlanId ?? '')}|${g.targetBajanteId}`,
          [],
        );
        engine.crossFloorGhosts = engine.crossFloorGhosts.filter((x) => x.id !== id);
        engine.selectedGhostId = null;
        engine._isGhostSel = false;
        engine.selId = null;
        engine._emitSelect(null);
        engine._emitDelete([id]);
        engine.render();
        engine._markDirty();
        continue;
      }
      const idxT = engine.textAnnots.findIndex((t) => t.id === id);
      if (idxT >= 0) {
        engine.textAnnots.splice(idxT, 1);
        continue;
      }
      const idxA = engine.areas.findIndex((a) => a.id === id);
      if (idxA >= 0) {
        engine.areas.splice(idxA, 1);
        renumberAreas = true;
        continue;
      }
      const idxD = engine.dims.findIndex((d) => d.id === id);
      if (idxD >= 0) {
        engine.dims.splice(idxD, 1);
        continue;
      }
      const idxG = engine.guideLines.findIndex((g) => g.id === id);
      if (idxG >= 0) {
        engine.guideLines.splice(idxG, 1);
        continue;
      }
    }
    for (const net of netsToRenumber) engine._renumberRamales(net);
    for (const net of bajNetsToRenumber) {
      if (net === 'montante') engine._renumberMontantes();
      else if (net === 'red_publica') {
        const rps = engine.bajantes.filter((b) => b.tipo === 'red_publica');
        rps.forEach((b, i) => {
          b.id = 'RP' + (i + 1);
          b.code = 'RP' + (i + 1);
        });
      } else if (net === 'contador') {
        const cnts = engine.bajantes.filter((b) => b.tipo === 'contador');
        cnts.forEach((b, i) => {
          const pfx = b.net === 'gas' ? 'CTNG' : 'CNTAF';
          b.id = pfx + (i + 1);
          b.code = pfx + (i + 1);
        });
      } else engine._renumberBajantes(net);
    }
    if (renumberAreas) engine._renumberAreas();
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete(ids);
    engine.render();
    engine._markDirty();
    return;
  }
  if (!engine.selId) return;
  engine._yeeFlashKey = null;
  const idxR = engine.ramales.findIndex((r) => r.id === engine.selId);
  if (idxR >= 0) {
    const deleted = engine.ramales[idxR];
    const deletedId = deleted.id;
    // Ítem 9/v2: borrar una mitad de división borra toda la división (misma expansión que el
    // path de ids). Se delega en deleteSelected con el set expandido para un solo camino.
    const members = splitMembersFor(engine, deletedId);
    if (members.length > 0) {
      const expanded = [deletedId, ...members];
      engine.selId = null;
      deleteSelected(engine, expanded);
      return;
    }
    const wasYeeDoblePartSel = isDeletedYeeDoblePart(engine, deleted);
    const isDivisorSel = engine.ramales.some((r) => r.mergesFrom && r.mergesFrom[1] === deletedId);
    // Orig. usuario #2: reasignar tributarios al ramal del otro lado de la unión si existe.
    reassignTributariosToHermano(engine, deleted);
    if (wasYeeDoblePartSel) {
      engine.ramales = engine.ramales.filter((r) => r.id !== deletedId);
    } else {
      engine.ramales = engine.ramales.filter((r) => r.id !== deletedId && r.padre !== deleted.id);
    }
    preserveYeeDobleAt(engine, deleted);
    // Ítem 9: si este ramal había partido a otro, se re-une la línea en dos mitades.
    // Yee doble: el brazo principal se borra individualmente (sin re-unir); el lateral sí re-une.
    if (!(wasYeeDoblePartSel && !isDivisorSel)) {
      remergeSplitRamales(engine, deletedId, deleted.uc || 0);
    }
    if (deleted.pts?.length) cleanupJunctionsAfterRamalDelete(engine, deleted);
    // Limpia las referencias al ramal borrado en los bajantes
    for (const b of engine.bajantes) {
      if (b.recibeDeIds) {
        b.recibeDeIds = b.recibeDeIds.filter((r) => r !== deletedId);
      }
      if (b.descargaEnId) {
        const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
        if (parts[parts.length - 1] === deletedId) b.descargaEnId = null;
      }
      if (b.desplazamientos) {
        for (const lvlKey of Object.keys(b.desplazamientos)) {
          if (b.desplazamientos[lvlKey].Ldesvio === deletedId) {
            const sourceBajanteId = b.id;
            delete b.desplazamientos[lvlKey];
            if (b.ghostData) delete b.ghostData[lvlKey];
            if (isLdesvioRamalId(deletedId)) {
              removeCrossFloorGhostsBySource(engine._loadedPlanId, sourceBajanteId);
            }
          }
        }
      }
    }
    if (isLdesvioRamalId(deletedId)) {
      const sourceBajanteId = deletedId.slice(3);
      removeCrossFloorGhostsBySource(engine._loadedPlanId, sourceBajanteId);
    }
    if (deleted.tipo === 'ramal') {
      engine._renumberRamales(deleted.net);
    } else {
      const netId = deleted.net;
      const remaining = engine.ramales.filter((r) => r.net === netId && r.tipo !== 'tributario');
      if (remaining.length === 0) {
        if (engine._netCounts[netId]) engine._netCounts[netId].ramal = 0;
      } else {
        let maxN = 0;
        for (const r of remaining) {
          const m = (r.label || r.id || '').match(/\d+/);
          if (m) maxN = Math.max(maxN, parseInt(m[0], 10));
        }
        if (engine._netCounts[netId]) engine._netCounts[netId].ramal = maxN;
      }
    }
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxB = engine.bajantes.findIndex((b) => b.id === engine.selId);
  if (idxB >= 0) {
    const deleted: PlanoBajante = engine.bajantes[idxB];
    const deletedId = deleted.id;
    const lvl = engine.nivelActual?.label ?? '';
    // Si isFantasma=true, se trata como borrado del padre (limpia TODOS los niveles)
    if (!deleted.isFantasma && engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
      const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
      if (lDesvioId) {
        engine.ramales = engine.ramales.filter((r) => r.id !== lDesvioId);
      }
      delete deleted.desplazamientos[lvl];
      if (deleted.ghostData) delete deleted.ghostData[lvl];
      engine.selId = null;
      engine._isGhostSel = false;
      engine._emitSelect(null);
      engine.render();
      engine._markDirty();
      return;
    }
    // Borrado del bajante padre: también limpia sus ramales Ldesvio y desplazamientos fantasma
    if (deleted.desplazamientos) {
      for (const lvlKey of Object.keys(deleted.desplazamientos)) {
        const d = deleted.desplazamientos[lvlKey];
        if (d.Ldesvio) {
          engine.ramales = engine.ramales.filter((r) => r.id !== d.Ldesvio);
        }
      }
    }
    // Limpia las referencias en recibeDeIds y descargaEnId de otros bajantes
    for (const other of engine.bajantes) {
      if (other.recibeDeIds) {
        other.recibeDeIds = other.recibeDeIds.filter((rid) => rid !== deletedId);
      }
      if (other.descargaEnId === deletedId) {
        other.descargaEnId = null;
      } else if (other.descargaEnId?.includes('|')) {
        const parts = other.descargaEnId.split('|');
        if (parts[1] === deletedId) other.descargaEnId = null;
      }
    }
    // Ítem 4: asociación explícita bajante↔canal por ID — al borrar el bajante se limpia la
    // referencia del canal (bajanteExternoId). Los ramales que atraviesan o ingresan al cuerpo
    // del canal NO se tocan: la asociación es por referencia, no por geometría.
    for (const c of engine.bajantes) {
      if (c.tipo === 'canal' && c.bajanteExternoId === deletedId) c.bajanteExternoId = null;
    }
    engine.bajantes.splice(idxB, 1);
    cascadeMontanteAssociation(engine, deleted);
    if (deleted.tipo === 'bajante') {
      void deleted.net;
    } else if (deleted.tipo === 'montante') {
      // Un montante a mitad de cuerpo siempre escribió un marcador de tee (accMed) en su ramal
      // huésped al crearse — borrarlo sin esto dejaba ese glifo/conteo para siempre.
      cleanupTeeMarkersAt(engine, [deleted.x, deleted.y]);
    } else if (deleted.tipo === 'red_publica') {
      const rps = engine.bajantes.filter((b) => b.tipo === 'red_publica');
      rps.forEach((b, i) => {
        b.id = 'RP' + (i + 1);
        b.code = 'RP' + (i + 1);
      });
    } else if (deleted.tipo === 'contador') {
      const cnts = engine.bajantes.filter((b) => b.tipo === 'contador');
      cnts.forEach((b, i) => {
        const pfx = b.net === 'gas' ? 'CTNG' : 'CNTAF';
        b.id = pfx + (i + 1);
        b.code = pfx + (i + 1);
      });
    }
    // Limpia los fantasmas entre pisos de OTROS pisos que referencian este bajante
    if (engine._loadedPlanId != null)
      removeCrossFloorGhostsBySource(engine._loadedPlanId, deleted.id);
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxT = engine.textAnnots.findIndex((t) => t.id === engine.selId);
  if (idxT >= 0) {
    const deletedId = engine.textAnnots[idxT].id;
    engine.textAnnots.splice(idxT, 1);
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxA = engine.areas.findIndex((a) => a.id === engine.selId);
  if (idxA >= 0) {
    const deletedId = engine.areas[idxA].id;
    engine.areas.splice(idxA, 1);
    engine._renumberAreas();
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxD = engine.dims.findIndex((d) => d.id === engine.selId);
  if (idxD >= 0) {
    const deletedId = engine.dims[idxD].id;
    engine.dims.splice(idxD, 1);
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxG = engine.guideLines.findIndex((g) => g.id === engine.selId);
  if (idxG >= 0) {
    const deletedId = engine.guideLines[idxG].id;
    engine.guideLines.splice(idxG, 1);
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
}
