/** Sección "accesorio a mitad de ramal" del menú contextual (clic sobre el cuerpo del trazo): valida polaridad y diámetros antes de insertar en el vértice. Ej: yee en el cuerpo de RAF2 o tee con llave terminal, nunca un codo sube/baja ahí. */
import { useState, useEffect } from 'react';
import { getAccessoryOptions } from '../../../utils/accessoryOptions.ts';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoElement, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import { codoPolarityOk } from '../../../lib/PlanoEngine/PlanoEngineDrawing.ts';
import { hasTeeAtPoint } from '../../../lib/PlanoEngine/ventElbowTeeFix';
import { diamPulgFromLabel } from '../../../utils/diamInchesFromLabel.ts';
import { bumpHidroAccesorio } from '../../../utils/syncExtremeAccessory.ts';
import type { PlanItem } from '../../../context/PlansContext.tsx';
import {
  MENU_SELECT_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  type ContextMenuState,
} from './context.ts';
import { ramalVivoDelPlanoCargado } from './ramalMenuHelpers.ts';
import { emitAparatosClear, EV_APARATOS_CLEAR, EV_STORAGE } from '../../../utils/fixtureEvents.ts';
import { MidRamalAparatos } from './MidRamalAparatos.tsx';

/** Selector de accesorio a mitad de un ramal (clic sobre el cuerpo): valida polaridad de codos,
 *  yees y conflictos de diámetro antes de escribir el accesorio en el vértice del tramo.
 *  La sección de APARATOS (af/ac/gas/san) vive en MidRamalAparatos. */
export function MidRamalAccessorySelector({
  element,
  midRamalHit,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
}: {
  element: PlanoRamal;
  midRamalHit: { segmentIdx: number; x: number; y: number };
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  planosCtx?: { plans: PlanItem[] };
}) {
  // Reactividad del menú (orig. usuario: quedaba congelado tras "Quitar" — era sordo a los
  // eventos de conteo que sí escucha el panel derecho). El tick fuerza re-derivar currentApp
  // (que se relee de storage en cada render).
  const [, setMenuTick] = useState(0);
  useEffect(() => {
    const bump = (): void => setMenuTick((n) => n + 1);
    window.addEventListener(EV_APARATOS_CLEAR, bump);
    window.addEventListener(EV_STORAGE, bump);
    return () => {
      window.removeEventListener(EV_APARATOS_CLEAR, bump);
      window.removeEventListener(EV_STORAGE, bump);
    };
  }, []);
  // La 'llaveTerminal' simple solo tiene sentido en un extremo real del ramal (termina la
  // tubería allí) — en el cuerpo debe ir mediante 'teeLlaveTerminal' (un tee con la pierna
  // libre tapada), por eso se excluye la válvula pelada de este selector de cuerpo aunque
  // getAccessoryOptions la incluya para el editor de extremos.
  // Cuerpo de ramal de presión (ped. usuario): SIN codos sube/baja — la polaridad solo
  // tiene sentido en extremos (el flujo pasa de largo en el cuerpo). Ni se ofrecen.
  const SUBE_BAJA = new Set(['codoSube', 'codoBaja', 'codo90rmSube', 'codo90rmBaja']);
  const options = getAccessoryOptions(element.net).filter(
    (o) => o.value !== 'llaveTerminal' && !SUBE_BAJA.has(o.value),
  );
  if (options.length === 0) return null;

  // Clic sobre un EXTREMO (orig. usuario): el punto coincide con una punta del trazo — el
  // menú de extremo ofrece SOLO aparatos; el accesorio de cuerpo (y su vértice accMed) es
  // de clics a mitad del trazo.
  const clicEnExtremo =
    element.pts?.some((pt) => Math.hypot(pt[0] - midRamalHit.x, pt[1] - midRamalHit.y) < 0.5) ??
    false;

  // Si ya existe un vértice accMed (casi) exactamente en el punto clicado, se edita ese
  // en lugar de insertar un vértice nuevo.
  const accMed = element.accMed || {};
  let existingKey: string | null = null;
  for (const k of Object.keys(accMed)) {
    const m = k.match(/^accMed(\d+)$/);
    if (!m) continue;
    const pt = element.pts?.[parseInt(m[1], 10)];
    if (pt && Math.hypot(pt[0] - midRamalHit.x, pt[1] - midRamalHit.y) < 2) {
      existingKey = k;
      break;
    }
  }
  const currentVal = existingKey ? accMed[existingKey] : '';

  return (
    <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
      {/* Bug (orig. usuario): al asignar, el vértice insertado cae EXACTO al clic → al reabrir,
          clicEnExtremo salía true y el desplegable desaparecía sin poder eliminar. Si hay un
          accMed existente en el punto, el desplegable se muestra igual. */}
      {element.net !== 'san' && (!clicEnExtremo || existingKey) && (
        <>
          <div style={MENU_SECTION_LABEL_ROW_STYLE}>Accesorio en cuerpo del ramal</div>
          <select
            value={currentVal}
            aria-label="Accesorio en cuerpo del ramal"
            onChange={(e) => {
              const accId = e.target.value;
              // Suelta el foco: si queda en el <select>, el Ctrl+Z del motor no llega (el
              // keydown se aborta sobre selects) y el usuario no puede deshacer la asignación.
              e.target.blur();
              const eng = engineRef.current;
              if (!eng) return;
              const fresh = ramalVivoDelPlanoCargado(eng, element.id);
              if (!fresh) return;

              if (
                accId === 'codoReventilado' &&
                (diamPulgFromLabel(fresh.diametro || '') < 3 ||
                  diamPulgFromLabel(fresh.diametro || '') > 4)
              ) {
                eng.triggerAlert(
                  'Diámetro no permitido',
                  'La tubería principal sanitaria con codo reventilado solo admite diámetro de 3" o 4".',
                );
                return;
              }

              // Ítems 12/13: polaridad del codo de 90° sube/baja en el CUERPO — en el cuerpo el
              // flujo pasa de largo (ni llega ni sale), así que ni sube ni baja son válidos ahí.
              // ponytail: vent T — skip polarity when point already forms T
              if (
                accId === 'codoSube' ||
                accId === 'codoBaja' ||
                accId === 'codo90rmSube' ||
                accId === 'codo90rmBaja'
              ) {
                const isVentTee =
                  fresh.net === 'vent' &&
                  hasTeeAtPoint(eng, [midRamalHit.x, midRamalHit.y], fresh.net);
                if (
                  !isVentTee &&
                  !codoPolarityOk(fresh, [midRamalHit.x, midRamalHit.y], accId, 0.5)
                ) {
                  const isSube = accId === 'codoSube' || accId === 'codo90rmSube';
                  eng.triggerAlert(
                    'Polaridad de codo incorrecta',
                    isSube
                      ? 'El codo 90° sube solo puede entregar flujo: colócalo en un extremo hacia donde fluye el ramal, no en el cuerpo.'
                      : 'El codo 90° baja solo puede recibir flujo: colócalo en un extremo desde donde fluye el ramal, no en el cuerpo.',
                  );
                  return;
                }
              }

              // Una elección de accesorio = UN snapshot: updateElementById ya marca dirty
              // internamente, y el bump de conteos en medio dejaba DOS snapshots — el
              // primer Ctrl+Z restauraba el intermedio (con el accesorio ya puesto) y
              // parecía no hacer nada.
              eng.pauseHistory();
              if (existingKey) {
                const newAccMed = { ...(fresh.accMed || {}) };
                if (accId) {
                  newAccMed[existingKey] = accId;
                } else {
                  delete newAccMed[existingKey];
                }
                eng.updateElementById(element.id, { accMed: newAccMed });
                if (selElement?.id === element.id)
                  setSelElement({ ...selElement, accMed: newAccMed });
                // Sin esto, `element` (la copia congelada de contextMenuState del momento en que se
                // abrió el menú) nunca refleja la escritura: el desplegable seguía mostrando
                // "Ninguno" tras la PRIMERA elección, y cada elección posterior caía en la rama de
                // "insertar vértice nuevo" (más abajo) en vez de actualizar este — dejando el
                // glifo antiguo en pantalla junto al nuevo, y "Ninguno" sin encontrar nada que
                // eliminar.
                setContextMenuState((prev) =>
                  prev ? { ...prev, element: { ...prev.element, accMed: newAccMed } } : null,
                );
              } else if (accId) {
                // Se inserta un vértice nuevo en el punto clicado (dividiendo el segmento, no el
                // ramal) y se ancla allí el accesorio.
                const newIdx = midRamalHit.segmentIdx + 1;
                const newPts = fresh.pts.map((p: number[]) => [...p]);
                newPts.splice(newIdx, 0, [midRamalHit.x, midRamalHit.y]);
                // Las claves accMed existentes en/después del punto de inserción se desplazan un
                // índice hacia arriba.
                const shiftedAccMed: Record<string, string> = {};
                for (const [k, v] of Object.entries(fresh.accMed || {})) {
                  const m = k.match(/^accMed(\d+)$/);
                  if (!m) continue;
                  const idx = parseInt(m[1], 10);
                  shiftedAccMed[`accMed${idx >= newIdx ? idx + 1 : idx}`] = v as string;
                }
                shiftedAccMed[`accMed${newIdx}`] = accId;
                eng.updateElementById(element.id, { pts: newPts, accMed: shiftedAccMed });
                if (selElement?.id === element.id)
                  setSelElement({
                    ...(selElement as PlanoRamal),
                    pts: newPts,
                    accMed: shiftedAccMed,
                  });
                setContextMenuState((prev) =>
                  prev
                    ? {
                        ...prev,
                        element: {
                          ...(prev.element as PlanoRamal),
                          pts: newPts,
                          accMed: shiftedAccMed,
                        },
                      }
                    : null,
                );
              }
              // teeTapon/teeLlaveTerminal ya no se ofrecen en el contador de accesorios del panel
              // lateral (son glifos puros de cuerpo, elegidos solo desde este desplegable) — pero
              // siguen contando como tee de paso a efectos de pérdida de carga, igual que un "Tee
              // paso lado" contabilizado manualmente. Se incrementa/decrementa ese conteo
              // automáticamente para que cambiar de uno de estos dos no deje un conteo huérfano.
              const TEE_LADO_LINKED = new Set(['teeTapon', 'teeLlaveTerminal']);
              if (currentVal !== accId) {
                // _loadedPlanId, NO eng.planId — este último está declarado en el engine pero nunca
                // se asigna, así que siempre es undefined; usarlo escribía el conteo bajo la clave
                // `${net}_${id}_` (planId vacío) mientras el panel lateral lee
                // `${net}_${id}_${realPlanId}`, con lo que el conteo caía en una clave que nada
                // mostraba jamás.
                const planId = eng._loadedPlanId ?? '';
                if (TEE_LADO_LINKED.has(currentVal))
                  bumpHidroAccesorio(element.net || 'af', 'teeLado', -1, element.id, planId);
                if (TEE_LADO_LINKED.has(accId))
                  bumpHidroAccesorio(element.net || 'af', 'teeLado', 1, element.id, planId);
                // bumpHidroAccesorio escribe directo en localStorage — el contador de accesorios
                // del panel lateral de FixturesPanel solo vuelve a leer localStorage en respuesta
                // a este evento (o a sus propias llamadas inc/dec), así que sin despacharlo aquí
                // el conteo se actualiza en disco pero el panel sigue mostrando el número
                // obsoleto hasta que algo más lo dispare.
                if (typeof window !== 'undefined') emitAparatosClear();
              }
              eng.resumeHistory();
              eng.render();
              eng._markDirty();
            }}
            style={MENU_SELECT_STYLE}
          >
            <option value="">Ninguno</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </>
      )}

      {['af', 'ac', 'gas', 'san'].includes(element.net) && (
        <MidRamalAparatos
          element={element}
          midRamalHit={midRamalHit}
          engineRef={engineRef}
          selElement={selElement}
          setSelElement={setSelElement}
          setContextMenuState={setContextMenuState}
        />
      )}
    </div>
  );
}
