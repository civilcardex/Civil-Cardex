import { NETS } from './PlanoState';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante, PlanoArea, PlanoDimension, PlanoTextAnnotation } from './PlanoEngineTypes';
import { cancelRamal, cancelArea } from './PlanoEngineDrawing';

interface HistorySnapshot {
  ramales: PlanoRamal[];
  bajantes: PlanoBajante[];
  areas: PlanoArea[];
  dims: PlanoDimension[];
  textAnnots: PlanoTextAnnotation[];
  _netCounts: Record<string, { ramal: number; tributario: number }>;
}

export class PlanoHistory {
  private _engine: IPlanoEngineCore;
  private _undoStack: HistorySnapshot[] = [];
  private _isRestoring = false;

  constructor(engine: IPlanoEngineCore) {
    this._engine = engine;
  }

  saveSnapshot(): void {
    if (this._isRestoring) return;
    const e = this._engine;
    const snap: HistorySnapshot = {
      ramales: JSON.parse(JSON.stringify(e.ramales)),
      bajantes: JSON.parse(JSON.stringify(e.bajantes)),
      areas: JSON.parse(JSON.stringify(e.areas)),
      dims: JSON.parse(JSON.stringify(e.dims)),
      textAnnots: JSON.parse(JSON.stringify(e.textAnnots)),
      _netCounts: JSON.parse(JSON.stringify(e._netCounts)),
    };
    this._undoStack.push(snap);
    if (this._undoStack.length > 50) this._undoStack.shift();
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
      return;
    }
    
    if (e.activeRamal) { cancelRamal(e); return; }
    if (e.activeArea) { cancelArea(e); return; }

    if (this._undoStack.length === 0) return;

    this._isRestoring = true;
    
    // Discard the current state
    this._undoStack.pop(); 
    
    const snap = this._undoStack.length > 0 ? this._undoStack[this._undoStack.length - 1] : {
      ramales: [], bajantes: [], areas: [], dims: [], textAnnots: [], 
      _netCounts: Object.fromEntries(NETS.map(n => [n.id, { ramal: 0, tributario: 0 }]))
    };

    e.ramales = JSON.parse(JSON.stringify(snap.ramales));
    e.bajantes = JSON.parse(JSON.stringify(snap.bajantes));
    e.areas = JSON.parse(JSON.stringify(snap.areas));
    e.dims = JSON.parse(JSON.stringify(snap.dims));
    e.textAnnots = JSON.parse(JSON.stringify(snap.textAnnots));
    e._netCounts = JSON.parse(JSON.stringify(snap._netCounts));

    e.selId = null;
    e._emitSelect(null);
    e.render();
    
    this._isRestoring = false;
    
    if (e._onDirtyCb) e._onDirtyCb();
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
    this._undoStack = [];
    this.saveSnapshot();
  }
}
