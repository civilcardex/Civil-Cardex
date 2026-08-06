import type { IPlanoEngineCore, PlanoBajante } from './PlanoState';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';
import {
  removeCrossFloorGhostsBySource,
  removeCrossFloorGhost,
  removeCrossFloorLdesvioRamal,
  deleteBajanteFromStorage,
} from '../../utils/associateBajanteAcrossFloors';
import { clearBajanteAssociation } from '../../utils/bajanteAssociation';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { HYDRO_DATA_STORAGE_KEY } from '../../constants/storage-keys';

interface HidroDataEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}

// The Aparatos sidebar (FixturesPanel.tsx/AccesoriosSection) keeps its own separate count of each
// tee glyph as an "accesorio" assigned to the host ramal (HYDRO_DATA_STORAGE_KEY, keyed
// `${net}_${ramalId}_${planId}`) — clearing the glyph field on the ramal object above doesn't
// touch that count, so the sidebar kept showing it as still assigned after the tee visually
// disappeared. Decrement it in lockstep.
function decrementAccesorioCount(
  engine: IPlanoEngineCore,
  hostR: { id: string; net: string },
  accType: string,
): void {
  const planId = engine._loadedPlanId;
  if (planId == null) return;
  const storageKey = `${hostR.net}_${hostR.id}_${planId}`;
  const map = loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {});
  const entry = map[storageKey];
  if (!entry?.accesorios?.[accType]) return;
  const next = entry.accesorios[accType] - 1;
  const nextAcc = { ...entry.accesorios };
  if (next <= 0) delete nextAcc[accType];
  else nextAcc[accType] = next;
  map[storageKey] = { ...entry, accesorios: nextAcc };
  saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
}

// A bajante/montante riser tied to another floor's via "Origen"/"Destino" is the same physical
// pipe continuing there — deleting one side's symbol while the other stays behind (still pointing
// at an id that no longer exists) makes no sense, so deleting either end cascades to remove the
// other too, wherever its floor's data lives. Applies to both bajante and montante.
function cascadeMontanteAssociation(engine: IPlanoEngineCore, deleted: PlanoBajante): void {
  if (deleted.tipo !== 'montante' && deleted.tipo !== 'bajante') return;
  const thisPlanId = String(engine._loadedPlanId ?? '');

  if (deleted.descargaEnId) {
    const [targetPlanId, targetBajanteId] = deleted.descargaEnId.includes('|')
      ? deleted.descargaEnId.split('|')
      : [thisPlanId, deleted.descargaEnId];
    if (targetPlanId && targetBajanteId) {
      removeCrossFloorGhost(targetPlanId, thisPlanId, deleted.id);
      removeCrossFloorLdesvioRamal(thisPlanId, deleted.id);
      if (targetPlanId === thisPlanId) {
        const t = engine.bajantes.find((b) => b.id === targetBajanteId);
        if (t?.tipo === 'montante' || t?.tipo === 'bajante') {
          engine.bajantes = engine.bajantes.filter((b) => b.id !== targetBajanteId);
        } else if (t) t.origenId = null;
      } else {
        deleteBajanteFromStorage(targetPlanId, targetBajanteId);
      }
    }
  }

  if (deleted.origenId) {
    const [originPlanId, originBajanteId] = deleted.origenId.includes('|')
      ? deleted.origenId.split('|')
      : [thisPlanId, deleted.origenId];
    if (originPlanId && originBajanteId) {
      removeCrossFloorGhost(thisPlanId, originPlanId, originBajanteId);
      removeCrossFloorLdesvioRamal(originPlanId, originBajanteId);
      if (originPlanId === thisPlanId) {
        const o = engine.bajantes.find((b) => b.id === originBajanteId);
        if (o?.tipo === 'montante' || o?.tipo === 'bajante') {
          engine.bajantes = engine.bajantes.filter((b) => b.id !== originBajanteId);
        } else if (o) o.descargaEnId = null;
      } else {
        deleteBajanteFromStorage(originPlanId, originBajanteId);
      }
    }
  }
}

const TEE_TYPES = [
  'teeDirecto',
  'teeSube',
  'teeBaja',
  'te_linea',
  'te_ramal',
  'teeReduccion',
  'teeLado',
];

// A tee marker (accesorioInicio/Fin or accMed) at a junction point outlives the ramal that formed
// that junction — deleting the OTHER branch of a T/Y left the remaining ramal's tee glyph/count
// sitting there with nothing actually connected anymore. Clears it, but only when the point isn't
// STILL a genuine tee junction. Counting just "any other ramal touches this point" was wrong on
// both sides: a split trunk's own two halves (existing + the auto-created downstream,
// mergesFrom-linked) always touch each other at the junction and would block the cleanup of a
// tee whose branch was deleted, while a plain end-to-end continuation (or a corner formed by two
// surviving ramals) would still count as "connected" and keep a tee glyph that no longer means
// anything. So the decision is geometric: group the surviving ramals at the point by line
// direction, and keep the tee only when a real branch relation still exists — a ramal that
// continues the host's own line together with at least one ramal leaving at an angle, or a
// non-collinear through-run pair (host as branch), or a bajante/montante at the point.
function junctionArmsAt(
  engine: IPlanoEngineCore,
  hostR: { id: string; pts: number[][]; mergesFrom?: string[] },
  pt: number[],
): {
  bajanteTouching: boolean;
  hasCollinearWithHost: boolean;
  hasNonCollinear: boolean;
  hasNonCollinearPair: boolean;
} {
  const TOL = 0.5;
  const DOT_TOL = 0.9;
  const norm = (v: number[]) => {
    const l = Math.hypot(v[0], v[1]);
    return l < 1e-6 ? null : ([v[0] / l, v[1] / l] as number[]);
  };
  const dirAt = (pts: number[][], p: number[]): number[] | null => {
    if (!pts || pts.length < 2) return null;
    const li = pts.length - 1;
    if (Math.hypot(pts[0][0] - p[0], pts[0][1] - p[1]) < TOL)
      return norm([pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]);
    if (Math.hypot(pts[li][0] - p[0], pts[li][1] - p[1]) < TOL)
      return norm([pts[li - 1][0] - pts[li][0], pts[li - 1][1] - pts[li][1]]);
    return null;
  };
  const hostLine = dirAt(hostR.pts, pt);
  const groups: number[][] = [];
  const sameLine = (a: number[], b: number[]) => Math.abs(a[0] * b[0] + a[1] * b[1]) >= DOT_TOL;
  let bajanteTouching = false;
  for (const b of engine.bajantes) {
    if (Math.hypot(b.x - pt[0], b.y - pt[1]) < TOL) {
      bajanteTouching = true;
      break;
    }
  }
  for (const other of engine.ramales) {
    if (other.id === hostR.id) continue;
    const d = dirAt(other.pts, pt);
    if (!d) continue;
    let found = -1;
    for (let i = 0; i < groups.length; i++) {
      if (sameLine(groups[i], d)) {
        found = i;
        break;
      }
    }
    if (found >= 0) {
      // keep the first representative direction for the group
    } else {
      groups.push(d);
    }
  }
  let hasCollinearWithHost = false;
  let hasNonCollinear = false;
  let hasNonCollinearPair = false;
  const dirAtMemberCount = (dir: number[]) => {
    let n = 0;
    for (const other of engine.ramales) {
      if (other.id === hostR.id) continue;
      const d = dirAt(other.pts, pt);
      if (d && sameLine(dir, d)) n++;
    }
    return n;
  };
  for (const g of groups) {
    const members = dirAtMemberCount(g);
    const coll = hostLine ? sameLine(g, hostLine) : false;
    if (coll) hasCollinearWithHost = true;
    else {
      hasNonCollinear = true;
      if (members >= 2) hasNonCollinearPair = true;
    }
  }
  return { bajanteTouching, hasCollinearWithHost, hasNonCollinear, hasNonCollinearPair };
}

function cleanupTeeMarkersAt(engine: IPlanoEngineCore, pt: number[]): void {
  const TOL = 0.5;
  for (const hostR of engine.ramales) {
    if (!hostR.pts?.length) continue;
    const arms = junctionArmsAt(engine, hostR, pt);
    // Endpoint marker (accesorioInicio/Fin): the host ends AT the point, so a tee requires a
    // genuine through-run — the host's own line continued by a collinear survivor PLUS a ramal
    // leaving at an angle, or a non-collinear pair of survivors (host itself is the branch), or
    // a bajante/montante at the point. A lone corner (one survivor, angled) is NOT a tee.
    const keepEndpoint =
      arms.bajanteTouching ||
      (arms.hasCollinearWithHost && arms.hasNonCollinear) ||
      arms.hasNonCollinearPair;
    // Interior marker (accMed): the host itself passes through the point, so ANY ramal leaving
    // at an angle (or a bajante/montante) keeps it a tee; only a collinear continuation alone
    // is a plain pass-through.
    const keepInterior = arms.bajanteTouching || arms.hasNonCollinear;

    if (
      hostR.accesorioInicio &&
      TEE_TYPES.includes(hostR.accesorioInicio) &&
      Math.hypot(hostR.pts[0][0] - pt[0], hostR.pts[0][1] - pt[1]) < TOL &&
      !keepEndpoint
    ) {
      decrementAccesorioCount(engine, hostR, hostR.accesorioInicio);
      hostR.accesorioInicio = '';
    }
    const li = hostR.pts.length - 1;
    if (
      hostR.accesorioFin &&
      TEE_TYPES.includes(hostR.accesorioFin) &&
      Math.hypot(hostR.pts[li][0] - pt[0], hostR.pts[li][1] - pt[1]) < TOL &&
      !keepEndpoint
    ) {
      decrementAccesorioCount(engine, hostR, hostR.accesorioFin);
      hostR.accesorioFin = '';
    }
    if (hostR.accMed) {
      for (const key of Object.keys(hostR.accMed)) {
        const m = key.match(/^accMed(\d+)$/);
        if (!m) continue;
        const idx = parseInt(m[1], 10);
        const p = hostR.pts[idx];
        if (
          p &&
          TEE_TYPES.includes(hostR.accMed[key]) &&
          Math.hypot(p[0] - pt[0], p[1] - pt[1]) < TOL &&
          !keepInterior
        ) {
          decrementAccesorioCount(engine, hostR, hostR.accMed[key]);
          delete hostR.accMed[key];
        }
      }
    }
  }
}

export function deleteSelected(engine: IPlanoEngineCore, ids?: string[]): void {
  if (ids && ids.length > 0) {
    engine._yeeFlashKey = null;
    const netsToRenumber = new Set<string>();
    const bajNetsToRenumber = new Set<string>();
    let renumberAreas = false;
    const deletedRamalIds = new Set<string>();
    for (const id of ids) {
      const idxR = engine.ramales.findIndex((r) => r.id === id);
      if (idxR >= 0) {
        const deleted = engine.ramales[idxR];
        deletedRamalIds.add(deleted.id);
        engine.ramales = engine.ramales.filter(
          (r) => r.id !== deleted.id && r.padre !== deleted.id,
        );
        if (deleted.pts?.length) {
          cleanupTeeMarkersAt(engine, deleted.pts[0]);
          cleanupTeeMarkersAt(engine, deleted.pts[deleted.pts.length - 1]);
        }
        netsToRenumber.add(deleted.net);
        // Clean up bajante references to deleted ramal
        for (const b of engine.bajantes) {
          if (b.recibeDeIds) {
            b.recibeDeIds = b.recibeDeIds.filter((rid) => rid !== deleted.id);
          }
          if (b.descargaEnId) {
            const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
            if (parts[parts.length - 1] === deleted.id) b.descargaEnId = null;
          }
          // If this ramal was the Ldesvio connector for a ghost displacement, the ghost
          // has no parent-facing pipe left — remove the displacement (and its ghost) too.
          if (b.desplazamientos) {
            for (const lvlKey of Object.keys(b.desplazamientos)) {
              if (b.desplazamientos[lvlKey].Ldesvio === deleted.id) {
                delete b.desplazamientos[lvlKey];
                if (b.ghostData) delete b.ghostData[lvlKey];
              }
            }
          }
        }
        continue;
      }
      const idxB = engine.bajantes.findIndex((b) => b.id === id);
      if (idxB >= 0) {
        const deleted: PlanoBajante = engine.bajantes[idxB];
        // Deleting a canal must detach its associated bajantes — otherwise their canalId keeps
        // pointing at a now-gone id (or worse, a future canal that happens to reuse it).
        if (deleted.tipo === 'canal') {
          for (const b of engine.bajantes) {
            if (b.canalId === deleted.id) b.canalId = null;
          }
        }
        const lvl = engine.nivelActual?.label ?? '';
        // When isFantasma=true, treat as parent delete (clean ALL levels)
        if (!deleted.isFantasma && engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
          const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
          if (lDesvioId) {
            engine.ramales = engine.ramales.filter((r) => r.id !== lDesvioId);
            netsToRenumber.add(deleted.net);
          }
          delete deleted.desplazamientos[lvl];
          if (deleted.ghostData) delete deleted.ghostData[lvl];
        } else {
          // Clean up Ldesvio ramales and ghost displacements
          if (deleted.desplazamientos) {
            for (const lvlKey of Object.keys(deleted.desplazamientos)) {
              const d = deleted.desplazamientos[lvlKey];
              if (d.Ldesvio) {
                engine.ramales = engine.ramales.filter((r) => r.id !== d.Ldesvio);
                netsToRenumber.add(deleted.net);
              }
            }
          }
          // Clean up references in other bajantes
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
          // A mid-body montante always wrote a tee marker (accMed) on its host ramal at creation
          // — deleting the montante without this left that tee glyph/count behind forever, since
          // nothing else ever revisits accMed once it's written.
          if (deleted.tipo === 'montante') cleanupTeeMarkersAt(engine, [deleted.x, deleted.y]);
          if (deleted.tipo === 'bajante') bajNetsToRenumber.add(deleted.net);
          else if (deleted.tipo === 'montante') bajNetsToRenumber.add('montante');
          else if (deleted.tipo === 'red_publica') bajNetsToRenumber.add('red_publica');
          else if (deleted.tipo === 'contador') bajNetsToRenumber.add('contador');
          // Clean up cross-floor ghosts on other floors referencing this bajante
          if (engine._loadedPlanId != null)
            removeCrossFloorGhostsBySource(engine._loadedPlanId, deleted.id);
        }
        continue;
      }
      const idxGhost = engine.crossFloorGhosts.findIndex((g) => g.id === id);
      if (idxGhost >= 0) {
        const g = engine.crossFloorGhosts[idxGhost];
        // A ghost is the visual half of a cross-floor link — deleting it must tear the WHOLE
        // link down: the reverse origenId pointer on the target floor, the source's own
        // desplazamiento (with its Ldesvio ramal), and the ghost itself on storage. The target
        // floor is the one currently loaded (ghosts only render there), so clearBajanteAssociation
        // fixes the live engine state too. `plans` is not available at engine level: the target's
        // origenId null lands in storage wholesale via the normal dirty→save flow, and the synced
        // drawing cache rebuilds on the next syncDrawings pass.
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
    engine.ramales = engine.ramales.filter((r) => r.id !== deletedId && r.padre !== deleted.id);
    if (deleted.pts?.length) {
      cleanupTeeMarkersAt(engine, deleted.pts[0]);
      cleanupTeeMarkersAt(engine, deleted.pts[deleted.pts.length - 1]);
    }
    // Clean up bajante references to deleted ramal
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
            delete b.desplazamientos[lvlKey];
            if (b.ghostData) delete b.ghostData[lvlKey];
          }
        }
      }
    }
    engine._renumberRamales(deleted.net);
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
    // When isFantasma=true, treat as parent delete (clean ALL levels)
    if (!deleted.isFantasma && engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
      const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
      if (lDesvioId) {
        engine.ramales = engine.ramales.filter((r) => r.id !== lDesvioId);
        engine._renumberRamales(deleted.net);
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
    // Delete parent bajante: also clean up any Ldesvio ramales and ghost displacements
    if (deleted.desplazamientos) {
      for (const lvlKey of Object.keys(deleted.desplazamientos)) {
        const d = deleted.desplazamientos[lvlKey];
        if (d.Ldesvio) {
          engine.ramales = engine.ramales.filter((r) => r.id !== d.Ldesvio);
          engine._renumberRamales(deleted.net);
        }
      }
    }
    // Clean up references in other bajantes' recibeDeIds and descargaEnId
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
    engine.bajantes.splice(idxB, 1);
    cascadeMontanteAssociation(engine, deleted);
    if (deleted.tipo === 'bajante') {
      engine._renumberBajantes(deleted.net);
    } else if (deleted.tipo === 'montante') {
      // A mid-body montante always wrote a tee marker (accMed) on its host ramal at creation —
      // deleting the montante without this left that tee glyph/count behind forever.
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
    // Clean up cross-floor ghosts on other floors referencing this bajante
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
