import { NETS } from './PlanoState.ts';
import type {
  PlanoElement,
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoDimension,
  PlanoTextAnnotation,
  PlanoLevel,
  PlanoNetCounts,
  PlanoActiveRamal,
  PlanoActiveArea,
  PlanoRamalDefaults,
  PlanoGuideLine,
  MultiDragOrigData,
} from './PlanoState.ts';
import type { IPlanoEngineCore } from './PlanoState.ts';
import type { CrossFloorGhost } from '../../utils/associateBajanteAcrossFloors';
import { snapToSegment } from './HitTester.ts';
import {
  snapToExisting as snapToExistingLib,
  snapPreviewToPadre as snapPreviewToPadreLib,
} from './snapExisting.ts';
import { serializeWork } from './PlanoPersistence.ts';
import {
  setTool as _setTool,
  finishRamal as _finishRamal,
  cancelRamal as _cancelRamal,
  cancelArea as _cancelArea,
  finishArea as _finishArea,
  _statusMsg,
  _nextLabel,
  _midpoint,
  _calcPolyArea,
  handleCreateMontanteMidBody,
  handleCreateCalentadorMidBody,
  handleEraseDown,
  eraseRamalAt,
  handleDoubleClick,
  setDefinedScaleM as _setDefinedScaleM,
} from './PlanoEngineDrawing.ts';
import type { ToolType } from './PlanoEngineDrawing.ts';
export type { ToolType };
import {
  snapAngle as snapAngleLib,
  toCvs as toCvsLib,
  toPlane as toPlaneLib,
  pxToM as pxToMLib,
  mm2cvs as mm2cvsLib,
  cmToPlanePx as cmToPlanePxLib,
  cmToCanvasPx as cmToCanvasPxLib,
  realMmToCanvasPx as realMmToCanvasPxLib,
  labelScaleM as labelScaleMLib,
} from './planoCoords.ts';
import { teardownCanvasEvents } from './events/canvasSetup.ts';
import {
  resizeCanvas as _resizeCanvas,
  cancelPendingFrames,
  scheduleRender as _scheduleRender,
  getPos as getPosLib,
  cachedRect as cachedRectLib,
  wrapTouch as wrapTouchLib,
  zoomStep as _zoomStep,
} from './events/canvasLifecycle.ts';
import { initEngineState } from './engineInit.ts';
import {
  reEncuadrarContenido,
  fitPage,
  ensureCanvasSize,
  watchContainerSize,
  stopWatchingContainerSize,
} from './viewport.ts';
import { handleKeyDown } from './handleKeyDown.ts';
import {
  selectAt as _selectAt,
  selectById as _selectById,
  getSelected as _getSelected,
  updateSelected as _updateSelected,
  updateElementById as _updateElementById,
  rotateLabelSnap as _rotateLabelSnap,
  resetLabel as _resetLabel,
} from './PlanoEngineSelection.ts';
import { deleteSelected as _deleteSelected } from './deleteSelected.ts';
import { handlePointerDown } from './events/pointerDown.ts';
import { handlePointerMove } from './events/pointerMove.ts';
import { handleWheel } from './events/wheelZoom.ts';
import { handlePointerUp } from './events/pointerUp.ts';
import { markDirty } from './dirtyPipeline.ts';
import {
  emitStatus,
  emitSelect,
  emitDelete,
  triggerAlert as triggerAlertFn,
  triggerOpciones as triggerOpcionesFn,
  triggerAccesorioModal as triggerAccesorioModalFn,
} from './engineEmitters.ts';
import {
  setActiveNet as _setActiveNet,
  setTipoTramo as _setTipoTramo,
  setSnap as _setSnap,
  setGridMode as _setGridMode,
  setScaleM as _setScaleMConReescala,
  getSelectedGhost as _getSelectedGhost,
  reportePerf as _reportePerf,
  sanearBajantesLegacy,
} from './engineSetters.ts';
import { renderFrame } from './render/frame.ts';
import { loadWorkCommand } from './commands/loadWork.ts';
import {
  getElementsByNet as _getElementsByNet,
  setNetHidden as _setNetHidden,
  setNetLocked as _setNetLocked,
  clearNet as _clearNet,
  setPadreTributario as _setPadreTributario,
  getPadreTributario as _getPadreTributario,
  getRamalesPadre as _getRamalesPadre,
  setRamalDefaults as _setRamalDefaults,
  getBajantesFantasma as _getBajantesFantasma,
  _renumberRamales as _doRenumberRamales,
  _renumberBajantes as _doRenumberBajantes,
  _renumberMontantes as _doRenumberMontantes,
  _renumberAreas as _doRenumberAreas,
} from './PlanoEngineNetwork.ts';
import { PlanoHistory } from './PlanoHistory.ts';

export { NETS };

export type { TramoType, Point, ElementItem } from './PlanoState.ts';
import type {
  TramoType,
  Point,
  ElementItem,
  SelectCallback,
  StatusCallback,
  UpdateCallback,
  DirtyCallback,
} from './PlanoState.ts';

/** Motor CAD del plano: sobre el PDF de fondo dibuja ramales, bajantes, cotas, textos y áreas por
 *  red (af (Agua Fría), san (Sanitaria), ll (Lluvias)...). Aquí viven el zoom, las herramientas de
 *  dibujo y el deshacer/rehacer de cada cambio. */
export default class PlanoEngine implements IPlanoEngineCore {
  cw!: HTMLElement;
  pdfWrap!: HTMLElement | null;
  canv!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  zoom!: number;
  offX!: number;
  offY!: number;
  lineWidthScale!: number;
  dpr!: number;
  tool!: ToolType;
  activeNet!: string;
  tipoTramo!: TramoType;
  snapMode!: boolean;
  gridMode!: boolean;
  scaleM!: number;
  definedScaleM!: number;
  /** Dmuro (RCI) inyectado por la capa React (ver IPlanoEngineCore.dmuroRci): null = apagado. */
  dmuroRci: number | null = null;
  pageW!: number;
  pageH!: number;

  ramales!: PlanoRamal[];
  dims!: PlanoDimension[];
  textAnnots!: PlanoTextAnnotation[];
  private _bajantes: PlanoBajante[] = [];
  get bajantes(): PlanoBajante[] {
    return this._bajantes;
  }
  /** (saneo en engineSetters.ts — extraído al partir el archivo) */
  set bajantes(v: PlanoBajante[]) {
    sanearBajantesLegacy(v);
    this._bajantes = v;
  }
  crossFloorGhosts!: CrossFloorGhost[];
  guideLines!: PlanoGuideLine[];
  areas!: PlanoArea[];
  activeRamal!: PlanoActiveRamal | null;
  padreTributario!: string | null;
  _ventFirstSegDir?: { x: number; y: number } | null;
  activeArea!: PlanoActiveArea | null;
  selId!: string | null;
  selectedGhostId!: string | null;
  areaDrag!: { id: string; startX: number; startY: number } | null;
  areaPtDrag!: { id: string; idx: number; offX: number; offY: number } | null;
  _areaClickCandidate!: string | null;
  _dimPreviewPt!: { x: number; y: number } | null;
  dimDrag!: { id: string; startX: number; startY: number } | null;
  panning!: boolean;
  panX0!: number;
  panY0!: number;
  mouseX!: number;
  mouseY!: number;
  ghostDrag!: { id: string; startX: number; startY: number; baseDx: number; baseDy: number } | null;
  guideDrag!: {
    id: string;
    startX: number;
    startY: number;
    origPts: [number, number][];
    endIdx?: number;
  } | null;
  lblDrag!: { id: string; offX: number; offY: number; slot?: 'ini' | 'fin' } | null;
  txtDrag!: { id: string; startX: number; startY: number; origX: number; origY: number } | null;
  dimLblDrag!: { id: string; offX: number; offY: number } | null;
  txtResize!: {
    id: string;
    corner: 'tl' | 'tr' | 'bl' | 'br';
    anchorX: number;
    anchorY: number;
    startDist: number;
    origFontMm: number;
    origBoxWpx: number;
  } | null;
  bajDrag!: { id: string; offX: number; offY: number } | null;
  canalResizeDrag!: {
    id: string;
    corner: 'tl' | 'tr' | 'bl' | 'br';
    anchorLX: number;
    anchorLY: number;
    oX: number;
    oY: number;
    ang: number;
  } | null;
  ptDrag!: {
    id: string;
    ptIdx: number;
    slideConstraint?: { otherId: string; segmentIdx: number };
  } | null;
  ramalDrag!: {
    id: string;
    startX: number;
    startY: number;
    origPts: [number, number][];
    connBaj?: {
      id: string;
      origX: number;
      origY: number;
      origLblX: number;
      origLblY: number;
      atIdx: number;
    }[];
  } | null;
  _dimStart!: Point | null;
  _guideStart!: Point | null;
  _guidePts!: [number, number][] | null;
  _canalStart!: Point | null;
  _canalEje!: { x1: number; y1: number; x2: number; y2: number } | null;
  nivelActual!: PlanoLevel | null;
  nptLevels!: PlanoLevel[];
  _hiddenNets!: Set<string>;
  _lockedNets!: Set<string>;
  activeNetworks!: Set<string> | undefined;
  _touchStartHandler?: (e: TouchEvent) => void;
  _touchMoveHandler?: (e: TouchEvent) => void;
  _touchEndHandler?: (e: TouchEvent) => void;
  _loadedPlanId!: string | number | null;
  /** Puente al modal "¿qué sentido tiene esta tubería?" del re-enraizamiento (regla 5 del memo).
   *  Lo lee engineEmitters.ts (triggerOpciones extraído). */
  _onOpcionesCb: ((title: string, msg: string, opciones: string[]) => Promise<number>) | null =
    null;
  planId?: string | number;
  _onDirtyCb!: DirtyCallback | null;
  _lastMouseCvs!: Point;
  _selPointCvs?: Point;

  _netCounts!: Record<string, PlanoNetCounts>;

  MM!: {
    lblName: number;
    lblInfo: number;
    lblCode: number;
    flowEmoji: number;
    coord: number;
  };

  panX!: number;
  panY!: number;

  _onDown!: (e: MouseEvent | TouchEvent) => void;
  _onMove!: (e: MouseEvent | TouchEvent) => void;
  _onUp!: (e: MouseEvent | TouchEvent) => void;
  _onDblClick!: (e: MouseEvent) => void;
  _onWheel!: (e: WheelEvent) => void;
  _onKeyDown!: (e: KeyboardEvent) => void;

  _onSelectCb!: SelectCallback | null;
  _onStatusCb!: StatusCallback | null;
  _onUpdateCb!: UpdateCallback | null;
  _onRequestTextCb!: ((x: number, y: number, cb: (text: string) => void) => void) | null;
  _onContextMenuCb!:
    | ((
        bajante: PlanoElement,
        x: number,
        y: number,
        isGhostClick?: boolean,
        ramalEndpoint?: { idx: number; x: number; y: number } | null,
        midRamalHit?: { segmentIdx: number; x: number; y: number } | null,
      ) => void)
    | null;
  _onDeleteCb!: ((ids: string[]) => void) | null;
  _onActiveNetChangeCb!: ((net: string) => void) | null;
  _onAlertCb!: ((title: string, msg: string) => void) | null;
  _onAccesorioModalCb!:
    | ((data: {
        ramalId: string;
        angleDeg: number;
        junctionIndex: number;
        point: number[];
        net: string;
        isTee?: boolean;
      }) => void)
    | null;
  _dirty!: boolean;
  /** Input congelado (cambio de piso en vuelo): mousedown no dibuja ni arrastra. */
  _frozen!: boolean;
  _lastRightClickTime!: number;

  _ramalDefaults!: PlanoRamalDefaults | null;

  _history!: PlanoHistory;

  _isGhostSel!: boolean;
  _lblDragIsParent?: boolean;
  _debugSel?: { x: number; y: number; notes: string[]; final: string | null } | null;
  _yeeFlashKey!: string | null;
  multiSel!: string[];
  multiDrag!: { startX: number; startY: number; origData: MultiDragOrigData } | null;
  marqueeRect!: { x1: number; y1: number; x2: number; y2: number } | null;
  // Públicos para events/canvasLifecycle.ts (extraído al partir el archivo) — mismo trato
  // que _wheelAccum/_wheelRaf: el estado del render loop vive en la clase, se lee afuera.
  _needsRender = false;
  _rafId: number | null = null;

  /** Deja listo (zoom, posición y tamaño) el lienzo donde se va a dibujar.
   *  (cuerpo en engineInit.ts — extraído al partir el archivo) */
  constructor(cw: HTMLElement, pdfWrap: HTMLElement | null, canv: HTMLCanvasElement) {
    initEngineState(this, cw, pdfWrap, canv);
  }

  /** Distancia inicial del pinch (2 dedos); null = sin pinch activo. */
  _pinchDist0: number | null = null;
  /** Zoom del engine al iniciar el pinch: base para escalar por razón de distancias. */
  _pinchZoom0 = 1;
  /** Rueda acumulada por cuadro: suma de deltaY normalizado a px (orig. tirón zoom). */
  _wheelAccum = 0;
  /** Id del rAF pendiente del flush de rueda; 0 = sin flush programado. */
  _wheelRaf = 0;
  /** Ancla del último evento de rueda (coords canvas); el flush usa la más reciente. */
  _wheelMX = 0;
  _wheelMY = 0;
  /** Rect del canvas cacheado por cuadro: getBoundingClientRect fuerza layout. Público para
   *  events/canvasLifecycle.ts (extraído al partir el archivo). */
  _rectCache: { rect: DOMRect; t: number } | null = null;

  onSelect(cb: SelectCallback): void {
    this._onSelectCb = cb;
  }
  onStatus(cb: StatusCallback): void {
    this._onStatusCb = cb;
  }
  onRequestText(cb: (x: number, y: number, cb: (text: string) => void) => void): void {
    this._onRequestTextCb = cb;
  }
  onContextMenu(
    cb: (
      b: PlanoElement,
      x: number,
      y: number,
      isGhostClick?: boolean,
      ramalEndpoint?: { idx: number; x: number; y: number } | null,
      midRamalHit?: { segmentIdx: number; x: number; y: number } | null,
    ) => void,
  ): void {
    this._onContextMenuCb = cb;
  }
  onUpdate(cb: UpdateCallback): void {
    this._onUpdateCb = cb;
  }
  onDirty(cb: DirtyCallback): void {
    this._onDirtyCb = cb;
  }
  onDelete(cb: (ids: string[]) => void): void {
    this._onDeleteCb = cb;
  }
  onActiveNetChange(cb: (net: string) => void): void {
    this._onActiveNetChangeCb = cb;
  }
  onAlert(cb: (title: string, msg: string) => void): void {
    this._onAlertCb = cb;
  }
  onAccesorioModal(
    cb: (data: {
      ramalId: string;
      angleDeg: number;
      junctionIndex: number;
      point: number[];
      net: string;
      isTee?: boolean;
    }) => void,
  ): void {
    this._onAccesorioModalCb = cb;
  }

  /** (cuerpo en engineEmitters.ts — extraído al partir el archivo) */
  triggerAlert(title: string, msg: string): void {
    triggerAlertFn(this, title, msg);
  }

  /** Conecta el modal de opciones del re-enraizamiento: devuelve el número de opción elegida por
   *  el usuario, o -1 si cancela. */
  onOpciones(cb: (title: string, msg: string, opciones: string[]) => Promise<number>): void {
    this._onOpcionesCb = cb;
  }

  /** Modal de opciones: resuelve cuando el usuario elige (o -1 si cancela). */
  /** (cuerpo en engineEmitters.ts — extraído al partir el archivo) */
  triggerOpciones(title: string, msg: string, opciones: string[]): Promise<number> {
    return triggerOpcionesFn(this, title, msg, opciones);
  }

  /** Último hash de incidencias por red — anti-spam del modal (solo alerta si cambió). Lo
   *  lee dirtyPipeline.ts (cuerpo extraído). */
  _chequeoHash: Record<string, string> = {};

  /** (cuerpo en engineEmitters.ts — extraído al partir el archivo) */
  triggerAccesorioModal(data: {
    ramalId: string;
    angleDeg: number;
    junctionIndex: number;
    point: number[];
    net: string;
    isTee?: boolean;
  }): void {
    triggerAccesorioModalFn(this, data);
  }

  /** (cuadros pendientes en events/canvasLifecycle.ts — extraído al partir el archivo) */
  destroy(): void {
    cancelPendingFrames(this);
    this.stopWatchingContainerSize();
    teardownCanvasEvents(this);
  }

  setPageSize(w: number, h: number): void {
    this.pageW = w;
    this.pageH = h;
  }

  /** (cuerpo en events/canvasLifecycle.ts — extraído al partir el archivo) */
  resizeCanvas(w: number, h: number): void {
    _resizeCanvas(this, w, h);
  }

  toCvs(px: number, py: number): Point {
    return toCvsLib(this, px, py);
  }
  toPlane(cx: number, cy: number): Point {
    return toPlaneLib(this, cx, cy);
  }
  pxToM(px: number): number {
    return pxToMLib(this.scaleM, px);
  }
  mm2cvs(mm: number): number {
    return mm2cvsLib(mm, this.zoom);
  }

  // Inversa de pxToM: convierte una longitud REAL en cm a px de coordenada de plano (el mismo
  // espacio que las x/y de ramales/bajantes — independiente de zoom/pan), para que el
  // rectángulo de base/altura dibujado de un canal escale con la escala real del plano igual
  // que totalL de un ramal (vía pxToM) ya ata la distancia de coordenada de plano a la
  // longitud real.
  cmToPlanePx(cm: number): number {
    return cmToPlanePxLib(this.scaleM, cm);
  }

  // cmToPlanePx aplicado a la transformación actual del canvas — solo para renderizar; nunca
  // usar esto para guardar geometría (cambia con el zoom).
  cmToCanvasPx(cm: number): number {
    return cmToCanvasPxLib(this, cm);
  }

  realMmToCanvasPx(realRadiusMm: number): number {
    return realMmToCanvasPxLib(this, realRadiusMm);
  }

  get labelScaleM(): number {
    return labelScaleMLib(this);
  }

  /** (cuerpo en engineEmitters.ts — extraído al partir el archivo) */
  _emitStatus(msg: string): void {
    emitStatus(this, msg);
  }

  /** (cuerpo en engineEmitters.ts — extraído al partir el archivo) */
  _emitSelect(
    el: PlanoRamal | PlanoBajante | PlanoArea | PlanoTextAnnotation | PlanoDimension | null,
  ): void {
    emitSelect(this, el);
  }

  /** (cuerpo en engineEmitters.ts — extraído al partir el archivo) */
  _emitDelete(ids: string[]): void {
    emitDelete(this, ids);
  }

  /** Marca el trabajo como sucio: recalcula conexiones de red y accesorios, guarda un snapshot
   *  de historial y dispara el callback onDirty (que es quien guarda a disco/BD). */
  /** (cuerpo en dirtyPipeline.ts — extraído al partir el archivo) */
  _markDirty(): void {
    markDirty(this);
  }

  snapAngle(x0: number, y0: number, x1: number, y1: number, net?: string, tipo?: string): Point {
    return snapAngleLib(x0, y0, x1, y1, net, tipo);
  }

  snapToExisting(
    x: number,
    y: number,
    net?: string,
    tipo?: string,
    permitirBajantesLlenos: boolean = false,
  ): Point | null {
    return snapToExistingLib(this, x, y, net, tipo, permitirBajantesLlenos);
  }

  _snapToSegment(
    x: number,
    y: number,
    pts: number[][],
    threshold: number = Infinity,
  ): Point | null {
    return snapToSegment(x, y, pts, threshold);
  }

  snapPreviewToPadre(x: number, y: number): Point | null {
    return snapPreviewToPadreLib(this, x, y);
  }

  _wrapTouch(fn: (e: TouchEvent) => void): (e: TouchEvent) => void {
    return wrapTouchLib(fn);
  }

  _getPos(e: MouseEvent | TouchEvent): Point {
    return getPosLib(this, e);
  }

  /** (cuerpo en events/canvasLifecycle.ts — extraído al partir el archivo) */
  _cachedRect(): DOMRect {
    return cachedRectLib(this);
  }

  _statusMsg(): string {
    return _statusMsg(this);
  }
  _nextLabel(): string {
    return _nextLabel(this);
  }
  _midpoint(pts: number[][]): [number, number] {
    return _midpoint(pts);
  }
  _calcPolyArea(pts: number[][]): number {
    return _calcPolyArea(this, pts);
  }

  /** Cambia la herramienta activa: 'sel' seleccionar, 'line' trazar tubería, 'dim' cotas, 'text'
   *  textos, 'baj'/'mon' bajantes y montantes, 'area' zonas, 'erase' borrador. */
  setTool(t: ToolType): void {
    _setTool(this, t);
  }
  /** (cuerpo en engineSetters.ts — extraído al partir el archivo) */
  setActiveNet(id: string): void {
    _setActiveNet(this, id);
  }
  /** (cuerpo en engineSetters.ts — extraído al partir el archivo) */
  setTipoTramo(t: TramoType): void {
    _setTipoTramo(this, t);
  }
  /** (cuerpo en engineSetters.ts — extraído al partir el archivo) */
  setSnap(v: boolean): void {
    _setSnap(this, v);
  }

  /** (cuerpo en engineSetters.ts — extraído al partir el archivo) */
  setGridMode(v: boolean): void {
    _setGridMode(this, v);
  }

  setPadreTributario(ramalId: string | null): void {
    _setPadreTributario(this, ramalId);
  }
  getPadreTributario(): PlanoRamal | null {
    return _getPadreTributario(this);
  }
  getRamalesPadre(): PlanoRamal[] {
    return _getRamalesPadre(this);
  }
  setRamalDefaults(d: Partial<PlanoRamalDefaults> | null): void {
    _setRamalDefaults(this, d);
  }

  /** (cuerpo en engineSetters.ts — extraído al partir el archivo) */
  setScaleM(v: string | number): void {
    _setScaleMConReescala(this, v);
  }
  setDefinedScaleM(v: string | number): void {
    _setDefinedScaleM(this, v);
  }

  setNetHidden(netId: string, hidden: boolean): void {
    _setNetHidden(this, netId, hidden);
  }
  setNetLocked(netId: string, locked: boolean): void {
    _setNetLocked(this, netId, locked);
  }

  /** Lista plana de todo lo dibujado de una red (ramales/tributarios, bajantes y áreas): la usan
   *  las tablas de diseño y los informes. */
  getElementsByNet(netId: string): ElementItem[] {
    return _getElementsByNet(this, netId);
  }

  selectById(id: string): void {
    _selectById(this, id);
  }
  selectAt(cx: number, cy: number): void {
    _selectAt(this, cx, cy);
  }
  getSelected():
    | PlanoRamal
    | PlanoBajante
    | PlanoTextAnnotation
    | PlanoArea
    | PlanoDimension
    | PlanoGuideLine
    | null {
    return _getSelected(this);
  }
  updateSelected(fields: Record<string, unknown>): void {
    _updateSelected(this, fields);
  }
  updateElementById(id: string, fields: Record<string, unknown>): void {
    _updateElementById(this, id, fields);
  }
  createMontanteMidBody(ramalId: string, x: number, y: number, segmentIdx: number): void {
    handleCreateMontanteMidBody(this, ramalId, x, y, segmentIdx);
  }
  createCalentadorMidBody(ramalId: string, x: number, y: number, segmentIdx: number): void {
    handleCreateCalentadorMidBody(this, ramalId, x, y, segmentIdx);
  }
  rotateLabelSnap(): void {
    _rotateLabelSnap(this);
  }
  resetLabel(): void {
    _resetLabel(this);
  }
  deleteSelected(ids?: string[], opts?: { noMerge?: boolean }): void {
    _deleteSelected(this, ids, opts);
  }

  /** Borrado del borrador por la misma regla recortar-extremo o borrar todo. */
  handleEraseDown(x: number, y: number): void {
    handleEraseDown(this, x, y);
  }

  /** Recorta o borra el ramal ya seleccionado (via del teclado, sin reseleccionar). */
  eraseRamalAt(r: unknown, x: number, y: number): void {
    eraseRamalAt(this, r as Parameters<typeof eraseRamalAt>[1], x, y);
  }

  finishRamal(): void {
    _finishRamal(this);
  }
  cancelRamal(): void {
    _cancelRamal(this);
  }
  cancelArea(): void {
    _cancelArea(this);
  }
  finishArea(): void {
    _finishArea(this);
  }
  /** Ctrl+Z: devuelve el dibujo a como estaba antes del último cambio. */
  undoLast(): void {
    this._history.undoLast();
  }
  /** Ctrl+Y: vuelve a aplicar lo que se acabó de deshacer. */
  redoLast(): void {
    this._history.redoLast();
  }
  /** Silencia el historial para que una operación larga (p.ej. asignar varios aparatos) cuente
   *  como UN solo deshacer. */
  pauseHistory(): void {
    this._history.pause();
  }
  /** Reanuda el historial (siempre emparejado con pauseHistory: una pausa sin reanudar deja el
   *  deshacer mudo). */
  resumeHistory(): void {
    this._history.resume();
  }
  clearAll(): void {
    this._history.clearAll();
  }
  clearNet(netId: string): void {
    _clearNet(this, netId);
  }

  getBajantesFantasma(): PlanoBajante[] {
    return _getBajantesFantasma(this);
  }
  /** (cuerpo en engineSetters.ts — extraído al partir el archivo) */
  getSelectedGhost(): CrossFloorGhost | null {
    return _getSelectedGhost(this);
  }

  _renumberRamales(netId: string): void {
    _doRenumberRamales(this, netId);
  }
  _renumberBajantes(netId: string): void {
    _doRenumberBajantes(this, netId);
  }
  _renumberMontantes(): void {
    _doRenumberMontantes(this);
  }
  _renumberAreas(): void {
    _doRenumberAreas(this);
  }

  /** Serializa todos los datos de trabajo (elementos, estado, niveles) a un objeto serializable
   *  a JSON. */
  saveWork(): import('./PlanoPersistence.ts').PlanoWorkData {
    return serializeWork(this);
  }

  /** Aplica un trabajo guardado (texto JSON u objeto) al motor. */
  loadWork(json: string | object): void {
    loadWorkCommand(this, json);
  }

  /** Clave del último encuadre (bbox + tamaño de página): igual → skip. Las 3 llamadas de
   *  una carga (loader local, arbitración BD, post-raster) computan lo MISMO — sin guard,
   *  cualquier fuente de bbox divergente reintroduciría el salto por esta puerta. */
  _encuadreKey = '';
  /** Re-encuadra el DIBUJO (no la lámina) tras un loadWork: contenido nuevo → bbox nuevo →
   *  misma doctrina de entrada siempre centrado. La arbitración local-vs-BD que aterriza
   *  después del raster no puede mover los elementos a la vista (orig. usuario: «salto
   *  residual mientras se acomodan»). Sin dibujo cae a la hoja completa. Cámara quieta si el
   *  bbox y la lámina no cambiaron (mismo resultado, cero renders extra). */
  /** (cuerpo en viewport.ts — extraído al partir el archivo) */
  reEncuadrarContenido(): void {
    reEncuadrarContenido(this);
  }

  /** Ajusta la página PDF dentro del viewport con margen. */
  fitPage(): void {
    fitPage(this);
  }

  /** Último transform aplicado al wrapper: re-escribirlo cada cuadro dispara al
   *  MutationObserver del fondo (re-raster) aunque el zoom no cambió. */
  _lastTransform = '';
  /** Reajusta el lienzo de DIBUJO al ÁREA VISIBLE del visor (no a la hoja). Con zoom alto la
   *  hoja se sale del contenedor y este ya recorta: rasterizar fuera de la vista era el costo
   *  que trababa el paneo (hasta ~50 MP por frame, orig. usuario).
   *  En un motor DESACOPLADO (exportación de planos: contenedor fuera del DOM) no manda el
   *  viewport: ahí el tamaño lo fija `resizeCanvas` explícitamente. */
  /** (cuerpo en viewport.ts — extraído al partir el archivo) */
  ensureCanvasSize(): void {
    ensureCanvasSize(this);
  }
  _canvasW = 0;
  _canvasH = 0;

  /** Re-mide el lienzo cuando cambia el ÁREA VISIBLE (plegar una barra, redimensionar la
   *  ventana): sin esto el trazo se cortaba antes que el PDF de fondo (CSS) — orig. usuario. */
  _observarResize: ResizeObserver | null = null;

  /** Empieza a vigilar el tamaño del contenedor visible. */
  watchContainerSize(): void {
    watchContainerSize(this);
  }

  stopWatchingContainerSize(): void {
    stopWatchingContainerSize(this);
  }

  /** Repinta el canvas con todas las capas (cotas, ramales, bajantes y activos). */
  render(): void {
    renderFrame(this);
  }

  /** Tiempos del último render (los lee `__cfPerf` en DEV): sirve para saber si el costo está
   *  en el trazo, en las uniones o en el fondo, sin adivinar. */
  _perf = {
    frames: 0,
    totalMs: 0,
    capas: {} as Record<string, number>,
  };

  /** (cuerpo en engineSetters.ts — extraído al partir el archivo) */
  reportePerf(): Record<string, unknown> {
    return _reportePerf(this);
  }

  /** (cuerpo en events/canvasLifecycle.ts — extraído al partir el archivo) */
  scheduleRender(): void {
    _scheduleRender(this);
  }

  _onDownHandler(e: MouseEvent | TouchEvent): void {
    handlePointerDown(this, e);
  }

  _onMouseMoveHandler(e: MouseEvent | TouchEvent): void {
    handlePointerMove(this, e);
  }

  /** (cuerpo en events/pointerUp.ts — extraído al partir el archivo) */
  _onMouseUpHandler(e: MouseEvent | TouchEvent): void {
    handlePointerUp(this, e);
  }

  _onDblClickHandler(e: MouseEvent): void {
    void e;
    handleDoubleClick(this);
  }

  /** (cuerpo en events/canvasLifecycle.ts — extraído al partir el archivo) */
  zoomStep(factor: number): void {
    _zoomStep(this, factor);
  }

  _onWheelHandler(e: WheelEvent): void {
    handleWheel(this, e);
  }

  _onKeyDownHandler(e: KeyboardEvent): void {
    handleKeyDown(this, e);
  }
}
