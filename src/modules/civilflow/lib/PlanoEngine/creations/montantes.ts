import { MONTANTE_NETS } from './cajaBajante';
// Creación de montantes (gas/ac/af), calentadores y stubs de tee a mitad de cuerpo.
import { NETS } from '../PlanoState.ts';
import type { IPlanoEngineCore } from '../PlanoState.ts';
import { calculateRamalLength, _statusMsg } from '../ramalMeasure.ts';
import { maxDiametroLabel } from '../PlanoEngineDrawing.ts';
import { flowEndsAt, flowStartsAt } from '../flowChecks.ts';

// El bajante solo pertenece a san/vent/ll, el montante solo a gas/ac/af — misma regla que
// aplican la barra de herramientas (isToolDisabledForNet en PdfViewerToolbar.tsx) y los atajos
// de teclado (PlanoEngine.ts _onKeyDownHandler); se re-chequea aquí como defensa en
// profundidad por si algún otro caller llega a estas funciones sin pasar por ninguna de esas
// compuertas.
/** Crea un montante (la tubería vertical que SUBE entre pisos: MAF, MAC, MG...) donde hiciste clic
 *  y lo engancha a las tuberías cercanas, marcando el codo por donde entrega el agua. */
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
  // Ítems 12/13 + detección automática (orig. usuario): el codo y la dirección del montante se
  // eligen según la DIRECCIÓN del ramal en el punto de conexión — si el flujo SALE del extremo
  // (cola de flecha) el montante RECIBE del ramal → codo90rmSube y dirección 'sube'; si el
  // flujo LLEGA al extremo el montante ENTREGA → codo90rmBaja y dirección 'baja'. La creación
  // ya no se rechaza por polaridad contradictoria.
  const TOL = 0.5;
  const codoPorRamal = new Map<string, string>();
  let direccionDetectada: 'sube' | 'baja' | null = null;
  for (const rid of assocRamales) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (!r || !r.pts || r.pts.length < 2) continue;
    const sube = flowStartsAt(r, [px, py], TOL);
    const baja = !sube && flowEndsAt(r, [px, py], TOL);
    // Ni sube ni baja (geometría ambigua): el default del codo es sube, como siempre fue.
    codoPorRamal.set(rid, baja ? 'codo90rmBaja' : 'codo90rmSube');
    if (!direccionDetectada && (sube || baja)) direccionDetectada = sube ? 'sube' : 'baja';
  }
  let defDNominal = '';
  for (const rid of assocRamales) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (r && r.diametro) defDNominal = maxDiametroLabel(defDNominal, r.diametro);
  }
  // Item 3: montante de ventilación nuevo → 2" por defecto si no hay ramal que lo defina.
  if (engine.activeNet === 'vent' && !defDNominal) defDNominal = '2"';
  engine.bajantes.push({
    id: monId,
    net: engine.activeNet,
    tipo: 'montante',
    code: code,
    // Dirección AUTO-DETECTADA del ramal al que se conectó (sube = el ramal le entrega,
    // baja = el montante le entrega al ramal); sin conexión sigue sin dirección y el
    // usuario la elige en BajanteDirectionSelector.
    direccion: direccionDetectada ?? undefined,
    x: px,
    y: py,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: defDNominal,
    recibeDeIds: assocRamales,
    alimentaIds: [],
    // Auto-asociado estable: sin asocManual la poda/autodetección desmarcaba los
    // checkboxes al siguiente _markDirty (orig. usuario: crear montante en extremo).
    asocManual: [...assocRamales],
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
  // un extremo siempre implica, con la VARIANTE detectada por ramal (sube/baja según la
  // dirección del flujo en el extremo), con diámetro igualado al ramal donde cae.
  for (const rid of assocRamales) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (!r || !r.pts) continue;
    const codoAccId = codoPorRamal.get(rid) || 'codo90rmSube';
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
/** Pone un montante justo en el medio de una tubería de af (Agua Frío) o ac (Agua Caliente),
 *  partiéndola con una T. */
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
  // (drawingElementContextMenu/index.tsx).
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
    dNominal: r.diametro || '',
    recibeDeIds: [r.id],
    alimentaIds: [],
    asocManual: [r.id],
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
/** Inserta un calentador en una tubería de af (Agua Frío): se corta el tramo y de ahí nace la
 *  tubería de ac (Agua Caliente) que reparte el agua ya calentada. */
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
/** Crea un calentador en ac (Agua Caliente) o gas (Gas). En af (Agua Frío) no existe: el agua
 *  fría se calienta DENTRO del equipo. */
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
