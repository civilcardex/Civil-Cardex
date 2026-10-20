import { NETS, netsSnapLinked, initNetCounts } from './PlanoState';
import { bajanteLleno } from './bajanteRules';
import { devError } from '../../../../utils/devError';
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
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { chequearRed, REDES_PRESION } from './nodos';
import type { CrossFloorGhost } from '../../utils/associateBajanteAcrossFloors';
import { renderDims, renderDimGhost } from './renderers/renderDimensions';
import { renderGuideLines, renderGuideGhost } from './renderers/renderGuideLines';
import { renderTexts } from './renderers/renderTextAnnotations';
import { renderGrid } from './renderers/renderGrid';
import { renderAreas, renderActiveArea } from './renderers/renderAreas';
import {
  renderBajantes,
  renderGhosts,
  renderCrossFloorGhosts,
  renderCanalGhost,
} from './renderers/renderBajantes';
import { renderRamales, renderActiveRamal } from './renderers/renderRamales';
import { renderNetCrossings } from './renderers/renderNetCrossings';
import { snapToSegment } from './HitTester';
import { serializeWork, applyWorkData } from './PlanoPersistence';
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
  handleLineDown,
  handleDimDown,
  handleGuideDown,
  handleTextDown,
  handleBajanteDown,
  handleMontanteDown,
  handleCreateMontanteMidBody,
  handleCreateCalentadorMidBody,
  handleCreateTeeCapStub,
  handleRedPublicaDown,
  handleContadorDown,
  handleCalentadorDown,
  handleCanalDown,
  handleCajaDown,
  handleEraseDown,
  handleAreaDown,
  eraseRamalAt,
  handleDrawingMouseMove,
  handleDoubleClick,
  deleteSegmentAt as _deleteSegmentAt,
  setScaleM as _setScaleM,
  setDefinedScaleM as _setDefinedScaleM,
} from './PlanoEngineDrawing';
import type { ToolType } from './PlanoEngineDrawing';
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
} from './planoCoords';
import { zoomAnclado, tamanoLienzoDibujo } from './planoCamera';
import { handleKeyDown } from './handleKeyDown';
import {
  selectAt as _selectAt,
  selectById as _selectById,
  getSelected as _getSelected,
  updateSelected as _updateSelected,
  updateElementById as _updateElementById,
  rotateLabelSnap as _rotateLabelSnap,
  resetLabel as _resetLabel,
} from './PlanoEngineSelection';
import { deleteSelected as _deleteSelected } from './deleteSelected';
import { handleSelectDown } from './handleMouseDown';
import { handleDragMove } from './handleDragMove';
import { handleDragUp } from './handleDragUp';
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
  calcSanitaryAccessories,
  calcHydroAccessories,
  autoDetectRamalConnections,
  podarReferenciasStaleDeBajantes,
  ensureRpCntRamal,
} from './PlanoEngineNetwork';
import { sellarAsociacionesCanalBajante } from './canalAssociation';
import { fixVentCodoToTee } from './ventCodoTeeFix';
import { healTribPadres } from './junctionAutoSplit';
import { PlanoHistory } from './PlanoHistory';
import { hitTestRightClick, hitTestBajanteLabelForDrag } from './PlanoEngineHitTesting';

export { NETS };

export type { TramoType, Point, ElementItem } from './PlanoState';
import type {
  TramoType,
  Point,
  ElementItem,
  SelectCallback,
  StatusCallback,
  UpdateCallback,
  DirtyCallback,
} from './PlanoState';

/** Motor CAD del plano: sobre el PDF de fondo dibuja ramales, bajantes, cotas, textos y áreas por
 *  red (af (Agua Fría), san (Sanitaria), ll (Lluvias)...). Aquí viven el zoom, las herramientas de
 *  dibujo y el deshacer/rehacer de cada cambio. */
export default class PlanoEngine implements IPlanoEngineCore {
  cw: HTMLElement;
  pdfWrap: HTMLElement | null;
  canv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

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
  pageW!: number;
  pageH!: number;

  ramales!: PlanoRamal[];
  dims!: PlanoDimension[];
  textAnnots!: PlanoTextAnnotation[];
  private _bajantes: PlanoBajante[] = [];
  get bajantes(): PlanoBajante[] {
    return this._bajantes;
  }
  set bajantes(v: PlanoBajante[]) {
    // Saneo legacy (orig. usuario): el bug de auto-conexión trataba el canal como bajante y
    // le guardaba recibeDeIds/alimentaIds — el canal no es bajante y esas membresías lo
    // "llenaban" hasta disparar "Bajante completo". Limpiar al cargar, idempotente.
    for (const b of v) {
      if (
        b.tipo === 'canal' &&
        ((b.recibeDeIds?.length || 0) > 0 || (b.alimentaIds?.length || 0) > 0)
      ) {
        b.recibeDeIds = [];
        b.alimentaIds = [];
      }
    }
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
  private _touchStartHandler?: (e: TouchEvent) => void;
  private _touchMoveHandler?: (e: TouchEvent) => void;
  private _touchEndHandler?: (e: TouchEvent) => void;
  _loadedPlanId!: string | number | null;
  /** Mallas/recirculaciones que el usuario marcó a mano (exentas del chequeo de ciclo). */
  mallasDeclaradas: Set<string> = new Set();
  /** Puente al modal "¿qué sentido tiene esta tubería?" del re-enraizamiento (regla 5 del memo). */
  private _onOpcionesCb:
    | ((title: string, msg: string, opciones: string[]) => Promise<number>)
    | null = null;
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
  drawingAcc!: boolean;
  dirty!: boolean;
  offCtx!: CanvasRenderingContext2D | null;

  _onDown: (e: MouseEvent | TouchEvent) => void;
  _onMove: (e: MouseEvent | TouchEvent) => void;
  _onUp: (e: MouseEvent | TouchEvent) => void;
  _onDblClick: (e: MouseEvent) => void;
  _onWheel: (e: WheelEvent) => void;
  _onKeyDown: (e: KeyboardEvent) => void;

  _onSelectCb: SelectCallback | null;
  _onStatusCb: StatusCallback | null;
  _onUpdateCb: UpdateCallback | null;
  _onRequestTextCb: ((x: number, y: number, cb: (text: string) => void) => void) | null;
  _onContextMenuCb:
    | ((
        bajante: PlanoElement,
        x: number,
        y: number,
        isGhostClick?: boolean,
        ramalEndpoint?: { idx: number; x: number; y: number } | null,
        midRamalHit?: { segmentIdx: number; x: number; y: number } | null,
      ) => void)
    | null;
  _onDeleteCb: ((ids: string[]) => void) | null;
  _onActiveNetChangeCb: ((net: string) => void) | null;
  _onAlertCb: ((title: string, msg: string) => void) | null;
  _onAccesorioModalCb:
    | ((data: {
        ramalId: string;
        angleDeg: number;
        junctionIndex: number;
        point: number[];
        net: string;
        isTee?: boolean;
      }) => void)
    | null;
  _dirty: boolean;
  _lastRightClickTime: number;

  _ramalDefaults!: PlanoRamalDefaults | null;

  _history: PlanoHistory;

  _isGhostSel!: boolean;
  _lblDragIsParent?: boolean;
  _debugSel?: { x: number; y: number; notes: string[]; final: string | null } | null;
  _yeeFlashKey!: string | null;
  multiSel!: string[];
  multiDrag!: { startX: number; startY: number; origData: MultiDragOrigData } | null;
  marqueeRect!: { x1: number; y1: number; x2: number; y2: number } | null;
  private _needsRender = false;
  private _rafId: number | null = null;

  /** Deja listo (zoom, posición y tamaño) el lienzo donde se va a dibujar. */
  constructor(cw: HTMLElement, pdfWrap: HTMLElement | null, canv: HTMLCanvasElement) {
    this.cw = cw;
    this.pdfWrap = pdfWrap;
    this.canv = canv;
    this.ctx = canv.getContext('2d')!;

    this.zoom = 1;
    this.offX = 0;
    this.offY = 0;
    this.lineWidthScale = 1;
    this.dpr = 1;
    this.tool = 'sel';
    this.activeNet = 'af';
    this.tipoTramo = 'ramal';
    this.snapMode = true;
    this.gridMode = true;
    this.scaleM = 0.5;
    this.definedScaleM = 0;
    this.pageW = 0;
    this.pageH = 0;

    this.ramales = [];
    this.dims = [];
    this.textAnnots = [];
    this.bajantes = [];
    this.crossFloorGhosts = [];
    this.guideLines = [];
    this.areas = [];
    this.activeRamal = null;
    this.padreTributario = null;
    this._ventFirstSegDir = null;
    this.activeArea = null;
    this.selId = null;
    this.selectedGhostId = null;
    this._isGhostSel = false;
    this._yeeFlashKey = null;
    this.areaDrag = null;
    this.areaPtDrag = null;
    this._dimPreviewPt = null;
    this._areaClickCandidate = null;
    this.dimDrag = null;
    this.panning = false;
    this.panX0 = 0;
    this.panY0 = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.ghostDrag = null;
    this.guideDrag = null;
    this.lblDrag = null;
    this.txtDrag = null;
    this.txtResize = null;
    this.dimLblDrag = null;
    this.bajDrag = null;
    this.canalResizeDrag = null;
    this.ptDrag = null;
    this.ramalDrag = null;
    this.multiSel = [];
    this.multiDrag = null;
    this.marqueeRect = null;
    this._dimStart = null;
    this._guideStart = null;
    this._guidePts = null;
    this._canalStart = null;
    this._canalEje = null;
    this.nivelActual = null;
    this.nptLevels = [];
    this._hiddenNets = new Set<string>();
    this._lockedNets = new Set<string>();
    this._loadedPlanId = null;
    this._onDirtyCb = null;
    this._lastMouseCvs = { x: 0, y: 0 };

    initNetCounts(this);

    this.MM = {
      lblName: 1.5,
      lblInfo: 1.2,
      lblCode: 1.4,
      flowEmoji: 2.0,
      coord: 1.2,
    };

    this._ramalDefaults = null;

    this._history = new PlanoHistory(this);

    this._onDown = this._onDownHandler.bind(this) as (e: MouseEvent | TouchEvent) => void;
    this._onMove = this._onMouseMoveHandler.bind(this) as (e: MouseEvent | TouchEvent) => void;
    this._onUp = this._onMouseUpHandler.bind(this) as (e: MouseEvent | TouchEvent) => void;
    this._onDblClick = this._onDblClickHandler.bind(this);
    this._onWheel = this._onWheelHandler.bind(this);
    this._onKeyDown = this._onKeyDownHandler.bind(this);

    this._setupCanvasEvents();

    this._onSelectCb = null;
    this._onStatusCb = null;
    this._onRequestTextCb = null;
    this._onContextMenuCb = null;
    this._onDeleteCb = null;
    this._onActiveNetChangeCb = null;
    this._onAlertCb = null;
    this._onAccesorioModalCb = null;
    this._dirty = false;
    this._lastRightClickTime = 0;
    this._onUpdateCb = null;
    this._loadedPlanId = null;
    this._pinchDist0 = null;
  }

  /** Distancia inicial del pinch (2 dedos); null = sin pinch activo. */
  private _pinchDist0: number | null = null;
  /** Zoom del engine al iniciar el pinch: base para escalar por razón de distancias. */
  private _pinchZoom0 = 1;
  /** Rueda acumulada por cuadro: suma de deltaY normalizado a px (orig. tirón zoom). */
  private _wheelAccum = 0;
  /** Id del rAF pendiente del flush de rueda; 0 = sin flush programado. */
  private _wheelRaf = 0;
  /** Ancla del último evento de rueda (coords canvas); el flush usa la más reciente. */
  private _wheelMX = 0;
  private _wheelMY = 0;
  /** Rect del canvas cacheado por cuadro: getBoundingClientRect fuerza layout. */
  private _rectCache: { rect: DOMRect; t: number } | null = null;

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

  triggerAlert(title: string, msg: string): void {
    if (this._onAlertCb) this._onAlertCb(title, msg);
  }

  /** Conecta el modal de opciones del re-enraizamiento: devuelve el número de opción elegida por
   *  el usuario, o -1 si cancela. */
  onOpciones(cb: (title: string, msg: string, opciones: string[]) => Promise<number>): void {
    this._onOpcionesCb = cb;
  }

  /** Modal de opciones: resuelve cuando el usuario elige (o -1 si cancela). */
  triggerOpciones(title: string, msg: string, opciones: string[]): Promise<number> {
    if (this._onOpcionesCb) return this._onOpcionesCb(title, msg, opciones);
    return Promise.resolve(-1);
  }

  /** Último hash de incidencias por red — anti-spam del modal (solo alerta si cambió). */
  private _chequeoHash: Record<string, string> = {};

  /** Revisa las tuberías a presión — af (Agua Fría), ac (Agua Caliente), gas (Gas) y rci (Red Contra
   *  Incendio): cada tramo debe tener por dónde le llega el agua y por dónde sale. Avisa UNA vez por
   *  problema nuevo (el hash evita el mismo modal en cada clic). */
  private chequearPresionGlobal(): void {
    const nets = new Set<string>();
    for (const r of this.ramales) if (REDES_PRESION.has(r.net || '')) nets.add(r.net);
    for (const net of nets) {
      const incs = chequearRed(this, net);
      const errores = incs.filter((i) => i.nivel === 'error');
      const hash = errores.map((i) => `${i.tipo}:${i.ramalId}`).join('|');
      const antes = this._chequeoHash[net];
      if (antes === hash) continue;
      this._chequeoHash[net] = hash;
      // Primera pasada tras CARGAR un plano existente: silenciosa (no molestar al abrir).
      if (antes === undefined) continue;
      if (!hash) continue; // quedó limpio: sin alerta
      const lista = errores.map((i, ix) => `${ix + 1}. ${i.msg}`).join('\n');
      this.triggerAlert(`Red ${net.toUpperCase()} — ${errores.length} incidencia(s)`, lista);
    }
  }

  triggerAccesorioModal(data: {
    ramalId: string;
    angleDeg: number;
    junctionIndex: number;
    point: number[];
    net: string;
    isTee?: boolean;
  }): void {
    if (this._onAccesorioModalCb) this._onAccesorioModalCb(data);
  }

  destroy(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._wheelRaf) {
      cancelAnimationFrame(this._wheelRaf);
      this._wheelRaf = 0;
      this._wheelAccum = 0;
    }
    this._teardownCanvasEvents();
  }

  setPageSize(w: number, h: number): void {
    this.pageW = w;
    this.pageH = h;
  }

  resizeCanvas(w: number, h: number): void {
    const dpr = this.dpr || 1;
    this.canv.width = Math.floor(w * dpr);
    this.canv.height = Math.floor(h * dpr);
    this.canv.style.width = w + 'px';
    this.canv.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
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

  _emitStatus(msg: string): void {
    if (this._onStatusCb) this._onStatusCb(msg);
  }

  _emitSelect(
    el: PlanoRamal | PlanoBajante | PlanoArea | PlanoTextAnnotation | PlanoDimension | null,
  ): void {
    if (!this._onSelectCb) return;
    if (!el) {
      this._onSelectCb(null);
      return;
    }
    const rest: Record<string, unknown> = { ...el };
    delete rest._circ;
    delete rest._ghost;
    delete rest._box;
    delete rest._polyBox;
    delete rest._labelBox;
    this._onSelectCb(rest);
  }

  _emitDelete(ids: string[]): void {
    if (this._onDeleteCb) this._onDeleteCb(ids);
  }

  /** Marca el trabajo como sucio: recalcula conexiones de red y accesorios, guarda un snapshot
   *  de historial y dispara el callback onDirty (que es quien guarda a disco/BD). */
  _markDirty(): void {
    this._dirty = true;
    // ponytail: los cálculos de red/contadores NO deben romper el guardado. El callback
    // _onDirtyCb (PdfViewer) es quien hace saveWork()+saveTrazosToDB(); si un cálculo lanza
    // antes, el guardado se perdía en silencio. Se aísla cada paso y siempre se notifica dirty.
    try {
      autoDetectRamalConnections(this);
      // Poda de referencias stale (después del auto-detect: fin/ini ya saneados) — un trazo
      // recortado/borrado deja de figurar en recibeDeIds/alimentaIds de la caja/bajante.
      podarReferenciasStaleDeBajantes(this);
      // Sello automático canal↔bajante por ramal (solo suma campos explícitos para que
      // menús/paneles lo muestren; nunca lanza).
      sellarAsociacionesCanalBajante(this);
    } catch (e) {
      devError('PlanoEngine _markDirty autoDetect:', e);
    }
    try {
      ensureRpCntRamal(this);
    } catch (e) {
      devError('PlanoEngine _markDirty ensureRpCnt:', e);
    }
    try {
      // ponytail: vent codo 90° that now forms T must become T, before counting
      fixVentCodoToTee(this);
    } catch (_e) {
      void _e;
    }
    try {
      // Sanado global de padres de tributarios: el label manda (T{n}{raíz}) — cualquier
      // camino que haya asignado un padre equivocado al tramo autocreado queda corregido.
      healTribPadres(this);
    } catch (e) {
      devError('PlanoEngine _markDirty healTribPadres:', e);
    }
    try {
      calcSanitaryAccessories(this);
    } catch (e) {
      devError('PlanoEngine _markDirty calcSanitary:', e);
    }
    try {
      calcHydroAccessories(this);
      this.chequearPresionGlobal();
    } catch (e) {
      devError('PlanoEngine _markDirty calcHydro:', e);
    }
    try {
      if (this._history) {
        this._history.saveSnapshot();
      }
    } catch (e) {
      devError('PlanoEngine _markDirty history:', e);
    }
    if (this._onDirtyCb) this._onDirtyCb();
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
    const netRef = net ?? this.activeNet;
    let best: Point | null = null;
    let minD = 16 / this.zoom;
    this.ramales.forEach((r) => {
      // Nunca pegar entre redes — elementos de redes distintas no deben conectarse solo porque
      // están visualmente cerca. Excepción: ventilación debe caer exactamente sobre un punto de
      // sanitaria (el marcador de reventilado existente depende de eso), así que se permite ese
      // único par.
      if (!netsSnapLinked(r.net, netRef)) return;
      // Los ramales no se conectan a tributarios — un trazo de tipo ramal solo pega a ramales.
      if (tipo === 'ramal' && r.tipo === 'tributario') return;
      r.pts.forEach(([rx, ry], idx) => {
        let thresh = 16 / this.zoom;
        if (idx > 0 && idx < r.pts.length - 1) {
          const ptA = r.pts[idx - 1];
          const ptB = r.pts[idx];
          const ptC = r.pts[idx + 1];
          const ax = ptB[0] - ptA[0],
            ay = ptB[1] - ptA[1];
          const bx = ptC[0] - ptB[0],
            by = ptC[1] - ptB[1];
          const lenA = Math.hypot(ax, ay),
            lenB = Math.hypot(bx, by);
          if (lenA > 0 && lenB > 0) {
            const cosAngle = (-ax * bx - ay * by) / (lenA * lenB);
            if (Math.abs(cosAngle) < 0.05) {
              thresh = 24 / this.zoom;
            }
          }
        }
        const d = Math.hypot(x - rx, y - ry);
        if (d < thresh && (!best || d < minD)) {
          minD = d;
          best = { x: rx, y: ry };
        }
      });
    });
    const bajThresh = 20 / this.zoom;
    const lvlLabel = this.nivelActual?.label ?? '';
    this.bajantes.forEach((b) => {
      if (this._hiddenNets.has(b.net)) return;
      if (!netsSnapLinked(b.net, netRef)) return;
      // El canal no atrae el snap: su _circ es media longitud y pegaría el extremo al CENTRO
      // del canal, borrando el punto de salida arbitrario del ramal de canal (orig. usuario).
      if (b.tipo === 'canal') return;
      // Bajante LLENO fuera del snap (orig. usuario): enganchar el trazo a un bajante que ya
      // tiene sus 2 asociaciones solo dispara "Bajante completo" sin conectar nada. Salvo
      // cuando el trazo es de canal (exento del tope) — ahí el snap es la única forma precisa
      // de aterrizar en el bajante.
      if (!permitirBajantesLlenos && bajanteLleno(b)) return;
      const disp = b.desplazamientos?.[lvlLabel] || {};
      const bx = b.x + (disp.dx || 0);
      const by = b.y + (disp.dy || 0);
      const d = Math.hypot(x - bx, y - by);
      if (d < bajThresh && (!best || d < minD)) {
        minD = d;
        best = { x: bx, y: by };
      }
    });
    // Snap al CUERPO de ramales de redes enlazadas (vent↔san) — el cursor del trazo activo se
    // acerca visualmente al ramal aunque no esté sobre un vértice, señalando la conexión antes de
    // finalizar el trazo.
    this.ramales.forEach((r) => {
      if (!netsSnapLinked(r.net, netRef)) return;
      if (tipo === 'ramal' && r.tipo === 'tributario') return;
      const segThresh = 12 / this.zoom;
      const p = snapToSegment(x, y, r.pts, segThresh);
      if (p && (!best || Math.hypot(p.x - x, p.y - y) < minD)) {
        minD = Math.hypot(p.x - x, p.y - y);
        best = p;
      }
    });
    return best;
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
    if (this.tipoTramo !== 'tributario' || !this.padreTributario || this.activeRamal) return null;
    const padre = this.ramales.find((r) => r.id === this.padreTributario);
    if (!padre) return null;
    return this._snapToSegment(x, y, padre.pts, 20 / this.zoom);
  }

  _wrapTouch(fn: (e: TouchEvent) => void): (e: TouchEvent) => void {
    return (e: TouchEvent) => {
      e.preventDefault();
      fn(e);
    };
  }

  _getPos(e: MouseEvent | TouchEvent): Point {
    const r = this._cachedRect();
    const t = e instanceof TouchEvent ? (e as TouchEvent).touches[0] : (e as MouseEvent);
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  /** Rect del canvas con caché de 32ms: rueda/pinch/mousemove lo piden 60-120/s. */
  _cachedRect(): DOMRect {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const c = this._rectCache;
    if (c && now - c.t < 32) return c.rect;
    const rect = this.canv.getBoundingClientRect();
    this._rectCache = { rect, t: now };
    return rect;
  }

  private _setupCanvasEvents(): void {
    this._touchStartHandler = this._wrapTouch(this._onDown as (e: TouchEvent) => void);
    this._touchMoveHandler = this._wrapTouch(this._onMove as (e: TouchEvent) => void);
    this._touchEndHandler = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length < 2) this._pinchDist0 = null;
      this._onUp(e);
    };

    this.canv.addEventListener('mousedown', this._onDown);
    this.canv.addEventListener('mousemove', this._onMove);
    this.canv.addEventListener('mouseup', this._onUp);
    this.canv.addEventListener('mouseleave', this._onUp);
    this.canv.addEventListener('dblclick', this._onDblClick);
    this.canv.addEventListener('wheel', this._onWheel, { passive: false });
    this.canv.addEventListener('touchstart', this._touchStartHandler, { passive: false });
    this.canv.addEventListener('touchmove', this._touchMoveHandler, { passive: false });
    this.canv.addEventListener('touchend', this._touchEndHandler, { passive: false });
    // Llamada/gesture del SO interrumpen el touch sin touchend: sin este reset, panning/drag
    // quedan huérfanos y el próximo touchmove de 1 dedo arrastra o panea sin querer.
    this.canv.addEventListener('touchcancel', this._touchEndHandler);
    document.addEventListener('keydown', this._onKeyDown);
  }

  private _teardownCanvasEvents(): void {
    this.canv.removeEventListener('mousedown', this._onDown);
    this.canv.removeEventListener('mousemove', this._onMove);
    this.canv.removeEventListener('mouseup', this._onUp);
    this.canv.removeEventListener('mouseleave', this._onUp);
    this.canv.removeEventListener('dblclick', this._onDblClick);
    this.canv.removeEventListener('wheel', this._onWheel);
    if (this._touchStartHandler)
      this.canv.removeEventListener('touchstart', this._touchStartHandler);
    if (this._touchMoveHandler) this.canv.removeEventListener('touchmove', this._touchMoveHandler);
    if (this._touchEndHandler) {
      this.canv.removeEventListener('touchend', this._touchEndHandler);
      this.canv.removeEventListener('touchcancel', this._touchEndHandler);
    }
    document.removeEventListener('keydown', this._onKeyDown);
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
  /** Cambia la red con la que se dibuja: lo que traces sale con su color y su prefijo de etiqueta
   *  (af (Agua Fría) → RAF, ac (Agua Caliente) → RAC, san (Sanitaria) → RS, vent (Ventilación) →
   *  REV, ll (Lluvias) → RALL, gas (Gas) → RG). Ej: pasar a 'san' hace que el próximo ramal se
   *  llame RS3. */
  setActiveNet(id: string): void {
    if (this.activeNet !== id) {
      this.activeNet = id;
      if (this._onActiveNetChangeCb) {
        this._onActiveNetChangeCb(id);
      }
    }
  }
  setTipoTramo(t: TramoType): void {
    this.tipoTramo = t;
  }
  /** Snap = el imán que obliga a los trazos a salir a 45°/90°. Apagarlo permite ángulos libres
   *  (si hay un trazo a medias se cancela). */
  setSnap(v: boolean): void {
    if (this.snapMode !== v && this.activeRamal) this.cancelRamal();
    this.snapMode = v;
  }

  setGridMode(v: boolean): void {
    this.gridMode = v;
    this.render();
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

  /** Fija la escala del plano (scaleM, la escala metros por pixel): 1 = 1:100, 0.5 = 1:50;
   *  acepta texto o número. Es la que convierte longitudes de pantalla a metros reales. */
  setScaleM(v: string | number): void {
    const prev = this.scaleM;
    _setScaleM(this, v);
    // La hoja mide en px de la escala ACTUAL: al cambiar la escala (re-base del doc a la
    // escala global, calibración) la medida de la lámina cambia con ella. Sin esto, el
    // lienzo queda con la medida vieja y el trazo se recorta en el borde de la hoja
    // ("recuadro", orig. usuario) hasta que el re-raster del fondo lo alcance.
    if (this.pageW && this.pageH && prev > 0 && Math.abs(this.scaleM - prev) > 1e-9) {
      const f = this.scaleM / prev;
      this.setPageSize(this.pageW * f, this.pageH * f);
    }
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
  createTeeCapStub(ramalId: string, accMedIdx: number, accId: 'tapon' | 'llaveTerminal'): void {
    handleCreateTeeCapStub(this, ramalId, accMedIdx, accId);
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
  deleteSegmentAt(cx: number, cy: number): void {
    _deleteSegmentAt(this, cx, cy);
  }

  getBajantesFantasma(): PlanoBajante[] {
    return _getBajantesFantasma(this);
  }
  getSelectedGhost(): CrossFloorGhost | null {
    if (!this.selectedGhostId) return null;
    return this.crossFloorGhosts.find((g) => g.id === this.selectedGhostId) || null;
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
  saveWork(): import('./PlanoPersistence').PlanoWorkData {
    return serializeWork(this);
  }

  /** Aplica un trabajo guardado (texto JSON u objeto) al motor. */
  loadWork(json: string | object): void {
    try {
      const d = (typeof json === 'string'
        ? JSON.parse(json)
        : json) as unknown as import('./PlanoPersistence').PlanoWorkData;
      applyWorkData(
        this as unknown as {
          scaleM: number;
          definedScaleM: number;
          activeNet: string;
          lineWidthScale?: number;
          ramales: unknown[];
          dims: unknown[];
          textAnnots: unknown[];
          bajantes: unknown[];
          areas: unknown[];
          nptLevels: unknown[];
          crossFloorGhosts: unknown[];
          guideLines: unknown[];
          selId: string | null;
          activeRamal: unknown;
          activeArea: unknown;
          _netCounts: Record<string, PlanoNetCounts>;
          _dirty: boolean;
          render: () => void;
          [key: string]: unknown;
        },
        d,
      );
      autoDetectRamalConnections(this);
      podarReferenciasStaleDeBajantes(this);
      sellarAsociacionesCanalBajante(this);
      ensureRpCntRamal(this);
      if (this._history) {
        this._history.saveSnapshot();
      }
    } catch (e) {
      devError('Error loading work:', e);
    }
  }

  /** Ajusta la página PDF dentro del viewport con margen. */
  fitPage(): void {
    if (!this.pageW || !this.pageH) return;
    const s = Math.min(
      (this.cw.clientWidth - 20) / this.pageW,
      (this.cw.clientHeight - 36) / this.pageH,
    );
    this.zoom = s;
    this.offX = (this.pageW * (1 - s)) / 2;
    this.offY = (this.cw.clientHeight - this.pageH * s) / 2;
    this.render();
  }

  /** Último transform aplicado al wrapper: re-escribirlo cada cuadro dispara al
   *  MutationObserver del fondo (re-raster) aunque el zoom no cambió. */
  private _lastTransform = '';
  /** Reajusta el lienzo de DIBUJO para que cubra el ÁREA VISIBLE, no solo la caja de la hoja.
   *  Con zoom > 1 el fondo se sale de la hoja (lo recorta el contenedor) pero el lienzo de
   *  dibujo medía lo mismo que la hoja → el trazo se cortaba en el borde de la hoja: un
   *  "recuadro" que partía la geometría (laterales y superiores recortados, orig. usuario).
   *  Aquí el lienzo cubre la hoja×zoom y el viewport: el trazo se recorta JUSTO donde se
   *  recorta el fondo. */
  ensureCanvasSize(): void {
    const t = tamanoLienzoDibujo({
      visW: this.cw?.clientWidth || 0,
      visH: this.cw?.clientHeight || 0,
      pageW: this.pageW,
      pageH: this.pageH,
      zoom: this.zoom,
    });
    if (t.w === this._canvasW && t.h === this._canvasH) return;
    this._canvasW = t.w;
    this._canvasH = t.h;
    this.resizeCanvas(t.w, t.h);
  }
  private _canvasW = 0;
  private _canvasH = 0;

  /** Repinta el canvas con todas las capas (cotas, ramales, bajantes y activos). */
  render(): void {
    this.ensureCanvasSize();
    const ctx = this.ctx;
    const w = this.canv.width,
      h = this.canv.height;
    // ponytail: canvas sin tamaño (montaje/viewport oculto) — pintar es trabajo tirado.
    if (w === 0 || h === 0) return;
    // Sin LÁMINA conocida el contenedor todavía no tiene su tamaño final: pintar el trazo
    // ahí lo deja en un recuadro provisional y el dibujo salta al llegar el PDF (orig.
    // usuario). El motor espera a que la lámina marque la medida buena.
    if (!this.pageW || !this.pageH) return;
    ctx.clearRect(0, 0, w, h);

    if (this.pdfWrap) {
      const t = `translate(${this.offX}px,${this.offY}px) scale(${this.zoom})`;
      if (t !== this._lastTransform) {
        this._lastTransform = t;
        this.pdfWrap.style.transform = t;
        this.pdfWrap.style.transformOrigin = '0 0';
        this.pdfWrap.style.willChange = 'transform';
      }
    }

    if (this.gridMode) renderGrid(ctx, this);
    renderGuideLines(ctx, this);
    renderDims(ctx, this);
    renderTexts(ctx, this);
    renderAreas(ctx, this);
    renderRamales(ctx, this);
    renderNetCrossings(ctx, this);
    renderBajantes(ctx, this);
    renderGhosts(ctx, this);
    renderCrossFloorGhosts(ctx, this);
    renderDimGhost(ctx, this);
    renderGuideGhost(ctx, this);
    renderCanalGhost(ctx, this);
    renderActiveArea(ctx, this);
    renderActiveRamal(ctx, this);

    if (this.marqueeRect) {
      const { x1, y1, x2, y2 } = this.marqueeRect;
      ctx.save();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1 * this.zoom;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.fillStyle = 'rgba(59,130,246,0.08)';
      ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.restore();
    }
  }

  scheduleRender(): void {
    if (this._needsRender) return;
    this._needsRender = true;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._needsRender = false;
      this.render();
    });
  }

  _onDownHandler(e: MouseEvent | TouchEvent): void {
    // 2º dedo del pinch (o palma apoyada): NO re-ejecutar hit-test/selección/dibujo — el
    // touchstart de CADA dedo entra aquí y crearía vértices o selecciones fantasma.
    if (e instanceof TouchEvent && e.touches.length > 1) return;
    const { x, y } = this._getPos(e);

    if ((e instanceof MouseEvent && e.button === 1) || this.tool === 'pan') {
      this.panning = true;
      this.panX0 = x - this.offX;
      this.panY0 = y - this.offY;
      this.canv.style.cursor = 'grabbing';
      return;
    }

    if (e instanceof MouseEvent && e.button === 2) {
      // Clic derecho durante el dibujo de un ramal: terminar el ramal
      if (this.activeRamal && this.tool === 'line') {
        this.finishRamal();
        return;
      }
      const hit = hitTestRightClick(this, x, y, e.clientX, e.clientY);
      if (hit) {
        const el = hit.element;
        // No cambiar la selección con el clic derecho — solo mostrar el menú contextual
        if (this._onContextMenuCb) {
          this._onContextMenuCb(
            el,
            hit.clientX,
            hit.clientY,
            hit.isGhostClick,
            hit.ramalEndpoint || null,
            hit.midRamalHit || null,
          );
        }
        this.render();
      }
      return;
    }

    // Doble clic durante el dibujo de un ramal: terminar el ramal (solo efectivo con botón
    // izquierdo)
    if (e instanceof MouseEvent && e.detail >= 2 && this.activeRamal && this.tool === 'line') {
      this.finishRamal();
      return;
    }

    if (this._lockedNets.has(this.activeNet)) return;

    // Red OCULTA (orig. usuario): no se puede dibujar en ella — los trazos nacerían
    // invisibles. El aviso MODAL ya salió al SELECCIONAR la red (handleSelectNet en el
    // visor); aquí solo estado, sin duplicar la modal. Selección también: los hits de
    // redes ocultas se filtran en los hit-tests.
    if (this.tool !== 'sel' && this._hiddenNets.has(this.activeNet)) {
      const netObj = NETS.find((n) => n.id === this.activeNet);
      this._emitStatus(
        `${netObj ? netObj.name : this.activeNet} está oculta — muéstrala en la barra de redes para dibujar en ella.`,
      );
      return;
    }

    if (this.activeNetworks && !this.activeNetworks.has(this.activeNet)) {
      const netObj = NETS.find((n) => n.id === this.activeNet);
      const netName = netObj ? netObj.name : this.activeNet;
      this.triggerAlert(
        'Red inactiva',
        `Debe activar la red de ${netName} en la información general`,
      );
      return;
    }

    const p = this.toPlane(x, y);

    if (this.tool === 'sel') {
      const lblDragResult = hitTestBajanteLabelForDrag(this, x, y);
      if (lblDragResult) {
        // Este hit-test solo coincide con la posición REAL de la etiqueta del bajante (_labelBox
        // / labelX,Y) — nunca revisa el _ghostLabelBox desplazado del fantasma — así que siempre
        // es un arrastre de etiqueta del padre. _lblDragIsParent debe fijarse aquí explícitamente:
        // esta ruta se saltea handleSelectDown por completo (retorno temprano), así que sin esto
        // conservaba cualquier valor viejo de la INTERACCIÓN ANTERIOR. Si esa interacción previa
        // había seleccionado el renderizado FANTASMA del mismo bajante (_lblDragIsParent en
        // false), arrastrar lo que parecía la etiqueta real aquí escribía en silencio en
        // ghostData — moviendo el fantasma a la posición del clic en vez de la etiqueta real que
        // el usuario arrastraba.
        this._lblDragIsParent = true;
        this.lblDrag = lblDragResult;
        return;
      }
      handleSelectDown(
        this,
        x,
        y,
        e instanceof MouseEvent && (e.ctrlKey || false),
        e instanceof MouseEvent && e.shiftKey,
      );
    } else if (this.tool === 'line') {
      handleLineDown(this, p.x, p.y);
    } else if (this.tool === 'dim') {
      handleDimDown(this, p.x, p.y);
    } else if (this.tool === 'guide') {
      handleGuideDown(this, p.x, p.y);
    } else if (this.tool === 'text') {
      handleTextDown(this, p.x, p.y);
    } else if (this.tool === 'baj') {
      handleBajanteDown(this, p.x, p.y);
    } else if (this.tool === 'mon') {
      handleMontanteDown(this, p.x, p.y);
    } else if (this.tool === 'red_pub') {
      handleRedPublicaDown(this, p.x, p.y);
    } else if (this.tool === 'cont') {
      handleContadorDown(this, p.x, p.y);
    } else if (this.tool === 'calent') {
      handleCalentadorDown(this, p.x, p.y);
    } else if (this.tool === 'canal') {
      handleCanalDown(this, p.x, p.y);
    } else if (this.tool === 'caja') {
      handleCajaDown(this, p.x, p.y);
    } else if (this.tool === 'area') {
      handleAreaDown(this, p.x, p.y);
    } else if (this.tool === 'erase') {
      handleEraseDown(this, x, y);
    }
  }

  _onMouseMoveHandler(e: MouseEvent | TouchEvent): void {
    // PINCH (≥2 dedos): zoom anclado al punto medio — modo consulta móvil/tablet. Con varios
    // dedos no se dibuja ni se arrastra nada; el estado de drag queda congelado hasta levantar.
    if (e instanceof TouchEvent && e.touches.length >= 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const rect = this._cachedRect();
      const mx = (a.clientX + b.clientX) / 2 - rect.left;
      const my = (a.clientY + b.clientY) / 2 - rect.top;
      if (this._pinchDist0 == null) {
        this._pinchDist0 = dist;
        this._pinchZoom0 = this.zoom;
        return;
      }
      zoomAnclado(this, (this._pinchZoom0 * dist) / this._pinchDist0, mx, my);
      return;
    }
    this._pinchDist0 = null;
    const { x, y } = this._getPos(e);
    this._lastMouseCvs = { x, y };
    if (this.panning) {
      this.offX = x - this.panX0;
      this.offY = y - this.panY0;
      this.scheduleRender();
      return;
    }
    const hasDrag =
      this.ghostDrag ||
      this.guideDrag ||
      this.bajDrag ||
      this.canalResizeDrag ||
      this.lblDrag ||
      this.txtDrag ||
      this.txtResize ||
      this.dimLblDrag ||
      this.areaDrag ||
      this.areaPtDrag ||
      this.ptDrag ||
      this.ramalDrag ||
      this.multiDrag;
    if (hasDrag) {
      handleDragMove(this, x, y);
    } else if (this.marqueeRect) {
      this.marqueeRect.x2 = x;
      this.marqueeRect.y2 = y;
      this.scheduleRender();
    } else if (
      this.activeRamal ||
      this._dimStart ||
      this._guideStart ||
      this._canalStart ||
      this._canalEje ||
      this.activeArea
    ) {
      handleDrawingMouseMove(this, x, y);
    }
  }

  _onMouseUpHandler(e: MouseEvent | TouchEvent): void {
    if (this.panning) {
      this.panning = false;
      this.canv.style.cursor =
        this.tool === 'pan' ? 'grab' : this.tool === 'sel' ? 'default' : 'crosshair';
    }
    const isCtrl = (e instanceof MouseEvent && e.ctrlKey) || false;
    handleDragUp(this, isCtrl);
  }

  _onDblClickHandler(e: MouseEvent): void {
    void e;
    handleDoubleClick(this);
  }

  /** Zoom por botones (modo consulta móvil/tablet): escala alrededor del centro del canvas. */
  zoomStep(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const rect = this.canv.getBoundingClientRect();
    zoomAnclado(this, this.zoom * factor, rect.width / 2, rect.height / 2);
  }

  _onWheelHandler(e: WheelEvent): void {
    e.preventDefault();
    // Normaliza deltaMode: 0 = px, 1 = líneas (~16px), 2 = páginas (~800px).
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1;
    const norm = e.deltaY * unit;
    if (!Number.isFinite(norm) || norm === 0) return;
    const rect = this._cachedRect();
    this._wheelMX = e.clientX - rect.left;
    this._wheelMY = e.clientY - rect.top;
    // Acumula y aplica UNA vez por cuadro: 60-120 ev/s → 1 zoom (sin tirón).
    this._wheelAccum += norm;
    if (this._wheelRaf) return;
    this._wheelRaf = requestAnimationFrame(() => {
      this._wheelRaf = 0;
      // Tope ±120 por cuadro (~13% de salto máx): un fling que llenaba el ±400 viejo
      // aplicaba 38% de golpe y se veía como tirón aunque la CPU fuera libre.
      const accum = Math.max(-120, Math.min(120, this._wheelAccum));
      this._wheelAccum = 0;
      if (accum === 0) return;
      zoomAnclado(this, this.zoom * Math.exp(-accum * 0.0012), this._wheelMX, this._wheelMY);
    });
  }

  _onKeyDownHandler(e: KeyboardEvent): void {
    handleKeyDown(this, e);
  }
}
