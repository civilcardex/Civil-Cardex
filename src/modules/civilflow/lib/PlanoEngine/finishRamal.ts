import {
  NETS,
  allocNetNumber,
  allocTributaryNumber,
  rootTributarioLabel,
  relabelTribChain,
  uniqRamalId,
} from './PlanoState';
import type { PlanoRamal, PlanoBajante, IPlanoEngineCore } from './PlanoState';
import { devError } from '../../../../utils/devError';
import { _firstSegmentAngle, angleAtHalfLength, detectAccesorioTrigger } from './drawingAngles';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { DEFAULT_PENDIENTE_PCT } from '../../constants';
import { puedeConectarRamalABajante, esCaja } from './bajanteRules';
import { junctionHasIncomingFlow, junctionHasOutgoingFlow } from '../../utils/flowDirection';
import {
  flipRamalFlow,
  ramalFlowDirectionCheck,
  propagarSanDiametroAguasAbajo,
} from './drawingFlow';
import { _statusMsg, calculateRamalLength } from './ramalMeasure';
import {
  autoSplitJunctionAndSumFlow,
  detectTributaryPadre,
  checkRamalAnglesExcludingConnections,
} from './junctionAutoSplit';
import {
  _nextLabel,
  _midpoint,
  maxDiametroLabel,
  ramalDischargeEnd,
  ramalContinuesPast,
  bumpBajanteToMaxRamal,
} from './drawingUtils';
import { distToPolyline } from '../shared/geometry';

/** Termina el ramal activo: valida ángulos, crea el PlanoRamal, auto-divide uniones y asocia
 *  con bajantes. @param engine Instancia del motor. */
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
  // crear uno nuevo separado. Esto hace que el quiebre quede como vértice interior del
  // mismo pts[] y el símbolo de codo 45/90 se dibuje automático (drawRamalPath).
  // try/catch: si el merge lanza por cualquier razón, se cae a la creación normal del ramal.
  try {
    const incomingPts = engine.activeRamal!.pts;
    if (incomingPts.length >= 2 && !engine.activeRamal!.id) {
      const TOL = 0.5;
      const isBajanteCode = (v: string) => engine.bajantes.some((b) => (b.code || b.id) === v);
      // Un punto que coincide con la posición de un bajante NO es una continuación entre ramales:
      // dos ramales que terminan en el mismo bajante son laterales separados (Y doble), no un
      // ramal extendido. Si el extremo coincidente cae sobre un bajante, se omite el merge.
      const onBajantePos = (p: number[]) =>
        engine.bajantes.some((b) => Math.hypot(b.x - p[0], b.y - p[1]) < TOL);
      const nStart = incomingPts[0];
      const nEnd = incomingPts[incomingPts.length - 1];
      if (onBajantePos(nStart) || onBajantePos(nEnd)) {
        // no mergear — dejar crear el ramal separado que conecta al bajante
      } else {
        let target: PlanoRamal | null = null;
        let mode: 'nStart-eStart' | 'nStart-eEnd' | 'nEnd-eStart' | 'nEnd-eEnd' | null = null;
        // ¿El extremo `ep` de `ex` está LIBRE (no toca otro ramal)? Para tributarios solo se
        // mergea la extensión por la PUNTA LIBRE; si el punto coincide con el padre (la tee),
        // es un segundo tributario llegando al tronco → no mergear (formaría unión T).
        const isFreeTip = (ex: PlanoRamal, ep: number[]): boolean => {
          for (const o of engine.ramales) {
            if (o.id === ex.id || !o.pts || o.pts.length < 2) continue;
            const linked =
              o.net === ex.net ||
              ((o.net === 'san' || o.net === 'vent') && (ex.net === 'san' || ex.net === 'vent'));
            if (!linked) continue;
            if (o.pts.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL)) return false;
            for (let i = 0; i < o.pts.length - 1; i++) {
              const [ax, ay] = o.pts[i];
              const [bx, by] = o.pts[i + 1];
              const dx = bx - ax,
                dy = by - ay;
              const lenSq = dx * dx + dy * dy;
              if (lenSq < 0.0001) continue;
              const t = ((ep[0] - ax) * dx + (ep[1] - ay) * dy) / lenSq;
              if (t < 0.02 || t > 0.98) continue;
              if (Math.hypot(ep[0] - (ax + t * dx), ep[1] - (ay + t * dy)) < TOL) return false;
            }
          }
          return true;
        };
        for (const ex of engine.ramales) {
          if (ex.net !== engine.activeRamal!.net) continue;
          if (!ex.pts || ex.pts.length < 2) continue;
          // Ramales y tributarios se extienden por llegada a extremo (mismo tipo). La
          // extensión de un tributario mergea en el mismo (la punta libre se vuelve
          // vértice interior → el codo 45°/90° se dibuja solo); si el punto es la tee
          // con el padre, NO se mergea (sería un segundo tributario uniéndose al tronco).
          if (ex.tipo !== engine.activeRamal!.tipo) continue;
          const eStart = ex.pts[0];
          const eEnd = ex.pts[ex.pts.length - 1];
          const trib = ex.tipo === 'tributario';
          const ok = (exEp: number[], exRef: string | null | undefined) =>
            !(exRef && isBajanteCode(exRef)) && !(trib && !isFreeTip(ex, exEp));
          if (
            Math.hypot(nStart[0] - eStart[0], nStart[1] - eStart[1]) < TOL &&
            ok(eStart, ex.ini)
          ) {
            target = ex;
            mode = 'nStart-eStart';
            break;
          }
          if (Math.hypot(nStart[0] - eEnd[0], nStart[1] - eEnd[1]) < TOL && ok(eEnd, ex.fin)) {
            target = ex;
            mode = 'nStart-eEnd';
            break;
          }
          if (Math.hypot(nEnd[0] - eStart[0], nEnd[1] - eStart[1]) < TOL && ok(eStart, ex.ini)) {
            target = ex;
            mode = 'nEnd-eStart';
            break;
          }
          if (Math.hypot(nEnd[0] - eEnd[0], nEnd[1] - eEnd[1]) < TOL && ok(eEnd, ex.fin)) {
            target = ex;
            mode = 'nEnd-eEnd';
            break;
          }
        }
        if (target && mode) {
          // Snapshot del estado original de target para revertir TODO si el ángulo no valida
          const snap = {
            pts: target.pts,
            totalL: target.totalL,
            accMed: target.accMed,
            accesorioInicio: target.accesorioInicio,
            accesorioFin: target.accesorioFin,
            diametroInicio: target.diametroInicio,
            diametroFin: target.diametroFin,
            labelX: target.labelX,
            labelY: target.labelY,
            labelAngle: target.labelAngle,
          };
          // Modos "mismo-extremo" (nStart-eStart, nEnd-eEnd): ambos extremos del trazo
          // nuevo y del target coinciden en la unión (ambas colas o ambas cabezas). Para
          // que el flujo CONTINÚE el del target (no se voltee), se revierte el TRAZO
          // NUEVO (incoming), no el target — el target preserva pts/flujo/accesorios/
          // _tribReversed intactos. El modo efectivo pasa al "extremo opuesto".
          let effInc = incomingPts;
          let effMode: 'nStart-eEnd' | 'nEnd-eStart' = mode as 'nStart-eEnd' | 'nEnd-eStart';
          if (mode === 'nStart-eStart') {
            effInc = [...incomingPts].reverse();
            effMode = 'nEnd-eStart';
          } else if (mode === 'nEnd-eEnd') {
            effInc = [...incomingPts].reverse();
            effMode = 'nStart-eEnd';
          }
          let mergedPts: number[][] | null = null;
          if (effMode === 'nStart-eEnd') mergedPts = [...target.pts, ...effInc.slice(1)];
          else if (effMode === 'nEnd-eStart') mergedPts = [...effInc.slice(0, -1), ...target.pts];
          // Nota: el caso nStart-e* ya debería haber sido capturado como "continuar" en
          // handleLineDown al empezar, pero se deja como fallback por si llega aquí.
          if (mergedPts && mergedPts.length >= 2) {
            // mover accesorio del extremo de target que se vuelve interior a accMed
            const junctionIdx =
              effMode === 'nStart-eEnd' ? target.pts.length - 1 : effInc.length - 1;
            // Si el extremo de target que se interioriza tenía accesorio, pasarlo a accMed
            const accToMove =
              effMode === 'nStart-eEnd' ? target.accesorioFin : target.accesorioInicio;
            const diamToMove =
              effMode === 'nStart-eEnd' ? target.diametroFin : target.diametroInicio;
            // Guardar accMed original antes de modificar
            const origAccMed = { ...(target.accMed || {}) };
            let newAccMed: Record<string, string> = { ...origAccMed };
            if (accToMove) {
              // para nStart-eEnd el junction está al final de target (no requiere shift)
              // para nEnd-eStart el junction está al inicio de la porción target desplazada
              if (effMode === 'nStart-eEnd') {
                newAccMed[`accMed${junctionIdx}`] = accToMove;
                target.accesorioFin = '';
                target.diametroFin = '';
              } else {
                // nEnd-eStart: se añadirá después del shift en junctionIdx
                target.accesorioInicio = '';
                target.diametroInicio = '';
              }
              void diamToMove;
            }
            // Reindexar accMed cuando el merge antepone puntos (nEnd-eStart)
            if (effMode === 'nEnd-eStart') {
              const shift = effInc.length - 1;
              const shifted: Record<string, string> = {};
              for (const [k, v] of Object.entries(origAccMed)) {
                const m = k.match(/^accMed(\d+)$/);
                if (!m) {
                  shifted[k] = v;
                  continue;
                }
                const idx = parseInt(m[1], 10);
                shifted[`accMed${idx + shift}`] = v;
              }
              newAccMed = shifted;
              if (accToMove) newAccMed[`accMed${junctionIdx}`] = accToMove;
            }
            target.accMed = newAccMed;
            // Validar ángulos del trazado resultante (excluyendo conexiones)
            target.pts = mergedPts;
            target.totalL = calculateRamalLength(mergedPts, engine);
            const [labX, labY] = _midpoint(mergedPts);
            target.labelX = labX;
            target.labelY = labY;
            if (target.labelAngle == null) target.labelAngle = angleAtHalfLength(mergedPts);
            // Herencia de diámetro en la extensión: si el ramal extendido quedó sin diámetro,
            // adopta el MAYOR solo de sus ALIMENTADORES (ramales que descargan sobre la pieza
            // fusionada) — igual que la creación. El máximo ciego ponía diámetro a trazos que
            // entregan (el usuario pide vacío; "Diámetros pendientes" lo marcará hasta asignarlo).
            // Extensión de tributario: la cadena re-etiqueta con la raíz ACTUAL del padre
            // (los trib intermedios arrastraban la raíz vieja en la etiqueta, orig. usuario).
            if (target.tipo === 'tributario') {
              relabelTribChain(engine.ramales, target.id, (suffix) =>
                allocTributaryNumber(engine, suffix),
              );
            }
            if (!target.diametro) {
              let inherited = '';
              for (const o of engine.ramales) {
                if (o.id === target.id || o.net !== target.net) continue;
                if (!o.pts || o.pts.length < 2 || !o.diametro) continue;
                const d = ramalDischargeEnd(o);
                if (!d) continue;
                if (
                  distToPolyline(d, mergedPts) < 2.0 &&
                  ramalContinuesPast(
                    { net: target.net, pts: mergedPts, _tribReversed: target._tribReversed },
                    d,
                    2.0,
                  )
                )
                  inherited = maxDiametroLabel(inherited, o.diametro);
              }
              if (!inherited) {
                const defD = (engine._ramalDefaults || { diametro: '' }).diametro || '';
                if (defD) inherited = defD;
              }
              if (inherited) target.diametro = inherited;
            }
            if (!checkRamalAnglesExcludingConnections(engine, target)) {
              // revertir TODO el estado de target
              target.pts = snap.pts;
              target.totalL = snap.totalL;
              target.accMed = snap.accMed;
              target.accesorioInicio = snap.accesorioInicio;
              target.accesorioFin = snap.accesorioFin;
              target.diametroInicio = snap.diametroInicio;
              target.diametroFin = snap.diametroFin;
              target.labelX = snap.labelX;
              target.labelY = snap.labelY;
              target.labelAngle = snap.labelAngle;
              engine.triggerAlert(
                'Ángulo no recomendado',
                target.net === 'san' || target.net === 'll'
                  ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 0° y 45°. Usar línea guía para ajustar ángulo.'
                  : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
              );
              // no mergear, seguir con creación normal (caerá al flujo normal abajo)
            } else {
              engine.activeRamal = null;
              engine.selId = target.id;
              engine._emitSelect(target);
              engine._emitStatus(_statusMsg(engine));
              engine.render();
              engine._markDirty();
              return;
            }
          }
        }
      }
    }
  } catch (e) {
    devError('finishRamal merge-extremo:', e);
    // merge falló — continuar con la creación normal del ramal abajo
  }
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
    // "Diámetros pendientes" hasta asignarlo).
    diametro: def.diametro || '',
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
        const endOnVentBajante = (engine.bajantes || []).some(
          (b) => b.net === 'vent' && Math.hypot(b.x - pEnd[0], b.y - pEnd[1]) < TOL,
        );
        const endOnSanBajante = (engine.bajantes || []).some(
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
  } else if (r.net === 'af' || r.net === 'ac' || r.net === 'gas') {
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
    for (const ep of [r.pts[0], r.pts[r.pts.length - 1]]) {
      if (!junctionHasIncomingFlow(candidates, r.net, ep, TOL)) {
        engine.triggerAlert(
          'Conexión sin entrada',
          'Toda conexión en esta red debe tener al menos un ramal con dirección de flujo entrando a ella.',
        );
        engine.activeRamal = null;
        engine._markDirty();
        engine.render();
        return;
      }
    }
  }

  engine.ramales.push(r);
  // Bug #7: el segmento de CONEXIÓN (extremo que pega a otro ramal existente o a un bajante)
  // tiene el ángulo dictado por la geometría del ramal existente, no por la cuadrícula — no se
  // valida. Validar solo los segmentos libres (los que no tocan nada).
  if (!checkRamalAnglesExcludingConnections(engine, r)) {
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
  // Los tributarios no pueden CRUZAR otro ramal (atravesarlo por el interior): alerta + bloqueo.
  // La intersección se descarta si cae pegada a un extremo del propio tributario (≤2 unid): el
  // aterrizaje legítimo a mitad del cuerpo del host (split de tee) ocurre justo en su punta —
  // con snap imperfecto el cruce queda a <2 de la punta y NO es un atravesamiento real.
  if (r.tipo === 'tributario') {
    const sameGroup = (x: string, y: string) =>
      x === y || ((x === 'san' || x === 'vent') && (y === 'san' || y === 'vent'));
    const strictHit = (
      a1: number[],
      a2: number[],
      b1: number[],
      b2: number[],
    ): [number, number] | null => {
      const d = (a1[0] - a2[0]) * (b1[1] - b2[1]) - (a1[1] - a2[1]) * (b1[0] - b2[0]);
      if (Math.abs(d) < 1e-10) return null;
      const t = ((a1[0] - b1[0]) * (b1[1] - b2[1]) - (a1[1] - b1[1]) * (b1[0] - b2[0])) / d;
      const u = -((a1[0] - a2[0]) * (a1[1] - b1[1]) - (a1[1] - a2[1]) * (a1[0] - b1[0])) / d;
      if (t < 0 || t > 1 || u < 0 || u > 1) return null;
      const ix = a1[0] + t * (a2[0] - a1[0]);
      const iy = a1[1] + t * (a2[1] - a1[1]);
      if (
        Math.hypot(ix - a1[0], iy - a1[1]) < 0.001 ||
        Math.hypot(ix - a2[0], iy - a2[1]) < 0.001 ||
        Math.hypot(ix - b1[0], iy - b1[1]) < 0.001 ||
        Math.hypot(ix - b2[0], iy - b2[1]) < 0.001
      )
        return null;
      return [ix, iy];
    };
    const near = (p: number[], q: number[], tol: number) =>
      Math.hypot(p[0] - q[0], p[1] - q[1]) < tol;
    for (const o of engine.ramales) {
      if (o.id === r.id || !sameGroup(o.net, r.net) || !o.pts || o.pts.length < 2) continue;
      let crosses = false;
      for (let i = 0; i < r.pts.length - 1 && !crosses; i++) {
        for (let j = 0; j < o.pts.length - 1 && !crosses; j++) {
          const hit = strictHit(r.pts[i], r.pts[i + 1], o.pts[j], o.pts[j + 1]);
          if (hit && !near(hit, r.pts[i], 2.0) && !near(hit, r.pts[r.pts.length - 1], 2.0))
            crosses = true;
        }
      }
      if (crosses) {
        engine.triggerAlert(
          'Conexión no permitida',
          'Un tributario no puede cruzar un ramal. Conéctalo en un extremo o a mitad del trazo, sin atravesarlo.',
        );
        engine.ramales.pop();
        engine.activeRamal = null;
        engine._markDirty();
        engine.render();
        return;
      }
    }
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
  let llegaACaja = false; // llegó al CENTRO de una caja: sin propagación de diámetros
  if (r.pts.length >= 2) {
    const TOLLERANCE = 0.5;
    const lastIdx = r.pts.length - 1;
    const lvl = engine.nivelActual?.label ?? '';
    const displacedFantasmaIds = new Set(
      engine
        .getBajantesFantasma()
        .filter((b) => {
          const disp = b.desplazamientos?.[lvl];
          return !!disp && (Math.abs(disp.dx) > 0.5 || Math.abs(disp.dy) > 0.5);
        })
        .map((b) => b.id),
    );
    let rejected = false;
    for (const epIdx of [0, lastIdx]) {
      const isArrival = epIdx === lastIdx;
      const ep = r.pts[epIdx];
      // Candidatos por distancia (la tolerancia cubre el radio del símbolo; en CAJAS el
      // _circ es la semidiagonal del cuadro — la asociación usa el SEMILADO para no alcanzar
      // elementos vecinos y acabar validando el trazo contra el bajante equivocado).
      const cands = engine.bajantes.filter((b) => {
        if (b.net !== r.net || engine._hiddenNets.has(b.net)) return false;
        const circ = b._circ?.r || 8 * engine.zoom;
        const rimTol = (esCaja(b) ? circ / Math.SQRT2 : circ) / (engine.zoom || 1) + TOLLERANCE;
        if (displacedFantasmaIds.has(b.id)) {
          const disp = b.desplazamientos?.[lvl];
          const bx = b.x + (disp?.dx || 0);
          const by = b.y + (disp?.dy || 0);
          return Math.hypot(bx - ep[0], by - ep[1]) < rimTol;
        }
        return Math.hypot(b.x - ep[0], b.y - ep[1]) < rimTol;
      });
      // Elegir el PRIMER candidato cuya guard central acepte el trazo — con cajas y vecinos
      // en el mismo punto, el primer candidato por orden de array puede rechazar (p.ej. un
      // montante que no admite tributarios) mientras el correcto (la caja) sí lo hace.
      let baj: PlanoBajante | undefined;
      let firstCheck: ReturnType<typeof puedeConectarRamalABajante> | null = null;
      for (const c of cands) {
        if (c.recibeDeIds.includes(r.id) || c.alimentaIds?.includes(r.id)) {
          baj = c;
          break;
        }
        const chk = puedeConectarRamalABajante(c, r, isArrival ? 'recibe' : 'alimenta');
        if (chk.ok) {
          baj = c;
          break;
        }
        if (!firstCheck) firstCheck = chk;
      }
      if (!baj) {
        // Regla central: misma red + tope de asociaciones (2 bajante / 1 caja) — antes de
        // escribir cualquier campo (ítems 1/9). Rechazo = NO se crea el trazo: la alerta
        // saliendo y el ramal quedando dibujado igualmente era el estado inválido.
        if (cands.length > 0) {
          if (firstCheck?.title && firstCheck.msg)
            engine.triggerAlert(firstCheck.title, firstCheck.msg);
          rejected = true;
          break;
        }
        continue;
      }
      if (baj.recibeDeIds.includes(r.id) || baj.alimentaIds?.includes(r.id)) continue;
      // Diámetro según cómo se dibuja (orig. usuario): el ramal que SALE del bajante
      // (nace en pts[0]) adopta el dNominal del bajante; si el bajante aún no tiene, toma
      // el del ramal. El ramal que LLEGA conserva su diámetro y empuja al bajante al mayor
      // (nunca baja) — pero si nació sin diámetro explícito (default/empty), adopta el del
      // bajante, de modo que la Y doble converja sin alerta falsa.
      // CAJAS: sin adopción/empuje de diámetro — su dNominal se maneja por menú y no
      // participan en propagación (orig. usuario). Llegada a caja marca la bandera que
      // desactiva más abajo herencia y propagación de diámetros.
      const bornSinDiam = !r.diametro || diametroBornDefault;
      if (esCaja(baj)) {
        if (isArrival) llegaACaja = true;
      } else if (isArrival) {
        if (bornSinDiam && baj.dNominal) r.diametro = baj.dNominal;
      } else if (baj.dNominal) {
        r.diametro = baj.dNominal;
      } else if (r.diametro) {
        baj.dNominal = r.diametro;
      }
      // 14.2 Y doble: laterales must be same diam (solo llegadas — 2 ramales que descargan).
      // Las cajas admiten N entradas y no son una Y física: el chequeo no aplica.
      if (isArrival && !esCaja(baj) && baj.recibeDeIds.length === 1) {
        const existing = engine.ramales.find((x) => x.id === baj.recibeDeIds[0]);
        if (existing && existing.diametro && r.diametro) {
          const p1 = diamPulgFromLabel(existing.diametro);
          const p2 = diamPulgFromLabel(r.diametro);
          if (p1 > 0 && p2 > 0 && Math.abs(p1 - p2) > 0.01) {
            engine.triggerAlert(
              'Diámetros no compatibles',
              'Los dos ramales que llegan a un mismo bajante (Y doble) deben tener el mismo diámetro en sus brazos laterales.',
            );
            rejected = true;
            break;
          }
        }
      }
      const bajCode = baj.code || baj.id;
      if (isArrival) {
        baj.recibeDeIds.push(r.id);
        r.fin = bajCode;
        // El bajante sigue al MAYOR de sus llegadores — nunca queda por debajo (misma regla
        // que bumpConnectedBajantes al editar).
        if (!esCaja(baj)) {
          const bumped = bumpBajanteToMaxRamal(engine.ramales, baj.recibeDeIds, baj.dNominal || '');
          if (bumped) baj.dNominal = bumped;
        }
      } else {
        if (!baj.alimentaIds) baj.alimentaIds = [];
        baj.alimentaIds.push(r.id);
        r.ini = bajCode;
      }
    }
    if (rejected) {
      engine.ramales = engine.ramales.filter((x) => x.id !== r.id);
      engine.activeRamal = null;
      engine.render();
      return;
    }
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

/** ¿El ángulo de cruce entre el ramal nuevo y los existentes es válido para la red? Bloquea con alerta los cruces no recomendados (san/ll solo 45°, af/ac sin uniones de 45°). */
export function checkCrossRamalAngle(
  engine: IPlanoEngineCore,
  pA: number[],
  pB: number[],
  skipId: string,
): boolean {
  for (const r of engine.ramales) {
    if (r.id === skipId || !r.pts || r.pts.length < 2) continue;
    const netId = r.net || engine.activeNet;
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
