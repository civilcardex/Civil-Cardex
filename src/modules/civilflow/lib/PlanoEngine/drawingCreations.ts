import { NETS } from './PlanoState';
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState';
import { calculateRamalLength, _statusMsg } from './PlanoEngineDrawing';
import { isRamalBajanteConnectionAllowed } from '../../utils/flowDirection';
import { pisoCortoLoose } from '../../constants';
import { resolveAndClampToCanal } from './canalAssociation';

// Bajante only belongs on san/vent/ll, montante only on gas/ac/af — same rule enforced at the
// toolbar (isToolDisabledForNet in PdfViewerToolbar.tsx) and the keyboard shortcuts (PlanoEngine.ts
// _onKeyDownHandler); checked again here as defense-in-depth in case some other caller reaches
// these functions without going through either of those gates.
export const BAJANTE_NETS = ['san', 'vent', 'll'];
export const MONTANTE_NETS = ['gas', 'ac', 'af'];

/** Creates a new bajante at the given coordinates, auto-associating with nearby ramal endpoints and auto-filling their ini/fin fields. @param engine Engine core instance. @param px Plane X coordinate. @param py Plane Y coordinate. */
export function handleBajanteDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!BAJANTE_NETS.includes(engine.activeNet)) {
    engine._emitStatus('Bajante no disponible para esta red');
    return;
  }
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  const ASSOC_THRESH = 30 / engine.zoom;
  const assocRamales: string[] = [];
  // A freshly-created bajante has NO direction yet (the user picks Sube/Baja/Continua
  // afterward) — so there's nothing to guard against here at creation time. Just associate
  // with whichever nearby ramal endpoint (start or end) is closest; the flow-direction guard
  // (flowDirection.ts) re-validates properly once the user actually sets "Baja" on this
  // bajante, against whatever ramales are connected by then.
  for (const r of engine.ramales) {
    if (r.net !== engine.activeNet || !r.pts?.length) continue;
    const startDist = Math.hypot(px - r.pts[0][0], py - r.pts[0][1]);
    const li = r.pts.length - 1;
    const endDist = Math.hypot(px - r.pts[li][0], py - r.pts[li][1]);
    if (endDist < ASSOC_THRESH && endDist <= startDist) {
      px = r.pts[li][0];
      py = r.pts[li][1];
      assocRamales.push(r.id);
    } else if (startDist < ASSOC_THRESH) {
      px = r.pts[0][0];
      py = r.pts[0][1];
      assocRamales.push(r.id);
    }
  }
  // Rainwater bajantes dropped inside a canal recolectora's rectangle must stay inside it —
  // auto-associate and clamp onto the canal's own boundary if the click landed just outside.
  let canalId: string | null = null;
  if (engine.activeNet === 'll') {
    const resolved = resolveAndClampToCanal(engine, px, py);
    px = resolved.x;
    py = resolved.y;
    canalId = resolved.canalId;
  }
  const net = NETS.find((n) => n.id === engine.activeNet);
  const netPfx = net ? net.bmPfx : 'BAJ';
  const cnt =
    engine.bajantes.filter((b) => b.tipo === 'bajante' && b.net === engine.activeNet).length + 1;
  const bajId = netPfx + cnt;
  engine.bajantes.push({
    id: bajId,
    net: engine.activeNet,
    tipo: 'bajante',
    code: bajId,
    // No direccion by default — the user must explicitly pick Sube/Baja/Continua for this
    // bajante; see the BajanteDirectionSelector buttons.
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: assocRamales,
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: px,
    labelY: py + 20,
    bajR: 7 / 24,
    canalId,
  });
  // Auto-fill ini/fin on associated ramales
  const newBaj = engine.bajantes[engine.bajantes.length - 1];
  for (const rid of assocRamales) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (!r || !r.pts) continue;
    const distStart = Math.hypot(r.pts[0][0] - px, r.pts[0][1] - py);
    const lastIdx = r.pts.length - 1;
    const distEnd = Math.hypot(r.pts[lastIdx][0] - px, r.pts[lastIdx][1] - py);
    const epIdx: 0 | number = distStart <= distEnd ? 0 : lastIdx;
    // Centralized direction guard — a no-op today since a freshly-created bajante has no
    // direction yet, but kept as defense-in-depth in case that ever changes; if it ever does
    // reject, also drop the association from `newBaj.recibeDeIds` (already pushed above as
    // part of the initial bajante payload).
    if (!isRamalBajanteConnectionAllowed(engine, r, epIdx, newBaj)) {
      if (newBaj.recibeDeIds) newBaj.recibeDeIds = newBaj.recibeDeIds.filter((id) => id !== rid);
      continue;
    }
    if (epIdx === 0) {
      r.ini = bajId;
    } else {
      r.fin = bajId;
    }
    // Lock the ramal so this newly snapped bajante can't be dragged away independently
    r.bloqueado = true;
  }
  engine.selId = bajId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

/** Creates a new montante (riser) at the given coordinates, auto-associating with nearby ramal endpoints, placing codo accessories, and renumbering montantes. @param engine Engine core instance. @param px Plane X coordinate. @param py Plane Y coordinate. */
export function handleMontanteDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!MONTANTE_NETS.includes(engine.activeNet)) {
    engine._emitStatus('Montante no disponible para esta red');
    return;
  }
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  const ASSOC_THRESH = 20 / engine.zoom;
  const assocRamales: string[] = [];
  for (const r of engine.ramales) {
    if (r.net !== engine.activeNet || !r.pts?.length) continue;
    const startDist = Math.hypot(px - r.pts[0][0], py - r.pts[0][1]);
    const li = r.pts.length - 1;
    const endDist = Math.hypot(px - r.pts[li][0], py - r.pts[li][1]);
    if (startDist < ASSOC_THRESH && startDist <= endDist) {
      px = r.pts[0][0];
      py = r.pts[0][1];
      assocRamales.push(r.id);
    } else if (endDist < ASSOC_THRESH) {
      px = r.pts[li][0];
      py = r.pts[li][1];
      assocRamales.push(r.id);
    }
  }
  const netDef = NETS.find((n) => n.id === engine.activeNet);
  const pfx = netDef?.bmPfx || 'MON';
  const cnt =
    engine.bajantes.filter((b) => b.tipo === 'montante' && b.net === engine.activeNet).length + 1;
  const monId = `${pfx}${cnt}_${engine.activeNet}`;
  const code = `${pfx}${cnt}`;
  engine.bajantes.push({
    id: monId,
    net: engine.activeNet,
    tipo: 'montante',
    code: code,
    // No direccion by default — user must pick Sube/Baja/Continua
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: assocRamales,
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: px,
    labelY: py + 20,
    bajR: 7 / 24,
  });
  // Auto-fill ini/fin on associated ramales — and auto-count the elbow a montante at an endpoint
  // always implies: codo sube/baja (matching the montante's own direction, always 'sube' fresh
  // off creation above), diameter matched to the ramal it lands on.
  const codoAccId = 'codo90rmSube';
  for (const rid of assocRamales) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (!r || !r.pts) continue;
    const distStart = Math.hypot(r.pts[0][0] - px, r.pts[0][1] - py);
    const lastIdx = r.pts.length - 1;
    const distEnd = Math.hypot(r.pts[lastIdx][0] - px, r.pts[lastIdx][1] - py);
    if (distStart <= distEnd) {
      r.ini = code;
      if (!r.accesorioInicio) {
        r.accesorioInicio = codoAccId;
        r.diametroInicio = '';
      }
    } else {
      r.fin = code;
      if (!r.accesorioFin) {
        r.accesorioFin = codoAccId;
        r.diametroFin = '';
      }
    }
  }
  engine._renumberMontantes();
  const newlyCreated = engine.bajantes.find(
    (b) => b.tipo === 'montante' && b.x === px && b.y === py,
  );
  if (newlyCreated) {
    engine.selId = newlyCreated.id;
    engine._emitSelect(newlyCreated);
  }
  engine._isGhostSel = false;
  engine.render();
  engine._markDirty();
}

// Montante on the BODY of an af/ac ramal (not an endpoint) — from the context menu, not the
// toolbar tool. Splits the ramal at the clicked point (same vertex-insertion pattern the mid-body
// accessory selector already uses) and always writes an accompanying tee accessory there — a
// montante always implies a tee. The reverse must never happen: placing a tee manually
// (see accessoryOptions.ts / MidRamalAccessorySelector) never creates a montante — kept as a
// separate write path on purpose.
/** Creates a montante on the body of an AF/AC ramal (not an endpoint), splitting the ramal at the click point and placing a tee accessory. @param engine Engine core instance. @param ramalId The ramal being split. @param x Plane X coordinate. @param y Plane Y coordinate. @param segmentIdx Index of the segment where the split occurs. */
export function handleCreateMontanteMidBody(
  engine: IPlanoEngineCore,
  ramalId: string,
  x: number,
  y: number,
  segmentIdx: number,
): void {
  const r = engine.ramales.find((rr) => rr.id === ramalId);
  if (!r || !r.pts) return;
  if (!MONTANTE_NETS.includes(r.net)) {
    engine._emitStatus('Montante no disponible para esta red');
    return;
  }

  const newIdx = segmentIdx + 1;
  const newPts = r.pts.map((p) => [...p]);
  newPts.splice(newIdx, 0, [x, y]);
  const shiftedAccMed: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.accMed || {})) {
    const m = k.match(/^accMed(\d+)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    shiftedAccMed[`accMed${idx >= newIdx ? idx + 1 : idx}`] = v as string;
  }
  // 'teeSube' to match the montante's own default direccion ('sube', set below) — was hardcoded
  // to 'teeDirecto', so the montante's tee glyph never actually showed the sube/baja circle+mark
  // the direction is supposed to convey. Kept in sync with the montante's direction afterward by
  // BajanteDirectionSelector (DrawingElementContextMenu.tsx).
  shiftedAccMed[`accMed${newIdx}`] = 'teeSube';
  r.pts = newPts;
  r.accMed = shiftedAccMed;
  r.totalL = calculateRamalLength(newPts, engine);

  const netDef = NETS.find((n) => n.id === r.net);
  const pfx = netDef?.bmPfx || 'MON';
  const cnt = engine.bajantes.filter((b) => b.tipo === 'montante' && b.net === r.net).length + 1;
  const monId = `${pfx}${cnt}_${r.net}`;
  const code = `${pfx}${cnt}`;
  engine.bajantes.push({
    id: monId,
    net: r.net,
    tipo: 'montante',
    code,
    // No direccion by default — user must pick Sube/Baja/Continua
    x,
    y,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [r.id],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: x,
    labelY: y + 20,
    bajR: 7 / 24,
  });
  engine._renumberMontantes();
  const newlyCreated = engine.bajantes.find((b) => b.id === monId);
  if (newlyCreated) {
    engine.selId = monId;
    engine._emitSelect(newlyCreated);
  }
  engine._isGhostSel = false;
  engine.render();
  engine._markDirty();
}

// Caps the "leftover" branch of an existing plain tee (teeDirecto/teeSube/teeBaja at an interior
// accMed vertex) with a tapón or llave terminal — the third alternative alongside actually drawing
// a new ramal from that point (already possible, snapToExisting matches any vertex generically)
// or leaving it as a bare montante riser. Creates a short stub ramal along the tee's own free
// (perpendicular) direction, capped with the chosen accessory at its far end — the accessory glyph
// needs a real ramal endpoint to render on, there being no such thing as "a cap with no pipe".
/** Creates a short stub ramal capped with a tapón or llaveTerminal at a tee's free (perpendicular) branch direction. @param engine Engine core instance. @param ramalId The parent ramal containing the tee. @param accMedIdx Index of the accMed vertex. @param accId Accessory id: 'tapon' or 'llaveTerminal'. */
export function handleCreateTeeCapStub(
  engine: IPlanoEngineCore,
  ramalId: string,
  accMedIdx: number,
  accId: 'tapon' | 'llaveTerminal',
): void {
  const r = engine.ramales.find((rr) => rr.id === ramalId);
  if (!r || !r.pts || accMedIdx <= 0 || accMedIdx >= r.pts.length - 1) return;
  const pt = r.pts[accMedIdx];
  const prev = r.pts[accMedIdx - 1];
  const next = r.pts[accMedIdx + 1];
  const dxIn = pt[0] - prev[0],
    dyIn = pt[1] - prev[1];
  const lenIn = Math.hypot(dxIn, dyIn);
  const dxOut = next[0] - pt[0],
    dyOut = next[1] - pt[1];
  const lenOut = Math.hypot(dxOut, dyOut);
  const uxIn = lenIn > 0.01 ? dxIn / lenIn : 1,
    uyIn = lenIn > 0.01 ? dyIn / lenIn : 0;
  const uxOut = lenOut > 0.01 ? dxOut / lenOut : uxIn,
    uyOut = lenOut > 0.01 ? dyOut / lenOut : uyIn;
  let bx = uxIn + uxOut,
    by = uyIn + uyOut;
  const bisLen = Math.hypot(bx, by);
  if (bisLen > 0.01) {
    bx /= bisLen;
    by /= bisLen;
  } else {
    bx = uxIn;
    by = uyIn;
  }
  // Same bisector the tee glyph itself is drawn along (renderRamales.ts's accMed pass) — the
  // free branch runs perpendicular to it.
  const px_ = -by,
    py_ = bx;

  const STUB_LEN_MM = 300;
  const endX = pt[0] + px_ * STUB_LEN_MM,
    endY = pt[1] + py_ * STUB_LEN_MM;

  const netDef = NETS.find((n) => n.id === r.net);
  const pfx = netDef ? netDef.lbl : 'R';
  const cnt = ++engine._netCounts[r.net].ramal;
  const stub: PlanoRamal = {
    id: `${pfx}${cnt}`,
    net: r.net,
    tipo: 'ramal',
    padre: null,
    pts: [
      [pt[0], pt[1]],
      [endX, endY],
    ],
    totalL: calculateRamalLength(
      [
        [pt[0], pt[1]],
        [endX, endY],
      ],
      engine,
    ),
    label: `${pfx}${cnt}`,
    ini: '',
    fin: '',
    piso: String(engine.nivelActual?.n ?? ''),
    dz: '',
    uc: 0,
    nSalidas: 1,
    labelX: (pt[0] + endX) / 2,
    labelY: (pt[1] + endY) / 2,
    labelAngle: 0,
    material: r.material || '',
    diametro: '',
    pendiente: 0,
    bloqueado: true,
    accesorioFin: accId,
    diametroFin: '',
  };
  engine.ramales.push(stub);
  engine._renumberRamales(r.net);
  engine.selId = stub.id;
  engine._emitSelect(stub);
  engine.render();
  engine._markDirty();
}

/** Creates a new calentador (water heater) symbol at the given coordinates. @param engine Engine core instance. @param px Plane X coordinate. @param py Plane Y coordinate. */
export function handleCalentadorDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  const calent = engine.bajantes.filter((b) => b.tipo === 'calentador').length + 1;
  const calentId = 'CALENT' + calent;
  engine.bajantes.push({
    id: calentId,
    net: engine.activeNet,
    tipo: 'calentador',
    code: 'CALENT' + calent,
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: px - 25,
    labelY: py,
    bajR: 7 / 24,
  });
  engine.selId = calentId;
  engine.render();
  engine._markDirty();
}

// Canal recolectora (roof gutter/channel) — a standalone symbol, same array/no-ramal-association
// pattern as contador/calentador, exclusive to the 'll' (aguas lluvias) net. Unlike every other
// point-glyph tool, it's a drag-drawn RECTANGLE: first click sets corner 1 (_canalStart, same
// click-then-move-then-click rubber-band pattern as _dimStart/_guideStart), a live preview
// follows the cursor (renderCanalGhost), second click sets corner 2 and computes base/altura from
// the real-world distance between the two corners (via pxToM, at the plan's drawing scale) — so
// the rectangle is scaled to the plan from the moment it's drawn, not typed in afterward. Once
// created it can still be resized from its corners (handleMouseDown.ts's _tryCanalResizeHit) or
// edited precisely via the context menu (CanalMenu). Unlike bajante (which appends its floor
// suffix only at render time, since a riser can span floors), the floor is baked into the
// code/id here at creation — a canal lives on a single floor only.
/** Handles a click while the canal tool is active: sets corner 1 on first click, creates the canal rectangle on second click. Exclusive to the aguas lluvias (ll) network. @param engine Engine core instance. @param px Plane X coordinate. @param py Plane Y coordinate. */
export function handleCanalDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.activeNet !== 'll') {
    engine._emitStatus('Canal no disponible para esta red');
    return;
  }
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  if (!engine._canalStart) {
    engine._canalStart = { x: px, y: py };
    engine._emitStatus('Canal — clic para la esquina opuesta');
    engine.render();
    return;
  }
  const s = engine._canalStart;
  engine._canalStart = null;
  const base = +(engine.pxToM(Math.abs(px - s.x)) * 100).toFixed(1);
  const altura = +(engine.pxToM(Math.abs(py - s.y)) * 100).toFixed(1);
  // Guard against an accidental double-click-in-place producing a degenerate 0x0 rectangle.
  if (base < 1 && altura < 1) {
    engine._emitStatus(_statusMsg(engine));
    engine.render();
    return;
  }
  const x = Math.min(s.x, px);
  const y = Math.min(s.y, py);
  // Flow points the way the user dragged the rectangle (corner 1 → corner 2), along the longer
  // axis — same "drawn direction" convention as a ramal's flow arrow.
  const horizontal = Math.abs(px - s.x) >= Math.abs(py - s.y);
  const canalFlowDir: 'derecha' | 'izquierda' | 'abajo' | 'arriba' = horizontal
    ? px >= s.x
      ? 'derecha'
      : 'izquierda'
    : py >= s.y
      ? 'abajo'
      : 'arriba';
  const cnt = engine.bajantes.filter((b) => b.tipo === 'canal').length + 1;
  const code = `CALL${cnt}-${pisoCortoLoose(engine.nivelActual?.n ?? 0)}`;
  engine.bajantes.push({
    id: code,
    net: 'll',
    tipo: 'canal',
    code,
    x,
    y,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: x,
    labelY: y + Math.abs(py - s.y) + 20,
    bajR: 7 / 24,
    base,
    altura,
    _canalFlowDir: canalFlowDir,
  });
  engine.selId = code;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}

/** Creates a new red pública (public mains) symbol at the given coordinates. @param engine Engine core instance. @param px Plane X coordinate. @param py Plane Y coordinate. */
export function handleRedPublicaDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  const cnt = engine.bajantes.filter((b) => b.tipo === 'red_publica').length + 1;
  const rpId = 'RP' + cnt;
  engine.bajantes.push({
    id: rpId,
    net: engine.activeNet,
    tipo: 'red_publica',
    code: 'RP' + cnt,
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: px,
    labelY: py + 20,
    bajR: 7 / 24,
  });
  engine.selId = rpId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

/** Creates a new contador (meter) at the given coordinates, auto-connecting to the nearest red pública with a ramal if one exists. @param engine Engine core instance. @param px Plane X coordinate. @param py Plane Y coordinate. */
export function handleContadorDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  const cntPfx = engine.activeNet === 'gas' ? 'CTNG' : 'CNTAF';
  const cnt = engine.bajantes.filter((b) => b.tipo === 'contador').length + 1;
  const cntId = cntPfx + cnt;
  engine.bajantes.push({
    id: cntId,
    net: engine.activeNet,
    tipo: 'contador',
    code: cntPfx + cnt,
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: px - 25,
    labelY: py,
    bajR: 7 / 24,
  });
  engine.selId = cntId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);

  const rps = engine.bajantes.filter((b) => b.tipo === 'red_publica' && b.net === engine.activeNet);
  if (rps.length > 0) {
    let nearestRP = rps[0];
    let minDist = Infinity;
    for (const rp of rps) {
      const d = Math.hypot(rp.x - px, rp.y - py);
      if (d < minDist) {
        minDist = d;
        nearestRP = rp;
      }
    }
    const rpId = nearestRP.code || nearestRP.id;
    const alreadyConnected = engine.ramales.some(
      (r) =>
        r.net === engine.activeNet &&
        ((r.ini === rpId && r.fin === cntId) || (r.ini === cntId && r.fin === rpId)),
    );
    if (!alreadyConnected) {
      const net = NETS.find((n) => n.id === engine.activeNet);
      const pfx = net ? net.lbl : 'R';
      if (!engine._netCounts[engine.activeNet])
        engine._netCounts[engine.activeNet] = { ramal: 0, tributario: 0 };
      const ramCnt = ++engine._netCounts[engine.activeNet].ramal;
      const ramId = pfx + ramCnt;
      engine.ramales.push({
        id: ramId,
        net: engine.activeNet,
        _net: engine.activeNet,
        tipo: 'ramal',
        padre: null,
        pts: [
          [nearestRP.x, nearestRP.y],
          [px, py],
        ],
        totalL: +engine.pxToM(Math.hypot(px - nearestRP.x, py - nearestRP.y)).toFixed(3),
        label: pfx + ramCnt,
        ini: rpId,
        fin: cntId,
        piso: String(engine.nivelActual?.n ?? ''),
        dz: '',
        uc: 0,
        labelX: (nearestRP.x + px) / 2,
        labelY: (nearestRP.y + py) / 2,
        labelAngle: 0,
        material: '',
        diametro: '',
        pendiente: 1.5,
        bloqueado: true,
      });
    }
  }

  engine.render();
  engine._markDirty();
}
