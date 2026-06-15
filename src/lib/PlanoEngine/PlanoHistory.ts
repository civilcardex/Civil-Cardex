import { NETS } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoEngineTypes';
import { cancelRamal, cancelArea } from './PlanoEngineDrawing';

export class PlanoHistory {
  private _engine: IPlanoEngineCore;

  constructor(engine: IPlanoEngineCore) {
    this._engine = engine;
  }

  undoLast(): void {
    const e = this._engine;

    if (e.activeRamal && e.activeRamal.pts.length > 1) {
      const ar = e.activeRamal;
      const last = ar.pts[ar.pts.length - 1];
      const prev = ar.pts[ar.pts.length - 2];
      const segLen = Math.hypot(last[0] - prev[0], last[1] - prev[1]);
      ar.totalL = +(ar.totalL - e.pxToM(segLen)).toFixed(3);
      if (ar.totalL < 0) ar.totalL = 0;
      ar.pts.pop();
      e._emitStatus(e._statusMsg());
      e.render();
      e._markDirty();
      return;
    }
    if (e.activeRamal) { cancelRamal(e); return; }
    if (e.activeArea) { cancelArea(e); return; }
    if ((e.tool === 'baj' || e.tool === 'mon' || e.tool === 'delm') && e.bajantes.length) {
      e.bajantes.pop();
    } else if (e.ramales.length) {
      const removed = e.ramales.pop();
      if (removed) e._renumberRamales(removed.net);
    } else if (e.areas.length) {
      e.areas.pop();
    } else if (e.dims.length) {
      e.dims.pop();
    } else if (e.textAnnots.length) {
      e.textAnnots.pop();
    }
    e.selId = null;
    e._emitSelect(null);
    e.render();
    e._markDirty();
  }

  clearAll(): void {
    const e = this._engine;
    e.ramales = [];
    e.dims = [];
    e.textAnnots = [];
    e.bajantes = [];
    e.areas = [];
    e.activeRamal = null;
    e.activeArea = null;
    e.selId = null;
    e._netCounts = {};
    NETS.forEach(n => { e._netCounts[n.id] = { ramal: 0, tributario: 0 }; });
    e._emitSelect(null);
    e.render();
  }
}
