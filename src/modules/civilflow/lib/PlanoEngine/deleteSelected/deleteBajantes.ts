/** Borrado de BAJANTES (y canales/montantes/bombas, que viven en el mismo arreglo) en
 *  deleteSelected: la rama del recorrido en conjunto y la ruta individual. Limpia
 *  desplazamientos fantasma y sus Ldesvios, las referencias recibeDeIds/descargaEnId de
 *  otros bajantes, la asociación bajante↔canal y renumera por tipo. Ej: borrar un canal
 *  arrastra sus ramales esCanalId y compacta CNL1..N. */
import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState.ts';
import { splitPtr } from '../../../utils/keys.ts';
import { removeCrossFloorGhostsBySource } from '../../../utils/associateBajanteAcrossFloors';
import { cascadeMontanteAssociation, purgarEstadoRamalesBorrados } from '../deleteCascade.ts';
import { desasociarBombaEnTrazos } from '../../../utils/pumpAssociation';
import { cleanupJunctionsAfterRamalDelete, cleanupTeeMarkersAt } from '../deleteJunctionCleanup.ts';
import { renumberCanales } from '../deleteHelpers.ts';
import { desasociarPorBajante } from './crossFloorLinks.ts';
import type { CtxBorradoConjunto } from './ctx.ts';

/** Rama de BAJANTE del borrado EN CONJUNTO: si es un canal, sus ramales caen con él (se
 *  añaden a ctx.toDelete y el MISMO recorrido los procesa como ramal); si es un bajante con
 *  desplazamiento fantasma seleccionado, solo baja el desplazamiento del piso; si no, se
 *  borra el cuerpo completo con cascada y banderas de renumeración. */
export function borrarBajanteEnConjunto(
  ctx: CtxBorradoConjunto,
  deleted: PlanoBajante,
  idxB: number,
): void {
  const {
    engine,
    toDelete,
    deletedRamalIds,
    ghostSourcesABorrar,
    netsToRenumber,
    bajNetsToRenumber,
    flags,
  } = ctx;
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
    // Borrar el FANTASMA (el anillo del bajante de otro piso) tumba el enlace: el
    // bajante original debe volver a mostrar "Sin origen" (orig. usuario). El puntero
    // del otro extremo (origenId/descargaEnId) se anula en los dos pisos.
    desasociarPorBajante(engine, deleted);
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
    else if (deleted.tipo === 'canal') flags.renumberCanalesNeeded = true;
    // Limpia los fantasmas entre pisos de OTROS pisos que referencian este bajante
    ghostSourcesABorrar.add(deleted.id);
  }
}

/** Ruta INDIVIDUAL de bajante (el seleccionado vivo): con desplazamiento fantasma
 *  seleccionado solo baja el desplazamiento del piso actual; si no, borra el cuerpo con la
 *  cascada completa — Ldesvios, referencias cruzadas, canal (sus ramales esCanalId caen y
 *  compacta CNL1..N), bomba, marcadores de tee de montante — y renumera por tipo. */
export function borrarBajanteIndividual(
  engine: IPlanoEngineCore,
  deleted: PlanoBajante,
  idxB: number,
): void {
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
    // Borrar el anillo del fantasma tumba el enlace: el original del otro piso debe
    // volver a "Sin origen" (espejo exacto de la ruta de borrado en conjunto).
    desasociarPorBajante(engine, deleted);
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
    // Renumera TAMBIÉN el borrado individual (orig. usuario: "no se dispara tan pronto
    // borro") — el camino en conjunto ya lo hacía y el individual dejaba el hueco.
    engine._renumberBajantes(deleted.net);
  } else if (deleted.tipo === 'montante') {
    // Un montante a mitad de cuerpo siempre escribió un marcador de tee (accMed) en su ramal
    // huésped al crearse — borrarlo sin esto dejaba ese glifo/conteo para siempre.
    cleanupTeeMarkersAt(engine, [deleted.x, deleted.y]);
    engine._renumberMontantes();
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
}
