import { initNetCounts } from './PlanoState.ts';
import type { IPlanoEngineCore } from './PlanoState.ts';
import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoDimension,
  PlanoTextAnnotation,
  PlanoGuideLine,
  CrossFloorGhost,
} from './PlanoState.ts';
import { cancelRamal, cancelArea } from './PlanoEngineDrawing.ts';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../../constants/storage-keys.ts';
import {
  loadFromStorage,
  saveToStorage,
  removeFromStorage,
} from '../../services/storageService.ts';
import { emitAparatosClear, EV_STORAGE } from '../../utils/fixtureEvents.ts';

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
  /** Hash FNV del contenido (captura): el dedupe lo compara ANTES de serializar. */
  hash: number;
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
    window.dispatchEvent(new Event(EV_STORAGE));
    // Refresco directo del panel de aparatos (además del evento EV_STORAGE).
    emitAparatosClear();
  } catch {
    /* ignore */
  }
}

function serializeState(s: HistorySnapshot): string {
  return JSON.stringify(s);
}

/** Mezcla FNV-1a de un entero (misma técnica que frameIndex.firmaGeometria). */
function mezclar(h: number, n: number): number {
  let x = h ^ (n | 0);
  x = Math.imul(x, 16777619);
  return x >>> 0;
}

/**
 * Hash barato del snapshot (sin construir strings — O(primitivas), ~10× más barato que
 * JSON.stringify). Solo sirve para descartar: hash DISTINTO = seguro distinto; hash IGUAL
 * se confirma con un stringify (collisión imposible en la práctica, cubierta igualmente).
 */
function hashDe(h: number, v: unknown, depth = 0): number {
  if (depth > 10) return mezclar(h, 0x3d);
  if (v === null || v === undefined) return mezclar(h, 0x7f);
  const t = typeof v;
  if (t === 'number') {
    const n = v as number;
    return mezclar(h, Number.isFinite(n) ? Math.round(n * 100) : 0x1ff);
  }
  if (t === 'boolean') return mezclar(h, v ? 1 : 0);
  if (t === 'string') {
    const s = v as string;
    for (let i = 0; i < s.length; i++) h = mezclar(h, s.charCodeAt(i));
    return mezclar(h, s.length);
  }
  if (Array.isArray(v)) {
    for (const x of v) h = hashDe(h, x, depth + 1);
    return mezclar(h, v.length);
  }
  if (t === 'object') {
    for (const k of Object.keys(v as object).sort()) {
      h = hashDe(h, k, depth + 1);
      h = hashDe(h, (v as Record<string, unknown>)[k], depth + 1);
    }
    return h;
  }
  return mezclar(h, 0x5a);
}

/** Colecciones del engine que viajan en cada snapshot (mismas claves en capture/restore). */
const SNAPSHOT_KEYS = [
  'ramales',
  'bajantes',
  'areas',
  'dims',
  'textAnnots',
  'guideLines',
  'crossFloorGhosts',
] as const;

function captureSnapshot(e: IPlanoEngineCore): HistorySnapshot {
  const snap: Omit<HistorySnapshot, 'hash'> = {
    counts: readCounts(),
    _netCounts: structuredClone(e._netCounts),
  } as Omit<HistorySnapshot, 'hash'>;
  for (const k of SNAPSHOT_KEYS) {
    (snap as Record<string, unknown>)[k] = structuredClone(e[k as keyof IPlanoEngineCore]);
  }
  return { ...snap, hash: hashDe(2166136261, snap) };
}

function restoreSnapshot(e: IPlanoEngineCore, snap: HistorySnapshot): void {
  for (const k of SNAPSHOT_KEYS) {
    (e as unknown as Record<string, unknown>)[k] = structuredClone(
      (snap as unknown as Record<string, unknown>)[k] ?? (k === 'crossFloorGhosts' ? [] : []),
    );
  }
  writeCounts(snap.counts || {});
  e._netCounts = structuredClone(snap._netCounts);
}

/** El "deshacer" del visor (Ctrl+Z / Ctrl+Y). Toma una foto del dibujo antes de cada cambio y
 *  vuelve a esa foto cuando el usuario deshace; con la foto también reviven las cantidades de
 *  aparatos y accesorios, que no viven en el dibujo sino en el almacenamiento del navegador.
 *  Ej: asignar un inodoro y pulsar Ctrl+Z quita el símbolo y su cantidad. */
export class PlanoHistory {
  private _engine: IPlanoEngineCore;
  private _undoStack: HistorySnapshot[] = [];
  private _redoStack: HistorySnapshot[] = [];
  private _isRestoring = false;
  // Ítem 1: pausa transitoria para operaciones compuestas (validaciones que escriben y
  // revierten, cambios multi-paso) — una acción de usuario = un snapshot, sin pasos muertos.
  // Contador (pausas anidables) + marca de tiempo: si una excepción deja la pausa huérfana
  // (resume nunca corre), el historial quedaba MUDO para siempre y el Ctrl+Z "no hacía nada"
  // con los aparatos recién asignados — saveSnapshot se auto-rearme tras 1s de pausa.
  private _pauseCount = 0;
  private _pausedAt = 0;

  constructor(engine: IPlanoEngineCore) {
    this._engine = engine;
  }

  /** Agrupa varios cambios en un solo paso de deshacer: mientras esté pausado no se guarda ninguna
   *  foto. Úsala en operaciones que escriben y luego revierten (validaciones, cambios en varios
   *  pasos) para que el usuario no tenga que deshacer paso por paso. */
  pause(): void {
    this._pauseCount++;
    this._pausedAt = Date.now();
  }

  /** Cierra la pausa abierta por {@link pause} y deja volver a guardar fotos. */
  resume(): void {
    if (this._pauseCount > 0) this._pauseCount--;
  }

  /** Guarda la foto actual para poder deshacer hasta aquí. No hace nada si el estado es idéntico
   *  al de la última foto: así un Ctrl+Z nunca se gasta en un cambio que no cambió nada. */
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
    // Dedupe con hash (barato): hash distinto = seguro distinto; hash igual se confirma
    // con UN stringify (antes: dos stringify del doc completo POR CADA guardado).
    const top = this._undoStack[this._undoStack.length - 1];
    if (top) {
      // hash distinto = seguro distintos; hash igual se confirma con UN stringify
      // (collisión prácticamente imposible, cubierta igualmente).
      const igual = top.hash === snap.hash ? serializeState(top) === serializeState(snap) : false;
      if (igual) return;
    }
    this._redoStack = [];
    this._undoStack.push(snap);
    if (this._undoStack.length > MAX_UNDO_STACK) this._undoStack.shift();
  }

  /** Deshace lo último. Si hay una tubería o un área a medio dibujar, solo borra su último punto;
   *  si no, vuelve a la foto anterior y además limpia la selección.
   *  Ej: tras asignar un inodoro, un Ctrl+Z quita el símbolo y la cantidad. */
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

  /** Rehace lo que se acaba de deshacer. Se vacía solo en cuanto el usuario hace un cambio nuevo:
   *  ahí ya no tiene sentido "rehacer" lo que quedó en el pasado. */
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

  /** Borra todo el dibujo (el botón Limpiar) y deja el historial con una sola foto: a partir de ahí
   *  ya no se puede deshacer el borrado. */
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

  /** Vacía SOLO el historial (sin tocar el dibujo): se cargó otro piso y los snapshots
   *  del anterior ya no corresponden a lo que el motor muestra — un Ctrl+Z cross-piso
   *  restauraba contenido viejo bajo el id del piso nuevo y el autosave lo persistía
   *  como fotocopia. El saveSnapshot posterior a loadWork deja la foto del piso nuevo. */
  reset(): void {
    this._undoStack = [];
    this._redoStack = [];
  }
}
