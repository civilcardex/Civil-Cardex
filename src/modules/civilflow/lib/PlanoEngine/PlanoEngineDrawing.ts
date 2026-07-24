import { NETS, netsSnapLinked } from './PlanoState';
import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { pointToSegmentDist } from './HitTester';
import { _firstSegmentAngle, checkRamalAngles, segmentsIntersect, snapTributaryToPadre45Deg, detectAccesorioTrigger } from './drawingAngles';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';

export { checkRamalAngles, _firstSegmentAngle, segmentsIntersect, snapTributaryToPadre45Deg } from './drawingAngles';
export { handleBajanteDown, handleMontanteDown, handleCreateMontanteMidBody, handleCreateTeeCapStub, handleCalentadorDown, handleRedPublicaDown, handleContadorDown } from './drawingCreations';

type ToolType = 'sel' | 'line' | 'dim' | 'text' | 'baj' | 'mon' | 'pan' | 'area' | 'erase' | 'segdel' | 'delm' | 'red_pub' | 'cont' | 'calent';

function toolCursor(tool: string): string {
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
    const padre = engine.ramales.find((r) => r.id === engine.padreTributario);
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

function maxDiametroLabel(a: string, b: string): string {
  const va = diamPulgFromLabel(a);
  const vb = diamPulgFromLabel(b);
  if (!va) return b || a;
  if (!vb) return a || b;
  return vb > va ? b : a;
}

// When a newly finished (or dragged) ramal's endpoint lands mid-body on an EXISTING ramal — a
// true T/Y tee, not an end-to-end join — split that existing ramal at the junction into an
// upstream portion (kept, unchanged) and a brand-new downstream ramal carrying the combined load:
// diámetro = the larger of the two converging ramales, uc = their sum. Applies uniformly across
// every net (san/ll accumulate UC, af/ac/gas accumulate their own load figure — all stored in the
// same generic `uc` field), matching how a real hydraulic design increases pipe size/rating past
// a confluence point rather than assuming the upstream run's own rating still applies beyond it.
// Only the mid-body case is handled — an endpoint-to-endpoint join has no "rest of the path"
// beyond the junction to split off, so there's nothing to auto-create there.
export function autoSplitJunctionAndSumFlow(engine: IPlanoEngineCore, incoming: PlanoRamal): void {
  if (!incoming.pts || incoming.pts.length < 2) return;
  const TOL = 0.5;
  const endpoints = [incoming.pts[0], incoming.pts[incoming.pts.length - 1]];
  for (const ep of endpoints) {
    for (const existing of engine.ramales) {
      if (existing.id === incoming.id || existing.net !== incoming.net) continue;
      if (!existing.pts || existing.pts.length < 2) continue;
      if (existing.pts.some(([x, y]) => Math.hypot(x - ep[0], y - ep[1]) < TOL)) {
        // Endpoint-to-endpoint (or endpoint-onto-a-vertex) join — not a mid-body tee, so nothing
        // to split, but a tributario landing here still must be its own padre and nowhere else.
        // Without this, ARRIVING at a wrong ramal's vertex (as opposed to starting there, or
        // hitting its body mid-run) went completely unchecked — draw-time snap validation only
        // fires while a point is being freshly placed, and can miss this if angle-snap shifted the
        // click slightly off the exact vertex before that check ran; this is the final say,
        // checked directly against the finished ramal's actual endpoint position.
        if (incoming.tipo === 'tributario' && existing.id !== incoming.padre) {
          engine.triggerAlert('Ramal padre incorrecto', 'Solo puedes conectar el tributario al ramal padre seleccionado.');
        }
        continue;
      }
      let segIdx = -1;
      for (let i = 0; i < existing.pts.length - 1; i++) {
        const [ax, ay] = existing.pts[i], [bx, by] = existing.pts[i + 1];
        const dx = bx - ax, dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 0.0001) continue;
        const t = ((ep[0] - ax) * dx + (ep[1] - ay) * dy) / lenSq;
        if (t < 0.02 || t > 0.98) continue;
        const projX = ax + t * dx, projY = ay + t * dy;
        if (Math.hypot(ep[0] - projX, ep[1] - projY) < TOL) { segIdx = i; break; }
      }
      if (segIdx === -1) continue;
      // A tributario reaching a T/Y junction mid-body on some ramal OTHER than its own selected
      // padre is the exact same "wrong ramal" case handleLineDown already blocks with a modal when
      // it happens at a vertex — this is the same violation landing on a ramal's BODY instead, and
      // this function runs unconditionally for every net/tipo, so without this it silently split
      // and merged flow into whatever ramal the tributario happened to touch, no alert at all.
      if (incoming.tipo === 'tributario' && existing.id !== incoming.padre) {
        engine.triggerAlert('Ramal padre incorrecto', 'Solo puedes conectar el tributario al ramal padre seleccionado.');
        continue;
      }

      const downstreamPts = [[ep[0], ep[1]], ...existing.pts.slice(segIdx + 1)];
      existing.pts = [...existing.pts.slice(0, segIdx + 1), [ep[0], ep[1]]];
      existing.totalL = calculateRamalLength(existing.pts, engine);
      // The truncated `existing` always ends EXACTLY at the junction (its new last point) — that's
      // its own endpoint now, never an interior vertex, so this belongs in accesorioFin, not
      // accMed. accMed here was silently invisible: the render pass explicitly skips any accMed
      // index that equals a ramal's own last index (accMed is for INTERIOR vertices only), so the
      // tee glyph never actually drew, and delete-cleanup's endpoint-position matching never
      // resolved it as an endpoint marker either — accessory tallies (which don't apply that
      // bounds check) still silently counted it forever, even after the junction was long deleted.
      // Gas uses its own tee catalog id (te_linea/te_ramal), not teeDirecto — writing teeDirecto
      // there wasn't a valid gas accessory at all, so gas's own accessory tally never counted it
      // and delete-cleanup never recognized it either.
      existing.accesorioFin = existing.net === 'gas' ? 'te_linea' : 'teeDirecto';
      existing.diametroFin = existing.diametro || '';

      const netDef = NETS.find((n) => n.id === existing.net);
      const pfx = netDef ? netDef.lbl : 'R';
      const cnt = ++(engine._netCounts[existing.net][existing.tipo as keyof typeof engine._netCounts[string]]);
      const newId = existing.tipo === 'tributario' ? 'T' + Date.now() : pfx + cnt;
      // Own label position/angle from the downstream segment's own midpoint — spreading
      // `...existing` alone kept the label at the UPSTREAM portion's old position, landing right
      // on top of `existing`'s own (unchanged) label since both objects then shared one spot.
      const [downLabelX, downLabelY] = _midpoint(downstreamPts);
      const downLabelAngle = _firstSegmentAngle(downstreamPts);
      const downstream: PlanoRamal = {
        ...existing,
        id: newId,
        pts: downstreamPts,
        totalL: calculateRamalLength(downstreamPts, engine),
        label: existing.tipo === 'tributario' ? `T${cnt}${existing.label || ''}` : `${pfx}${cnt}`,
        labelX: downLabelX,
        labelY: downLabelY,
        labelAngle: downLabelAngle,
        diametro: maxDiametroLabel(existing.diametro, incoming.diametro),
        uc: (existing.uc || 0) + (incoming.uc || 0),
        ini: '', fin: '',
        accesorioInicio: '', accesorioFin: '', accMed: {},
        diametroInicio: '', diametroFin: '',
        aparatoInicio: '', aparatoFin: '',
        bloqueado: true,
        mergesFrom: [existing.id, incoming.id],
      };
      engine.ramales.push(downstream);
      break;
    }
  }
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
      autoSplitJunctionAndSumFlow(engine, existing);
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
    ini: '', fin: '', piso: String(engine.nivelActual?.n ?? ''), dz: '', uc: 0, nSalidas: 1,
    labelX: labelX, labelY: labelY,
    labelAngle: firstAngle,
    material: def.material || '',
    diametro: def.diametro || '',
    pendiente: typeof def.pendiente === 'number' ? def.pendiente : 0,
    bloqueado: true,
  };
  engine.ramales.push(r);
  if (!checkRamalAngles(r.pts, r.net, r.tipo)) {
    engine.triggerAlert(
      'Ángulo no recomendado',
      (r.net === 'san' || r.net === 'll')
        ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 0° y 45°.'
        : ((r.net === 'af' || r.net === 'ac') && r.tipo === 'tributario')
        ? 'Los tributarios de AF/AC solo permiten ángulos de 90°.'
        : 'Esta red debe diseñarse con ángulos de 45° o 90°.'
    );
    engine.ramales.pop();
    engine.activeRamal = null;
    engine._markDirty();
    engine.render();
    return;
  }
  autoSplitJunctionAndSumFlow(engine, r);
  // Associate ramal with bajante if endpoint is at bajante center. A ramal may only ARRIVE at a
  // bajante (real or fantasma) — never START there — per explicit request; handleLineDown already
  // blocks the click itself from starting a fresh ramal there, this is the belt-and-suspenders
  // match on the FINISHED ramal's endpoints (also covers drag-created connections). A displaced
  // fantasma is matched against its own displaced position for the current floor; an undisplaced
  // ghost or a real bajante both match at their plain (b.x,b.y).
  if (r.pts.length >= 2) {
    const TOLLERANCE = 0.5;
    const lastIdx = r.pts.length - 1;
    const lvl = engine.nivelActual?.label ?? '';
    const displacedFantasmaIds = new Set(
      engine.getBajantesFantasma()
        .filter((b) => {
          const disp = b.desplazamientos?.[lvl];
          return !!disp && (Math.abs(disp.dx) > 0.5 || Math.abs(disp.dy) > 0.5);
        })
        .map((b) => b.id)
    );
    for (const epIdx of [0, lastIdx]) {
      const isArrival = epIdx === lastIdx;
      if (!isArrival) continue;
      const ep = r.pts[epIdx];
      const baj = engine.bajantes.find((b) => {
        if (b.net !== r.net || engine._hiddenNets.has(b.net)) return false;
        if (displacedFantasmaIds.has(b.id)) {
          const disp = b.desplazamientos?.[lvl];
          const bx = b.x + (disp?.dx || 0);
          const by = b.y + (disp?.dy || 0);
          return Math.hypot(bx - ep[0], by - ep[1]) < TOLLERANCE;
        }
        return Math.hypot(b.x - ep[0], b.y - ep[1]) < TOLLERANCE;
      });
      if (baj && !baj.recibeDeIds.includes(r.id)) {
        baj.recibeDeIds.push(r.id);
        // Auto-fill ramal's ini/fin
        const bajCode = baj.code || baj.id;
        if (epIdx === 0) {
          r.ini = bajCode;
        } else {
          r.fin = bajCode;
        }
      }
    }
  }
  // AF/AC/gas: detect codos/tees at angle changes, perpendicular crossings, and junctions formed
  // with another separately-drawn ramal — shared with handleDragUp so a drag can trigger the
  // same modal when it newly creates one of these junctions.
  if (['af', 'ac', 'gas'].includes(r.net) && engine.triggerAccesorioModal) {
    const trigger = detectAccesorioTrigger(engine, r.id);
    if (trigger) engine.triggerAccesorioModal(trigger);
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
  let bestR: PlanoRamal | null = null, bestIdx = -1, bestD = Infinity;

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

export function setDefinedScaleM(engine: IPlanoEngineCore, v: string | number): void {
  engine.definedScaleM = parseFloat(String(v)) || 0;
  engine.render();
}

function checkCrossRamalAngle(engine: IPlanoEngineCore, pA: number[], pB: number[], skipId: string): boolean {
  for (const r of engine.ramales) {
    if (r.id === skipId || !r.pts || r.pts.length < 2) continue;
    const netId = r.net || engine.activeNet;
    const isSanOrLl = netId === 'san' || netId === 'll';
    const isAfAc = netId === 'af' || netId === 'ac';
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
          } else if (isAfAc) {
            // AF/AC only forms a tee (90°) at a junction — no 45°-ish yee-style merge, per
            // explicit request. Same tolerance renderJunctions.ts's isTee detection uses.
            isAllowed = Math.abs(internalAngle - 90) <= 15;
          } else {
            isAllowed = (internalAngle >= 50);
          }
          if (!isAllowed) {
            engine.triggerAlert(
              'Ángulo no recomendado',
              isSanOrLl ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°.'
                : isAfAc ? 'Las redes de agua caliente o agua fria no permiten uniones de 45° entre trazos'
                : 'Esta red debe diseñarse con ángulos de 45° o 90°.'
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
    // Look for an existing ramal to CONTINUE from before doing any generic snapping — this
    // must win over snapToExisting picking a nearby-but-different target (e.g. a bajante
    // displaced away from this same endpoint), otherwise clicking back onto an endpoint that
    // carries an accessory silently starts an unrelated new ramal instead of continuing it.
    let activeNetsRamales = engine.ramales.filter((rm) => rm.net === engine.activeNet);
    if (engine.tipoTramo === 'tributario') {
      // Continuing an existing tributario (from its own endpoint) must stay possible, not just
      // continuing the padre itself — restricting to only `id === padreTributario` meant clicking
      // near an existing tributario's own endpoint fell through to "start a new ramal" instead of
      // extending it.
      activeNetsRamales = activeNetsRamales.filter((rm) =>
        rm.id === engine.padreTributario || (rm.tipo === 'tributario' && rm.padre === engine.padreTributario)
      );
    }
    let continueRamal: PlanoRamal | null = null;
    let reversePoints = false;
    const CONTINUE_THRESH = 30 / engine.zoom;
    for (const rm of activeNetsRamales) {
      const firstPt = rm.pts[0];
      const lastPt = rm.pts[rm.pts.length - 1];
      const dFirst = Math.hypot(px - firstPt[0], py - firstPt[1]);
      const dLast = Math.hypot(px - lastPt[0], py - lastPt[1]);
      // An endpoint that already discharges into a bajante (rm.ini/fin holds the bajante's code)
      // must NOT be treated as a "continue this ramal" target — that silently let a click there
      // slide right past the bajante-start block below (continueRamal wins first), same as
      // clicking the bajante's own circle would otherwise be blocked. Falls through instead, so
      // the bajante check further down catches it and alerts.
      if (dFirst < CONTINUE_THRESH && dFirst <= dLast) {
        if (rm.ini) continue;
        continueRamal = rm;
        reversePoints = true;
        break;
      } else if (dLast < CONTINUE_THRESH) {
        if (rm.fin) continue;
        continueRamal = rm;
        break;
      }
    }

    if (continueRamal) {
      if (reversePoints) {
        // Swap endpoint-symmetric fields so they still refer to the correct
        // physical point after pts.reverse() (previously a latent bug: these
        // fields stayed put while the points array flipped under them).
        const tmpAcc = continueRamal.accesorioInicio;
        continueRamal.accesorioInicio = continueRamal.accesorioFin;
        continueRamal.accesorioFin = tmpAcc;
        const tmpDiam = continueRamal.diametroInicio;
        continueRamal.diametroInicio = continueRamal.diametroFin;
        continueRamal.diametroFin = tmpDiam;
        const tmpApp = continueRamal.aparatoInicio;
        continueRamal.aparatoInicio = continueRamal.aparatoFin;
        continueRamal.aparatoFin = tmpApp;
        continueRamal.pts.reverse();
      }

      // If the point we're continuing from carries an endpoint accessory, convert it
      // to a fixed mid-ramal accessory (accMed) before it stops being the last point.
      if (continueRamal.accesorioFin) {
        const oldLastIdx = continueRamal.pts.length - 1;
        continueRamal.accMed = { ...(continueRamal.accMed || {}), [`accMed${oldLastIdx}`]: continueRamal.accesorioFin };
        continueRamal.accesorioFin = '';
        continueRamal.diametroFin = '';
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

    // A ramal may only ARRIVE at a bajante — real (own floor) or fantasma (ghost, any kind) —
    // never START there. Checked against the raw click (before any snapping): merely dropping the
    // snap-to-bajante below isn't enough, since the raw click point is already sitting right on
    // top of the circle and would still start a ramal there, just unassociated. Block outright.
    // Uses the same cached hit-circles (_circ for the real bajante, _ghost for any fantasma) the
    // render pass already computes every frame, so this always matches exactly what's on screen.
    {
      const rawC = engine.toCvs(pt.x, pt.y);
      const onBajante = engine.bajantes.some((b) => {
        if (!netsSnapLinked(b.net, engine.activeNet) || engine._hiddenNets.has(b.net)) return false;
        if (b._circ && Math.hypot(b._circ.x - rawC.x, b._circ.y - rawC.y) < b._circ.r + 6 * engine.zoom) return true;
        return false;
      });
      const onFantasma = !onBajante && engine.getBajantesFantasma().some((b) => {
        if (!netsSnapLinked(b.net, engine.activeNet)) return false;
        if (!b._ghost) return false;
        return Math.hypot(b._ghost.x - rawC.x, b._ghost.y - rawC.y) < b._ghost.r + 6 * engine.zoom;
      });
      if (onBajante || onFantasma) {
        engine.triggerAlert('No se puede iniciar aquí', 'Un ramal solo puede conectarse a un bajante como punto de llegada. Empieza el trazo en otro punto y termínalo en el bajante.');
        return;
      }
    }

    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) {
      // snapToExisting will happily snap onto ANY nearby ramal's vertex, regardless of which
      // ramal was picked as the tributario's padre — so a click near a different ramal than the
      // selected padre silently created the tributario against the wrong one. Block it instead.
      if (engine.tipoTramo === 'tributario') {
        const snappedRamal = engine.ramales.find((r) =>
          r.net === engine.activeNet && r.pts.some(([rx, ry]) => Math.hypot(rx - sp.x, ry - sp.y) < 0.5)
        );
        if (snappedRamal && snappedRamal.id !== engine.padreTributario) {
          engine.triggerAlert('Ramal padre incorrecto', 'Solo puedes conectar el tributario al ramal padre seleccionado.');
          return;
        }
      }
      // A ventilación ramal starting exactly on a sanitaria point (a codo reventilado junction)
      // must have its FIRST segment follow the sanitaria pipe's own local direction there — not
      // an arbitrary 45°-grid angle. Find which san segment owns this vertex and remember its
      // heading; consumed (and cleared) the moment the first segment is placed, below.
      engine._ventFirstSegDir = null;
      if (engine.activeNet === 'vent') {
        for (const sr of engine.ramales) {
          if (sr.net !== 'san' || !sr.pts?.length) continue;
          const idx = sr.pts.findIndex(([sx, sy]) => Math.hypot(sx - sp.x, sy - sp.y) < 0.5);
          if (idx === -1) continue;
          const a = idx > 0 ? sr.pts[idx - 1] : sr.pts[idx + 1];
          const b = sr.pts[idx];
          if (a && b) {
            const ddx = b[0] - a[0], ddy = b[1] - a[1];
            const len = Math.hypot(ddx, ddy);
            if (len > 0.01) engine._ventFirstSegDir = { x: ddx / len, y: ddy / len };
          }
          break;
        }
      }
      pt = sp;
    } else {
      let activeNetsRamales = engine.ramales.filter((r) => r.net === engine.activeNet);
      if (engine.tipoTramo === 'tributario') {
        activeNetsRamales = activeNetsRamales.filter((r) => r.id !== engine.padreTributario);
      }
      let onSegmentRamal: PlanoRamal | null = null;
      const SNAP_THRESH = 12 / engine.zoom;

      for (const r of activeNetsRamales) {
        const segSnap = engine._snapToSegment(pt.x, pt.y, r.pts, SNAP_THRESH);
        if (segSnap) {
          onSegmentRamal = r;
          break;
        }
      }

      if (onSegmentRamal) {
        // Same click that would trip the vertex-based padre guard above, just landing on the
        // ramal's body instead of a vertex — must show the same modal, not the unrelated generic
        // "can't start on a segment" status-bar text (which for a tributario is misleading: the
        // real problem is which ramal it's on, not that it's on a segment at all).
        if (engine.tipoTramo === 'tributario') {
          engine.triggerAlert('Ramal padre incorrecto', 'Solo puedes conectar el tributario al ramal padre seleccionado.');
        } else {
          engine._emitStatus('No puedes iniciar un ramal sobre un segmento. Inicia en espacio libre o en un vértice.');
        }
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
    if (engine._ventFirstSegDir && engine.activeRamal.pts.length === 1) {
      // First segment of a ventilación ramal that started at a codo reventilado — lock it to the
      // sanitary ramal's own heading there instead of the generic 45° grid. Only applies to this
      // one segment; consumed immediately so later segments snap normally.
      const dirv = engine._ventFirstSegDir;
      const relX = pt.x - last[0], relY = pt.y - last[1];
      const relLen = Math.hypot(relX, relY);
      if (relLen > 0.01) {
        const proj = relX * dirv.x + relY * dirv.y;
        const perpDist = Math.abs(relX * dirv.y - relY * dirv.x);
        if (perpDist / relLen > 0.15) {
          engine.triggerAlert(
            'Ángulo bloqueado',
            'El primer trazo de ventilación en un codo reventilado sigue la dirección del ramal sanitario — no puede cambiar de ángulo aquí.'
          );
        }
        // Keep the actual cursor distance (relLen) as the segment length, only the direction gets
        // locked to dirv — projecting to `proj` alone collapsed the segment near-to-zero whenever
        // the cursor moved close to perpendicular to dirv, creating a degenerate zero-length point.
        const sign = proj >= 0 ? 1 : -1;
        pt = { x: last[0] + dirv.x * relLen * sign, y: last[1] + dirv.y * relLen * sign };
      }
      engine._ventFirstSegDir = null;
    } else if (engine.snapMode) {
      pt = engine.snapAngle(last[0], last[1], pt.x, pt.y, engine.activeRamal.net, engine.activeRamal.tipo);
    }
    
    const activeRamales = engine.tipoTramo === 'tributario'
      ? engine.ramales.filter((r) => r.id === engine.padreTributario)
      : engine.ramales.filter((r) => r.net === engine.activeNet);
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
      if (sp) {
        // Same guard as the "start a new tributario" branch above — snapToExisting is unrestricted
        // and will happily snap onto ANY ramal's vertex, not just the selected padre. Without this,
        // clicking near a different ramal while continuing an in-progress tributario silently
        // latched onto the wrong ramal (or fell through to the angle check, which fired an
        // unrelated "Ángulo no recomendado" alert instead of explaining the real problem).
        if (engine.tipoTramo === 'tributario') {
          const snappedRamal = engine.ramales.find((r) =>
            r.net === engine.activeNet && r.id !== engine.activeRamal!.id &&
            r.pts.some(([rx, ry]) => Math.hypot(rx - sp.x, ry - sp.y) < 0.5)
          );
          if (snappedRamal && snappedRamal.id !== engine.padreTributario) {
            engine.triggerAlert('Ramal padre incorrecto', 'Solo puedes conectar el tributario al ramal padre seleccionado.');
            return;
          }
        }
        pt = sp;
      }
    }
    const lvlLabel = engine.nivelActual?.label ?? '';
    const bajThresh = 20 / engine.zoom;
    const nearBaj = engine.bajantes.find((b) => {
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
      if (!checkRamalAngles(testPts, engine.activeNet, engine.activeRamal.tipo)) {
        engine.triggerAlert(
          'Ángulo no recomendado',
          (engine.activeNet === 'san' || engine.activeNet === 'll')
            ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°.'
            : ((engine.activeNet === 'af' || engine.activeNet === 'ac') && engine.activeRamal.tipo === 'tributario')
            ? 'Los tributarios de AF/AC solo permiten ángulos de 90°.'
            : 'Esta red debe diseñarse con ángulos de 45° o 90°.'
        );
        return;
      }
    }

    // Check segment intersection with existing ramales of the same network
    // AF/AC: allow crossings (will auto-detect teeBilateral)
    if (engine.activeNet !== 'af' && engine.activeNet !== 'ac') {
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
              // A tributario crossing any ramal other than its own padre is the padre violation,
              // not a generic crossing — this geometric check ran BEFORE the vertex-snap padre
              // check above ever got a chance (that one only fires on an exact vertex match; a
              // mere crossing through the wrong ramal's body doesn't end exactly on a vertex, so
              // it landed here first with a message that didn't explain the real problem).
              if (engine.tipoTramo === 'tributario' && r.id !== engine.padreTributario) {
                engine.triggerAlert('Ramal padre incorrecto', 'Solo puedes conectar el tributario al ramal padre seleccionado.');
                return;
              }
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
  
  const isText = engine.textAnnots.some((t) => t.id === selId);
  const isArea = engine.areas.some((a) => a.id === selId);
  const tipo = (sel as Partial<PlanoBajante & PlanoRamal>).tipo;
  
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
    const r = sel as PlanoRamal;
    
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
