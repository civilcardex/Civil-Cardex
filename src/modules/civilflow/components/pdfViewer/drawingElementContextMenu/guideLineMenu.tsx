import type { PlanoGuideLine, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import { NETS, allocNetNumber, uniqRamalId } from '../../../lib/PlanoEngine/PlanoState';
import { checkRamalAngles, _firstSegmentAngle } from '../../../lib/PlanoEngine/drawingAngles';
import { calculateRamalLength } from '../../../lib/PlanoEngine/ramalMeasure';
import { asociarRamalABajantes } from '../../../lib/PlanoEngine/drawingUtils';
import {
  autoSplitJunctionAndSumFlow,
  flipRamalFlow,
  findGuideTCrossing,
  ramalFlowDirectionCheck,
} from '../../../lib/PlanoEngine/PlanoEngineDrawing';
import {
  useDrawingElementContextMenu,
  MENU_SECTION_LABEL_STYLE,
  MENU_ACTION_BTN_STYLE,
} from './context';
import {
  findGuideCrossing,
  resolveGuideNet,
  netAllowedSteps,
  autoAdjustGuide,
  guideAngleAlertMessage,
  buildTribFromGuide,
  resolveRamalEndsFromGuide,
  resolveGuideJunctionAccessory,
  snapGuideArrivalToHost,
  isGuideRelativeAngleValid,
  guideEndTouchesNetwork,
  guidePolylineSide,
} from './guideOps';

export function GuideLineMenu() {
  const ctx = useDrawingElementContextMenu();
  const guide = ctx.element as PlanoGuideLine;
  const eng = ctx.engineRef.current;
  // Detecta la red real desde el ramal que la guía está cruzando en este momento — no la red que
  // estaba activa cuando se dibujó la guía — así los botones de ángulo mostrados siempre
  // coinciden con la red que efectivamente se va a crear/rotar.
  const effectiveNet = eng ? resolveGuideNet(eng, guide) : guide.net;
  const allowedSteps = netAllowedSteps(effectiveNet);
  // Ítem 1.2: la opción "Crear tributarios" (dividir la guía en dos) solo existe cuando la guía
  // ATRAVIESA el extremo de un ramal — un simple contacto no la habilita. Y solo en af/ac/gas:
  // en san/ll/vent el chequeo de dirección de flujo (el tributario fluye HACIA la unión)
  // rechaza siempre uno de los dos lados del cruce (la unión quedaría en punto muerto), así que
  // el botón plural se oculta y queda el singular.
  const tCrossRaw = eng ? findGuideTCrossing(eng.ramales, guide) : null;
  const tCross =
    tCrossRaw &&
    (() => {
      const crossed = eng?.ramales.find((r) => r.id === tCrossRaw.ramalId);
      return !!crossed && (crossed.net === 'af' || crossed.net === 'ac' || crossed.net === 'gas');
    })()
      ? tCrossRaw
      : null;

  return (
    <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={MENU_SECTION_LABEL_STYLE}>Línea guía</div>
      {/* Ajuste único auto-orientado: la red determina el paso (45° san/ll/vent, 90° resto) y
          el sistema calcula solo la orientación — sin Superior/Inferior ni izquierda/derecha. */}
      <button
        type="button"
        onClick={() => {
          const eng = ctx.engineRef.current;
          if (!eng) return;
          autoAdjustGuide(eng, guide, ctx.setSelElement, ctx.selElement);
        }}
        style={{ ...MENU_ACTION_BTN_STYLE, textAlign: 'center' }}
      >
        {`Ajustar a ${allowedSteps[0]}°`}
      </button>
      <button
        type="button"
        onClick={() => {
          const eng = ctx.engineRef.current;
          if (!eng) return;
          const liveGuide = eng.guideLines.find((g) => g.id === guide.id) || guide;
          const netDef = NETS.find((n) => n.id === effectiveNet);
          const pfx = netDef?.lbl || 'R';
          const cnt = allocNetNumber(eng, effectiveNet, 'ramal', (n) =>
            eng.ramales.some((r) => r.id === `${pfx}${n}` || r.label === `${pfx}${n}`),
          );
          const ramId = `${pfx}${cnt}`;
          // El flujo se dibuja desde pts[0] hacia el último punto (renderRamales.ts) — se
          // orienta el nuevo ramal para que su flujo apunte siempre al ramal sobre el que se
          // dibujó esta guía (el cruce ES la conexión que crea), con el extremo cercano
          // anclado al cruce exacto para que nazca conectado (split + UD + "Convertir en
          // tributario" disponible).
          const crossing = findGuideCrossing(eng, liveGuide);
          let { pts: guidePts } = resolveRamalEndsFromGuide(eng, liveGuide, crossing);
          // Validación relativa si la guía cruza un ramal (ítem 4): host a 30° + guía a 120° es 90° relativa válida.
          const snapOn = (eng as unknown as { snapMode?: boolean }).snapMode ?? true;
          const hostAng = crossing ? crossing.angle : null;
          // Corrección fina de la llegada (±7.5°) antes de validar: una guía freehand llega a
          // 44.3° y la validación exige exactitud — se corrige el desfase en vez de alertar.
          if (hostAng !== null) {
            const snapped = snapGuideArrivalToHost(guidePts, hostAng, effectiveNet, 'ramal');
            if (!snapped) {
              eng.triggerAlert(
                'Ángulo no permitido',
                guideAngleAlertMessage(effectiveNet, 'ramal'),
              );
              return;
            }
            guidePts = snapped;
          }
          // Validación de guía: SOLO el segmento de LLEGADA, relativo al trazo cruzado — el
          // ajuste a 45°/90° garantiza ese ángulo y el doblez interior del resto de la guía es
          // decisión del usuario (la regla absoluta de checkRamalAngles bloqueaba conversiones
          // legítimas de guías ajustadas con alerta "Ángulo no permitido").
          const arrivalSeg: [number, number][] =
            guidePts.length >= 2
              ? [guidePts[guidePts.length - 2], guidePts[guidePts.length - 1]]
              : guidePts.slice(0, 2);
          const pStart = guidePts[0];
          const pEnd = guidePts[guidePts.length - 1];
          const ramalAngleOk =
            hostAng !== null
              ? isGuideRelativeAngleValid(
                  arrivalSeg[0],
                  arrivalSeg[1],
                  hostAng,
                  effectiveNet,
                  'ramal',
                  snapOn,
                )
              : checkRamalAngles(guidePts, effectiveNet, 'ramal', snapOn);
          if (!ramalAngleOk) {
            eng.triggerAlert('Ángulo no permitido', guideAngleAlertMessage(effectiveNet, 'ramal'));
            return;
          }
          // Sin auto-orientación aquí: si la dirección de flujo del ramal creado no coincide con
          // la del ramal cruzado, autoSplitJunctionAndSumFlow muestra la alerta y bloquea la
          // unión (item 1). La auto-orientación al crear queda solo para tributarios (item 10).
          void (crossing as { ramalId?: string } | undefined);
          const newRamal: PlanoRamal = {
            id: ramId,
            net: effectiveNet,
            tipo: 'ramal',
            padre: null,
            pts: guidePts.map((p) => [p[0], p[1]] as [number, number]),
            totalL: +calculateRamalLength(guidePts, eng).toFixed(3),
            label: ramId,
            ini: '',
            fin: '',
            piso: String(eng.nivelActual?.n ?? ''),
            dz: '',
            uc: 0,
            // Ítem 1: etiqueta en el punto medio del trazo REAL [pStart,pEnd] con el ángulo de
            // su primer segmento (igual que los ramales manuales: labelOffset 0 + _firstSegmentAngle)
            // — el gap perpendicular del render queda justo arriba del trazo. Antes usaba el
            // ángulo de la guía original sin reordenar, que quedaba 180° fuera cuando el cruce
            // invertía pStart/pEnd, tirando la etiqueta al lado opuesto del trazo.
            labelX: (pStart[0] + pEnd[0]) / 2,
            labelY: (pStart[1] + pEnd[1]) / 2,
            labelAngle: _firstSegmentAngle(guidePts),
            // Mismo material que el ramal cruzado por la guía (o el default de la red), igual
            // que finishRamal — sin esto la etiqueta del canvas salía sin material.
            material:
              (crossing && eng.ramales.find((r) => r.id === crossing.ramalId)?.material) ||
              eng._ramalDefaults?.material ||
              '',
            // Red vent: nace en 2" como los trazos dibujados a mano (orig. usuario).
            diametro: effectiveNet === 'vent' ? '2"' : '',
            pendiente: 2,
            bloqueado: false,
            // Sin glifos de accesorio en los dobleces internos: los codos dibujados son parte
            // del trazo de la guía (mismo flag que los tributarios creados desde guía).
            _sinAccMedInterior: true,
          };
          // san/ll: la flecha SIEMPRE entra a la conexión (el accesorio) — el sentido en que
          // se dibujó la guía no influye (orig. usuario). El ramal drena hacia el extremo que
          // toca la red existente; resolveRamalEndsFromGuide ya lo orienta cuando hay cruce,
          // esta regla lo fuerza también sin cruce detectado (guía dibujada DESDE el ramal).
          if (effectiveNet === 'san' || effectiveNet === 'll') {
            const pts = newRamal.pts;
            const lastTouch = guideEndTouchesNetwork(
              eng,
              [pts[pts.length - 1][0], pts[pts.length - 1][1]],
              effectiveNet,
            );
            const firstTouch = guideEndTouchesNetwork(eng, [pts[0][0], pts[0][1]], effectiveNet);
            if (firstTouch && !lastTouch) flipRamalFlow(newRamal);
          }
          // El flip invierte pts (san/ll/vent) — el labelAngle quedó calculado ANTES del flip y
          // sale 180° fuera; el gap perpendicular del render empujaba la caja HACIA el trazo en
          // vez de alejarla (orig. usuario: etiqueta solapada "en ocasiones").
          newRamal.labelAngle = _firstSegmentAngle(newRamal.pts);
          // Misma validación de dirección que un ramal terminado a mano (orig. usuario): la
          // guía puede entrar en contraria del ramal que cruza — se bloquea con alerta y la
          // guía se conserva para reposicionarla.
          const flowErr = ramalFlowDirectionCheck(eng, newRamal, [], 0.5);
          if (flowErr) {
            eng.triggerAlert('Dirección de flujo incorrecta', flowErr);
            ctx.setContextMenuState(null);
            return;
          }
          eng.ramales.push(newRamal);
          // Igual que un ramal terminado a mano (finishRamal): si el extremo cae a mitad del
          // cuerpo de otro ramal, ese ramal se parte en existing+downstream y el nuevo se suma
          // como incoming — antes esto solo empujaba el ramal suelto, sin dividir nada, así que
          // una guía dibujada sobre el cuerpo de un ramal existente dejaba un cruce en T sin
          // partir de verdad (sin mergesFrom, sin acumulación de UC/UD).
          (eng as unknown as { _guideTributary: boolean })._guideTributary = true;
          const blocked = autoSplitJunctionAndSumFlow(eng, newRamal);
          (eng as unknown as { _guideTributary: boolean })._guideTributary = false;
          if (blocked) {
            // Conexión bloqueada (ramal sobre tributario): retirar el ramal recién creado y
            // conservar la guía para que el usuario la reposicione.
            eng.ramales = eng.ramales.filter((x) => x.id !== newRamal.id);
            eng.render();
            ctx.setContextMenuState(null);
            return;
          }
          // Igual que un ramal terminado a mano (finishRamal): asociar extremos a bajantes
          // (alimentaIds/recibeDeIds + ini/fin) — sin esto el trazo quedaba suelto: sin
          // checks en paneles, sin UDs heredadas y sin espejo de salida.
          {
            const assoc = asociarRamalABajantes(eng, newRamal, false);
            if (assoc.alert) eng.triggerAlert(assoc.alert.title, assoc.alert.msg);
            if (assoc.rejected) {
              eng.ramales = eng.ramales.filter((x) => x.id !== newRamal.id);
              eng.render();
              ctx.setContextMenuState(null);
              return;
            }
          }
          eng.guideLines = eng.guideLines.filter((g) => g.id !== guide.id);
          eng.selId = ramId;
          if (ctx.selElement?.id === guide.id) ctx.setSelElement(null);
          eng._emitSelect(newRamal);
          eng.render();
          // Codo de segmentos (arco) en la esquina L del ramal creado desde guía — antes del
          // _markDirty para que el snapshot del historial lo incluya (redo lo restaura).
          resolveGuideJunctionAccessory(eng, newRamal.id);
          eng._markDirty();
          ctx.setContextMenuState(null);
        }}
        style={MENU_ACTION_BTN_STYLE}
      >
        + Crear ramal a partir de línea guía
      </button>
      {tCross ? (
        // Ítem 1.3: la guía atraviesa el extremo de un ramal → se divide en DOS tributarios
        // (uno por cada lado del cruce), heredando la nomenclatura del ramal padre. La guía
        // original se elimina al final.
        <button
          type="button"
          onClick={() => {
            const eng = ctx.engineRef.current;
            if (!eng) return;
            const liveGuide = eng.guideLines.find((g) => g.id === guide.id) || guide;
            const crossing = findGuideTCrossing(eng.ramales, liveGuide);
            if (!crossing) return;
            const padre = eng.ramales.find((r) => r.id === crossing.ramalId);
            // Misma red restringida que la visibilidad del botón (ver tCross arriba)
            if (!padre || (padre.net !== 'af' && padre.net !== 'ac' && padre.net !== 'gas')) return;
            // Ítem 2: cada lado del cruce aporta su polyline recortada (L/U → dos tributarios
            // multisegmento, uno por lado).
            const gpts = (liveGuide.pts || []).map((p) => [p[0], p[1]] as [number, number]);
            const { sideA, sideB } = guidePolylineSide(gpts, [
              crossing.point[0],
              crossing.point[1],
            ]);
            const viaA = sideA.slice(1, sideA.length - 1);
            const lastB = sideB[sideB.length - 1];
            const viaB = sideB.slice(1, sideB.length - 1).reverse();
            const base = uniqRamalId();
            const t1 = buildTribFromGuide(
              eng,
              padre,
              crossing.point,
              [sideA[0][0], sideA[0][1]],
              base + '_a',
              viaA,
            );
            if (!t1) return;
            const t2 = buildTribFromGuide(
              eng,
              padre,
              crossing.point,
              [lastB[0], lastB[1]],
              base + '_b',
              viaB,
            );
            if (!t2) {
              // El cruce es extremo-con-extremo, así que autoSplit no partió al padre — basta
              // con quitar el primero para no dejar el estado a medias.
              eng.ramales = eng.ramales.filter((r) => r.id !== t1.id);
              return;
            }
            eng.guideLines = eng.guideLines.filter((g) => g.id !== guide.id);
            eng.selId = t2.id;
            if (ctx.selElement?.id === guide.id) ctx.setSelElement(null);
            eng._emitSelect(t2);
            eng.render();
            eng._markDirty();
            ctx.setContextMenuState(null);
          }}
          style={MENU_ACTION_BTN_STYLE}
        >
          + Crear tributarios a partir de línea guía
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            const eng = ctx.engineRef.current;
            if (!eng) return;
            const liveGuide = eng.guideLines.find((g) => g.id === guide.id) || guide;
            const crossing = findGuideCrossing(eng, liveGuide);
            if (!crossing) {
              eng.triggerAlert(
                'Sin cruce con ramal',
                'La línea guía no cruza ningún ramal. Dibújala sobre un ramal existente para crear un tributario que conecte a él.',
              );
              return;
            }
            const padre = eng.ramales.find((r) => r.id === crossing.ramalId);
            if (!padre) return;
            // Mismo anclaje que "Crear ramal" (resolveRamalEndsFromGuide): lado lejano
            // orientado hacia el cruce, extremo anclado al punto exacto (con snap al vértice
            // del host SOLO si el cruce cae cerca de él — a mitad de cuerpo el anclaje es
            // exacto donde la guía tocó el trazo). Ítem 2: el tributario toma esa polyline
            // completa con sus vértices.
            const { pts: tribPts } = resolveRamalEndsFromGuide(eng, liveGuide, crossing);
            const freeEnd: [number, number] = [tribPts[0][0], tribPts[0][1]];
            const via: [number, number][] = tribPts
              .slice(1, -1)
              .map((p) => [p[0], p[1]] as [number, number]);
            const crossPt: [number, number] = [
              tribPts[tribPts.length - 1][0],
              tribPts[tribPts.length - 1][1],
            ];
            const trib = buildTribFromGuide(eng, padre, crossPt, freeEnd, uniqRamalId(), via);
            if (!trib) return;
            eng.guideLines = eng.guideLines.filter((g) => g.id !== guide.id);
            eng.selId = trib.id;
            if (ctx.selElement?.id === guide.id) ctx.setSelElement(null);
            eng._emitSelect(trib);
            eng.render();
            // Codo de segmentos (arco 90°) en la esquina L del tributario creado desde guía —
            // antes del _markDirty para que el snapshot del historial lo incluya (redo lo restaura).
            resolveGuideJunctionAccessory(eng, trib.id);
            eng._markDirty();
            ctx.setContextMenuState(null);
          }}
          style={MENU_ACTION_BTN_STYLE}
        >
          + Crear tributario a partir de línea guía
        </button>
      )}
    </div>
  );
}
