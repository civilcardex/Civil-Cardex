export const NETS = [
  { id: 'af', lbl: 'RAF', col: '#4D8FF7', ucType: 'uc', bmType: 'montante', bmPfx: 'MAF', bmIco: '⬆', emoji: '💧', name: 'Agua fría' },
  { id: 'ac', lbl: 'RAC', col: '#F04545', ucType: 'uc', bmType: 'montante', bmPfx: 'MAC', bmIco: '⬆', emoji: '🔥', name: 'Agua caliente' },
  { id: 'san', lbl: 'RS', col: '#F5A623', ucType: 'ud', bmType: 'bajante', bmPfx: 'BAN', bmIco: '⬇', emoji: '♻️', name: 'Sanitaria' },
  { id: 'll', lbl: 'RALL', col: '#22D3EE', ucType: null, bmType: 'bajante', bmPfx: 'BALL', bmIco: '⬇', emoji: '🌧️', name: 'Aguas lluvias' },
  { id: 'ven', lbl: 'RV', col: '#A3E635', ucType: 'ud', bmType: 'montante', bmPfx: 'MV', bmIco: '⬆', emoji: '💨', name: 'Ventilación' },
  { id: 'gas', lbl: 'RG', col: '#A855F7', ucType: null, bmType: 'montante', bmPfx: 'MG', bmIco: '⬆', emoji: '⛽', name: 'Gas' },
  { id: 'rci', lbl: 'RRCI', col: '#F87171', ucType: null, bmType: 'montante', bmPfx: 'MRCI', bmIco: '⬆', emoji: '🔴', name: 'Contra Incendio' },
  { id: 'rec', lbl: 'RREC', col: '#22D3EE', ucType: null, bmType: 'montante', bmPfx: 'MREC', bmIco: '⬆', emoji: '🔄', name: 'Recirculación' },
  { id: 'ep', lbl: 'REP', col: '#F5A623', ucType: null, bmType: 'montante', bmPfx: 'MEP', bmIco: '⬆', emoji: '⚡', name: 'Eléctrica Provisional' },
  { id: 'bom', lbl: 'RBOM', col: '#8A9BB8', ucType: null, bmType: 'bajante', bmPfx: 'BOM', bmIco: '⬇', emoji: '⬆️', name: 'Bombeo' },
];

export const APARATO_EMOJI = {
sif: '🔧',
san: '🚽',
  lvm: '👐',
  duc: '🚿',
  lvp: '🍽',
  tin: '🛀',
  lvra: '👕',
  sec: '👕',
  lvro: '👖',
  nev: '🧊',
  ori: '🚹',
  est4: '🍳',
  est2: '🍳',
  cal: '♨️',
  caf: '♨️',
  hor: '🎛',
  hor_g: '🎛',
  hor_m: '🎛',
  hor_p: '🎛',
  clim: '❄️',
  flu: '🚽',
  jac: '🛀',
  pisc: '♨️',
  sauna: '♨️',
  turco: '♨️',
  sec_g: '👕',
  sec_p: '👕',
  cal_b: '♨️',
};

export default class PlanoEngine {
  constructor(cw, pdfWrap, canv) {
    this.cw = cw;
    this.pdfWrap = pdfWrap;
    this.canv = canv;
    this.ctx = canv.getContext('2d');

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

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onDblClick = this._onDblClick.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    this.canv.addEventListener('mousedown', this._onDown);
    this.canv.addEventListener('mousemove', this._onMove);
    this.canv.addEventListener('mouseup', this._onUp);
    this.canv.addEventListener('mouseleave', this._onUp);
    this.canv.addEventListener('dblclick', this._onDblClick);
    this.canv.addEventListener('wheel', this._onWheel, { passive: false });
    this.canv.addEventListener('touchstart', this._wrapTouch(this._onDown), { passive: false });
    this.canv.addEventListener('touchmove', this._wrapTouch(this._onMove), { passive: false });
    this.canv.addEventListener('touchend', (e) => { e.preventDefault(); this._onUp(e); }, { passive: false });
    document.addEventListener('keydown', this._onKeyDown);

    this._onSelectCb = null;
    this._onStatusCb = null;
    this._dirty = false;

    this._loadedPlanId = null;
  }

onSelect(cb) { this._onSelectCb = cb; }
onStatus(cb) { this._onStatusCb = cb; }
onUpdate(cb) { this._onUpdateCb = cb; }
onDirty(cb) { this._onDirtyCb = cb; }

  selectById(id) {
    const found = this.ramales.find(r => r.id === id) || this.bajantes.find(b => b.id === id) ||
      this.textAnnots.find(t => t.id === id) || this.areas.find(a => a.id === id) ||
      this.dims.find(d => d.id === id);
    if (found) { this.selId = found.id; this._emitSelect(found); this.render(); }
  }

  getElementsByNet(netId) {
    const items = [];
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
          diametro: r.diametro
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
          diametro: b.dNominal
        });
      }
    }
    return items;
  }

  destroy() {
    this.canv.removeEventListener('mousedown', this._onDown);
    this.canv.removeEventListener('mousemove', this._onMove);
    this.canv.removeEventListener('mouseup', this._onUp);
    this.canv.removeEventListener('mouseleave', this._onUp);
    this.canv.removeEventListener('dblclick', this._onDblClick);
    this.canv.removeEventListener('wheel', this._onWheel);
    document.removeEventListener('keydown', this._onKeyDown);
  }

  setPageSize(w, h) {
    this.pageW = w;
    this.pageH = h;
  }

  resizeCanvas(w, h) {
    const dpr = this.dpr || 1;
    this.canv.width = Math.floor(w * dpr);
    this.canv.height = Math.floor(h * dpr);
    this.canv.style.width = w + 'px';
    this.canv.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  setNetHidden(netId, hidden) {
    if (hidden) this._hiddenNets.add(netId);
    else this._hiddenNets.delete(netId);
    this.render();
  }

  setNetLocked(netId, locked) {
    if (locked) this._lockedNets.add(netId);
    else this._lockedNets.delete(netId);
    this.render();
  }

  _wrapTouch(fn) {
    return (e) => { e.preventDefault(); fn(e); };
  }

  _getPos(e) {
    const r = this.canv.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  toCvs(px, py) { return { x: px * this.zoom + this.offX, y: py * this.zoom + this.offY }; }
  toPlane(cx, cy) { return { x: (cx - this.offX) / this.zoom, y: (cy - this.offY) / this.zoom }; }
  pxToM(px) { return +(px / 96 * 2.54 * this.scaleM).toFixed(3); }
  mm2cvs(mm) { return mm * 96 / 25.4 * this.zoom; }

  _emitStatus(msg) {
    if (this._onStatusCb) this._onStatusCb(msg);
  }

_emitSelect(el) {
if (!this._onSelectCb) return;
if (!el) { this._onSelectCb(null); return; }
const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = el;
this._onSelectCb(rest);
}

_markDirty() {
this._dirty = true;
if (this._onDirtyCb) this._onDirtyCb();
}

  setTool(t) {
    if (this.activeRamal && this.activeRamal.pts.length >= 2 && t !== 'line') this.finishRamal();
    else if (this.activeRamal && t !== 'line') this.cancelRamal();
    if (this.activeArea && t !== 'area') this.finishArea();
    if (t !== 'dim') this._dimStart = null;
    this.tool = t;
    this.canv.style.cursor = t === 'pan' ? 'grab' : t === 'sel' ? 'default' : 'crosshair';
    this._emitStatus(this._statusMsg());
  }

  setActiveNet(id) { this.activeNet = id; }
  setTipoTramo(t) { this.tipoTramo = t; }
  setSnap(v) { this.snapMode = v; }

  setPadreTributario(ramalId) {
    if (this.tipoTramo !== 'tributario') return;
    const padre = this.ramales.find(r => r.id === ramalId && r.net === this.activeNet && r.tipo === 'ramal');
    this.padreTributario = padre ? padre.id : null;
    this.render();
  }

  getPadreTributario() {
    if (!this.padreTributario) return null;
    return this.ramales.find(r => r.id === this.padreTributario) || null;
  }

  getRamalesPadre() {
    return this.ramales.filter(r => r.net === this.activeNet && r.tipo === 'ramal');
  }
  setRamalDefaults(d) {
    this._ramalDefaults = {
      material: d?.material || '',
      diametro: d?.diametro || '',
      pendiente: typeof d?.pendiente === 'number' ? d.pendiente : 0,
    };
  }
  setScaleM(v) {
    this.scaleM = parseFloat(v) || 0.5;
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

  _statusMsg() {
    const names = { sel: 'Seleccionar', line: 'Ramal', dim: 'Cota', text: 'Texto', baj: 'Bajante', pan: 'Pan', area: 'Área', erase: 'Borrar' };
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

  snapAngle(x0, y0, x1, y1) {
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

  snapToExisting(x, y) {
    const THRESH = 16 / this.zoom;
    let best = null, minD = THRESH;
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

  _snapToSegment(x, y, pts) {
    let best = null, minD = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const ddx = x2 - x1, ddy = y2 - y1, len2 = ddx * ddx + ddy * ddy;
      if (len2 < 1) continue;
      const t = Math.max(0, Math.min(1, ((x - x1) * ddx + (y - y1) * ddy) / len2));
      const px = x1 + t * ddx, py = y1 + t * ddy;
      const d = Math.hypot(x - px, y - py);
      if (d < minD) { minD = d; best = { x: px, y: py }; }
    }
    return best;
  }

  snapPreviewToPadre(x, y) {
    if (this.tipoTramo !== 'tributario' || !this.padreTributario || this.activeRamal) return null;
    const padre = this.ramales.find(r => r.id === this.padreTributario);
    if (!padre) return null;
    return this._snapToSegment(x, y, padre.pts);
  }

  selectAt(cx, cy) {
    let foundTxt = null;
    this.textAnnots.forEach(t => {
      if (t._box) {
        const b = t._box;
        if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) foundTxt = t;
      }
    });
    if (foundTxt) { this.selId = foundTxt.id; this._emitSelect(foundTxt); this.render(); return; }

    let foundBaj = null, minBD = 16;
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
    if (foundBaj) { this.selId = foundBaj.id; this._emitSelect(foundBaj); this.render(); return; }

    let found = null, minD = 20;
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
    this.selId = found ? found.id : null;

    // Check area label boxes before area polygons
    let foundAreaLabel = null;
    this.areas.forEach(a => {
      if (a._labelBox && this._pointInLabelBox(cx, cy, a._labelBox)) {
        foundAreaLabel = a;
      }
    });
    if (foundAreaLabel) { this.selId = foundAreaLabel.id; this._emitSelect(foundAreaLabel); this.render(); return; }

    // Check area polygons after ramales
    let foundArea = null;
    this.areas.forEach(a => {
      if (this._pointInPoly(cx, cy, a.pts.map(pt => this.toCvs(pt[0], pt[1])))) {
        foundArea = a;
      }
    });
    if (foundArea) { this.selId = foundArea.id; this._emitSelect(foundArea); this.render(); return; }

    this._emitSelect(found);
    this.render();
  }

  _pointInPoly(px, py, cvsPts) {
    let inside = false;
    for (let i = 0, j = cvsPts.length - 1; i < cvsPts.length; j = i++) {
      const xi = cvsPts[i].x, yi = cvsPts[i].y;
      const xj = cvsPts[j].x, yj = cvsPts[j].y;
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  _pointInLabelBox(px, py, box) {
    if (!box || !box.corners) return false;
    const dx = px - box.cx, dy = py - box.cy;
    const cosA = Math.cos(-box.angle), sinA = Math.sin(-box.angle);
    const lx = dx * cosA - dy * sinA;
    const ly = dx * sinA + dy * cosA;
    return Math.abs(lx) <= box.w / 2 && Math.abs(ly) <= box.h / 2;
  }

  _nextLabel() {
    const net = NETS.find(n => n.id === this.activeNet);
    const pfx = net ? net.lbl : 'R';
    const cnt = this._netCounts[this.activeNet][this.tipoTramo] || 0;
    if (this.tipoTramo === 'tributario') {
      return `Trib${cnt}`;
    }
    return `${pfx}${cnt}`;
  }

  finishRamal() {
    if (!this.activeRamal || this.activeRamal.pts.length < 1) return;
    if (this.activeRamal.pts.length < 2) { this.activeRamal = null; this._emitStatus(this._statusMsg()); this.render(); return; }
    const [mx, my] = this._midpoint(this.activeRamal.pts);
    const def = this._ramalDefaults || {};
    const net = NETS.find(n => n.id === this.activeRamal.net);
    const netPfx = net ? net.lbl : 'R';
    const cnt = ++(this._netCounts[this.activeRamal.net][this.tipoTramo]);
    const id = this.tipoTramo === 'tributario'
      ? 'T' + Date.now()
      : netPfx + cnt;
      
    // Clear any residual data in localStorage for this new ID to ensure it starts at 0
    try {
      const k = `${this.activeRamal.net}_${id}`;
      const AP_KEY = 'civilflow_aparatos_by_tramo_v2';
      const HD_KEY = 'civilflow_tramo_hidro_data_v3';
      const apData = JSON.parse(localStorage.getItem(AP_KEY) || '{}');
      const hdData = JSON.parse(localStorage.getItem(HD_KEY) || '{}');
      let changed = false;
      if (apData[k]) { delete apData[k]; changed = true; }
      if (hdData[k]) { delete hdData[k]; changed = true; }
      if (changed) {
        localStorage.setItem(AP_KEY, JSON.stringify(apData));
        localStorage.setItem(HD_KEY, JSON.stringify(hdData));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (_) {}
    const r = {
      id: id,
      net: this.activeRamal.net,
      tipo: this.activeRamal.tipo,
      padre: this.activeRamal.padre,
      pts: this.activeRamal.pts,
      totalL: this.activeRamal.totalL,
      label: this._nextLabel(),
      ini: '', fin: '', piso: '', dz: '', uc: 0,
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

  cancelRamal() {
    this.activeRamal = null;
    this._emitStatus(this._statusMsg());
    this.render();
    this._markDirty();
  }

  undoLast() {
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

  cancelArea() {
    this.activeArea = null;
    this._emitStatus(this._statusMsg());
    this.render();
  }

  finishArea() {
    if (!this.activeArea || this.activeArea.pts.length < 3) { this.activeArea = null; return; }
    const pts = this.activeArea.pts;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const area = {
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

  _calcPolyArea(pts) {
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

  clearAll() {
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

  clearNet(netId) {
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

  getSelected() {
    if (!this.selId) return null;
    return this.ramales.find(r => r.id === this.selId) || this.bajantes.find(b => b.id === this.selId) || this.textAnnots.find(t => t.id === this.selId) || this.areas.find(a => a.id === this.selId) || null;
  }

  _midpoint(pts) {
    let totalLen = 0;
    const segLens = [];
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
    return pts[pts.length - 1];
  }

  _strokeAngle(pts) {
    if (pts.length < 2) return 0;
    let totalLen = 0;
    const segLens = [];
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

  updateSelected(fields) {
    const el = this.getSelected();
    if (el) {
      Object.assign(el, fields);
      if (el.pts && el.id?.startsWith('R') && fields.pts) {
        const [mx, my] = this._midpoint(el.pts);
        el.labelX = mx;
        el.labelY = my;
      }
    }
    this.render();
  }

  updateElementById(id, fields) {
    let el = this.ramales.find(r => r.id === id) || this.bajantes.find(b => b.id === id) || this.textAnnots.find(t => t.id === id) || this.areas.find(a => a.id === id);
    if (el) {
      Object.assign(el, fields);
      if (el.pts && el.id?.startsWith('R') && fields.pts) {
        const [mx, my] = this._midpoint(el.pts);
        el.labelX = mx;
        el.labelY = my;
      }
      this.selId = id;
    }
    this.render();
  }

  rotateLabelSnap() {
    const el = this.getSelected();
    if (!el) return;
    const ANGLES = [0, 45, 90, -90, -45];
    if (el.id?.startsWith('T') && el.text !== undefined) {
      const cur = el.textAngle || 0;
      const idx = ANGLES.reduce((b, a, i) => Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b, 0);
      el.textAngle = ANGLES[(idx + 1) % ANGLES.length];
    } else {
      const cur = el.labelAngle || 0;
      const idx = ANGLES.reduce((b, a, i) => Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b, 0);
      el.labelAngle = ANGLES[(idx + 1) % ANGLES.length];
    }
    this._emitSelect(el);
    this.render();
  }

  deleteSelected() {
    if (!this.selId) return;
    const idxR = this.ramales.findIndex(r => r.id === this.selId);
    if (idxR >= 0) {
      const deleted = this.ramales[idxR];
      // Delete associated tributaries
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

  _renumberRamales(netId) {
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
        // Migrate aparatos data from old key to new key
        try {
          const AP_KEY = 'civilflow_aparatos_by_tramo_v2';
          const apData = JSON.parse(localStorage.getItem(AP_KEY) || '{}');
          const oldK = `${netId}_${oldId}`;
          const newK = `${netId}_${newId}`;
          if (apData[oldK]) { apData[newK] = apData[oldK]; delete apData[oldK]; localStorage.setItem(AP_KEY, JSON.stringify(apData)); }
        } catch (_) {}
        try {
          const HD_KEY = 'civilflow_tramo_hidro_data_v3';
          const hdData = JSON.parse(localStorage.getItem(HD_KEY) || '{}');
          const oldK = `${netId}_${oldId}`;
          const newK = `${netId}_${newId}`;
          if (hdData[oldK]) { hdData[newK] = hdData[oldK]; delete hdData[oldK]; localStorage.setItem(HD_KEY, JSON.stringify(hdData)); }
        } catch (_) {}
      }
      r.id = newId;
      r.label = newId;
      this.ramales.filter(t => t.padre === oldId).forEach(t => { t.padre = newId; });
    });
    this._netCounts[netId].ramal = ramalesNet.length;
  }

  deleteSegmentAt(cx, cy) {
    const plane = this.toPlane(cx, cy);
    const HIT_DIST = 10 / this.zoom;
    let bestR = null, bestIdx = -1, bestD = Infinity;

    for (const r of this.ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      for (let i = 0; i < r.pts.length; i++) {
        const d = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
        if (d < bestD) { bestD = d; bestIdx = i; bestR = r; }
      }
      if (bestD <= HIT_DIST) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const d = this._ptSegDist(plane.x, plane.y, r.pts[i], r.pts[i + 1]);
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

  _ptSegDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - a[0], py - a[1]);
    let t = ((px - a[0]) * dx + (py - a[1]) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }

  resetLabel() {
    const el = this.getSelected();
    if (!el) return;
    if (el.pts) {
      const [mx, my] = this._midpoint(el.pts);
      el.labelX = mx;
      el.labelY = my;
      el.labelAngle = 0;
    } else {
      el.labelX = el.x;
      el.labelY = el.y;
      el.labelAngle = 0;
    }
    this.render();
  }

  doZoom(delta, cx, cy) {
    if (cx === undefined) { cx = this.cw.clientWidth / 2; cy = this.cw.clientHeight / 2; }
    const nz = Math.max(0.05, Math.min(6, this.zoom + delta));
    this.offX = cx - (cx - this.offX) * (nz / this.zoom);
    this.offY = cy - (cy - this.offY) * (nz / this.zoom);
    this.zoom = nz;
    this.render();
  }

  fitPage() {
    if (!this.pageW || !this.pageH) return;
    const s = Math.min(
      (this.cw.clientWidth - 20) / this.pageW,
      (this.cw.clientHeight - 36) / this.pageH
    );
    this.zoom = s;
    this.offX = (this.cw.clientWidth - this.pageW * s) / 2;
    this.offY = 16;
    this.render();
  }

  getBajantesFantasma() {
    if (!this.nivelActual) return [];
    return this.bajantes.filter(b => {
      const base = Math.min(b.nptBase || 0, b.nptCima || 0);
      const cima = Math.max(b.nptBase || 0, b.nptCima || 0);
      const npt = this.nivelActual.npt || 0;
      if (npt >= base && npt <= cima) return true;
      const superior = this.nptLevels.filter(l => (l.npt || 0) > npt).sort((a, b) => (a.npt || 0) - (b.npt || 0))[0]?.npt;
      return superior !== undefined && (b.nptBase === superior || b.nptCima === superior);
    });
  }

  saveWork() {
    return JSON.stringify({
      v: 6, scaleM: this.scaleM, activeNet: this.activeNet,
      nets: NETS.map(n => ({ id: n.id, col: n.col })),
      ramales: this.ramales, dims: this.dims, textAnnots: this.textAnnots,
      bajantes: this.bajantes, areas: this.areas, nptLevels: this.nptLevels,
    });
  }

  loadWork(json) {
    try {
      const d = JSON.parse(json);
      this.scaleM = d.scaleM || 0.5;
      this.activeNet = d.activeNet || 'af';
      this.ramales = d.ramales || [];
      this.dims = d.dims || [];
      this.textAnnots = d.textAnnots || [];
      this.bajantes = d.bajantes || [];
      this.areas = d.areas || [];
      this.nptLevels = d.nptLevels || [];
      this.selId = null;
      this.activeRamal = null;
      this.activeArea = null;
      this._netCounts = {};
      NETS.forEach(n => { this._netCounts[n.id] = { ramal: 0, tributario: 0 }; });
      for (const r of this.ramales) {
        const net = NETS.find(n => n.id === r.net);
        if (net && r.tipo !== 'tributario') {
          const m = r.id?.match(new RegExp('^' + net.lbl + '(\\d+)$'));
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > (this._netCounts[r.net]?.[r.tipo] || 0)) {
              if (!this._netCounts[r.net]) this._netCounts[r.net] = { ramal: 0, tributario: 0 };
              this._netCounts[r.net][r.tipo] = n;
            }
          }
        }
      }
      this._dirty = false;
      this.render();
    } catch (e) { console.error('Error loading work:', e); }
  }

  _onDown(e) {
    const { x, y } = this._getPos(e);
    if (e.button === 1 || this.tool === 'pan') {
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

      // Drag already-selected bajante
      if (sel && sel._circ && sel.id?.startsWith('B')) {
        const d = Math.hypot(x - sel._circ.x, y - sel._circ.y);
        if (d < sel._circ.r) {
          this.bajDrag = { id: sel.id, offX: x - sel._circ.x, offY: y - sel._circ.y };
          return;
        }
      }

        // Drag already-selected label (ramales/bajantes/areas)
      if (sel && sel.labelX !== undefined && !sel.id?.startsWith('T')) {
        if (sel._labelBox && this._pointInLabelBox(x, y, sel._labelBox)) {
          const lPos = this.toCvs(sel.labelX, sel.labelY);
          this.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
          return;
        }
        if (!sel.id?.startsWith('B')) {
          const lPos = this.toCvs(sel.labelX, sel.labelY);
          if (Math.hypot(x - lPos.x, y - lPos.y) < 12) {
            this.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
            return;
          }
        }
      }

      // Drag already-selected ramal points
      if (sel && sel.pts && sel.id?.startsWith('R')) {
        for (let i = 0; i < sel.pts.length; i++) {
          const pc = this.toCvs(sel.pts[i][0], sel.pts[i][1]);
          if (Math.hypot(x - pc.x, y - pc.y) < 10) {
            this.ptDrag = { id: sel.id, ptIdx: i };
            return;
          }
        }
      }

      // Drag already-selected text annotation
      if (sel && sel._box && sel.id?.startsWith('T')) {
        const b = sel._box;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          const tp = this.toPlane(x, y);
          this.txtDrag = { id: sel.id, startX: tp.x, startY: tp.y, origX: sel.x, origY: sel.y };
          return;
        }
      }

      // Drag already-selected area
      if (sel && sel.id?.startsWith('AR') && sel._polyBox) {
        if (x >= sel._polyBox.x && x <= sel._polyBox.x + sel._polyBox.w && y >= sel._polyBox.y && y <= sel._polyBox.y + sel._polyBox.h) {
          const tp = this.toPlane(x, y);
          this.areaDrag = { id: sel.id, startX: tp.x, startY: tp.y };
          return;
        }
      }

      // Hit-test all text annotations (not just selected)
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

      // Hit-test all area labels (select + drag label in one click)
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

      // Hit-test all area polygons
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

      // Hit-test all ramal labels (select + drag in one click)
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

      // Hit-test all bajante label boxes (select + drag label in one click)
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
      let gFound = null, gMin = 16;
      fg.forEach(b => {
        if (b._ghost) {
          const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
          if (d < b._ghost.r && d < gMin) { gMin = d; gFound = b; }
        }
      });
      if (gFound) {
        this.ghostDrag = { id: gFound.id, startX: x, startY: y, baseDx: gFound.desplazamientos?.[this.nivelActual?.label]?.dx || 0, baseDy: gFound.desplazamientos?.[this.nivelActual?.label]?.dy || 0 };
        return;
      }
      this.selectAt(x, y);
      return;
    }

if (this.tool === 'line') {
  let pt = { x: p.x, y: p.y };
  if (this.tipoTramo === 'tributario' && !this.padreTributario) {
    this._emitStatus('Selecciona primero un ramal PADRE en el panel derecho');
    return;
  }
  if (!this.activeRamal) {
    if (this.tipoTramo === 'tributario' && this.padreTributario) {
      const sp = this.snapToExisting(pt.x, pt.y);
      if (sp) pt = sp;
    } else {
      const sp = this.snapToExisting(pt.x, pt.y);
      if (sp) pt = sp;
    }
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
        const sp = this._snapToSegment(pt.x, pt.y, padre.pts);
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
      let pt = { x: p.x, y: p.y };
      if (!this.activeArea) {
        if (this.snapMode) pt = this.snapAngle(p.x, p.y, pt.x, pt.y);
        this.activeArea = { pts: [[pt.x, pt.y]], color: NETS.find(n => n.id === this.activeNet)?.col + '33' || 'rgba(0,220,229,0.2)' };
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

  _onMove(e) {
    const { x, y } = this._getPos(e);
    this._lastMouseCvs = { x, y };
    if (this.panning) {
      this.offX = x - this.panX0;
      this.offY = y - this.panY0;
      this.render();
      return;
    }
    if (this.ghostDrag) {
      const b = this.bajantes.find(b => b.id === this.ghostDrag.id);
      if (b && this.nivelActual) {
        const dx = (x - this.ghostDrag.startX) / this.zoom + this.ghostDrag.baseDx;
        const dy = (y - this.ghostDrag.startY) / this.zoom + this.ghostDrag.baseDy;
        if (!b.desplazamientos) b.desplazamientos = {};
        b.desplazamientos[this.nivelActual.label] = { dx, dy, Ldesvio: null };
        this.render();
      }
      return;
    }
      if (this.bajDrag) {
        const b = this.bajantes.find(b => b.id === this.bajDrag.id);
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
      const el = this.ramales.find(r => r.id === this.lblDrag.id) || this.bajantes.find(b => b.id === this.lblDrag.id) || this.areas.find(a => a.id === this.lblDrag.id);
      if (el) {
        const p = this.toPlane(x - this.lblDrag.offX, y - this.lblDrag.offY);
        el.labelX = p.x;
        el.labelY = p.y;
        this.render();
      }
        return;
      }
      if (this.txtDrag) {
        const t = this.textAnnots.find(t => t.id === this.txtDrag.id);
        if (t) {
          const p = this.toPlane(x, y);
          t.x = this.txtDrag.origX + (p.x - this.txtDrag.startX);
          t.y = this.txtDrag.origY + (p.y - this.txtDrag.startY);
          this.render();
        }
        return;
      }
      if (this.areaDrag) {
        const a = this.areas.find(a => a.id === this.areaDrag.id);
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
        const r = this.ramales.find(r => r.id === this.ptDrag.id);
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

  _onUp(e) {
    if (this.panning) {
      this.panning = false;
      this.canv.style.cursor = this.tool === 'pan' ? 'grab' : this.tool === 'sel' ? 'default' : 'crosshair';
    }
    if (this.ghostDrag) {
      const b = this.bajantes.find(b => b.id === this.ghostDrag.id);
      if (b && this.nivelActual && b.desplazamientos?.[this.nivelActual.label]) {
        const d = b.desplazamientos[this.nivelActual.label];
        if (Math.abs(d.dx) < 1 && Math.abs(d.dy) < 1) delete b.desplazamientos[this.nivelActual.label];
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

  _onDblClick(e) {
    if (this.tool === 'line' && this.activeRamal && this.activeRamal.pts.length >= 2) {
      this.finishRamal();
    }
    if (this.tool === 'area' && this.activeArea && this.activeArea.pts.length >= 3) {
      this.finishArea();
    }
  }

  _onWheel(e) {
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

  _onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
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

  render() {
    const ctx = this.ctx;
    const w = this.canv.width, h = this.canv.height;
    ctx.clearRect(0, 0, w, h);

    if (this.pdfWrap) {
      this.pdfWrap.style.transform = `translate(${this.offX}px,${this.offY}px) scale(${this.zoom})`;
      this.pdfWrap.style.transformOrigin = '0 0';
      this.pdfWrap.style.imageRendering = 'pixelated';
      this.pdfWrap.style.imageRendering = 'crisp-edges';
      this.pdfWrap.style.willChange = 'transform';
    }

    this._drawDims(ctx);
    this._drawTexts(ctx);
    this._drawAreas(ctx);
    this._drawRamales(ctx);
    this._drawBajantes(ctx);
    this._drawGhosts(ctx);
    this._drawDimGhost(ctx);
    this._drawActiveArea(ctx);
    this._drawActiveRamal(ctx);
  }

  _drawDims(ctx) {
    this.dims.forEach(d => {
      const c1 = this.toCvs(d.x1, d.y1);
      const c2 = this.toCvs(d.x2, d.y2);
      ctx.save();
      ctx.strokeStyle = '#F5A623';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const dx = c2.x - c1.x, dy = c2.y - c1.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) { ctx.restore(); return; }
      const nx = -dy / len, ny = dx / len;
      const mk = 9;
      [c1, c2].forEach(pt => {
        ctx.beginPath();
        ctx.moveTo(pt.x - nx * mk, pt.y - ny * mk);
        ctx.lineTo(pt.x + nx * mk, pt.y + ny * mk);
        ctx.stroke();
      });

      const mx = (c1.x + c2.x) / 2, my = (c1.y + c2.y) / 2;
      const txt = `${d.L}m`;
      ctx.font = `${this.mm2cvs(this.MM.lblInfo)}px Geist, monospace`;
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(17,19,23,0.75)';
      ctx.fillRect(mx - tw / 2 - 4, my - 8, tw + 8, 16);
      ctx.fillStyle = '#F5A623';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, mx, my);
      ctx.restore();
    });
  }

  _drawTexts(ctx) {
    this.textAnnots.forEach(t => {
      const c = this.toCvs(t.x + (t.lblOffX || 0), t.y + (t.lblOffY || 0));
      const sel = t.id === this.selId;
      const fs = this.mm2cvs(t.fontMm || 2.5);
      const angle = (t.textAngle || 0) * Math.PI / 180;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(angle);
      ctx.font = `${fs}px Geist, monospace`;
      const tw = t.boxW > 0 ? t.boxW * this.zoom : ctx.measureText(t.text).width;
      const pad = 5;
      const boxW = tw + pad * 2;
      const boxH = fs + pad * 2;

      ctx.fillStyle = 'rgba(17,19,23,0.85)';
      ctx.strokeStyle = sel ? '#4D8FF7' : '#3a494a';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.beginPath();
      ctx.rect(-pad, -fs - pad, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      if (sel) {
        ctx.fillStyle = '#4D8FF7';
        ctx.beginPath();
        ctx.arc(-pad + boxW, -fs / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#e2e2e8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(t.text, 0, -fs);
      ctx.restore();

      const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
      t._box = {
        x: c.x - (boxW * cos + boxH * sin) / 2,
        y: c.y - (boxH * cos + boxW * sin) / 2,
        w: boxW * cos + boxH * sin,
        h: boxH * cos + boxW * sin,
      };
    });
  }

  _drawAreas(ctx) {
    this.areas.forEach(a => {
      if (this._hiddenNets.has(a.net)) return;
      if (a.pts.length < 3) return;
      const sel = a.id === this.selId;
      const pts = a.pts.map(p => this.toCvs(p[0], p[1]));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = a.color || 'rgba(0,220,229,0.12)';
      ctx.fill();
      ctx.strokeStyle = sel ? '#00dce5' : (a.color || 'rgba(0,220,229,0.5)').replace('0.2', '0.7').replace('33', 'aa');
      ctx.lineWidth = sel ? 2.5 : 1.5;
      ctx.setLineDash(sel ? [] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      pts.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      a._polyBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

        const lx = this.toCvs(a.labelX, a.labelY);

      if (a.label || a.areaM2) {
        ctx.save();
        ctx.translate(lx.x, lx.y);
        const aAngle = (a.labelAngle || 0) * Math.PI / 180;
        ctx.rotate(aAngle);
        const displayLabel = a.label || '';
        const areaLabel = a.areaM2 ? `${a.areaM2} m²` : '';
        const aFs = this.mm2cvs(this.MM.lblName);
        const aFsSub = this.mm2cvs(this.MM.lblInfo);
        ctx.font = `bold ${aFs}px Geist, monospace`;
        const tw = Math.max(ctx.measureText(displayLabel).width, ctx.measureText(areaLabel).width);
        const aBoxW = tw + 10, aBoxH = areaLabel ? aFs + aFsSub + 10 : aFs + 8;
        const aCosA = Math.cos(aAngle), aSinA = Math.sin(aAngle);
        const aCorners = [
          { x: lx.x + aCosA * (-aBoxW / 2) - aSinA * (-16 - aBoxH / 2), y: lx.y + aSinA * (-aBoxW / 2) + aCosA * (-16 - aBoxH / 2) },
          { x: lx.x + aCosA * (aBoxW / 2) - aSinA * (-16 - aBoxH / 2), y: lx.y + aSinA * (aBoxW / 2) + aCosA * (-16 - aBoxH / 2) },
          { x: lx.x + aCosA * (aBoxW / 2) - aSinA * (-16 + aBoxH / 2), y: lx.y + aSinA * (aBoxW / 2) + aCosA * (-16 + aBoxH / 2) },
          { x: lx.x + aCosA * (-aBoxW / 2) - aSinA * (-16 + aBoxH / 2), y: lx.y + aSinA * (-aBoxW / 2) + aCosA * (-16 + aBoxH / 2) },
        ];
        a._labelBox = {
          cx: lx.x, cy: lx.y - 16 + aBoxH / 2, w: aBoxW, h: aBoxH, angle: aAngle,
          minX: Math.min(...aCorners.map(c => c.x)) - 2,
          minY: Math.min(...aCorners.map(c => c.y)) - 2,
          maxX: Math.max(...aCorners.map(c => c.x)) + 2,
          maxY: Math.max(...aCorners.map(c => c.y)) + 2,
          corners: aCorners
        };
        ctx.fillStyle = 'rgba(17,19,23,0.82)';
        ctx.fillRect(-tw / 2 - 5, -16, aBoxW, aBoxH);
        ctx.fillStyle = sel ? '#00dce5' : '#e2e2e8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (displayLabel) ctx.fillText(displayLabel, 0, areaLabel ? -aFsSub / 2 - 2 : 0);
        if (areaLabel) {
          ctx.font = `bold ${aFsSub}px Geist, monospace`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(areaLabel, 0, displayLabel ? aFs / 2 + 2 : 0);
        }
        ctx.restore();
      } else {
        a._labelBox = null;
      }

      if (sel) {
        ctx.strokeStyle = '#4D8FF7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lx.x - 14, lx.y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#4D8FF7';
        ctx.fill();
      }

      ctx.restore();
    });
  }

  _drawActiveArea(ctx) {
    if (!this.activeArea || this.activeArea.pts.length < 1) return;
    const pts = this.activeArea.pts.map(p => this.toCvs(p[0], p[1]));
    const col = NETS.find(n => n.id === this.activeNet)?.col || '#00dce5';

    ctx.save();
    ctx.fillStyle = col + '22';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (pts.length >= 3) {
      ctx.closePath();
      ctx.fill();
    }
    ctx.stroke();
    ctx.setLineDash([]);

    pts.forEach((p, idx) => {
      ctx.fillStyle = idx === 0 ? '#fff' : col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    if (pts.length >= 1) {
      let mp = this.toPlane(this.mouseX, this.mouseY);
      const last = this.activeArea.pts[this.activeArea.pts.length - 1];
      if (this.snapMode) mp = this.snapAngle(last[0], last[1], mp.x, mp.y);
      const mc = this.toCvs(mp.x, mp.y);
      ctx.strokeStyle = col + '88';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.lineTo(mc.x, mc.y);
      if (pts.length >= 2) {
        ctx.lineTo(pts[0].x, pts[0].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      const first = this.activeArea.pts[0];
      const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
      const SNAP_CLOSE = 12 / this.zoom;
      if (this.activeArea.pts.length >= 3 && distFirst < SNAP_CLOSE) {
        const fc = this.toCvs(first[0], first[1]);
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fc.x, fc.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(34,211,238,0.25)';
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _drawRamales(ctx) {
    const isTributarioMode = this.tipoTramo === 'tributario' && this.tool === 'line';
    const padreId = this.padreTributario;
    this.ramales.forEach(r => {
      if (this._hiddenNets.has(r.net)) return;
      const net = NETS.find(n => n.id === r.net);
      const col = net ? net.col : '#e2e2e8';
      const sel = r.id === this.selId;
      const isPadre = r.id === padreId;
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = sel ? 3 : 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (r.pts.length > 1) {
        if (isPadre && isTributarioMode) {
          ctx.save();
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 3;
          ctx.strokeStyle = col;
          ctx.beginPath();
          const f = this.toCvs(r.pts[0][0], r.pts[0][1]);
          ctx.moveTo(f.x, f.y);
          for (let i = 1; i < r.pts.length; i++) {
            const c = this.toCvs(r.pts[i][0], r.pts[i][1]);
            ctx.lineTo(c.x, c.y);
          }
          ctx.stroke();
          ctx.restore();
        } else if (r.tipo === 'tributario') {
          ctx.save();
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          const f = this.toCvs(r.pts[0][0], r.pts[0][1]);
          ctx.moveTo(f.x, f.y);
          for (let i = 1; i < r.pts.length; i++) {
            const c = this.toCvs(r.pts[i][0], r.pts[i][1]);
            ctx.lineTo(c.x, c.y);
          }
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.beginPath();
          const f = this.toCvs(r.pts[0][0], r.pts[0][1]);
          ctx.moveTo(f.x, f.y);
          for (let i = 1; i < r.pts.length; i++) {
            const c = this.toCvs(r.pts[i][0], r.pts[i][1]);
            ctx.lineTo(c.x, c.y);
          }
          ctx.stroke();
        }
      }

      r.pts.forEach(([px, py]) => {
        const c = this.toCvs(px, py);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      if (isPadre && isTributarioMode && !this.activeRamal && r.pts.length >= 2) {
        const mp = this.snapPreviewToPadre(this.mouseX, this.mouseY);
        if (mp) {
          const c = this.toCvs(mp.x, mp.y);
          ctx.save();
          ctx.fillStyle = col;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      if (r.pts.length >= 2) {
        const cStart = this.toCvs(r.pts[0][0], r.pts[0][1]);
        const cEnd = this.toCvs(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1]);
        const drawEndMarker = (c, label) => {
          if (!label) return;
          ctx.save();
          ctx.font = `bold ${this.mm2cvs(1.6)}px Geist, monospace`;
          const tw = ctx.measureText(label).width;
          const pad = 3;
          const w = tw + pad * 2;
          const h = this.mm2cvs(2.4) + pad * 2;
          ctx.fillStyle = 'rgba(17,19,23,0.85)';
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(c.x + 6, c.y - h / 2, w, h);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = col;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, c.x + 6 + pad, c.y);
          ctx.restore();
        };
        drawEndMarker(cStart, r.ini);
        drawEndMarker(cEnd, r.fin);
      }

        if (r.label || r.totalL || r.material || r.diametro || r.pendiente) {
        const lc = this.toCvs(r.labelX, r.labelY);
        const FLOW_NETS = ['san', 'll', 'af', 'ac'];
        const showFlow = FLOW_NETS.includes(r.net) && r.pts.length >= 2;
        let flowDx = 0, flowDy = 0, flowLen = 0;
        if (showFlow) {
          const fc = this.toCvs(r.pts[0][0], r.pts[0][1]);
          const lastc = this.toCvs(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1]);
          flowDx = lastc.x - fc.x;
          flowDy = lastc.y - fc.y;
          flowLen = Math.hypot(flowDx, flowDy);
        }
        const VERT_THRESH = 8;
        const isVertical = Math.abs(flowDx) < VERT_THRESH && flowLen > 12;
        const arrowSize = showFlow && flowLen > 12 ? 34 : 0;
        const lbl = (r.tipo === 'tributario')
          ? (() => {
              const padre = r.padre ? this.ramales.find(p => p.id === r.padre) : null;
              return padre ? (padre.label || padre.id) : (r.label || '');
            })()
          : (r.label || '');
        const matPart = r.material || '';
        const dPart = r.diametro ? `D=${r.diametro}` : '';
        const lblPart = r.totalL ? `${r.totalL.toFixed(2)}m` : '';
        const pPart = r.pendiente ? `S=${r.pendiente}%` : '';
        const showPend = (r.net === 'san' || r.net === 'll');
        const pendPart = showPend && pPart ? pPart : '';

        const fsName = this.mm2cvs(this.MM.lblName);
        const fsInfo = this.mm2cvs(this.MM.lblInfo);
        const lineHName = fsName + 2;
        const lineHInfo = fsInfo + 4;
        const boxPadX = this.mm2cvs(1.0);
        const boxPadY = this.mm2cvs(0.6);

        // Build info segments in order: material · diameter · length · slope
        const infoSegs = [
          matPart ? { text: matPart, bold: false, w: 0 } : null,
          dPart ? { text: dPart, bold: true, w: 0 } : null,
          lblPart ? { text: lblPart, bold: false, w: 0 } : null,
          pendPart ? { text: pendPart, bold: false, w: 0 } : null,
        ].filter(Boolean);
        const segSep = ' · ';
        let sepW = 0;
        ctx.font = `600 ${fsInfo}px Geist, monospace`;
        if (infoSegs.length > 1) sepW = ctx.measureText(segSep).width;
        for (const s of infoSegs) {
          ctx.font = s.bold ? `bold ${fsName}px Geist, monospace` : `600 ${fsInfo}px Geist, monospace`;
          s.w = ctx.measureText(s.text).width;
        }
        const totalInfoW = infoSegs.reduce((sum, s, i) => sum + s.w + (i < infoSegs.length - 1 ? sepW : 0), 0);

        ctx.font = `bold ${fsName}px Geist, monospace`;
        const nameW = lbl ? ctx.measureText(lbl).width : 0;
        const contentW = Math.max(nameW, totalInfoW);
        const boxW = contentW + boxPadX * 2;
        const boxH = (lbl ? lineHName : 0) + (infoSegs.length > 0 ? lineHInfo : 0) + boxPadY * 2;
        const RIGHT_GAP = 10;
        const ARROW_GAP = 8;
        let drawX, drawY;
        if (isVertical) {
          const arrowSpace = showFlow ? arrowSize + ARROW_GAP : 0;
          drawX = lc.x + RIGHT_GAP + arrowSpace + boxW / 2;
          drawY = lc.y;
        } else {
          drawX = lc.x;
          drawY = lc.y - (boxH / 2 + 4);
        }
        const labelAngle = (r.labelAngle || 0) * Math.PI / 180;

        const cosA = Math.cos(labelAngle), sinA = Math.sin(labelAngle);
        const hw = boxW / 2, hh = boxH / 2;
        const corners = [
          { x: drawX + cosA * (-hw) - sinA * (-hh), y: drawY + sinA * (-hw) + cosA * (-hh) },
          { x: drawX + cosA * (hw) - sinA * (-hh), y: drawY + sinA * (hw) + cosA * (-hh) },
          { x: drawX + cosA * (hw) - sinA * (hh), y: drawY + sinA * (hw) + cosA * (hh) },
          { x: drawX + cosA * (-hw) - sinA * (hh), y: drawY + sinA * (-hw) + cosA * (hh) },
        ];
        r._labelBox = {
          cx: drawX, cy: drawY, w: boxW, h: boxH, angle: labelAngle,
          minX: Math.min(...corners.map(c => c.x)),
          minY: Math.min(...corners.map(c => c.y)),
          maxX: Math.max(...corners.map(c => c.x)),
          maxY: Math.max(...corners.map(c => c.y)),
          corners
        };

        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.rotate(labelAngle);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (lbl) {
          ctx.font = `bold ${fsName}px Geist, monospace`;
          ctx.fillStyle = col;
          ctx.fillText(lbl, 0, -boxH / 2 + boxPadY + lineHName / 2);
        }
        if (infoSegs.length > 0) {
          const yInfo = boxH / 2 - boxPadY - lineHInfo / 2;
          let xCursor = -totalInfoW / 2;
          for (let i = 0; i < infoSegs.length; i++) {
            const s = infoSegs[i];
            ctx.font = s.bold ? `bold ${fsName}px Geist, monospace` : `600 ${fsInfo}px Geist, monospace`;
            ctx.fillStyle = s.bold ? '#000000' : '#1a1a1a';
            ctx.textAlign = 'left';
            ctx.fillText(s.text, xCursor, yInfo);
            xCursor += s.w;
            if (i < infoSegs.length - 1) {
              ctx.font = `600 ${fsInfo}px Geist, monospace`;
              ctx.fillStyle = '#1a1a1a';
              ctx.fillText(segSep, xCursor, yInfo);
              xCursor += sepW;
            }
          }
          ctx.textAlign = 'center';
        }

        // Flow arrow inside rotated context — always parallel to label
        if (showFlow && flowLen > 12) {
          const arrowGap = 6;
          const arrowY = boxH / 2 + arrowGap + arrowSize / 2;
          ctx.save();
          ctx.translate(0, arrowY);
          // Determine flow direction in rotated label space
          const dot = flowDx * cosA + flowDy * sinA;
          const dir = dot >= 0 ? 1 : -1;
          const halfSize = arrowSize / 2;
          ctx.strokeStyle = col;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-halfSize * dir, 0);
          ctx.lineTo(halfSize * dir, 0);
          ctx.stroke();
          const aSize = 9;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(halfSize * dir, 0);
          ctx.lineTo(halfSize * dir - dir * aSize, -aSize * 0.5);
          ctx.lineTo(halfSize * dir - dir * aSize, aSize * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      } else {
        r._labelBox = null;
      }

      ctx.restore();
    });
  }

  _drawBajantes(ctx) {
    this.bajantes.forEach(b => {
      if (this._hiddenNets.has(b.net)) return;
      const net = NETS.find(n => n.id === b.net);
      const col = net ? net.col : '#e2e2e8';
      const c = this.toCvs(b.x, b.y);
      const sel = b.id === this.selId;
      const r = 14 * this.zoom;
      const angle = (b.labelAngle || 0) * Math.PI / 180;
      b._circ = { x: c.x, y: c.y, r };

      if (b.recibeDeIds?.length) {
        b.recibeDeIds.forEach(rid => {
          const ram = this.ramales.find(rr => rr.id === rid);
          if (ram) {
            const last = ram.pts[ram.pts.length - 1];
            const rc = this.toCvs(last[0], last[1]);
            ctx.save();
            ctx.strokeStyle = '#22D3EE';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(rc.x, rc.y);
            ctx.lineTo(c.x, c.y);
            ctx.stroke();
            ctx.restore();
          }
        });
      }

      if (b.descargaEnId) {
        const ram = this.ramales.find(rr => rr.id === b.descargaEnId);
        if (ram && ram.pts.length) {
          const first = ram.pts[0];
          const rc = this.toCvs(first[0], first[1]);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(rc.x, rc.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(angle);

      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F04545';
      ctx.lineWidth = sel ? 3 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      if (b.tipo === 'bajante') {
        const aS = r * 0.7;
        ctx.strokeStyle = '#F04545';
        ctx.lineWidth = r * 0.15;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(0, aS * 0.9);
        ctx.lineTo(0, -aS * 0.5);
        ctx.stroke();
        ctx.fillStyle = '#F04545';
        ctx.beginPath();
        ctx.moveTo(0, -aS * 0.9);
        ctx.lineTo(-aS * 0.4, -aS * 0.3);
        ctx.lineTo(aS * 0.4, -aS * 0.3);
        ctx.closePath();
        ctx.fill();
      } else {
        const aS = r * 0.7;
        ctx.strokeStyle = '#F04545';
        ctx.lineWidth = r * 0.15;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(0, -aS * 0.9);
        ctx.lineTo(0, aS * 0.5);
        ctx.stroke();
        ctx.fillStyle = '#F04545';
        ctx.beginPath();
        ctx.moveTo(0, aS * 0.9);
        ctx.lineTo(-aS * 0.4, aS * 0.3);
        ctx.lineTo(aS * 0.4, aS * 0.3);
        ctx.closePath();
        ctx.fill();
      }

    if (b.code || b.code === '') {
      const offDx = (b.labelX - b.x) * this.zoom;
      const offDy = (b.labelY - b.y) * this.zoom;
      ctx.save();
      ctx.translate(offDx, offDy);
      const fsCode = this.mm2cvs(this.MM.lblCode);
      const fsBInfo = this.mm2cvs(this.MM.lblInfo);
      const lineH = fsBInfo + 2;
      ctx.font = `bold ${fsCode}px Geist, monospace`;
      const displayCode = b.code || '—';
      const tw = ctx.measureText(displayCode).width;
      const boxW = tw + this.mm2cvs(2);
      const boxH = lineH * (1 + (b.hVert !== undefined ? 1 : 0) + (b.dNominal !== undefined ? 1 : 0)) + this.mm2cvs(1.2);
      const lbCx = c.x + offDx * Math.cos(angle) - offDy * Math.sin(angle);
      const lbCy = c.y + offDx * Math.sin(angle) + offDy * Math.cos(angle);
      const cosA2 = Math.cos(angle), sinA2 = Math.sin(angle);
      const hw2 = boxW / 2, hh2 = boxH / 2;
      const corners2 = [
        { x: lbCx + cosA2 * (-hw2) - sinA2 * (-10 - hh2), y: lbCy + sinA2 * (-hw2) + cosA2 * (-10 - hh2) },
        { x: lbCx + cosA2 * (hw2) - sinA2 * (-10 - hh2), y: lbCy + sinA2 * (hw2) + cosA2 * (-10 - hh2) },
        { x: lbCx + cosA2 * (hw2) - sinA2 * (-10 + hh2), y: lbCy + sinA2 * (hw2) + cosA2 * (-10 + hh2) },
        { x: lbCx + cosA2 * (-hw2) - sinA2 * (-10 + hh2), y: lbCy + sinA2 * (-hw2) + cosA2 * (-10 + hh2) },
      ];
      b._labelBox = {
        cx: lbCx, cy: lbCy - 10 + hh2, w: boxW, h: boxH, angle,
        minX: Math.min(...corners2.map(c2 => c2.x)) - 2,
        minY: Math.min(...corners2.map(c2 => c2.y)) - 2,
        maxX: Math.max(...corners2.map(c2 => c2.x)) + 2,
        maxY: Math.max(...corners2.map(c2 => c2.y)) + 2,
        corners: corners2
      };
      ctx.fillStyle = 'rgba(17,19,23,0.82)';
      ctx.fillRect(-tw / 2 - 4, -10, boxW, boxH);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayCode, 0, -boxH / 2 + lineH / 2 + 2);
      let labelY = -boxH / 2 + lineH * 1.5 + 2;
      if (b.hVert !== undefined) {
        ctx.font = `${fsBInfo}px Geist, monospace`;
        ctx.fillStyle = '#849495';
        ctx.fillText(`H=${b.hVert}m`, 0, labelY);
        labelY += lineH;
      }
      if (b.dNominal !== undefined) {
        ctx.font = `${fsBInfo}px Geist, monospace`;
        ctx.fillStyle = '#849495';
        ctx.fillText(`D=${b.dNominal && b.dNominal !== '0' ? b.dNominal : ''}mm`, 0, labelY);
      }
      if (sel) {
        ctx.strokeStyle = '#4D8FF7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-14, 0, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#4D8FF7';
        ctx.fill();
      }
      ctx.restore();
    } else {
      b._labelBox = null;
    }

      ctx.restore();
    });
  }

  _drawGhosts(ctx) {
    const fg = this.getBajantesFantasma();
    fg.forEach(b => {
      const net = NETS.find(n => n.id === b.net);
      const col = net ? net.col : '#e2e2e8';
      const disp = b.desplazamientos?.[this.nivelActual?.label];
      const gx = b.x + (disp ? disp.dx : 0);
      const gy = b.y + (disp ? disp.dy : 0);
      const c = this.toCvs(gx, gy);
      const r = 14 * this.zoom;
      b._ghost = { x: c.x, y: c.y, r };

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `${this.mm2cvs(this.MM.flowEmoji)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.tipo === 'bajante' ? '⬇' : '⬆', c.x, c.y);
      ctx.setLineDash([]);
      ctx.restore();

      if (disp && (Math.abs(disp.dx) > 1 || Math.abs(disp.dy) > 1)) {
        const orig = this.toCvs(b.x, b.y);
        ctx.save();
        ctx.strokeStyle = col + '66';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(orig.x, orig.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  _drawDimGhost(ctx) {
    if (!this._dimStart || this.tool !== 'dim') return;
    const s = this.toCvs(this._dimStart.x, this._dimStart.y);
    const mp = this.toPlane(this.mouseX, this.mouseY);
    const e = this.toCvs(mp.x, mp.y);

    ctx.save();
    ctx.strokeStyle = '#F5A623';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const dx = e.x - s.x, dy = e.y - s.y;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      const nx = -dy / len, ny = dx / len;
      const mk = 9;
      [s, e].forEach(pt => {
        ctx.beginPath();
        ctx.moveTo(pt.x - nx * mk, pt.y - ny * mk);
        ctx.lineTo(pt.x + nx * mk, pt.y + ny * mk);
        ctx.stroke();
      });

      const mx = (s.x + e.x) / 2, my = (s.y + e.y) / 2;
      const px = Math.hypot(mp.x - this._dimStart.x, mp.y - this._dimStart.y);
      const txt = `${this.pxToM(px).toFixed(2)}m`;
      ctx.font = `${this.mm2cvs(this.MM.lblInfo)}px Geist, monospace`;
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(17,19,23,0.75)';
      ctx.fillRect(mx - tw / 2 - 4, my - 8, tw + 8, 16);
      ctx.fillStyle = '#F5A623';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, mx, my);
    }

    ctx.fillStyle = '#F5A623';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawActiveRamal(ctx) {
    if (!this.activeRamal) return;
    const net = NETS.find(n => n.id === this.activeRamal.net);
    const col = net ? net.col : '#e2e2e8';

    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (this.activeRamal.pts.length > 1) {
      ctx.beginPath();
      const f = this.toCvs(this.activeRamal.pts[0][0], this.activeRamal.pts[0][1]);
      ctx.moveTo(f.x, f.y);
      for (let i = 1; i < this.activeRamal.pts.length; i++) {
        const c = this.toCvs(this.activeRamal.pts[i][0], this.activeRamal.pts[i][1]);
        ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();
    }

    this.activeRamal.pts.forEach(([px, py], idx) => {
      const c = this.toCvs(px, py);
      ctx.fillStyle = idx === 0 ? '#fff' : col;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const first = this.activeRamal.pts[0];
    const last = this.activeRamal.pts[this.activeRamal.pts.length - 1];
    let mp = this.toPlane(this.mouseX, this.mouseY);
    if (this.snapMode) mp = this.snapAngle(last[0], last[1], mp.x, mp.y);
    const sp = this.snapToExisting(mp.x, mp.y);
    if (sp) mp = sp;

    const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
    const SNAP_CLOSE = 12 / this.zoom;
    if (this.activeRamal.pts.length >= 3 && distFirst < SNAP_CLOSE) {
      const fc = this.toCvs(first[0], first[1]);
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fc.x, fc.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(34,211,238,0.25)';
      ctx.beginPath();
      ctx.arc(fc.x, fc.y, 10, 0, Math.PI * 2);
      ctx.fill();
      mp = { x: first[0], y: first[1] };
    }

    const lc = this.toCvs(last[0], last[1]);
    const mc = this.toCvs(mp.x, mp.y);

    ctx.strokeStyle = col + '88';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(lc.x, lc.y);
    ctx.lineTo(mc.x, mc.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (sp) {
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mc.x, mc.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    const segPx = Math.hypot(mp.x - last[0], mp.y - last[1]);
    const segM = this.pxToM(segPx);
    const deg = Math.atan2(mp.y - last[1], mp.x - last[0]) * 180 / Math.PI;
    const cursorLabel = `${segM}m  ${Math.round(((deg % 360) + 360) % 360)}°`;
    ctx.font = `${this.mm2cvs(this.MM.coord)}px Geist, monospace`;
    const tw = ctx.measureText(cursorLabel).width;
    ctx.fillStyle = 'rgba(17,19,23,0.82)';
    ctx.fillRect(mc.x + 12, mc.y - 18, tw + 8, 16);
    ctx.fillStyle = '#e2e2e8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cursorLabel, mc.x + 16, mc.y - 10);

    ctx.restore();
  }
}
