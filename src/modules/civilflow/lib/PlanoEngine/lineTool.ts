import { NETS, netsSnapLinked } from './PlanoState';
import type { PlanoRamal, IPlanoEngineCore } from './PlanoState';
import { canalRectHitDistance } from './canalAssociation';
import {
  _firstSegmentAngle,
  checkRamalAngles,
  segmentsIntersect,
  snapTributaryToPadre45Deg,
} from './drawingAngles';
import { _statusMsg, calculateRamalLength } from './ramalMeasure';
import { finishRamal, checkCrossRamalAngle } from './finishRamal';
import { canJoinTributario } from './junctionAutoSplit';
import { cancelRamal, finishArea, reverseRamalEndpoints } from './drawingUtils';

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

/** Maneja un clic con la herramienta de línea activa: empieza un ramal nuevo, continúa uno
 *  existente o agrega un segmento con validación de ángulo/intersección. @param engine Instancia
 *  del motor. @param px Coordenada X de plano. @param py Coordenada Y de plano. */
export function handleLineDown(engine: IPlanoEngineCore, px: number, py: number): void {
  let pt: { x: number; y: number } = { x: px, y: py };
  if (!engine.activeRamal) {
    // Feature orig. #5: el padre de un tributario se autodetecta al conectar el trazo — ya no
    // se exige seleccionar padre manualmente.
    // Buscar un ramal existente para CONTINUAR antes de hacer cualquier snap genérico — esto
    // debe ganarle a snapToExisting eligiendo un objetivo cercano-pero-distinto (p.ej. un
    // bajante desplazado lejos de este mismo extremo); si no, clicar de vuelta sobre un extremo
    // que lleva un accesorio empieza en silencio un ramal nuevo no relacionado en vez de
    // continuar el existente.
    let activeNetsRamales = engine.ramales.filter(
      (rm) =>
        rm.net === engine.activeNet && !(engine.tipoTramo === 'ramal' && rm.tipo === 'tributario'),
    );
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
    // Fallback para prolongación san: si no se encontró candidato con filtro padre,
    // buscar cualquier tributario del mismo net (permite extender desde extremo libre
    // aunque el padre no esté seleccionado exactamente).
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
      // Para san/ll/vent ramales principales (pts-driven, donde _tribReversed NO compensa
      // el flip del renderer), NO se continúa desde el INICIO (dFirst) vía reversión — eso
      // voltearía la dirección de flujo. Se deja caer al bloque de merge de finishRamal que
      // preserva el target revirtiendo el trazo nuevo. Para af/ac/gas/trib sí se permite
      // (ahí _tribReversed compensa la reversión).
      const isPtsDrivenMain = rm.tipo !== 'tributario' && ['san', 'll', 'vent'].includes(rm.net);
      if (dFirst < CONTINUE_THRESH && dFirst <= dLast && !isPtsDrivenMain) {
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
    if (!continueRamal && engine.tipoTramo === 'tributario') {
      for (const rm of engine.ramales) {
        if (rm.net !== engine.activeNet || rm.tipo !== 'tributario') continue;
        const firstPt = rm.pts[0];
        const lastPt = rm.pts[rm.pts.length - 1];
        const dFirst = Math.hypot(px - firstPt[0], py - firstPt[1]);
        const dLast = Math.hypot(px - lastPt[0], py - lastPt[1]);
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

    const sp = engine.snapToExisting(pt.x, pt.y, engine.activeNet, engine.tipoTramo);
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
        // Feature orig. #5: sin padre seleccionado, el snap a cualquier ramal es válido (el
        // padre se autodetecta). Con padre explícito, solo se permite ese padre (o trib-trib).
        if (
          snappedRamal &&
          engine.padreTributario &&
          snappedRamal.id !== engine.padreTributario &&
          !canJoinTributario(engine, snappedRamal)
        ) {
          // Advertencia "Ramal padre incorrecto" inhabilitada — snap permitido.
        }
        pt = sp;
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

      let bestSegDist = Infinity;
      for (const r of activeNetsRamales) {
        const segSnap = engine._snapToSegment(pt.x, pt.y, r.pts, SNAP_THRESH);
        if (segSnap) {
          const d = Math.hypot(segSnap.x - pt.x, segSnap.y - pt.y);
          if (d < bestSegDist) {
            bestSegDist = d;
            onSegmentRamal = r;
            segSnapPt = segSnap;
          }
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
            // Advertencia "Ramal padre incorrecto" inhabilitada — conexión sobre cuerpo permitida.
            if (segSnapPt) pt = segSnapPt;
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

    const ar = engine.activeRamal;
    const activeRamales =
      ar!.tipo === 'tributario'
        ? engine.ramales.filter(
            (r) =>
              (r.net === ar!.net && !engine.padreTributario) ||
              r.id === engine.padreTributario ||
              (r.tipo === 'tributario' && r.net === ar!.net),
          )
        : engine.ramales.filter((r) => r.net === ar!.net);
    // Item 5: el trazo de ventilación pega en 45°/90° a los ramales sanitarios
    // (unión Y / codo reventilado) — mismos candidatos del snap 45° del
    // tributario. Sin esto, la conexión vent↔san aterrizaba en cualquier ángulo
    // (44°/46°) vía la proyección perpendicular de snapToExisting.
    const snapCandidates =
      ar!.net === 'vent'
        ? [...activeRamales, ...engine.ramales.filter((r) => r.net === 'san')]
        : activeRamales;
    let bestSnap: { x: number; y: number } | null = null;
    let bestSnapDist = Infinity;
    for (const r of snapCandidates) {
      if (r.id === ar!.id) continue;
      if (ar!.tipo === 'ramal' && r.tipo === 'tributario') continue;
      let sp = null;
      if (engine.snapMode && (r.id === engine.padreTributario || !engine.padreTributario)) {
        sp = snapTributaryToPadre45Deg(pt.x, pt.y, last[0], last[1], r.pts, 20 / engine.zoom);
      } else {
        sp = engine._snapToSegment(pt.x, pt.y, r.pts, 20 / engine.zoom);
      }
      if (sp) {
        const d = Math.hypot(sp.x - pt.x, sp.y - pt.y);
        if (d < bestSnapDist) {
          bestSnapDist = d;
          bestSnap = sp;
        }
      }
    }
    if (bestSnap) {
      pt = bestSnap;
      snappedToSeg = true;
    }

    if (!snappedToSeg) {
      const sp = engine.snapToExisting(pt.x, pt.y, ar!.net, ar!.tipo);
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
              r.net === ar!.net &&
              r.id !== ar!.id &&
              r.pts.some(([rx, ry]) => Math.hypot(rx - sp.x, ry - sp.y) < 0.5),
          );
          // Feature orig. #5: sin padre explícito, snap a cualquier ramal es válido.
          // Advertencia "Ramal padre incorrecto" inhabilitada — snap permitido.
          if (
            snappedRamal &&
            engine.padreTributario &&
            snappedRamal.id !== engine.padreTributario &&
            !canJoinTributario(engine, snappedRamal)
          ) {
            // no-op: la advertencia está inhabilitada.
          }
        }
        pt = sp;
      }
    }
    const lvlLabel = engine.nivelActual?.label ?? '';
    const bajThresh = 20 / engine.zoom;
    const nearBaj = engine.bajantes.find((b) => {
      if (engine._hiddenNets.has(b.net) || b.net !== ar!.net) return false;
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
      // Un segmento de CONEXIÓN (el extremo pega a un ramal existente o bajante) no se valida
      // contra la cuadrícula: su ángulo está dictado por la geometría del ramal existente, no
      // por un giro libre. Validar solo los giros ya dibujados del ramal en curso.
      const connectedToExisting = snappedToSeg || !!nearBaj;
      const testPts = connectedToExisting
        ? [...engine.activeRamal.pts]
        : [...engine.activeRamal.pts, [pt.x, pt.y]];
      const trazoNet = engine.activeRamal.net;
      if (!checkRamalAngles(testPts, trazoNet, engine.activeRamal.tipo, engine.snapMode)) {
        engine.triggerAlert(
          'Ángulo no recomendado',
          trazoNet === 'san' || trazoNet === 'll'
            ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.'
            : (trazoNet === 'af' || trazoNet === 'ac') && engine.activeRamal.tipo === 'tributario'
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
          if (r.net !== engine.activeRamal.net) continue;
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
              if (engine.tipoTramo === 'tributario') {
                // Feature orig. #5: sin padre seleccionado, un tributario puede cruzar
                // cualquier ramal (ese será su padre autodetectado). Con padre explícito,
                // solo se permite el propio padre (o trib-trib del mismo padre).
                if (
                  engine.padreTributario &&
                  r.id !== engine.padreTributario &&
                  !canJoinTributario(engine, r)
                ) {
                  // Advertencia "Ramal padre incorrecto" inhabilitada — cruce de tributario permitido.
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
  let pt: { x: number; y: number } = { x: px, y: py };
  if (engine.snapMode) {
    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) pt = sp;
  }
  if (!engine._dimStart) {
    engine._dimStart = { x: pt.x, y: pt.y };
  } else {
    const s = engine._dimStart;
    let endPt: { x: number; y: number } = { x: pt.x, y: pt.y };
    if (engine.snapMode) {
      endPt = engine.snapAngle(s.x, s.y, pt.x, pt.y);
      const sp2 = engine.snapToExisting(endPt.x, endPt.y);
      if (sp2) endPt = sp2;
    }
    const len = Math.hypot(endPt.x - s.x, endPt.y - s.y);
    engine.dims.push({
      id: 'D' + Date.now(),
      x1: s.x,
      y1: s.y,
      x2: endPt.x,
      y2: endPt.y,
      L: engine.pxToM(len),
    });
    engine._dimStart = null;
    engine.render();
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
