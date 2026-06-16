import { NETS } from './PlanoState';
import type {
  PlanoRamal,
  PlanoArea,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoEngineTypes';
import { pointToSegmentDist, snapToSegment } from './HitTester';

type ToolType = 'sel' | 'line' | 'dim' | 'text' | 'baj' | 'mon' | 'pan' | 'area' | 'erase' | 'segdel' | 'delm';

export function toolCursor(tool: string): string {
  return tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair';
}

export function _statusMsg(engine: IPlanoEngineCore): string {
  const names: Record<string, string> = {
    sel: 'Seleccionar elemento', line: 'Ramal', dim: 'Cota', text: 'Texto',
    baj: 'Bajante', mon: 'Montante', pan: 'Pan', area: 'Área', erase: 'Borrar',
    delm: 'Eliminar elemento',
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
  const [mx, my] = _midpoint(engine.activeRamal.pts);
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
  engine.activeRamal = null;
  engine.selId = r.id;
  engine._emitSelect(r);
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}

export function cancelRamal(engine: IPlanoEngineCore): void {
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

function tribSnapAngle(x0: number, y0: number, x1: number, y1: number, net: string): { x: number; y: number } {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return { x: x1, y: y1 };
  const deg = Math.atan2(dy, dx) * 180 / Math.PI;
  let allowed: number[];
  if (net === 'san' || net === 'll') {
    allowed = [45, 135, -135, -45];
  } else if (net === 'af' || net === 'ac') {
    allowed = [45, 90, 135, -135, -90, -45];
  } else {
    allowed = [0, 45, 90, 135, 180, -135, -90, -45];
  }
  let best = 0, minDiff = 999;
  allowed.forEach(a => {
    const diff = Math.abs(((deg - a) + 540) % 360 - 180);
    if (diff < minDiff) { minDiff = diff; best = a; }
  });
  const sr = best * Math.PI / 180;
  return { x: x0 + dist * Math.cos(sr), y: y0 + dist * Math.sin(sr) };
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
    let foundVertex: { r: any; idx: number } | null = null;
    let bestDist = Infinity;
    const activeNetsRamales = engine.ramales.filter((r: any) => r.net === engine.activeNet && r.pts.length >= 2);

    for (const r of activeNetsRamales) {
      for (let i = 0; i < r.pts.length; i++) {
        let thresh = 12;
        if (i > 0 && i < r.pts.length - 1) {
          const ptA = r.pts[i - 1];
          const ptB = r.pts[i];
          const ptC = r.pts[i + 1];
          const ax = ptB[0] - ptA[0], ay = ptB[1] - ptA[1];
          const bx = ptC[0] - ptB[0], by = ptC[1] - ptB[1];
          const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
          if (lenA > 0 && lenB > 0) {
            const cosAngle = (-ax * bx - ay * by) / (lenA * lenB);
            if (Math.abs(cosAngle) < 0.05) {
              thresh = 18; // Increase snap tolerance for elbow corners
            }
          }
        }

        const ptCvs = engine.toCvs(r.pts[i][0], r.pts[i][1]);
        const clickCvs = engine.toCvs(px, py);
        const dist = Math.hypot(clickCvs.x - ptCvs.x, clickCvs.y - ptCvs.y);
        if (dist < thresh && dist < bestDist) {
          bestDist = dist;
          foundVertex = { r, idx: i };
        }
      }
    }

    if (foundVertex) {
      const { r, idx } = foundVertex;
      const finalPts = getBacktrackPts(r.pts, idx);

      engine.activeRamal = {
        id: r.id,
        net: r.net,
        tipo: r.tipo,
        padre: r.padre,
        pts: finalPts,
        totalL: r.totalL,
      };
      engine._emitStatus('Dibujando derivación sobre ramal existente...');
      engine.render();
      return;
    }

    // If no vertex clicked, check segment bodies
    let foundSegment: { r: any; segIdx: number; proj: [number, number] } | null = null;
    let minSegDist = 12; // 12px threshold in canvas pixels

    for (const r of activeNetsRamales) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const A = r.pts[i];
        const B = r.pts[i + 1];
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 0.001) continue;

        let t = ((px - A[0]) * dx + (py - A[1]) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = A[0] + t * dx;
        const projY = A[1] + t * dy;

        const projCvs = engine.toCvs(projX, projY);
        const clickCvs = engine.toCvs(px, py);
        const dist = Math.hypot(clickCvs.x - projCvs.x, clickCvs.y - projCvs.y);

        if (dist < minSegDist) {
          minSegDist = dist;
          foundSegment = { r, segIdx: i, proj: [projX, projY] };
        }
      }
    }

    if (foundSegment) {
      const { r, segIdx, proj } = foundSegment;
      const Q = [
        ...r.pts.slice(0, segIdx + 1),
        proj,
        ...r.pts.slice(segIdx + 1)
      ];
      const finalPts = getBacktrackPts(Q, segIdx + 1);

      engine.activeRamal = {
        id: r.id,
        net: r.net,
        tipo: r.tipo,
        padre: r.padre,
        pts: finalPts,
        totalL: r.totalL,
      };
      engine._emitStatus('Dibujando derivación sobre ramal existente...');
      engine.render();
      return;
    }

    if (engine.tipoTramo === 'tributario' && engine.padreTributario) {
      const padre = engine.ramales.find((r: any) => r.id === engine.padreTributario);
      if (padre) {
        const spSegment = snapToSegment(pt.x, pt.y, padre.pts, 20 / engine.zoom);
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
      engine.activeRamal.pts.push([first[0], first[1]]);
      engine.activeRamal.totalL = calculateRamalLength(engine.activeRamal.pts, engine);
      finishRamal(engine);
      return;
    }
    if (engine.snapMode) {
      if (engine.tipoTramo === 'tributario') {
        pt = tribSnapAngle(last[0], last[1], pt.x, pt.y, engine.activeNet);
      } else {
        pt = engine.snapAngle(last[0], last[1], pt.x, pt.y);
      }
    }
    if (engine.tipoTramo === 'tributario' && engine.padreTributario) {
      const padre = engine.ramales.find((r: any) => r.id === engine.padreTributario);
      if (padre) {
        const sp = snapToSegment(pt.x, pt.y, padre.pts, 20 / engine.zoom);
        if (sp) pt = sp;
      }
    }
    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) pt = sp;
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
  engine.selId = bajId;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

export function handleMontanteDown(engine: IPlanoEngineCore, px: number, py: number): void {
  const cnt = engine.bajantes.filter(b => b.tipo === 'montante').length + 1;
  const monId = 'MON' + cnt;
  engine.bajantes.push({
    id: monId,
    net: engine.activeNet,
    tipo: 'montante',
    code: 'MON' + cnt,
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
  engine.selId = monId;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

export function handleEraseDown(engine: IPlanoEngineCore, cx: number, cy: number): void {
  engine.selectAt(cx, cy);
  engine.deleteSelected();
  engine._emitSelect(null);
  engine.selId = null;
}

export function handleDeleteElementDown(engine: IPlanoEngineCore, cx: number, cy: number): void {
  engine.selectAt(cx, cy);
  const sel = engine.getSelected() as { id: string; pts?: number[][] } | null;
  if (!sel) { engine._emitStatus('No se encontró ningún elemento'); return; }
  const id = sel.id || '';
  const tipo = (sel as any).tipo;
  const isText = engine.textAnnots.some((t: any) => t.id === id);
  if (tipo === 'bajante' || tipo === 'montante' || tipo === 'area' || id.startsWith('AR') || id.startsWith('BAJ') || id.startsWith('MON') || isText || id.startsWith('DIM')) {
    engine.deleteSelected();
    engine._emitSelect(null);
    engine.selId = null;
    engine._emitStatus('Elemento eliminado');
  } else {
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitStatus('Elemento no eliminable');
  }
}

export function handleSegDelDown(engine: IPlanoEngineCore, cx: number, cy: number): void {
  deleteSegmentAt(engine, cx, cy);
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
    engine.render();
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
