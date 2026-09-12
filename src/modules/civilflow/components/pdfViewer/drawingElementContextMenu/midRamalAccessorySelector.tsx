import { APARATOS_DEF, AF_UC_IDS, AC_UC_IDS } from '../../../constants/engineeringDataFixtures';
import { UD_BASE_INIT } from '../../../constants';
import { getAccessoryOptions } from '../../../utils/accessoryOptions';
import { esAplicable, loadAll } from '../../fixturesStorage';
import { DIAM_BY_MAT } from '../../../constants';
import { matchDiamOption } from '../../../utils/diamOptionMatch';
import { sanDiamAllowedForApparatus } from '../../../utils/sanitaryDiamCompat';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import { extremumOccupied, flowTailEnd } from './ramalMenuHelpers';
import { codoPolarityOk, flowEndsAt } from '../../../lib/PlanoEngine/PlanoEngineDrawing';
import { hasTeeAtPoint } from '../../../lib/PlanoEngine/ventCodoTeeFix';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import {
  bumpHidroAccesorio,
  bumpAparatoCount,
  setSingleAparatoCount,
  decrementFirstAparato,
} from '../../../utils/syncExtremeAccessory';
import type { PlanItem } from '../../../context/PlansContext';
import { MENU_SELECT_STYLE, MENU_SECTION_LABEL_ROW_STYLE, type ContextMenuState } from './context';

/** Selector de accesorio a mitad de un ramal (clic sobre el cuerpo): valida polaridad de codos,
 *  yees y conflictos de diámetro antes de escribir el accesorio en el vértice del tramo. */
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
  // La 'llaveTerminal' simple solo tiene sentido en un extremo real del ramal (termina la
  // tubería allí) — en el cuerpo debe ir mediante 'teeLlaveTerminal' (un tee con la pierna
  // libre tapada), por eso se excluye la válvula pelada de este selector de cuerpo aunque
  // getAccessoryOptions la incluya para el editor de extremos.
  const options = getAccessoryOptions(element.net).filter((o) => o.value !== 'llaveTerminal');
  if (options.length === 0) return null;

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
      {element.net !== 'san' && (
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
              const fresh = eng.ramales.find((r) => r.id === element.id);
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
                if (typeof window !== 'undefined')
                  window.dispatchEvent(new CustomEvent('aparatos-clear'));
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

      {['af', 'ac', 'gas', 'san'].includes(element.net) &&
        (() => {
          const aparatoIds = (() => {
            if (element.net === 'af') return AF_UC_IDS;
            if (element.net === 'ac') return AC_UC_IDS;
            if (element.net === 'san') {
              const filtered = APARATOS_DEF.filter((ap) => esAplicable(ap, 'san', 'ud'));
              const order = UD_BASE_INIT.map((d) => d.id);
              return filtered
                .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
                .map((a) => a.id);
            }
            return APARATOS_DEF.filter((a) => a.grupo === 'g').map((a) => a.id);
          })();
          const aparatoOptions = aparatoIds
            .map((id) => APARATOS_DEF.find((a) => a.id === id))
            .filter((a): a is (typeof APARATOS_DEF)[number] => !!a);
          const pts = element.pts || [];
          const dStart =
            pts.length > 0
              ? Math.hypot(pts[0][0] - midRamalHit.x, pts[0][1] - midRamalHit.y)
              : Infinity;
          const dEnd =
            pts.length > 1
              ? Math.hypot(
                  pts[pts.length - 1][0] - midRamalHit.x,
                  pts[pts.length - 1][1] - midRamalHit.y,
                )
              : Infinity;
          const isStart = dStart <= dEnd;
          const fieldApp: 'aparatoInicio' | 'aparatoFin' = isStart ? 'aparatoInicio' : 'aparatoFin';
          let currentApp = element[fieldApp] || '';
          // LDesvio: el desplegable SIEMPRE vacío (orig. usuario) — sus UDs son la herencia
          // del fantasma/bajante superior, no un aparato asignado al tramo.
          if (element.id?.startsWith('LD_')) currentApp = '';
          else if (element.net === 'san' || element.net === 'll') {
            // Para sanitaria/lluvias el aparato del cuerpo se guarda en el conteo de fixtures (sidebar),
            // no en aparatoInicio/Fin; mostrar el que tenga conteo >0 para este ramal.
            try {
              const planIdForCur =
                (engineRef.current as unknown as { _loadedPlanId?: string })?._loadedPlanId ?? '';
              const keyCur = `san_${element.id}_${planIdForCur || ''}`;
              const countsCur = loadAll();
              const curMap = countsCur[keyCur] || {};
              const found = Object.keys(curMap).find((k) => (curMap[k] || 0) > 0);
              if (found) currentApp = found;
            } catch (_e) {
              void _e;
            }
          }
          const currentAppDef = APARATOS_DEF.find((a) => a.id === currentApp);
          const applyAparato = (val: string) => {
            const eng = engineRef.current;
            if (!eng) return;
            const fresh = eng.ramales.find((r) => r.id === element.id);
            if (!fresh || !fresh.pts || fresh.pts.length < 2) return;
            // Item 1 (regla global): un extremo está OCUPADO si está entrelazado con
            // la red (otro ramal/bajante/tee). Los glifos de codo/sifón NO cuentan como
            // ocupación — el aparato los reemplaza (su propio glifo es un codo). Si
            // AMBOS extremos están ocupados: no crear símbolo, no modificar existentes,
            // SIN alerta. Aplica a todas las redes.
            const blocked0 = val ? extremumOccupied(eng, fresh, fresh.pts[0]) : false;
            const blocked1 = val
              ? extremumOccupied(eng, fresh, fresh.pts[fresh.pts.length - 1])
              : false;
            if (val && blocked0 && blocked1) {
              setContextMenuState((prev) => (prev ? { ...prev, visible: false } : prev));
              eng.triggerAlert(
                'Extremos ocupados',
                'Ambos extremos del ramal están conectados a la red. Libera una punta o invierte la dirección del ramal antes de asignar el aparato.',
              );
              return;
            }
            if (fresh.net === 'san' || fresh.net === 'll') {
              const fStart = Math.hypot(
                fresh.pts[0][0] - midRamalHit.x,
                fresh.pts[0][1] - midRamalHit.y,
              );
              const fEnd = Math.hypot(
                fresh.pts[fresh.pts.length - 1][0] - midRamalHit.x,
                fresh.pts[fresh.pts.length - 1][1] - midRamalHit.y,
              );
              // ponytail: fixture goes to the FREE end (flow ends there, not occupied by bajante/union).
              // nearStart (click proximity) put it at the wrong end when a bajante is at the other side.
              const p0 = fresh.pts[0];
              const p1 = fresh.pts[fresh.pts.length - 1];
              const occ0 = blocked0;
              const occ1 = blocked1;
              let nearStart: boolean;
              if (occ0 !== occ1) {
                nearStart = occ1;
              } else if (!occ0 && !occ1) {
                // Trazo aislado (orig. usuario): el codo sube va del lado de la COLA de
                // la flecha de flujo (el sube entrega) — no de la cabeza ni por
                // proximidad del clic. Cola en p0 → true; cola en p1 → false.
                const end0 = flowEndsAt(fresh, p0, 0.5);
                const end1 = flowEndsAt(fresh, p1, 0.5);
                const tail = flowTailEnd(end0, end1);
                nearStart = tail === -1 ? fStart <= fEnd : tail === 0;
              } else {
                const end0 = flowEndsAt(fresh, p0, 0.5);
                const end1 = flowEndsAt(fresh, p1, 0.5);
                nearStart = end0 && !end1 ? true : end1 && !end0 ? false : fStart <= fEnd;
              }
              const fieldAcc: 'accesorioInicio' | 'accesorioFin' = nearStart
                ? 'accesorioInicio'
                : 'accesorioFin';
              if (val) {
                // Un glifo de codo/sifón en el extremo NO bloquea al aparato — el aparato
                // lo reemplaza (su propio glifo es un codo 90°/sifón). Solo una conexión
                // real (tee/yee) bloquea la asignación en ese extremo.
                const accHere = fresh[fieldAcc] || '';
                if (accHere.startsWith('tee') || accHere.startsWith('yee')) {
                  eng.triggerAlert(
                    'Accesorio existente',
                    'Este extremo ya tiene un accesorio. Elimínalo antes de asignar un aparato.',
                  );
                  return;
                }
                // Ítem 6/7/8: regla central (inodoro → 4" mínimo; otros → relleno 2" si vacío) + switch
                const isInodoro = val === 'san';
                // Ítem 1: una asignación de aparato = un snapshot (pausa durante los pasos).
                eng.pauseHistory();
                // Detect previous aparato for this ramal to handle switch quantity & diam
                const planIdForSwitch = eng._loadedPlanId ?? '';
                const switchKey = `san_${element.id}_${planIdForSwitch || ''}`;
                let prevAparato: string | null = null;
                try {
                  const prevCounts = loadAll();
                  const prevMap = prevCounts[switchKey] || {};
                  const foundPrev = Object.keys(prevMap).find(
                    (k) => (prevMap[k] || 0) > 0 && k !== val,
                  );
                  if (foundPrev) prevAparato = foundPrev;
                } catch (_e) {
                  void _e;
                }
                if (isInodoro) {
                  // ponytail: inodoro must be >=4" even when ramal has NO diameter (0 returns "allowed")
                  const curDiamPulg = fresh.diametro ? diamPulgFromLabel(fresh.diametro) : 0;
                  if (curDiamPulg < 4 || !sanDiamAllowedForApparatus(curDiamPulg, 'san')) {
                    eng.updateElementById(element.id, { diametro: '4"' });
                    if (selElement?.id === element.id)
                      setSelElement({ ...selElement, diametro: '4"' } as PlanoRamal);
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...prev.element, diametro: '4"' } } : null,
                    );
                  }
                } else {
                  // Otros aparatos: si venimos de inodoro (prev 4") o sin diam, ajustar a 2"
                  const shouldSet2 = !fresh.diametro || prevAparato === 'san';
                  if (shouldSet2) {
                    eng.updateElementById(element.id, { diametro: '2"' });
                    if (selElement?.id === element.id)
                      setSelElement({ ...selElement, diametro: '2"' } as PlanoRamal);
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...prev.element, diametro: '2"' } } : null,
                    );
                  }
                }
                // Sifón (aparato 'sif') dibuja el glifo sifón, no codo 90°; conteo sigue sumando codo90.
                const isSif = val === 'sif';
                const accType = isSif ? 'sifon' : 'codo90rmSube';
                const updates: Record<string, unknown> = { [fieldAcc]: accType };
                const diamListSan = DIAM_BY_MAT['PVC-S'] || [];
                // sifón: siempre 2" (fix bug 3" arbitrario)
                const diamValRaw = isInodoro
                  ? '4"'
                  : isSif
                    ? '2"'
                    : fresh.diametro
                      ? matchDiamOption(diamListSan, fresh.diametro)
                      : '2"';
                const diamVal = matchDiamOption(diamListSan, diamValRaw);
                if (diamVal)
                  (updates as Record<string, unknown>)[
                    nearStart ? 'diametroInicio' : 'diametroFin'
                  ] = diamVal;
                eng.updateElementById(element.id, updates);
                if (selElement?.id === element.id)
                  setSelElement({ ...selElement, ...updates } as PlanoRamal);
                setContextMenuState((prev) =>
                  prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
                );
                eng.render();
                // Conteo directo por clave de plano (sin gate de planosCtx: con el contexto aún
                // cargando el menú escribía el símbolo pero no el conteo y el primer clic
                // "no hacía nada").
                {
                  const planId = eng._loadedPlanId ?? '';
                  setSingleAparatoCount('san', element.id, planId, val);
                  // bump solo si accesorio no existía antes (evita doble conteo al cambiar de aparato con mismo codo)
                  const hadAccBefore = !!fresh[fieldAcc];
                  if (!hadAccBefore)
                    bumpHidroAccesorio('san', 'codo90rmSube', 1, element.id, planId);
                  if (typeof window !== 'undefined')
                    window.dispatchEvent(new CustomEvent('aparatos-clear'));
                }
                // Ítem 1: un snapshot para toda la asignación (geometría + conteos).
                eng.resumeHistory();
                eng._markDirty();
                return;
              } else {
                // Find actual field that has codo/sifon — not just nearStart (mid click may be far from free end)
                let targetField: 'accesorioInicio' | 'accesorioFin' | null = null;
                let targetDiamField: 'diametroInicio' | 'diametroFin' | null = null;
                if (fresh.accesorioInicio === 'codo90rmSube' || fresh.accesorioInicio === 'sifon') {
                  targetField = 'accesorioInicio';
                  targetDiamField = 'diametroInicio';
                } else if (
                  fresh.accesorioFin === 'codo90rmSube' ||
                  fresh.accesorioFin === 'sifon'
                ) {
                  targetField = 'accesorioFin';
                  targetDiamField = 'diametroFin';
                }
                // Residuo de asignación por panel (campo aparato sin codo): también se
                // limpia — antes ese caso retornaba sin hacer nada y el menú quedaba
                // mostrando el asignado.
                const hasResidue = !!(fresh.aparatoInicio || fresh.aparatoFin);
                if (!targetField && !hasResidue) {
                  eng.resumeHistory();
                  return;
                }
                const updates: Record<string, unknown> = {};
                if (targetField) {
                  updates[targetField] = '';
                  if (targetDiamField) updates[targetDiamField] = '';
                }
                if (fresh.aparatoInicio) updates.aparatoInicio = '';
                if (fresh.aparatoFin) updates.aparatoFin = '';
                eng.updateElementById(element.id, updates);
                // Refresco desde el motor vivo (no del snapshot): garantiza que el menú
                // muestre "sin asignar" aunque el prop element llegara stale.
                const liveAfter =
                  engineRef.current?.ramales.find((r) => r.id === element.id) || null;
                if (selElement?.id === element.id)
                  setSelElement({ ...((liveAfter ?? selElement) as PlanoRamal), ...updates });
                setContextMenuState((prev) =>
                  prev
                    ? {
                        ...prev,
                        element: { ...((liveAfter ?? prev.element) as PlanoRamal), ...updates },
                      }
                    : null,
                );
                eng.render();
                const planId = eng._loadedPlanId ?? '';
                if (targetField) bumpHidroAccesorio('san', 'codo90rmSube', -1, element.id, planId);
                if (typeof window !== 'undefined')
                  window.dispatchEvent(new CustomEvent('aparatos-clear'));
                decrementFirstAparato('san', element.id, planId);
                if (typeof window !== 'undefined')
                  window.dispatchEvent(new CustomEvent('aparatos-clear'));
                // Ítem 1: un snapshot para toda la desasignación (geometría + conteos).
                eng.resumeHistory();
                eng._markDirty();
                return;
              }
            }
            const fStart = Math.hypot(
              fresh.pts[0][0] - midRamalHit.x,
              fresh.pts[0][1] - midRamalHit.y,
            );
            const fEnd = Math.hypot(
              fresh.pts[fresh.pts.length - 1][0] - midRamalHit.x,
              fresh.pts[fresh.pts.length - 1][1] - midRamalHit.y,
            );
            // Item 6/2: con un extremo ocupado y otro libre, usar SIEMPRE el libre
            // (la proximidad del clic no debe mandar el aparato a un extremo con
            // accesorio/conexión); si ambos libres, decidir por proximidad.
            const nearStart = blocked0 !== blocked1 ? !blocked0 : fStart <= fEnd;
            const field: 'aparatoInicio' | 'aparatoFin' = nearStart
              ? 'aparatoInicio'
              : 'aparatoFin';
            const fieldAcc: 'accesorioInicio' | 'accesorioFin' = nearStart
              ? 'accesorioInicio'
              : 'accesorioFin';
            const targetPt: number[] = nearStart ? fresh.pts[0] : fresh.pts[fresh.pts.length - 1];
            if (val) {
              if (fresh[fieldAcc]) {
                eng.triggerAlert(
                  'Accesorio existente',
                  'Este extremo ya tiene un accesorio. Elimínalo antes de asignar un aparato.',
                );
                return;
              }
              const existingBm = (eng.bajantes || []).find(
                (b) =>
                  Math.abs(b.x - targetPt[0]) < 0.5 &&
                  Math.abs(b.y - targetPt[1]) < 0.5 &&
                  b.net === element.net,
              );
              if (existingBm) {
                eng.triggerAlert(
                  'Elemento existente',
                  `Ya existe un ${existingBm.tipo} (${existingBm.code || existingBm.id}) en este extremo. Elimínalo antes de asignar un aparato.`,
                );
                return;
              }
              if (extremumOccupied(eng, fresh, targetPt) || !flowEndsAt(fresh, targetPt, 0.5)) {
                setContextMenuState((prev) => (prev ? { ...prev, visible: false } : prev));
                eng.triggerAlert(
                  'Aparato no permitido',
                  'El aparato solo se dibuja en el extremo libre hacia el que apunta el flujo del ramal. Este extremo está conectado a la red (T/Y/bajante) o el flujo va en su contra (apunta a la conexión). Invierte la dirección del ramal o asigna el aparato en el extremo correcto.',
                );
                return;
              }
            }
            if (!val) {
              let actualField: 'aparatoInicio' | 'aparatoFin' | null = null;
              if (fresh.aparatoInicio) actualField = 'aparatoInicio';
              else if (fresh.aparatoFin) actualField = 'aparatoFin';
              else return;
              // Ítem 1: una (des)asignación = un snapshot — los conteos se escriben ANTES del
              // snapshot final (si no, un Ctrl+Z restauraba geometría nueva con conteos viejos
              // y el aparato seguía visible hasta el segundo Ctrl+Z).
              eng.pauseHistory();
              const actualOldApp = String(
                (fresh as unknown as Record<string, unknown>)[actualField] || '',
              );
              const actualUpdates: Record<string, unknown> = { [actualField]: null };
              eng.updateElementById(element.id, actualUpdates);
              // Refresco desde el motor vivo (no del snapshot): garantiza que el menú
              // muestre "sin asignar" aunque el prop element llegara stale.
              const liveAfter2 =
                engineRef.current?.ramales.find((r) => r.id === element.id) || null;
              setContextMenuState((prev) =>
                prev
                  ? {
                      ...prev,
                      element: {
                        ...((liveAfter2 ?? prev.element) as PlanoRamal),
                        ...actualUpdates,
                      },
                    }
                  : null,
              );
              if (selElement?.id === element.id) {
                setSelElement({
                  ...((liveAfter2 ?? selElement) as PlanoRamal),
                  ...actualUpdates,
                } as PlanoRamal);
              }
              eng.render();
              // Conteo directo por clave de plano (sin gate de planosCtx — ver rama san).
              {
                const pid = eng._loadedPlanId ?? '';
                if (actualOldApp) bumpAparatoCount(element.net, element.id, pid, actualOldApp, -1);
                if (typeof window !== 'undefined')
                  window.dispatchEvent(new CustomEvent('aparatos-clear'));
              }
              eng.resumeHistory();
              eng._markDirty();
              return;
            }
            // Ítem 1: ver rama desasignar (pausa hasta el snapshot final).
            eng.pauseHistory();
            const oldApp = fresh[field] || '';
            const updates: Record<string, unknown> = { [field]: val || null };
            eng.updateElementById(element.id, updates);
            setContextMenuState((prev) =>
              prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
            );
            if (selElement?.id === element.id) {
              setSelElement({ ...selElement, ...updates } as PlanoRamal);
            }
            eng.render();
            // Conteo directo por clave de plano (sin gate de planosCtx — ver rama san).
            {
              const pid = eng._loadedPlanId ?? '';
              if (oldApp) bumpAparatoCount(element.net, element.id, pid, oldApp, -1);
              if (val) bumpAparatoCount(element.net, element.id, pid, val || '', +1);
              if (typeof window !== 'undefined')
                window.dispatchEvent(new CustomEvent('aparatos-clear'));
            }
            eng.resumeHistory();
            eng._markDirty();
          };
          return (
            <div style={{ marginTop: 6 }}>
              <div style={MENU_SECTION_LABEL_ROW_STYLE}>Seleccionar Aparato</div>
              <select
                value={currentApp}
                aria-label="Seleccionar Aparato"
                onChange={(e) => {
                  e.target.blur();
                  applyAparato(e.target.value);
                }}
                style={MENU_SELECT_STYLE}
              >
                <option value="">Ninguno</option>
                {aparatoOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
              {/* Ítem 7: aparato asignado visible con cantidad = 1 (la misma de la sidebar
                  derecha) y remoción bidireccional — Quitar limpia el campo del ramal, la
                  sidebar decrementa el conteo y el glifo de codo implícito desaparece (ambos
                  se derivan de aparatoInicio/Fin). */}
              {currentApp && (
                <div
                  style={{
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    background: 'rgba(0,220,229,0.06)',
                    border: '1px solid rgba(0,220,229,0.25)',
                    borderRadius: 3,
                    padding: '4px 6px',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: '#e2e2e8',
                      fontFamily: "'Geist',monospace",
                      whiteSpace: 'normal',
                    }}
                  >
                    ✓ {currentAppDef?.nombre || currentApp} × 1
                  </span>
                  <button
                    type="button"
                    onClick={() => applyAparato('')}
                    aria-label="Quitar aparato"
                    style={{
                      flexShrink: 0,
                      padding: '2px 8px',
                      background: 'transparent',
                      border: '1px solid #3a494a',
                      borderRadius: 3,
                      color: '#ffb4ab',
                      fontSize: 10,
                      fontFamily: "'Geist',monospace",
                      cursor: 'pointer',
                    }}
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
}
