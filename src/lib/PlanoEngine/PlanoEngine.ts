import { NETS, netsSnapLinked } from './PlanoState';
import type {
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
  MultiDragOrigData,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { renderDims, renderDimGhost } from './renderers/renderDimensions';
import { renderTexts } from './renderers/renderTextAnnotations';
import { renderAreas, renderActiveArea } from './renderers/renderAreas';
import { renderBajantes, renderGhosts } from './renderers/renderBajantes';
import { renderRamales, renderActiveRamal } from './renderers/renderRamales';
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
  _strokeAngle,
  _calcPolyArea,
  handleLineDown,
  handleDimDown,
  handleTextDown,
  handleBajanteDown,
  handleMontanteDown,
  handleRedPublicaDown,
  handleContadorDown,
  handleCalentadorDown,
  handleEraseDown,
  handleAreaDown,
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
  deleteSelected as _deleteSelected,
  updateSelected as _updateSelected,
  updateElementById as _updateElementById,
  rotateLabelSnap as _rotateLabelSnap,
  resetLabel as _resetLabel,
  handleSelectDown,
  handleDragMove,
  handleDragUp,
} from './PlanoEngineSelection';
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
  autoDetectRamalConnections,
  ensureRpCntRamal,
} from './PlanoEngineNetwork';
import { PlanoHistory } from './PlanoHistory';
import { initEngineState } from './DragStateMachine';
import { hitTestRightClick, hitTestBajanteLabelForDrag } from './PlanoEngineHitTesting';

export { NETS };

type ToolType = 'sel' | 'line' | 'dim' | 'text' | 'baj' | 'mon' | 'pan' | 'area' | 'erase' | 'segdel' | 'delm' | 'red_pub' | 'cont' | 'calent';
type TramoType = 'ramal' | 'tributario';

interface Point { x: number; y: number }

type SelectCallback = (el: Record<string, unknown> | null) => void;
type StatusCallback = (msg: string) => void;
type UpdateCallback = (data: unknown) => void;
type DirtyCallback = () => void;

interface ElementItem {
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
  bajantes!: PlanoBajante[];
  areas!: PlanoArea[];
  activeRamal!: PlanoActiveRamal | null;
  padreTributario!: string | null;
  activeArea!: PlanoActiveArea | null;
  selId!: string | null;
  areaDrag!: { id: string; startX: number; startY: number } | null;
  dimDrag!: { id: string; startX: number; startY: number } | null;
  panning!: boolean;
  panX0!: number;
  panY0!: number;
  mouseX!: number;
  mouseY!: number;
  ghostDrag!: { id: string; startX: number; startY: number; baseDx: number; baseDy: number } | null;
  lblDrag!: { id: string; offX: number; offY: number } | null;
  txtDrag!: { id: string; startX: number; startY: number; origX: number; origY: number } | null;
  bajDrag!: { id: string; offX: number; offY: number } | null;
  ptDrag!: { id: string; ptIdx: number; slideConstraint?: { otherId: string; segmentIdx: number } } | null;
  ramalDrag!: { id: string; startX: number; startY: number; origPts: [number, number][]; connBaj?: { id: string; origX: number; origY: number; origLblX: number; origLblY: number; atIdx: number }[] } | null;
  _dimStart!: Point | null;
  nivelActual!: PlanoLevel | null;
  nptLevels!: PlanoLevel[];
  _hiddenNets!: Set<string>;
  _lockedNets!: Set<string>;
  activeNetworks!: Set<string> | undefined;
  private _touchStartHandler?: (e: TouchEvent) => void;
  private _touchMoveHandler?: (e: TouchEvent) => void;
  private _touchEndHandler?: (e: TouchEvent) => void;
  _loadedPlanId!: string | null;
  planId?: string;
  _onDirtyCb!: DirtyCallback | null;
  _lastMouseCvs!: Point;

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
  _onContextMenuCb: ((bajante: any, x: number, y: number, isGhostClick?: boolean, ramalEndpoint?: { idx: number; x: number; y: number } | null, midRamalHit?: { segmentIdx: number; x: number; y: number } | null) => void) | null;
  _onDeleteCb: ((ids: string[]) => void) | null;
  _onActiveNetChangeCb: ((net: string) => void) | null;
  _onAlertCb: ((title: string, msg: string) => void) | null;
  _onAccesorioModalCb: ((data: { ramalId: string; angleDeg: number; junctionIndex: number; net: string; isTee?: boolean }) => void) | null;
  _dirty: boolean;
  _lastRightClickTime: number;

  _ramalDefaults!: PlanoRamalDefaults | null;

  _history: PlanoHistory;

  _isGhostSel!: boolean;
  _yeeFlashKey!: string | null;
  multiSel!: string[];
  multiDrag!: { startX: number; startY: number; origData: MultiDragOrigData } | null;
  marqueeRect!: { x1: number; y1: number; x2: number; y2: number } | null;
  private _needsRender = false;
  private _rafId: number | null = null;

  constructor(cw: HTMLElement, pdfWrap: HTMLElement | null, canv: HTMLCanvasElement) {
    this.cw = cw;
    this.pdfWrap = pdfWrap;
    this.canv = canv;
    this.ctx = canv.getContext('2d')!;

    initEngineState(this);

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

  onSelect(cb: SelectCallback): void { this._onSelectCb = cb; }
  onStatus(cb: StatusCallback): void { this._onStatusCb = cb; }
  onRequestText(cb: (x: number, y: number, cb: (text: string) => void) => void): void { this._onRequestTextCb = cb; }
  onContextMenu(cb: (b: any, x: number, y: number, isGhostClick?: boolean, ramalEndpoint?: { idx: number; x: number; y: number } | null, midRamalHit?: { segmentIdx: number; x: number; y: number } | null) => void): void { this._onContextMenuCb = cb; }
  onUpdate(cb: UpdateCallback): void { this._onUpdateCb = cb; }
  onDirty(cb: DirtyCallback): void { this._onDirtyCb = cb; }
  onDelete(cb: (ids: string[]) => void): void { this._onDeleteCb = cb; }
  onActiveNetChange(cb: (net: string) => void): void { this._onActiveNetChangeCb = cb; }
  onAlert(cb: (title: string, msg: string) => void): void { this._onAlertCb = cb; }
  onAccesorioModal(cb: (data: { ramalId: string; angleDeg: number; junctionIndex: number; net: string; isTee?: boolean }) => void): void { this._onAccesorioModalCb = cb; }

  triggerAlert(title: string, msg: string): void {
    if (this._onAlertCb) this._onAlertCb(title, msg);
  }

  triggerAccesorioModal(data: { ramalId: string; angleDeg: number; junctionIndex: number; net: string; isTee?: boolean }): void {
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

  toCvs(px: number, py: number): Point { return { x: px * this.zoom + this.offX, y: py * this.zoom + this.offY }; }
  toPlane(cx: number, cy: number): Point { return { x: (cx - this.offX) / this.zoom, y: (cy - this.offY) / this.zoom }; }
  pxToM(px: number): number { return +(px / 96 * 2.54 * this.scaleM).toFixed(3); }
  mm2cvs(mm: number): number { return mm * 96 / 25.4 * this.zoom; }

  realMmToCanvasPx(realRadiusMm: number): number {
    // Floor kept small on purpose: at common architectural scales (1:50 etc.) these symbols
    // must fit inside a ~15cm wall, which is only ~3mm on paper at 1:50 — a generous floor here
    // would make them scale-inaccurate (visibly larger than the wall they sit inside).
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

  _emitSelect(el: PlanoRamal | PlanoBajante | PlanoArea | PlanoTextAnnotation | PlanoDimension | null): void {
    if (!this._onSelectCb) return;
    if (!el) { this._onSelectCb(null); return; }
    const rest = { ...el } as any;
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

  _markDirty(): void {
    this._dirty = true;
    autoDetectRamalConnections(this);
    ensureRpCntRamal(this);
    calcSanitaryAccessories(this);
    if (this._history) {
      this._history.saveSnapshot();
    }
    if (this._onDirtyCb) this._onDirtyCb();
  }

  snapAngle(x0: number, y0: number, x1: number, y1: number): Point {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return { x: x1, y: y1 };
    const deg = Math.atan2(dy, dx) * 180 / Math.PI;
    const allowed = [0, 45, 90, 135, 180, -135, -90, -45];
    let best = 0, minDiff = 999;
    allowed.forEach(a => {
      const diff = Math.abs(((deg - a) + 540) % 360 - 180);
      if (diff < minDiff) { minDiff = diff; best = a; }
    });
    const sr = best * Math.PI / 180;
    return { x: x0 + dist * Math.cos(sr), y: y0 + dist * Math.sin(sr) };
  }

  snapToExisting(x: number, y: number): Point | null {
    let best: Point | null = null;
    let minD = 16 / this.zoom;
    this.ramales.forEach(r => {
      // Never snap across networks — elements from different redes must not connect just
      // because they're visually close. Exception: ventilación is meant to land exactly on a
      // sanitaria point (the existing reventilado marker relies on that), so allow that one pair.
      if (!netsSnapLinked(r.net, this.activeNet)) return;
      r.pts.forEach(([rx, ry], idx) => {
        let thresh = 16 / this.zoom;
        if (idx > 0 && idx < r.pts.length - 1) {
          const ptA = r.pts[idx - 1];
          const ptB = r.pts[idx];
          const ptC = r.pts[idx + 1];
          const ax = ptB[0] - ptA[0], ay = ptB[1] - ptA[1];
          const bx = ptC[0] - ptB[0], by = ptC[1] - ptB[1];
          const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
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
    this.bajantes.forEach(b => {
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
    return best;
  }

  _snapToSegment(x: number, y: number, pts: number[][], threshold: number = Infinity): Point | null {
    return snapToSegment(x, y, pts, threshold);
  }

  snapPreviewToPadre(x: number, y: number): Point | null {
    if (this.tipoTramo !== 'tributario' || !this.padreTributario || this.activeRamal) return null;
    const padre = this.ramales.find(r => r.id === this.padreTributario);
    if (!padre) return null;
    return this._snapToSegment(x, y, padre.pts, 20 / this.zoom);
  }

  _wrapTouch(fn: (e: TouchEvent) => void): (e: TouchEvent) => void {
    return (e: TouchEvent) => { e.preventDefault(); fn(e); };
  }

  _getPos(e: MouseEvent | TouchEvent): Point {
    const r = this.canv.getBoundingClientRect();
    const t = e instanceof TouchEvent ? (e as TouchEvent).touches[0] : e as MouseEvent;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  private _setupCanvasEvents(): void {
    this._touchStartHandler = this._wrapTouch(this._onDown as (e: TouchEvent) => void);
    this._touchMoveHandler = this._wrapTouch(this._onMove as (e: TouchEvent) => void);
    this._touchEndHandler = (e: TouchEvent) => { e.preventDefault(); this._onUp(e); };

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
    if (this._touchStartHandler) this.canv.removeEventListener('touchstart', this._touchStartHandler);
    if (this._touchMoveHandler) this.canv.removeEventListener('touchmove', this._touchMoveHandler);
    if (this._touchEndHandler) this.canv.removeEventListener('touchend', this._touchEndHandler);
    document.removeEventListener('keydown', this._onKeyDown);
  }

  _statusMsg(): string { return _statusMsg(this); }
  _nextLabel(): string { return _nextLabel(this); }
  _midpoint(pts: number[][]): [number, number] { return _midpoint(pts); }
  _strokeAngle(pts: number[][]): number { return _strokeAngle(pts); }
  _calcPolyArea(pts: number[][]): number { return _calcPolyArea(this, pts); }

  setTool(t: ToolType): void { _setTool(this, t); }
  setActiveNet(id: string): void {
    if (this.activeNet !== id) {
      this.activeNet = id;
      if (this._onActiveNetChangeCb) {
        this._onActiveNetChangeCb(id);
      }
    }
  }
  setTipoTramo(t: TramoType): void { this.tipoTramo = t; }
  setSnap(v: boolean): void { this.snapMode = v; }

  setPadreTributario(ramalId: string): void { _setPadreTributario(this, ramalId); }
  getPadreTributario(): PlanoRamal | null { return _getPadreTributario(this); }
  getRamalesPadre(): PlanoRamal[] { return _getRamalesPadre(this); }
  setRamalDefaults(d: Partial<PlanoRamalDefaults> | null): void { _setRamalDefaults(this, d); }

  setScaleM(v: string | number): void { _setScaleM(this, v); }
  setDefinedScaleM(v: string | number): void { _setDefinedScaleM(this, v); }

  setNetHidden(netId: string, hidden: boolean): void { _setNetHidden(this, netId, hidden); }
  setNetLocked(netId: string, locked: boolean): void { _setNetLocked(this, netId, locked); }

  getElementsByNet(netId: string): ElementItem[] { return _getElementsByNet(this, netId); }

  selectById(id: string): void { _selectById(this, id); }
  selectAt(cx: number, cy: number): void { _selectAt(this, cx, cy); }
  getSelected(): PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | null { return _getSelected(this); }
  updateSelected(fields: Record<string, unknown>): void { _updateSelected(this, fields); }
  updateElementById(id: string, fields: Record<string, unknown>): void { _updateElementById(this, id, fields); }
  rotateLabelSnap(): void { _rotateLabelSnap(this); }
  resetLabel(): void { _resetLabel(this); }
  deleteSelected(ids?: string[]): void { _deleteSelected(this, ids); }

  finishRamal(): void { _finishRamal(this); }
  cancelRamal(): void { _cancelRamal(this); }
  cancelArea(): void { _cancelArea(this); }
  finishArea(): void { _finishArea(this); }
  undoLast(): void { this._history.undoLast(); }
  clearAll(): void { this._history.clearAll(); }
  clearNet(netId: string): void { _clearNet(this, netId); }
  deleteSegmentAt(cx: number, cy: number): void { _deleteSegmentAt(this, cx, cy); }

  getBajantesFantasma(): PlanoBajante[] { return _getBajantesFantasma(this); }

  _renumberRamales(netId: string): void { _doRenumberRamales(this, netId); }
  _renumberBajantes(netId: string): void { _doRenumberBajantes(this, netId); }
  _renumberMontantes(): void { _doRenumberMontantes(this); }
  _renumberAreas(): void { _doRenumberAreas(this); }

  saveWork(): import('./PlanoPersistence').PlanoWorkData {
    return serializeWork(this);
  }

  loadWork(json: string | object): void {
    try {
      const d = (typeof json === 'string'
        ? JSON.parse(json)
        : json) as unknown as import('./PlanoPersistence').PlanoWorkData;
      applyWorkData(this as unknown as {
        scaleM: number;
        definedScaleM: number;
        activeNet: string;
        ramales: unknown[];
        dims: unknown[];
        textAnnots: unknown[];
        bajantes: unknown[];
        areas: unknown[];
        nptLevels: unknown[];
        selId: string | null;
        activeRamal: unknown;
        activeArea: unknown;
        _netCounts: Record<string, PlanoNetCounts>;
        _dirty: boolean;
        render: () => void;
        [key: string]: unknown;
      }, d);
      autoDetectRamalConnections(this);
      ensureRpCntRamal(this);
      if (this._history) {
        this._history.saveSnapshot();
      }
    } catch (e) { if (import.meta.env.DEV) console.error('Error loading work:', e); }
  }

  doZoom(delta: number, cx?: number, cy?: number): void {
    if (cx === undefined) { cx = this.cw.clientWidth / 2; cy = this.cw.clientHeight / 2; }
    const nz = Math.max(0.05, Math.min(6, this.zoom + delta));
    this.offX = cx - (cx - this.offX) * (nz / this.zoom);
    this.offY = cy! - (cy! - this.offY) * (nz / this.zoom);
    this.zoom = nz;
    this.render();
  }

  fitPage(): void {
    if (!this.pageW || !this.pageH) return;
    const s = Math.min(
      (this.cw.clientWidth - 20) / this.pageW,
      (this.cw.clientHeight - 36) / this.pageH,
    );
    this.zoom = s;
    this.offX = this.pageW * (1 - s) / 2;
    this.offY = (this.cw.clientHeight - this.pageH * s) / 2;
    this.render();
  }

  render(): void {
    const ctx = this.ctx;
    const w = this.canv.width, h = this.canv.height;
    ctx.clearRect(0, 0, w, h);

    if (this.pdfWrap) {
      this.pdfWrap.style.transform = `translate(${this.offX}px,${this.offY}px) scale(${this.zoom})`;
      this.pdfWrap.style.transformOrigin = '0 0';
      this.pdfWrap.style.willChange = 'transform';
    }

    renderDims(ctx, this);
    renderTexts(ctx, this);
    renderAreas(ctx, this);
    renderRamales(ctx, this);
    renderBajantes(ctx, this);
    renderGhosts(ctx, this);
    renderDimGhost(ctx, this);
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

    if (e instanceof MouseEvent && e.button === 1 || this.tool === 'pan') {
      this.panning = true;
      this.panX0 = x - this.offX;
      this.panY0 = y - this.offY;
      this.canv.style.cursor = 'grabbing';
      return;
    }

    if (e instanceof MouseEvent && e.button === 2) {
      // Right-click during ramal drawing: finish ramal
      if (this.activeRamal && this.tool === 'line') {
        this.finishRamal();
        return;
      }
      const hit = hitTestRightClick(this, x, y, e.clientX, e.clientY);
      if (hit) {
        const el = hit.element as any;
        // Don't change selection on right-click — just show the context menu
        if (this._onContextMenuCb) {
          this._onContextMenuCb(
            el,
            hit.clientX,
            hit.clientY,
            hit.isGhostClick,
            hit.ramalEndpoint || null,
            hit.midRamalHit || null
          );
        }
        this.render();
      }
      return;
    }

    // Double-click during ramal drawing: finish ramal (only effective on left button)
    if (e instanceof MouseEvent && e.detail >= 2 && this.activeRamal && this.tool === 'line') {
      this.finishRamal();
      return;
    }

    if (this._lockedNets.has(this.activeNet)) return;

    if (this.activeNetworks && !this.activeNetworks.has(this.activeNet)) {
      const netObj = NETS.find((n) => n.id === this.activeNet);
      const netName = netObj ? netObj.name : this.activeNet;
      this.triggerAlert('Red inactiva', `Debe activar la red de ${netName} en la información general`);
      return;
    }

    const p = this.toPlane(x, y);

    if (this.tool === 'sel') {
      const lblDragResult = hitTestBajanteLabelForDrag(this, x, y);
      if (lblDragResult) {
        this.lblDrag = lblDragResult;
        return;
      }
      handleSelectDown(this, x, y, e instanceof MouseEvent && (e.ctrlKey || false));
    } else if (this.tool === 'line') {
      handleLineDown(this, p.x, p.y);
    } else if (this.tool === 'dim') {
      handleDimDown(this, p.x, p.y);
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
    const hasDrag = this.ghostDrag || this.bajDrag || this.lblDrag || this.txtDrag || this.areaDrag || this.ptDrag || this.ramalDrag || this.multiDrag;
    if (hasDrag) {
      handleDragMove(this, x, y);
    } else if (this.marqueeRect) {
      this.marqueeRect.x2 = x;
      this.marqueeRect.y2 = y;
      this.scheduleRender();
    } else if (this.activeRamal || this._dimStart || this.activeArea) {
      handleDrawingMouseMove(this, x, y);
    }
  }

  _onMouseUpHandler(e: MouseEvent | TouchEvent): void {
    if (this.panning) {
      this.panning = false;
      this.canv.style.cursor = this.tool === 'pan' ? 'grab' : this.tool === 'sel' ? 'default' : 'crosshair';
    }
    const isCtrl = e instanceof MouseEvent && e.ctrlKey || false;
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
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 'z') { this.undoLast(); e.preventDefault(); return; }
    if (e.ctrlKey && k === 's') { e.preventDefault(); return; }
    if (k === 's') { this.setTool('sel'); e.preventDefault(); }
    else if (k === 'l') { this.setTool('line'); e.preventDefault(); }
    else if (k === 'c') { this.setTool('cont'); e.preventDefault(); }
    else if (k === 'h') { this.setTool('calent'); e.preventDefault(); }
    else if (k === 'd') { this.setTool('dim'); e.preventDefault(); }
    else if (k === 't') { this.setTool('text'); e.preventDefault(); }
    else if (k === 'b') { this.setTool('baj'); e.preventDefault(); }
    else if (k === 'm') { this.setTool('mon'); e.preventDefault(); }
    else if (k === 'a') { this.setTool('area'); e.preventDefault(); }
    else if (k === 'e') { this.setTool('erase'); e.preventDefault(); }
    else if (k === 'x') { this.setTool('delm'); e.preventDefault(); }
    else if (k === 'k') { this.setTool('segdel'); e.preventDefault(); }
    else if (k === ' ') { this.setTool(this.tool === 'pan' ? 'sel' : 'pan'); e.preventDefault(); }
    else if (k === 'enter') {
      if (this.activeRamal) { this.finishRamal(); e.preventDefault(); }
      else if (this.activeArea) { this.finishArea(); e.preventDefault(); }
    }
    else if (k === 'escape') {
      if (this.activeRamal) { this.cancelRamal(); e.preventDefault(); }
      else if (this.activeArea) { this.cancelArea(); e.preventDefault(); }
      else if (this._dimStart) { this._dimStart = null; this.render(); e.preventDefault(); }
      else {
        if (this.tool !== 'sel') {
          this.setTool('sel');
          e.preventDefault();
        } else {
          this.selId = null;
          this._emitSelect(null);
          this.render();
        }
      }
    }
    else if (k === 'delete') {
      if (!this.activeRamal && !this.activeArea) {
        if (this.multiSel && this.multiSel.length > 0) {
          this.deleteSelected(this.multiSel);
          this.multiSel = [];
        } else if (this.selId) {
          this.deleteSelected();
        }
        e.preventDefault();
      }
    }
  }
}