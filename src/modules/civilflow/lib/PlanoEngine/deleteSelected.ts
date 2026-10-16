import type { IPlanoEngineCore, PlanoBajante } from './PlanoState';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';
import { splitPtr } from '../../utils/keys';
import {
  removeCrossFloorGhostsBySource,
  isLdesvioRamalId,
} from '../../utils/associateBajanteAcrossFloors';
import { clearBajanteAssociation } from '../../utils/bajanteAssociation';
import { _midpoint } from './PlanoEngineDrawing';

/** Borra la seleccion con cascada (limpia fantasmas y renumera las redes tocadas). */

import { cascadeMontanteAssociation, purgarEstadoRamalesBorrados } from './deleteCascade';
import { desasociarBombaEnTrazos } from '../../utils/bombaAssociation';
import { cleanupJunctionsAfterRamalDelete, cleanupTeeMarkersAt } from './deleteJunctionCleanup';
import { remergeSplitRamales, mergeTribPairAt, mergeTouchingRemnant } from './deleteRemerge';
import { isDeletedYeeDoblePart, preserveYeeDobleAt, splitMembersFor } from './deleteYeePreserve';
import { distToPolyline } from '../shared/geometry';
import { reassignTributariosToHermano, renumberCanales } from './deleteHelpers';

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
    let renumberCanalesNeeded = false;
    const toDelete = new Set<string>(ids);
    // Borrado en conjunto (orig. usuario): caen los TRIBUTARIOS que llegan a lo seleccionado
    // (transitivamente: un tributario puede recibir a otro) y los colgantes por `padre`.
    // Los RAMALES tronco tocados NO caen (RS1/RS3 sobreviven al borrar laterales — imagen 1).
    // SIN splitMembersFor: en la maraña casi todo son mitades de splits encadenados
    // (mergesFrom) y esa expansión arrastraba el tronco entero.
    {
      let grew = true;
      while (grew) {
        grew = false;
        for (const r of engine.ramales) {
          if (toDelete.has(r.id) || r.tipo !== 'tributario' || !r.pts || r.pts.length < 2) continue;
          const dest = r._tribReversed ? r.pts[0] : r.pts[r.pts.length - 1];
          const feeds = engine.ramales.some(
            (p) =>
              toDelete.has(p.id) && p.pts && p.pts.length >= 2 && distToPolyline(dest, p.pts) < 0.5,
          );
          if (feeds || (r.padre && toDelete.has(r.padre))) {
            toDelete.add(r.id);
            grew = true;
          }
        }
      }
    }
    const deletedRamalIds = new Set<string>();
    const deletedPts: number[][] = [];
    for (const id of toDelete) {
      const idxR = engine.ramales.findIndex((r) => r.id === id);
      if (idxR >= 0) {
        const deleted = engine.ramales[idxR];
        deletedRamalIds.add(deleted.id);
        if (deleted.pts) for (const p of deleted.pts) deletedPts.push(p);
        const wasYeeDoblePart = isDeletedYeeDoblePart(engine, deleted);
        const isDivisor = engine.ramales.some(
          (r) => r.mergesFrom && r.mergesFrom[1] === deleted.id,
        );
        // Orig. usuario (borrado en conjunto): los tributarios que llegan a los seleccionados
        // CAEN con ellos (ya están en toDelete por la expansión de red conectada) — ya no se
        // reasignan a un hermano.
        engine.ramales = engine.ramales.filter((r) => r.id !== deleted.id);
        preserveYeeDobleAt(engine, deleted);
        // Ítem 9: si este ramal había partido a otro (incoming de una división mergesFrom), se
        // re-une la línea que quedó en dos mitades. Para "Borrar trazo" (noMerge) se salta:
        // el tronco de la yee doble debe quedar intacto (solo se borra el brazo lateral).
        // Yee doble: el brazo principal se borra individualmente (sin re-unir); el lateral sí re-une.
        if (!opts?.noMerge && !(wasYeeDoblePart && !isDivisor)) {
          remergeSplitRamales(engine, deleted.id, deleted.uc || 0);
        }
        if (deleted.pts?.length) cleanupJunctionsAfterRamalDelete(engine, deleted);
        netsToRenumber.add(deleted.net);
        // Limpia las referencias al ramal borrado en los bajantes (alimentaIds también).
        for (const b of engine.bajantes) {
          if (b.recibeDeIds) {
            b.recibeDeIds = b.recibeDeIds.filter((rid) => rid !== deleted.id);
          }
          if (b.alimentaIds) {
            b.alimentaIds = b.alimentaIds.filter((rid) => rid !== deleted.id);
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
          // Ramal de canal (orig. usuario): cae con su canal. Se añaden al MISMO conjunto
          // durante el recorrido para que pasen por el pipeline completo de borrado de ramal
          // (re-merge, limpieza de recibeDeIds, purga de conteos).
          for (const r of engine.ramales) {
            if (r.esCanalId === deleted.id) toDelete.add(r.id);
          }
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
            deletedRamalIds.add(lDesvioId);
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
                deletedRamalIds.add(d.Ldesvio);
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
              if (splitPtr(other.descargaEnId, '')[1] === deleted.id) other.descargaEnId = null;
            }
          }
          engine.bajantes.splice(idxB, 1);
          // El bajante borrado también arrastra su clave de UDs (`net_<id>_<plan>`) — la
          // renumeración reusa BAN1 y sin purga el nuevo nacería con las UDs viejas.
          deletedRamalIds.add(deleted.id);
          cascadeMontanteAssociation(engine, deleted);
          // BORRAR bomba (orig. usuario): desasociar cualquier bajante que la referencie.
          if (deleted.tipo === 'bomba')
            desasociarBombaEnTrazos(deleted.id, String(engine._loadedPlanId ?? ''));
          // Un montante a mitad de cuerpo siempre escribió un marcador de tee (accMed) en su
          // ramal huésped al crearse — borrar el montante sin esto dejaba ese glifo/conteo para
          // siempre, porque nada más vuelve a revisar accMed una vez escrito.
          if (deleted.tipo === 'montante') cleanupTeeMarkersAt(engine, [deleted.x, deleted.y]);
          if (deleted.tipo === 'bajante') bajNetsToRenumber.add(deleted.net);
          else if (deleted.tipo === 'montante') bajNetsToRenumber.add('montante');
          else if (deleted.tipo === 'red_publica') bajNetsToRenumber.add('red_publica');
          else if (deleted.tipo === 'contador') bajNetsToRenumber.add('contador');
          else if (deleted.tipo === 'canal') renumberCanalesNeeded = true;
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
    // Yee doble desarmada (orig. usuario): los brazos restantes que quedan tocándose en un
    // punto donde HABÍA un brazo borrado (grado 2) se funden en UN ramal (aunque formen
    // esquina) — el trazo restante queda como uno solo.
    if (!opts?.noMerge) mergeTouchingRemnant(engine, deletedPts);
    // Purga DESPUÉS de remerge/fusiones (mueven conteos al sobreviviente) y antes de la
    // renumeración (que puede reasignar el id a otro trazo).
    purgarEstadoRamalesBorrados(engine, deletedRamalIds);
    for (const net of netsToRenumber) engine._renumberRamales(net);
    if (renumberAreas) engine._renumberAreas();
    if (renumberCanalesNeeded) renumberCanales(engine);
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
    // Excepción noMerge (borrado quirúrgico del borrador): solo el ramal indicado.
    const members = opts?.noMerge ? [] : splitMembersFor(engine, deletedId);
    if (members.length > 0) {
      const expanded = [deletedId, ...members];
      engine.selId = null;
      deleteSelected(engine, expanded);
      return;
    }
    const wasYeeDoblePartSel = isDeletedYeeDoblePart(engine, deleted);
    // Ids a purgar del storage (aparatos/hidro/gas del piso): el borrado + sus tributarios en
    // cascada — si el id se reutiliza al redibujar, el trazo nuevo no debe nacer con UDs viejas.
    const purgarIds = new Set<string>([deletedId]);
    // Orig. usuario #2: reasignar tributarios al ramal del otro lado de la unión si existe.
    reassignTributariosToHermano(engine, deleted);
    if (wasYeeDoblePartSel) {
      engine.ramales = engine.ramales.filter((r) => r.id !== deletedId);
    } else {
      // Borrado INDIVIDUAL (selId): el tributario entrante de una división que se deshace
      // cae con ella (ítem #3). El BORRADO EN CONJUNTO (ids) no tiene esta cascada — pedido
      // usuario: en conjunto solo cae lo seleccionado.
      for (const t of engine.ramales) if (t.padre === deletedId) purgarIds.add(t.id);
      engine.ramales = engine.ramales.filter((r) => r.id !== deletedId && r.padre !== deletedId);
    }
    preserveYeeDobleAt(engine, deleted);
    // Ítem 9: si este ramal había partido a otro, se re-une la línea en dos mitades.
    // Yee doble: los brazos de una yee (tronco o lateral) NUNCA re-unen — borrar un brazo deja
    // las piezas como están (orig. usuario: borrar el 4º brazo remergeaba el tronco y luego
    // borrar el lateral de la yee simple remasada dejaba un codo 45 fantasma). Antes el divisor
    // de yee sí re-unía (condición wasYeeDoblePartSel && !isDivisorSel).
    if (!opts?.noMerge && !wasYeeDoblePartSel) {
      remergeSplitRamales(engine, deletedId, deleted.uc || 0);
    }
    // Yee doble desarmada (orig. usuario): brazos restantes tocándose donde HABÍA un brazo
    // borrado (grado 2) se funden en UN ramal — también por la ruta de borrado individual.
    if (!opts?.noMerge) mergeTouchingRemnant(engine, deleted.pts || []);
    if (deleted.pts?.length) cleanupJunctionsAfterRamalDelete(engine, deleted);
    // Borrado quirúrgico o brazo de yee (sin re-merge): los sobrevivientes quedan con
    // mergesFrom que referencian el id borrado — referencias fantasma que confunden un
    // re-merge futuro y las validaciones de split. Solo cuando el remerge NO corrió: si corrió,
    // él mismo reescribe las referencias.
    if (opts?.noMerge || wasYeeDoblePartSel) {
      for (const r of engine.ramales) {
        if (r.mergesFrom && r.mergesFrom.includes(deletedId)) r.mergesFrom = undefined;
      }
    }
    // Tributario borrado: si en alguno de sus extremos quedan EXACTAMENTE dos tributarios
    // tocándose (esquina huérfana de un split viejo), se fusionan en uno (orig. usuario:
    // borrar T1RS2 debía dejar un solo tributario, no T2RS1|T3RS1).
    if (deleted.tipo === 'tributario') {
      for (const ep of deleted.pts || []) mergeTribPairAt(engine, ep);
    }
    // Limpia las referencias al ramal borrado en los bajantes (alimentaIds TAMBIÉN: el id
    // stale en una caja hacía que el 2º ramal dibujado desde ella se rechazara/dibujara sin
    // recorte al borde — orig. usuario).
    for (const b of engine.bajantes) {
      if (b.recibeDeIds) {
        b.recibeDeIds = b.recibeDeIds.filter((r) => r !== deletedId);
      }
      if (b.alimentaIds) {
        b.alimentaIds = b.alimentaIds.filter((r) => r !== deletedId);
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
    // Purga DESPUÉS de remerge/fusiones (mueven conteos al sobreviviente) y antes de la
    // renumeración (que puede reasignar el id a otro trazo).
    purgarEstadoRamalesBorrados(engine, purgarIds);
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
    // Ids (bajante + Ldesvios) cuya clave de UDs/conteos debe purgarse del piso — la
    // renumeración reusa ids (BAN1) y el nuevo elemento no debe nacer con UDs viejas.
    const purgarIds = new Set<string>([deletedId]);
    // Si isFantasma=true, se trata como borrado del padre (limpia TODOS los niveles)
    if (!deleted.isFantasma && engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
      const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
      if (lDesvioId) {
        engine.ramales = engine.ramales.filter((r) => r.id !== lDesvioId);
        purgarEstadoRamalesBorrados(engine, [lDesvioId]);
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
          purgarIds.add(d.Ldesvio);
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
        if (splitPtr(other.descargaEnId, '')[1] === deletedId) other.descargaEnId = null;
      }
    }
    // Ítem 4: asociación explícita bajante↔canal por ID — al borrar el bajante se limpia la
    // referencia del canal (bajanteExternoId). Los ramales que atraviesan o ingresan al cuerpo
    // del canal NO se tocan: la asociación es por referencia, no por geometría.
    for (const c of engine.bajantes) {
      if (c.tipo === 'canal' && c.bajanteExternoId === deletedId) c.bajanteExternoId = null;
    }
    // Ítem 6 usuario: borrar UN canal (ruta individual) aplica la misma cascada que el
    // borrado en conjunto (caen sus ramales esCanalId, se nulan canalId) + compacta CNL1..N.
    // Sin esto el canal borrado dejaba ramales huérfanos y la numeración con huecos que el
    // allocator length+1 convertía en duplicados.
    if (deleted.tipo === 'canal') {
      const canalRamals = engine.ramales.filter((r) => r.esCanalId === deletedId);
      for (const r of canalRamals) purgarIds.add(r.id);
      engine.ramales = engine.ramales.filter((r) => r.esCanalId !== deletedId);
      for (const r of canalRamals) {
        if (r.pts?.length) cleanupJunctionsAfterRamalDelete(engine, r);
      }
      for (const b of engine.bajantes) {
        if (b.canalId === deletedId) b.canalId = null;
        if (b.recibeDeIds) {
          b.recibeDeIds = b.recibeDeIds.filter((rid) => !canalRamals.some((r) => r.id === rid));
        }
        if (b.alimentaIds) {
          b.alimentaIds = b.alimentaIds.filter((aid) => !canalRamals.some((r) => r.id === aid));
        }
      }
      if (canalRamals.length > 0) engine._renumberRamales('ll');
    }
    engine.bajantes.splice(idxB, 1);
    cascadeMontanteAssociation(engine, deleted);
    // BORRAR bomba: desasociar cualquier bajante que la referencie (cross-floor).
    if (deleted.tipo === 'bomba')
      desasociarBombaEnTrazos(deletedId, String(engine._loadedPlanId ?? ''));
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
    purgarEstadoRamalesBorrados(engine, purgarIds);
    if (deleted.tipo === 'canal') renumberCanales(engine);
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
    // PUNTO 4 (orig. usuario): borrar un área RENUMERA las restantes (compacta), igual que
    // ramales/tributarios.
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
