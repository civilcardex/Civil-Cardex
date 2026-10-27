import { REDES_PRESION, validarTrazoPresion } from './nodos';
import {
  NETS,
  allocNetNumber,
  allocTributaryNumber,
  rootTributarioLabel,
  uniqRamalId,
} from './PlanoState.ts';
import type { PlanoRamal, IPlanoEngineCore } from './PlanoState.ts';
import { _firstSegmentAngle, angleAtHalfLength, detectAccesorioTrigger } from './drawingAngles.ts';
import { DEFAULT_PENDIENTE_PCT } from '../../constants';
import { junctionHasIncomingFlow, junctionHasOutgoingFlow } from '../../utils/flowDirection.ts';
import {
  flipRamalFlow,
  ramalFlowDirectionCheck,
  propagarSanDiametroAguasAbajo,
} from './drawingFlow.ts';
import { _statusMsg, calculateRamalLength } from './ramalMeasure.ts';
import {
  autoSplitJunctionAndSumFlow,
  detectTributaryPadre,
  checkRamalAnglesExcludingConnections,
  puntoEnCaja,
} from './junctionAutoSplit.ts';
import {
  _nextLabel,
  _midpoint,
  maxDiametroLabel,
  ramalDischargeEnd,
  ramalContinuesPast,
  asociarRamalABajantes,
} from './drawingUtils.ts';
import { distToPolyline } from '../shared/geometry';
import { detectarCanalEnExtremos } from './channelAssociation';
import { recortarEnPrimerCruce } from './intersectionTrim.ts';
import { mergeExtensionPorExtremoConFallback } from './finishRamalMergeExtreme.ts';

/** Cierra la tubería que venías dibujando: revisa que sea válida, la crea, parte las uniones en T
 *  que toque y la engancha a los bajantes cercanos. */
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
    const existing = engine.ramales.find((r) => r.id === engine.activeRamal!.id);
    if (existing) {
      const origPts = existing.pts;
      existing.pts = engine.activeRamal.pts;
      existing.totalL = calculateRamalLength(engine.activeRamal.pts, engine);
      // Ítem 2/5: la edición de un ramal existente también puede crear (o romper) uniones — se
      // valida la dirección de flujo ANTES de autoSplit; si la nueva geometría conecta contra la
      // dirección del ramal principal (o un vent llega a una unión reventilado), se restaura la
      // geometría anterior y se aborta, en vez de dejar el ramal editado con una unión inválida.
      if (existing.net === 'san' || existing.net === 'll' || existing.net === 'vent') {
        const flowErr = ramalFlowDirectionCheck(engine, existing, [], 0.5);
        if (flowErr) {
          engine.triggerAlert('Dirección de flujo incorrecta', flowErr);
          existing.pts = origPts;
          existing.totalL = calculateRamalLength(origPts, engine);
          engine.activeRamal = null;
          engine._markDirty();
          engine.render();
          return;
        }
      }
      // Conexión bloqueada (ramal sobre tributario): revertir la edición como el caso de flujo
      // de arriba — el retorno llega sin mutaciones del autoSplit en ese extremo.
      if (autoSplitJunctionAndSumFlow(engine, existing)) {
        existing.pts = origPts;
        existing.totalL = calculateRamalLength(origPts, engine);
        engine.activeRamal = null;
        engine._markDirty();
        engine.render();
        return;
      }
      engine.activeRamal = null;
      engine.selId = existing.id;
      engine._emitSelect(existing);
      engine._emitStatus(_statusMsg(engine));
      engine.render();
      engine._markDirty();
      return;
    }
  }

  // Continuación por LLEGADA a extremo: si un ramal nuevo aterriza exactamente en el
  // extremo de otro ramal existente (misma red), extender ese ramal existente en vez de
  // crear uno nuevo separado — extraído a finishRamalMergeExtremo.ts (try/catch incluido:
  // si el merge lanza por cualquier razón, se cae a la creación normal del ramal).
  if (mergeExtensionPorExtremoConFallback(engine)) return;
  if (!engine.activeRamal) return;

  const def = engine._ramalDefaults || { material: '', diametro: '', pendiente: 0 };
  // El 2" con que nacen los ramales san/vent sin default es un VALOR POR DEFECTO, no una
  // elección: la herencia de diámetro (más abajo) puede mejorarlo con el mayor de los
  // ramales que toca. Un def.diametro explícito del usuario nunca se sobreescribe.
  const diametroBornDefault = !def.diametro;
  const net = NETS.find((n) => n.id === engine.activeRamal!.net);
  const netPfx = net ? net.lbl : 'R';
  const isTrib = engine.tipoTramo === 'tributario';
  // Autodetección de padre prioriza geometría: evita stale RS1 cuando barra quedó en RS1
  const autoPadre = isTrib
    ? detectTributaryPadre(engine, engine.activeRamal!.pts, engine.activeRamal!.net)
    : null;
  const padreId = isTrib ? autoPadre || engine.padreTributario : null;
  const padreObj = padreId ? engine.ramales.find((r) => r.id === padreId) : null;
  const padreLbl = padreId
    ? padreObj?.tipo === 'tributario'
      ? rootTributarioLabel(engine.ramales, padreId)
      : padreObj?.label || padreId
    : '';
  const cnt = isTrib
    ? allocTributaryNumber(engine, padreLbl)
    : allocNetNumber(engine, engine.activeRamal!.net, 'ramal', (n) =>
        engine.ramales.some((r) => r.id === `${netPfx}${n}` || r.label === `${netPfx}${n}`),
      );
  const id = isTrib ? uniqRamalId() : netPfx + cnt;
  // RAMAL DE CANAL (orig. usuario): un extremo del trazo dentro del rect de un canal ll marca
  // el ramal como "sale de canal". La detección va ANTES de derivar ángulo/etiqueta para que,
  // si el canal quedó en la LLEGADA, la polilínea se invierta aquí y TODO lo que sigue (flecha,
  // validación de flujo, asociación a bajante) nazca en orientación canal→bajante.
  let canalOrigenId: string | null = null;
  if (engine.activeRamal!.net === 'll' && !isTrib && engine.activeRamal!.pts.length >= 2) {
    const det = detectarCanalEnExtremos(engine, engine.activeRamal!.pts);
    if (det.canal) {
      canalOrigenId = det.canal.id;
      if (det.voltear) engine.activeRamal!.pts = engine.activeRamal!.pts.slice().reverse();
    }
  }
  const firstAngle = angleAtHalfLength(engine.activeRamal.pts);

  const [midX, midY] = _midpoint(engine.activeRamal.pts);
  const labelX = midX;
  const labelY = midY;

  const r: PlanoRamal = {
    id,
    net: engine.activeRamal!.net,
    tipo: engine.activeRamal!.tipo,
    padre: padreId,
    pts: engine.activeRamal!.pts,
    totalL: calculateRamalLength(engine.activeRamal!.pts, engine),
    label: isTrib && padreId ? `T${cnt}${padreLbl}` : _nextLabel(engine),
    ini: '',
    fin: '',
    piso: String(engine.nivelActual?.n ?? ''),
    dz: '',
    uc: 0,
    nSalidas: 1,
    labelX: labelX,
    labelY: labelY,
    labelAngle: firstAngle,
    material: def.material || '',
    // Ítem usuario (diámetro inicial): todo trazo nace SIN diámetro asignado — solo un
    // default explícito del usuario (def.diametro) o una acción posterior (asignar aparato,
    // herencia de ramales que toca) lo establece. Sin default manda '' (el cierre marca
    // "Diámetros pendientes" hasta asignarlo). EXCEPCIÓN (orig. usuario): la red de
    // ventilación nace en 2" (igual que sus bajantes/montantes) — cuenta como default de
    // regla, no explícito: la herencia aún puede mejorarlo (diametroBornDefault intacto).
    diametro: def.diametro || (engine.activeRamal!.net === 'vent' ? '2"' : ''),
    // Ítem 4: los ramales sanitarios nuevos nacen con pendiente por defecto 2% cuando no se
    // eligió explícitamente otra. El default del selector para san ya trae DEFAULT_PENDIENTE_PCT
    // desde PdfViewer; este fallback cubre el caso de _ramalDefaults ausente o pendiente sin
    // valor (0/null). Otras redes conservan su default.
    pendiente:
      engine.activeRamal!.net === 'san' &&
      (typeof def.pendiente !== 'number' || def.pendiente === 0)
        ? DEFAULT_PENDIENTE_PCT
        : typeof def.pendiente === 'number'
          ? def.pendiente
          : 0,
    bloqueado: true,
    showLength: true,
    showName: true,
    showGuide: true,
    showFlowDir: true,
    showMatDiamPend: true,
  };

  // Validación de dirección de flujo (san/vent/ll): todo ramal que se conecta a otro debe llevar
  // la dirección de flujo del ramal principal — p.ej. si el ramal principal fluye a la derecha,
  // el ramal que se conecta también debe fluir a la derecha (dot(flujoEntrante, flujoPrincipal) >
  // 0). Si el usuario lo dibujó contra la dirección del principal, se bloquea la creación con
  // una alerta en vez de crear en silencio una unión contraflujo. Solo aplica a uniones del
  // mismo grupo de red (san↔vent comparten la subred). El chequeo usa el helper compartido con
  // vectores LOCALES por extremo/ramal tocado (ítem 2, antes usaba el vector global del ramal,
  // que se equivocaba en ramales doblados) e incluye la regla del codo reventilado vent↔san
  // (ítem 5: el vent debe fluir alejándose de la unión).
  const pointOnSegment = (p: number[], a: number[], b: number[], tol: number): boolean => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) return Math.hypot(p[0] - a[0], p[1] - a[1]) < tol;
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
    if (t < 0.02 || t > 0.98) return false;
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    return Math.hypot(p[0] - px, p[1] - py) < tol;
  };
  if (r.net === 'san' || r.net === 'll' || r.net === 'vent') {
    const TOL = 0.5;
    // Item 10: un tributario san/ll/vent se crea apuntando hacia la unión — si el extremo que
    // toca otro ramal quedó en pts[0], se voltea para que la flecha quede mirando a la unión.
    const touchesRamal = (ep: number[]): boolean => {
      for (const other of engine.ramales) {
        if (other.id === r.id || !other.pts || other.pts.length < 2) continue;
        const sameGroup =
          other.net === r.net ||
          ((other.net === 'san' || other.net === 'vent') && (r.net === 'san' || r.net === 'vent'));
        if (!sameGroup) continue;
        const oEps = [other.pts[0], other.pts[other.pts.length - 1]];
        if (oEps.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL)) return true;
        for (let i = 0; i < other.pts.length - 1; i++) {
          if (pointOnSegment(ep, other.pts[i], other.pts[i + 1], TOL)) return true;
        }
      }
      return false;
    };
    // ¿El punto cae sobre el CUERPO (interior de un segmento, no extremo) de otro ramal?
    const onBody = (p: number[]): boolean => {
      for (const other of engine.ramales) {
        if (!other.pts || other.pts.length < 2 || other.id === r.id) continue;
        if (other.net !== r.net) continue;
        for (let i = 0; i < other.pts.length - 1; i++) {
          const [ax, ay] = other.pts[i];
          const [bx, by] = other.pts[i + 1];
          const dx = bx - ax,
            dy = by - ay;
          const lenSq = dx * dx + dy * dy;
          if (lenSq < 0.0001) continue;
          const t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / lenSq;
          if (t < 0.03 || t > 0.97) continue;
          const px = ax + t * dx,
            py = ay + t * dy;
          if (Math.hypot(p[0] - px, p[1] - py) < 0.6) return true;
        }
      }
      return false;
    };
    // ¿El punto toca un ramal SAN (vértice o cuerpo)? Para auto-orientar el vent recién
    // dibujado hacia afuera de la unión reventilado.
    const touchesSan = (ep: number[]): boolean => {
      for (const other of engine.ramales) {
        if (other.net !== 'san' || !other.pts || other.pts.length < 2) continue;
        if (other.pts.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL)) return true;
        for (let i = 0; i < other.pts.length - 1; i++) {
          if (pointOnSegment(ep, other.pts[i], other.pts[i + 1], TOL)) return true;
        }
      }
      return false;
    };
    if (r.tipo === 'tributario' || r.pts.length >= 2) {
      const t0 = touchesRamal(r.pts[0]);
      const t1 = touchesRamal(r.pts[r.pts.length - 1]);
      // Un ramal/tributario que ATERRIZA en el CUERPO de otro ramal (split por cuerpo):
      // san/ll/vent debe fluir HACIA la unión (free→body), af/ac/gas DESDE la unión.
      // Para san, si el inicio toca cuerpo y el fin es libre, invertir para que fluya hacia el cuerpo.
      if (r.net === 'san' || r.net === 'll' || r.net === 'vent') {
        if (r.tipo !== 'tributario' && t0 && !t1 && onBody(r.pts[0])) {
          flipRamalFlow(r);
        }
      } else if (t1 && !t0 && onBody(r.pts[r.pts.length - 1])) {
        flipRamalFlow(r);
      }
      // Tributario SIN auto-voltteo (orig. usuario): se valida igual que un ramal — dibujado
      // en contraria (unión→aparato) dispara "Dirección de flujo incorrecta" y NO se crea.
      // Solo el dibujo aparato→unión (flujo hacia la conexión) pasa.
      // Vent recién dibujado: debe fluir ALEJÁNDOSE del punto sanitario (reventilado). Si el
      // usuario lo dibujó de afuera hacia el san (termina en san, empieza libre), se invierte
      // solo — igual que san/ll se auto-orienta hacia la unión. Sin esto, el trazo conectado
      // disparaba "Dirección de flujo incorrecta" obligando a redibujar. Nunca toca un vent
      // que termina en su propio bajante (stack): ahí terminar es lo correcto.
      if (r.net === 'vent' && r.pts.length >= 2) {
        const pStart = r.pts[0];
        const pEnd = r.pts[r.pts.length - 1];
        const endOnVentBajante = engine.bajantes.some(
          (b) => b.net === 'vent' && Math.hypot(b.x - pEnd[0], b.y - pEnd[1]) < TOL,
        );
        const endOnSanBajante = engine.bajantes.some(
          (b) => b.net === 'san' && Math.hypot(b.x - pEnd[0], b.y - pEnd[1]) < TOL,
        );
        if (!endOnVentBajante && (touchesSan(pEnd) || endOnSanBajante) && !touchesRamal(pStart)) {
          flipRamalFlow(r);
        }
      }
    }
    // Ítem 2/5: chequeo pre-push con el helper compartido (r aún no está en engine.ramales, se
    // pasa como extra). Aborto limpio: sin push, activeRamal = null + alerta.
    // Solo tributarios se auto-orientan al aterrizar en cuerpo — ramales deben validar flujo
    // Tributarios también validan (orig. usuario: T1T3 se creó en contra y pasó): su DESTINO
    // de flujo debe caer en la unión — drenar desde el tronco al aparato = alerta.
    const flowErr = ramalFlowDirectionCheck(engine, r, [r], TOL);
    if (flowErr) {
      engine.triggerAlert('Dirección de flujo incorrecta', flowErr);
      engine.activeRamal = null;
      engine._markDirty();
      engine.render();
      return;
    }
  } else if (REDES_PRESION.has(r.net)) {
    const TOL = 0.5;
    // r todavía no está en engine.ramales, así que se incluye explícitamente junto al array vivo.
    const candidates = [r, ...engine.ramales];
    for (const ep of [r.pts[0], r.pts[r.pts.length - 1]]) {
      if (!junctionHasOutgoingFlow(candidates, r.net, ep, TOL)) {
        engine.triggerAlert(
          'Conexión sin salida',
          'Toda conexión en esta red debe tener al menos un ramal con dirección de flujo saliendo de ella.',
        );
        engine.activeRamal = null;
        engine._markDirty();
        engine.render();
        return;
      }
    }
    // 'Conexión sin entrada' RETIRADA del dibujo (orig. usuario: aparatos con flechas hacia
    // sus extremos = ninguna pieza ENTRA a la T, y el dibujo se rechazaba entero). Queda
    // 'Conexión sin salida' (unión sin NINGUNA salida = inválida de verdad).
    for (const ep of [r.pts[0], r.pts[r.pts.length - 1]]) {
      if (!junctionHasIncomingFlow(candidates, r.net, ep, TOL)) {
        engine._emitStatus(
          'T sin ramal entrante — revisa las direcciones de flujo de los aparatos.',
        );
      }
    }
  }

  engine.ramales.push(r);
  // RECORTE EN EL PRIMER CRUCE (orig. usuario: "recortar siempre el excedente en la
  // intersección, no rechazar"): si el trazo se pasó del punto de unión, se corta JUSTO en el
  // cruce y la unión en T/Y se forma ahí (autoSplitJunctionAndSumFlow hace el resto). Antes el
  // sobrante hacía rechazar el trazo entero ("un tributario no puede cruzar un ramal") o dejaba
  // el cruce sin dividir. Aplica a ramales y tributarios, vengan de dibujo manual o de guía.
  {
    const recorte = recortarEnPrimerCruce(r.pts, engine.ramales, r.net, {
      ignorarIds: [r.id],
      dentroDeCaja: (p) => puntoEnCaja(engine, p, r.net),
    });
    if (recorte.invalido) {
      engine.triggerAlert(
        'Conexión no permitida',
        'El trazo se cruza con otro ramal demasiado cerca de su inicio: conéctalo en un extremo o a mitad del trazo, sin atravesarlo.',
      );
      engine.ramales.pop();
      engine.activeRamal = null;
      engine._markDirty();
      engine.render();
      return;
    }
    if (recorte.cortado) {
      r.pts = recorte.pts;
      r.totalL = +calculateRamalLength(r.pts, engine).toFixed(3);
    }
  }
  // Redes de presión (af/ac/gas/rci): las 3 verificaciones vivas BLOQUEAN el dibujo —
  // si el tramo viola (sale de aparato / entra a fuente / ciclo no declarado), se alerta
  // y NO queda dibujado (patrón pop de los checks de ángulo/cruce de abajo).
  const motivoPresion = validarTrazoPresion(engine, r);
  if (motivoPresion) {
    engine.triggerAlert('Trazo no válido', motivoPresion);
    engine.ramales.pop();
    engine.activeRamal = null;
    engine._markDirty();
    engine.render();
    return;
  }
  // Bug #7: el segmento de CONEXIÓN (extremo que pega a otro ramal existente o a un bajante)
  // tiene el ángulo dictado por la geometría del ramal existente, no por la cuadrícula — no se
  // valida. Validar solo los segmentos libres (los que no tocan nada).
  // Ramal de canal (orig. usuario): sale del canal desde cualquier punto/ángulo — sin
  // validación de ángulo.
  if (!canalOrigenId && !checkRamalAnglesExcludingConnections(engine, r)) {
    engine.triggerAlert(
      'Ángulo no recomendado',
      r.net === 'san' || r.net === 'll'
        ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 0° y 45°. Usar línea guía para ajustar ángulo.'
        : (r.net === 'af' || r.net === 'ac') && r.tipo === 'tributario'
          ? 'Los tributarios de AF/AC solo permiten ángulos de 90°. Usar línea guía para ajustar ángulo.'
          : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
    );
    engine.ramales.pop();
    engine.activeRamal = null;
    engine._markDirty();
    engine.render();
    return;
  }
  // Regla "Los ramales no se conectan a tributarios": autoSplitJunctionAndSumFlow devuelve si la
  // conexión fue bloqueada — aquí se hace cumplir retirando el ramal recién terminado (antes la
  // alerta salía y el ramal quedaba dibujado igualmente).
  if (autoSplitJunctionAndSumFlow(engine, r)) {
    engine.ramales = engine.ramales.filter((x) => x.id !== r.id);
    engine.activeRamal = null;
    engine.render();
    return;
  }
  // Ítem 3 (dibujo manual, unión extremo-con-extremo sin split): el tributario no partió nada
  // — si en su punto de conexión NACE otro ramal (el tramo autocreado aguas abajo), ese es su
  // padre real, no el tramo aguas arriba que detectTributaryPadre eligió por cercanía. Misma
  // regla que buildTribFromGuide para guías; el split a mitad de cuerpo ya lo resolvió
  // junctionAutoSplit (incoming.padre = downstream).
  if (r.tipo === 'tributario' && r.padre && r.pts.length >= 2) {
    const TOL_EP = 0.5;
    const sameGroup = (a: string, b: string) =>
      a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
    const splitHappened = engine.ramales.some((x) => x.mergesFrom && x.mergesFrom[1] === r.id);
    if (!splitHappened) {
      const padre = engine.ramales.find((x) => x.id === r.padre);
      const eps = [r.pts[0], r.pts[r.pts.length - 1]];
      const connPt = padre
        ? eps.find(
            (e) =>
              (padre.pts || []).some((p) => Math.hypot(p[0] - e[0], p[1] - e[1]) < TOL_EP) ||
              distToPolyline(e, padre.pts || []) < TOL_EP,
          )
        : undefined;
      if (connPt) {
        const receptor = engine.ramales.find(
          (x) =>
            x.id !== r.id &&
            x.id !== r.padre &&
            x.tipo !== 'tributario' &&
            sameGroup(x.net, r.net) &&
            !!x.pts &&
            x.pts.length >= 2 &&
            Math.hypot(x.pts[0][0] - connPt[0], x.pts[0][1] - connPt[1]) < TOL_EP,
        );
        if (receptor) {
          const recLbl = receptor.label || receptor.id;
          r.padre = receptor.id;
          r.label = `T${allocTributaryNumber(engine, recLbl)}${recLbl}`;
        }
      }
    }
  }
  // Asocia el ramal con un bajante si alguno de sus extremos cae en el centro del bajante:
  // la LLEGADA (último punto) escribe fin + recibeDeIds; el INICIO (pts[0], permitido por
  // pedido explícito del usuario) escribe ini + alimentaIds — el bajante entrega flujo a ese
  // trazo. handleLineDown ya no bloquea iniciar ahí; el snap ancla el clic al centro.
  // Un fantasma desplazado se empareja contra su propia posición desplazada del piso actual;
  // un fantasma sin desplazar o un bajante real emparejan en su (b.x, b.y) simple.
  // Asociación a bajantes (llegada/salida + diámetros + Y doble): compartida con las
  // creaciones desde línea guía (ver asociarRamalABajantes en drawingUtils).
  let llegaACaja = false;
  // Marcar ANTES de asociar: la exención del tope de 2 asociaciones (bajanteRules) lee
  // r.esCanalId al validar la llegada del ramal de canal.
  if (canalOrigenId) r.esCanalId = canalOrigenId;
  {
    const assoc = asociarRamalABajantes(engine, r, diametroBornDefault);
    llegaACaja = assoc.llegaACaja;
    if (assoc.alert) engine.triggerAlert(assoc.alert.title, assoc.alert.msg);
    if (assoc.rejected) {
      engine.ramales = engine.ramales.filter((x) => x.id !== r.id);
      engine.activeRamal = null;
      engine.render();
      return;
    }
  }
  // Ramal de canal confirmado: codo 90° baja en la salida del canal (glifo + conteo en
  // accesorios). Pendiente y diámetro por defecto 2 (2% / 2") — ambos editables desde el
  // menú del ramal (orig. usuario: sin nombre, solo Longitud/Pendiente/Diámetro).
  if (canalOrigenId) {
    r.esCanalId = canalOrigenId;
    r.accesorioInicio = 'codo90rmBaja';
    r.pendiente = 2;
    if (!r.diametro) r.diametro = '2"';
  }
  // Llegada al CENTRO de una caja: SIN propagación de diámetros (ni herencia ramal-ramal ni
  // propagarSanDiametroAguasAbajo) — orig. usuario. SIN return temprano: el tail (activeRamal
  // = null, selId, markDirty, modal) DEBE correr o el Enter "no termina" el trazo.
  if (!llegaACaja) {
    // Herencia de diámetro DIRECCIONAL: un ramal/tributario NUEVO sin diámetro SOLO adopta
    // de sus ALIMENTADORES (ramales cuya descarga cae sobre él) y solo empuja el suyo a sus
    // RECEPTORES. El máximo ciego en ambas direcciones creaba 4"/2" fantasma en trazos que
    // ENTREGAN (el usuario pide nacer vacío) y lo empujaba de vuelta al alimentador pequeño.
    // Tras borrar un segmento del brazo de una yee doble y redibujarlo, la pieza
    // nueva nacía sin diámetro y disparaba "Diámetros pendientes" (orig. usuario) — ese caso
    // es receptor y sigue heredando. Nunca sobreescribe un diámetro explícito.
    if (r.pts && r.pts.length >= 2) {
      const epsD = [r.pts[0], r.pts[r.pts.length - 1]];
      const TOL_D = 2.0;
      const touching = engine.ramales.filter(
        (o) =>
          o.id !== r.id &&
          o.net === r.net &&
          o.pts &&
          o.pts.length >= 2 &&
          (o.pts.some((p) => epsD.some((e) => Math.hypot(p[0] - e[0], p[1] - e[1]) < TOL_D)) ||
            epsD.some((e) => distToPolyline(e, o.pts) < TOL_D)),
      );
      const feeders = touching.filter((o) => {
        const d = ramalDischargeEnd(o);
        return !!d && distToPolyline(d, r.pts) < TOL_D && ramalContinuesPast(r, d, TOL_D);
      });
      if (!r.diametro || diametroBornDefault) {
        let inherited = r.diametro || '';
        for (const o of feeders)
          if (o.diametro) inherited = maxDiametroLabel(inherited, o.diametro);
        if (inherited && inherited !== r.diametro) r.diametro = inherited;
      }
      if (r.diametro) {
        const rd = ramalDischargeEnd(r);
        for (const o of touching) {
          if (o.diametro || feeders.includes(o) || !rd) continue;
          // Solo receptores: el trazo empuja a quien recibe de él (y continúa), nunca de
          // vuelta al que lo alimenta.
          if (distToPolyline(rd, o.pts) < TOL_D && ramalContinuesPast(o, rd, TOL_D))
            o.diametro = r.diametro;
        }
      }
      // San: el trazo nuevo (o el diámetro que heredó) propaga el mayor aguas abajo — la cadena
      // receptora (ramales y tributarios) se ajusta al mayor de sus llegadores (orig. usuario).
      if (r.net === 'san' || r.net === 'll')
        propagarSanDiametroAguasAbajo(engine.ramales, r.id, engine.bajantes);
    }
  }
  // Correr _markDirty ANTES de revisar el modal para que autoDetectRamalConnections tenga
  // oportunidad de detectar cualquier unión nueva que el usuario acaba de crear al terminar
  // el ramal.
  engine.activeRamal = null;
  engine.selId = r.id;
  engine._emitSelect(r);
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();

  // AF/AC/gas: detectar codos/tees en cambios de ángulo, cruces perpendiculares y uniones
  // formadas con otro ramal dibujado por separado — compartido con handleDragUp para que un
  // arrastre pueda disparar el mismo modal cuando crea una de estas uniones. Las uniones de
  // san/ll/vent se auto-crean vía calcSanitaryAccessories + renderJunctions — sin modal.
  if ((r.net === 'af' || r.net === 'ac' || r.net === 'gas') && engine.triggerAccesorioModal) {
    const trigger = detectAccesorioTrigger(engine, r.id);
    if (trigger) engine.triggerAccesorioModal(trigger);
  }
}

/** Revisa que el trazo nuevo no atraviese otra tubería: en san (Sanitaria) y ll (Lluvias) solo se
 *  permite tocar a 45° (un cruce de frente no es una conexión válida). */
export function checkCrossRamalAngle(
  engine: IPlanoEngineCore,
  pA: number[],
  pB: number[],
  skipId: string,
): boolean {
  for (const r of engine.ramales) {
    if (r.id === skipId || !r.pts || r.pts.length < 2) continue;
    const netId = r.net || engine.activeNet;
    // Aterrizar en una caja no es una tee con los trazos vecinos: solo entran a la misma
    // caja, no se conectan entre sí (orig. usuario) — sin validación de ángulo de llegada.
    if (puntoEnCaja(engine, pB, netId)) continue;
    const isSanOrLl = netId === 'san' || netId === 'll';
    const isAfAc = netId === 'af' || netId === 'ac';
    for (let si = 0; si < r.pts.length - 1; si++) {
      const [ax, ay] = r.pts[si],
        [bx, by] = r.pts[si + 1];
      const segLen = Math.hypot(bx - ax, by - ay);
      if (segLen < 0.1) continue;
      const t = ((pB[0] - ax) * (bx - ax) + (pB[1] - ay) * (by - ay)) / (segLen * segLen);
      if (t >= 0 && t <= 1) {
        const projDist = Math.abs((bx - ax) * (ay - pB[1]) - (by - ay) * (ax - pB[0])) / segLen;
        if (projDist < 0.5) {
          const a1 = (Math.atan2(pB[1] - pA[1], pB[0] - pA[0]) * 180) / Math.PI;
          const a2 = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
          let diff = Math.abs(a2 - a1) % 360;
          if (diff > 180) diff = 360 - diff;
          const internalAngle = 180 - diff;
          let isAllowed = false;
          if (isSanOrLl) {
            isAllowed =
              diff <= 46 || diff >= 134 || Math.abs(diff - 45) <= 10 || Math.abs(diff - 135) <= 10;
          } else if (isAfAc) {
            // AF/AC solo forma una tee (90°) en una unión — nada de fusiones estilo yee de 45°,
            // por pedido explícito. Misma tolerancia que usa la detección isTee de
            // renderJunctions.ts.
            isAllowed = Math.abs(internalAngle - 90) <= 15;
          } else {
            isAllowed = internalAngle >= 50;
          }
          if (!isAllowed) {
            engine.triggerAlert(
              'Ángulo no recomendado',
              isSanOrLl
                ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.'
                : isAfAc
                  ? 'Las redes de agua caliente o agua fria no permiten uniones de 45° entre trazos. Usar línea guía para ajustar ángulo.'
                  : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
            );
            return false;
          }
        }
      }
    }
  }
  return true;
}
