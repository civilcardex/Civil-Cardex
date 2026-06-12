import { NETS } from './PlanoState';
import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoDimension,
  PlanoTextAnnotation,
  PlanoActiveRamal,
  PlanoActiveArea,
} from './PlanoState';
import type { PlanoEngineAPI } from './PlanoEngineTypes';
import { loadFromStorage, saveToStorage } from '../../services/storageService';

type ToolType = 'sel' | 'line' | 'dim' | 'text' | 'baj' | 'pan' | 'area' | 'erase' | 'segdel';

export function toolCursor(tool: string): string {
  return tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair';
}

export function _statusMsg(engine: PlanoEngineAPI): string {
  const names: Record<string, string> = {
    sel: 'Seleccionar', line: 'Ramal', dim: 'Cota', text: 'Texto',
    baj: 'Bajante', pan: 'Pan', area: 'Área', erase: 'Borrar',
  };
  let m = names[engine.tool] || engine.tool;
  if (engine.tool === 'line') {
    const net = NETS.find(n => n.id === engine.activeNet);
    m += ` — ${net ? net.lbl : ''} [${engine.tipoTramo}]`;
    if (engine.activeRamal) m += ` (${engine.activeRamal.pts.length} pts, ${engine.activeRamal.totalL}m)`;
  }
  if (engine.tool === 'area' && engine.activeArea) {
    m += ` (${engine.activeArea.pts.length} pts)`;
  }
  return m;
}

export function _nextLabel(engine: PlanoEngineAPI): string {
  const net = NETS.find(n => n.id === engine.activeNet);
  const pfx = net ? net.lbl : 'R';
  const cnt = engine._netCounts[engine.activeNet]?.[engine.tipoTramo] || 0;
  if (engine.tipoTramo === 'tributario') {
    return `Trib${cnt}`;
  }
  return `${pfx}${cnt}`;
}

export function _midpoint(pts: number[][]): [number, number] {
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

export function _strokeAngle(pts: number[][]): number {
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

export function _calcPolyArea(engine: PlanoEngineAPI, pts: number[][]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  area = Math.abs(area) / 2;
  const m2 = area * Math.pow(2.54 * engine.scaleM / 96, 2);
  return +m2.toFixed(2);
}

export function setTool(engine: PlanoEngineAPI, t: ToolType): void {
  if (engine.activeRamal && engine.activeRamal.pts.length >= 2 && t !== 'line') finishRamal(engine);
  else if (engine.activeRamal && t !== 'line') cancelRamal(engine);
  if (engine.activeArea && t !== 'area') finishArea(engine);
  if (t !== 'dim') engine._dimStart = null;
  engine.tool = t;
  engine.canv.style.cursor = toolCursor(t);
  engine._emitStatus(_statusMsg(engine));
}

export function finishRamal(engine: PlanoEngineAPI): void {
  if (!engine.activeRamal || engine.activeRamal.pts.length < 1) return;
  if (engine.activeRamal.pts.length < 2) {
    engine.activeRamal = null;
    engine._emitStatus(_statusMsg(engine));
    engine.render();
    return;
  }
  const [mx, my] = _midpoint(engine.activeRamal.pts);
  const def = engine._ramalDefaults || { material: '', diametro: '', pendiente: 0 };
  const net = NETS.find(n => n.id === engine.activeRamal!.net);
  const netPfx = net ? net.lbl : 'R';
  const cnt = ++(engine._netCounts[engine.activeRamal!.net][engine.tipoTramo]);
  const id = engine.tipoTramo === 'tributario'
    ? 'T' + Date.now()
    : netPfx + cnt;

  try {
    const k = `${engine.activeRamal!.net}_${id}`;
    const AP_KEY = 'aparatos_by_tramo_v2';
    const HD_KEY = 'tramo_hidro_data_v3';
    const apData = loadFromStorage(AP_KEY, {}) as Record<string, unknown>;
    const hdData = loadFromStorage(HD_KEY, {}) as Record<string, unknown>;
    let changed = false;
    if (apData[k]) { delete apData[k]; changed = true; }
    if (hdData[k]) { delete hdData[k]; changed = true; }
    if (changed) {
      saveToStorage(AP_KEY, apData);
      saveToStorage(HD_KEY, hdData);
      window.dispatchEvent(new Event('storage'));
    }
  } catch (e) { console.error('PlanoEngine:', e); }

  const r: PlanoRamal = {
    id,
    net: engine.activeRamal!.net,
    tipo: engine.activeRamal!.tipo,
    padre: engine.activeRamal!.padre || null,
    pts: engine.activeRamal!.pts,
    totalL: engine.activeRamal!.totalL,
    label: _nextLabel(engine),
    ini: '', fin: '', piso: engine.nivelActual?.n ?? '', dz: '', uc: 0,
    labelX: mx, labelY: my,
    labelAngle: 0,
    material: def.material || '',
    diametro: def.diametro || '',
    pendiente: typeof def.pendiente === 'number' ? def.pendiente : 0,
  };
  engine.ramales.push(r);
  engine.activeRamal = null;
  engine.selId = r.id;
  engine._emitSelect(r);
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}

export function cancelRamal(engine: PlanoEngineAPI): void {
  engine.activeRamal = null;
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}

export function cancelArea(engine: PlanoEngineAPI): void {
  engine.activeArea = null;
  engine._emitStatus(_statusMsg(engine));
  engine.render();
}

export function finishArea(engine: PlanoEngineAPI): void {
  if (!engine.activeArea || engine.activeArea.pts.length < 3) {
    engine.activeArea = null;
    return;
  }
  const pts = engine.activeArea.pts;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const area: PlanoArea = {
    id: 'AR' + Date.now(),
    pts: pts.map(p => [...p]),
    color: engine.activeArea.color || 'rgba(0,220,229,0.2)33',
    label: '',
    labelX: cx,
    labelY: cy,
    labelAngle: 0,
    areaM2: _calcPolyArea(engine, pts),
  };
  engine.areas.push(area);
  engine.activeArea = null;
  engine._emitStatus(_statusMsg(engine));
  engine.render();
}

export function undoLast(engine: PlanoEngineAPI): void {
  if (engine.activeRamal) { cancelRamal(engine); return; }
  if (engine.activeArea) { cancelArea(engine); return; }
  if (engine.tool === 'baj' && engine.bajantes.length) {
    engine.bajantes.pop();
  } else if (engine.ramales.length) {
    engine.ramales.pop();
  } else if (engine.areas.length) {
    engine.areas.pop();
  } else if (engine.dims.length) {
    engine.dims.pop();
  } else if (engine.textAnnots.length) {
    engine.textAnnots.pop();
  }
  engine.selId = null;
  engine._emitSelect(null);
  engine.render();
  engine._markDirty();
}

export function clearAll(engine: PlanoEngineAPI): void {
  engine.ramales = [];
  engine.dims = [];
  engine.textAnnots = [];
  engine.bajantes = [];
  engine.areas = [];
  engine.activeRamal = null;
  engine.activeArea = null;
  engine.selId = null;
  engine._netCounts = {};
  NETS.forEach(n => { engine._netCounts[n.id] = { ramal: 0, tributario: 0 }; });
  engine._emitSelect(null);
  engine.render();
}

export function deleteSegmentAt(engine: PlanoEngineAPI, cx: number, cy: number): void {
  const plane = engine.toPlane(cx, cy);
  const HIT_DIST = 10 / engine.zoom;
  let bestR: any = null, bestIdx = -1, bestD = Infinity;

  for (const r of engine.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length; i++) {
      const d = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
      if (d < bestD) { bestD = d; bestIdx = i; bestR = r; }
    }
    if (bestD <= HIT_DIST) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const d = pointToSegDist(plane.x, plane.y, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]);
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
    engine.ramales = engine.ramales.filter(x => x.id !== r.id && x.padre !== r.id);
    if (r.tipo !== 'tributario') engine._renumberRamales(r.net);
    engine.selId = null;
    engine._emitSelect(null);
  } else {
    r.pts.splice(bestIdx, 1);
    r.totalL = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      r.totalL += engine.pxToM(Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]));
    }
    r.totalL = +r.totalL.toFixed(3);
    const [mx, my] = _midpoint(r.pts);
    r.labelX = mx;
    r.labelY = my;
  }
  engine.render();
  engine._markDirty();
}

export function setScaleM(engine: PlanoEngineAPI, v: string | number): void {
  engine.scaleM = parseFloat(String(v)) || 0.5;
  engine.ramales.forEach(r => {
    r.totalL = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, y1] = r.pts[i], [x2, y2] = r.pts[i + 1];
      r.totalL += engine.pxToM(Math.hypot(x2 - x1, y2 - y1));
    }
    r.totalL = +r.totalL.toFixed(3);
  });
  engine.render();
}

export function handleLineDown(engine: PlanoEngineAPI, px: number, py: number): void {
  let pt: { x: number; y: number } = { x: px, y: py };
  if (engine.tipoTramo === 'tributario' && !engine.padreTributario) {
    engine._emitStatus('Selecciona primero un ramal PADRE en el panel derecho');
    return;
  }
  if (!engine.activeRamal) {
    if (engine.tipoTramo === 'tributario' && engine.padreTributario) {
      const padre = engine.ramales.find((r: any) => r.id === engine.padreTributario);
      if (padre) {
        const spSegment = snapToSeg(pt.x, pt.y, padre.pts, 20 / engine.zoom);
        if (spSegment) pt = spSegment;
      }
    }
    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) pt = sp;
    engine.activeRamal = {
      net: engine.activeNet,
      tipo: engine.tipoTramo,
      padre: engine.tipoTramo === 'tributario' ? engine.padreTributario : null,
      pts: [[pt.x, pt.y]],
      totalL: 0,
    };
  } else {
    const last = engine.activeRamal.pts[engine.activeRamal.pts.length - 1];
    const first = engine.activeRamal.pts[0];
    const distFirst = Math.hypot(pt.x - first[0], pt.y - first[1]);
    const SNAP_CLOSE = 12 / engine.zoom;
    if (engine.activeRamal.pts.length >= 3 && distFirst < SNAP_CLOSE) {
      engine.activeRamal.totalL = +(engine.activeRamal.totalL + engine.pxToM(Math.hypot(first[0] - last[0], first[1] - last[1]))).toFixed(3);
      engine.activeRamal.pts.push([first[0], first[1]]);
      finishRamal(engine);
      return;
    }
    if (engine.snapMode) pt = engine.snapAngle(last[0], last[1], pt.x, pt.y);
    if (engine.tipoTramo === 'tributario' && engine.padreTributario) {
      const padre = engine.ramales.find((r: any) => r.id === engine.padreTributario);
      if (padre) {
        const sp = snapToSeg(pt.x, pt.y, padre.pts, 20 / engine.zoom);
        if (sp) pt = sp;
      }
    }
    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) pt = sp;
    const segPx = Math.hypot(pt.x - last[0], pt.y - last[1]);
    engine.activeRamal.totalL = +(engine.activeRamal.totalL + engine.pxToM(segPx)).toFixed(3);
    engine.activeRamal.pts.push([pt.x, pt.y]);
  }
  engine._emitStatus(_statusMsg(engine));
  engine.render();
}

export function handleDimDown(engine: PlanoEngineAPI, px: number, py: number): void {
  if (!engine._dimStart) {
    engine._dimStart = { x: px, y: py };
  } else {
    const s = engine._dimStart;
    const len = Math.hypot(px - s.x, py - s.y);
    engine.dims.push({ id: 'D' + Date.now(), x1: s.x, y1: s.y, x2: px, y2: py, L: engine.pxToM(len) });
    engine._dimStart = null;
    engine.render();
  }
}

export function handleTextDown(engine: PlanoEngineAPI, px: number, py: number): void {
  const t = prompt('Texto:');
  if (t) {
    engine.textAnnots.push({
      id: 'T' + Date.now(), x: px, y: py, text: t,
      fontMm: 2.5, boxW: 0, lblOffX: 0, lblOffY: 0, textAngle: 0,
    });
    engine.render();
  }
}

export function handleBajanteDown(engine: PlanoEngineAPI, px: number, py: number): void {
  const net = NETS.find(n => n.id === engine.activeNet);
  const bType = net?.bmType || 'bajante';
  const bPfx = net?.bmPfx || 'B';
  const cnt = engine.bajantes.filter(b => b.net === engine.activeNet).length + 1;
  const bajId = bPfx + cnt;
  engine.bajantes.push({
    id: bajId,
    net: engine.activeNet,
    tipo: bType,
    code: bajId,
    x: px, y: py,
    pisoBase: '', pisoCima: '',
    nptBase: 0, nptCima: 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: [], alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px, labelY: py + 20,
  });
  engine.render();
  engine._markDirty();
}

export function handleEraseDown(engine: PlanoEngineAPI, cx: number, cy: number): void {
  engine.selectAt(cx, cy);
  engine.deleteSelected();
  engine._emitSelect(null);
  engine.selId = null;
}

export function handleSegDelDown(engine: PlanoEngineAPI, cx: number, cy: number): void {
  deleteSegmentAt(engine, cx, cy);
}

export function handleAreaDown(engine: PlanoEngineAPI, px: number, py: number): void {
  let pt: { x: number; y: number } = { x: px, y: py };
  if (!engine.activeArea) {
    if (engine.snapMode) pt = engine.snapAngle(px, py, pt.x, pt.y);
    const netCol = (NETS.find(n => n.id === engine.activeNet)?.col || 'rgba(0,220,229,0.2)') + '33';
    engine.activeArea = { pts: [[pt.x, pt.y]], color: netCol };
  } else {
    const last = engine.activeArea.pts[engine.activeArea.pts.length - 1];
    const first = engine.activeArea.pts[0];
    if (engine.snapMode) pt = engine.snapAngle(last[0], last[1], pt.x, pt.y);
    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) pt = sp;
    const distFirst = Math.hypot(pt.x - first[0], pt.y - first[1]);
    const SNAP_CLOSE = 12 / engine.zoom;
    if (engine.activeArea.pts.length >= 3 && distFirst < SNAP_CLOSE) {
      finishArea(engine);
      return;
    }
    engine.activeArea.pts.push([pt.x, pt.y]);
  }
  engine._emitStatus(_statusMsg(engine));
  engine.render();
}

export function handleDrawingMouseMove(engine: PlanoEngineAPI, x: number, y: number): void {
  if (engine.activeRamal || engine._dimStart || engine.activeArea) {
    engine.mouseX = x;
    engine.mouseY = y;
    engine.render();
  }
}

export function handleDoubleClick(engine: PlanoEngineAPI): void {
  if (engine.tool === 'line' && engine.activeRamal && engine.activeRamal.pts.length >= 2) {
    finishRamal(engine);
  }
  if (engine.tool === 'area' && engine.activeArea && engine.activeArea.pts.length >= 3) {
    finishArea(engine);
  }
}

function pointToSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function snapToSeg(x: number, y: number, pts: number[][], threshold: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let minD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const ddx = x2 - x1, ddy = y2 - y1, len2 = ddx * ddx + ddy * ddy;
    if (len2 < 1) continue;
    const t = Math.max(0, Math.min(1, ((x - x1) * ddx + (y - y1) * ddy) / len2));
    const ptx = x1 + t * ddx, pty = y1 + t * ddy;
    const d = Math.hypot(x - ptx, y - pty);
    if (d < minD && d <= threshold) { minD = d; best = { x: ptx, y: pty }; }
  }
  return best;
}
