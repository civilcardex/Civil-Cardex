import { NETS, netsSnapLinked, allocNetNumber } from './PlanoState';
import { moveAparatoCount } from '../../utils/syncExtremeAccessory';
import type { PlanoRamal, PlanoBajante, PlanoArea } from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { pointToSegmentDist } from './HitTester';
import { canalRectHitDistance } from './canalAssociation';
import {
  _firstSegmentAngle,
  checkRamalAngles,
  segmentsIntersect,
  snapTributaryToPadre45Deg,
  detectAccesorioTrigger,
} from './drawingAngles';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import {
  isRamalBajanteConnectionAllowed,
  junctionHasOutgoingFlow,
} from '../../utils/flowDirection';

export {
  checkRamalAngles,
  _firstSegmentAngle,
  segmentsIntersect,
  snapTributaryToPadre45Deg,
} from './drawingAngles';
export {
  handleBajanteDown,
  handleMontanteDown,
  handleCreateMontanteMidBody,
  handleCreateCalentadorMidBody,
  handleCreateTeeCapStub,
  handleCalentadorDown,
  handleRedPublicaDown,
  handleContadorDown,
  handleCanalDown,
} from './drawingCreations';

type ToolType =
  | 'sel'
  | 'line'
  | 'dim'
  | 'text'
  | 'baj'
  | 'mon'
  | 'pan'
  | 'area'
  | 'erase'
  | 'segdel'
  | 'delm'
  | 'red_pub'
  | 'cont'
  | 'calent'
  | 'canal'
  | 'guide';

function toolCursor(tool: string): string {
  return tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair';
}

import { _statusMsg, calculateRamalLength } from './ramalMeasure';
export { _statusMsg, calculateRamalLength } from './ramalMeasure';

export function _nextLabel(engine: IPlanoEngineCore): string {
  const net = NETS.find((n) => n.id === engine.activeNet);
  const pfx = net ? net.lbl : 'R';
  const cnt =
    engine._netCounts[engine.activeNet]?.[
      engine.tipoTramo as keyof (typeof engine._netCounts)[string]
    ] || 0;
  if (engine.tipoTramo === 'tributario') {
    const padre = engine.ramales.find((r) => r.id === engine.padreTributario);
    const padreLabel = padre ? padre.label || padre.id : '';
    return `T${cnt}${padreLabel}`;
  }
  return `${pfx}${cnt}`;
}

// Invierte la dirección de un ramal en el sitio: revierte el orden de sus puntos e intercambia
// todo campo simétrico por extremo para que cada uno siga refiriéndose al extremo físico
// correcto después. Las flechas de dirección de flujo (renderRamales.ts, derivadas en vivo de
// pts[0] vs pts[último]) se voltean solas como resultado — no hace falta un campo de dirección
// aparte.
export function reverseRamalEndpoints(ramal: PlanoRamal): void {
  const tmpAcc = ramal.accesorioInicio;
  ramal.accesorioInicio = ramal.accesorioFin;
  ramal.accesorioFin = tmpAcc;
  const tmpDiam = ramal.diametroInicio;
  ramal.diametroInicio = ramal.diametroFin;
  ramal.diametroFin = tmpDiam;
  const tmpApp = ramal.aparatoInicio;
  ramal.aparatoInicio = ramal.aparatoFin;
  ramal.aparatoFin = tmpApp;
  const tmpIniFin = ramal.ini;
  ramal.ini = ramal.fin;
  ramal.fin = tmpIniFin;
  ramal.pts.reverse();
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
      return [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
      ];
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
  const m2 = area * Math.pow((2.54 * engine.scaleM) / 96, 2);
  return +m2.toFixed(2);
}

/** Fija la herramienta de dibujo activa, terminando primero el ramal/área en curso si se cambia.
 *  @param engine Instancia del motor. @param t Identificador de herramienta. */
export function setTool(engine: IPlanoEngineCore, t: ToolType): void {
  if (engine.activeRamal && engine.activeRamal.pts.length >= 2 && t !== 'line') finishRamal(engine);
  else if (engine.activeRamal && t !== 'line') cancelRamal(engine);
  if (engine.activeArea && t !== 'area') finishArea(engine);
  if (t !== 'dim') engine._dimStart = null;
  if (t !== 'guide') engine._guideStart = null;
  if (t !== 'canal') engine._canalStart = null;
  engine.tool = t;
  engine.canv.style.cursor = toolCursor(t);
  engine._emitStatus(_statusMsg(engine));
}

// El diámetro se guarda como el valor completo del dropdown, p.ej. `1-1/2" — 42.7 mm` (ver el
// selector "Diámetro de ramal" en DrawingElementContextMenu.tsx, que a su vez tiene que
// hacer `.split(' — ')[0]` antes de mostrarlo). Pasar esa cadena completa a diamPulgFromLabel
// dispara su propio manejo de em-dash, que lee la cifra en *mm* después del guion como si
// fueran pulgadas (42.7 en vez de 1.5) — comparar dos números así de inflados y esencialmente
// aleatorios hacía que la elección del "diámetro padre mayor" se viera arbitraria/mal.
export function inchPartOfDiametro(d: string): string {
  const q = d.indexOf('"');
  return q > 0 ? d.slice(0, q) : d;
}

export function maxDiametroLabel(a: string, b: string): string {
  const va = diamPulgFromLabel(inchPartOfDiametro(a || ''));
  const vb = diamPulgFromLabel(inchPartOfDiametro(b || ''));
  if (!va) return b || a;
  if (!vb) return a || b;
  return vb > va ? b : a;
}

// Cuando el extremo de un ramal recién terminado (o arrastrado) cae a mitad del cuerpo de un
// ramal EXISTENTE — una tee T/Y de verdad, no una unión extremo-con-extremo — se divide ese
// ramal existente en la unión en una porción aguas arriba (conservada, sin cambios) y un ramal
// nuevo aguas abajo que carga el caudal combinado: diámetro = el mayor de los dos ramales que
// convergen, uc = su suma. Aplica uniformemente a todas las redes (san/ll acumulan UC, af/ac/gas
// acumulan su propia cifra de carga — todas en el mismo campo genérico `uc`), igual que un
// diseño hidráulico real aumenta el tamaño/calificación de la tubería después de un punto de
// confluencia, en vez de asumir que la calificación del tramo aguas arriba sigue valiendo más
// allá. Solo se maneja el caso de cuerpo medio — una unión extremo-con-extremo no tiene "resto
// del recorrido" más allá de la unión que dividir, así que no hay nada que auto-crear ahí.
// Unión tributario-a-tributario de AC/AF/gas: permitida solo cuando el tributario destino
// comparte el MISMO ramal padre seleccionado (el elegido en la barra lateral). Lo usan todas las
// guardias de dibujo para que una unión del mismo padre nunca se bloquee y una de padre
// distinto siempre alerte.
function canJoinTributario(engine: IPlanoEngineCore, target: PlanoRamal): boolean {
  if (engine.tipoTramo !== 'tributario') return false;
  if (target.tipo !== 'tributario') return false;
  if (target.net !== 'af' && target.net !== 'ac' && target.net !== 'gas') return false;
  return target.padre === engine.padreTributario;
}

/** Invierte la dirección de flujo de un ramal existente IN PLACE — misma operación que el botón
 *  "Invertir dirección de flujo" del menú contextual (pts.reverse + swap de los datos por
 *  extremo), reutilizada para auto-orientar uniones san/ll/vent contraflujo. No toca
 *  `_tribReversed` (los ramales de estas redes no lo usan para render; invertir pts ES el flip
 *  visible). Es una involución: aplicarla dos veces restaura el estado original. */
export function flipRamalFlow(ram: PlanoRamal): void {
  ram.pts = [...ram.pts].reverse();
  const tmpAcc = ram.accesorioInicio;
  ram.accesorioInicio = ram.accesorioFin;
  ram.accesorioFin = tmpAcc;
  const tmpDiam = ram.diametroInicio;
  ram.diametroInicio = ram.diametroFin;
  ram.diametroFin = tmpDiam;
  const tmpApp = ram.aparatoInicio;
  ram.aparatoInicio = ram.aparatoFin;
  ram.aparatoFin = tmpApp;
  const tmpIniFin = ram.ini;
  ram.ini = ram.fin;
  ram.fin = tmpIniFin;
  // Las claves accMed se desplazan porque los vértices interiores se reindexan con el nuevo
  // orden.
  if (ram.accMed) {
    const oldMed = ram.accMed;
    const len = ram.pts.length;
    const newMed: Record<string, string> = {};
    for (const [k, v] of Object.entries(oldMed)) {
      const m = k.match(/^accMed(\d+)$/);
      if (!m) continue;
      const oldIdx = parseInt(m[1], 10);
      const newIdx = len - 1 - oldIdx;
      newMed[`accMed${newIdx}`] = v;
    }
    ram.accMed = newMed;
  }
}

// ————— Helpers compartidos de dirección de flujo (ítems 2, 5, 12, 13) —————

/** Vector de flujo (px, sin normalizar) del ramal en el punto dado — dirección del segmento
 *  más cercano al punto, con la convención de renderRamales.ts (fluye de pts[0] hacia el último
 *  punto, invertido si _tribReversed). @returns null si el punto cae fuera del ramal por más de
 *  tol. */
export function flowVecAt(
  ram: { pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  tol = 1,
): [number, number] | null {
  if (!ram.pts || ram.pts.length < 2) return null;
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let i = 0; i < ram.pts.length - 1; i++) {
    const [ax, ay] = ram.pts[i];
    const [bx, by] = ram.pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) continue;
    const t = ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / lenSq;
    const tc = Math.max(0, Math.min(1, t));
    const px = ax + tc * dx;
    const py = ay + tc * dy;
    const d = Math.hypot(pt[0] - px, pt[1] - py);
    if (d < bestD) {
      bestD = d;
      best = [dx, dy];
    }
  }
  if (!best || bestD > tol) return null;
  return ram._tribReversed ? [-best[0], -best[1]] : best;
}

/** ¿El flujo del ramal TERMINA en el punto P (P es el extremo aguas abajo de la dirección de
 *  flujo)? */
export function flowEndsAt(
  ram: { pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  tol: number,
): boolean {
  if (!ram.pts || ram.pts.length < 2) return false;
  const head = ram.pts[ram.pts.length - 1];
  const tail = ram.pts[0];
  const atHead = Math.hypot(head[0] - pt[0], head[1] - pt[1]) < tol;
  const atTail = Math.hypot(tail[0] - pt[0], tail[1] - pt[1]) < tol;
  if (!atTail && !atHead) return false;
  const atLogicalHead = ram._tribReversed ? atTail : atHead;
  return atLogicalHead;
}

/** ¿El flujo del ramal COMIENZA en el punto P (P es el extremo aguas arriba)? */
function flowStartsAt(
  ram: { pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  tol: number,
): boolean {
  if (!ram.pts || ram.pts.length < 2) return false;
  const head = ram.pts[ram.pts.length - 1];
  const tail = ram.pts[0];
  const atHead = Math.hypot(head[0] - pt[0], head[1] - pt[1]) < tol;
  const atTail = Math.hypot(tail[0] - pt[0], tail[1] - pt[1]) < tol;
  if (!atTail && !atHead) return false;
  const atLogicalTail = ram._tribReversed ? atHead : atTail;
  return atLogicalTail;
}

/** ¿La polaridad del codo de montante (codo90rmSube/codo90rmBaja, codoSube/codoBaja) es
 *  coherente con la dirección de flujo del ramal en P? El codo sube solo puede ENTREGAR flujo
 *  (la cola de la flecha de flujo apunta al extremo P: el flujo SALE de P hacia el codo);
 *  el codo baja solo puede RECIBIR flujo (la cabeza de la flecha apunta al extremo P: el flujo
 *  LLEGA a P desde el codo). En el cuerpo (flujo que pasa de largo, ni llega ni sale) ninguno de
 *  los dos es válido. */
export function codoPolarityOk(
  ramal: { pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  accId: string,
  tol: number,
): boolean {
  const isSube = accId === 'codo90rmSube' || accId === 'codoSube';
  const isBaja = accId === 'codo90rmBaja' || accId === 'codoBaja';
  if (!isSube && !isBaja) return true;
  if (isSube) return flowStartsAt(ramal, pt, tol);
  return flowEndsAt(ramal, pt, tol);
}

/** ¿El flujo del ramal de ventilación LLEGA a una unión con sanitaria (codo reventilado)? En
 *  la unión reventilado el flujo del vent debe ALEJARSE de la unión (san→vent); que llegue a
 *  ella es una violación. */
export function ventFlowsIntoJunction(
  vent: { net?: string; pts: number[][]; _tribReversed?: boolean },
  pt: number[],
  tol: number,
): boolean {
  if (vent.net !== 'vent' || !vent.pts || vent.pts.length < 2) return false;
  return flowEndsAt(vent, pt, tol);
}

/** ¿El flujo del candidato en `ep` coincide con el del ramal que toca (dot > 0)? Regla
 *  san/ll/vent: el ramal que se conecta fluye en el mismo sentido que el ramal principal. */
export function flowDirectionOkAt(
  incoming: { pts: number[][]; _tribReversed?: boolean },
  other: { pts: number[][]; _tribReversed?: boolean },
  ep: number[],
  tol: number,
): boolean {
  const fin = flowVecAt(incoming, ep, tol);
  const fex = flowVecAt(other, ep, tol);
  if (!fin || !fex) return false;
  return fin[0] * fex[0] + fin[1] * fex[1] > 0;
}

function pointOnRamalSegment(p: number[], a: number[], b: number[], tol: number): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return Math.hypot(p[0] - a[0], p[1] - a[1]) < tol;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  if (t < 0.02 || t > 0.98) return false;
  const px = a[0] + t * dx;
  const py = a[1] + t * dy;
  return Math.hypot(p[0] - px, p[1] - py) < tol;
}

function sameNetGroupNet(a: string, b: string): boolean {
  return a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
}

/** Chequeo de dirección de flujo para san/ll/vent: cada extremo del ramal que toca otro ramal
 *  del mismo grupo (extremo o cuerpo) debe fluir en el mismo sentido que ese ramal; y un ramal
 *  vent que toca san (codo reventilado) debe alejarse de la unión. `extra` cubre el candidato
 *  cuando aún no está en engine.ramales (finishRamal pre-push). @returns mensaje de violación
 *  o null si todo cumple. */
export function ramalFlowDirectionCheck(
  engine: IPlanoEngineCore,
  ram: PlanoRamal,
  extra: PlanoRamal[],
  tol: number,
): string | null {
  if (!ram.pts || ram.pts.length < 2) return null;
  const candidates = [...engine.ramales, ...extra];
  const eps = [ram.pts[0], ram.pts[ram.pts.length - 1]];
  for (const ep of eps) {
    for (const other of candidates) {
      if (other.id === ram.id || !sameNetGroupNet(other.net, ram.net)) continue;
      if (!other.pts || other.pts.length < 2) continue;
      const oEps = [other.pts[0], other.pts[other.pts.length - 1]];
      let touches = oEps.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < tol);
      if (!touches) {
        for (let i = 0; i < other.pts.length - 1; i++) {
          if (pointOnRamalSegment(ep, other.pts[i], other.pts[i + 1], tol)) {
            touches = true;
            break;
          }
        }
      }
      if (!touches) continue;
      // Ítem 5: unión vent↔san (codo reventilado) — el flujo del vent debe ALEJARSE de la unión.
      if (other.net === 'san' && ventFlowsIntoJunction(ram, ep, tol)) {
        return 'El ramal de ventilación debe fluir alejándose de la unión reventilado (san → vent). Dibújalo saliendo desde el punto sanitario.';
      }
      if (ram.net === 'san' && ventFlowsIntoJunction(other, ep, tol)) {
        return 'El ramal de ventilación debe fluir alejándose de la unión reventilado (san → vent). Dibújalo saliendo desde el punto sanitario.';
      }
      if (!flowDirectionOkAt(ram, other, ep, tol)) {
        return 'El ramal que se conecta debe llevar la dirección de flujo del ramal principal. Dibújalo en el mismo sentido.';
      }
    }
  }
  return null;
}

export function autoSplitJunctionAndSumFlow(engine: IPlanoEngineCore, incoming: PlanoRamal): void {
  if (!incoming.pts || incoming.pts.length < 2) return;
  const TOL = 0.5;
  // San + vent comparten uniones como una sola subred — permitir también la detección de
  // extremos entre redes aquí.
  const sameNetGroup = (a: string, b: string) =>
    a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
  const endpoints = [incoming.pts[0], incoming.pts[incoming.pts.length - 1]];
  for (const ep of endpoints) {
    for (const existing of engine.ramales) {
      if (existing.id === incoming.id || !sameNetGroup(existing.net, incoming.net)) continue;
      if (!existing.pts || existing.pts.length < 2) continue;
      if (existing.pts.some(([x, y]) => Math.hypot(x - ep[0], y - ep[1]) < TOL)) {
        // Unión extremo-con-extremo (o extremo-sobre-vértice) — no es una tee de cuerpo medio,
        // así que no hay nada que dividir, pero un tributario que aterriza aquí debe ser su propio
        // padre y nada más. Sin esto, LLEGAR a un vértice del ramal equivocado (a diferencia de
        // empezar ahí, o chocar contra su cuerpo a mitad de recorrido) quedaba sin verificar — la
        // validación de snap al dibujar solo dispara mientras se coloca un punto fresco, y puede
        // fallarla si el snap de ángulo movió el clic un poco fuera del vértice exacto antes de
        // que corriera ese chequeo; esto es la última palabra, verificada directamente contra la
        // posición real del extremo del ramal terminado.
        if (incoming.tipo === 'tributario') {
          // Excepción AC/AF/gas (ítem 7): un tributario puede unirse al extremo de OTRO
          // tributario — pero solo cuando ambos comparten el mismo ramal padre seleccionado. El
          // símbolo de la unión lo genera el flujo AccesorioModal (finishRamal →
          // detectAccesorioTrigger).
          const tribToTribOk =
            existing.tipo === 'tributario' &&
            (existing.net === 'af' || existing.net === 'ac' || existing.net === 'gas') &&
            existing.padre === incoming.padre;
          if (existing.id !== incoming.padre && !tribToTribOk) {
            engine.triggerAlert(
              'Ramal padre incorrecto',
              'Solo puedes conectar el tributario al ramal padre seleccionado.',
            );
          }
        }
        continue;
      }
      let segIdx = -1;
      for (let i = 0; i < existing.pts.length - 1; i++) {
        const [ax, ay] = existing.pts[i],
          [bx, by] = existing.pts[i + 1];
        const dx = bx - ax,
          dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 0.0001) continue;
        const t = ((ep[0] - ax) * dx + (ep[1] - ay) * dy) / lenSq;
        if (t < 0.02 || t > 0.98) continue;
        const projX = ax + t * dx,
          projY = ay + t * dy;
        if (Math.hypot(ep[0] - projX, ep[1] - projY) < TOL) {
          segIdx = i;
          break;
        }
      }
      if (segIdx === -1) continue;
      // Validación de dirección de flujo para uniones creadas por arrastre (finishRamal valida
      // la creación por dibujo; la ruta ptDrag/ramalDrag llega a esta función directo). Un ramal
      // que se une a otro a mitad de cuerpo debe llevar la dirección de flujo del ramal
      // principal (dot > 0) — misma regla que el chequeo de finishRamal, ahora con el helper
      // compartido que usa vectores LOCALES por extremo/ramal tocado (ítem 2) e incluye la regla
      // del codo reventilado vent↔san (ítem 5). Dirección equivocada = sin unión, alerta.
      if (incoming.net === 'san' || incoming.net === 'll' || incoming.net === 'vent') {
        const flowErr = ramalFlowDirectionCheck(engine, incoming, [], TOL);
        if (flowErr) {
          // Sin auto-orientación: una conexión san/ll/vent con dirección de flujo distinta a la
          // del ramal principal se bloquea con alerta. La única auto-orientación permitida ocurre
          // al CREAR tributarios (apuntan a la unión) — nunca al conectar un ramal ya dibujado.
          engine.triggerAlert('Dirección de flujo incorrecta', flowErr);
          continue;
        }
      } else if (
        (incoming.net === 'af' || incoming.net === 'ac' || incoming.net === 'gas') &&
        !junctionHasOutgoingFlow(engine.ramales, incoming.net, ep, TOL)
      ) {
        engine.triggerAlert(
          'Conexión sin salida',
          'Toda conexión en esta red debe tener al menos un ramal con dirección de flujo saliendo de ella.',
        );
        continue;
      }
      // Un tributario que llega a una unión T/Y a mitad de cuerpo de un ramal distinto a su
      // padre seleccionado es exactamente el mismo caso de "ramal equivocado" que handleLineDown
      // ya bloquea con modal cuando ocurre en un vértice — esta es la misma violación cayendo
      // sobre el CUERPO de un ramal, y esta función corre incondicionalmente para toda red/tipo,
      // así que sin esto dividía y fusionaba el flujo en silencio con cualquier ramal que el
      // tributario tocara, sin alerta alguna.
      if (incoming.tipo === 'tributario') {
        // Excepción AC/AF/gas (ítem 7): un tributario que aterriza a mitad de cuerpo sobre OTRO
        // tributario que comparte el mismo padre seleccionado está permitido — sin esto, este
        // chequeo (que solo sabe comparar contra el id del ramal padre real) disparaba antes de
        // llegar al manejo tributario-a-tributario de abajo, bloqueando una unión del mismo
        // padre perfectamente válida.
        const tribToTribOk =
          existing.tipo === 'tributario' &&
          (existing.net === 'af' || existing.net === 'ac' || existing.net === 'gas') &&
          existing.padre === incoming.padre;
        if (existing.id !== incoming.padre && !tribToTribOk) {
          engine.triggerAlert(
            'Ramal padre incorrecto',
            'Solo puedes conectar el tributario al ramal padre seleccionado.',
          );
          continue;
        }
        // Ítem 4: los tributarios san/ll se unen al camino af/ac/gas — llegan a su propio padre a
        // mitad de cuerpo y lo DIVIDEN: una tee física (el segmento aguas arriba del padre se
        // queda, un ramal nuevo aguas abajo continúa el recorrido, y el tributario se une en el
        // punto, acumulando su UC/UD en el downstream). Antes san/vent/ll se unían tal cual (sin
        // mergesFrom, sin acumular UC/UD). Vent conserva ese comportamiento viejo: un tributario
        // de ventilación no acumula UC aguas abajo (el cómputo de accesorios san ya detecta las
        // uniones reventilado geométricamente). La excepción tribToTribOk (tributario-a-tributario
        // del mismo padre) sigue siendo solo af/ac/gas; en san/ll una unión tributario→tributario
        // se queda como unión simple (el bloque `existing.tipo === 'tributario'` de abajo hace
        // continue).
        if (existing.net === 'vent') continue;
      }
      // Un tributario tampoco puede ser un TRONCO — un ramal principal que cae a mitad de cuerpo
      // sobre un tributario no debe dividirlo. Sin esto, la división de abajo produce un ramal
      // `downstream` que extiende `...existing` (incluido `existing.tipo`) tal cual, así que
      // hereda en silencio `tipo: 'tributario'` cargando UC/UD reales fusionados — esa fuente de
      // fusión mal etiquetada se filtra después por todos los filtros de tributario (tablas de
      // diseño, columna "Otros Ramales").
      if (existing.tipo === 'tributario') {
        // Tributario-a-tributario de AC/AF/gas (ítem 7): permitido solo cuando ambos tributarios
        // comparten el mismo ramal padre seleccionado — el punto de unión es entonces la unión
        // compartida con el padre, y el símbolo de tee lo genera el flujo AccesorioModal después.
        // Un tributario nunca es un tronco, así que no hay división de todos modos.
        if (
          incoming.tipo === 'tributario' &&
          (existing.net === 'af' || existing.net === 'ac' || existing.net === 'gas')
        ) {
          if (existing.padre === incoming.padre) continue;
          engine.triggerAlert(
            'Ramal padre incorrecto',
            'Los tributarios deben conectarse al mismo ramal padre seleccionado.',
          );
          continue;
        }
        continue;
      }

      // Las uniones entre redes san↔vent a mitad de cuerpo NO deben dividir el ramal existente.
      // Ambas subredes comparten el mismo grupo de nodos, así que las conexiones parecen uniones
      // de la misma red, pero un ramal san cayendo a mitad de cuerpo sobre uno de vent (o al
      // revés) es un cruce normal, no una confluencia de flujo — renderNetCrossings.ts dibuja el
      // cruce visual.
      if (existing.net !== incoming.net) continue;

      // AC/AF/gas: la cola de la flecha del tributario siempre apunta hacia la unión que se
      // acaba de crear (fluye DESDE la T hacia el aparato) — convención fija, nunca editable por
      // el usuario después (ver el gating del botón "Invertir dirección de flujo" en
      // DrawingElementContextMenu.tsx). Al llegar aquí, `incoming.tipo === 'tributario'`
      // garantiza que esto es la división real tributario-contra-su-padre en af/ac/gas (los
      // demás casos de tributario ya hicieron `continue` más arriba). `existing`/`downstream`
      // (la misma línea partida en dos) siempre se reparten exactamente 1 entrada + 1 salida
      // entre ellos mientras no se toquen sus flags por separado, así que fijar la salida del
      // tributario aquí basta para garantizar la unión de "2 salidas + 1 entrada" sin validación
      // adicional en el momento de crearla.
      if (incoming.tipo === 'tributario') {
        const epIsStart = Math.hypot(incoming.pts[0][0] - ep[0], incoming.pts[0][1] - ep[1]) < TOL;
        // La convención de la punta de flecha difiere según la red: af/ac/gas fluyen DESDE la
        // unión hacia el aparato (flecha en el extremo libre); san/ll drenan HACIA la unión
        // (flecha apuntando a la unión, igual que en finishRamal y en la creación desde línea
        // guía). Vent sigue el patrón af/ac/gas (se aleja de la unión).
        incoming._tribReversed =
          incoming.net === 'san' || incoming.net === 'll' ? epIsStart : !epIsStart;
      }

      const downstreamPts = [[ep[0], ep[1]], ...existing.pts.slice(segIdx + 1)];
      existing.pts = [...existing.pts.slice(0, segIdx + 1), [ep[0], ep[1]]];
      existing.totalL = calculateRamalLength(existing.pts, engine);
      // Re-centrar la etiqueta de `existing` sobre su cuerpo ahora truncado — antes conservaba
      // el labelX/labelY que tenía para el ramal COMPLETO pre-división, que tras el corte podía
      // quedar fuera (o lejos) del segmento aguas arriba más corto que queda.
      const [existLabelX, existLabelY] = _midpoint(existing.pts);
      existing.labelX = existLabelX;
      existing.labelY = existLabelY;
      existing.labelAngle = _firstSegmentAngle(existing.pts);
      // NO fijar accesorioFin aquí — dejar que detectAccesorioTrigger + el modal lo asignen.
      // Fijarlo prematuramente hace que el barrido alreadyResolved se salte el modal por
      // completo, así el usuario nunca puede elegir el tipo real de tee (teeSube, teeBaja, yee,
      // etc.).

      // El UC se acumula en `downstream` (la continuación auto-creada) aquí, incondicionalmente —
      // NO en el ramal que "entra" a la unión. `downstream` es lo que una división POSTERIOR
      // más adelante en la misma línea lee como su propio `existing.uc` de entrada (encadenado
      // hacia adelante cada vez que se dibuja una T nueva); anularlo para AF/AC soltaría en
      // silencio todo el total acumulado de la cadena aguas arriba la próxima vez que la línea
      // se divida. Qué ramal DISPLAYA el número combinado (puede diferir de `downstream`, según
      // la convención AF/AC de "quien entra a la unión") es una preocupación solo de
      // presentación, manejada en las tablas de diseño (waterNetworkRows.ts /
      // WaterNetworkDesign.tsx), no aquí.
      const preSplitExistingUc = existing.uc || 0;
      const preSplitIncomingUc = incoming.uc || 0;

      // El accesorio del extremo lejano de `existing` pre-división (si había uno) pertenecía al
      // punto que solía ser su último vértice — tras el truncado ese punto ya no es el extremo
      // de existing, es el de downstream. Dejado en su lugar, seguía renderizándose en el
      // extremo NUEVO (truncado) de existing, o sea justo en la unión — "saltando" visualmente
      // ahí aunque nada del accesorio hubiera cambiado. Se mueve a `downstream`, que ahora sí
      // termina en ese punto.
      const farAccesorio = existing.accesorioFin;
      const farDiametro = existing.diametroFin;
      const farAparato = existing.aparatoFin;
      const farSifonLabel = existing.sifonLabelFin;
      existing.accesorioFin = '';
      existing.diametroFin = '';
      existing.aparatoFin = '';
      existing.sifonLabelFin = undefined;

      const netDef = NETS.find((n) => n.id === existing.net);
      const pfx = netDef ? netDef.lbl : 'R';
      const isTrib = existing.tipo === 'tributario';
      const cnt = allocNetNumber(engine, existing.net, isTrib ? 'tributario' : 'ramal', (n) =>
        isTrib
          ? engine.ramales.some((r) => r.label === `T${n}${existing.label || ''}`)
          : engine.ramales.some((r) => r.id === `${pfx}${n}` || r.label === `${pfx}${n}`),
      );
      const newId = isTrib ? 'T' + Date.now() : pfx + cnt;
      // Posición/ángulo propios de la etiqueta desde el punto medio del segmento aguas abajo —
      // extender `...existing` solo dejaba la etiqueta en la posición vieja de la porción aguas
      // arriba, aterrizando justo encima de la etiqueta propia (sin cambios) de `existing`, ya
      // que ambos objetos compartían entonces un solo punto.
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
        // El ramal auto-creado toma el mayor de los dos diámetros que formaron la unión, en
        // todas las redes (incluidas AF/AC/gas) — el tee aguas abajo sigue al ramal más ancho.
        diametro: maxDiametroLabel(existing.diametro, incoming.diametro),
        uc: preSplitExistingUc + preSplitIncomingUc,
        ini: '',
        fin: '',
        accesorioInicio: '',
        accesorioFin: farAccesorio || '',
        accMed: {},
        diametroInicio: '',
        diametroFin: farDiametro || '',
        aparatoInicio: '',
        aparatoFin: farAparato || '',
        sifonLabelFin: farSifonLabel,
        bloqueado: true,
        mergesFrom: [existing.id, incoming.id],
      };
      engine.ramales.push(downstream);
      if (farAparato && engine._loadedPlanId != null) {
        moveAparatoCount(existing.net, existing.id, newId, engine._loadedPlanId, farAparato);
      }
      break;
    }
  }
}

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
  const net = NETS.find((n) => n.id === engine.activeRamal!.net);
  const netPfx = net ? net.lbl : 'R';
  const isTrib = engine.tipoTramo === 'tributario';
  const padreLbl = isTrib
    ? (() => {
        const p = engine.ramales.find((r) => r.id === engine.padreTributario);
        return p ? p.label || p.id : '';
      })()
    : '';
  const cnt = allocNetNumber(
    engine,
    engine.activeRamal!.net,
    isTrib ? 'tributario' : 'ramal',
    (n) =>
      isTrib
        ? engine.ramales.some((r) => r.label === `T${n}${padreLbl}`)
        : engine.ramales.some((r) => r.id === `${netPfx}${n}` || r.label === `${netPfx}${n}`),
  );
  const id = isTrib ? 'T' + Date.now() : netPfx + cnt;
  const firstAngle = _firstSegmentAngle(engine.activeRamal.pts);

  const pts = engine.activeRamal.pts;
  const x1 = pts[0][0],
    y1 = pts[0][1],
    x2 = pts[1][0],
    y2 = pts[1][1];
  const midX = (x1 + x2) / 2,
    midY = (y1 + y2) / 2;
  const rad = (firstAngle * Math.PI) / 180;
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
    diametro: def.diametro || '',
    pendiente: typeof def.pendiente === 'number' ? def.pendiente : 0,
    bloqueado: true,
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
    if (r.tipo === 'tributario') {
      const t0 = touchesRamal(r.pts[0]);
      const t1 = touchesRamal(r.pts[r.pts.length - 1]);
      if (t0 && !t1) {
        flipRamalFlow(r);
      }
    }
    // Ítem 2/5: chequeo pre-push con el helper compartido (r aún no está en engine.ramales, se
    // pasa como extra). Aborto limpio: sin push, activeRamal = null + alerta.
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
  }

  // Validación pre-push (tributario de AF/AC/gas): si algún extremo del tributario nuevo toca un
  // tributario existente de la misma red con un padre seleccionado DISTINTO, se bloquea la
  // creación con una alerta. Sin esto, la alerta de padre equivocado dispara DENTRO de
  // autoSplitJunctionAndSumFlow DESPUÉS del push, así que el ramal queda comprometido y el
  // AccesorioModal igual se dispara — el trazo se completa pese a la violación. Verificar ANTES
  // del push permite abortar limpio.
  if ((r.net === 'af' || r.net === 'ac' || r.net === 'gas') && r.tipo === 'tributario') {
    const WRONG_PADRE_TOL = 0.5;
    for (const ep of r.pts) {
      for (const ex of engine.ramales) {
        if (ex.net !== r.net || ex.id === r.id) continue;
        if (!ex.pts || ex.pts.length < 2) continue;
        // Contacto extremo-con-extremo con un tributario existente
        if (
          ex.tipo === 'tributario' &&
          ex.padre !== r.padre &&
          ex.pts.some(([x, y]) => Math.hypot(x - ep[0], y - ep[1]) < WRONG_PADRE_TOL)
        ) {
          engine.triggerAlert(
            'Ramal padre incorrecto',
            'Los tributarios deben conectarse al mismo ramal padre seleccionado.',
          );
          engine.activeRamal = null;
          engine._markDirty();
          engine.render();
          return;
        }
        // Contacto extremo-con-cuerpo con un tributario existente
        if (ex.tipo === 'tributario' && ex.padre !== r.padre) {
          for (let i = 0; i < ex.pts.length - 1; i++) {
            const [ax, ay] = ex.pts[i];
            const [bx, by] = ex.pts[i + 1];
            const sdx = bx - ax;
            const sdy = by - ay;
            const lenSq = sdx * sdx + sdy * sdy;
            if (lenSq < 0.0001) continue;
            const t = ((ep[0] - ax) * sdx + (ep[1] - ay) * sdy) / lenSq;
            if (t < 0.02 || t > 0.98) continue;
            const projX = ax + t * sdx;
            const projY = ay + t * sdy;
            if (Math.hypot(ep[0] - projX, ep[1] - projY) < WRONG_PADRE_TOL) {
              engine.triggerAlert(
                'Ramal padre incorrecto',
                'Los tributarios deben conectarse al mismo ramal padre seleccionado.',
              );
              engine.activeRamal = null;
              engine._markDirty();
              engine.render();
              return;
            }
          }
        }
      }
    }
  }

  engine.ramales.push(r);
  if (!checkRamalAngles(r.pts, r.net, r.tipo, engine.snapMode)) {
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
  autoSplitJunctionAndSumFlow(engine, r);
  // Asocia el ramal con un bajante si su extremo cae en el centro del bajante. Un ramal solo
  // puede LLEGAR a un bajante (real o fantasma) — nunca EMPEZAR ahí — por pedido explícito;
  // handleLineDown ya bloquea el clic mismo de empezar un ramal fresco ahí, esto es el cinturón
  // y tirantes sobre los extremos del ramal TERMINADO (también cubre conexiones creadas por
  // arrastre). Un fantasma desplazado se empareja contra su propia posición desplazada del piso
  // actual; un fantasma sin desplazar o un bajante real emparejan en su (b.x, b.y) simple.
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
    for (const epIdx of [0, lastIdx]) {
      const isArrival = epIdx === lastIdx;
      if (!isArrival) continue;
      const ep = r.pts[epIdx];
      const baj = engine.bajantes.find((b) => {
        if (b.net !== r.net || engine._hiddenNets.has(b.net)) return false;
        // El extremo en snapMode puede aterrizar en el BORDE del círculo del bajante (proyección
        // de ángulo válido), no en el centro — la tolerancia de asociación cubre el radio del
        // símbolo para que el ramal quede igualmente conectado.
        const rimTol = (b._circ?.r || 8 * engine.zoom) / (engine.zoom || 1) + TOLLERANCE;
        if (displacedFantasmaIds.has(b.id)) {
          const disp = b.desplazamientos?.[lvl];
          const bx = b.x + (disp?.dx || 0);
          const by = b.y + (disp?.dy || 0);
          return Math.hypot(bx - ep[0], by - ep[1]) < rimTol;
        }
        return Math.hypot(b.x - ep[0], b.y - ep[1]) < rimTol;
      });
      if (baj && !baj.recibeDeIds.includes(r.id)) {
        // Guardia centralizada de dirección — un bajante 'baja' solo puede RECIBIR flujo, así
        // que nunca se permite que el INICIO de un ramal (pts[0]) se asocie con uno. Sin esto,
        // un ramal cuyo inicio dibujado por el usuario cae sobre un bajante 'baja' tomaría esa
        // asociación en silencio, creando exactamente el estado del reporte de bug (RS5-P1
        // saliendo de BAN4-P1 con dirección "Baja").
        const epIdxTyped = epIdx === 0 ? 0 : r.pts.length - 1;
        if (!isRamalBajanteConnectionAllowed(engine, r, epIdxTyped, baj)) continue;
        baj.recibeDeIds.push(r.id);
        // Auto-rellenar ini/fin del ramal
        const bajCode = baj.code || baj.id;
        if (epIdx === 0) {
          r.ini = bajCode;
        } else {
          r.fin = bajCode;
        }
      }
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

/** Cancela el dibujo del ramal activo sin persistir. @param engine Instancia del motor. */
export function cancelRamal(engine: IPlanoEngineCore): void {
  engine._yeeFlashKey = null;
  engine.activeRamal = null;
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}

/** Cancela el dibujo del área activa sin persistir. @param engine Instancia del motor. */
export function cancelArea(engine: IPlanoEngineCore): void {
  engine.activeArea = null;
  engine._emitStatus(_statusMsg(engine));
  engine.render();
}

/** Termina el polígono del área activa, calculando su área en m² y agregándola al plano.
 *  @param engine Instancia del motor. */
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
    pts: pts.map((p) => [...p]),
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
  let bestR: PlanoRamal | null = null,
    bestIdx = -1,
    bestD = Infinity;

  for (const r of engine.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length; i++) {
      const d = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
        bestR = r;
      }
    }
    if (bestD <= HIT_DIST) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const d = pointToSegmentDist(
        plane.x,
        plane.y,
        r.pts[i][0],
        r.pts[i][1],
        r.pts[i + 1][0],
        r.pts[i + 1][1],
      );
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
    engine._emitStatus(
      '⚠ No se puede eliminar un segmento intermedio. Solo se pueden eliminar extremos.',
    );
    return;
  }
  if (r.pts.length <= 2) {
    engine.ramales = engine.ramales.filter((x) => x.id !== r.id && x.padre !== r.id);
    if (r.tipo !== 'tributario') engine._renumberRamales(r.net);
    engine.selId = null;
    engine._emitSelect(null);
  } else {
    r.pts.splice(bestIdx, 1);
    r.labelAngle = _firstSegmentAngle(r.pts);
    r.totalL = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      r.totalL += engine.pxToM(
        Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]),
      );
    }
    r.totalL = +r.totalL.toFixed(3);
    const [mx, my] = _midpoint(r.pts);
    r.labelX = mx;
    r.labelY = my;
  }
  engine.render();
  engine._markDirty();
}

/** Fija la escala de dibujo (metros por píxel) y recalcula las longitudes de todos los ramales.
 *  @param engine Instancia del motor. @param v Valor de escala como string o número. */
export function setScaleM(engine: IPlanoEngineCore, v: string | number): void {
  engine.scaleM = parseFloat(String(v)) || 0.5;
  engine.ramales.forEach((r) => {
    r.totalL = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, y1] = r.pts[i],
        [x2, y2] = r.pts[i + 1];
      r.totalL += engine.pxToM(Math.hypot(x2 - x1, y2 - y1));
    }
    r.totalL = +r.totalL.toFixed(3);
  });
  engine.render();
}

/** Fija la escala de referencia definida por el usuario (p.ej. desde una dimensión conocida del
 *  PDF) sin recalcular longitudes. @param engine Instancia del motor. @param v Valor de escala
 *  como string o número. */
export function setDefinedScaleM(engine: IPlanoEngineCore, v: string | number): void {
  engine.definedScaleM = parseFloat(String(v)) || 0;
  engine.render();
}

function checkCrossRamalAngle(
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

/** Maneja un clic con la herramienta de línea activa: empieza un ramal nuevo, continúa uno
 *  existente o agrega un segmento con validación de ángulo/intersección. @param engine Instancia
 *  del motor. @param px Coordenada X de plano. @param py Coordenada Y de plano. */
export function handleLineDown(engine: IPlanoEngineCore, px: number, py: number): void {
  let pt: { x: number; y: number } = { x: px, y: py };
  if (engine.tipoTramo === 'tributario' && !engine.padreTributario) {
    engine._emitStatus('Selecciona primero un ramal PADRE en el panel derecho');
    return;
  }
  if (!engine.activeRamal) {
    // Buscar un ramal existente para CONTINUAR antes de hacer cualquier snap genérico — esto
    // debe ganarle a snapToExisting eligiendo un objetivo cercano-pero-distinto (p.ej. un
    // bajante desplazado lejos de este mismo extremo); si no, clicar de vuelta sobre un extremo
    // que lleva un accesorio empieza en silencio un ramal nuevo no relacionado en vez de
    // continuar el existente.
    let activeNetsRamales = engine.ramales.filter((rm) => rm.net === engine.activeNet);
    if (engine.tipoTramo === 'tributario') {
      // Continuar un tributario existente (desde su propio extremo) debe seguir siendo posible,
      // no solo continuar el padre mismo — restringir solo a `id === padreTributario` hacía que
      // clicar cerca del extremo de un tributario existente cayera en "empezar un ramal nuevo"
      // en vez de extenderlo.
      activeNetsRamales = activeNetsRamales.filter(
        (rm) =>
          rm.id === engine.padreTributario ||
          (rm.tipo === 'tributario' && rm.padre === engine.padreTributario),
      );
    }
    let continueRamal: PlanoRamal | null = null;
    let reversePoints = false;
    const CONTINUE_THRESH = 30 / engine.zoom;
    // ini/fin están sobrecargados: autoDetectRamalConnections (PlanoEngineNetwork.ts) escribe
    // ahí el código de un bajante cuando el extremo descarga en uno, pero TAMBIÉN escribe el
    // label/id de un ramal vecino cuando solo toca otro ramal (sin bajante) — y ese segundo caso
    // corre automáticamente en cada _markDirty(), o sea justo después de terminar cualquier
    // ramal. Solo el caso del bajante debe bloquear la continuación; un extremo que solo toca
    // otro ramal debe seguir siendo continuable.
    const isBajanteCode = (v: string) => engine.bajantes.some((b) => (b.code || b.id) === v);
    for (const rm of activeNetsRamales) {
      const firstPt = rm.pts[0];
      const lastPt = rm.pts[rm.pts.length - 1];
      const dFirst = Math.hypot(px - firstPt[0], py - firstPt[1]);
      const dLast = Math.hypot(px - lastPt[0], py - lastPt[1]);
      // Un extremo que ya descarga en un bajante (rm.ini/fin tiene el código del bajante) NO
      // debe tratarse como objetivo de "continuar este ramal" — eso dejaba pasar un clic ahí
      // por el bloque de no-empezar-sobre-bajante de abajo (continueRamal gana primero), igual
      // que clicar el círculo del propio bajante quedaría bloqueado. En su lugar cae al
      // chequeo de bajante más abajo, que lo atrapa y alerta.
      if (dFirst < CONTINUE_THRESH && dFirst <= dLast) {
        if (rm.ini && isBajanteCode(rm.ini)) continue;
        continueRamal = rm;
        reversePoints = true;
        break;
      } else if (dLast < CONTINUE_THRESH) {
        if (rm.fin && isBajanteCode(rm.fin)) continue;
        continueRamal = rm;
        break;
      }
    }

    if (continueRamal) {
      if (reversePoints) {
        if (continueRamal.tipo === 'tributario') {
          // Tributario: invertir solo el orden de pts para que la herramienta extienda desde el
          // lado clicado. La bandera _tribReversed deja que el renderer corrija la flecha de
          // dirección de flujo.
          continueRamal.pts = [...continueRamal.pts].reverse();
          continueRamal._tribReversed = !continueRamal._tribReversed;
        } else {
          if (continueRamal.accesorioInicio === 'sifon') {
            engine.triggerAlert(
              'Dirección de flujo inválida',
              'No se puede continuar así: el sifón quedaría recibiendo flujo entrante.',
            );
            return;
          }
          if (
            continueRamal.accesorioFin === 'teeLlaveTerminal' ||
            continueRamal.accesorioFin === 'llaveTerminal'
          ) {
            engine.triggerAlert(
              'Dirección de flujo inválida',
              'No se puede continuar así: la llave terminal quedaría con flujo saliendo hacia otro tramo.',
            );
            return;
          }
          reverseRamalEndpoints(continueRamal);
        }
      }

      // Si el punto desde el que continuamos lleva un accesorio de extremo, convertirlo a un
      // accesorio fijo de mitad de ramal (accMed) antes de que deje de ser el último punto.
      if (continueRamal.accesorioFin) {
        const oldLastIdx = continueRamal.pts.length - 1;
        continueRamal.accMed = {
          ...(continueRamal.accMed || {}),
          [`accMed${oldLastIdx}`]: continueRamal.accesorioFin,
        };
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

    // Un ramal solo puede LLEGAR a un bajante — real (de su piso) o fantasma (de cualquier
    // tipo) — nunca EMPEZAR ahí. Se verifica contra el clic crudo (antes de cualquier snap):
    // simplemente quitar el snap-a-bajante de abajo no basta, porque el punto crudo del clic ya
    // está justo encima del círculo y aun así empezaría un ramal ahí, solo que sin asociar. Se
    // bloquea de plano. Usa los mismos círculos de acierto cacheados (_circ para el bajante
    // real, _ghost para cualquier fantasma) que el pase de render ya calcula cada frame, así
    // que siempre coincide exactamente con lo que está en pantalla.
    {
      const rawC = engine.toCvs(pt.x, pt.y);
      const onBajante = engine.bajantes.some((b) => {
        if (!netsSnapLinked(b.net, engine.activeNet) || engine._hiddenNets.has(b.net)) return false;
        if (
          b.tipo === 'canal'
            ? canalRectHitDistance(b, rawC.x, rawC.y, 6 * engine.zoom) < Infinity
            : b._circ &&
              Math.hypot(b._circ.x - rawC.x, b._circ.y - rawC.y) < b._circ.r + 6 * engine.zoom
        )
          return true;
        return false;
      });
      const onFantasma =
        !onBajante &&
        engine.getBajantesFantasma().some((b) => {
          if (!netsSnapLinked(b.net, engine.activeNet)) return false;
          if (!b._ghost) return false;
          return (
            Math.hypot(b._ghost.x - rawC.x, b._ghost.y - rawC.y) < b._ghost.r + 6 * engine.zoom
          );
        });
      if (onBajante || onFantasma) {
        engine.triggerAlert(
          'No se puede iniciar aquí',
          'Un ramal solo puede conectarse a un bajante como punto de llegada. Empieza el trazo en otro punto y termínalo en el bajante.',
        );
        return;
      }
    }

    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) {
      // snapToExisting felizmente pega a CUALQUIER vértice de ramal cercano, sin importar qué
      // ramal se eligió como padre del tributario — así un clic cerca de un ramal distinto al
      // padre seleccionado creaba en silencio el tributario contra el equivocado. Bloquearlo.
      if (engine.tipoTramo === 'tributario') {
        const snappedRamal = engine.ramales.find(
          (r) =>
            r.net === engine.activeNet &&
            r.pts.some(([rx, ry]) => Math.hypot(rx - sp.x, ry - sp.y) < 0.5),
        );
        if (snappedRamal && snappedRamal.id !== engine.padreTributario) {
          if (canJoinTributario(engine, snappedRamal)) {
            pt = sp;
          } else {
            engine.triggerAlert(
              'Ramal padre incorrecto',
              'Solo puedes conectar el tributario al ramal padre seleccionado.',
            );
            return;
          }
        }
      }
      // Un ramal de ventilación que empieza exactamente sobre un punto de sanitaria (unión de
      // codo reventilado) debe tener su PRIMER segmento siguiendo la dirección local de la
      // tubería sanitaria ahí — no un ángulo arbitrario de la cuadrícula de 45°. Se busca qué
      // segmento san es dueño de este vértice y se recuerda su orientación; se consume (y
      // limpia) en cuanto se coloca el primer segmento, abajo.
      engine._ventFirstSegDir = null;
      if (engine.activeNet === 'vent') {
        for (const sr of engine.ramales) {
          if (sr.net !== 'san' || !sr.pts?.length) continue;
          const idx = sr.pts.findIndex(([sx, sy]) => Math.hypot(sx - sp.x, sy - sp.y) < 0.5);
          if (idx === -1) continue;
          const a = idx > 0 ? sr.pts[idx - 1] : sr.pts[idx + 1];
          const b = sr.pts[idx];
          if (a && b) {
            const ddx = b[0] - a[0],
              ddy = b[1] - a[1];
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
      let segSnapPt: { x: number; y: number } | null = null;
      const SNAP_THRESH = 12 / engine.zoom;

      for (const r of activeNetsRamales) {
        const segSnap = engine._snapToSegment(pt.x, pt.y, r.pts, SNAP_THRESH);
        if (segSnap) {
          onSegmentRamal = r;
          segSnapPt = segSnap;
          break;
        }
      }

      if (onSegmentRamal) {
        // El mismo clic que dispararía la guardia de padre por vértice arriba, solo que cae
        // sobre el CUERPO del ramal en vez de un vértice — debe mostrar el mismo modal, no el
        // texto genérico no relacionado de "no puedes iniciar sobre un segmento" (que para un
        // tributario confunde: el problema real es sobre QUÉ ramal cae, no que caiga sobre un
        // segmento).
        if (engine.tipoTramo === 'tributario') {
          if (canJoinTributario(engine, onSegmentRamal)) {
            if (segSnapPt) pt = segSnapPt;
          } else {
            engine.triggerAlert(
              'Ramal padre incorrecto',
              'Solo puedes conectar el tributario al ramal padre seleccionado.',
            );
            return;
          }
        } else {
          engine._emitStatus(
            'No puedes iniciar un ramal sobre un segmento. Inicia en espacio libre o en un vértice.',
          );
          return;
        }
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

    // Guardar la posición cruda del cursor ANTES del snap para el chequeo de proximidad al
    // bajante
    const rawPt = { x: pt.x, y: pt.y };

    let snappedToSeg = false;
    if (engine._ventFirstSegDir && engine.activeRamal.pts.length === 1) {
      // Primer segmento de un ramal de ventilación que empezó en un codo reventilado — se
      // bloquea a la orientación propia del ramal sanitario ahí, en vez de la cuadrícula
      // genérica de 45°. Solo aplica a este segmento; se consume de inmediato para que los
      // segmentos siguientes peguen normal.
      const dirv = engine._ventFirstSegDir;
      const relX = pt.x - last[0],
        relY = pt.y - last[1];
      const relLen = Math.hypot(relX, relY);
      if (relLen > 0.01) {
        const proj = relX * dirv.x + relY * dirv.y;
        const perpDist = Math.abs(relX * dirv.y - relY * dirv.x);
        if (perpDist / relLen > 0.15) {
          engine.triggerAlert(
            'Ángulo bloqueado',
            'El primer trazo de ventilación en un codo reventilado sigue la dirección del ramal sanitario — no puede cambiar de ángulo aquí.',
          );
        }
        // Conservar la distancia real del cursor (relLen) como largo del segmento, solo la
        // DIRECCIÓN se bloquea a dirv — proyectar solo a `proj` colapsaba el segmento a casi
        // cero cuando el cursor se movía casi perpendicular a dirv, creando un punto
        // degenerado de longitud cero.
        const sign = proj >= 0 ? 1 : -1;
        pt = { x: last[0] + dirv.x * relLen * sign, y: last[1] + dirv.y * relLen * sign };
      }
      engine._ventFirstSegDir = null;
    } else if (engine.snapMode) {
      pt = engine.snapAngle(
        last[0],
        last[1],
        pt.x,
        pt.y,
        engine.activeRamal.net,
        engine.activeRamal.tipo,
      );
    }

    const activeRamales =
      engine.tipoTramo === 'tributario'
        ? engine.ramales.filter(
            (r) =>
              r.id === engine.padreTributario ||
              (r.tipo === 'tributario' && r.net === engine.activeNet),
          )
        : engine.ramales.filter((r) => r.net === engine.activeNet);
    for (const r of activeRamales) {
      if (r.id === engine.activeRamal.id) continue;
      let sp = null;
      if (engine.snapMode && r.id === engine.padreTributario) {
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
        // La misma guardia que la rama de "empezar un tributario nuevo" arriba —
        // snapToExisting no tiene restricciones y felizmente pega a CUALQUIER vértice de ramal,
        // no solo al padre seleccionado. Sin esto, clicar cerca de un ramal distinto mientras se
        // continúa un tributario en curso se enganchaba en silencio al ramal equivocado (o caía
        // al chequeo de ángulo, que disparaba una alerta "Ángulo no recomendado" no relacionada
        // en vez de explicar el problema real).
        if (engine.tipoTramo === 'tributario') {
          const snappedRamal = engine.ramales.find(
            (r) =>
              r.net === engine.activeNet &&
              r.id !== engine.activeRamal!.id &&
              r.pts.some(([rx, ry]) => Math.hypot(rx - sp.x, ry - sp.y) < 0.5),
          );
          if (snappedRamal && snappedRamal.id !== engine.padreTributario) {
            if (!canJoinTributario(engine, snappedRamal)) {
              engine.triggerAlert(
                'Ramal padre incorrecto',
                'Solo puedes conectar el tributario al ramal padre seleccionado.',
              );
              return;
            }
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
      // Bajante es el ancla: el ramal se adapta a su posición, el bajante nunca se mueve.
      if (!engine.snapMode) {
        // Sin snap: conectar directo al centro del bajante.
        pt = { x: bx, y: by };
      } else {
        const snappedPt = engine.snapAngle(
          last[0],
          last[1],
          bx,
          by,
          engine.activeRamal.net,
          engine.activeRamal.tipo,
        );
        if (Math.hypot(snappedPt.x - bx, snappedPt.y - by) < 1) {
          // El bajante está sobre un ángulo válido → snap exacto al centro (conectado).
          pt = { x: bx, y: by };
        } else {
          // El bajante NO está sobre el snap grid: proyectar el extremo sobre un rayo FIJO desde
          // `last` casi nunca pasa justo por el centro, dejando el ramal cerca pero sin conectar
          // (el bug reportado). En vez de eso, el segmento entero se DESPLAZA en paralelo — se
          // mueve tanto el vértice anterior (`last`) como el nuevo extremo por el mismo delta
          // perpendicular — hasta quedar exactamente sobre el bajante. El ángulo/dirección del
          // segmento se preserva intacto, solo cambia su posición.
          const dx = snappedPt.x - last[0],
            dy = snappedPt.y - last[1];
          const dlen = Math.hypot(dx, dy) || 1;
          const ux = dx / dlen,
            uy = dy / dlen;
          // Normal unitaria al rayo (perpendicular a la dirección válida).
          const nx = -uy,
            ny = ux;
          const perp = (bx - last[0]) * nx + (by - last[1]) * ny;
          const lastIdx = engine.activeRamal.pts.length - 1;
          engine.activeRamal.pts[lastIdx] = [last[0] + perp * nx, last[1] + perp * ny];
          pt = { x: bx, y: by };
          // Si el desplazamiento resultante rompe el ángulo del segmento ANTERIOR (cuando ya
          // había más de un punto), el chequeo de ángulos más abajo rechaza el trazo completo con
          // la alerta habitual — no se corrompe silenciosamente un ramal de varios tramos.
        }
      }
    }
    if (engine.activeRamal.pts.length >= 2) {
      const testPts = [...engine.activeRamal.pts, [pt.x, pt.y]];
      if (!checkRamalAngles(testPts, engine.activeNet, engine.activeRamal.tipo, engine.snapMode)) {
        engine.triggerAlert(
          'Ángulo no recomendado',
          engine.activeNet === 'san' || engine.activeNet === 'll'
            ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.'
            : (engine.activeNet === 'af' || engine.activeNet === 'ac') &&
                engine.activeRamal.tipo === 'tributario'
              ? 'Los tributarios de AF/AC solo permiten ángulos de 90°. Usar línea guía para ajustar ángulo.'
              : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
        );
        return;
      }
    }

    // Chequear intersección de segmentos con ramales existentes de la misma red
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
              // Un tributario que cruza cualquier ramal distinto a su padre es la violación de
              // padre, no un cruce genérico — este chequeo geométrico corrió ANTES de que el
              // chequeo de padre por snap-de-vértice de arriba tuviera oportunidad (ese solo
              // dispara con coincidencia exacta de vértice; un mero cruce a través del cuerpo del
              // ramal equivocado no termina exactamente en un vértice, así que caía aquí primero
              // con un mensaje que no explicaba el problema real).
              if (engine.tipoTramo === 'tributario' && r.id !== engine.padreTributario) {
                if (canJoinTributario(engine, r)) {
                  // Contacto tributario-a-tributario del mismo padre — permitido (el punto de
                  // unión recibe su símbolo de accesorio vía el flujo AccesorioModal).
                } else {
                  engine.triggerAlert(
                    'Ramal padre incorrecto',
                    'Solo puedes conectar el tributario al ramal padre seleccionado.',
                  );
                  return;
                }
              } else {
                engine.triggerAlert(
                  'Cruce de líneas no permitido',
                  'El trazo cruza otro trazo de la misma red. No se permite el cruce de líneas en la misma cota de dibujo.',
                );
                return;
              }
            }
          }
        }
      }
    }
    engine.activeRamal.pts.push([pt.x, pt.y]);
    engine.activeRamal.totalL = calculateRamalLength(engine.activeRamal.pts, engine);

    // Chequeo de tee entre ramales: validar el ángulo entre el ramal activo y cualquier ramal
    // existente
    {
      const ppts = engine.activeRamal.pts;
      const lastIdx = ppts.length - 1;
      if (
        lastIdx >= 1 &&
        !checkCrossRamalAngle(engine, ppts[lastIdx - 1], ppts[lastIdx], engine.activeRamal.id || '')
      ) {
        engine.activeRamal.pts.pop();
        engine.activeRamal.totalL = calculateRamalLength(engine.activeRamal.pts, engine);
        engine._markDirty();
        engine.render();
        return;
      }
      // Primer segmento: el punto de conexión es pts[0], así que se pasa pts[1] como pA y pts[0]
      // como pB
      if (
        lastIdx >= 2 &&
        !checkCrossRamalAngle(engine, ppts[1], ppts[0], engine.activeRamal.id || '')
      ) {
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

/** Maneja un clic con la herramienta de cota activa: fija el punto inicial en el primer clic y
 *  crea la línea de cota en el segundo. @param engine Instancia del motor. @param px Coordenada
 *  X de plano. @param py Coordenada Y de plano. */
export function handleDimDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!engine._dimStart) {
    engine._dimStart = { x: px, y: py };
  } else {
    const s = engine._dimStart;
    const len = Math.hypot(px - s.x, py - s.y);
    engine.dims.push({
      id: 'D' + Date.now(),
      x1: s.x,
      y1: s.y,
      x2: px,
      y2: py,
      L: engine.pxToM(len),
    });
    engine._dimStart = null;
    engine.render();
  }
}

/** Maneja un clic con la herramienta de línea guía activa: fija el punto inicial en el primer
 *  clic y crea la línea guía (libre, sin pegar a ningún ramal) en el segundo, etiquetada con la
 *  red actualmente activa para que sus acciones posteriores de rotar/convertir-a-ramal sepan
 *  qué reglas de ángulo aplican. */
export function handleGuideDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!engine._guideStart) {
    engine._guideStart = { x: px, y: py };
  } else {
    const s = engine._guideStart;
    engine.guideLines.push({
      id: 'GL' + Date.now(),
      net: engine.activeNet,
      pts: [
        [s.x, s.y],
        [px, py],
      ],
    });
    engine._guideStart = null;
    engine.render();
    engine._markDirty();
  }
}

/** Coloca una anotación de texto en las coordenadas de plano dadas, pidiendo el contenido al
 *  usuario. @param engine Instancia del motor. @param px Coordenada X de plano. @param py
 *  Coordenada Y de plano. */
export function handleTextDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine._onRequestTextCb) {
    engine._onRequestTextCb(px, py, (t: string) => {
      if (t) {
        const tid = 'T' + Date.now();
        engine.textAnnots.push({
          id: tid,
          x: px,
          y: py,
          text: t,
          fontMm: 2.5,
          boxW: 0,
          lblOffX: 0,
          lblOffY: 0,
          textAngle: 0,
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
        id: tid2,
        x: px,
        y: py,
        text: t,
        fontMm: 2.5,
        boxW: 0,
        lblOffX: 0,
        lblOffY: 0,
        textAngle: 0,
      });
    }
  }

  engine.render();
  engine._markDirty();
}

/** Maneja un clic con la herramienta de borrar activa: selecciona el elemento bajo el cursor y
 *  lo borra o recorta un segmento de extremo de ramal. @param engine Instancia del motor.
 *  @param cx Coordenada X de canvas. @param cy Coordenada Y de canvas. */
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
  const isGuide = engine.guideLines.some((g) => g.id === selId);
  const tipo = (sel as Partial<PlanoBajante & PlanoRamal>).tipo;

  if (
    tipo === 'bajante' ||
    tipo === 'montante' ||
    tipo === 'red_publica' ||
    tipo === 'contador' ||
    tipo === 'calentador' ||
    tipo === 'canal' ||
    isArea ||
    isText ||
    isGuide ||
    selId.startsWith('DIM')
  ) {
    engine.deleteSelected();
    engine._emitSelect(null);
    engine.selId = null;
    engine._emitStatus('Elemento eliminado');
    engine.render();
    engine._markDirty();
    return;
  }

  if (tipo === 'ramal' || tipo === 'tributario') {
    eraseRamalAt(engine, sel as PlanoRamal, cx, cy);
    return;
  }
}

/**
 * Aplica la regla de "recortar-o-borrar" del borrador a un ramal SIN pasar por selectAt primero
 * — lo necesita el manejador de teclado, que ya tiene `sel` (el ramal seleccionado por el
 * usuario) y la última posición del cursor, y perdería su selección al volver a ejecutar
 * selectAt contra un punto arbitrario del canvas. Misma lógica de recorte/borrado que la rama de
 * ramal de handleEraseDown.
 */
export function eraseRamalAt(
  engine: IPlanoEngineCore,
  r: PlanoRamal,
  cx: number,
  cy: number,
): void {
  const plane = engine.toPlane(cx, cy);
  const HIT_DIST = 10 / engine.zoom;

  let bestIdx = -1,
    bestD = Infinity;
  for (let i = 0; i < r.pts.length; i++) {
    const d = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
    if (d < bestD) {
      bestD = d;
      bestIdx = i;
    }
  }
  if (bestD > HIT_DIST) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const d = pointToSegmentDist(
        plane.x,
        plane.y,
        r.pts[i][0],
        r.pts[i][1],
        r.pts[i + 1][0],
        r.pts[i + 1][1],
      );
      if (d < bestD) {
        bestD = d;
        const dA = Math.hypot(plane.x - r.pts[i][0], plane.y - r.pts[i][1]);
        const dB = Math.hypot(plane.x - r.pts[i + 1][0], plane.y - r.pts[i + 1][1]);
        bestIdx = dA <= dB ? i : i + 1;
      }
    }
  }

  // Si tiene más de 2 puntos y se hizo clic en un segmento extremo, recorta el extremo
  const isEndpoint = bestIdx === 0 || bestIdx === r.pts.length - 1;
  const canTrim = r.pts.length > 2;
  if (!isEndpoint && canTrim) {
    const d0 = Math.hypot(plane.x - r.pts[0][0], plane.y - r.pts[0][1]);
    const dLast = Math.hypot(
      plane.x - r.pts[r.pts.length - 1][0],
      plane.y - r.pts[r.pts.length - 1][1],
    );
    bestIdx = d0 <= dLast ? 0 : r.pts.length - 1;
  }
  if (canTrim && (bestIdx === 0 || bestIdx === r.pts.length - 1)) {
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
}

/** Maneja un clic con la herramienta de área activa: empieza un polígono nuevo o agrega un
 *  vértice; cierra cuando está cerca del punto inicial. @param engine Instancia del motor.
 *  @param px Coordenada X de plano. @param py Coordenada Y de plano. */
export function handleAreaDown(engine: IPlanoEngineCore, px: number, py: number): void {
  let pt: { x: number; y: number } = { x: px, y: py };
  if (!engine.activeArea) {
    if (engine.snapMode) pt = engine.snapAngle(px, py, pt.x, pt.y);
    const netCol =
      (NETS.find((n) => n.id === engine.activeNet)?.col || 'rgba(0,220,229,0.2)') + '33';
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

/** Pide un render al mover el mouse cuando hay un dibujo activo (ramal, cota o área) en curso.
 *  @param engine Instancia del motor. @param x Coordenada X de canvas. @param y Coordenada Y de
 *  canvas. */
export function handleDrawingMouseMove(engine: IPlanoEngineCore, x: number, y: number): void {
  if (
    engine.activeRamal ||
    engine._dimStart ||
    engine._guideStart ||
    engine._canalStart ||
    engine.activeArea
  ) {
    engine.mouseX = x;
    engine.mouseY = y;
    engine.scheduleRender();
  }
}

/** Termina el ramal o área activos al hacer doble clic. @param engine Instancia del motor. */
export function handleDoubleClick(engine: IPlanoEngineCore): void {
  if (engine.tool === 'line' && engine.activeRamal && engine.activeRamal.pts.length >= 2) {
    finishRamal(engine);
  }
  if (engine.tool === 'area' && engine.activeArea && engine.activeArea.pts.length >= 3) {
    finishArea(engine);
  }
}
