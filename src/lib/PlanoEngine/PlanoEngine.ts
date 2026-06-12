import { NETS } from './PlanoState';
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
} from './PlanoState';
import type { PlanoEngineAPI } from './PlanoEngineTypes';
import {
  renderDims, renderTexts, renderAreas, renderActiveArea,
  renderRamales, renderBajantes, renderGhosts, renderDimGhost, renderActiveRamal,
} from './PlanoRenderer';
import { pointInPoly, pointInLabelBox, pointToSegmentDist, snapToSegment } from './HitTester';
import { serializeWork, applyWorkData } from './PlanoPersistence';
import { setupCanvasEvents, teardownCanvasEvents, getCanvasPosition, wrapTouch } from './PlanoEventHandler';
import {
  setTool as _setTool,
  finishRamal as _finishRamal,
  cancelRamal as _cancelRamal,
  cancelArea as _cancelArea,
  finishArea as _finishArea,
  undoLast as _undoLast,
  clearAll as _clearAll,
  deleteSegmentAt as _deleteSegmentAt,
  setScaleM as _setScaleM,
  _statusMsg,
  _nextLabel,
  _midpoint,
  _strokeAngle,
  _calcPolyArea,
  handleLineDown,
  handleDimDown,
  handleTextDown,
  handleBajanteDown,
  handleEraseDown,
  handleSegDelDown,
  handleAreaDown,
  handleDrawingMouseMove,
  handleDoubleClick,
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
} from './PlanoEngineNetwork';

export { NETS };

type ToolType = 'sel' | 'line' | 'dim' | 'text' | 'baj' | 'pan' | 'area' | 'erase' | 'segdel';
type TramoType = 'ramal' | 'tributario';

interface Point { x: number; y: number }

interface DragState {
  id: string;
  offX: number;
  offY: number;
}

interface PointDrag {
  id: string;
  ptIdx: number;
}

interface TxtDrag {
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

interface AreaDrag {
  id: string;
  startX: number;
  startY: number;
}

interface GhostDrag {
  id: string;
  startX: number;
  startY: number;
  baseDx: number;
  baseDy: number;
}

interface DimStart extends Point {}

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

export default class PlanoEngine {
  cw: HTMLElement;
  pdfWrap: HTMLElement | null;
  canv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  zoom: number;
  offX: number;
  offY: number;
  dpr: number;
  tool: ToolType;
  activeNet: string;
  tipoTramo: TramoType;
  snapMode: boolean;
  scaleM: number;
  pageW: number;
  pageH: number;

  ramales: PlanoRamal[];
  dims: PlanoDimension[];
  textAnnots: PlanoTextAnnotation[];
  bajantes: PlanoBajante[];
  areas: PlanoArea[];
  activeRamal: PlanoActiveRamal | null;
  padreTributario: string | null;
  activeArea: PlanoActiveArea | null;
  selId: string | null;
  areaDrag: AreaDrag | null;
  panning: boolean;
  panX0: number;
  panY0: number;
  mouseX: number;
  mouseY: number;
  ghostDrag: GhostDrag | null;
  lblDrag: DragState | null;
  txtDrag: TxtDrag | null;
  bajDrag: DragState | null;
  ptDrag: PointDrag | null;
  _dimStart: DimStart | null;
  nivelActual: PlanoLevel | null;
  nptLevels: PlanoLevel[];
  _hiddenNets: Set<string>;
  _lockedNets: Set<string>;
  _loadedPlanId: string | null;
  _onDirtyCb: DirtyCallback | null;
  _segmentDeletePending: boolean;
  _lastMouseCvs: Point;

  _netCounts: Record<string, PlanoNetCounts>;

  MM: {
    lblName: number;
    lblInfo: number;
    lblCode: number;
    flowEmoji: number;
    coord: number;
  };

  _onDown: (e: MouseEvent | TouchEvent) => void;
  _onMove: (e: MouseEvent | TouchEvent) => void;
  _onUp: (e: MouseEvent | TouchEvent) => void;
  _onDblClick: (e: MouseEvent) => void;
  _onWheel: (e: WheelEvent) => void;
  _onKeyDown: (e: KeyboardEvent) => void;

  _onSelectCb: SelectCallback | null;
  _onStatusCb: StatusCallback | null;
  _onUpdateCb: UpdateCallback | null;
  _dirty: boolean;

  _ramalDefaults: PlanoRamalDefaults | null;

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
    this.pageW = 0;
    this.pageH = 0;

    this.ramales = [];
    this.dims = [];
    this.textAnnots = [];
    this.bajantes = [];
    this.areas = [];
    this.activeRamal = null;
    this.padreTributario = null;
    this.activeArea = null;
    this.selId = null;
    this.areaDrag = null;
    this.panning = false;
    this.panX0 = 0;
    this.panY0 = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.ghostDrag = null;
    this.lblDrag = null;
    this.txtDrag = null;
    this.bajDrag = null;
    this.ptDrag = null;
    this._dimStart = null;
    this.nivelActual = null;
    this.nptLevels = [];
    this._hiddenNets = new Set();
    this._lockedNets = new Set();
    this._loadedPlanId = null;
    this._onDirtyCb = null;
    this._segmentDeletePending = false;
    this._lastMouseCvs = { x: 0, y: 0 };

    this._netCounts = {};
    NETS.forEach(n => { this._netCounts[n.id] = { ramal: 0, tributario: 0 }; });

    this.MM = {
      lblName: 2.5,
      lblInfo: 1.8,
      lblCode: 2.0,
      flowEmoji: 3.0,
      coord: 1.8,
    };

    this._ramalDefaults = null;

    this._onDown = this._onDownHandler.bind(this) as (e: MouseEvent | TouchEvent) => void;
    this._onMove = this._onMouseMoveHandler.bind(this) as (e: MouseEvent | TouchEvent) => void;
    this._onUp = this._onMouseUpHandler.bind(this) as (e: MouseEvent | TouchEvent) => void;
    this._onDblClick = this._onDblClickHandler.bind(this);
    this._onWheel = this._onWheelHandler.bind(this);
    this._onKeyDown = this._onKeyDownHandler.bind(this);

    setupCanvasEvents(this as unknown as {
      canv: HTMLCanvasElement;
      _onDown: (e: MouseEvent | TouchEvent) => void;
      _onMove: (e: MouseEvent | TouchEvent) => void;
      _onUp: (e: MouseEvent | TouchEvent) => void;
      _onDblClick: (e: MouseEvent) => void;
      _onWheel: (e: WheelEvent) => void;
      _onKeyDown: (e: KeyboardEvent) => void;
      _wrapTouch: (fn: (e: TouchEvent) => void) => (e: TouchEvent) => void;
    });

    this._onSelectCb = null;
    this._onStatusCb = null;
    this._dirty = false;
    this._onUpdateCb = null;

    this._loadedPlanId = null;
  }

  onSelect(cb: SelectCallback): void { this._onSelectCb = cb; }
  onStatus(cb: StatusCallback): void { this._onStatusCb = cb; }
  onUpdate(cb: UpdateCallback): void { this._onUpdateCb = cb; }
  onDirty(cb: DirtyCallback): void { this._onDirtyCb = cb; }

  destroy(): void {
    teardownCanvasEvents(this as unknown as {
      canv: HTMLCanvasElement;
      _onDown: (e: MouseEvent | TouchEvent) => void;
      _onMove: (e: MouseEvent | TouchEvent) => void;
      _onUp: (e: MouseEvent | TouchEvent) => void;
      _onDblClick: (e: MouseEvent) => void;
      _onWheel: (e: WheelEvent) => void;
      _onKeyDown: (e: KeyboardEvent) => void;
    });
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

  _emitStatus(msg: string): void {
    if (this._onStatusCb) this._onStatusCb(msg);
  }

  _emitSelect(el: PlanoRamal | PlanoBajante | PlanoArea | PlanoTextAnnotation | PlanoDimension | null): void {
    if (!this._onSelectCb) return;
    if (!el) { this._onSelectCb(null); return; }
    const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = el as unknown as Record<string, unknown>;
    this._onSelectCb(rest);
  }

  _markDirty(): void {
    this._dirty = true;
    if (this._onDirtyCb) this._onDirtyCb();
  }

  snapAngle(x0: number, y0: number, x1: number, y1: number): Point {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return { x: x1, y: y1 };
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
    const THRESH = 16 / this.zoom;
    let best: Point | null = null, minD = THRESH;
    this.ramales.forEach(r => {
      r.pts.forEach(([rx, ry]) => {
        const d = Math.hypot(x - rx, y - ry);
        if (d < minD) { minD = d; best = { x: rx, y: ry }; }
      });
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [x1, y1] = r.pts[i], [x2, y2] = r.pts[i + 1];
        const ddx = x2 - x1, ddy = y2 - y1, len2 = ddx * ddx + ddy * ddy;
        if (len2 < 1) continue;
        const t = Math.max(0, Math.min(1, ((x - x1) * ddx + (y - y1) * ddy) / len2));
        const px = x1 + t * ddx, py = y1 + t * ddy;
        const d = Math.hypot(x - px, y - py);
        if (d < minD) { minD = d; best = { x: px, y: py }; }
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

  _pointInPoly(px: number, py: number, cvsPts: Point[]): boolean {
    return pointInPoly(px, py, cvsPts);
  }

  _pointInLabelBox(px: number, py: number, box: { cx: number; cy: number; w: number; h: number; angle: number; corners?: Point[] }): boolean {
    return pointInLabelBox(px, py, box);
  }

  _ptSegDist(px: number, py: number, a: [number, number], b: [number, number]): number {
    return pointToSegmentDist(px, py, a[0], a[1], b[0], b[1]);
  }

  _wrapTouch(fn: (e: TouchEvent) => void): (e: TouchEvent) => void {
    return wrapTouch(fn);
  }

  _getPos(e: MouseEvent | TouchEvent): Point {
    return getCanvasPosition(this.canv, e);
  }

  _statusMsg(): string { return _statusMsg(this as unknown as PlanoEngineAPI); }
  _nextLabel(): string { return _nextLabel(this as unknown as PlanoEngineAPI); }
  _midpoint(pts: number[][]): [number, number] { return _midpoint(pts); }
  _strokeAngle(pts: number[][]): number { return _strokeAngle(pts); }
  _calcPolyArea(pts: number[][]): number { return _calcPolyArea(this as unknown as PlanoEngineAPI, pts); }

  setTool(t: ToolType): void { _setTool(this as unknown as PlanoEngineAPI, t); }
  setActiveNet(id: string): void { this.activeNet = id; }
  setTipoTramo(t: TramoType): void { this.tipoTramo = t; }
  setSnap(v: boolean): void { this.snapMode = v; }

  setPadreTributario(ramalId: string): void { _setPadreTributario(this as unknown as PlanoEngineAPI, ramalId); }
  getPadreTributario(): PlanoRamal | null { return _getPadreTributario(this as unknown as PlanoEngineAPI); }
  getRamalesPadre(): PlanoRamal[] { return _getRamalesPadre(this as unknown as PlanoEngineAPI); }
  setRamalDefaults(d: Partial<PlanoRamalDefaults> | null): void { _setRamalDefaults(this as unknown as PlanoEngineAPI, d); }

  setScaleM(v: string | number): void { _setScaleM(this as unknown as PlanoEngineAPI, v); }

  setNetHidden(netId: string, hidden: boolean): void { _setNetHidden(this as unknown as PlanoEngineAPI, netId, hidden); }
  setNetLocked(netId: string, locked: boolean): void { _setNetLocked(this as unknown as PlanoEngineAPI, netId, locked); }

  getElementsByNet(netId: string): ElementItem[] { return _getElementsByNet(this as unknown as PlanoEngineAPI, netId); }

  selectById(id: string): void { _selectById(this as unknown as PlanoEngineAPI, id); }
  selectAt(cx: number, cy: number): void { _selectAt(this as unknown as PlanoEngineAPI, cx, cy); }
  getSelected(): PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | null { return _getSelected(this as unknown as PlanoEngineAPI); }
  updateSelected(fields: Record<string, unknown>): void { _updateSelected(this as unknown as PlanoEngineAPI, fields); }
  updateElementById(id: string, fields: Record<string, unknown>): void { _updateElementById(this as unknown as PlanoEngineAPI, id, fields); }
  rotateLabelSnap(): void { _rotateLabelSnap(this as unknown as PlanoEngineAPI); }
  resetLabel(): void { _resetLabel(this as unknown as PlanoEngineAPI); }
  deleteSelected(): void { _deleteSelected(this as unknown as PlanoEngineAPI); }

  finishRamal(): void { _finishRamal(this as unknown as PlanoEngineAPI); }
  cancelRamal(): void { _cancelRamal(this as unknown as PlanoEngineAPI); }
  cancelArea(): void { _cancelArea(this as unknown as PlanoEngineAPI); }
  finishArea(): void { _finishArea(this as unknown as PlanoEngineAPI); }
  undoLast(): void { _undoLast(this as unknown as PlanoEngineAPI); }
  clearAll(): void { _clearAll(this as unknown as PlanoEngineAPI); }
  clearNet(netId: string): void { _clearNet(this as unknown as PlanoEngineAPI, netId); }
  deleteSegmentAt(cx: number, cy: number): void { _deleteSegmentAt(this as unknown as PlanoEngineAPI, cx, cy); }

  getBajantesFantasma(): PlanoBajante[] { return _getBajantesFantasma(this as unknown as PlanoEngineAPI); }

  _renumberRamales(netId: string): void { _doRenumberRamales(this as unknown as PlanoEngineAPI, netId); }

  saveWork(): string {
    return serializeWork(this as unknown as {
      scaleM: number;
      activeNet: string;
      ramales: unknown[];
      dims: unknown[];
      textAnnots: unknown[];
      bajantes: unknown[];
      areas: unknown[];
      nptLevels: unknown[];
    });
  }

  loadWork(json: string): void {
    try {
      const d = JSON.parse(json) as unknown as import('./PlanoPersistence').PlanoWorkData;
      applyWorkData(this as unknown as {
        scaleM: number;
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
      },         d);
    } catch (e) { console.error('Error loading work:', e); }
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
    this.offX = (this.cw.clientWidth - this.pageW * s) / 2;
    this.offY = 16;
    this.render();
  }

  render(): void {
    const ctx = this.ctx;
    const w = this.canv.width, h = this.canv.height;
    ctx.clearRect(0, 0, w, h);

    if (this.pdfWrap) {
      this.pdfWrap.style.transform = `translate(${this.offX}px,${this.offY}px) scale(${this.zoom})`;
      this.pdfWrap.style.transformOrigin = '0 0';
      this.pdfWrap.style.imageRendering = 'pixelated';
      (this.pdfWrap.style as unknown as Record<string, string>).imageRendering = 'crisp-edges';
      this.pdfWrap.style.willChange = 'transform';
    }

    renderDims(ctx, this as unknown as PlanoEngineAPI);
    renderTexts(ctx, this as unknown as PlanoEngineAPI);
    renderAreas(ctx, this as unknown as PlanoEngineAPI);
    renderRamales(ctx, this as unknown as PlanoEngineAPI);
    renderBajantes(ctx, this as unknown as PlanoEngineAPI);
    renderGhosts(ctx, this as unknown as PlanoEngineAPI);
    renderDimGhost(ctx, this as unknown as PlanoEngineAPI);
    renderActiveArea(ctx, this as unknown as PlanoEngineAPI);
    renderActiveRamal(ctx, this as unknown as PlanoEngineAPI);
  }

  _onDownHandler(e: MouseEvent | TouchEvent): void {
    const { x, y } = this._getPos(e);
    if ((e as MouseEvent).button === 1 || this.tool === 'pan') {
      this.panning = true;
      this.panX0 = x - this.offX;
      this.panY0 = y - this.offY;
      this.canv.style.cursor = 'grabbing';
      return;
    }
    if (this._lockedNets.has(this.activeNet)) return;

    const p = this.toPlane(x, y);

    if (this.tool === 'sel') {
      handleSelectDown(this as unknown as PlanoEngineAPI, x, y);
    } else if (this.tool === 'line') {
      handleLineDown(this as unknown as PlanoEngineAPI, p.x, p.y);
    } else if (this.tool === 'dim') {
      handleDimDown(this as unknown as PlanoEngineAPI, p.x, p.y);
    } else if (this.tool === 'text') {
      handleTextDown(this as unknown as PlanoEngineAPI, p.x, p.y);
    } else if (this.tool === 'baj') {
      handleBajanteDown(this as unknown as PlanoEngineAPI, p.x, p.y);
    } else if (this.tool === 'area') {
      handleAreaDown(this as unknown as PlanoEngineAPI, p.x, p.y);
    } else if (this.tool === 'erase') {
      handleEraseDown(this as unknown as PlanoEngineAPI, x, y);
    } else if (this.tool === 'segdel') {
      handleSegDelDown(this as unknown as PlanoEngineAPI, x, y);
    }
  }

  _onMouseMoveHandler(e: MouseEvent | TouchEvent): void {
    const { x, y } = this._getPos(e);
    this._lastMouseCvs = { x, y };
    if (this.panning) {
      this.offX = x - this.panX0;
      this.offY = y - this.panY0;
      this.render();
      return;
    }
    const hasDrag = this.ghostDrag || this.bajDrag || this.lblDrag || this.txtDrag || this.areaDrag || this.ptDrag;
    if (hasDrag) {
      handleDragMove(this as unknown as PlanoEngineAPI, x, y);
    } else if (this.activeRamal || this._dimStart || this.activeArea) {
      handleDrawingMouseMove(this as unknown as PlanoEngineAPI, x, y);
    }
  }

  _onMouseUpHandler(e: MouseEvent | TouchEvent): void {
    void e;
    if (this.panning) {
      this.panning = false;
      this.canv.style.cursor = this.tool === 'pan' ? 'grab' : this.tool === 'sel' ? 'default' : 'crosshair';
    }
    handleDragUp(this as unknown as PlanoEngineAPI);
  }

  _onDblClickHandler(e: MouseEvent): void {
    void e;
    handleDoubleClick(this as unknown as PlanoEngineAPI);
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
    if (k === 's') { this.setTool('sel'); e.preventDefault(); }
    else if (k === 'l') { this.setTool('line'); e.preventDefault(); }
    else if (k === 'd') { this.setTool('dim'); e.preventDefault(); }
    else if (k === 't') { this.setTool('text'); e.preventDefault(); }
    else if (k === 'b') { this.setTool('baj'); e.preventDefault(); }
    else if (k === 'a') { this.setTool('area'); e.preventDefault(); }
    else if (k === 'e') { this.setTool('erase'); e.preventDefault(); }
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
      else { this.selId = null; this._emitSelect(null); this.render(); }
    }
    else if (e.ctrlKey && k === 'z') { this.undoLast(); e.preventDefault(); }
    else if (e.ctrlKey && k === 's') { e.preventDefault(); }
  }
}
