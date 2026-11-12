/** Borrado de RAMALES en deleteSelected: la rama del recorrido en conjunto (el id cae en
 *  engine.ramales) y la ruta individual (el seleccionado vivo). Ambas limpian las referencias
 *  del ramal en los bajantes (recibeDeIds/alimentaIds/descargaEnId/desplazamientos), re-únen
 *  las mitades de una división y purgan su estado de UDs. Ej: borrar un LDesvio individual
 *  limpia su puntero en el bajante origen y mata el anillo del piso de abajo. */
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { splitPtr } from '../../../utils/keys.ts';
import {
  removeCrossFloorGhostsBySource,
  isLdesvioRamalId,
} from '../../../utils/associateBajanteAcrossFloors';
import { clearBajanteAssociation } from '../../../utils/bajanteAssociation';
import { purgarEstadoRamalesBorrados } from '../deleteCascade.ts';
import { cleanupJunctionsAfterRamalDelete } from '../deleteJunctionCleanup.ts';
import { mergeTribPairAt, mergeTouchingRemnant, remergeSplitRamales } from '../deleteRemerge.ts';
import {
  isDeletedYeeDoblePart,
  preserveYeeDobleAt,
  splitMembersFor,
} from '../deleteYeePreserve.ts';
import { reassignTributariosToHermano } from '../deleteHelpers.ts';
import { limpiarPunterosDeEnlace } from './crossFloorLinks.ts';
import type { CtxBorradoConjunto, DeleteSelectedFn, OptsBorrado } from './ctx.ts';

/** Rama de RAMAL del borrado EN CONJUNTO: quita el ramal, re-une sus mitades de división,
 *  limpia las referencias en los bajantes y apunta fantasmas/redes para el barrido final del
 *  pipeline. Ej: borrar RS1 y T1RS2 juntos reasigna lo que T1RS2 alimentaba y renumera RS. */
export function borrarRamalEnConjunto(ctx: CtxBorradoConjunto, deleted: PlanoRamal): void {
  const { engine, opts, deletedRamalIds, deletedPts, netsToRenumber, ghostSourcesABorrar } = ctx;
  deletedRamalIds.add(deleted.id);
  if (deleted.pts) for (const p of deleted.pts) deletedPts.push(p);
  const wasYeeDoblePart = isDeletedYeeDoblePart(engine, deleted);
  const isDivisor = engine.ramales.some((r) => r.mergesFrom && r.mergesFrom[1] === deleted.id);
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
      const parts = splitPtr(b.descargaEnId, engine._loadedPlanId);
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
            // Inline a propósito (no va al batch): el clearBajanteAssociation de abajo lee
            // estos fantasmas YA borrados (resolveLinkRoles) — diferir el barrido le
            // mostraría el ghost vivo y cambiaría la rama de la desasociación.
            removeCrossFloorGhostsBySource(engine._loadedPlanId, sourceBajanteId);
            // El Ldesvio ERA el carrier del enlace entre pisos: al borrarlo, el enlace se
            // desasocia y el original vuelve a mostrar "sin origen" (antes el puntero
            // sobrevivia y el desplegable seguía apuntando a un origen fantasma).
            // El extremo de ARRIBA es el que guarda la descargaEnId; el de abajo, el
            // origenId (este `b`).
            const arriba = splitPtr(b.origenId ?? '', '');
            if (arriba[0] && arriba[1]) {
              limpiarPunterosDeEnlace(
                engine,
                { planId: arriba[0], id: arriba[1] },
                { planId: String(engine._loadedPlanId ?? ''), id: b.id },
              );
              clearBajanteAssociation(
                engine,
                arriba[0],
                arriba[1],
                b.net,
                `${String(engine._loadedPlanId ?? '')}|${b.id}`,
                [],
              );
            }
          }
        }
      }
    }
  }
  // Ldesvio borrado directamente (sin desplazamiento asociado) — limpiar fantasmas huérfanos
  if (isLdesvioRamalId(deleted.id)) {
    ghostSourcesABorrar.add(deleted.id.slice(3));
  }
}

/** Ruta INDIVIDUAL de ramal (el seleccionado vivo): si el ramal es mitad de una división,
 *  borra TODA la división re-disparando deleteSelected con el lote expandido; si no, borra
 *  solo él — reasigna tributarios al hermano, re-une mitades, funde esquinas huérfanas,
 *  limpia referencias en bajantes y recalcula el contador de ramales de la red. */
export function borrarRamalIndividual(
  engine: IPlanoEngineCore,
  deleted: PlanoRamal,
  opts: OptsBorrado | undefined,
  deleteSelected: DeleteSelectedFn,
): void {
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
      const parts = splitPtr(b.descargaEnId, engine._loadedPlanId);
      if (parts[parts.length - 1] === deletedId) b.descargaEnId = null;
    }
    if (b.desplazamientos) {
      for (const lvlKey of Object.keys(b.desplazamientos)) {
        if (b.desplazamientos[lvlKey].Ldesvio === deletedId) {
          const sourceBajanteId = b.id;
          delete b.desplazamientos[lvlKey];
          if (b.ghostData) delete b.ghostData[lvlKey];
          if (isLdesvioRamalId(deletedId)) {
            // Inline a propósito (no va al batch): el clear de abajo lee estos fantasmas YA
            // borrados (resolveLinkRoles) — diferirlo cambiaría la rama de la desasociación.
            removeCrossFloorGhostsBySource(engine._loadedPlanId, sourceBajanteId);
            // Mismo desenlace que el borrado en conjunto: el Ldesvio ERA el carrier del
            // enlace entre pisos — sin esto el origenId del original sobrevivía y su
            // desplegable de origen seguía apuntando a un origen fantasma (orig. usuario).
            const arriba = splitPtr(b.origenId ?? '', '');
            if (arriba[0] && arriba[1]) {
              limpiarPunterosDeEnlace(
                engine,
                { planId: arriba[0], id: arriba[1] },
                { planId: String(engine._loadedPlanId ?? ''), id: b.id },
              );
              clearBajanteAssociation(
                engine,
                arriba[0],
                arriba[1],
                b.net,
                `${String(engine._loadedPlanId ?? '')}|${b.id}`,
                [],
              );
            }
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
}
