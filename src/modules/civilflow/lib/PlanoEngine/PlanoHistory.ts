import { initNetCounts } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoDimension,
  PlanoTextAnnotation,
  PlanoGuideLine,
  CrossFloorGhost,
} from './PlanoState';
import { cancelRamal, cancelArea } from './PlanoEngineDrawing';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../../constants/storage-keys';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../../services/storageService';

const MAX_UNDO_STACK = 50;

// Ítem 1 (Ctrl+Z general): el historial es ÚNICO y cubre todo lo que modifica el estado —
// además de la geometría, los conteos de aparatos/accesorios. LECTURA/ESCRITURA vía
// storageService (con el prefijo `civilflow_`): las claves se guardan PREFIJADAS por
// saveToStorage — leer con localStorage crudo sin prefijo devolvía SIEMPRE null y el snapshot
// restauraba conteos vacíos (por eso el Ctrl+Z no borraba la cantidad de aparatos).
const COUNT_STORAGE_KEYS = [APARATOS_BY_TRAMO_KEY, HYDRO_DATA_STORAGE_KEY, GAS_ACC_KEY];

interface HistorySnapshot {
  ramales: PlanoRamal[];
  bajantes: PlanoBajante[];
  areas: PlanoArea[];
  dims: PlanoDimension[];
  textAnnots: PlanoTextAnnotation[];
  guideLines: PlanoGuideLine[];
  crossFloorGhosts: CrossFloorGhost[];
  counts: Record<string, string | null>;
  _netCounts: Record<string, { ramal: number; tributario: number }>;
}

function readCounts(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  try {
    for (const k of COUNT_STORAGE_KEYS) {
      const parsed = loadFromStorage<unknown>(k, null);
      out[k] = parsed === null ? null : JSON.stringify(parsed);
    }
  } catch {
    /* storage no disponible (tests) — snapshot solo de geometría */
  }
  return out;
}

function writeCounts(counts: Record<string, string | null>): void {
  try {
    for (const k of COUNT_STORAGE_KEYS) {
      const v = counts[k];
      if (v === null || v === undefined) removeFromStorage(k);
      else saveToStorage(k, JSON.parse(v));
    }
    window.dispatchEvent(new Event('storage'));
    // Refresco directo del panel de aparatos (además del evento 'storage').
    window.dispatchEvent(new CustomEvent('aparatos-clear'));
  } catch {
    /* ignore */
  }
}

function serializeState(s: HistorySnapshot): string {
  return JSON.stringify(s);
}

function captureSnapshot(e: IPlanoEngineCore): HistorySnapshot {
  return {
    ramales: structuredClone(e.ramales),
    bajantes: structuredClone(e.bajantes),
    areas: structuredClone(e.areas),
    dims: structuredClone(e.dims),
    textAnnots: structuredClone(e.textAnnots),
    guideLines: structuredClone(e.guideLines),
    crossFloorGhosts: structuredClone(e.crossFloorGhosts),
    counts: readCounts(),
    _netCounts: structuredClone(e._netCounts),
  };
}

function restoreSnapshot(e: IPlanoEngineCore, snap: HistorySnapshot): void {
  e.ramales = structuredClone(snap.ramales);
  e.bajantes = structuredClone(snap.bajantes);
  e.areas = structuredClone(snap.areas);
  e.dims = structuredClone(snap.dims);
  e.textAnnots = structuredClone(snap.textAnnots);
  e.guideLines = structuredClone(snap.guideLines);
  e.crossFloorGhosts = structuredClone(snap.crossFloorGhosts || []);
  writeCounts(snap.counts || {});
  e._netCounts = structuredClone(snap._netCounts);
}

export class PlanoHistory {
  private _engine: IPlanoEngineCore;
  private _undoStack: HistorySnapshot[] = [];
  private _redoStack: HistorySnapshot[] = [];
  private _isRestoring = false;
  // Ítem 1: pausa transitoria para operaciones compuestas (validaciones que escriben y
  // revierten, cambios multi-paso) — una acción de usuario = un snapshot, sin pasos muertos.
  // Contador (pausas anidables) + marca de tiempo: si una excepción deja la pausa huérfana
  // (resume nunca corre), el historial quedaba MUDO para siempre y el Ctrl+Z "no hacía nada"
  // con los aparatos recién asignados — saveSnapshot se auto-rearma tras 1s de pausa.
  private _pauseCount = 0;
  private _pausedAt = 0;

  constructor(engine: IPlanoEngineCore) {
    this._engine = engine;
  }

  pause(): void {
    this._pauseCount++;
    this._pausedAt = Date.now();
  }

  resume(): void {
    if (this._pauseCount > 0) this._pauseCount--;
  }

  saveSnapshot(): void {
    if (this._isRestoring) return;
    if (this._pauseCount > 0) {
      if (Date.now() - this._pausedAt <= 1000) return;
      this._pauseCount = 0; // pausa huérfana (excepción): rearmar y guardar
    }
    const snap = captureSnapshot(this._engine);
    // Los caminos de edición marcan dirty DOS veces por acción (updateElementById marca
    // internamente y el caller marca al final). Sin dedupe, el primer Ctrl+Z restauraba el
    // snapshot duplicado — estado idéntico al actual, con el aparato/accesorio recién
    // asignado incluido — y parecía "no hacer nada": había que deshacer DOS veces.
    const top = this._undoStack[this._undoStack.length - 1];
    if (top && serializeState(top) === serializeState(snap)) return;
    this._redoStack = [];
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
    // Aviso a la UI (PdfViewer) para cerrar menú contextual/panel: muestran COPIAS congeladas
    // del elemento y el usuario las lee como "el aparato no se borró".
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('civilflow_undone'));
    } catch {
      /* ignore */
    }
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
    e.guideLines = [];
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
