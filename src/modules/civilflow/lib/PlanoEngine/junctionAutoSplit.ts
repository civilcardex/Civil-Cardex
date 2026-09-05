import {
  NETS,
  allocNetNumber,
  allocTributaryNumber,
  rootTributarioLabel,
  uniqRamalId,
} from './PlanoState';
import type { PlanoRamal, IPlanoEngineCore } from './PlanoState';
import { _firstSegmentAngle, angleAtHalfLength, checkRamalAngles } from './drawingAngles';
import { junctionHasIncomingFlow, junctionHasOutgoingFlow } from '../../utils/flowDirection';
import { ramalFlowDirectionCheck } from './drawingFlow';
import { moveAparatoCount } from '../../utils/syncExtremeAccessory';
import { _statusMsg, calculateRamalLength } from './ramalMeasure';
import { _midpoint, maxDiametroLabel, bumpBajanteToMaxRamal } from './drawingUtils';

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
/** ¿Puede unirse un tributario al ramal destino? Solo si ambos son tributarios — la regla de igualdad de padre se valida aguas arriba. */
export function canJoinTributario(engine: IPlanoEngineCore, target: PlanoRamal): boolean {
  if (engine.tipoTramo !== 'tributario') return false;
  if (target.tipo !== 'tributario') return false;
  return true;
}

/** Invierte la dirección de flujo de un ramal existente EN EL SITIO — misma operación que el
 *  botón "Invertir dirección de flujo" del menú contextual, para redes donde la flecha se
 *  deriva del orden de los puntos (san/ll/vent). NO sirve para af/ac/gas (su dirección real
 *  es un flag aparte). Aplicarla dos veces restaura el estado original. */

/** Divide el ramal existente cuando el extremo de `incoming` cae a mitad de su cuerpo, acumulando
 *  caudal/diámetro en el downstream. @returns true si la conexión fue BLOQUEADA por la regla
 *  "los ramales no se conectan a tributarios" (ya alertó al usuario): el caller debe revertir el
 *  arrastre o retirar el ramal. Antes esto viajaba en una bandera de instancia que las rutas de
 *  drag/guía nunca consumían — el siguiente ramal válido terminaba borrado por la bandera residual. */
export function autoSplitJunctionAndSumFlow(
  engine: IPlanoEngineCore,
  incoming: PlanoRamal,
): boolean {
  if (!incoming.pts || incoming.pts.length < 2) return false;
  const TOL = 0.5;
  // San + vent comparten uniones como una sola subred — permitir también la detección de
  // extremos entre redes aquí.
  const sameNetGroup = (a: string, b: string) =>
    a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
  const endpoints = [incoming.pts[0], incoming.pts[incoming.pts.length - 1]];
  for (const ep of endpoints) {
    // ¿El punto coincide TAMBIÉN con el vértice de un ramal normal? Entonces la
    // conexión real es ramal-a-ramal; un tributario que comparte ese vértice (p.ej.
    // porque aterrizó ahí antes) no debe disparar "Los ramales no se conectan a
    // tributarios" al extender el ramal desde ese extremo.
    const alsoNormalRamalHere = engine.ramales.some(
      (ex) =>
        ex.id !== incoming.id &&
        sameNetGroup(ex.net, incoming.net) &&
        ex.tipo !== 'tributario' &&
        !!ex.pts &&
        ex.pts.some(([x, y]) => Math.hypot(x - ep[0], y - ep[1]) < TOL),
    );
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
          // Ítem 7/2/3: un tributario puede unirse al extremo de OTRO tributario en cualquier
          // red (no solo af/ac/gas), sin exigir el mismo ramal padre — para dibujar un tributario
          // conectado a otro tributario. El símbolo de la unión lo genera el flujo AccesorioModal.
          const tribToTribOk = existing.tipo === 'tributario';
          if (incoming.padre && existing.id !== incoming.padre && !tribToTribOk) {
            // Advertencia "Ramal padre incorrecto" inhabilitada (orig. usuario) — el padre se
            // autodetecta; la conexión no se bloquea.
          }
        }
        // Regla del usuario: un RAMAL no se conecta al vértice de un TRIBUTARIO (salvo que el
        // punto sea también vértice de un ramal normal — la conexión real es ramal-a-ramal,
        // ver alsoNormalRamalHere). Retorno bloqueado: el caller revierte/retira el ramal.
        // Los tributarios sí pueden unirse entre sí (tribToTribOk).
        else if (
          incoming.tipo === 'ramal' &&
          existing.tipo === 'tributario' &&
          !alsoNormalRamalHere
        ) {
          engine.triggerAlert('Conexión no permitida', 'Los ramales no se conectan a tributarios.');
          return true;
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
        // Cuando el incoming aterriza a mitad de cuerpo de `existing` (segIdx >= 0), es un SPLIT
        // de unión: la dirección del incoming se auto-orienta en el split de abajo (misma
        // convención que af/ac/gas) y el ramal se parte en dos — el check de flujo san no
        // aplica aquí. Sin esto, dibujar un ramal/tributario sobre el cuerpo de otro en san se
        // bloqueaba con "Dirección de flujo incorrecta" y el split nunca ocurría (bug: no se
        // partían). Lo mismo para trib-trib (id. comentario previo).
        const isSplitBody = segIdx >= 0;
        const isTribTrib = existing.tipo === 'tributario' && incoming.tipo === 'tributario';
        // Solo tributarios se auto-orientan al aterrizar en cuerpo — ramales deben validar flujo.
        // Excepción: ramal creado desde LÍNEA GUÍA (_guideTributary) cruzando el cuerpo —
        // resolveRamalEndsFromGuide ya lo orientó drenando hacia el cruce; el chequeo aquí
        // bloqueaba el split y dejaba el ramal suelto con la flecha invertida (orig. usuario).
        const skipSplitFlow =
          (isSplitBody && incoming.tipo === 'tributario') ||
          isTribTrib ||
          (isSplitBody && !!(engine as unknown as { _guideTributary?: boolean })._guideTributary);
        const flowErr = skipSplitFlow ? null : ramalFlowDirectionCheck(engine, incoming, [], TOL);
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
      } else if (
        (incoming.net === 'af' || incoming.net === 'ac' || incoming.net === 'gas') &&
        !junctionHasIncomingFlow(engine.ramales, incoming.net, ep, TOL)
      ) {
        engine.triggerAlert(
          'Conexión sin entrada',
          'Toda conexión en esta red debe tener al menos un ramal con dirección de flujo entrando a ella.',
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
        const tribToTribOk = existing.tipo === 'tributario';
        // Un tributario creado desde LÍNEA GUÍA ya lleva su padre fijado al ramal que cruza
        // (buildTribFromGuide) — no debe bloquearse por tocar otro ramal en el mismo punto
        // (orig. #5). Solo el dibujo manual con padre seleccionado en la barra valida contra él.
        if (
          incoming.padre &&
          existing.id !== incoming.padre &&
          !tribToTribOk &&
          !(engine as unknown as { _guideTributary?: boolean })._guideTributary
        ) {
          // Advertencia "Ramal padre incorrecto" inhabilitada — la conexión sigue sin bloquearse.
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
        // Los ramales no se conectan a tributarios: un ramal principal que cae a mitad de
        // cuerpo sobre un tributario debe bloquearse con alerta (antes continuaba en silencio,
        // y la división heredaba `tipo: 'tributario'` cargando UC/UD fusionados mal etiquetados).
        // Retorno bloqueado: el caller revierte/retira el ramal (punto sin mutaciones aún).
        if (incoming.tipo === 'ramal') {
          engine.triggerAlert('Conexión no permitida', 'Los ramales no se conectan a tributarios.');
          return true;
        }
        // Tributario-a-tributario (ítem 7/2/3): permitido en cualquier red y sin exigir el mismo
        // ramal padre. Un tributario SÍ puede partir (splitear) a otro tributario: el tramo que
        // cae a mitad de cuerpo del tributario existente lo divide igual que un ramal, creando
        // el `downstream` correspondiente. No cortamos aquí — dejamos fluir al split de abajo.
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
      if (!existing.labelMoved) existing.labelAngle = angleAtHalfLength(existing.pts);
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
      // Numeración CONTRA LA RAÍZ (ítem 10/2): un tributario cuyo padre es otro tributario se
      // numera contra el ramal raíz con consecutivo global — T5RS1, nunca T1T1RS1. `allocTributaryNumber`
      // ya salta labels existentes, así que el consecutivo no colisiona con los tributarios
      // directos del raíz.
      const rootLabel = isTrib ? rootTributarioLabel(engine.ramales, existing.id) : '';
      const cnt = isTrib
        ? allocTributaryNumber(engine, rootLabel)
        : allocNetNumber(engine, existing.net, 'ramal', (n) =>
            engine.ramales.some((r) => r.id === `${pfx}${n}` || r.label === `${pfx}${n}`),
          );
      const newId = isTrib ? uniqRamalId() : pfx + cnt;
      // Posición/ángulo propios de la etiqueta desde el punto medio del segmento aguas abajo —
      // extender `...existing` solo dejaba la etiqueta en la posición vieja de la porción aguas
      // arriba, aterrizando justo encima de la etiqueta propia (sin cambios) de `existing`, ya
      // que ambos objetos compartían entonces un solo punto.
      const [downLabelX, downLabelY] = _midpoint(downstreamPts);
      const downLabelAngle = angleAtHalfLength(downstreamPts);
      const downstream: PlanoRamal = {
        ...existing,
        id: newId,
        pts: downstreamPts,
        totalL: calculateRamalLength(downstreamPts, engine),
        label: isTrib ? `T${cnt}${rootLabel}` : `${pfx}${cnt}`,
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
        // El tramo resultante de un split debe ser EDITABLE (mover, etiqueta, etc.) — si hereda
        // `bloqueado:true` (caso tributario, que se crea bloqueado), el usuario no puede mover su
        // etiqueta ni arrastrarlo, solo seleccionarlo. Ítem usuario.
        bloqueado: isTrib ? false : true,
        mergesFrom: [existing.id, incoming.id],
      };
      engine.ramales.push(downstream);
      // El padre real de un tributario que parte a su padre es el ramal AUTO-CREADO
      // (downstream): la unión queda en su nacimiento y es él quien recibe la descarga y
      // acumula el caudal. Sin esto, padre y label seguían apuntando al tramo aguas arriba
      // (T2RS9) aunque el tributario drena al segmento nuevo (RS8) — etiqueta equivocada en
      // el plano (orig. usuario).
      if (incoming.tipo === 'tributario') {
        incoming.padre = downstream.id;
        const rootLbl =
          (isTrib ? rootTributarioLabel(engine.ramales, downstream.id) : '') ||
          downstream.label ||
          downstream.id;
        incoming.label = `T${allocTributaryNumber(engine, rootLbl)}${rootLbl}`;
      }
      if (farAparato && engine._loadedPlanId != null) {
        moveAparatoCount(existing.net, existing.id, newId, engine._loadedPlanId, farAparato);
      }
      // SPLIT + BAJANTE: asocia automáticamente al nuevo ramal aguas abajo para que no aparezca verde
      // y quede checkeado en ambas secciones (ramal: bajantes asociados / bajante: ramales asociados)
      // Se basa en topología: si el bajante estaba en existing o está geométricamente sobre el tramo aguas abajo
      const TOL_B = 2.0;
      const distToSeg = (pts: number[][], bx: number, by: number): number => {
        let min = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
          const A = pts[i],
            B = pts[i + 1];
          const dx = B[0] - A[0],
            dy = B[1] - A[1];
          const len2 = dx * dx + dy * dy;
          if (len2 < 1e-9) {
            min = Math.min(min, Math.hypot(bx - A[0], by - A[1]));
            continue;
          }
          const t = Math.max(0, Math.min(1, ((bx - A[0]) * dx + (by - A[1]) * dy) / len2));
          const px = A[0] + t * dx,
            py = A[1] + t * dy;
          min = Math.min(min, Math.hypot(bx - px, by - py));
        }
        min = Math.min(min, Math.hypot(bx - pts[0][0], by - pts[0][1]));
        const last = pts[pts.length - 1];
        min = Math.min(min, Math.hypot(bx - last[0], by - last[1]));
        return min;
      };
      for (const b of engine.bajantes) {
        if (b.net !== existing.net) continue;
        const wasOnExisting = !!b.recibeDeIds?.includes(existing.id);
        const nearDown = distToSeg(downstream.pts, b.x, b.y) < TOL_B;
        const nearExist = distToSeg(existing.pts, b.x, b.y) < TOL_B;
        // si estaba en existing o está geométricamente sobre el nuevo aguas abajo, mover a downstream
        if (wasOnExisting || (nearDown && !nearExist)) {
          const targetId = downstream.id;
          b.recibeDeIds = (b.recibeDeIds || []).filter(
            (id) => id !== existing.id && id !== downstream.id,
          );
          if (!b.recibeDeIds.includes(targetId)) b.recibeDeIds.push(targetId);
        } else if (nearExist && !nearDown) {
          // queda en existing (upstream) — limpiar posible duplicado en downstream
          b.recibeDeIds = (b.recibeDeIds || []).filter((id) => id !== downstream.id);
        }
      }
      // El downstream nace con el mayor diámetro de la unión: los bajantes que quedaron
      // asociados a él suben a ese piso si estaban por debajo (misma regla de asociación).
      for (const b of engine.bajantes) {
        if (
          (b.tipo === 'bajante' || b.tipo === 'montante') &&
          (b.recibeDeIds || []).includes(downstream.id)
        ) {
          const bumped = bumpBajanteToMaxRamal(engine.ramales, b.recibeDeIds, b.dNominal || '');
          if (bumped) b.dNominal = bumped;
        }
      }
      break;
    }
  }
  return false;
}

/** 3.3/6: detecta una yee SIMPLE cerca de (px,py). Auto-snap deshabilitado por UX
 *  (usuario usa línea guía para yee doble); se mantiene exportada por si se reactiva. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
/** Detecta una yee simple cerca del extremo que se está dibujando: una unión de 3 vías formada por empalme sobre el cuerpo de otro ramal, sin marca de tee. */
export function detectYeeSimpleNear(
  engine: IPlanoEngineCore,
  px: number,
  py: number,
  tol: number,
): { x: number; y: number; trunk: { x: number; y: number } } | null {
  const ramales = engine.ramales.filter((r) => r.net === engine.activeNet);
  if (ramales.length < 2) return null;
  const mp = new Map<string, number[]>();
  for (const r of ramales)
    for (const p of r.pts || []) mp.set(`${p[0].toFixed(3)}_${p[1].toFixed(3)}`, p);
  let best: { x: number; y: number; trunk: { x: number; y: number } } | null = null;
  let bestD = Infinity;
  for (const P of mp.values()) {
    const d = Math.hypot(P[0] - px, P[1] - py);
    if (d > tol) continue;
    const vecs: { x: number; y: number }[] = [];
    for (const rr of ramales) {
      if (!rr.pts) continue;
      for (let i = 0; i < rr.pts.length; i++)
        if (Math.hypot(rr.pts[i][0] - P[0], rr.pts[i][1] - P[1]) < 0.5) {
          if (i > 0) {
            const dx = rr.pts[i - 1][0] - P[0],
              dy = rr.pts[i - 1][1] - P[1];
            const l = Math.hypot(dx, dy);
            if (l > 0.1) vecs.push({ x: dx / l, y: dy / l });
          }
          if (i < rr.pts.length - 1) {
            const dx = rr.pts[i + 1][0] - P[0],
              dy = rr.pts[i + 1][1] - P[1];
            const l = Math.hypot(dx, dy);
            if (l > 0.1) vecs.push({ x: dx / l, y: dy / l });
          }
        }
    }
    const uniq: typeof vecs = [];
    for (const v of vecs) if (!uniq.some((u) => u.x * v.x + u.y * v.y > 0.99)) uniq.push(v);
    if (uniq.length < 3 || uniq.length > 4) continue;
    // Par casi opuesto = tronco
    let bestPair = { i: -1, j: -1, dot: 1 };
    for (let i = 0; i < uniq.length; i++)
      for (let j = i + 1; j < uniq.length; j++) {
        const dd = uniq[i].x * uniq[j].x + uniq[i].y * uniq[j].y;
        if (dd < bestPair.dot) bestPair = { i, j, dot: dd };
      }
    if (bestPair.dot >= -0.9) continue;
    const branches = uniq.filter((_, k) => k !== bestPair.i && k !== bestPair.j);
    if (branches.length === 0) continue;
    const cosVal = branches[0].x * uniq[bestPair.j].x + branches[0].y * uniq[bestPair.j].y;
    const isYee = Math.abs(cosVal) >= 0.4 && Math.abs(cosVal) <= 0.85;
    if (!isYee) continue;
    // ¿Ya es doble (otra unión a ≤10mm alineada)? Si sí, no empujar más.
    let isDouble = false;
    for (const rr of ramales) {
      if (!rr.pts) continue;
      for (const q of rr.pts) {
        if (q === P) continue;
        const dq = Math.hypot(q[0] - P[0], q[1] - P[1]);
        if (dq > 0 && dq <= 10 && mp.has(`${q[0].toFixed(3)}_${q[1].toFixed(3)}`)) {
          isDouble = true;
          break;
        }
      }
      if (isDouble) break;
    }
    if (isDouble) continue;
    if (d < bestD) {
      bestD = d;
      best = { x: P[0], y: P[1], trunk: uniq[bestPair.i] };
    }
  }
  return best;
}

/** Autodetección de padre para un tributario dibujado sin haber seleccionado padre en la barra
 *  (orig. #5 — feature grande): busca el ramal existente del mismo grupo cuyo cuerpo o extremo
 *  toca el trazo. Devuelve el id del padre, o null. */
export function detectTributaryPadre(
  engine: IPlanoEngineCore,
  pts: number[][],
  net: string,
): string | null {
  if (!pts || pts.length < 2) return null;
  const TOL = 0.5;
  // Distancia de un punto `p` al segmento [a,b] (para elegir el ramal al que el tributario se
  // conecta MÁS directamente, en vez de devolver el primer ramal del array que lo toque — el bug
  // reportado: todo tributario caía en el primer ramal de la red).
  const segDist = (p: number[], a: number[], b: number[]) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const sameGroup = (o: string) =>
    o === net || ((o === 'san' || o === 'vent') && (net === 'san' || net === 'vent'));
  const tribEps = [pts[0], pts[pts.length - 1]];
  const mid: number[] = [
    (pts[0][0] + pts[pts.length - 1][0]) / 2,
    (pts[0][1] + pts[pts.length - 1][1]) / 2,
  ];
  let best: { id: string; d: number; midD: number } | null = null;
  for (const other of engine.ramales) {
    if (!sameGroup(other.net) || !other.pts || other.pts.length < 2) continue;
    let d = Infinity;
    for (const p of tribEps) {
      for (let i = 0; i < other.pts.length - 1; i++) {
        d = Math.min(d, segDist(p, other.pts[i], other.pts[i + 1]));
      }
      d = Math.min(d, segDist(p, other.pts[0], other.pts[0]));
      d = Math.min(d, segDist(p, other.pts[other.pts.length - 1], other.pts[other.pts.length - 1]));
    }
    if (d > TOL) continue;
    // distancia del punto medio del tributario al padre para desempate en Y compartida
    let midD = Infinity;
    for (let i = 0; i < other.pts.length - 1; i++) {
      midD = Math.min(midD, segDist(mid, other.pts[i], other.pts[i + 1]));
    }
    if (!best) {
      best = { id: other.id, d, midD };
    } else if (d + 1e-9 < best.d) {
      best = { id: other.id, d, midD };
    } else if (Math.abs(d - best.d) < 1e-9) {
      if (midD + 1e-9 < best.midD) {
        best = { id: other.id, d, midD };
      } else if (Math.abs(midD - best.midD) < 1e-9 && other.tipo !== 'tributario') {
        const cur = engine.ramales.find((rr) => rr.id === best!.id);
        if (cur?.tipo === 'tributario') best = { id: other.id, d, midD };
      }
    }
  }
  return best ? best.id : null;
}

/** Bug #7: valida los ángulos de un ramal EXCLUYENDO los segmentos de conexión — un extremo que
 *  pega a otro ramal existente (o a un bajante) tiene el ángulo dictado por la geometría del
 *  ramal existente, no por la cuadrícula de 45°/90°. Devuelve true si los segmentos libres son
 *  válidos. Usado por finishRamal y handleDragUp. */
export function checkRamalAnglesExcludingConnections(
  engine: IPlanoEngineCore,
  r: PlanoRamal,
): boolean {
  if (!r.pts || r.pts.length < 2) return true;
  const TOL = 0.5;
  const pointOnSeg = (p: number[], a: number[], b: number[]) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) return Math.hypot(p[0] - a[0], p[1] - a[1]) < TOL;
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
    if (t < 0.02 || t > 0.98) return false;
    const px = a[0] + t * dx,
      py = a[1] + t * dy;
    return Math.hypot(p[0] - px, p[1] - py) < TOL;
  };
  const touchesAny = (ep: number[]): boolean => {
    for (const o of engine.ramales) {
      if (o.id === r.id || !o.pts || o.pts.length < 2) continue;
      const sameGroup =
        o.net === r.net ||
        ((o.net === 'san' || o.net === 'vent') && (r.net === 'san' || r.net === 'vent'));
      if (!sameGroup) continue;
      if (
        o.pts.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL) ||
        o.pts.some((_, i) => i < o.pts!.length - 1 && pointOnSeg(ep, o.pts![i], o.pts![i + 1]))
      )
        return true;
    }
    for (const b of engine.bajantes) {
      if (b.net !== r.net) continue;
      if (Math.hypot(b.x - ep[0], b.y - ep[1]) < 8 / (engine.zoom || 1)) return true;
    }
    return false;
  };
  const lastIdx = r.pts.length - 1;
  const startConnects = r.pts.length >= 2 && touchesAny(r.pts[0]);
  const endConnects = r.pts.length >= 2 && touchesAny(r.pts[lastIdx]);
  let ptsToCheck: number[][] = r.pts;
  if (startConnects && endConnects) ptsToCheck = r.pts.slice(1, lastIdx);
  else if (endConnects) ptsToCheck = r.pts.slice(0, lastIdx);
  else if (startConnects) ptsToCheck = r.pts.slice(1);
  if (ptsToCheck.length < 2) return true;
  return checkRamalAngles(ptsToCheck, r.net, r.tipo, engine.snapMode);
}
