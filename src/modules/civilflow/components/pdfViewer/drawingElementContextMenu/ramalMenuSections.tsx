/**
 * Secciones de ACCIÓN del menú de un ramal: invertir dirección de flujo, convertir
 * ramal↔tributario, crear montante auto-tee, agregar calentador y despacho del selector
 * de accesorios. Extraídas verbatim de ramalMenu; el estado privado de cada sección
 * (p. ej. el desplegable abierto de conversión) viaja con ella.
 */
import { useEffect, useState } from 'react';
import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import {
  flipRamalFlow,
  ramalFlowDirectionCheck,
  aparatoEnExtremoInvalido,
} from '../../../lib/PlanoEngine/PlanoEngineDrawing.ts';
import { directNeighborRamales } from '../../../utils/flowDirection.ts';
import { getAccessoryOptions } from '../../../utils/accessoryOptions.ts';
import { ramalLabel } from '../../../utils/accessoryAbbreviations.ts';
import type { DrawingElementContextMenuContextValue } from './context.ts';
import { convertirARamal, convertirATributario, tribCandidatesDe } from './ramalMenuConvert.ts';
import { ramalHasInterconnections } from './ramalMenuHelpers.ts';
import { MidRamalAccessorySelector } from './midRamalAccessorySelector.tsx';

/** Lo que estas secciones tocan del menú contextual: motor, estado/cierre del menú,
 *  selección activa y las acciones portaladas al raíz (modal UC, inversión). */
type RamalMenuCtx = Pick<
  DrawingElementContextMenuContextValue,
  | 'engineRef'
  | 'contextMenuState'
  | 'setContextMenuState'
  | 'selElement'
  | 'setSelElement'
  | 'planosCtx'
  | 'readUcInfo'
  | 'openUcMove'
  | 'doInvert'
>;

/** Sección de dirección de flujo del ramal: sin interconexiones ofrece el flip directo del
 *  motor; con interconexiones (af (Agua Fria)/ac (Agua Caliente)/gas (Gas)) abre el modal de
 *  cambio de dirección (con posible traslado de UC (Unidades de Consumo)).
 *  Ej: «⇄ Invertir dirección del flujo» da vuelta el ramal en su sitio. */
export function RamalDirectionSection({ ctx, ramal }: { ctx: RamalMenuCtx; ramal: PlanoRamal }) {
  return (
    <div className="dcm-sep">
      {/* Invertir dirección: AHORA TAMBIÉN en rci (ped. usuario 2026-11-13): la flecha define
       *  la ruta crítica y el usuario debe poder corregirla. Sin interconexiones (igual que
       *  en las demás redes). */}
      {!ramalHasInterconnections(ctx.engineRef.current, ramal) && (
        <button
          type="button"
          onClick={() => {
            const eng = ctx.engineRef.current;
            if (!eng) return;
            // Invierte el ramal en su sitio: revierte pts + intercambia todo campo simétrico
            // respecto a los extremos.
            // La flecha de dirección de flujo (dibujada en vivo desde pts[0] vs pts[last])
            // se invierte automáticamente.
            const r = eng.ramales.find((x) => x.id === ramal.id);
            if (!r) return;
            // Un solo flip (involución) reemplazó el código inline de pts.reverse + swaps de
            // extremos + reindex de accMed.
            flipRamalFlow(r);
            // Ítems 2/5/11: tras invertir, el ramal puede quedar fluyendo contra la dirección
            // del ramal en el otro extremo (o un vent puede quedar llegando a una unión
            // reventilado). Se valida y, si viola, se deshace (un segundo flip restaura).
            const flowErr = ['san', 'll', 'vent'].includes(r.net)
              ? ramalFlowDirectionCheck(eng, r, [], 0.5)
              : null;
            // Ítem 2 (rev 5): con aparato asignado, el flip puede dejarlo en un extremo
            // conectado a la red o en contra del flujo — se deshace (involución) y alerta.
            // Se evalúa PRIMERO que la validación de dirección de flujo.
            if (aparatoEnExtremoInvalido(eng.ramales, eng.bajantes, r, eng.nivelActual?.label)) {
              flipRamalFlow(r);
              ctx.setContextMenuState(null);
              eng.triggerAlert(
                'Aparato en extremo inválido',
                'Al invertir la dirección del flujo, el aparato asignado queda en un extremo conectado a la red o en contra del flujo. Quita o reasigna el aparato antes de invertir la dirección.',
              );
              eng.render();
              return;
            }
            if (flowErr) {
              flipRamalFlow(r);
              // El menú se cierra antes de la alerta para que el plano quede a la vista.
              ctx.setContextMenuState(null);
              eng.triggerAlert('Dirección de flujo incorrecta', flowErr);
              eng.render();
              return;
            }
            eng.render();
            eng._markDirty();
            ctx.setContextMenuState(null);
          }}
          className="dcm-action-btn"
        >
          ⇄ Invertir dirección del flujo
        </button>
      )}
      {ramalHasInterconnections(ctx.engineRef.current, ramal) &&
        ['af', 'ac', 'gas'].includes(ramal.net) && (
          <button
            type="button"
            aria-pressed={!!ramal._tribReversed}
            className={ramal._tribReversed ? 'dcm-action-btn dcm-reversed' : 'dcm-action-btn'}
            onClick={() => {
              const eng = ctx.engineRef.current;
              if (!eng) return;
              // Ítem 2 (rev 5): si el ramal ya tiene aparato asignado y el toggle lo dejaría
              // en un extremo inválido (conectado a la red o en contra del flujo), se alerta
              // ANTES de abrir el modal de cambio de dirección de flujo.
              const sim = { ...ramal, _tribReversed: !ramal._tribReversed };
              if (
                aparatoEnExtremoInvalido(eng.ramales, eng.bajantes, sim, eng.nivelActual?.label)
              ) {
                ctx.setContextMenuState(null);
                eng.triggerAlert(
                  'Aparato en extremo inválido',
                  'Al invertir la dirección del flujo, el aparato asignado queda en contra del flujo o en un extremo conectado a la red. Quita o reasigna el aparato antes de invertir la dirección.',
                );
                return;
              }
              // F1: con UC asignadas y vecinos directos en la conexión, el usuario elige a
              // qué ramal se mueven las unidades de consumo antes de invertir. Sin UC o sin
              // vecinos → toggle directo, sin modal. El modal vive en el raíz (openUcMove)
              // y cierra el menú contextual — el plano queda visible y el modal movible.
              const ucInfo = ctx.readUcInfo(ramal);
              if (ucInfo.total > 0) {
                const neighbors = directNeighborRamales(eng.ramales, ramal);
                if (neighbors.length > 0) {
                  ctx.openUcMove({
                    isOpen: true,
                    sourceLabel: ramalLabel(ramal),
                    ramalId: ramal.id,
                    options: neighbors.map((n) => ({ id: n.id, label: ramalLabel(n) })),
                  });
                  return;
                }
              }
              ctx.doInvert(ramal, null);
            }}
          >
            ⇄ Invertir dirección de flujo
          </button>
        )}
    </div>
  );
}

/** Sección de conversión ramal↔tributario: el tributario ofrece volver a ramal y el ramal
 *  libre lista los ramales padre que toca ("Convertir en tributario de..."). El desplegable
 *  abierto es estado PRIVADO de la sección (se resetea al reabrir el menú sobre otro punto).
 *  Ej: RS9 tocando a RS8 → «Convertir en tributario de... RS8» lo renumera T1RS8. */
export function TributarioConvertSection({ ctx, ramal }: { ctx: RamalMenuCtx; ramal: PlanoRamal }) {
  const [tribConvOpen, setTribConvOpen] = useState(false);
  useEffect(() => {
    setTribConvOpen(false);
  }, [ctx.contextMenuState]);

  // Ítem 8: candidatos a padre y conversiones — lógica en ramalMenuConvert.ts (testeable
  // sin menú montado). tribCandidatesDe acepta null (guard propio).
  const tribCandidates = tribCandidatesDe(ctx.engineRef.current, ramal);

  const convertToTributario = (padreId: string) => {
    const eng = ctx.engineRef.current;
    if (!eng) return;
    convertirATributario(ctx, eng, ramal, padreId);
  };

  const convertToRamal = () => {
    const eng = ctx.engineRef.current;
    if (!eng) return;
    convertirARamal(ctx, eng, ramal, (t, m) => eng.triggerAlert(t, m));
  };

  if (ramal.tipo === 'tributario') {
    return (
      <div className="dcm-sep">
        <button type="button" onClick={convertToRamal} className="dcm-action-btn">
          Convertir tributario en ramal
        </button>
      </div>
    );
  }
  if (tribCandidates.length === 0) return null;
  return (
    <div className="dcm-sep-col">
      <button
        type="button"
        onClick={() => setTribConvOpen((o) => !o)}
        aria-expanded={tribConvOpen}
        className="dcm-action-btn dcm-action-wrap"
      >
        {tribConvOpen ? '▾' : '▸'} Convertir en tributario de...
      </button>
      {tribConvOpen && (
        <div className="dcm-col">
          <div className="dcm-section-label-row">Elegir ramal padre (tocado por este ramal):</div>
          {tribCandidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => convertToTributario(c.id)}
              className="dcm-action-btn dcm-action-left"
            >
              {ramalLabel(c, ctx.engineRef.current?.nivelActual?.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Botón «+ Crear montante (auto-tee)»: nace un montante en el punto del clic cuando este
 *  cayó a mitad de un segmento libre del ramal. Oculto sobre una tee ya ocupada
 *  (isOccupiedTee lo calcula el facade y lo comparte con "+ Agregar calentador"). */
export function CreateMontanteSection({
  ctx,
  ramal,
  isOccupiedTee,
}: {
  ctx: RamalMenuCtx;
  ramal: PlanoRamal;
  isOccupiedTee: boolean;
}) {
  const mid = ctx.contextMenuState.midRamalHit;
  if (
    !mid ||
    ctx.contextMenuState.ramalEndpoint ||
    // rci incluida: el montante rci nace de la misma auto-tee (MONTANTE_NETS ya lo admite).
    !['af', 'ac', 'rci'].includes(ramal.net) ||
    isOccupiedTee
  ) {
    return null;
  }
  return (
    <div className="dcm-sep">
      <button
        type="button"
        onClick={() => {
          const eng = ctx.engineRef.current;
          const hit = ctx.contextMenuState.midRamalHit;
          if (!eng || !hit) return;
          eng.createMontanteMidBody(ramal.id, hit.x, hit.y, hit.segmentIdx);
          ctx.setContextMenuState(null);
        }}
        className="dcm-action-btn"
      >
        + Crear montante (auto-tee)
      </button>
    </div>
  );
}

/** Botón «+ Agregar calentador»: cuelga un calentador en el EXTREMO pinchado de un ramal de
 *  af (Agua Fria). Oculto sobre una tee ocupada (isOccupiedTee viaja desde el facade). */
export function AddCalentadorSection({
  ctx,
  ramal,
  isOccupiedTee,
}: {
  ctx: RamalMenuCtx;
  ramal: PlanoRamal;
  isOccupiedTee: boolean;
}) {
  const ep = ctx.contextMenuState.ramalEndpoint;
  if (!ep || ramal.net !== 'af' || isOccupiedTee) return null;
  return (
    <div className="dcm-sep">
      <button
        type="button"
        onClick={() => {
          const eng = ctx.engineRef.current;
          const endpoint = ctx.contextMenuState.ramalEndpoint;
          if (!eng || !endpoint) return;
          eng.createCalentadorMidBody(ramal.id, endpoint.x, endpoint.y, endpoint.idx);
          ctx.setContextMenuState(null);
        }}
        className="dcm-action-btn"
      >
        + Agregar calentador
      </button>
    </div>
  );
}

/** Despacho del selector de accesorios en cuerpo/extremo del ramal: con golpe a mitad de
 *  segmento usa ese punto; con extremo sintetiza el hit en esa punta para que la preferencia
 *  de extremo del selector apunte ahí. san (sanitaria) y las redes con catálogo de
 *  accesorios lo montan; ll (Lluvias) no. */
export function RamalAccessorySection({ ctx, ramal }: { ctx: RamalMenuCtx; ramal: PlanoRamal }) {
  const state = ctx.contextMenuState;
  const hit =
    state.midRamalHit ||
    (state.ramalEndpoint
      ? {
          segmentIdx: state.ramalEndpoint.idx === 0 ? 0 : state.ramalEndpoint.idx - 1,
          x: state.ramalEndpoint.x,
          y: state.ramalEndpoint.y,
        }
      : null);
  if (!hit) return null;
  if (!['san', 'll'].includes(ramal.net) && getAccessoryOptions(ramal.net).length > 0) {
    return (
      <MidRamalAccessorySelector
        element={ramal}
        midRamalHit={hit}
        engineRef={ctx.engineRef}
        selElement={ctx.selElement}
        setSelElement={ctx.setSelElement}
        setContextMenuState={ctx.setContextMenuState}
        planosCtx={ctx.planosCtx}
      />
    );
  }
  if (ramal.net === 'san') {
    return (
      <MidRamalAccessorySelector
        element={ramal}
        midRamalHit={hit}
        engineRef={ctx.engineRef}
        selElement={ctx.selElement}
        setSelElement={ctx.setSelElement}
        setContextMenuState={ctx.setContextMenuState}
        planosCtx={ctx.planosCtx}
      />
    );
  }
  return null;
}
