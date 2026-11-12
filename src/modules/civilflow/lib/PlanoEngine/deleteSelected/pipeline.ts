/** Pipeline del borrado de la selección (deleteSelected): decide la ruta, expande la red
 *  conectada a borrar, recorre los ids delegando por TIPO de elemento (ramal/bajante/
 *  fantasma/anotación) y ejecuta los barridos finales UNA vez — fantasmas entre pisos en
 *  batch, purga de estado, fusiones de restos y renumeración. Ej: deleteSelected(engine) tras
 *  Supr borra el ramal, sus tributarios se reasignan al hermano y los junction markers
 *  quedan limpios. */
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { _midpoint } from '../PlanoEngineDrawing.ts';
import { removeCrossFloorGhostsBySourceBatch } from '../../../utils/associateBajanteAcrossFloors';
import { purgarEstadoRamalesBorrados } from '../deleteCascade.ts';
import { mergeTouchingRemnant } from '../deleteRemerge.ts';
import { renumberCanales } from '../deleteHelpers.ts';
import { distToPolyline } from '../../shared/geometry';
import { indiceBajanteDePiso, borrarFantasmaEnlaceEnConjunto } from './crossFloorLinks.ts';
import { borrarRamalEnConjunto, borrarRamalIndividual } from './deleteRamales.ts';
import { borrarBajanteEnConjunto, borrarBajanteIndividual } from './deleteBajantes.ts';
import {
  borrarTextoIndividual,
  borrarAreaIndividual,
  borrarDimIndividual,
  borrarGuiaIndividual,
} from './deleteAnnotations.ts';
import type { CtxBorradoConjunto } from './ctx.ts';

/** Borra la selección con cascada (limpia fantasmas y renumera las redes tocadas). Con `ids`
 *  borra ese lote; sin ellos, la selección viva. Ej: deleteSelected(engine) tras Supr borra el
 *  ramal, sus tributarios se reasignan al hermano y los junction markers quedan limpios. */
export function deleteSelected(
  engine: IPlanoEngineCore,
  ids?: string[],
  opts?: { noMerge?: boolean },
): void {
  if (ids && ids.length > 0) {
    engine._yeeFlashKey = null;
    const ctx: CtxBorradoConjunto = {
      engine,
      opts,
      toDelete: new Set<string>(ids),
      deletedRamalIds: new Set<string>(),
      ghostSourcesABorrar: new Set<string>(),
      deletedPts: [],
      netsToRenumber: new Set<string>(),
      bajNetsToRenumber: new Set<string>(),
      flags: { renumberAreas: false, renumberCanalesNeeded: false },
    };
    const { toDelete } = ctx;
    // Borrado en conjunto (orig. usuario): caen los TRIBUTARIOS que llegan a lo seleccionado
    // (transitivamente: un tributario puede recibir a otro) y los colgantes por `padre`.
    // Los RAMALES tronco tocados NO caen (RS1/RS3 sobreviven al borrar laterales — imagen 1).
    // SIN splitMembersFor: en la maraña casi todo son mitades de splits encadenados
    // (mergesFrom) y esa expansión arrastraba el tronco entero.
    {
      let grew = true;
      // Índice de los ramales que se van borrando: el .some por cada tributario recorreba
      // TODOS los ramales (O(n²) por pasada, y el while repite la pasada).
      const borradosPorId = new Map<string, PlanoRamal>();
      while (grew) {
        grew = false;
        for (const r of engine.ramales) {
          if (toDelete.has(r.id) || r.tipo !== 'tributario' || !r.pts || r.pts.length < 2) continue;
          const dest = r._tribReversed ? r.pts[0] : r.pts[r.pts.length - 1];
          const feeds = [...borradosPorId.values()].some(
            (p) => p.pts && p.pts.length >= 2 && distToPolyline(dest, p.pts) < 0.5,
          );
          if (feeds || (r.padre && toDelete.has(r.padre))) {
            toDelete.add(r.id);
            borradosPorId.set(r.id, r);
            grew = true;
          }
        }
      }
      // Los ramales que ya estaban en toDelete (seleccionados) también alimentan a otros.
      for (const r of engine.ramales) {
        if (toDelete.has(r.id) && !borradosPorId.has(r.id)) borradosPorId.set(r.id, r);
      }
    }
    // Fantasmas XFG a limpiar en otros pisos por TODOS los borrados de la rama: se acumulan y
    // salen en UN solo barrido batch tras el bucle (antes: 1 barrido completo por elemento).
    for (const id of toDelete) {
      const idxR = engine.ramales.findIndex((r) => r.id === id);
      if (idxR >= 0) {
        borrarRamalEnConjunto(ctx, engine.ramales[idxR]);
        continue;
      }
      const idxB = indiceBajanteDePiso(engine, id);
      if (idxB >= 0) {
        borrarBajanteEnConjunto(ctx, engine.bajantes[idxB], idxB);
        continue;
      }
      const idxGhost = engine.crossFloorGhosts.findIndex((g) => g.id === id);
      if (idxGhost >= 0) {
        borrarFantasmaEnlaceEnConjunto(engine, engine.crossFloorGhosts[idxGhost], id);
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
        ctx.flags.renumberAreas = true;
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
    // Fantasmas de TODOS los borrados de la rama en UN solo barrido (H-6), ANTES del renumerado
    // (que renombra sourceBajanteId de ghosts vivos — el batch debe ganarle). Seguro: entre el
    // bucle y aquí nadie lee crossFloorGhosts (los clear que leen corrieron con su inline).
    if (ctx.ghostSourcesABorrar.size > 0)
      removeCrossFloorGhostsBySourceBatch(engine._loadedPlanId, [...ctx.ghostSourcesABorrar]);
    // Yee doble desarmada (orig. usuario): los brazos restantes que quedan tocándose en un
    // punto donde HABÍA un brazo borrado (grado 2) se funden en UN ramal (aunque formen
    // esquina) — el trazo restante queda como uno solo.
    if (!opts?.noMerge) mergeTouchingRemnant(engine, ctx.deletedPts);
    // Purga DESPUÉS de remerge/fusiones (mueven conteos al sobreviviente) y antes de la
    // renumeración (que puede reasignar el id a otro trazo).
    purgarEstadoRamalesBorrados(engine, ctx.deletedRamalIds);
    for (const net of ctx.netsToRenumber) engine._renumberRamales(net);
    if (ctx.flags.renumberAreas) engine._renumberAreas();
    if (ctx.flags.renumberCanalesNeeded) renumberCanales(engine);
    for (const net of ctx.bajNetsToRenumber) {
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
    // Ítem 9/v2 incluido: si el ramal es mitad de una división, borrarRamalIndividual
    // re-dispara deleteSelected con el lote expandido (mismo single-camino que antes).
    borrarRamalIndividual(engine, engine.ramales[idxR], opts, deleteSelected);
    return;
  }
  // Se borra el bajante del PISO ABIERTO (mismo criterio que la ruta multi-selección arriba).
  const idxB = indiceBajanteDePiso(engine, engine.selId ?? '');
  if (idxB >= 0) {
    borrarBajanteIndividual(engine, engine.bajantes[idxB], idxB);
    return;
  }
  if (borrarTextoIndividual(engine)) return;
  if (borrarAreaIndividual(engine)) return;
  if (borrarDimIndividual(engine)) return;
  if (borrarGuiaIndividual(engine)) return;
}
