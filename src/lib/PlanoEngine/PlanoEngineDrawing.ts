import { NETS } from './PlanoState';
import type {
  PlanoRamal,
  PlanoArea,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { pointToSegmentDist } from './HitTester';
import { _firstSegmentAngle, checkRamalAngles, segmentsIntersect, snapTributaryToPadre45Deg } from './drawingAngles';

export { checkRamalAngles, _firstSegmentAngle, _strokeAngle, segmentsIntersect, snapTributaryToPadre45Deg } from './drawingAngles';
export { handleBajanteDown, handleMontanteDown, handleCalentadorDown, handleRedPublicaDown, handleContadorDown } from './drawingCreations';

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
  const labelOffset = 0;
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
    ini: '', fin: '', piso: engine.nivelActual?.n ?? '', dz: '', uc: 0, nSalidas: 1,
    labelX: labelX, labelY: labelY,
    labelAngle: firstAngle,
    material: def.material || '',
    diametro: def.diametro || '',
    pendiente: typeof def.pendiente === 'number' ? def.pendiente : 0,
    bloqueado: true,
  };
  engine.ramales.push(r);
  if (!checkRamalAngles(r.pts, r.net)) {
    engine.triggerAlert(
      'Ángulo no recomendado',
      (r.net === 'san' || r.net === 'll')
        ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 0° y 45°.'
        : 'Esta red debe diseñarse con ángulos de 45° o 90°.'
    );
    engine.ramales.pop();
    engine.activeRamal = null;
    engine._markDirty();
    engine.render();
    return;
  }
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

function checkCrossRamalAngle(engine: IPlanoEngineCore, pA: number[], pB: number[], skipId: string): boolean {
  for (const r of engine.ramales) {
    if (r.id === skipId || !r.pts || r.pts.length < 2) continue;
    const isSanOrLl = (r.net || engine.activeNet) === 'san' || (r.net || engine.activeNet) === 'll';
    for (let si = 0; si < r.pts.length - 1; si++) {
      const [ax, ay] = r.pts[si], [bx, by] = r.pts[si + 1];
      const segLen = Math.hypot(bx - ax, by - ay);
      if (segLen < 0.1) continue;
      const t = ((pB[0] - ax) * (bx - ax) + (pB[1] - ay) * (by - ay)) / (segLen * segLen);
      if (t >= 0 && t <= 1) {
        const projDist = Math.abs((bx - ax) * (ay - pB[1]) - (by - ay) * (ax - pB[0])) / segLen;
        if (projDist < 0.5) {
          const a1 = Math.atan2(pB[1] - pA[1], pB[0] - pA[0]) * 180 / Math.PI;
          const a2 = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
          let diff = Math.abs(a2 - a1) % 360;
          if (diff > 180) diff = 360 - diff;
          const internalAngle = 180 - diff;
          let isAllowed = false;
          if (isSanOrLl) {
            isAllowed = (diff <= 46) || (diff >= 134) || (Math.abs(diff - 45) <= 10) || (Math.abs(diff - 135) <= 10);
          } else {
            isAllowed = (internalAngle >= 50);
          }
          if (!isAllowed) {
            engine.triggerAlert(
              'Ángulo no recomendado',
              isSanOrLl ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°.' : 'Esta red debe diseñarse con ángulos de 45° o 90°.'
            );
            return false;
          }
        }
      }
    }
  }
  return true;
}

export function handleLineDown(engine: IPlanoEngineCore, px: number, py: number): void {
  let pt: { x: number; y: number } = { x: px, y: py };
  if (engine.tipoTramo === 'tributario' && !engine.padreTributario) {
    engine._emitStatus('Selecciona primero un ramal PADRE en el panel derecho');
    return;
  }
  if (!engine.activeRamal) {
    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) {
      pt = sp;
      let activeNetsRamales = engine.ramales.filter((rm: any) => rm.net === engine.activeNet);
      if (engine.tipoTramo === 'tributario') {
        activeNetsRamales = activeNetsRamales.filter((rm: any) => rm.id === engine.padreTributario);
      }
      let continueRamal: any = null;
      let reversePoints = false;
      const SNAP_THRESH = 0.25;
      for (const rm of activeNetsRamales) {
        const firstPt = rm.pts[0];
        const lastPt = rm.pts[rm.pts.length - 1];
        const dFirst = Math.hypot(pt.x - firstPt[0], pt.y - firstPt[1]);
        const dLast = Math.hypot(pt.x - lastPt[0], pt.y - lastPt[1]);
        if (dFirst < SNAP_THRESH) {
          continueRamal = rm;
          reversePoints = true;
          break;
        } else if (dLast < SNAP_THRESH) {
          continueRamal = rm;
          break;
        }
      }

      if (continueRamal) {
        if (reversePoints) {
          continueRamal.pts.reverse();
        }
        engine.activeRamal = {
          id: continueRamal.id,
          net: continueRamal.net,
          tipo: continueRamal.tipo,
          padre: continueRamal.padre,
          pts: [...continueRamal.pts],
          totalL: continueRamal.totalL,
        };
        engine._emitStatus(`Continuando ramal: ${continueRamal.id}`);
        engine.render();
        return;
      }
    } else {
      let activeNetsRamales = engine.ramales.filter((r: any) => r.net === engine.activeNet);
      if (engine.tipoTramo === 'tributario') {
        activeNetsRamales = activeNetsRamales.filter((r: any) => r.id !== engine.padreTributario);
      }
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
    const SNAP_CLOSE = 6 / engine.zoom;

    const distLast = Math.hypot(pt.x - last[0], pt.y - last[1]);
    if (distLast < SNAP_CLOSE) {
      finishRamal(engine);
      return;
    }

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
    
    const activeRamales = engine.tipoTramo === 'tributario'
      ? engine.ramales.filter((r: any) => r.id === engine.padreTributario)
      : engine.ramales.filter((r: any) => r.net === engine.activeNet);
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
    if (engine.activeRamal.pts.length >= 2) {
      const testPts = [...engine.activeRamal.pts, [pt.x, pt.y]];
      if (!checkRamalAngles(testPts, engine.activeNet)) {
        engine.triggerAlert(
          'Ángulo no recomendado',
          (engine.activeNet === 'san' || engine.activeNet === 'll')
            ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°.'
            : 'Esta red debe diseñarse con ángulos de 45° o 90°.'
        );
        return;
      }
    }

    // Check segment intersection with existing ramales of the same network
    {
      const ppts = engine.activeRamal.pts;
      const lastIdx = ppts.length - 1;
      if (lastIdx >= 0) {
        const segStart = ppts[lastIdx];
        const segEnd = [pt.x, pt.y] as number[];
        for (const r of engine.ramales) {
          if (r.net !== engine.activeNet) continue;
          if (r.id === engine.activeRamal.id) continue;
          if (!r.pts || r.pts.length < 2) continue;
          for (let si = 0; si < r.pts.length - 1; si++) {
            if (segmentsIntersect(segStart, segEnd, r.pts[si], r.pts[si + 1])) {
              engine.triggerAlert(
                'Cruce de líneas no permitido',
                'El trazo cruza otro trazo de la misma red. No se permite el cruce de líneas en la misma cota de dibujo.'
              );
              return;
            }
          }
        }
      }
    }
    engine.activeRamal.pts.push([pt.x, pt.y]);
    engine.activeRamal.totalL = calculateRamalLength(engine.activeRamal.pts, engine);

    // Cross-ramal tee check: validate angle between active ramal and any existing ramal
    {
      const ppts = engine.activeRamal.pts;
      const lastIdx = ppts.length - 1;
      if (lastIdx >= 1 && !checkCrossRamalAngle(engine, ppts[lastIdx - 1], ppts[lastIdx], engine.activeRamal.id || '')) {
        engine.activeRamal.pts.pop();
        engine.activeRamal.totalL = calculateRamalLength(engine.activeRamal.pts, engine);
        engine._markDirty();
        engine.render();
        return;
      }
      // First segment: connection point is pts[0], so pass pts[1] as pA, pts[0] as pB
      if (lastIdx >= 2 && !checkCrossRamalAngle(engine, ppts[1], ppts[0], engine.activeRamal.id || '')) {
        engine.activeRamal.pts.pop();
        engine.activeRamal.totalL = calculateRamalLength(engine.activeRamal.pts, engine);
        engine._markDirty();
        engine.render();
        return;
      }
    }
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
  
  if (tipo === 'bajante' || tipo === 'montante' || tipo === 'red_publica' || tipo === 'contador' || tipo === 'calentador' || isArea || isText || selId.startsWith('DIM')) {
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
    engine.scheduleRender();
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
