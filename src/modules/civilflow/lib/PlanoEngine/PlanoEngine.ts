import { NETS, netsSnapLinked, initNetCounts } from './PlanoState';
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
  handleEraseDown,
  handleAreaDown,
  eraseRamalAt,
  handleDrawingMouseMove,
  handleDoubleClick,
  deleteSegmentAt as _deleteSegmentAt,
  setScaleM as _setScaleM,
  setDefinedScaleM as _setDefinedScaleM,
} from './PlanoEngineDrawing';
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
  ensureRpCntRamal,
} from './PlanoEngineNetwork';
import { PlanoHistory } from './PlanoHistory';
import { PlanoNetworkModel } from './PlanoNetworkModel';
import { hitTestRightClick, hitTestBajanteLabelForDrag } from './PlanoEngineHitTesting';

export { NETS };

export type ToolType =
  | 'sel'
  | 'line'
  | 'dim'
  | 'text'
  | 'baj'
  | 'mon'
  | 'pan'
  | 'area'
  | 'erase'
  | 'segdel'
  | 'delm'
  | 'red_pub'
  | 'cont'
  | 'calent'
  | 'canal'
  | 'guide';
export type TramoType = 'ramal' | 'tributario';

interface Point {
  x: number;
  y: number;
}

type SelectCallback = (el: Record<string, unknown> | null) => void;
type StatusCallback = (msg: string) => void;
type UpdateCallback = (data: unknown) => void;
type DirtyCallback = () => void;

export interface ElementItem {
  type: string;
  id: string;
  label: string;
  totalL: number;
  segs: number;
  piso: string;
  tipo: string;
  padre?: string | null;
  pendiente?: number;
  diametro?: string;
}

/**
 * Motor CAD central para el dibujo de planos de ingeniería civil.
 * Gestiona zoom/pan, el estado de la herramienta, los arrays de elementos (ramales, bajantes,
 * áreas, cotas, textos), el snap, las capas por red, el historial de deshacer/rehacer y el
 * pipeline de renderizado del canvas.
 */
export default class PlanoEngine implements IPlanoEngineCore {
  cw: HTMLElement;
  pdfWrap: HTMLElement | null;
  canv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  zoom!: number;
  offX!: number;
  offY!: number;
  dpr!: number;
  tool!: ToolType;
  activeNet!: string;
  tipoTramo!: TramoType;
  snapMode!: boolean;
  scaleM!: number;
  definedScaleM!: number;
  pageW!: number;
  pageH!: number;

  ramales!: PlanoRamal[];
  dims!: PlanoDimension[];
  textAnnots!: PlanoTextAnnotation[];
  private _networkModel = new PlanoNetworkModel();
  get bajantes(): PlanoBajante[] {
    return this._networkModel.bajantes;
  }
  set bajantes(v: PlanoBajante[]) {
    this._networkModel.bajantes = v;
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
  dimDrag!: { id: string; startX: number; startY: number } | null;
  panning!: boolean;
  panX0!: number;
  panY0!: number;
  mouseX!: number;
  mouseY!: number;
  ghostDrag!: { id: string; startX: number; startY: number; baseDx: number; baseDy: number } | null;
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
    anchorX: number;
    anchorY: number;
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
  _canalStart!: Point | null;
  nivelActual!: PlanoLevel | null;
  nptLevels!: PlanoLevel[];
  _hiddenNets!: Set<string>;
  _lockedNets!: Set<string>;
  activeNetworks!: Set<string> | undefined;
  private _touchStartHandler?: (e: TouchEvent) => void;
  private _touchMoveHandler?: (e: TouchEvent) => void;
  private _touchEndHandler?: (e: TouchEvent) => void;
  _loadedPlanId!: string | number | null;
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

  /**
   * @param cw - Elemento contenedor (el wrapper del viewport).
   * @param pdfWrap - Elemento wrapper del canvas de PDF (fondo PDF).
   * @param canv - Elemento canvas de dibujo.
   */
  constructor(cw: HTMLElement, pdfWrap: HTMLElement | null, canv: HTMLCanvasElement) {
    this.cw = cw;
    this.pdfWrap = pdfWrap;
    this.canv = canv;
    this.ctx = canv.getContext('2d')!;

    this.zoom = 1;
    this.offX = 0;
    this.offY = 0;
    this.dpr = 1;
    this.tool = 'sel';
    this.activeNet = 'af';
    this.tipoTramo = 'ramal';
    this.snapMode = true;
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
    this.dimDrag = null;
    this.panning = false;
    this.panX0 = 0;
    this.panY0 = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.ghostDrag = null;
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
    this._canalStart = null;
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
  }

  /** Registra el callback de cambios de selección de elemento. */
  onSelect(cb: SelectCallback): void {
    this._onSelectCb = cb;
  }
  /** Registra el callback de mensajes de la barra de estado. */
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
  /** Registra el callback de estado sucio (trabajo modificado). */
  onDirty(cb: DirtyCallback): void {
    this._onDirtyCb = cb;
  }
  /** Registra el callback de eventos de borrado de elementos. */
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
    return { x: px * this.zoom + this.offX, y: py * this.zoom + this.offY };
  }
  toPlane(cx: number, cy: number): Point {
    return { x: (cx - this.offX) / this.zoom, y: (cy - this.offY) / this.zoom };
  }
  pxToM(px: number): number {
    return +((px / 96) * 2.54 * this.scaleM).toFixed(3);
  }
  mm2cvs(mm: number): number {
    return ((mm * 96) / 25.4) * this.zoom;
  }

  // Inversa de pxToM: convierte una longitud REAL en cm a px de coordenada de plano (el mismo
  // espacio que las x/y de ramales/bajantes — independiente de zoom/pan), para que el
  // rectángulo de base/altura dibujado de un canal escale con la escala real del plano igual
  // que totalL de un ramal (vía pxToM) ya ata la distancia de coordenada de plano a la
  // longitud real.
  cmToPlanePx(cm: number): number {
    return ((cm / 100) * 96) / (2.54 * (this.scaleM || 0.5));
  }

  // cmToPlanePx aplicado a la transformación actual del canvas — solo para renderizar; nunca
  // usar esto para guardar geometría (cambia con el zoom).
  cmToCanvasPx(cm: number): number {
    return this.cmToPlanePx(cm) * this.zoom;
  }

  realMmToCanvasPx(realRadiusMm: number): number {
    // El piso se deja pequeño a propósito: en escalas arquitectónicas comunes (1:50, etc.)
    // estos símbolos deben caber dentro de una pared de ~15cm, que en papel a 1:50 son solo
    // ~3mm — un piso generoso aquí los haría imprecisos de escala (visiblemente más grandes
    // que la pared donde están).
    const MIN_PAPER_MM = 1;
    const defScale = this.definedScaleM || this.scaleM || 0.5;
    const paperMm = realRadiusMm / (100 * defScale);
    return this.mm2cvs(Math.max(MIN_PAPER_MM, paperMm));
  }

  get labelScaleM(): number {
    const defScale = this.definedScaleM || this.scaleM;
    return Math.max(0.1, Math.min(3.0, 0.5 / defScale));
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
   *  de historial y dispara el callback onDirty. */
  _markDirty(): void {
    this._dirty = true;
    autoDetectRamalConnections(this);
    ensureRpCntRamal(this);
    calcSanitaryAccessories(this);
    calcHydroAccessories(this);
    if (this._history) {
      this._history.saveSnapshot();
    }
    if (this._onDirtyCb) this._onDirtyCb();
  }

  snapAngle(x0: number, y0: number, x1: number, y1: number, net?: string, tipo?: string): Point {
    const dx = x1 - x0,
      dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return { x: x1, y: y1 };
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    // Algunas redes solo permiten ciertas orientaciones (ver checkRamalAngles): los tributarios
    // de af/ac deben caer en una cuadrícula de 90°, todo lo demás (incl. san/ll, que no tiene
    // regla propia de orientación fija) usa la cuadrícula más laxa de 45° — pegar a 45° ahí
    // nunca produce un ángulo inválido.
    const isTributarioAcAf = (net === 'af' || net === 'ac') && tipo === 'tributario';
    const allowed = isTributarioAcAf ? [0, 90, 180, -90] : [0, 45, 90, 135, 180, -135, -90, -45];
    let best = 0,
      minDiff = 999;
    allowed.forEach((a) => {
      const diff = Math.abs(((deg - a + 540) % 360) - 180);
      if (diff < minDiff) {
        minDiff = diff;
        best = a;
      }
    });
    const sr = (best * Math.PI) / 180;
    return { x: x0 + dist * Math.cos(sr), y: y0 + dist * Math.sin(sr) };
  }

  snapToExisting(x: number, y: number): Point | null {
    let best: Point | null = null;
    let minD = 16 / this.zoom;
    this.ramales.forEach((r) => {
      // Nunca pegar entre redes — elementos de redes distintas no deben conectarse solo porque
      // están visualmente cerca. Excepción: ventilación debe caer exactamente sobre un punto de
      // sanitaria (el marcador de reventilado existente depende de eso), así que se permite ese
      // único par.
      if (!netsSnapLinked(r.net, this.activeNet)) return;
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
      if (!netsSnapLinked(b.net, this.activeNet)) return;
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
      if (!netsSnapLinked(r.net, this.activeNet)) return;
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
    const r = this.canv.getBoundingClientRect();
    const t = e instanceof TouchEvent ? (e as TouchEvent).touches[0] : (e as MouseEvent);
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  private _setupCanvasEvents(): void {
    this._touchStartHandler = this._wrapTouch(this._onDown as (e: TouchEvent) => void);
    this._touchMoveHandler = this._wrapTouch(this._onMove as (e: TouchEvent) => void);
    this._touchEndHandler = (e: TouchEvent) => {
      e.preventDefault();
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
    if (this._touchEndHandler) this.canv.removeEventListener('touchend', this._touchEndHandler);
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

  /** @param t - Herramienta a activar (sel, line, dim, text, baj, mon, pan, area, erase, etc). */
  setTool(t: ToolType): void {
    _setTool(this, t);
  }
  /** @param id - Id de red a fijar como activa (af, ac, san, vent, ll, gas). Dispara el callback
   *  de cambio de red activa. */
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
  /** @param v - Activar/desactivar el snap de ángulos. */
  setSnap(v: boolean): void {
    this.snapMode = v;
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

  /** @param v - Factor de escala (p.ej. 1 para 1:100, 0.5 para 1:50). Acepta string o número. */
  setScaleM(v: string | number): void {
    _setScaleM(this, v);
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

  /** @param netId - Id de red. Devuelve la lista plana de elementos (ramales, bajantes, áreas)
   *  de esa red. */
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
  deleteSelected(ids?: string[]): void {
    _deleteSelected(this, ids);
  }

  /**
   * Lógica de borrado/recorte usada por la herramienta borrador — expuesta públicamente para
   * que el manejador de teclado pueda enrutar Supr/Delete por la misma regla "recortar el
   * segmento de extremo si lo hay, si no borrar el elemento completo" en vez de siempre llamar
   * a deleteSelected.
   */
  handleEraseDown(x: number, y: number): void {
    handleEraseDown(this, x, y);
  }

  /**
   * La misma regla de recortar-o-borrar aplicada directamente a un ramal ya seleccionado — la
   * usa el manejador de teclado, que ya tiene `sel` y no puede ejecutar handleEraseDown (volvería
   * a correr selectAt contra el cursor y perdería la selección cuando el cursor se hubiera
   * alejado del ramal).
   */
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
  /** Deshace el último snapshot de historial. */
  undoLast(): void {
    this._history.undoLast();
  }
  /** Rehace el último snapshot deshecho. */
  redoLast(): void {
    this._history.redoLast();
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

  /** Deserializa y aplica un objeto de trabajo previamente guardado. @param json - String JSON o
   *  objeto parseado. */
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
      ensureRpCntRamal(this);
      if (this._history) {
        this._history.saveSnapshot();
      }
    } catch (e) {
      devError('Error loading work:', e);
    }
  }

  /** @param delta - Incremento de zoom (positivo = acercar). @param cx - Centro X en coords de
   *  canvas (por defecto el centro). @param cy - Centro Y. */
  doZoom(delta: number, cx?: number, cy?: number): void {
    if (cx === undefined) {
      cx = this.cw.clientWidth / 2;
      cy = this.cw.clientHeight / 2;
    }
    const nz = Math.max(0.05, Math.min(6, this.zoom + delta));
    this.offX = cx - (cx - this.offX) * (nz / this.zoom);
    this.offY = cy! - (cy! - this.offY) * (nz / this.zoom);
    this.zoom = nz;
    this.render();
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

  /** Redibujo completo: limpia el canvas, reposiciona el wrapper del PDF y renderiza todas las
   *  capas (cuadrícula, cotas, textos, áreas, ramales, cruces, bajantes, fantasmas, elementos
   *  activos). */
  render(): void {
    const ctx = this.ctx;
    const w = this.canv.width,
      h = this.canv.height;
    ctx.clearRect(0, 0, w, h);

    if (this.pdfWrap) {
      this.pdfWrap.style.transform = `translate(${this.offX}px,${this.offY}px) scale(${this.zoom})`;
      this.pdfWrap.style.transformOrigin = '0 0';
      this.pdfWrap.style.willChange = 'transform';
    }

    renderGrid(ctx, this);
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
      handleSelectDown(this, x, y, e instanceof MouseEvent && (e.ctrlKey || false));
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
    } else if (this.tool === 'area') {
      handleAreaDown(this, p.x, p.y);
    } else if (this.tool === 'erase') {
      handleEraseDown(this, x, y);
    }
  }

  _onMouseMoveHandler(e: MouseEvent | TouchEvent): void {
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
      this.bajDrag ||
      this.canalResizeDrag ||
      this.lblDrag ||
      this.txtDrag ||
      this.txtResize ||
      this.dimLblDrag ||
      this.areaDrag ||
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

  _onWheelHandler(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : +0.08;
    const rect = this.canv.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const nz = Math.max(0.05, Math.min(6, this.zoom + delta));
    this.offX = mx - (mx - this.offX) * (nz / this.zoom);
    this.offY = my - (my - this.offY) * (nz / this.zoom);
    this.zoom = nz;
    this.render();
  }

  _onKeyDownHandler(e: KeyboardEvent): void {
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'SELECT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    )
      return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 'z') {
      this.undoLast();
      e.preventDefault();
      return;
    }
    if (e.ctrlKey && k === 'y') {
      this.redoLast();
      e.preventDefault();
      return;
    }
    if (e.ctrlKey && k === 's') {
      e.preventDefault();
      return;
    }
    if (k === 's') {
      this.setTool('sel');
      e.preventDefault();
    } else if (k === 'l') {
      this.setTool('line');
      e.preventDefault();
    } else if (k === 'c') {
      // 'C' hace doble función: Contador en af/gas, Canal en el resto — el canal requiere la
      // red de agua lluvias ('ll') ACTIVA en la sesión (espejo de isToolDisabledForNet('canal',
      // ...) de PdfViewerToolbar): el atajo no debe saltarse la regla que el botón aplica.
      if (
        this.activeNet === 'll' &&
        (!this.activeNetworks || this.activeNetworks.has('recolectora'))
      ) {
        this.setTool('canal');
      } else {
        this.setTool('cont');
      }
      e.preventDefault();
    } else if (k === 'h') {
      // El calentador es solo ac/gas: el botón de af se quitó de la barra, así que el atajo no
      // debe saltarse la misma restricción.
      if (['ac', 'gas'].includes(this.activeNet)) {
        this.setTool('calent');
      }
      e.preventDefault();
    } else if (k === 'd') {
      this.setTool('dim');
      e.preventDefault();
    } else if (k === 'u') {
      // 'G' colisionaba con el atajo mostrado para Snap — U (de "gUía") queda libre.
      this.setTool('guide');
      e.preventDefault();
    } else if (k === 't') {
      this.setTool('text');
      e.preventDefault();
    }
    // Bajante solo en san/vent/ll, montante solo en gas/ac/af — misma regla que PdfViewerToolbar.tsx
    // aplica en sus botones (isToolDisabledForNet); duplicada aquí como chequeo plano en vez de
    // importada, porque lib/PlanoEngine no debe depender de components/.
    else if (k === 'b') {
      if (['san', 'vent', 'll'].includes(this.activeNet)) {
        this.setTool('baj');
      }
      e.preventDefault();
    } else if (k === 'm') {
      if (['gas', 'ac', 'af'].includes(this.activeNet)) {
        this.setTool('mon');
      }
      e.preventDefault();
    } else if (k === 'a') {
      this.setTool('area');
      e.preventDefault();
    } else if (k === 'e') {
      this.setTool('erase');
      e.preventDefault();
    } else if (k === 'x') {
      this.setTool('delm');
      e.preventDefault();
    } else if (k === 'k') {
      this.setTool('segdel');
      e.preventDefault();
    } else if (k === ' ') {
      this.setTool(this.tool === 'pan' ? 'sel' : 'pan');
      e.preventDefault();
    } else if (k === 'enter') {
      if (this.activeRamal) {
        this.finishRamal();
        e.preventDefault();
      } else if (this.activeArea) {
        this.finishArea();
        e.preventDefault();
      }
    } else if (k === 'escape') {
      if (this.activeRamal) {
        this.cancelRamal();
        e.preventDefault();
      } else if (this.activeArea) {
        this.cancelArea();
        e.preventDefault();
      } else if (this._dimStart) {
        this._dimStart = null;
        this.render();
        e.preventDefault();
      } else if (this._guideStart) {
        this._guideStart = null;
        this.render();
        e.preventDefault();
      } else if (this._canalStart) {
        this._canalStart = null;
        this.render();
        e.preventDefault();
      } else {
        if (this.tool !== 'sel') {
          this.setTool('sel');
          e.preventDefault();
        } else {
          this.selId = null;
          this._emitSelect(null);
          this.render();
        }
      }
    } else if (k === 'delete' || k === 'backspace') {
      if (!this.activeRamal && !this.activeArea) {
        if (this.multiSel && this.multiSel.length > 0) {
          this.deleteSelected(this.multiSel);
          this.multiSel = [];
        } else if (this.selId) {
          const sel = this.getSelected() as Record<string, unknown> | null;
          // Ramal (o tributario) con más de 2 puntos: recortar el segmento del extremo donde el
          // usuario hizo clic para seleccionar (guardado en _selPointCvs al seleccionar), no el
          // último punto del trazo: el usuario selecciona el segmento inicial y Suprimir le
          // borraba el final cuando el cursor ya no está sobre el segmento elegido. El chequeo
          // por pts (no por tipo === 'ramal') cubre también tributarios y ramales legados sin
          // campo tipo; las guías (GL) se excluyen porque no viven en engine.ramales.
          const ptsArr = ((sel as { pts?: unknown } | null)?.pts ?? []) as number[][];
          const hasPolyline =
            ptsArr.length > 2 && !String((sel as { id?: unknown }).id ?? '').startsWith('GL');
          if (hasPolyline) {
            const sp = this._selPointCvs;
            const cv =
              sp && sp.x > 0
                ? { x: sp.x, y: sp.y }
                : (() => {
                    const last = ptsArr[ptsArr.length - 1];
                    return this.toCvs(last[0], last[1]);
                  })();
            eraseRamalAt(this, sel as never, cv.x, cv.y);
          } else {
            this.deleteSelected();
          }
        }
        e.preventDefault();
      }
    }
  }
}
