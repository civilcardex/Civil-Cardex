import { NETS } from './PlanoState';
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState';
import { calculateRamalLength, _statusMsg } from './ramalMeasure';
import { isRamalBajanteConnectionAllowed } from '../../utils/flowDirection';
import { pisoCortoLoose } from '../../constants';
import { resolveAndClampToCanal } from './canalAssociation';

// El bajante solo pertenece a san/vent/ll, el montante solo a gas/ac/af — misma regla que
// aplican la barra de herramientas (isToolDisabledForNet en PdfViewerToolbar.tsx) y los atajos
// de teclado (PlanoEngine.ts _onKeyDownHandler); se re-chequea aquí como defensa en
// profundidad por si algún otro caller llega a estas funciones sin pasar por ninguna de esas
// compuertas.
export const BAJANTE_NETS = ['san', 'vent', 'll'];
export const MONTANTE_NETS = ['gas', 'ac', 'af'];

/** Crea un bajante nuevo en las coordenadas dadas, auto-asociándolo con extremos de ramal
 *  cercanos y auto-rellenando sus campos ini/fin. @param engine Instancia del motor.
 *  @param px Coordenada X de plano. @param py Coordenada Y de plano. */
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
  // Un bajante recién creado NO tiene dirección todavía (el usuario elige Sube/Baja/Continua
  // después) — así que no hay nada que proteger aquí al crearlo. Solo se asocia con el extremo
  // de ramal cercano (inicio o fin) más próximo; la guardia de dirección de flujo
  // (flowDirection.ts) re-valida correctamente una vez que el usuario fija "Baja" en este
  // bajante, contra los ramales que estén conectados para entonces.
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
  // Los bajantes de lluvia soltados dentro del rectángulo de un canal recolectora deben
  // quedarse dentro — se auto-asocian y se recortan al borde del canal si el clic cayó
  // apenas afuera.
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
    // Sin dirección por defecto — el usuario debe elegir Sube/Baja/Continua explícitamente
    // para este bajante; ver los botones BajanteDirectionSelector.
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
  // Auto-rellenar ini/fin en los ramales asociados
  const newBaj = engine.bajantes[engine.bajantes.length - 1];
  for (const rid of assocRamales) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (!r || !r.pts) continue;
    const distStart = Math.hypot(r.pts[0][0] - px, r.pts[0][1] - py);
    const lastIdx = r.pts.length - 1;
    const distEnd = Math.hypot(r.pts[lastIdx][0] - px, r.pts[lastIdx][1] - py);
    const epIdx: 0 | number = distStart <= distEnd ? 0 : lastIdx;
    // Guardia centralizada de dirección — hoy es un no-op porque un bajante recién creado no
    // tiene dirección todavía, pero se conserva como defensa en profundidad por si eso cambia
    // algún día; si alguna vez rechaza, también se quita la asociación de `newBaj.recibeDeIds`
    // (ya pusheada arriba como parte del payload inicial del bajante).
    if (!isRamalBajanteConnectionAllowed(engine, r, epIdx, newBaj)) {
      if (newBaj.recibeDeIds) newBaj.recibeDeIds = newBaj.recibeDeIds.filter((id) => id !== rid);
      continue;
    }
    if (epIdx === 0) {
      r.ini = bajId;
    } else {
      r.fin = bajId;
    }
    // Bloquear el ramal para que este bajante recién pegado no pueda arrastrarse por separado
    r.bloqueado = true;
  }
  engine.selId = bajId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

/** Crea un montante (tubería vertical) nuevo en las coordenadas dadas, auto-asociándolo con
 *  extremos de ramal cercanos, colocando accesorios de codo y renumerando montantes.
 *  @param engine Instancia del motor. @param px Coordenada X de plano. @param py Coordenada Y de
 *  plano. */
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
    // Sin dirección por defecto — el usuario debe elegir Sube/Baja/Continua
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
  // Auto-rellenar ini/fin en los ramales asociados — y auto-contar el codo que un montante en
  // un extremo siempre implica: codo sube/baja (coincidiendo con la dirección propia del
  // montante, siempre 'sube' recién salido de la creación de arriba), con diámetro igualado al
  // ramal donde cae.
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

// Montante sobre el CUERPO de un ramal af/ac (no un extremo) — desde el menú contextual, no la
// herramienta de la barra. Divide el ramal en el punto clicado (el mismo patrón de inserción de
// vértice que ya usa el selector de accesorios a mitad de cuerpo) y siempre escribe un accesorio
// de tee acompañante ahí — un montante siempre implica una tee. Lo inverso nunca debe pasar:
// colocar una tee manualmente (ver accessoryOptions.ts / MidRamalAccessorySelector) jamás crea
// un montante — se mantiene como camino de escritura separado a propósito.
/** Crea un montante sobre el cuerpo de un ramal AF/AC (no un extremo), dividiendo el ramal en
 *  el punto clicado y colocando un accesorio de tee. @param engine Instancia del motor.
 *  @param ramalId El ramal que se divide. @param x Coordenada X de plano. @param y Coordenada Y
 *  de plano. @param segmentIdx Índice del segmento donde ocurre la división. */
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
  // 'teeSube' para coincidir con la dirección por defecto propia del montante ('sube', fijada
  // abajo) — antes estaba hardcodeado a 'teeDirecto', así que el glifo de tee del montante nunca
  // mostraba de verdad el círculo+marca de sube/baja que la dirección debe transmitir. Se
  // mantiene sincronizado con la dirección del montante después por BajanteDirectionSelector
  // (DrawingElementContextMenu.tsx).
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
    // Sin dirección por defecto — el usuario debe elegir Sube/Baja/Continua
    code,
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

// Calentador sobre el CUERPO de un ramal af (no un extremo) — desde el menú contextual, no la
// herramienta de la barra. Mismo patrón de dividir-el-ramal-en-el-punto-clicado que
// handleCreateMontanteMidBody, pero sin marcador de tee: el calentador es un dispositivo de paso
// en línea, no una rama. El bajante se crea con red 'ac' — un calentador siempre pertenece a la
// red de agua caliente, aunque el usuario lo ancle en un ramal de agua fría (af); solo el punto
// de inserción difiere del creado por barra (handleCalentadorDown). El ramal af conserva su red
// y continúa por el vértice de división; la conexión ac/af es implícita vía el id CALENTn (la
// misma convención que buildTramos.ts usa para construir el ramal sintético AC-01-{calId} desde
// cualquier bajante de calentador).
/** Crea un calentador sobre el cuerpo de un ramal AF (no un extremo), dividiendo el ramal en el
 *  punto clicado. El bajante se crea con red 'ac'. @param engine Instancia del motor.
 *  @param ramalId El ramal que se divide. @param x Coordenada X de plano. @param y Coordenada Y
 *  de plano. @param segmentIdx Índice del segmento donde ocurre la división. */
export function handleCreateCalentadorMidBody(
  engine: IPlanoEngineCore,
  ramalId: string,
  x: number,
  y: number,
  segmentIdx: number,
): void {
  const r = engine.ramales.find((rr) => rr.id === ramalId);
  if (!r || !r.pts) return;
  if (r.net !== 'af') {
    engine._emitStatus('El calentador solo puede insertarse en la red AF');
    return;
  }

  // Inserción en extremo (segmentIdx = primer/último punto): solo anclar el calentador en el
  // extremo existente — sin división, sin segmento duplicado de longitud cero. Solo los clics
  // reales a mitad de cuerpo dividen.
  if (segmentIdx === 0 || segmentIdx === r.pts.length - 1) {
    pushCalentadorBajante(engine, r.pts[segmentIdx][0], r.pts[segmentIdx][1]);
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
  r.pts = newPts;
  r.accMed = shiftedAccMed;
  r.totalL = calculateRamalLength(newPts, engine);

  pushCalentadorBajante(engine, x, y);
}

function pushCalentadorBajante(engine: IPlanoEngineCore, x: number, y: number): void {
  const calent = engine.bajantes.filter((b) => b.tipo === 'calentador').length + 1;
  const calentId = 'CALENT' + calent;
  engine.bajantes.push({
    id: calentId,
    net: 'ac',
    tipo: 'calentador',
    code: 'CALENT' + calent,
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
    labelX: x - 25,
    labelY: y,
    bajR: 7 / 24,
  });
  engine.selId = calentId;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine._isGhostSel = false;
  engine.render();
  engine._markDirty();
}

// Tapa la rama "sobrante" de una tee simple existente (teeDirecto/teeSube/teeBaja en un vértice
// accMed interior) con un tapón o llave terminal — la tercera alternativa junto con dibujar de
// verdad un ramal nuevo desde ese punto (ya posible, snapToExisting coincide con cualquier
// vértice genéricamente) o dejarlo como montante pelado. Crea un ramal corto a lo largo de la
// dirección libre (perpendicular) propia de la tee, tapado con el accesorio elegido en su
// extremo lejano — el glifo del accesorio necesita un extremo de ramal real donde renderizarse,
// porque no existe tal cosa como "un tapón sin tubería".
/** Crea un ramal corto tapado con un tapón o llaveTerminal en la dirección de rama libre
 *  (perpendicular) de una tee. @param engine Instancia del motor. @param ramalId El ramal padre
 *  que contiene la tee. @param accMedIdx Índice del vértice accMed. @param accId Id del
 *  accesorio: 'tapon' o 'llaveTerminal'. */
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
  // La misma bisectriz por la que se dibuja el glifo de la tee (el pase accMed de
  // renderRamales.ts) — la rama libre corre perpendicular a ella.
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

/** Crea un símbolo de calentador (agua caliente) nuevo en las coordenadas dadas. @param engine
 *  Instancia del motor. @param px Coordenada X de plano. @param py Coordenada Y de plano. */
export function handleCalentadorDown(engine: IPlanoEngineCore, px: number, py: number): void {
  // El calentador es solo ac/gas. Guardia defensiva: ningún otro camino (arrastre, script, UI
  // vieja) puede crear uno en af ahora que el botón/atajo de af de la barra ya no existen.
  if (engine.activeNet === 'af') {
    engine._emitStatus('El calentador no está disponible en la red AF');
    return;
  }
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

// Canal recolectora (canalón de techo) — un símbolo independiente, mismo patrón de array/sin-
// asociación-a-ramal que contador/calentador, exclusivo de la red 'll' (aguas lluvias). A
// diferencia de toda otra herramienta de glifo puntual, es un RECTÁNGULO dibujado por arrastre:
// el primer clic fija la esquina 1 (_canalStart, mismo patrón clic-mueve-clic de goma que
// _dimStart/_guideStart), una vista previa en vivo sigue al cursor (renderCanalGhost), el
// segundo clic fija la esquina 2 y calcula base/altura desde la distancia real entre las dos
// esquinas (vía pxToM, a la escala de dibujo del plano) — así el rectángulo queda a escala del
// plano desde el momento en que se dibuja, no tecleado después. Una vez creado, todavía puede
// redimensionarse desde sus esquinas (_tryCanalResizeHit en handleMouseDown.ts) o editarse con
// precisión por el menú contextual (CanalMenu). A diferencia del bajante (que agrega su sufijo
// de piso solo al renderizar, porque un bajante puede abarcar pisos), el piso queda incrustado
// en el code/id aquí al crearlo — un canal vive en un solo piso.
/** Maneja un clic con la herramienta de canal activa: fija la esquina 1 en el primer clic y
 *  crea el rectángulo del canal en el segundo. Exclusivo de la red de aguas lluvias (ll).
 *  @param engine Instancia del motor. @param px Coordenada X de plano. @param py Coordenada Y
 *  de plano. */
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
  // Guardia contra un doble-clic accidental en el mismo sitio que produzca un rectángulo
  // degenerado de 0x0.
  if (base < 1 && altura < 1) {
    engine._emitStatus(_statusMsg(engine));
    engine.render();
    return;
  }
  const x = Math.min(s.x, px);
  const y = Math.min(s.y, py);
  // El flujo apunta hacia donde el usuario arrastró el rectángulo (esquina 1 → esquina 2), a lo
  // largo del eje más largo — misma convención de "dirección dibujada" que la flecha de flujo de
  // un ramal.
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

/** Crea un símbolo de red pública (acometida) nuevo en las coordenadas dadas. @param engine
 *  Instancia del motor. @param px Coordenada X de plano. @param py Coordenada Y de plano. */
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
