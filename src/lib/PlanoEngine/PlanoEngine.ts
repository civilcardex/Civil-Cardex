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
import {
  renderDims, renderTexts, renderAreas, renderActiveArea,
  renderRamales, renderBajantes, renderGhosts, renderDimGhost, renderActiveRamal,
} from './PlanoRenderer';
import { pointInPoly, pointInLabelBox, pointToSegmentDist, snapToSegment } from './HitTester';
import { serializeWork, applyWorkData } from './PlanoPersistence';
import { setupCanvasEvents, teardownCanvasEvents, getCanvasPosition, wrapTouch } from './PlanoEventHandler';

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

  selectById(id: string): void {
    const found = this.ramales.find(r => r.id === id) || this.bajantes.find(b => b.id === id) ||
      this.textAnnots.find(t => t.id === id) || this.areas.find(a => a.id === id) ||
      this.dims.find(d => d.id === id);
    if (found) { this.selId = found.id; this._emitSelect(found); this.render(); }
  }

  getElementsByNet(netId: string): ElementItem[] {
    const items: ElementItem[] = [];
    for (const r of this.ramales) {
      if (r.net === netId) {
        items.push({
          type: 'ramal',
          id: r.id,
          label: r.label || r.id,
          totalL: r.totalL,
          segs: r.pts ? Math.max(0, r.pts.length - 1) : 0,
          piso: r.piso || '',
          tipo: r.tipo,
          padre: r.padre || null,
          pendiente: r.pendiente,
          diametro: r.diametro,
        });
      }
    }
    for (const b of this.bajantes) {
      if (b.net === netId) {
        items.push({
          type: 'bajante',
          id: b.id,
          label: b.code || b.id,
          totalL: b.totalL || 0,
          segs: 0,
          piso: b.piso || '',
          tipo: 'bajante',
          pendiente: b.pendiente,
          diametro: b.dNominal,
        });
      }
    }
    return items;
  }

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

  setNetHidden(netId: string, hidden: boolean): void {
    if (hidden) this._hiddenNets.add(netId);
    else this._hiddenNets.delete(netId);
    this.render();
  }

  setNetLocked(netId: string, locked: boolean): void {
    if (locked) this._lockedNets.add(netId);
    else this._lockedNets.delete(netId);
    this.render();
  }

  _wrapTouch(fn: (e: TouchEvent) => void): (e: TouchEvent) => void {
    return wrapTouch(fn);
  }

  _getPos(e: MouseEvent | TouchEvent): Point {
    return getCanvasPosition(this.canv, e);
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

  setTool(t: ToolType): void {
    if (this.activeRamal && this.activeRamal.pts.length >= 2 && t !== 'line') this.finishRamal();
    else if (this.activeRamal && t !== 'line') this.cancelRamal();
    if (this.activeArea && t !== 'area') this.finishArea();
    if (t !== 'dim') this._dimStart = null;
    this.tool = t;
    this.canv.style.cursor = t === 'pan' ? 'grab' : t === 'sel' ? 'default' : 'crosshair';
    this._emitStatus(this._statusMsg());
  }

  setActiveNet(id: string): void { this.activeNet = id; }
  setTipoTramo(t: TramoType): void { this.tipoTramo = t; }
  setSnap(v: boolean): void { this.snapMode = v; }

  setPadreTributario(ramalId: string): void {
    if (this.tipoTramo !== 'tributario') return;
    const padre = this.ramales.find(r => r.id === ramalId && r.net === this.activeNet && r.tipo === 'ramal');
    this.padreTributario = padre ? padre.id : null;
    this.render();
  }

  getPadreTributario(): PlanoRamal | null {
    if (!this.padreTributario) return null;
    return this.ramales.find(r => r.id === this.padreTributario) || null;
  }

  getRamalesPadre(): PlanoRamal[] {
    return this.ramales.filter(r => r.net === this.activeNet && r.tipo === 'ramal');
  }

  setRamalDefaults(d: Partial<PlanoRamalDefaults> | null): void {
    this._ramalDefaults = {
      material: d?.material || '',
      diametro: d?.diametro || '',
      pendiente: typeof d?.pendiente === 'number' ? d.pendiente : 0,
    };
  }

  setScaleM(v: string | number): void {
    this.scaleM = parseFloat(String(v)) || 0.5;
    this.ramales.forEach(r => {
      r.totalL = 0;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [x1, y1] = r.pts[i], [x2, y2] = r.pts[i + 1];
        r.totalL += this.pxToM(Math.hypot(x2 - x1, y2 - y1));
      }
      r.totalL = +r.totalL.toFixed(3);
    });
    this.render();
  }

  _statusMsg(): string {
    const names: Record<string, string> = { sel: 'Seleccionar', line: 'Ramal', dim: 'Cota', text: 'Texto', baj: 'Bajante', pan: 'Pan', area: 'Área', erase: 'Borrar' };
    let m = names[this.tool] || this.tool;
    if (this.tool === 'line') {
      const net = NETS.find(n => n.id === this.activeNet);
      m += ` — ${net ? net.lbl : ''} [${this.tipoTramo}]`;
      if (this.activeRamal) m += ` (${this.activeRamal.pts.length} pts, ${this.activeRamal.totalL}m)`;
    }
    if (this.tool === 'area' && this.activeArea) {
      m += ` (${this.activeArea.pts.length} pts)`;
    }
    return m;
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

  _nextLabel(): string {
    const net = NETS.find(n => n.id === this.activeNet);
    const pfx = net ? net.lbl : 'R';
    const cnt = this._netCounts[this.activeNet][this.tipoTramo] || 0;
    if (this.tipoTramo === 'tributario') {
      return `Trib${cnt}`;
    }
    return `${pfx}${cnt}`;
  }

  finishRamal(): void {
    if (!this.activeRamal || this.activeRamal.pts.length < 1) return;
    if (this.activeRamal.pts.length < 2) { this.activeRamal = null; this._emitStatus(this._statusMsg()); this.render(); return; }
    const [mx, my] = this._midpoint(this.activeRamal.pts);
    const def = this._ramalDefaults || { material: '', diametro: '', pendiente: 0 };
    const net = NETS.find(n => n.id === this.activeRamal!.net);
    const netPfx = net ? net.lbl : 'R';
    const cnt = ++(this._netCounts[this.activeRamal!.net][this.tipoTramo]);
    const id = this.tipoTramo === 'tributario'
      ? 'T' + Date.now()
      : netPfx + cnt;

    try {
      const k = `${this.activeRamal!.net}_${id}`;
      const AP_KEY = 'civilflow_aparatos_by_tramo_v2';
      const HD_KEY = 'civilflow_tramo_hidro_data_v3';
      const apData = JSON.parse(localStorage.getItem(AP_KEY) || '{}') as Record<string, unknown>;
      const hdData = JSON.parse(localStorage.getItem(HD_KEY) || '{}') as Record<string, unknown>;
      let changed = false;
      if (apData[k]) { delete apData[k]; changed = true; }
      if (hdData[k]) { delete hdData[k]; changed = true; }
      if (changed) {
        localStorage.setItem(AP_KEY, JSON.stringify(apData));
        localStorage.setItem(HD_KEY, JSON.stringify(hdData));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) { console.error('PlanoEngine:', e); }

    const r: PlanoRamal = {
      id,
      net: this.activeRamal!.net,
      tipo: this.activeRamal!.tipo,
      padre: this.activeRamal!.padre,
      pts: this.activeRamal!.pts,
      totalL: this.activeRamal!.totalL,
      label: this._nextLabel(),
      ini: '', fin: '', piso: this.nivelActual?.n ?? '', dz: '', uc: 0,
      labelX: mx, labelY: my,
      labelAngle: 0,
      material: def.material || '',
      diametro: def.diametro || '',
      pendiente: typeof def.pendiente === 'number' ? def.pendiente : 0,
    };
    this.ramales.push(r);
    this.activeRamal = null;
    this.selId = r.id;
    this._emitSelect(r);
    this._emitStatus(this._statusMsg());
    this.render();
    this._markDirty();
  }

  cancelRamal(): void {
    this.activeRamal = null;
    this._emitStatus(this._statusMsg());
    this.render();
    this._markDirty();
  }

  undoLast(): void {
    if (this.activeRamal) { this.cancelRamal(); return; }
    if (this.activeArea) { this.cancelArea(); return; }
    if (this.tool === 'baj' && this.bajantes.length) {
      this.bajantes.pop();
    } else if (this.ramales.length) {
      this.ramales.pop();
    } else if (this.areas.length) {
      this.areas.pop();
    } else if (this.dims.length) {
      this.dims.pop();
    } else if (this.textAnnots.length) {
      this.textAnnots.pop();
    }
    this.selId = null;
    this._emitSelect(null);
    this.render();
    this._markDirty();
  }

  cancelArea(): void {
    this.activeArea = null;
    this._emitStatus(this._statusMsg());
    this.render();
  }

  finishArea(): void {
    if (!this.activeArea || this.activeArea.pts.length < 3) { this.activeArea = null; return; }
    const pts = this.activeArea.pts;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const area: PlanoArea = {
      id: 'AR' + Date.now(),
      pts: pts.map(p => [...p]),
      color: this.activeArea.color,
      label: '',
      labelX: cx,
      labelY: cy,
      labelAngle: 0,
      areaM2: this._calcPolyArea(pts),
    };
    this.areas.push(area);
    this.activeArea = null;
    this._emitStatus(this._statusMsg());
    this.render();
  }

  _calcPolyArea(pts: number[][]): number {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i][0] * pts[j][1];
      area -= pts[j][0] * pts[i][1];
    }
    area = Math.abs(area) / 2;
    const m2 = area * Math.pow(2.54 * this.scaleM / 96, 2);
    return +m2.toFixed(2);
  }

  clearAll(): void {
    this.ramales = [];
    this.dims = [];
    this.textAnnots = [];
    this.bajantes = [];
    this.areas = [];
    this.activeRamal = null;
    this.activeArea = null;
    this.selId = null;
    this._netCounts = {};
    NETS.forEach(n => { this._netCounts[n.id] = { ramal: 0, tributario: 0 }; });
    this._emitSelect(null);
    this.render();
  }

  clearNet(netId: string): void {
    this.ramales = this.ramales.filter(r => r.net !== netId);
    this.bajantes = this.bajantes.filter(b => b.net !== netId);
    this.activeRamal = null;
    if (this.selId) {
      const stillExists = this.ramales.find(r => r.id === this.selId) || this.bajantes.find(b => b.id === this.selId);
      if (!stillExists) { this.selId = null; this._emitSelect(null); }
    }
    this.render();
    this._markDirty();
  }

  getSelected(): PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | null {
    if (!this.selId) return null;
    return this.ramales.find(r => r.id === this.selId)
      || this.bajantes.find(b => b.id === this.selId)
      || this.textAnnots.find(t => t.id === this.selId)
      || this.areas.find(a => a.id === this.selId)
      || null;
  }

  _midpoint(pts: number[][]): [number, number] {
    let totalLen = 0;
    const segLens: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      segLens.push(l);
      totalLen += l;
    }
    const half = totalLen / 2;
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
      if (acc + segLens[i] >= half) {
        const t = segLens[i] > 0 ? (half - acc) / segLens[i] : 0;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
      }
      acc += segLens[i];
    }
    return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
  }

  _strokeAngle(pts: number[][]): number {
    if (pts.length < 2) return 0;
    let totalLen = 0;
    const segLens: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      segLens.push(l);
      totalLen += l;
    }
    const half = totalLen / 2;
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
      if (acc + segLens[i] >= half) {
        const dx = pts[i + 1][0] - pts[i][0];
        const dy = pts[i + 1][1] - pts[i][1];
        if (segLens[i] < 1) return 0;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        return Math.round(angle);
      }
      acc += segLens[i];
    }
    return 0;
  }

  updateSelected(fields: Record<string, unknown>): void {
    const el = this.getSelected();
    if (el) {
      Object.assign(el, fields);
      if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
        const [mx, my] = this._midpoint((el as PlanoRamal).pts);
        (el as PlanoRamal).labelX = mx;
        (el as PlanoRamal).labelY = my;
      }
    }
    this.render();
    this._markDirty();
  }

  updateElementById(id: string, fields: Record<string, unknown>): void {
    let el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | undefined =
      this.ramales.find(r => r.id === id)
      || this.bajantes.find(b => b.id === id)
      || this.textAnnots.find(t => t.id === id)
      || this.areas.find(a => a.id === id);
    if (el) {
      Object.assign(el, fields);
      if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
        const [mx, my] = this._midpoint((el as PlanoRamal).pts);
        (el as PlanoRamal).labelX = mx;
        (el as PlanoRamal).labelY = my;
      }
      this.selId = id;
    }
    this.render();
    this._markDirty();
  }

  rotateLabelSnap(): void {
    const el = this.getSelected();
    if (!el) return;
    const ANGLES = [0, 45, 90, -90, -45];
    if (el.id?.startsWith('T') && (el as PlanoTextAnnotation).text !== undefined) {
      const cur = (el as PlanoTextAnnotation).textAngle || 0;
      const idx = ANGLES.reduce((b, a, i) => Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b, 0);
      (el as PlanoTextAnnotation).textAngle = ANGLES[(idx + 1) % ANGLES.length];
    } else {
      const cur = (el as PlanoRamal | PlanoBajante | PlanoArea).labelAngle || 0;
      const idx = ANGLES.reduce((b, a, i) => Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b, 0);
      (el as PlanoRamal | PlanoBajante | PlanoArea).labelAngle = ANGLES[(idx + 1) % ANGLES.length];
    }
    this._emitSelect(el);
    this.render();
  }

  deleteSelected(): void {
    if (!this.selId) return;
    const idxR = this.ramales.findIndex(r => r.id === this.selId);
    if (idxR >= 0) {
      const deleted = this.ramales[idxR];
      this.ramales = this.ramales.filter(r => r.id !== deleted.id && r.padre !== deleted.id);
      this._renumberRamales(deleted.net);
      this.selId = null;
      this._emitSelect(null);
      this.render();
      this._markDirty();
      return;
    }
    const idxB = this.bajantes.findIndex(b => b.id === this.selId);
    if (idxB >= 0) { this.bajantes.splice(idxB, 1); this.selId = null; this._emitSelect(null); this.render(); this._markDirty(); return; }
    const idxT = this.textAnnots.findIndex(t => t.id === this.selId);
    if (idxT >= 0) { this.textAnnots.splice(idxT, 1); this.selId = null; this._emitSelect(null); this.render(); this._markDirty(); return; }
    const idxA = this.areas.findIndex(a => a.id === this.selId);
    if (idxA >= 0) { this.areas.splice(idxA, 1); this.selId = null; this._emitSelect(null); this.render(); this._markDirty(); return; }
    const idxD = this.dims.findIndex(d => d.id === this.selId);
    if (idxD >= 0) { this.dims.splice(idxD, 1); this.selId = null; this._emitSelect(null); this.render(); this._markDirty(); return; }
  }

  _renumberRamales(netId: string): void {
    const net = NETS.find(n => n.id === netId);
    if (!net) return;
    const pfx = net.lbl;
    const ramalesNet = this.ramales.filter(r => r.net === netId && r.tipo !== 'tributario');
    ramalesNet.sort((a, b) => {
      const na = parseInt((a.id || '').replace(pfx, ''), 10) || 0;
      const nb = parseInt((b.id || '').replace(pfx, ''), 10) || 0;
      return na - nb;
    });
    ramalesNet.forEach((r, i) => {
      const oldId = r.id;
      const newId = pfx + (i + 1);
      if (oldId !== newId) {
        try {
          const AP_KEY = 'civilflow_aparatos_by_tramo_v2';
          const apData = JSON.parse(localStorage.getItem(AP_KEY) || '{}') as Record<string, unknown>;
          const oldK = `${netId}_${oldId}`;
          const newK = `${netId}_${newId}`;
          if (apData[oldK]) { apData[newK] = apData[oldK]; delete apData[oldK]; localStorage.setItem(AP_KEY, JSON.stringify(apData)); }
        } catch (e) { console.error('PlanoEngine:', e); }
        try {
          const HD_KEY = 'civilflow_tramo_hidro_data_v3';
          const hdData = JSON.parse(localStorage.getItem(HD_KEY) || '{}') as Record<string, unknown>;
          const oldK = `${netId}_${oldId}`;
          const newK = `${netId}_${newId}`;
          if (hdData[oldK]) { hdData[newK] = hdData[oldK]; delete hdData[oldK]; localStorage.setItem(HD_KEY, JSON.stringify(hdData)); }
        } catch (e) { console.error('PlanoEngine:', e); }
      }
      r.id = newId;
      r.label = newId;
      this.ramales.filter(t => t.padre === oldId).forEach(t => { t.padre = newId; });
    });
    this._netCounts[netId].ramal = ramalesNet.length;
  }

  deleteSegmentAt(cx: number, cy: number): void {
    const plane = this.toPlane(cx, cy);
    const HIT_DIST = 10 / this.zoom;
    let bestR: PlanoRamal | null = null, bestIdx = -1, bestD = Infinity;

    for (const r of this.ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      for (let i = 0; i < r.pts.length; i++) {
        const d = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
        if (d < bestD) { bestD = d; bestIdx = i; bestR = r; }
      }
      if (bestD <= HIT_DIST) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const d = this._ptSegDist(plane.x, plane.y, r.pts[i] as [number, number], r.pts[i + 1] as [number, number]);
        if (d < bestD) {
          bestD = d;
          bestR = r;
          const dA = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
          const dB = Math.hypot(plane.x - r.pts[i + 1][0], plane.y - r.pts[i + 1][1]);
          bestIdx = dA <= dB ? i : i + 1;
        }
      }
    }
    if (!bestR || bestIdx < 0 || bestD > HIT_DIST) return;
    const r = bestR;
    if (r.pts.length <= 2) {
      this.ramales = this.ramales.filter(x => x.id !== r.id && x.padre !== r.id);
      if (r.tipo !== 'tributario') this._renumberRamales(r.net);
      this.selId = null;
      this._emitSelect(null);
    } else {
      r.pts.splice(bestIdx, 1);
      r.totalL = 0;
      for (let i = 0; i < r.pts.length - 1; i++) {
        r.totalL += this.pxToM(Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]));
      }
      r.totalL = +r.totalL.toFixed(3);
      const [mx, my] = this._midpoint(r.pts);
      r.labelX = mx;
      r.labelY = my;
    }
    this.render();
    this._markDirty();
  }

  resetLabel(): void {
    const el = this.getSelected();
    if (!el) return;
    if ((el as PlanoRamal).pts) {
      const [mx, my] = this._midpoint((el as PlanoRamal).pts);
      (el as PlanoRamal | PlanoArea).labelX = mx;
      (el as PlanoRamal | PlanoArea).labelY = my;
      (el as PlanoRamal | PlanoBajante | PlanoArea).labelAngle = 0;
    } else {
      (el as PlanoBajante).labelX = (el as PlanoBajante).x;
      (el as PlanoBajante).labelY = (el as PlanoBajante).y;
      (el as PlanoRamal | PlanoBajante | PlanoArea).labelAngle = 0;
    }
    this.render();
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

  getBajantesFantasma(): PlanoBajante[] {
    if (!this.nivelActual) return [];
    return this.bajantes.filter(b => {
      const base = Math.min(b.nptBase || 0, b.nptCima || 0);
      const cima = Math.max(b.nptBase || 0, b.nptCima || 0);
      const npt = this.nivelActual!.npt || 0;
      if (npt >= base && npt <= cima) return true;
      const superior = this.nptLevels.filter(l => (l.npt || 0) > npt).sort((a, b) => (a.npt || 0) - (b.npt || 0))[0]?.npt;
      return superior !== undefined && (b.nptBase === superior || b.nptCima === superior);
    });
  }

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

  _onDownHandler(e: MouseEvent | TouchEvent): void {
    const { x, y } = this._getPos(e);
    if ((e as MouseEvent).button === 1 || this.tool === 'pan') {
      this.panning = true;
      this.panX0 = x - this.offX;
      this.panY0 = y - this.offY;
      this.canv.style.cursor = 'grabbing';
      return;
    }
    const p = this.toPlane(x, y);

    if (this._lockedNets.has(this.activeNet)) return;

    if (this.tool === 'sel') {
      const sel = this.getSelected();

      if (sel && (sel as PlanoBajante)._circ && sel.id?.startsWith('B')) {
        const circ = (sel as PlanoBajante)._circ!;
        const d = Math.hypot(x - circ.x, y - circ.y);
        if (d < circ.r) {
          this.bajDrag = { id: sel.id, offX: x - circ.x, offY: y - circ.y };
          return;
        }
      }

      if (sel && (sel as PlanoRamal).labelX !== undefined && !sel.id?.startsWith('T')) {
        if ((sel as PlanoRamal)._labelBox && this._pointInLabelBox(x, y, (sel as PlanoRamal)._labelBox!)) {
          const lPos = this.toCvs((sel as PlanoRamal).labelX, (sel as PlanoRamal).labelY);
          this.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
          return;
        }
        if (!sel.id?.startsWith('B')) {
          const lPos = this.toCvs((sel as PlanoRamal | PlanoArea).labelX, (sel as PlanoRamal | PlanoArea).labelY);
          if (Math.hypot(x - lPos.x, y - lPos.y) < 12) {
            this.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
            return;
          }
        }
      }

      if (sel && (sel as PlanoRamal).pts && sel.id?.startsWith('R')) {
        const ramalSel = sel as PlanoRamal;
        for (let i = 0; i < ramalSel.pts.length; i++) {
          const pc = this.toCvs(ramalSel.pts[i][0], ramalSel.pts[i][1]);
          if (Math.hypot(x - pc.x, y - pc.y) < 10) {
            this.ptDrag = { id: sel.id, ptIdx: i };
            return;
          }
        }
      }

      if (sel && (sel as PlanoTextAnnotation)._box && sel.id?.startsWith('T')) {
        const b = (sel as PlanoTextAnnotation)._box!;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          const tp = this.toPlane(x, y);
          this.txtDrag = { id: sel.id, startX: tp.x, startY: tp.y, origX: (sel as PlanoTextAnnotation).x, origY: (sel as PlanoTextAnnotation).y };
          return;
        }
      }

      if (sel && sel.id?.startsWith('AR') && (sel as PlanoArea)._polyBox) {
        const pb = (sel as PlanoArea)._polyBox!;
        if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
          const tp = this.toPlane(x, y);
          this.areaDrag = { id: sel.id, startX: tp.x, startY: tp.y };
          return;
        }
      }

      for (const t of this.textAnnots) {
        if (t._box) {
          const b = t._box;
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.selId = t.id;
            const tp = this.toPlane(x, y);
            this.txtDrag = { id: t.id, startX: tp.x, startY: tp.y, origX: t.x, origY: t.y };
            this._emitSelect(t);
            this.render();
            return;
          }
        }
      }

      for (const a of this.areas) {
        if (a._labelBox && this._pointInLabelBox(x, y, a._labelBox)) {
          this.selId = a.id;
          const lPos = this.toCvs(a.labelX, a.labelY);
          this.lblDrag = { id: a.id, offX: x - lPos.x, offY: y - lPos.y };
          this._emitSelect(a);
          this.render();
          return;
        }
      }

      for (const a of this.areas) {
        if (a._polyBox) {
          const b = a._polyBox;
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.selId = a.id;
            const tp = this.toPlane(x, y);
            this.areaDrag = { id: a.id, startX: tp.x, startY: tp.y };
            this._emitSelect(a);
            this.render();
            return;
          }
        }
      }

      for (const r of this.ramales) {
        const lPos = this.toCvs(r.labelX, r.labelY);
        const inBox = r._labelBox && this._pointInLabelBox(x, y, r._labelBox);
        const nearPoint = Math.hypot(x - lPos.x, y - lPos.y) < 12;
        if (inBox || nearPoint) {
          this.selId = r.id;
          this.lblDrag = { id: r.id, offX: x - lPos.x, offY: y - lPos.y };
          this._emitSelect(r);
          this.render();
          return;
        }
      }

      for (const b of this.bajantes) {
        if (b._labelBox && this._pointInLabelBox(x, y, b._labelBox)) {
          this.selId = b.id;
          const lPos = this.toCvs(b.labelX, b.labelY);
          this.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
          this._emitSelect(b);
          this.render();
          return;
        }
      }

      const fg = this.getBajantesFantasma();
      let gFound: PlanoBajante | null = null, gMin = 16;
      fg.forEach(b => {
        if (b._ghost) {
          const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
          if (d < b._ghost.r && d < gMin) { gMin = d; gFound = b; }
        }
      });
      if (gFound) {
        this.ghostDrag = { id: (gFound as any).id, startX: x, startY: y, baseDx: (gFound as any).desplazamientos?.[this.nivelActual?.label ?? '']?.dx || 0, baseDy: (gFound as any).desplazamientos?.[this.nivelActual?.label ?? '']?.dy || 0 };
        return;
      }
      this.selectAt(x, y);
      return;
    }

    if (this.tool === 'line') {
      let pt: Point = { x: p.x, y: p.y };
      if (this.tipoTramo === 'tributario' && !this.padreTributario) {
        this._emitStatus('Selecciona primero un ramal PADRE en el panel derecho');
        return;
      }
      if (!this.activeRamal) {
        if (this.tipoTramo === 'tributario' && this.padreTributario) {
          const padre = this.ramales.find(r => r.id === this.padreTributario);
          if (padre) {
            const spSegment = this._snapToSegment(pt.x, pt.y, padre.pts, 20 / this.zoom);
            if (spSegment) pt = spSegment;
          }
        }
        const sp = this.snapToExisting(pt.x, pt.y);
        if (sp) pt = sp;
        this.activeRamal = {
          net: this.activeNet,
          tipo: this.tipoTramo,
          padre: this.tipoTramo === 'tributario' ? this.padreTributario : null,
          pts: [[pt.x, pt.y]],
          totalL: 0,
        };
      } else {
        const last = this.activeRamal.pts[this.activeRamal.pts.length - 1];
        const first = this.activeRamal.pts[0];
        const distFirst = Math.hypot(pt.x - first[0], pt.y - first[1]);
        const SNAP_CLOSE = 12 / this.zoom;
        if (this.activeRamal.pts.length >= 3 && distFirst < SNAP_CLOSE) {
          this.activeRamal.totalL = +(this.activeRamal.totalL + this.pxToM(Math.hypot(first[0] - last[0], first[1] - last[1]))).toFixed(3);
          this.activeRamal.pts.push([first[0], first[1]]);
          this.finishRamal();
          return;
        }
        if (this.snapMode) pt = this.snapAngle(last[0], last[1], pt.x, pt.y);
        if (this.tipoTramo === 'tributario' && this.padreTributario) {
          const padre = this.ramales.find(r => r.id === this.padreTributario);
          if (padre) {
            const sp = this._snapToSegment(pt.x, pt.y, padre.pts, 20 / this.zoom);
            if (sp) pt = sp;
          }
        }
        const sp = this.snapToExisting(pt.x, pt.y);
        if (sp) pt = sp;
        const segPx = Math.hypot(pt.x - last[0], pt.y - last[1]);
        this.activeRamal.totalL = +(this.activeRamal.totalL + this.pxToM(segPx)).toFixed(3);
        this.activeRamal.pts.push([pt.x, pt.y]);
      }
      this._emitStatus(this._statusMsg());
      this.render();
      return;
    }

    if (this.tool === 'dim') {
      if (!this._dimStart) {
        this._dimStart = p;
      } else {
        const s = this._dimStart;
        const px = Math.hypot(p.x - s.x, p.y - s.y);
        this.dims.push({ id: 'D' + Date.now(), x1: s.x, y1: s.y, x2: p.x, y2: p.y, L: this.pxToM(px) });
        this._dimStart = null;
        this.render();
      }
      return;
    }

    if (this.tool === 'text') {
      const t = prompt('Texto:');
      if (t) {
        this.textAnnots.push({ id: 'T' + Date.now(), x: p.x, y: p.y, text: t, fontMm: 2.5, boxW: 0, lblOffX: 0, lblOffY: 0, textAngle: 0 });
        this.render();
      }
      return;
    }

    if (this.tool === 'baj') {
      const net = NETS.find(n => n.id === this.activeNet);
      const bType = net?.bmType || 'bajante';
      const bPfx = net?.bmPfx || 'B';
      const cnt = this.bajantes.filter(b => b.net === this.activeNet).length + 1;
      const bajId = bPfx + cnt;
      this.bajantes.push({
        id: bajId,
        net: this.activeNet,
        tipo: bType,
        code: bajId,
        x: p.x, y: p.y,
        pisoBase: '', pisoCima: '',
        nptBase: 0, nptCima: 0,
        hVert: 0, dNominal: '0',
        recibeDeIds: [], alimentaIds: [], descargaEnId: null,
        ucAcum: 0, ucExtra: 0, area_m2: 0,
        desplazamientos: {},
        lblOffX: 0, lblOffY: 0,
        labelAngle: 0,
        labelX: p.x, labelY: p.y + 20,
      });
      this.render();
      this._markDirty();
      return;
    }

    if (this.tool === 'segdel') {
      this.deleteSegmentAt(x, y);
      return;
    }

    if (this.tool === 'erase') {
      this.selectAt(x, y);
      this.deleteSelected();
      this._emitSelect(null);
      this.selId = null;
      return;
    }

    if (this.tool === 'area') {
      let pt: Point = { x: p.x, y: p.y };
      if (!this.activeArea) {
        if (this.snapMode) pt = this.snapAngle(p.x, p.y, pt.x, pt.y);
        this.activeArea = { pts: [[pt.x, pt.y]], color: (NETS.find(n => n.id === this.activeNet)?.col || 'rgba(0,220,229,0.2)') + '33' };
      } else {
        const last = this.activeArea.pts[this.activeArea.pts.length - 1];
        const first = this.activeArea.pts[0];
        if (this.snapMode) pt = this.snapAngle(last[0], last[1], pt.x, pt.y);
        const sp = this.snapToExisting(pt.x, pt.y);
        if (sp) pt = sp;
        const distFirst = Math.hypot(pt.x - first[0], pt.y - first[1]);
        const SNAP_CLOSE = 12 / this.zoom;
        if (this.activeArea.pts.length >= 3 && distFirst < SNAP_CLOSE) {
          this.finishArea();
          return;
        }
        this.activeArea.pts.push([pt.x, pt.y]);
      }
      this._emitStatus(this._statusMsg());
      this.render();
      return;
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
    if (this.ghostDrag) {
      const b = this.bajantes.find(b => b.id === this.ghostDrag!.id);
      if (b && this.nivelActual) {
        const dx = (x - this.ghostDrag.startX) / this.zoom + this.ghostDrag.baseDx;
        const dy = (y - this.ghostDrag.startY) / this.zoom + this.ghostDrag.baseDy;
        if (!b.desplazamientos) b.desplazamientos = {};
        b.desplazamientos[this.nivelActual.label ?? ''] = { dx, dy, Ldesvio: null };
        this.render();
      }
      return;
    }
    if (this.bajDrag) {
      const b = this.bajantes.find(b => b.id === this.bajDrag!.id);
      if (b) {
        const p = this.toPlane(x - this.bajDrag.offX, y - this.bajDrag.offY);
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        b.x = p.x;
        b.y = p.y;
        b.labelX = (b.labelX || 0) + dx;
        b.labelY = (b.labelY || 0) + dy;
        this.render();
      }
      return;
    }
    if (this.lblDrag) {
      const el = this.ramales.find(r => r.id === this.lblDrag!.id) || this.bajantes.find(b => b.id === this.lblDrag!.id) || this.areas.find(a => a.id === this.lblDrag!.id);
      if (el) {
        const p = this.toPlane(x - this.lblDrag.offX, y - this.lblDrag.offY);
        (el as PlanoRamal | PlanoArea | PlanoBajante).labelX = p.x;
        (el as PlanoRamal | PlanoArea | PlanoBajante).labelY = p.y;
        this.render();
      }
      return;
    }
    if (this.txtDrag) {
      const t = this.textAnnots.find(t => t.id === this.txtDrag!.id);
      if (t) {
        const p = this.toPlane(x, y);
        t.x = this.txtDrag.origX + (p.x - this.txtDrag.startX);
        t.y = this.txtDrag.origY + (p.y - this.txtDrag.startY);
        this.render();
      }
      return;
    }
    if (this.areaDrag) {
      const a = this.areas.find(a => a.id === this.areaDrag!.id);
      if (a) {
        const p = this.toPlane(x, y);
        const dx = p.x - this.areaDrag.startX;
        const dy = p.y - this.areaDrag.startY;
        a.pts.forEach(pt => { pt[0] += dx; pt[1] += dy; });
        if (a.labelX !== undefined) { a.labelX += dx; a.labelY += dy; }
        this.areaDrag.startX = p.x;
        this.areaDrag.startY = p.y;
        this.render();
      }
      return;
    }
    if (this.ptDrag) {
      const r = this.ramales.find(r => r.id === this.ptDrag!.id);
      if (r) {
        const p = this.toPlane(x, y);
        r.pts[this.ptDrag.ptIdx] = [p.x, p.y];
        r.totalL = 0;
        for (let i = 0; i < r.pts.length - 1; i++) {
          r.totalL += this.pxToM(Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]));
        }
        r.totalL = +r.totalL.toFixed(3);
        const [mx, my] = this._midpoint(r.pts);
        r.labelX = mx;
        r.labelY = my;
        this.render();
      }
      return;
    }
    if (this.activeRamal) {
      this.mouseX = x;
      this.mouseY = y;
      this.render();
    } else if (this._dimStart) {
      this.mouseX = x;
      this.mouseY = y;
      this.render();
    } else if (this.activeArea) {
      this.mouseX = x;
      this.mouseY = y;
      this.render();
    }
  }

  _onMouseUpHandler(e: MouseEvent | TouchEvent): void {
    void e;
    if (this.panning) {
      this.panning = false;
      this.canv.style.cursor = this.tool === 'pan' ? 'grab' : this.tool === 'sel' ? 'default' : 'crosshair';
    }
    if (this.ghostDrag) {
      const b = this.bajantes.find(b => b.id === this.ghostDrag!.id);
      if (b && this.nivelActual && b.desplazamientos?.[this.nivelActual.label ?? '']) {
        const d = b.desplazamientos[this.nivelActual.label ?? ''];
        if (Math.abs(d.dx) < 1 && Math.abs(d.dy) < 1) delete b.desplazamientos[this.nivelActual.label ?? ''];
      }
      this.ghostDrag = null;
      this.render();
    }
    if (this.lblDrag) { this.lblDrag = null; }
    if (this.txtDrag) { this.txtDrag = null; }
    if (this.bajDrag) { this.bajDrag = null; }
    if (this.areaDrag) { this.areaDrag = null; }
    if (this.ptDrag) { this.ptDrag = null; }
  }

  _onDblClickHandler(e: MouseEvent): void {
    void e;
    if (this.tool === 'line' && this.activeRamal && this.activeRamal.pts.length >= 2) {
      this.finishRamal();
    }
    if (this.tool === 'area' && this.activeArea && this.activeArea.pts.length >= 3) {
      this.finishArea();
    }
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

    renderDims(ctx, this as unknown as Record<string, unknown>);
    renderTexts(ctx, this as unknown as Record<string, unknown>);
    renderAreas(ctx, this as unknown as Record<string, unknown>);
    renderRamales(ctx, this as unknown as Record<string, unknown>);
    renderBajantes(ctx, this as unknown as Record<string, unknown>);
    renderGhosts(ctx, this as unknown as Record<string, unknown>);
    renderDimGhost(ctx, this as unknown as Record<string, unknown>);
    renderActiveArea(ctx, this as unknown as Record<string, unknown>);
    renderActiveRamal(ctx, this as unknown as Record<string, unknown>);
  }

  selectAt(cx: number, cy: number): void {
    let foundTxt: PlanoTextAnnotation | null = null;
    this.textAnnots.forEach(t => {
      if (t._box) {
        const b = t._box;
        if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) foundTxt = t;
      }
    });
    if (foundTxt) { this.selId = (foundTxt as any).id; this._emitSelect(foundTxt); this.render(); return; }

    let foundBaj: PlanoBajante | null = null, minBD = 16;
    this.bajantes.forEach(b => {
      if (b._labelBox && this._pointInLabelBox(cx, cy, b._labelBox)) {
        const d = Math.hypot(cx - b._labelBox.cx, cy - b._labelBox.cy);
        if (d < minBD) { minBD = d; foundBaj = b; }
      }
      if (b._circ) {
        const d = Math.hypot(cx - b._circ.x, cy - b._circ.y);
        if (d < b._circ.r && d < minBD) { minBD = d; foundBaj = b; }
      }
    });
    const fg = this.getBajantesFantasma();
    fg.forEach(b => {
      if (b._ghost) {
        const d = Math.hypot(cx - b._ghost.x, cy - b._ghost.y);
        if (d < b._ghost.r && d < minBD) { minBD = d; foundBaj = b; }
      }
    });
    if (foundBaj) { this.selId = (foundBaj as any).id; this._emitSelect(foundBaj); this.render(); return; }

    let found: PlanoRamal | null = null, minD = 20;
    this.ramales.forEach(r => {
      if (r._labelBox && this._pointInLabelBox(cx, cy, r._labelBox)) {
        const d = Math.hypot(cx - r._labelBox.cx, cy - r._labelBox.cy);
        if (d < minD) { minD = d; found = r; }
      }
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [x1, y1] = r.pts[i], [x2, y2] = r.pts[i + 1];
        const c1 = this.toCvs(x1, y1), c2 = this.toCvs(x2, y2);
        const ddx = c2.x - c1.x, ddy = c2.y - c1.y;
        const len2 = ddx * ddx + ddy * ddy;
        let d;
        if (len2 < 1) {
          d = Math.hypot(cx - c1.x, cy - c1.y);
        } else {
          const t = Math.max(0, Math.min(1, ((cx - c1.x) * ddx + (cy - c1.y) * ddy) / len2));
          const px = c1.x + t * ddx, py = c1.y + t * ddy;
          d = Math.hypot(cx - px, cy - py);
        }
        if (d < minD) { minD = d; found = r; }
      }
    });
    this.selId = found ? (found as any).id : null;

    let foundAreaLabel: PlanoArea | null = null;
    this.areas.forEach(a => {
      if (a._labelBox && this._pointInLabelBox(cx, cy, a._labelBox)) {
        foundAreaLabel = a;
      }
    });
    if (foundAreaLabel) { this.selId = (foundAreaLabel as any).id; this._emitSelect(foundAreaLabel); this.render(); return; }

    let foundArea: PlanoArea | null = null;
    this.areas.forEach(a => {
      if (this._pointInPoly(cx, cy, a.pts.map(pt => this.toCvs(pt[0], pt[1])))) {
        foundArea = a;
      }
    });
    if (foundArea) { this.selId = (foundArea as any).id; this._emitSelect(foundArea); this.render(); return; }

    this._emitSelect(found);
    this.render();
  }
}
