import { useState, useEffect } from 'react';
import { bajanteLabel, ramalLabel } from '../../../utils/accessoryAbbreviations';
import { APARATOS_DEF, AF_UC_IDS, AC_UC_IDS } from '../../../constants/engineeringDataFixtures';
import { UD_BASE_INIT } from '../../../constants';
import { getAccessoryOptions } from '../../../utils/accessoryOptions';
import { esAplicable, loadAll, saveAll } from '../../fixturesStorage';
import { DIAM_BY_MAT } from '../../../constants';
import { matchDiamOption } from '../../../utils/diamOptionMatch';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import {
  codoPolarityOk,
  flowEndsAt,
  flipRamalFlow,
  ramalFlowDirectionCheck,
  extremoEntrelazado,
  aparatoEnExtremoInvalido,
} from '../../../lib/PlanoEngine/PlanoEngineDrawing';
import { directNeighborRamales } from '../../../utils/flowDirection';
import { allocTributaryNumber, rootTributarioLabel } from '../../../lib/PlanoEngine/PlanoState';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import {
  bumpHidroAccesorio,
  syncExtremeAparatoToCounts,
} from '../../../utils/syncExtremeAccessory';
import type { PlanItem } from '../../../context/PlansContext';
import {
  useDrawingElementContextMenu,
  MENU_SELECT_STYLE,
  MENU_GRID_2COL_TALL_STYLE,
  MENU_ACTION_BTN_STYLE,
  MENU_CHECK_ROW_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  type ContextMenuState,
} from './context';
import { BajanteConnectionPanel, BajanteCodeEditor } from './bajanteMenus';

function MidRamalAccessorySelector({
  element,
  midRamalHit,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  planosCtx,
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
              if (
                accId === 'codoSube' ||
                accId === 'codoBaja' ||
                accId === 'codo90rmSube' ||
                accId === 'codo90rmBaja'
              ) {
                if (!codoPolarityOk(fresh, [midRamalHit.x, midRamalHit.y], accId, 0.5)) {
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
          if (element.net === 'san' || element.net === 'll') {
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
            if (fresh.net === 'san' || fresh.net === 'll') {
              const fStart = Math.hypot(
                fresh.pts[0][0] - midRamalHit.x,
                fresh.pts[0][1] - midRamalHit.y,
              );
              const fEnd = Math.hypot(
                fresh.pts[fresh.pts.length - 1][0] - midRamalHit.x,
                fresh.pts[fresh.pts.length - 1][1] - midRamalHit.y,
              );
              const nearStart = fStart <= fEnd;
              const fieldAcc: 'accesorioInicio' | 'accesorioFin' = nearStart
                ? 'accesorioInicio'
                : 'accesorioFin';
              if (val) {
                if (fresh[fieldAcc]) {
                  eng.triggerAlert(
                    'Accesorio existente',
                    'Este extremo ya tiene un accesorio. Elimínalo antes de asignar un aparato.',
                  );
                  return;
                }
                const updates: Record<string, unknown> = { [fieldAcc]: 'codo90rmSube' };
                const diamListSan = DIAM_BY_MAT['PVC'] || [];
                const diamVal = fresh.diametro ? matchDiamOption(diamListSan, fresh.diametro) : '';
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
                eng._markDirty();
                if (planosCtx?.plans) {
                  const planId = eng._loadedPlanId ?? '';
                  const counts2 = loadAll();
                  const key2 = `san_${element.id}_${planId || ''}`;
                  const cur2 = counts2[key2] || {};
                  cur2[val] = (cur2[val] || 0) + 1;
                  counts2[key2] = cur2;
                  saveAll(counts2);
                  bumpHidroAccesorio('san', 'codo90rmSube', 1, element.id, planId);
                  if (typeof window !== 'undefined')
                    window.dispatchEvent(new CustomEvent('aparatos-clear'));
                }
                return;
              } else {
                const wasCodo = fresh[fieldAcc] === 'codo90rmSube';
                if (!wasCodo) return;
                const updates: Record<string, unknown> = { [fieldAcc]: '' };
                (updates as Record<string, unknown>)[nearStart ? 'diametroInicio' : 'diametroFin'] =
                  '';
                eng.updateElementById(element.id, updates);
                if (selElement?.id === element.id)
                  setSelElement({ ...selElement, ...updates } as PlanoRamal);
                setContextMenuState((prev) =>
                  prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
                );
                eng.render();
                eng._markDirty();
                const planId = eng._loadedPlanId ?? '';
                bumpHidroAccesorio('san', 'codo90rmSube', -1, element.id, planId);
                if (typeof window !== 'undefined')
                  window.dispatchEvent(new CustomEvent('aparatos-clear'));
                if (planosCtx?.plans) {
                  const counts3 = loadAll();
                  const key3 = `san_${element.id}_${planId || ''}`;
                  const cur3 = counts3[key3] || {};
                  const apToDec = Object.keys(cur3).find((k) => (cur3[k] || 0) > 0);
                  if (apToDec) {
                    const v = (cur3[apToDec] || 0) - 1;
                    if (v <= 0) delete cur3[apToDec];
                    else cur3[apToDec] = v;
                    if (Object.keys(cur3).length === 0) delete counts3[key3];
                    else counts3[key3] = cur3;
                    saveAll(counts3);
                    if (typeof window !== 'undefined')
                      window.dispatchEvent(new CustomEvent('aparatos-clear'));
                  }
                }
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
            const nearStart = fStart <= fEnd;
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
            const oldApp = fresh[field] || '';
            const updates: Record<string, unknown> = { [field]: val || null };
            eng.updateElementById(element.id, updates);
            setContextMenuState((prev) =>
              prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
            );
            if (selElement?.id === element.id) {
              setSelElement({ ...selElement, ...updates });
            }
            eng.render();
            eng._markDirty();
            if (planosCtx?.plans) {
              syncExtremeAparatoToCounts(element.id, oldApp, val || '', planosCtx.plans);
            }
          };
          return (
            <div style={{ marginTop: 6 }}>
              <div style={MENU_SECTION_LABEL_ROW_STYLE}>Seleccionar Aparato</div>
              <select
                value={currentApp}
                aria-label="Seleccionar Aparato"
                onChange={(e) => applyAparato(e.target.value)}
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

// ¿El punto p cae sobre el CUERPO (mitad de segmento) de pts? Excluye extremos (t<0.02/0.98),
// que se validan por coincidencia de vértice aparte.
export function pointOnRamalBody(pts: number[][], p: number[], tol: number): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) {
      if (Math.hypot(p[0] - a[0], p[1] - a[1]) < tol) return true;
      continue;
    }
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
    if (t < 0.02 || t > 0.98) continue;
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    if (Math.hypot(p[0] - px, p[1] - py) < tol) return true;
  }
  return false;
}

// Un ramal que participa en cualquier unión con otros ramales no debe ver invertido su sentido
// de flujo: invertir pts invalidaría cada extremo compartido, el vínculo con el tributario
// padre, los glifos tee/yee de accMed en la unión y las asignaciones accesorioInicio/Fin de
// los ramales conectados. "Interconexión" = comparte extremo con otro ramal, tiene tributarios
// colgados, es él mismo tributario, o lleva marcadores de unión (accMed / cruces bilaterales /
// pares de ids).
export function ramalHasInterconnections(eng: PlanoEngine | null, ramal: PlanoRamal): boolean {
  if (!eng) return false;
  const TOL = 0.5;
  const eps = [ramal.pts[0], ramal.pts[ramal.pts.length - 1]];
  // Ítem 11: este ramal es la mitad (aguas arriba o abajo) de una división auto-split — su
  // dirección no se puede invertir sin romper la cadena mergesFrom.
  if (ramal.mergesFrom) return true;
  for (const other of eng.ramales) {
    if (other.id === ramal.id) continue;
    const sameGroup =
      other.net === ramal.net ||
      ((other.net === 'san' || other.net === 'vent') &&
        (ramal.net === 'san' || ramal.net === 'vent'));
    if (!sameGroup) continue;
    if (other.padre === ramal.id) return true;
    if (other.tipo === 'tributario' && ramal.tipo === 'tributario' && other.padre === ramal.padre)
      continue;
    // otro ramal fue partido por este (o referencia este en una cadena de splits)
    if (other.mergesFrom && other.mergesFrom.includes(ramal.id)) return true;
    // extremo-contra-extremo (comportamiento viejo)
    for (const pt of other.pts) {
      if (eps.some((e) => Math.hypot(e[0] - pt[0], e[1] - pt[1]) < TOL)) return true;
    }
    // Ítem 11: extremo del OTRO sentado sobre el CUERPO de este ramal (p. ej. un vent sobre el
    // cuerpo de un san — la unión reventilado no divide, así que antes no se detectaba) y
    // extremo de ESTE sentado sobre el cuerpo del otro.
    for (const pt of other.pts) {
      if (pointOnRamalBody(ramal.pts, pt, TOL)) return true;
    }
    for (const myEp of eps) {
      if (pointOnRamalBody(other.pts, myEp, TOL)) return true;
    }
  }
  // Ítem 11: bajante/montante tocando los extremos — vía recibeDeIds o por posición (con el
  // desplazamiento del piso actual). Invertir el ramal voltearía ini/fin que referencian el
  // código del bajante.
  const lvl = eng.nivelActual?.label ?? '';
  for (const b of eng.bajantes) {
    if (b.recibeDeIds?.includes(ramal.id)) return true;
    const disp = b.desplazamientos?.[lvl] || {};
    const bx = b.x + (disp.dx || 0);
    const by = b.y + (disp.dy || 0);
    if (eps.some((e) => Math.hypot(e[0] - bx, e[1] - by) < TOL)) return true;
  }
  if (ramal.tipo === 'tributario') return true;
  if (ramal.accMed && Object.keys(ramal.accMed).length > 0) return true;
  return false;
}

// ¿El extremo `epPt` del ramal está ENTRELAZADO con la red (otro ramal del mismo net o una
// bajante/montante del mismo net en ese punto)? Cubre la unión en T por montante.
function extremumOccupied(eng: PlanoEngine | null, ramal: PlanoRamal, epPt: number[]): boolean {
  if (!eng) return false;
  return extremoEntrelazado(eng.ramales, eng.bajantes || [], ramal, epPt);
}

export function RamalMenu() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState, element, engineRef, selElement, setSelElement } = ctx;
  const ramalEl = element as PlanoRamal;
  const [tribConvOpen, setTribConvOpen] = useState(false);
  useEffect(() => {
    setTribConvOpen(false);
  }, [contextMenuState]);

  // Un midRamalHit que cae exactamente sobre un vértice accMed EXISTENTE (PlanoEngineHitTesting.ts
  // los comprueba antes que los impactos de cuerpo de segmento) reporta segmentIdx = accMedIdx - 1
  // — es decir, accMedIdx = segmentIdx + 1, misma convención que usan
  // handleCreateMontanteMidBody/handleCreateTeeCapStub.
  const hit = contextMenuState.midRamalHit;
  const existingTeeIdx = hit ? hit.segmentIdx + 1 : -1;
  const existingTeeType = hit ? ramalEl.accMed?.[`accMed${existingTeeIdx}`] : undefined;
  const isExistingTee =
    existingTeeType === 'teeDirecto' ||
    existingTeeType === 'teeSube' ||
    existingTeeType === 'teeBaja';
  // teeTapon/teeLlaveTerminal son glifos autocontenidos (la pierna libre ya viene tapada en el
  // propio marcador, sin ramal stub real) — no reciben los botones de stub "+Tapón/+Llave" de
  // abajo, pero el punto sigue ocupado, así que "Crear montante" también debe permanecer oculto
  // allí.
  const isOccupiedTee =
    isExistingTee || existingTeeType === 'teeTapon' || existingTeeType === 'teeLlaveTerminal';

  // Ítem 8: candidatos a padre para "Convertir en tributario" — ramales de la misma red (o
  // grupo san/vent) que ESTE ramal toca (extremo sobre vértice o sobre cuerpo). Los
  // tributarios no son candidatos: un tributario nunca es un tronco.
  const tribCandidates = (() => {
    const eng = ctx.engineRef.current;
    if (!eng || ramalEl.tipo === 'tributario' || !ramalEl.pts || ramalEl.pts.length < 2) {
      return [];
    }
    const TOL = 0.5;
    const eps = [ramalEl.pts[0], ramalEl.pts[ramalEl.pts.length - 1]];
    const out: PlanoRamal[] = [];
    for (const o of eng.ramales) {
      if (o.id === ramalEl.id || o.tipo === 'tributario') continue;
      const sameGroup =
        o.net === ramalEl.net ||
        ((o.net === 'san' || o.net === 'vent') &&
          (ramalEl.net === 'san' || ramalEl.net === 'vent'));
      if (!sameGroup) continue;
      const touch = eps.some(
        (e) =>
          (o.pts || []).some((p) => Math.hypot(p[0] - e[0], p[1] - e[1]) < TOL) ||
          pointOnRamalBody(o.pts || [], e, TOL),
      );
      if (touch) out.push(o);
    }
    return out;
  })();

  const convertToTributario = (padreId: string) => {
    const eng = ctx.engineRef.current;
    if (!eng) return;
    const fresh = eng.ramales.find((r) => r.id === ramalEl.id);
    if (!fresh || !fresh.pts || fresh.pts.length < 2) return;
    const TOL = 0.5;
    const p0 = fresh.pts[0];
    const p1 = fresh.pts[fresh.pts.length - 1];
    const padre = eng.ramales.find((r) => r.id === padreId);
    const touchOnPadre = (e: number[]) =>
      (padre?.pts || []).some((p) => Math.hypot(p[0] - e[0], p[1] - e[1]) < TOL) ||
      pointOnRamalBody(padre?.pts || [], e, TOL);
    const t0 = touchOnPadre(p0);
    const t1 = touchOnPadre(p1);
    const epIsStart = t0 && !t1;
    // Renumeración: el tributario hereda el label consecutivo del grupo del padre
    // (T{n}{labelRaíz}) — igual que autoSplitJunctionAndSumFlow al crear un tributario por
    // guía, y con la misma cadena de raíz global (rootTributarioLabel). Sin esto el ramal
    // conservaba su label de ramal normal (RS1, AS1...) y no se distinguía de los troncos.
    const rootLbl = rootTributarioLabel(eng.ramales, padreId);
    const updates: Record<string, unknown> = {
      tipo: 'tributario',
      padre: padreId,
      // Convención de punta de flecha igual que autoSplitJunctionAndSumFlow (PlanoEngineDrawing.ts
      // 576-583): san/ll drenan HACIA la unión; af/ac/gas/vent fluyen DESDE la unión hacia el
      // aparato. La geometría ya está conectada (el ramal tocó y dividió a su padre al
      // dibujarse) — esto solo cambia la semántica.
      _tribReversed: fresh.net === 'san' || fresh.net === 'll' ? epIsStart : !epIsStart,
    };
    if (rootLbl) {
      updates.label = `T${allocTributaryNumber(eng, rootLbl)}${rootLbl}`;
    }
    eng.updateElementById(fresh.id, updates);
    if (ctx.selElement?.id === fresh.id) {
      ctx.setSelElement({ ...ctx.selElement, ...updates });
    }
    eng.render();
    eng._markDirty();
    ctx.setContextMenuState(null);
  };

  return (
    <>
      {ramalEl.tipo !== 'tributario' && tribCandidates.length > 0 && (
        <div
          style={{
            padding: '4px 8px',
            borderTop: '1px solid #3a494a',
            marginTop: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setTribConvOpen((o) => !o)}
            aria-expanded={tribConvOpen}
            style={{
              ...MENU_ACTION_BTN_STYLE,
              textAlign: 'left',
              whiteSpace: 'normal',
              lineHeight: 1.3,
            }}
          >
            {tribConvOpen ? '▾' : '▸'} Convertir en tributario de...
          </button>
          {tribConvOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={MENU_SECTION_LABEL_ROW_STYLE}>
                Elegir ramal padre (tocado por este ramal):
              </div>
              {tribCandidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => convertToTributario(c.id)}
                  style={{ ...MENU_ACTION_BTN_STYLE, textAlign: 'left' }}
                >
                  {ramalLabel(c, ctx.engineRef.current?.nivelActual?.label)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {contextMenuState.midRamalHit &&
        !contextMenuState.ramalEndpoint &&
        !['san', 'll'].includes(ramalEl.net) &&
        getAccessoryOptions(ramalEl.net).length > 0 && (
          <MidRamalAccessorySelector
            element={ramalEl}
            midRamalHit={contextMenuState.midRamalHit}
            engineRef={ctx.engineRef}
            selElement={ctx.selElement}
            setSelElement={ctx.setSelElement}
            setContextMenuState={ctx.setContextMenuState}
            planosCtx={ctx.planosCtx}
          />
        )}
      {contextMenuState.midRamalHit && !contextMenuState.ramalEndpoint && ramalEl.net === 'san' && (
        <MidRamalAccessorySelector
          element={ramalEl}
          midRamalHit={contextMenuState.midRamalHit}
          engineRef={ctx.engineRef}
          selElement={ctx.selElement}
          setSelElement={ctx.setSelElement}
          setContextMenuState={ctx.setContextMenuState}
          planosCtx={ctx.planosCtx}
        />
      )}
      {contextMenuState.midRamalHit &&
        !contextMenuState.ramalEndpoint &&
        ['af', 'ac'].includes(ramalEl.net) &&
        !isOccupiedTee && (
          <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
            <button
              type="button"
              onClick={() => {
                const eng = engineRef.current;
                const hit = contextMenuState.midRamalHit;
                if (!eng || !hit) return;
                eng.createMontanteMidBody(ramalEl.id, hit.x, hit.y, hit.segmentIdx);
                ctx.setContextMenuState(null);
              }}
              style={MENU_ACTION_BTN_STYLE}
            >
              + Crear montante (auto-tee)
            </button>
          </div>
        )}
      {contextMenuState.ramalEndpoint && ramalEl.net === 'af' && !isOccupiedTee && (
        <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
          <button
            type="button"
            onClick={() => {
              const eng = engineRef.current;
              const ep = contextMenuState.ramalEndpoint;
              if (!eng || !ep) return;
              eng.createCalentadorMidBody(ramalEl.id, ep.x, ep.y, ep.idx);
              ctx.setContextMenuState(null);
            }}
            style={MENU_ACTION_BTN_STYLE}
          >
            + Agregar calentador
          </button>
        </div>
      )}
      {contextMenuState.midRamalHit &&
        !contextMenuState.ramalEndpoint &&
        ['af', 'ac'].includes(ramalEl.net) &&
        isExistingTee && (
          <div
            style={{
              padding: '4px 8px',
              borderTop: '1px solid #3a494a',
              marginTop: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={MENU_SECTION_LABEL_ROW_STYLE}>Segmento libre de la tee</div>
            {(['tapon', 'llaveTerminal'] as const).map((accId) => (
              <button
                type="button"
                key={accId}
                onClick={() => {
                  const eng = engineRef.current;
                  if (!eng) return;
                  eng.createTeeCapStub(ramalEl.id, existingTeeIdx, accId);
                  ctx.setContextMenuState(null);
                }}
                style={MENU_ACTION_BTN_STYLE}
              >
                + {accId === 'tapon' ? 'Tapón' : 'Llave Terminal'}
              </button>
            ))}
          </div>
        )}
      {contextMenuState.ramalEndpoint && (
        <BajanteConnectionPanel
          element={ramalEl}
          isGhostClick={contextMenuState.isGhostClick || false}
          ramalEndpoint={contextMenuState.ramalEndpoint}
          engineRef={ctx.engineRef}
          selElement={ctx.selElement}
          setSelElement={ctx.setSelElement}
          setContextMenuState={ctx.setContextMenuState}
          activeNet={ctx.activeNet}
          planosCtx={ctx.planosCtx}
        />
      )}
      <BajanteCodeEditor
        element={element}
        engineRef={ctx.engineRef}
        selElement={ctx.selElement}
        setSelElement={ctx.setSelElement}
        setContextMenuState={ctx.setContextMenuState}
        mats={ctx.mats}
        activeNet={ctx.activeNet}
        setDiamSel={ctx.setDiamSel}
        planosCtx={ctx.planosCtx}
      />
      <div
        style={{
          padding: '4px 8px',
          borderTop: '1px solid #3a494a',
          marginTop: 4,
        }}
      >
        {!ramalHasInterconnections(engineRef.current, ramalEl) && (
          <button
            type="button"
            onClick={() => {
              const eng = engineRef.current;
              if (!eng) return;
              // Invierte el ramal en su sitio: revierte pts + intercambia todo campo simétrico
              // respecto a los extremos.
              // La flecha de dirección de flujo (dibujada en vivo desde pts[0] vs pts[last])
              // se invierte automáticamente.
              const r = eng.ramales.find((x) => x.id === ramalEl.id);
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
              if (aparatoEnExtremoInvalido(eng.ramales, eng.bajantes || [], r)) {
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
            style={MENU_ACTION_BTN_STYLE}
          >
            ⇄ Invertir dirección del flujo
          </button>
        )}
        {/* Los tributarios de AF/AC/gas nunca muestran este botón — su dirección de flujo es fija
            (cola siempre hacia la unión, ver autoSplitJunctionAndSumFlow) y no se puede cambiar,
            así que la unión que crean queda siempre garantizada como 2 salidas + 1 entrada. */}
        {ramalHasInterconnections(engineRef.current, ramalEl) &&
          ['af', 'ac', 'gas'].includes(ramalEl.net) &&
          ramalEl.tipo !== 'tributario' && (
            <button
              type="button"
              aria-pressed={!!ramalEl._tribReversed}
              style={
                ramalEl._tribReversed
                  ? { ...MENU_ACTION_BTN_STYLE, background: '#00dce5', color: '#1e2024' }
                  : MENU_ACTION_BTN_STYLE
              }
              onClick={() => {
                const eng = engineRef.current;
                if (!eng) return;
                // Ítem 2 (rev 5): si el ramal ya tiene aparato asignado y el toggle lo dejaría
                // en un extremo inválido (conectado a la red o en contra del flujo), se alerta
                // ANTES de abrir el modal de cambio de dirección de flujo.
                const sim = { ...ramalEl, _tribReversed: !ramalEl._tribReversed };
                if (aparatoEnExtremoInvalido(eng.ramales, eng.bajantes || [], sim)) {
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
                const ucInfo = ctx.readUcInfo(ramalEl);
                if (ucInfo.total > 0) {
                  const neighbors = directNeighborRamales(eng.ramales, ramalEl);
                  if (neighbors.length > 0) {
                    ctx.openUcMove({
                      isOpen: true,
                      sourceLabel: ramalLabel(ramalEl),
                      ramalId: ramalEl.id,
                      options: neighbors.map((n) => ({ id: n.id, label: ramalLabel(n) })),
                    });
                    return;
                  }
                }
                ctx.doInvert(ramalEl, null);
              }}
            >
              ⇄ Invertir dirección de flujo
            </button>
          )}
      </div>
      <div
        style={{
          padding: '4px 8px',
          borderTop: '1px solid #3a494a',
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, color: '#e2e2e8', fontFamily: "'Geist',monospace" }}>
          Bloquear Movimiento-Longitud
        </span>
        <input
          type="checkbox"
          checked={!!ramalEl.bloqueado}
          aria-label="Bloquear movimiento"
          onChange={(e) => {
            const val = e.target.checked;
            if (engineRef.current) {
              engineRef.current?.updateElementById(ramalEl.id, { bloqueado: val });
              if (selElement?.id === ramalEl.id) {
                setSelElement({ ...selElement, bloqueado: val });
              }
              engineRef.current?.render();
            }
          }}
          style={{ accentColor: '#F5A623', cursor: 'pointer', margin: 0 }}
        />
      </div>
      {['san', 'll'].includes(ctx.activeNet) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '4px 8px',
            borderTop: '1px solid #3a494a',
            marginTop: 4,
          }}
        >
          <div style={MENU_SECTION_LABEL_ROW_STYLE}>Bajantes asociados</div>
          <div style={MENU_GRID_2COL_TALL_STYLE}>
            {(() => {
              const currentId = ramalEl.id;
              const netBajantes = (engineRef.current?.bajantes || []).filter(
                (b) => b.net === ramalEl.net && b.id !== ramalEl.id && b.tipo !== 'tributario',
              );
              if (netBajantes.length === 0)
                return (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b8cae',
                      fontFamily: "'Geist',monospace",
                      gridColumn: 'span 4',
                    }}
                  >
                    Sin bajantes
                  </div>
                );
              return netBajantes.map((b) => {
                const isAssociated = (b.recibeDeIds || []).includes(currentId);
                return (
                  <label key={b.id} style={MENU_CHECK_ROW_STYLE}>
                    <input
                      type="checkbox"
                      checked={isAssociated}
                      onChange={(e) => {
                        const recibidos = b.recibeDeIds || [];
                        const newRecibe = e.target.checked
                          ? [...recibidos, currentId]
                          : recibidos.filter((id: string) => id !== currentId);
                        const extraFields: Record<string, unknown> = { recibeDeIds: newRecibe };
                        if (e.target.checked) {
                          extraFields.descargaEnId = currentId;
                        } else if (
                          b.descargaEnId === currentId ||
                          b.descargaEnId?.endsWith('|' + currentId)
                        ) {
                          extraFields.descargaEnId = null;
                        }
                        engineRef.current?.updateElementById(b.id, extraFields);
                        if (selElement?.id === b.id) {
                          setSelElement({ ...selElement, ...extraFields });
                        }
                      }}
                      style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {bajanteLabel(b, engineRef.current?.nivelActual?.label)}
                    </span>
                  </label>
                );
              });
            })()}
          </div>
        </div>
      )}
    </>
  );
}
