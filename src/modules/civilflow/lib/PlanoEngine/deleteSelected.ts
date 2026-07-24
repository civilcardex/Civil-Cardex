import type { IPlanoEngineCore, PlanoBajante } from './PlanoState';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';

const TEE_TYPES = ['teeDirecto', 'teeSube', 'teeBaja', 'te_linea', 'te_ramal'];

// A tee marker (accesorioInicio/Fin or accMed) at a junction point outlives the ramal that formed
// that junction — deleting the OTHER branch of a T/Y left the remaining ramal's tee glyph/count
// sitting there with nothing actually connected anymore. Clears it, but only when NOTHING else
// (another ramal's endpoint, or a montante bajante — mid-body montante creation writes this same
// marker) still touches that exact point, so a legitimately-still-junctioned tee is untouched.
function cleanupTeeMarkersAt(engine: IPlanoEngineCore, pt: number[]): void {
  const TOL = 0.5;
  for (const hostR of engine.ramales) {
    if (!hostR.pts?.length) continue;
    const stillConnected =
      engine.ramales.some((other) => other.id !== hostR.id && other.pts?.some(([x, y]) => Math.hypot(x - pt[0], y - pt[1]) < TOL)) ||
      engine.bajantes.some((b) => Math.hypot(b.x - pt[0], b.y - pt[1]) < TOL);
    if (stillConnected) continue;

    if (hostR.accesorioInicio && TEE_TYPES.includes(hostR.accesorioInicio) && Math.hypot(hostR.pts[0][0] - pt[0], hostR.pts[0][1] - pt[1]) < TOL) {
      hostR.accesorioInicio = '';
    }
    const li = hostR.pts.length - 1;
    if (hostR.accesorioFin && TEE_TYPES.includes(hostR.accesorioFin) && Math.hypot(hostR.pts[li][0] - pt[0], hostR.pts[li][1] - pt[1]) < TOL) {
      hostR.accesorioFin = '';
    }
    if (hostR.accMed) {
      for (const key of Object.keys(hostR.accMed)) {
        const m = key.match(/^accMed(\d+)$/);
        if (!m) continue;
        const idx = parseInt(m[1], 10);
        const p = hostR.pts[idx];
        if (p && TEE_TYPES.includes(hostR.accMed[key]) && Math.hypot(p[0] - pt[0], p[1] - pt[1]) < TOL) {
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
    for (const id of ids) {
      const idxR = engine.ramales.findIndex(r => r.id === id);
      if (idxR >= 0) {
        const deleted = engine.ramales[idxR];
        engine.ramales = engine.ramales.filter(r => r.id !== deleted.id && r.padre !== deleted.id);
        if (deleted.pts?.length) {
          cleanupTeeMarkersAt(engine, deleted.pts[0]);
          cleanupTeeMarkersAt(engine, deleted.pts[deleted.pts.length - 1]);
        }
        netsToRenumber.add(deleted.net);
        // Clean up bajante references to deleted ramal
        for (const b of engine.bajantes) {
          if (b.recibeDeIds) {
            b.recibeDeIds = b.recibeDeIds.filter(rid => rid !== deleted.id);
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
      const idxB = engine.bajantes.findIndex(b => b.id === id);
      if (idxB >= 0) {
        const deleted: PlanoBajante = engine.bajantes[idxB];
        const lvl = engine.nivelActual?.label ?? '';
        // When isFantasma=true, treat as parent delete (clean ALL levels)
        if (!deleted.isFantasma && engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
          const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
          if (lDesvioId) {
            engine.ramales = engine.ramales.filter(r => r.id !== lDesvioId);
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
                engine.ramales = engine.ramales.filter(r => r.id !== d.Ldesvio);
                netsToRenumber.add(deleted.net);
              }
            }
          }
          // Clean up references in other bajantes
          for (const other of engine.bajantes) {
            if (other.recibeDeIds) {
              other.recibeDeIds = other.recibeDeIds.filter(rid => rid !== deleted.id);
            }
            if (other.descargaEnId === deleted.id) {
              other.descargaEnId = null;
            } else if (other.descargaEnId?.includes('|')) {
              const parts = other.descargaEnId.split('|');
              if (parts[1] === deleted.id) other.descargaEnId = null;
            }
          }
          engine.bajantes.splice(idxB, 1);
          if (deleted.tipo === 'bajante') bajNetsToRenumber.add(deleted.net);
          else if (deleted.tipo === 'montante') bajNetsToRenumber.add('montante');
          else if (deleted.tipo === 'red_publica') bajNetsToRenumber.add('red_publica');
          else if (deleted.tipo === 'contador') bajNetsToRenumber.add('contador');
        }
        continue;
      }
      const idxT = engine.textAnnots.findIndex(t => t.id === id);
      if (idxT >= 0) { engine.textAnnots.splice(idxT, 1); continue; }
      const idxA = engine.areas.findIndex(a => a.id === id);
      if (idxA >= 0) { engine.areas.splice(idxA, 1); renumberAreas = true; continue; }
      const idxD = engine.dims.findIndex(d => d.id === id);
      if (idxD >= 0) { engine.dims.splice(idxD, 1); continue; }
    }
    for (const net of netsToRenumber) engine._renumberRamales(net);
    for (const net of bajNetsToRenumber) {
      if (net === 'montante') engine._renumberMontantes();
      else if (net === 'red_publica') {
        const rps = engine.bajantes.filter(b => b.tipo === 'red_publica');
        rps.forEach((b, i) => { b.id = 'RP' + (i + 1); b.code = 'RP' + (i + 1); });
      }
      else if (net === 'contador') {
        const cnts = engine.bajantes.filter(b => b.tipo === 'contador');
        cnts.forEach((b, i) => { const pfx = b.net === 'gas' ? 'CTNG' : 'CNTAF'; b.id = pfx + (i + 1); b.code = pfx + (i + 1); });
      }
      else engine._renumberBajantes(net);
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
  const idxR = engine.ramales.findIndex(r => r.id === engine.selId);
  if (idxR >= 0) {
    const deleted = engine.ramales[idxR];
    const deletedId = deleted.id;
    engine.ramales = engine.ramales.filter(r => r.id !== deleted.id && r.padre !== deleted.id);
    if (deleted.pts?.length) {
      cleanupTeeMarkersAt(engine, deleted.pts[0]);
      cleanupTeeMarkersAt(engine, deleted.pts[deleted.pts.length - 1]);
    }
    // Clean up bajante references to deleted ramal
    for (const b of engine.bajantes) {
      if (b.recibeDeIds) {
        b.recibeDeIds = b.recibeDeIds.filter(rid => rid !== deletedId);
      }
      if (b.descargaEnId) {
        const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
        if (parts[parts.length - 1] === deletedId) b.descargaEnId = null;
      }
      // If this ramal was the Ldesvio connector for a ghost displacement, the ghost
      // has no parent-facing pipe left — remove the displacement (and its ghost) too.
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
  const idxB = engine.bajantes.findIndex(b => b.id === engine.selId);
  if (idxB >= 0) { 
    const deleted: PlanoBajante = engine.bajantes[idxB];
    const deletedId = deleted.id;
    const lvl = engine.nivelActual?.label ?? '';
    // When isFantasma=true, treat as parent delete (clean ALL levels)
    if (!deleted.isFantasma && engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
      const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
      if (lDesvioId) {
        engine.ramales = engine.ramales.filter(r => r.id !== lDesvioId);
        engine._renumberRamales(deleted.net);
      }
      delete deleted.desplazamientos[lvl];
      if (deleted.ghostData) delete deleted.ghostData[lvl];
      engine.selId = null; engine._isGhostSel = false; engine._emitSelect(null); engine.render(); engine._markDirty(); return;
    }
    // Delete parent bajante: also clean up any Ldesvio ramales and ghost displacements
    if (deleted.desplazamientos) {
      for (const lvlKey of Object.keys(deleted.desplazamientos)) {
        const d = deleted.desplazamientos[lvlKey];
        if (d.Ldesvio) {
          engine.ramales = engine.ramales.filter(r => r.id !== d.Ldesvio);
          engine._renumberRamales(deleted.net);
        }
      }
    }
    // Clean up references in other bajantes' recibeDeIds and descargaEnId
    for (const other of engine.bajantes) {
      if (other.recibeDeIds) {
        other.recibeDeIds = other.recibeDeIds.filter(rid => rid !== deletedId);
      }
      if (other.descargaEnId === deletedId) {
        other.descargaEnId = null;
      } else if (other.descargaEnId?.includes('|')) {
        const parts = other.descargaEnId.split('|');
        if (parts[1] === deletedId) other.descargaEnId = null;
      }
    }
    engine.bajantes.splice(idxB, 1); 
    if (deleted.tipo === 'bajante') {
      engine._renumberBajantes(deleted.net);
    } else if (deleted.tipo === 'montante') {
      engine._renumberMontantes();
    } else if (deleted.tipo === 'red_publica') {
      const rps = engine.bajantes.filter(b => b.tipo === 'red_publica');
      rps.forEach((b, i) => { b.id = 'RP' + (i + 1); b.code = 'RP' + (i + 1); });
    } else if (deleted.tipo === 'contador') {
      const cnts = engine.bajantes.filter(b => b.tipo === 'contador');
      cnts.forEach((b, i) => { const pfx = b.net === 'gas' ? 'CTNG' : 'CNTAF'; b.id = pfx + (i + 1); b.code = pfx + (i + 1); });
    }
    engine.selId = null; engine._emitSelect(null); engine._emitDelete([deletedId]); engine.render(); engine._markDirty(); return; 
  }
  const idxT = engine.textAnnots.findIndex(t => t.id === engine.selId);
  if (idxT >= 0) { 
    const deletedId = engine.textAnnots[idxT].id;
    engine.textAnnots.splice(idxT, 1); 
    engine.selId = null; engine._emitSelect(null); engine._emitDelete([deletedId]); engine.render(); engine._markDirty(); return; 
  }
  const idxA = engine.areas.findIndex(a => a.id === engine.selId);
  if (idxA >= 0) { 
    const deletedId = engine.areas[idxA].id;
    engine.areas.splice(idxA, 1); 
    engine._renumberAreas();
    engine.selId = null; engine._emitSelect(null); engine._emitDelete([deletedId]); engine.render(); engine._markDirty(); return; 
  }
  const idxD = engine.dims.findIndex(d => d.id === engine.selId);
  if (idxD >= 0) { 
    const deletedId = engine.dims[idxD].id;
    engine.dims.splice(idxD, 1); 
    engine.selId = null; engine._emitSelect(null); engine._emitDelete([deletedId]); engine.render(); engine._markDirty(); return; 
  }
}
