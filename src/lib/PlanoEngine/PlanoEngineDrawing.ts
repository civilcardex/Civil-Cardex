import { NETS } from './PlanoState';
import type {
  PlanoRamal,
  PlanoArea,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { pointToSegmentDist } from './HitTester';

type ToolType = 'sel' | 'line' | 'dim' | 'text' | 'baj' | 'mon' | 'pan' | 'area' | 'erase' | 'segdel' | 'delm' | 'red_pub' | 'cont' | 'calent';

export function toolCursor(tool: string): string {
  return tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair';
}

export function _statusMsg(engine: IPlanoEngineCore): string {
  const names: Record<string, string> = {
    sel: 'Seleccionar elemento', line: 'Ramal', dim: 'Cota', text: 'Texto',
    baj: 'Bajante', mon: 'Montante', pan: 'Pan', area: 'Área', erase: 'Borrar',
    delm: 'Eliminar elemento', red_pub: 'Red Pública', cont: 'Contador',
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

export function _nextLabel(engine: IPlanoEngineCore): string {
  const net = NETS.find(n => n.id === engine.activeNet);
  const pfx = net ? net.lbl : 'R';
  const cnt = engine._netCounts[engine.activeNet]?.[engine.tipoTramo as keyof typeof engine._netCounts[string]] || 0;
  if (engine.tipoTramo === 'tributario') {
    const padre = engine.ramales.find((r: any) => r.id === engine.padreTributario);
    const padreLabel = padre ? (padre.label || padre.id) : '';
    return `T${cnt}${padreLabel}`;
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

export function _firstSegmentAngle(pts: number[][]): number {
  if (pts.length < 2) return 0;
  const dx = pts[1][0] - pts[0][0];
  const dy = pts[1][1] - pts[0][1];
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return Math.round(angle);
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

export function _calcPolyArea(engine: IPlanoEngineCore, pts: number[][]): number {
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

export function setTool(engine: IPlanoEngineCore, t: ToolType): void {
  if (engine.activeRamal && engine.activeRamal.pts.length >= 2 && t !== 'line') finishRamal(engine);
  else if (engine.activeRamal && t !== 'line') cancelRamal(engine);
  if (engine.activeArea && t !== 'area') finishArea(engine);
  if (t !== 'dim') engine._dimStart = null;
  engine.tool = t;
  engine.canv.style.cursor = toolCursor(t);
  engine._emitStatus(_statusMsg(engine));
}

export function calculateRamalLength(pts: number[][], engine: IPlanoEngineCore): number {
  let len = 0;
  const segments: Array<[number, number, number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const x1 = pts[i][0], y1 = pts[i][1];
    const x2 = pts[i + 1][0], y2 = pts[i + 1][1];
    
    let isBacktrack = false;
    for (const [sx1, sy1, sx2, sy2] of segments) {
      const distStart = Math.hypot(x1 - sx2, y1 - sy2);
      const distEnd = Math.hypot(x2 - sx1, y2 - sy1);
      if (distStart < 0.1 && distEnd < 0.1) {
        isBacktrack = true;
        break;
      }
    }
    if (isBacktrack) continue;
    
    segments.push([x1, y1, x2, y2]);
    len += engine.pxToM(Math.hypot(x2 - x1, y2 - y1));
  }
  return +len.toFixed(3);
}

export function finishRamal(engine: IPlanoEngineCore): void {
  engine._yeeFlashKey = null;
  if (!engine.activeRamal || engine.activeRamal.pts.length < 1) return;
  if (engine.activeRamal.pts.length < 2) {
    engine.activeRamal = null;
    engine._emitStatus(_statusMsg(engine));
    engine.render();
    return;
  }
  if (engine.activeRamal.id) {
    const existing = engine.ramales.find(r => r.id === engine.activeRamal!.id);
    if (existing) {
      existing.pts = engine.activeRamal.pts;
      existing.totalL = calculateRamalLength(engine.activeRamal.pts, engine);
      engine.activeRamal = null;
      engine.selId = existing.id;
      engine._emitSelect(existing);
      engine._emitStatus(_statusMsg(engine));
      engine.render();
      engine._markDirty();
      return;
    }
  }

  const def = engine._ramalDefaults || { material: '', diametro: '', pendiente: 0 };
  const net = NETS.find(n => n.id === engine.activeRamal!.net);
  const netPfx = net ? net.lbl : 'R';
  const cnt = ++(engine._netCounts[engine.activeRamal!.net][engine.tipoTramo as keyof typeof engine._netCounts[string]]);
  const id = engine.tipoTramo === 'tributario'
    ? 'T' + Date.now()
    : netPfx + cnt;
  const firstAngle = _firstSegmentAngle(engine.activeRamal.pts);

  const pts = engine.activeRamal.pts;
  const x1 = pts[0][0], y1 = pts[0][1], x2 = pts[1][0], y2 = pts[1][1];
  const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
  const rad = firstAngle * Math.PI / 180;
  const upX = Math.sin(rad);
  const upY = -Math.cos(rad);
  const labelOffset = 48;
  const labelX = midX + upX * labelOffset;
  const labelY = midY + upY * labelOffset;

  const r: PlanoRamal = {
    id,
    net: engine.activeRamal!.net,
    tipo: engine.activeRamal!.tipo,
    padre: engine.activeRamal!.padre || null,
    pts: engine.activeRamal!.pts,
    totalL: calculateRamalLength(engine.activeRamal!.pts, engine),
    label: _nextLabel(engine),
    ini: '', fin: '', piso: engine.nivelActual?.n ?? '', dz: '', uc: 0,
    labelX: labelX, labelY: labelY,
    labelAngle: firstAngle,
    material: def.material || '',
    diametro: def.diametro || '',
    pendiente: typeof def.pendiente === 'number' ? def.pendiente : 0,
  };
  engine.ramales.push(r);
  // Associate ramal with bajante if endpoint is at bajante center
  if (r.pts.length >= 2) {
    const TOLLERANCE = 0.5;
    for (const epIdx of [0, r.pts.length - 1]) {
      const ep = r.pts[epIdx];
      const baj = engine.bajantes.find((b: any) =>
        Math.hypot(b.x - ep[0], b.y - ep[1]) < TOLLERANCE &&
        b.net === r.net &&
        !engine._hiddenNets.has(b.net)
      );
      if (baj && !baj.recibeDeIds.includes(r.id)) {
        baj.recibeDeIds.push(r.id);
      }
    }
  }
  engine.activeRamal = null;
  engine.selId = r.id;
  engine._emitSelect(r);
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}

export function cancelRamal(engine: IPlanoEngineCore): void {
  engine._yeeFlashKey = null;
  engine.activeRamal = null;
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}

export function cancelArea(engine: IPlanoEngineCore): void {
  engine.activeArea = null;
  engine._emitStatus(_statusMsg(engine));
  engine.render();
}

export function finishArea(engine: IPlanoEngineCore): void {
  if (!engine.activeArea || engine.activeArea.pts.length < 3) {
    engine.activeArea = null;
    return;
  }
  const pts = engine.activeArea.pts;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const areaCnt = engine.areas.length + 1;
  const area: PlanoArea = {
    id: 'AR' + Date.now(),
    pts: pts.map(p => [...p]),
    color: engine.activeArea.color || 'rgba(0,220,229,0.2)33',
    net: engine.activeNet,
    label: 'AREA' + areaCnt,
    labelX: cx,
    labelY: cy,
    labelAngle: 0,
    areaM2: _calcPolyArea(engine, pts),
  };
  engine.areas.push(area);
  engine.activeArea = null;
  engine.selId = area.id;
  engine._emitSelect(area);
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}

export function deleteSegmentAt(engine: IPlanoEngineCore, cx: number, cy: number): void {
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
      const d = pointToSegmentDist(plane.x, plane.y, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]);
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
  if (bestIdx > 0 && bestIdx < r.pts.length - 1) {
    engine._emitStatus('⚠ No se puede eliminar un segmento intermedio. Solo se pueden eliminar extremos.');
    return;
  }
  if (r.pts.length <= 2) {
    engine.ramales = engine.ramales.filter(x => x.id !== r.id && x.padre !== r.id);
    if (r.tipo !== 'tributario') engine._renumberRamales(r.net);
    engine.selId = null;
    engine._emitSelect(null);
  } else {
    r.pts.splice(bestIdx, 1);
    r.labelAngle = _firstSegmentAngle(r.pts);
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

export function setScaleM(engine: IPlanoEngineCore, v: string | number): void {
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

export function snapTributaryToPadre45Deg(cursorX: number, cursorY: number, lastX: number, lastY: number, pts: number[][], threshold: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let minD = Infinity;

  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) continue;
    const len = Math.sqrt(lenSq);
    const ux = dx / len, uy = dy / len;

    // Project 'last' onto the line
    const tLast = ((lastX - x1) * dx + (lastY - y1) * dy) / lenSq;
    const projX = x1 + tLast * dx;
    const projY = y1 + tLast * dy;
    
    // Perpendicular distance
    const perpDist = Math.hypot(lastX - projX, lastY - projY);

    // Two possible points at 45 degrees
    const q1x = projX + ux * perpDist;
    const q1y = projY + uy * perpDist;
    const q2x = projX - ux * perpDist;
    const q2y = projY - uy * perpDist;

    // Check which one is closer to cursor and on segment
    const checkPoint = (qx: number, qy: number) => {
      const t = ((qx - x1) * dx + (qy - y1) * dy) / lenSq;
      if (t >= 0 && t <= 1) {
        const d = Math.hypot(cursorX - qx, cursorY - qy);
        if (d < minD && d <= threshold) {
          minD = d;
          best = { x: qx, y: qy };
        }
      }
    };
    checkPoint(q1x, q1y);
    checkPoint(q2x, q2y);
    checkPoint(projX, projY); // 90 degree snap
  }
  return best;
}

export function getBacktrackPts(pts: number[][], targetIdx: number): number[][] {
  const backtrack: number[][] = [];
  for (let j = pts.length - 2; j >= targetIdx; j--) {
    backtrack.push([pts[j][0], pts[j][1]]);
  }
  return [...pts, ...backtrack];
}

export function handleLineDown(engine: IPlanoEngineCore, px: number, py: number): void {
  let pt: { x: number; y: number } = { x: px, y: py };
  if (engine.tipoTramo === 'tributario' && !engine.padreTributario) {
    engine._emitStatus('Selecciona primero un ramal PADRE en el panel derecho');
    return;
  }
  if (!engine.activeRamal) {
    // The user requested that we NEVER resume an existing ramal or start on a segment.
    // Every click should start a completely NEW ramal.
    // Snap only to existing vertices or free space.

    // Snap only to existing vertices or free space, as requested

    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) {
      pt = sp;
    } else {
      // If it didn't snap to a vertex, ensure it's not on a segment (must be free space)
      const activeNetsRamales = engine.ramales.filter((r: any) => r.net === engine.activeNet);
      let isOnSegment = false;
      const SNAP_THRESH = 12 / engine.zoom;
      
      for (const r of activeNetsRamales) {
        const segSnap = engine._snapToSegment(pt.x, pt.y, r.pts, SNAP_THRESH);
        if (segSnap) {
          isOnSegment = true;
          break;
        }
      }
      
      if (isOnSegment) {
        engine._emitStatus('No puedes iniciar un ramal sobre un segmento. Inicia en espacio libre o en un vértice.');
        return;
      }
    }
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
      engine.activeRamal.pts.push([first[0], first[1]]);
      engine.activeRamal.totalL = calculateRamalLength(engine.activeRamal.pts, engine);
      finishRamal(engine);
      return;
    }

    // Save raw cursor position BEFORE snap for bajante proximity check
    const rawPt = { x: pt.x, y: pt.y };

    let snappedToSeg = false;
    if (engine.snapMode) {
      pt = engine.snapAngle(last[0], last[1], pt.x, pt.y);
    }
    
    const activeRamales = engine.ramales.filter((r: any) => r.net === engine.activeNet);
    for (const r of activeRamales) {
      if (r.id === engine.activeRamal.id) continue;
      let sp = null;
      if (engine.snapMode) {
        sp = snapTributaryToPadre45Deg(pt.x, pt.y, last[0], last[1], r.pts, 20 / engine.zoom);
      } else {
        sp = engine._snapToSegment(pt.x, pt.y, r.pts, 20 / engine.zoom);
      }
      if (sp) {
        pt = sp;
        snappedToSeg = true;
        break;
      }
    }

    if (!snappedToSeg) {
      const sp = engine.snapToExisting(pt.x, pt.y);
      if (sp) pt = sp;
    }
    const lvlLabel = engine.nivelActual?.label ?? '';
    const bajThresh = 20 / engine.zoom;
    const nearBaj = engine.bajantes.find((b: any) => {
      if (engine._hiddenNets.has(b.net) || b.net !== engine.activeNet) return false;
      const disp = b.desplazamientos?.[lvlLabel] || {};
      const bx = b.x + (disp.dx || 0);
      const by = b.y + (disp.dy || 0);
      return Math.hypot(rawPt.x - bx, rawPt.y - by) < bajThresh;
    });
    if (nearBaj) {
      const disp = nearBaj.desplazamientos?.[lvlLabel] || {};
      const bx = nearBaj.x + (disp.dx || 0);
      const by = nearBaj.y + (disp.dy || 0);
      if (engine.snapMode) {
        const dx = pt.x - bx;
        const dy = pt.y - by;
        if (nearBaj.desplazamientos?.[lvlLabel]) {
          nearBaj.desplazamientos[lvlLabel].dx = (nearBaj.desplazamientos[lvlLabel].dx || 0) + dx;
          nearBaj.desplazamientos[lvlLabel].dy = (nearBaj.desplazamientos[lvlLabel].dy || 0) + dy;
        } else {
          nearBaj.x = pt.x;
          nearBaj.y = pt.y;
        }
        if (nearBaj.labelX != null) nearBaj.labelX += dx;
        if (nearBaj.labelY != null) nearBaj.labelY += dy;
        engine._markDirty();
      } else {
        pt = { x: bx, y: by };
      }
    }
    engine.activeRamal.pts.push([pt.x, pt.y]);
    engine.activeRamal.totalL = calculateRamalLength(engine.activeRamal.pts, engine);
  }
  engine._emitStatus(_statusMsg(engine));
  engine.render();
}

export function handleDimDown(engine: IPlanoEngineCore, px: number, py: number): void {
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

export function handleTextDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine._onRequestTextCb) {
    engine._onRequestTextCb(px, py, (t: string) => {
      if (t) {
        const tid = 'T' + Date.now();
        engine.textAnnots.push({
          id: tid, x: px, y: py, text: t,
          fontMm: 2.5, boxW: 0, lblOffX: 0, lblOffY: 0, textAngle: 0,
        });
        engine.selId = tid;
        engine._emitSelect(engine.textAnnots[engine.textAnnots.length - 1]);
        engine.render();
        engine._markDirty();
      }
    });
  } else {
    const t = prompt('Texto:');
    if (t) {
      const tid2 = 'T' + Date.now();
      engine.textAnnots.push({
        id: tid2, x: px, y: py, text: t,
        fontMm: 2.5, boxW: 0, lblOffX: 0, lblOffY: 0, textAngle: 0,
      });
      engine.selId = tid2;
      engine._emitSelect(engine.textAnnots[engine.textAnnots.length - 1]);
      engine.render();
      engine._markDirty();
    }
  }
}

export function handleBajanteDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) { px = sp.x; py = sp.y; }
  }
  // Snap to nearest ramal endpoint if close enough
  const ASSOC_THRESH = 20 / engine.zoom;
  const assocRamales: string[] = [];
  for (const r of engine.ramales) {
    if (r.net !== engine.activeNet || !r.pts?.length) continue;
    const startDist = Math.hypot(px - r.pts[0][0], py - r.pts[0][1]);
    const li = r.pts.length - 1;
    const endDist = Math.hypot(px - r.pts[li][0], py - r.pts[li][1]);
    if (startDist < ASSOC_THRESH && startDist <= endDist) {
      px = r.pts[0][0]; py = r.pts[0][1];
      assocRamales.push(r.id);
    } else if (endDist < ASSOC_THRESH) {
      px = r.pts[li][0]; py = r.pts[li][1];
      assocRamales.push(r.id);
    }
  }
  const net = NETS.find(n => n.id === engine.activeNet);
  const netPfx = net ? net.bmPfx : 'BAJ';
  const cnt = engine.bajantes.filter(b => b.tipo === 'bajante' && b.net === engine.activeNet).length + 1;
  const bajId = netPfx + cnt;
  engine.bajantes.push({
    id: bajId,
    net: engine.activeNet,
    tipo: 'bajante',
    code: bajId,
    x: px, y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: assocRamales, alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px, labelY: py + 20,
    bajR: 7/24,
  });
  engine.selId = bajId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

export function handleMontanteDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) { px = sp.x; py = sp.y; }
  }
  const netDef = NETS.find(n => n.id === engine.activeNet);
  const pfx = netDef?.bmPfx || 'MON';
  const cnt = engine.bajantes.filter(b => b.tipo === 'montante' && b.net === engine.activeNet).length + 1;
  const monId = `${pfx}${cnt}_${engine.activeNet}`;
  const code = `${pfx}${cnt}`;
  engine.bajantes.push({
    id: monId,
    net: engine.activeNet,
    tipo: 'montante',
    code: code,
    x: px, y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: [], alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px, labelY: py + 20,
    bajR: 7/24,
  });
  engine._renumberMontantes();
  const newlyCreated = engine.bajantes.find(b => b.tipo === 'montante' && b.x === px && b.y === py);
  if (newlyCreated) {
    engine.selId = newlyCreated.id;
    engine._emitSelect(newlyCreated);
  }
  engine._isGhostSel = false;
  engine.render();
  engine._markDirty();
}

export function handleCalentadorDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) { px = sp.x; py = sp.y; }
  }
  const calent = engine.bajantes.filter(b => b.tipo === 'calentador').length + 1;
  const calentId = 'CALENT' + calent;
  engine.bajantes.push({
    id: calentId,
    net: engine.activeNet,
    tipo: 'calentador',
    code: 'CALENT' + calent,
    x: px, y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: [], alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px - 25, labelY: py,
    bajR: 7/24,
  });
  engine.selId = calentId;
  engine.render();
  engine._markDirty();
}

export function handleRedPublicaDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) { px = sp.x; py = sp.y; }
  }
  const cnt = engine.bajantes.filter(b => b.tipo === 'red_publica').length + 1;
  const rpId = 'RP' + cnt;
  engine.bajantes.push({
    id: rpId,
    net: engine.activeNet,
    tipo: 'red_publica',
    code: 'RP' + cnt,
    x: px, y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: [], alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px, labelY: py + 20,
    bajR: 7/24,
  });
  engine.selId = rpId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

export function handleContadorDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) { px = sp.x; py = sp.y; }
  }
  const cnt = engine.bajantes.filter(b => b.tipo === 'contador').length + 1;
  const cntId = 'CNT' + cnt;
  engine.bajantes.push({
    id: cntId,
    net: engine.activeNet,
    tipo: 'contador',
    code: 'CNT' + cnt,
    x: px, y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0, dNominal: '0',
    recibeDeIds: [], alimentaIds: [], descargaEnId: null,
    ucAcum: 0, ucExtra: 0, area_m2: 0,
    desplazamientos: {},
    lblOffX: 0, lblOffY: 0,
    labelAngle: 0,
    labelX: px - 25, labelY: py,
    bajR: 7/24,
  });
  engine.selId = cntId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);

  // Auto-create ramal from nearest Red Pública to this Contador
  const rps = engine.bajantes.filter(b => b.tipo === 'red_publica' && b.net === engine.activeNet);
  if (rps.length > 0) {
    let nearestRP = rps[0];
    let minDist = Infinity;
    for (const rp of rps) {
      const d = Math.hypot(rp.x - px, rp.y - py);
      if (d < minDist) { minDist = d; nearestRP = rp; }
    }
    const rpId = nearestRP.code || nearestRP.id;
    const alreadyConnected = engine.ramales.some((r: any) =>
      r.net === engine.activeNet && ((r.ini === rpId && r.fin === cntId) || (r.ini === cntId && r.fin === rpId))
    );
    if (!alreadyConnected) {
      const net = NETS.find(n => n.id === engine.activeNet);
      const pfx = net ? net.lbl : 'R';
      if (!engine._netCounts[engine.activeNet]) engine._netCounts[engine.activeNet] = { ramal: 0, tributario: 0 };
      const ramCnt = ++(engine._netCounts[engine.activeNet].ramal);
      const ramId = pfx + ramCnt;
      engine.ramales.push({
        id: ramId,
        net: engine.activeNet,
        _net: engine.activeNet,
        tipo: 'ramal',
        padre: null,
        pts: [[nearestRP.x, nearestRP.y], [px, py]],
        totalL: +(engine.pxToM(Math.hypot(px - nearestRP.x, py - nearestRP.y))).toFixed(3),
        label: pfx + ramCnt,
        ini: rpId,
        fin: cntId,
        piso: engine.nivelActual?.n ?? '',
        dz: '',
        uc: 0,
        labelX: (nearestRP.x + px) / 2,
        labelY: (nearestRP.y + py) / 2,
        labelAngle: 0,
        material: '',
        diametro: '',
        pendiente: 1.5,
      });
    }
  }

  engine.render();
  engine._markDirty();
}

export function handleEraseDown(engine: IPlanoEngineCore, cx: number, cy: number): void {
  engine.selectAt(cx, cy);
  const selId = engine.selId;
  const sel = engine.getSelected();
  
  if (!sel || !selId) {
    engine._emitStatus('No se encontró nada para borrar bajo el cursor');
    return;
  }
  
  const isText = engine.textAnnots.some((t: any) => t.id === selId);
  const isArea = engine.areas.some((a: any) => a.id === selId);
  const tipo = (sel as any).tipo;
  
  if (tipo === 'bajante' || tipo === 'montante' || tipo === 'red_publica' || tipo === 'contador' || isArea || isText || selId.startsWith('DIM')) {
    engine.deleteSelected();
    engine._emitSelect(null);
    engine.selId = null;
    engine._emitStatus('Elemento eliminado');
    engine.render();
    engine._markDirty();
    return;
  }
  
  if (tipo === 'ramal' || tipo === 'tributario') {
    const plane = engine.toPlane(cx, cy);
    const HIT_DIST = 10 / engine.zoom;
    const r = sel as any;
    
    let bestIdx = -1, bestD = Infinity;
    for (let i = 0; i < r.pts.length; i++) {
      const d = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    if (bestD > HIT_DIST) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const d = pointToSegmentDist(plane.x, plane.y, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]);
        if (d < bestD) {
          bestD = d;
          const dA = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
          const dB = Math.hypot(plane.x - r.pts[i + 1][0], plane.y - r.pts[i + 1][1]);
          bestIdx = dA <= dB ? i : i + 1;
        }
      }
    }
    
    // Si tiene más de 2 puntos y se hizo clic en un segmento extremo, recorta el extremo
    if (r.pts.length > 2 && (bestIdx === 0 || bestIdx === r.pts.length - 1)) {
      r.pts.splice(bestIdx, 1);
      r.totalL = calculateRamalLength(r.pts, engine);
      r.labelAngle = _firstSegmentAngle(r.pts);
      const [mx, my] = _midpoint(r.pts);
      r.labelX = mx;
      r.labelY = my;
      engine._emitSelect(null);
      engine.selId = null;
      engine._emitStatus('Segmento extremo recortado');
    } else {
      // Si es un segmento intermedio o el ramal solo tiene 1 segmento (2 puntos), borra completo
      engine.deleteSelected();
      engine._emitSelect(null);
      engine.selId = null;
      engine._emitStatus('Ramal eliminado');
    }
    engine.render();
    engine._markDirty();
    return;
  }
}

export function handleAreaDown(engine: IPlanoEngineCore, px: number, py: number): void {
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

export function handleDrawingMouseMove(engine: IPlanoEngineCore, x: number, y: number): void {
  if (engine.activeRamal || engine._dimStart || engine.activeArea) {
    engine.mouseX = x;
    engine.mouseY = y;
    (engine as any).scheduleRender();
  }
}

export function handleDoubleClick(engine: IPlanoEngineCore): void {
  if (engine.tool === 'line' && engine.activeRamal && engine.activeRamal.pts.length >= 2) {
    finishRamal(engine);
  }
  if (engine.tool === 'area' && engine.activeArea && engine.activeArea.pts.length >= 3) {
    finishArea(engine);
  }
}
