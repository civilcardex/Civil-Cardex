import { useState } from 'react';
import type { PlanoGuideLine, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import { NETS, allocNetNumber } from '../../../lib/PlanoEngine/PlanoState';
import { checkRamalAngles, _firstSegmentAngle } from '../../../lib/PlanoEngine/drawingAngles';
import {
  autoSplitJunctionAndSumFlow,
  ramalFlowDirectionCheck,
  findGuideTCrossing,
  snapGuideCrossingToEndpoint,
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
  rotateGuideLine,
  guideAngleAlertMessage,
  buildTribFromGuide,
  resolveGuideJunctionAccessory,
} from './guideOps';

export function GuideLineMenu() {
  const ctx = useDrawingElementContextMenu();
  const guide = ctx.element as PlanoGuideLine;
  const [side, setSide] = useState<'sup' | 'inf'>('sup');
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
      <div
        style={{
          fontSize: 11,
          color: '#6b7280',
          fontFamily: "'Geist',monospace",
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Lado del cruce
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['sup', 'inf'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            style={{
              ...MENU_ACTION_BTN_STYLE,
              flex: 1,
              textAlign: 'center',
              background: side === s ? 'rgba(245,166,35,0.18)' : MENU_ACTION_BTN_STYLE.background,
              borderColor: side === s ? '#F5A623' : undefined,
            }}
          >
            {s === 'sup' ? 'Superior' : 'Inferior'}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { lbl: '45° izq', deg: -45, step: 45 as const },
          { lbl: '45° der', deg: 45, step: 45 as const },
          { lbl: '90° izq', deg: -90, step: 90 as const },
          { lbl: '90° der', deg: 90, step: 90 as const },
        ]
          .filter(({ step }) => allowedSteps.includes(step))
          .map(({ lbl, deg }) => (
            <button
              key={lbl}
              type="button"
              onClick={() => {
                const eng = ctx.engineRef.current;
                if (!eng) return;
                rotateGuideLine(eng, guide, deg, side, ctx.setSelElement, ctx.selElement);
              }}
              style={{ ...MENU_ACTION_BTN_STYLE, flex: 1, textAlign: 'center' }}
            >
              {lbl}
            </button>
          ))}
      </div>
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
          const [p0, p1] = liveGuide.pts;
          // El flujo se dibuja desde pts[0] hacia el último punto (renderRamales.ts) — se
          // orienta el nuevo ramal para que su flujo apunte siempre al ramal sobre el que se
          // dibujó esta guía (el cruce ES la conexión que crea), desde el extremo de la guía
          // más cercano primero.
          const crossing = findGuideCrossing(eng, liveGuide);
          let pStart: [number, number] = [p0[0], p0[1]];
          let pEnd: [number, number] = [p1[0], p1[1]];
          if (crossing) {
            const d0 = Math.hypot(crossing.point[0] - p0[0], crossing.point[1] - p0[1]);
            const d1 = Math.hypot(crossing.point[0] - p1[0], crossing.point[1] - p1[1]);
            if (d0 < d1) {
              pStart = [p1[0], p1[1]];
              pEnd = [p0[0], p0[1]];
            }
          }
          // Una guía se dibuja a mano alzada, así que su ángulo no está garantizado sobre la
          // rejilla de la red — crear el ramal igualmente produciría en silencio una tubería
          // ilegal. Se valida primero (misma regla que finishRamal); si falla, se conserva la
          // guía para que el usuario pueda rotarla.
          if (!checkRamalAngles([pStart, pEnd], effectiveNet, 'ramal')) {
            eng.triggerAlert('Ángulo no permitido', guideAngleAlertMessage(effectiveNet, 'ramal'));
            return;
          }
          // Sin auto-orientación aquí: si la dirección de flujo del ramal creado no coincide con
          // la del ramal cruzado, autoSplitJunctionAndSumFlow muestra la alerta y bloquea la
          // unión (item 1). La auto-orientación al crear queda solo para tributarios (item 10).
          const distMm = Math.hypot(pEnd[0] - pStart[0], pEnd[1] - pStart[1]);
          const newRamal: PlanoRamal = {
            id: ramId,
            net: effectiveNet,
            tipo: 'ramal',
            padre: null,
            pts: [pStart, pEnd],
            totalL: +eng.pxToM(distMm).toFixed(3),
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
            labelAngle: _firstSegmentAngle([pStart, pEnd]),
            // Mismo material que el ramal cruzado por la guía (o el default de la red), igual
            // que finishRamal — sin esto la etiqueta del canvas salía sin material.
            material:
              (crossing && eng.ramales.find((r) => r.id === crossing.ramalId)?.material) ||
              eng._ramalDefaults?.material ||
              '',
            diametro: '',
            pendiente: 2,
            bloqueado: false,
          };
          // Ítem 5: un vent creado desde guía que termina fluyendo HACIA una unión san (codo
          // reventilado) se bloquea aquí — autoSplitJunctionAndSumFlow solo valida uniones a
          // mitad de cuerpo, no extremo-con-extremo, así que sin este chequeo el vent se creaba
          // recibiendo flujo en el extremo de un ramal sanitario. Misma validación pre-push para
          // san/ll: los ramales creados desde línea guía deben cumplir la dirección de flujo de
          // la red igual que los dibujados a mano (finishRamal).
          if (effectiveNet === 'vent' || effectiveNet === 'san' || effectiveNet === 'll') {
            const flowErr = ramalFlowDirectionCheck(eng, newRamal, [newRamal], 0.5);
            if (flowErr) {
              eng.triggerAlert('Dirección de flujo incorrecta', flowErr);
              return;
            }
          }
          eng.ramales.push(newRamal);
          // Igual que un ramal terminado a mano (finishRamal): si el extremo cae a mitad del
          // cuerpo de otro ramal, ese ramal se parte en existing+downstream y el nuevo se suma
          // como incoming — antes esto solo empujaba el ramal suelto, sin dividir nada, así que
          // una guía dibujada sobre el cuerpo de un ramal existente dejaba un cruce en T sin
          // partir de verdad (sin mergesFrom, sin acumulación de UC/UD).
          autoSplitJunctionAndSumFlow(eng, newRamal);
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
            const [p0, p1] = liveGuide.pts;
            const base = 'T' + Date.now();
            const t1 = buildTribFromGuide(eng, padre, crossing.point, [p0[0], p0[1]], base + '_a');
            if (!t1) return;
            const t2 = buildTribFromGuide(eng, padre, crossing.point, [p1[0], p1[1]], base + '_b');
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
            // Ítem 3 (guías): cruce que cae CERCA del extremo del ramal se ajusta al extremo
            // exacto — sin esto, un cruce a 1-2px del extremo divide el ramal creando un stub
            // invisible y un símbolo de tee en vez del codo 90° esperado.
            crossing.point = snapGuideCrossingToEndpoint(eng, crossing.ramalId, crossing.point);
            const padre = eng.ramales.find((r) => r.id === crossing.ramalId);
            if (!padre) return;
            // El flujo del tributario se dibuja desde pts[0] hacia el último punto — se orienta
            // para que la cabeza apunte AL cruce (la intersección con el ramal padre que
            // alimenta).
            const [p0, p1] = liveGuide.pts;
            const d0 = Math.hypot(crossing.point[0] - p0[0], crossing.point[1] - p0[1]);
            const d1 = Math.hypot(crossing.point[0] - p1[0], crossing.point[1] - p1[1]);
            const freeEnd: [number, number] = d0 < d1 ? [p1[0], p1[1]] : [p0[0], p0[1]];
            const trib = buildTribFromGuide(
              eng,
              padre,
              [crossing.point[0], crossing.point[1]],
              freeEnd,
              'T' + Date.now(),
            );
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
