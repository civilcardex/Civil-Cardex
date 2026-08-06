import { initNetCounts } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoDimension,
  PlanoTextAnnotation,
} from './PlanoState';
import { cancelRamal, cancelArea } from './PlanoEngineDrawing';

const MAX_UNDO_STACK = 50;

interface HistorySnapshot {
  ramales: PlanoRamal[];
  bajantes: PlanoBajante[];
  areas: PlanoArea[];
  dims: PlanoDimension[];
  textAnnots: PlanoTextAnnotation[];
  _netCounts: Record<string, { ramal: number; tributario: number }>;
}

function captureSnapshot(e: IPlanoEngineCore): HistorySnapshot {
  return {
    ramales: structuredClone(e.ramales),
    bajantes: structuredClone(e.bajantes),
    areas: structuredClone(e.areas),
    dims: structuredClone(e.dims),
    textAnnots: structuredClone(e.textAnnots),
    _netCounts: structuredClone(e._netCounts),
  };
}

function restoreSnapshot(e: IPlanoEngineCore, snap: HistorySnapshot): void {
  e.ramales = structuredClone(snap.ramales);
  e.bajantes = structuredClone(snap.bajantes);
  e.areas = structuredClone(snap.areas);
  e.dims = structuredClone(snap.dims);
  e.textAnnots = structuredClone(snap.textAnnots);
  e._netCounts = structuredClone(snap._netCounts);
}

export class PlanoHistory {
  private _engine: IPlanoEngineCore;
  private _undoStack: HistorySnapshot[] = [];
  private _redoStack: HistorySnapshot[] = [];
  private _isRestoring = false;

  constructor(engine: IPlanoEngineCore) {
    this._engine = engine;
  }

  saveSnapshot(): void {
    if (this._isRestoring) return;
    this._redoStack = [];
    const snap = captureSnapshot(this._engine);
    this._undoStack.push(snap);
    if (this._undoStack.length > MAX_UNDO_STACK) this._undoStack.shift();
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

    if (e.activeRamal) {
      cancelRamal(e);
      return;
    }
    if (e.activeArea) {
      cancelArea(e);
      return;
    }

    if (this._undoStack.length < 2) return;

    this._isRestoring = true;

    // Empuja el estado actual (tope) al stack de redo antes de descartarlo
    const currentSnap = this._undoStack.pop()!;
    this._redoStack.push(currentSnap);

    // Restaura el estado previo (ahora en el tope)
    const snap = this._undoStack[this._undoStack.length - 1];
    restoreSnapshot(e, snap);

    e.selId = null;
    e._emitSelect(null);
    e.render();

    this._isRestoring = false;

    if (e._onDirtyCb) e._onDirtyCb();
  }

  redoLast(): void {
    const e = this._engine;
    if (this._redoStack.length === 0) return;

    this._isRestoring = true;

    // Empuja el estado actual al stack de undo
    const currentSnap = captureSnapshot(e);
    this._undoStack.push(currentSnap);

    // Restaura el estado de redo
    const snap = this._redoStack.pop()!;
    restoreSnapshot(e, snap);

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
    initNetCounts(e);
    e._emitSelect(null);
    e.render();
    this._undoStack = [];
    this._redoStack = [];
    this.saveSnapshot();
  }
}
