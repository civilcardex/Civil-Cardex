import { NETS } from './PlanoState';
import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from './PlanoState';
import { calculateRamalLength, _statusMsg } from './ramalMeasure';
import { pisoCorto, pisoCortoLoose } from '../../constants';
import { resolveAndClampToCanal } from './canalAssociation';
import {
  geometriaCanalDesdePuntos,
  geometriaCanalAncho,
  normalizarCanal,
  pxPerCmDe,
  esquinasCanalOBB,
  canalMarco,
  puntoAnchoMinimo,
  CANAL_ANCHO_MIN_CM,
} from './canalAssociation';
import { distToPolyline } from '../shared/geometry';
import { codoPolarityOk, maxDiametroLabel } from './PlanoEngineDrawing';
import { angleAtHalfLength } from './drawingAngles';

// El bajante solo pertenece a san/vent/ll, el montante solo a gas/ac/af — misma regla que
// aplican la barra de herramientas (isToolDisabledForNet en PdfViewerToolbar.tsx) y los atajos
// de teclado (PlanoEngine.ts _onKeyDownHandler); se re-chequea aquí como defensa en
// profundidad por si algún otro caller llega a estas funciones sin pasar por ninguna de esas
// compuertas.
export const BAJANTE_NETS = ['san', 'vent', 'll'];
export const MONTANTE_NETS = ['gas', 'ac', 'af'];
// Cajas de recolección (cuadrado con cuadrado interior): CAN en sanitaria, CALL en lluvias.
export const CAJA_NETS = ['san', 'll'];

/** Crea una Caja de aguas negras (san) o de aguas lluvias (ll) en el punto del clic — un solo
 *  clic la coloca (como contador). Es un nodo real de conexión: los trazos terminados sobre
 *  ella se asocian vía finishRamal→recibeDeIds (máximo 1 ramal por caja, ver bajanteRules). */
export function handleCajaDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!CAJA_NETS.includes(engine.activeNet)) return;
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  const codePfx = engine.activeNet === 'san' ? 'CAN' : 'CALL';
  const cnt =
    engine.bajantes.filter(
      (b) => (b.tipo === 'caja_san' || b.tipo === 'caja_ll') && b.net === engine.activeNet,
    ).length + 1;
  const cajaId = codePfx + cnt;
  engine.bajantes.push({
    id: cajaId,
    net: engine.activeNet,
    tipo: engine.activeNet === 'san' ? 'caja_san' : 'caja_ll',
    code: cajaId,
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
  engine.selId = cajaId;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine.render();
  engine._markDirty();
}

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
    // Tributarios ni llegan ni salen de un bajante (orig. usuario) — solo ramales se asocian.
    if (r.tipo === 'tributario') continue;
    const startDist = Math.hypot(px - r.pts[0][0], py - r.pts[0][1]);
    const li = r.pts.length - 1;
    const endDist = Math.hypot(px - r.pts[li][0], py - r.pts[li][1]);
    if (endDist < ASSOC_THRESH && endDist <= startDist) {
      px = r.pts[li][0];
      py = r.pts[li][1];
      if (assocRamales.length >= 2) {
        engine.triggerAlert(
          'Bajante completo',
          'Este bajante ya tiene 2 ramales conectados (máximo permitido).',
        );
      } else assocRamales.push(r.id);
    } else if (startDist < ASSOC_THRESH) {
      px = r.pts[0][0];
      py = r.pts[0][1];
      if (assocRamales.length >= 2) {
        engine.triggerAlert(
          'Bajante completo',
          'Este bajante ya tiene 2 ramales conectados (máximo permitido).',
        );
      } else assocRamales.push(r.id);
    }
  }
  // Regla de negocio: dentro de un canal recolectora solo caben bajantes de aguas lluvias (ll).
  // Si se intenta crear un bajante de otra red dentro de un canal, se aborta la creación con
  // una alerta modal — el canal es una canaleta de aguas lluvias y las otras redes no se pueden
  // hacer pasar por dentro. Se revisa DESPUÉS de la asociación con ramales porque ella puede
  // desplazar el punto final del bajante hacia el extremo de un ramal.
  if (engine.activeNet !== 'll') {
    const inside = resolveAndClampToCanal(engine, px, py);
    if (inside.canalId) {
      engine.triggerAlert(
        'Bajante dentro de canal',
        `Los bajantes dentro de un canal recolectora deben ser de aguas lluvias (ll). El bajante de la red ${engine.activeNet.toUpperCase()} no se puede crear dentro del canal.`,
      );
      return;
    }
  }
  // (orig. usuario) YA NO hay auto-asociación canal↔bajante al soltar: la asociación vive en
  // los ramales que el usuario dibuja del canal al bajante. El bajante queda donde cae.
  const canalId: string | null = null;
  const net = NETS.find((n) => n.id === engine.activeNet);
  const netPfx = net ? net.bmPfx : 'BAJ';
  // PUNTO 9 (orig. usuario): MENOR NÚMERO LIBRE sobre ids existentes — borrar BAN-2 de
  // {1,2,3} reutiliza el 2 (antes count+1 generaba huecos y duplicados tras borrar).
  const usedNums = new Set<number>(
    engine.bajantes
      .filter((b) => b.tipo === 'bajante' && b.net === engine.activeNet)
      .map((b) => {
        const mm = /(\d+)\s*$/.exec(b.id || '');
        return mm ? parseInt(mm[1], 10) : NaN;
      })
      .filter((n) => Number.isFinite(n)),
  );
  let cnt = 1;
  while (usedNums.has(cnt)) cnt++;
  const bajId = netPfx + cnt;
  // Ítem: el bajante toma por defecto el diámetro del ramal conectado (el mayor de los
  // asociados) y no puede bajarse de ahí — ver la validación en bajanteMenu.tsx.
  // Soltado sobre el CUERPO de un ramal (lejos de sus extremos) también adopta su diámetro
  // (orig. usuario: "viceversa según como se dibuje") — sin asociación, solo diámetro.
  let defDNominal = '';
  for (const rid of assocRamales) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (r && r.diametro) defDNominal = maxDiametroLabel(defDNominal, r.diametro);
  }
  if (!defDNominal) {
    for (const r of engine.ramales) {
      if (r.net !== engine.activeNet || r.tipo === 'tributario') continue;
      if (!r.pts || r.pts.length < 2 || !r.diametro) continue;
      if (distToPolyline([px, py], r.pts) < ASSOC_THRESH) {
        defDNominal = r.diametro;
        break;
      }
    }
  }
  // Item 3: bajante de ventilación nuevo → 2" por defecto si no hay ramal que lo defina.
  if (engine.activeNet === 'vent' && !defDNominal) defDNominal = '2"';
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
    dNominal: defDNominal,
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
  for (const rid of assocRamales) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (!r || !r.pts) continue;
    const distStart = Math.hypot(r.pts[0][0] - px, r.pts[0][1] - py);
    const lastIdx = r.pts.length - 1;
    const distEnd = Math.hypot(r.pts[lastIdx][0] - px, r.pts[lastIdx][1] - py);
    const epIdx: 0 | number = distStart <= distEnd ? 0 : lastIdx;
    if (epIdx === 0) {
      r.ini = bajId;
    } else {
      r.fin = bajId;
    }
    // PUNTO 6 (orig. usuario): la etiqueta del ramal queda PARALELA al trazo — el ángulo se
    // fija a la mitad de longitud (el default 0 lo dejaba horizontal en ramales diagonales).
    if (!r.labelMoved) {
      r.labelAngle = angleAtHalfLength(r.pts);
      const mid = r.pts[Math.floor(r.pts.length / 2)];
      r.labelX = r.labelX || mid[0];
      r.labelY = r.labelY || mid[1];
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
  // Ítems 12/13: el montante escribe codo90rmSube en el extremo del ramal asociado — ese codo
  // ENTREGA flujo (la cola de la flecha apunta al extremo: el flujo SALE de P hacia el montante).
  // Si el punto cae en el FINAL del flujo (el montante recibiría del ramal), la polaridad es
  // contradictoria: se rechaza la creación con alerta en vez de escribir un codo incoherente
  // con la flecha.
  if (assocRamales.length > 0) {
    const TOL = 0.5;
    for (const rid of assocRamales) {
      const r = engine.ramales.find((rr) => rr.id === rid);
      if (!r || !r.pts || r.pts.length < 2) continue;
      if (!codoPolarityOk(r, [px, py], 'codo90rmSube', TOL)) {
        engine.triggerAlert(
          'Polaridad de codo incorrecta',
          'El codo 90° sube del montante exige que la cola de la flecha apunte al extremo (el flujo debe salir de ahí hacia el montante). Coloca el montante en el extremo inicial del ramal, o invierte la dirección del ramal.',
        );
        return;
      }
    }
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
    // Sin dirección por defecto — el usuario debe elegir Sube/Baja/Continua
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
    dNominal: r.diametro || '',
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
// diferencia de toda otra herramienta de glifo puntual, es un RECTÁNGULO dibujado por clics:
// el primer clic fija el inicio del EJE (_canalStart, mismo patrón clic-mueve-clic de goma que
// _dimStart/_guideStart), una vista previa en vivo sigue al cursor (renderCanalGhost), el
// segundo clic fija el EXTREMO del eje — para TODA orientación (orig. usuario: horizontal y
// vertical funcionan igual que la diagonal; el eje queda ajustado al cardinal si el trazo roza
// ≤15°) — y el tercer clic define el ANCHO perpendicular al eje (geometriaCanalAncho; un punto
// que proyecta más allá del extremo lo alarga). Así el canal queda a escala del plano desde el
// momento en que se dibuja y el ancho nunca sale "de casualidad" del arrastre. Una vez creado,
// todavía puede redimensionarse desde sus esquinas (_tryCanalResizeHit en handleMouseDown.ts) o
// editarse con precisión por el menú contextual (CanalMenu). A diferencia del bajante (que
// agrega su sufijo de piso solo al renderizar, porque un bajante puede abarcar pisos), el piso
// queda incrustado en el code/id aquí al crearlo — un canal vive en un solo piso.
/** Timestamp del clic que fijó _canalEje (module-scope: los campos _canal* viven en
 *  PlanoState/PlanoEngine, fuera del alcance de este cambio) — detecta el doble-clic. */
let canalEjeTs = 0;
/** Maneja un clic con la herramienta de canal activa: el 1er clic fija el inicio del eje, el
 *  2º fija su extremo (siempre modo eje, también horizontal/vertical — orig. usuario) y el
 *  3er clic define el ancho (commitCanalAncho). Exclusivo de la red de aguas lluvias (ll).
 *  @param engine Instancia del motor. @param px Coordenada X de plano. @param py Coordenada Y
 *  de plano. */
export function handleCanalDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!engine.activeNetworks || !engine.activeNetworks.has('recolectora')) {
    engine._emitStatus('Canal no disponible — activa la red canal recolectora');
    return;
  }
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  // Fase de ancho: el eje ya quedó fijo con el 2º clic — este clic define el ancho.
  if (engine._canalEje) {
    // Doble-clic de término (orig. usuario): el 2º clic del dblclick cae en fase-ancho con
    // dist≈0 — si llega <350 ms tras fijar el eje se ignora (no infla a 20 cm ni crea).
    if (Date.now() - canalEjeTs < 350) return;
    commitCanalAncho(engine, px, py);
    return;
  }
  if (!engine._canalStart) {
    engine._canalStart = { x: px, y: py };
    engine._emitStatus('Canal — clic fija el eje, luego el ancho');
    engine.render();
    return;
  }
  const s = engine._canalStart;
  engine._canalStart = null;
  // Geometría compartida con el ghost (eje + ancho para toda orientación): el eje queda
  // ajustado al cardinal si el trazo roza ≤15° y normalizado a base-corta al crear (ítem 5).
  const g = geometriaCanalDesdePuntos(s, { x: px, y: py }, (d) => engine.pxToM(d));
  if (!g) {
    engine._emitStatus(_statusMsg(engine));
    engine.render();
    return;
  }
  // El ancho NO sale del arrastre: fija el eje y espera el siguiente clic (WYSIWYG en ghost).
  engine._canalEje = { x1: s.x, y1: s.y, x2: g.p2.x, y2: g.p2.y };
  canalEjeTs = Date.now();
  engine._emitStatus(
    'Canal — clic define el ancho (más allá del extremo del eje lo alarga; Enter commitea)',
  );
  engine.render();
}

/** Commitea la fase de ancho del canal en diagonal (3er clic o Enter): ancho = distancia
 *  perpendicular del punto al eje. Un punto que proyecta más allá del extremo del eje lo
 *  alarga (geometriaCanalAncho). @param engine Instancia del motor. @param px/py Punto de
 *  plano que define el ancho. */
export function commitCanalAncho(engine: IPlanoEngineCore, px: number, py: number): void {
  const eje = engine._canalEje;
  engine._canalEje = null;
  if (!eje) {
    engine.render();
    return;
  }
  // Guardarraíl del "1 cm" (orig. usuario): un clic a <6 px del eje (doble-clic de término,
  // jitter) es accidental — puntoAnchoMinimo respeta su lado pero lo aleja perpendicular al
  // mismo pie de proyección hasta el ancho mínimo (MISMA matemática que el ghost — WYSIWYG).
  const crudo = { x: px, y: py };
  const ajust = puntoAnchoMinimo(eje, crudo, engine.cmToPlanePx(1));
  if (ajust !== crudo) {
    px = ajust.x;
    py = ajust.y;
    engine._emitStatus(
      `Canal — ancho mínimo ${CANAL_ANCHO_MIN_CM} cm (clic más lejos del eje para otro ancho)`,
    );
  }
  const g = geometriaCanalAncho(
    eje,
    { x: px, y: py },
    (d) => engine.pxToM(d),
    engine.cmToPlanePx(1),
  );
  if (!g) {
    engine._emitStatus(_statusMsg(engine));
    engine.render();
    return;
  }
  crearCanalGlifo(engine, {
    x: g.x,
    y: g.y,
    longitud: g.longitudCm,
    base: g.baseCm,
    angulo: g.angulo,
    flujo: g.flujo,
  });
}

/** Crea el glifo de canal con geometría ya normalizada (base-corta): allocator único,
 *  etiqueta bajo el AABB, selección y snapshot. @param engine Instancia del motor.
 *  @param geo Marco en cm/grados + sentido de flujo. */
function crearCanalGlifo(
  engine: IPlanoEngineCore,
  geo: {
    x: number;
    y: number;
    longitud: number;
    base: number;
    angulo: number;
    flujo: 'derecha' | 'izquierda' | 'abajo' | 'arriba';
  },
): void {
  const marco = { x: geo.x, y: geo.y, longitud: geo.longitud, base: geo.base, angulo: geo.angulo };
  normalizarCanal(pxPerCmDe(engine), marco);
  const base = marco.base || 0;
  const longitud = marco.longitud || 0;
  const altura = 20;
  const x = marco.x;
  const y = marco.y;
  const canalFlowDir = geo.flujo;
  // Consecutivo único: max+1 sobre CNL/CALL existentes (length+1 reutilizaba el número del
  // canal borrado y duplicaba id=code — ítem 6 usuario).
  let maxN = 0;
  for (const bb of engine.bajantes) {
    if (bb.tipo !== 'canal') continue;
    const m = /(?:CNL|CALL)(\d+)/.exec(bb.code || bb.id || '');
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  // El prefijo CALL quedó reservado para las cajas de aguas lluvias (caja_ll); los canales
  // recolectores usan CNL{n}-P{n} (migración de códigos viejos en PlanoPersistence).
  const code = `CNL${maxN + 1}-${pisoCortoLoose(engine.nivelActual?.n ?? 0)}`;
  // Etiqueta bajo el AABB del OBB (válido también en diagonal).
  const _mLbl = canalMarco(engine.cmToPlanePx(1), { x, y, longitud, base, angulo: marco.angulo });
  const _csLbl = esquinasCanalOBB(_mLbl);
  const _cxLbl = _csLbl.reduce((a, c) => a + c.x, 0) / 4;
  const _maxYLbl = Math.max(..._csLbl.map((c) => c.y));
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
    labelX: _cxLbl,
    labelY: _maxYLbl + 20,
    bajR: 7 / 24,
    base,
    altura,
    longitud,
    angulo: marco.angulo,
    // Pendiente default del canal (misma que la tabla de chequeo): manda el dibujo
    // (ítem 7 usuario) — editable desde menú contextual y panel derecho.
    pendiente: 2,
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

/** Crea un contador (medidor) en las coordenadas dadas y lo conecta automáticamente a la
 *  red pública más cercana con un ramal, si existe alguna. @param engine Núcleo del motor.
 *  @param px Coordenada X de plano. @param py Coordenada Y de plano. */
/** Crea un contador (medidor) en las coordenadas dadas y lo conecta automáticamente a la
 *  red pública más cercana con un ramal, si existe alguna. @param engine Núcleo del motor.
 *  @param px Coordenada X de plano. @param py Coordenada Y de plano. */
export function handleContadorDown(engine: IPlanoEngineCore, px: number, py: number): void {
  // Guard de red (defensa en profundidad — el atajo/botón ya filtran): un contador insertado
  // en san/ll/vent contaminaba las tablas hidráulicas con CNTAF fantasma.
  if (!['af', 'gas'].includes(engine.activeNet)) return;
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

/** Crea la BOMBA asociada a una caja (AN/LL): círculo punteado a la derecha del símbolo,
 *  código BOMAN-<nivel> único, vinculada permanentemente por `cajaOrigenId` — una bomba por
 *  caja (orig. usuario). Un snapshot de historial por creación. */
export function handleCreateBomba(engine: IPlanoEngineCore, caja: PlanoBajante): void {
  if (caja.tipo !== 'caja_san' && caja.tipo !== 'caja_ll') return;
  // Una bomba por CAJA (por piso puede haber varias — cálculos por bomba, orig. usuario).
  const existente = engine.bajantes.find((b) => b.tipo === 'bomba' && b.cajaOrigenId === caja.id);
  if (existente) {
    engine.triggerAlert(
      'La caja ya tiene bomba',
      `Esta caja ya tiene la bomba ${existente.code || existente.id} asociada.`,
    );
    return;
  }
  // Código único BOMAN<consecutivo>-<piso> (orig. usuario): el consecutivo cuenta las bombas
  // ya creadas en el piso cargado; unicidad garantizada contra los códigos vivos.
  const nivelN = Number(engine.nivelActual?.n ?? 0);
  const consec = engine.bajantes.filter((b) => b.tipo === 'bomba').length + 1;
  const base = `BOMAN${consec}-${pisoCorto(nivelN) || 'P0'}`;
  let code = base;
  let n = 2;
  const codes = new Set(engine.bajantes.map((b) => b.code || b.id));
  while (codes.has(code)) {
    code = `${base}-${n}`;
    n++;
  }
  // Posición: a la DERECHA del símbolo de la caja (semilado caja + radio bomba + margen).
  const cajaHalf = engine.realMmToCanvasPx(1000) / 2 / (engine.zoom || 1);
  const bombaR = engine.realMmToCanvasPx(350) / 4 / (engine.zoom || 1);
  const x = caja.x + cajaHalf + bombaR + cajaHalf * 0.3;
  {
    const bomba: PlanoBajante = {
      id: code,
      net: caja.net,
      tipo: 'bomba',
      code,
      x,
      y: caja.y,
      direccion: 'sube',
      pisoBase: engine.nivelActual?.label ?? '',
      pisoCima: engine.nivelActual?.label ?? '',
      nptBase: engine.nivelActual?.npt ?? 0,
      nptCima: engine.nivelActual?.npt ?? 0,
      hVert: 0,
      dNominal: '',
      recibeDeIds: [],
      alimentaIds: [],
      descargaEnId: null,
      cajaOrigenId: caja.id,
      ucAcum: 0,
      ucExtra: 0,
      area_m2: 0,
      desplazamientos: {},
      lblOffX: 0,
      lblOffY: 0,
      labelAngle: 0,
      labelX: x,
      labelY: caja.y + 20,
      bajR: 7 / 24,
    };
    engine.bajantes.push(bomba);
    engine.selId = code;
    engine._isGhostSel = false;
    engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
    engine.render();
    engine._markDirty();
  }
}
