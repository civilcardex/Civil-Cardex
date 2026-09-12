/**
 * Gestión de bajantes/montantes entre pisos (ghosts, Ldesvíos, asociaciones cross-floor).
 * Fachada del módulo: re-exporta el núcleo de E/S (`crossFloorStorage`) y agrega los
 * actualizadores que opera el engine (arrastres, renombres). Cada bajante físico es un tubo
 * continuo; en cada plano vive un ghost que referencia origen↔destino y un ramal Ldesvío para
 * el desplazamiento en planta. La migración/barrido del layout vive en `assocLayoutMigration`.
 */
import {
  loadData,
  saveData,
  ldesvioIdFor,
  buildLdesvioRamal,
  type LocalGhostDrawingData,
} from './crossFloorStorage';
import { TRAZOS_PLAN_PREFIX } from '../constants/storage-keys';

export type { CrossFloorGhost } from '../lib/shared/crossFloorGhostTypes';
export { enrichCrossFloorGhosts } from './crossFloorGhosts';

// Núcleo de E/S re-exportado: los ~20 consumidores existentes no cambian de ruta de import.
export {
  loadData,
  saveData,
  writeCrossFloorGhost,
  removeCrossFloorGhost,
  removeCrossFloorGhostsBySource,
  ldesvioIdFor,
  isLdesvioRamalId,
  nextRamalLabel,
  buildLdesvioRamal,
  createCrossFloorLdesvioRamal,
  removeCrossFloorLdesvioRamal,
  updateCrossFloorGhostFieldBySource,
  updateCrossFloorGhostPositionBySource,
  type LocalLdesvioRamal,
  type StoredBajante,
  type LocalGhostDrawingData,
} from './crossFloorStorage';

// Layout nuevo: actualiza el punto INICIAL (pts[0], la posición del bajante SUPERIOR) del
// Ldesvio que vive en el piso INFERIOR — se llama cuando se arrastra el bajante superior (ese
// piso está cargado; el del Ldesvio, no, así que va directo a storage).
export function updateCrossFloorLdesvioStartPoint(
  planId: string | number,
  upperBajanteId: string,
  x: number,
  y: number,
): void {
  const data = loadData(planId);
  const id = ldesvioIdFor(upperBajanteId);
  const idx = (data.ramales || []).findIndex((r) => r.id === id);
  if (idx === -1) return;
  const r = data.ramales![idx];
  const [x2, y2] = r.pts[r.pts.length - 1];
  if (Math.abs(r.pts[0][0] - x) < 0.01 && Math.abs(r.pts[0][1] - y) < 0.01) return;
  data.ramales![idx] = buildLdesvioRamal(
    id,
    r.label || id,
    r.net,
    x,
    y,
    x2,
    y2,
    r.diametro,
    Number(r.piso) || 0,
    data.scaleM || 0.5,
    r.bloqueado,
  );
  saveData(planId, data);
}

// Layout nuevo: re-ancla el anillo (desplazamientos) del bajante portador (`holderBajanteId`,
// el inferior) para que siga apuntando al ancla (x,y) — el anillo se dibuja en b.x+dx, así que
// dx = ancla − posición del portador. El conector se identifica por `ldId` (el id del bajante
// superior), no por el id del portador. Escritura directa a storage del piso del portador.
export function updateCrossFloorDesplazamientoAnchor(
  planId: string | number,
  holderBajanteId: string,
  ldId: string,
  anchorX: number,
  anchorY: number,
): void {
  const data = loadData(planId);
  if (!data.bajantes?.length) return;
  const b = data.bajantes.find((x) => x.id === holderBajanteId);
  if (!b?.desplazamientos) return;
  let changed = false;
  const desp = { ...b.desplazamientos };
  for (const lvlKey of Object.keys(desp)) {
    if (desp[lvlKey]?.Ldesvio === ldId) {
      desp[lvlKey] = {
        ...desp[lvlKey],
        dx: anchorX - (b.x ?? 0),
        dy: anchorY - (b.y ?? 0),
      };
      changed = true;
    }
  }
  if (!changed) return;
  b.desplazamientos = desp;
  saveData(planId, data);
}

// El id/código de un bajante se reescribe cuandoquiera que corre _renumberBajantes
// (networkRenumber.ts) — p. ej. después de borrar CUALQUIER bajante de la misma red/piso, cerrando
// el hueco de numeración. Toda referencia cruzada entre pisos se ancla en ese id (el id del ramal
// Ldesvio es `LD_<id>`, el `sourceBajanteId`/`targetBajanteId` del fantasma espejo, y el puntero
// `descargaEnId`/`origenId` del otro lado, formato `${planId}|${id}`) — nada de eso se actualiza
// con el rename simple, así que un bajante renumerado que tenía una asociación entre pisos
// activa deja huérfano su propio Ldesvio/fantasma para siempre: toda búsqueda posterior
// (incluida la desasociación) calcula la clave con el id ACTUAL del bajante y simplemente nunca
// encuentra el viejo, así que nunca se limpia.
// Se llama una vez por id cambiado, justo después del rename, desde _renumberBajantes.
export function renameBajanteAcrossFloorReferences(
  thisPlanId: string,
  oldId: string,
  newId: string,
): void {
  if (oldId === newId) return;
  const oldLd = ldesvioIdFor(oldId);
  const newLd = ldesvioIdFor(newId);
  const oldPointer = `${thisPlanId}|${oldId}`;
  const newPointer = `${thisPlanId}|${newId}`;

  // Almacenamiento del piso propio: el ramal Ldesvio (si este bajante es origen entre pisos), la
  // auto-referencia de desplazamientos que lo acompaña, y cualquier extremo de ramal (ini/fin)
  // que todavía tenga el código viejo.
  const own = loadData(thisPlanId);
  let ownDirty = false;
  for (const r of own.ramales || []) {
    if (r.id === oldLd) {
      r.id = newLd;
      ownDirty = true;
    }
    if (r.ini === oldId) {
      r.ini = newId;
      ownDirty = true;
    }
    if (r.fin === oldId) {
      r.fin = newId;
      ownDirty = true;
    }
  }
  for (const b of own.bajantes || []) {
    if (!b.desplazamientos) continue;
    for (const lvlKey of Object.keys(b.desplazamientos)) {
      if (b.desplazamientos[lvlKey]?.Ldesvio === oldLd) {
        b.desplazamientos[lvlKey] = { ...b.desplazamientos[lvlKey], Ldesvio: newLd };
        ownDirty = true;
      }
    }
  }
  // Fantasmas del piso propio cuyo DESTINO es este bajante (el target vive en el mismo piso
  // que el ghost — ver applyBajanteAssociation): siguen al renombre local.
  for (const g of own.crossFloorGhosts || []) {
    if (g.targetBajanteId === oldId) {
      g.targetBajanteId = newId;
      ownDirty = true;
    }
  }
  if (ownDirty) saveData(thisPlanId, own);

  // Almacenamiento de cualquier otro piso: el fantasma espejo que este bajante escribió (como
  // origen) — id y sourceBajanteId — y cualquier puntero descargaEnId/origenId apuntando a
  // `${thisPlanId}|${oldId}` (cubre a este bajante como destino de descarga del origen de otro
  // piso, o como origen al que el destino de otro piso apunta de vuelta).
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const otherPlanId = k.slice(TRAZOS_PLAN_PREFIX.length);
    if (otherPlanId === thisPlanId) continue;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const data = JSON.parse(raw) as LocalGhostDrawingData;
      let dirty = false;
      for (const g of data.crossFloorGhosts || []) {
        if (g.sourcePlanId === thisPlanId && g.sourceBajanteId === oldId) {
          g.sourceBajanteId = newId;
          g.id = `XFG_${newId}_${thisPlanId}`;
          dirty = true;
        }
        // El targetBajanteId de un ghost vive en el MISMO piso que el ghost: un ghost de OTRO
        // piso nunca apunta aquí (reescribirlo por id pelado rompía enlaces cruzados que
        // comparten id en otro piso: BAN1-P1↔BAN2-P2 + BAN1-P2↔BAN2-P1). El propio se cubre
        // en el bloque `own` de arriba.
      }
      for (const b of data.bajantes || []) {
        if (b.descargaEnId === oldPointer) {
          b.descargaEnId = newPointer;
          dirty = true;
        }
        if (b.origenId === oldPointer) {
          b.origenId = newPointer;
          dirty = true;
        }
      }
      if (dirty) saveData(otherPlanId, data);
    } catch {
      continue;
    }
  }
}
