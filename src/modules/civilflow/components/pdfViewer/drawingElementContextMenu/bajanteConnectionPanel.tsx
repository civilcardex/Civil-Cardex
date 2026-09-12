import { ramalLabel } from '../../../utils/accessoryAbbreviations';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { DIAM_BY_MAT } from '../../../constants';
import { getAccessoryOptions } from '../../../utils/accessoryOptions';
import { BAJANTE_NETS, MONTANTE_NETS } from '../../../lib/PlanoEngine/drawingCreations';
import { codoPolarityOk, flowEndsAt } from '../../../lib/PlanoEngine/PlanoEngineDrawing';
import { hasTeeAtPoint } from '../../../lib/PlanoEngine/ventCodoTeeFix';
import {
  syncExtremeAccessoryToHidroData,
  bumpAparatoCount,
} from '../../../utils/syncExtremeAccessory';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import { puedeConectarRamalABajante } from '../../../lib/PlanoEngine/bajanteRules';
import { matchDiamOption } from '../../../utils/diamOptionMatch';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import {
  NETS,
  type PlanoBajante,
  type PlanoElement,
  type PlanoRamal,
} from '../../../lib/PlanoEngine/PlanoState';
import type { PlanItem } from '../../../context/PlansContext';
import {
  MENU_SELECT_STYLE,
  MENU_GRID_2COL_STYLE,
  MENU_CHECK_LABEL_STYLE,
  MENU_ACTION_BTN_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  type ContextMenuState,
} from './context';

/** Panel del menú contextual para bajantes y extremos de ramal: ramales asociados (Y doble),
 *  creación de bajante/montante en el extremo y editor del accesorio de extremo con sus
 *  validaciones de polaridad y diámetro. */
export function BajanteConnectionPanel({
  element,
  isGhostClick = false,
  ramalEndpoint,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  activeNet,
  planosCtx,
}: {
  element: PlanoBajante | PlanoRamal;
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  activeNet: string;
  planosCtx?: { plans: PlanItem[] };
}) {
  const hasPts = !!(element as Partial<PlanoRamal>).pts;
  const bajEl = element as PlanoBajante;
  const ramalEl = element as PlanoRamal;

  return (
    <>
      {!hasPts && !isGhostClick && ['san', 'll'].includes(activeNet) && (
        <>
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
            <div style={MENU_SECTION_LABEL_ROW_STYLE}>Ramales asociados</div>
            <div style={MENU_GRID_2COL_STYLE}>
              {(() => {
                const bajRamales = (engineRef.current?.ramales || []).filter(
                  (r) => r.net === activeNet && r.tipo !== 'tributario',
                );
                if (bajRamales.length === 0)
                  return (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#6b8cae',
                        fontFamily: "'Geist',monospace",
                        gridColumn: 'span 2',
                      }}
                    >
                      Sin ramales
                    </div>
                  );
                const recibidos = bajEl.recibeDeIds || [];
                const alimentados = bajEl.alimentaIds || [];
                const bajCode = bajEl.code || bajEl.id;
                return bajRamales.map((r) => {
                  // Ítem: marcar como asociado TODO ramal conectado, entre o salga
                  // (recibeDeIds, alimentaIds o ini/fin al código), además de los que tocan
                  // geométricamente — para que aparezcan checkeados todos aunque alguna
                  // referencia esté incompleta o stale.
                  const touchesBaj =
                    !!r.pts && r.pts.some((p) => Math.hypot(p[0] - bajEl.x, p[1] - bajEl.y) < 0.5);
                  const isAssociated =
                    recibidos.includes(r.id) ||
                    alimentados.includes(r.id) ||
                    r.ini === bajCode ||
                    r.fin === bajCode ||
                    touchesBaj;
                  const rStart = r.pts?.[0];
                  const rEnd = r.pts?.[r.pts.length - 1];
                  const distStart = rStart
                    ? Math.hypot(rStart[0] - bajEl.x, rStart[1] - bajEl.y)
                    : Infinity;
                  const distEnd = rEnd
                    ? Math.hypot(rEnd[0] - bajEl.x, rEnd[1] - bajEl.y)
                    : Infinity;
                  const isAtStart = distStart <= distEnd;
                  return (
                    <label key={r.id} style={MENU_CHECK_LABEL_STYLE}>
                      <input
                        type="checkbox"
                        checked={isAssociated}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          // Se lee recibeDeIds en vivo del objeto bajante del engine en lugar
                          // de la copia `recibidos` capturada en el closure — si se alternan dos
                          // checkboxes antes de que React re-renderice entre ellos, cada uno
                          // calcularía newRecibe desde el mismo array obsoleto y pisaría el
                          // cambio del otro.
                          const liveBaj = engineRef.current?.bajantes.find(
                            (bb) => bb.id === bajEl.id,
                          );
                          const liveRecibe: string[] = liveBaj?.recibeDeIds || recibidos;
                          // Regla central (ítem 1.2): el tope de asociaciones se valida ANTES de
                          // escribir cualquier campo — recibeDeIds, ini/fin o estado del panel.
                          if (checked && liveBaj) {
                            const check = puedeConectarRamalABajante(liveBaj, r);
                            if (!check.ok) {
                              if (check.title && check.msg)
                                engineRef.current?.triggerAlert(check.title, check.msg);
                              e.preventDefault();
                              return;
                            }
                          }
                          if (checked && liveRecibe.length === 1) {
                            const existing = engineRef.current?.ramales.find(
                              (x) => x.id === liveRecibe[0],
                            );
                            if (existing && existing.diametro && r.diametro) {
                              const p1 = diamPulgFromLabel(existing.diametro);
                              const p2 = diamPulgFromLabel(r.diametro);
                              if (p1 > 0 && p2 > 0 && Math.abs(p1 - p2) > 0.01) {
                                engineRef.current?.triggerAlert(
                                  'Diámetros no compatibles',
                                  'Los dos ramales que llegan a un mismo bajante (Y doble) deben tener el mismo diámetro en sus brazos laterales.',
                                );
                                e.preventDefault();
                                return;
                              }
                            }
                          }
                          const newRecibe = checked
                            ? [...liveRecibe, r.id]
                            : liveRecibe.filter((id: string) => id !== r.id);
                          const liveAlimenta: string[] =
                            (liveBaj?.alimentaIds as string[] | undefined) || alimentados;
                          // Desmarcar una salida también la saca de alimentaIds (si no, el
                          // checkbox seguiría marcado por la referencia explícita).
                          const newAlimenta = checked
                            ? liveAlimenta
                            : liveAlimenta.filter((id: string) => id !== r.id);
                          engineRef.current?.updateElementById(bajEl.id, {
                            recibeDeIds: newRecibe,
                            alimentaIds: newAlimenta,
                          });
                          setContextMenuState((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  element: {
                                    ...prev.element,
                                    recibeDeIds: newRecibe,
                                    alimentaIds: newAlimenta,
                                  },
                                }
                              : null,
                          );
                          if (selElement?.id === bajEl.id) {
                            setSelElement({
                              ...selElement,
                              recibeDeIds: newRecibe,
                              alimentaIds: newAlimenta,
                            });
                          }
                          const bajCode = bajEl.code || bajEl.id;
                          const currentIni = r.ini || '';
                          const currentFin = r.fin || '';
                          // Desmarcar limpia ini/fin por VALOR (si apuntan a este bajante),
                          // no por proximidad — el trazo pudo moverse y el extremo cercano ya
                          // no ser el asociado (igual que "Cajas asociadas").
                          const ramalUpdates: Record<string, unknown> = {};
                          if (!checked) {
                            if (currentIni === bajCode) ramalUpdates.ini = '';
                            if (currentFin === bajCode) ramalUpdates.fin = '';
                          } else if (isAtStart) {
                            ramalUpdates.ini = bajCode;
                          } else {
                            ramalUpdates.fin = bajCode;
                          }
                          if (Object.keys(ramalUpdates).length)
                            engineRef.current?.updateElementById(r.id, ramalUpdates);
                          engineRef.current?.render();
                          engineRef.current?._markDirty();
                        }}
                        style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {ramalLabel(r, engineRef.current?.nivelActual?.label)}
                      </span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>
        </>
      )}

      {hasPts &&
        ramalEndpoint &&
        (() => {
          const supNets = ['san', 'll', 'vent', 'af', 'ac', 'gas', 'rci', 'rec'];
          if (!supNets.includes(ramalEl.net)) return null;
          const ep = ramalEndpoint;

          const netDef = NETS.find((n) => n.id === ramalEl.net);

          return (
            <>
              <div
                style={{
                  padding: '4px 8px',
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 4,
                  flexWrap: 'wrap',
                }}
              >
                {(['bajante', 'montante'] as const)
                  .filter((bmLabel) =>
                    bmLabel === 'montante'
                      ? MONTANTE_NETS.includes(ramalEl.net)
                      : BAJANTE_NETS.includes(ramalEl.net),
                  )
                  .map((bmLabel) => {
                    const isMon = bmLabel === 'montante';
                    const pfx = isMon
                      ? netDef?.bmType === 'montante'
                        ? netDef?.bmPfx || 'MON'
                        : 'M' + (netDef?.lbl || 'MON')
                      : netDef?.bmPfx || 'B';
                    const existingExtreme = (engineRef.current?.bajantes || []).find(
                      (b) =>
                        Math.abs(b.x - ep.x) < 0.5 &&
                        Math.abs(b.y - ep.y) < 0.5 &&
                        b.net === ramalEl.net,
                    );
                    if (existingExtreme) return null;
                    const fieldAcc = ep.idx === 0 ? 'accesorioInicio' : 'accesorioFin';
                    const fieldApp = ep.idx === 0 ? 'aparatoInicio' : 'aparatoFin';
                    if (ramalEl[fieldAcc] || ramalEl[fieldApp]) return null;
                    return (
                      <button
                        type="button"
                        key={bmLabel}
                        onClick={() => {
                          const eng = engineRef.current;
                          if (!eng) return;
                          const cnt =
                            eng.bajantes.filter(
                              (b) => b.tipo === bmLabel && (!isMon || b.net === ramalEl.net),
                            ).length + 1;
                          const id = isMon ? pfx + cnt + '_' + ramalEl.net : pfx + cnt;
                          const code = isMon ? pfx + cnt : id;
                          const nl = eng.nivelActual;
                          // Ítem 3: dirección automática según flujo del ramal en el extremo
                          const flowToEp = flowEndsAt(ramalEl, [ep.x, ep.y], 0.5);
                          const autoDir = (flowToEp ? 'baja' : 'sube') as 'baja' | 'sube';
                          eng.bajantes.push({
                            id,
                            net: ramalEl.net,
                            tipo: bmLabel,
                            code: code,
                            direccion: autoDir,
                            x: ep.x,
                            y: ep.y,
                            pisoBase: nl?.label ?? '',
                            pisoCima: nl?.label ?? '',
                            nptBase: nl?.npt ?? 0,
                            nptCima: nl?.npt ?? 0,
                            hVert: 0,
                            dNominal: ramalEl.diametro || '',
                            recibeDeIds: [ramalEl.id],
                            alimentaIds: [],
                            descargaEnId: null,
                            ucAcum: 0,
                            ucExtra: 0,
                            area_m2: 0,
                            desplazamientos: {},
                            lblOffX: 0,
                            lblOffY: 0,
                            labelAngle: 0,
                            labelX: ep.x,
                            labelY: ep.y + 20,
                            bajR: 7 / 24,
                          });
                          // Relleno automático del ini/fin del ramal
                          if (ep.idx === 0) {
                            eng.updateElementById(ramalEl.id, { ini: code });
                          } else {
                            eng.updateElementById(ramalEl.id, { fin: code });
                          }
                          // Se bloquea el ramal para que el bajante recién anclado no pueda
                          // arrastrarse de forma independiente
                          eng.updateElementById(ramalEl.id, { bloqueado: true });
                          if (bmLabel === 'montante') {
                            eng._renumberMontantes();
                          } else {
                            eng._renumberBajantes(ramalEl.net);
                          }
                          const newlyCreated = eng.bajantes.find(
                            (b) => b.tipo === bmLabel && b.x === ep.x && b.y === ep.y,
                          );
                          if (newlyCreated) {
                            eng.selId = newlyCreated.id;
                            eng._emitSelect(newlyCreated);
                          }
                          eng._isGhostSel = false;
                          eng.render();
                          eng._markDirty();
                          setContextMenuState(null);
                        }}
                        style={MENU_ACTION_BTN_STYLE}
                      >
                        + Crear {bmLabel}
                      </button>
                    );
                  })}
              </div>

              {(ramalEl.tipo === 'tributario' || ramalEl.tipo === 'ramal') &&
                ['san', 'af', 'ac', 'gas', 'vent'].includes(ramalEl.net) &&
                (() => {
                  const isStart = ep.idx === 0;
                  const fieldAcc: 'accesorioInicio' | 'accesorioFin' = isStart
                    ? 'accesorioInicio'
                    : 'accesorioFin';
                  const fieldDiam: 'diametroInicio' | 'diametroFin' = isStart
                    ? 'diametroInicio'
                    : 'diametroFin';
                  const fieldApp: 'aparatoInicio' | 'aparatoFin' = isStart
                    ? 'aparatoInicio'
                    : 'aparatoFin';

                  const currentAcc = ramalEl[fieldAcc] || '';

                  const accOptions = getAccessoryOptions(ramalEl.net);

                  return (
                    <div
                      style={{
                        padding: '4px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        borderBottom: '1px solid #3a494a',
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#849495',
                          fontFamily: "'Geist',monospace",
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        Extremo {isStart ? 'Inicio (Aparato)' : 'Fin (Ramal)'}
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: '#849495',
                            marginBottom: 2,
                            textTransform: 'uppercase',
                          }}
                        >
                          Seleccionar Accesorio
                        </div>
                        <select
                          value={currentAcc}
                          aria-label="Seleccionar Accesorio"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              if (ramalEl[fieldApp]) {
                                engineRef.current?.triggerAlert(
                                  'Aparato existente',
                                  'Este extremo ya tiene un aparato. Elimínalo antes de asignar un accesorio.',
                                );
                                return;
                              }
                              const existingBm = (engineRef.current?.bajantes || []).find(
                                (b) =>
                                  Math.abs(b.x - ep.x) < 0.5 &&
                                  Math.abs(b.y - ep.y) < 0.5 &&
                                  b.net === ramalEl.net,
                              );
                              if (existingBm) {
                                engineRef.current?.triggerAlert(
                                  'Elemento existente',
                                  `Ya existe un ${existingBm.tipo} (${existingBm.code || existingBm.id}) en este extremo. Elimínalo antes de asignar un accesorio.`,
                                );
                                return;
                              }
                              if (
                                val === 'codoReventilado' &&
                                (diamPulgFromLabel(ramalEl.diametro || '') < 3 ||
                                  diamPulgFromLabel(ramalEl.diametro || '') > 4)
                              ) {
                                engineRef.current?.triggerAlert(
                                  'Diámetro no permitido',
                                  'La tubería principal sanitaria con codo reventilado solo admite diámetro de 3" o 4".',
                                );
                                return;
                              }
                              // Ítem 2 (reventilado): el codo reventilado NO puede recibir
                              // flujo — si el flujo del ramal sanitario termina en el extremo
                              // (lo recibe), bloquear. Solo es válido en el extremo DESDE donde
                              // fluye el ramal (junto al sifón del aparato).
                              if (val === 'codoReventilado' && ramalEl.net === 'san') {
                                const epPt: number[] = [ep.x, ep.y];
                                if (flowEndsAt(ramalEl, epPt, 0.5)) {
                                  engineRef.current?.triggerAlert(
                                    'Codo reventilado no puede recibir flujo',
                                    'El codo reventilado debe colocarse en el extremo DESDE donde fluye el ramal sanitario. Invierte la dirección del ramal.',
                                  );
                                  return;
                                }
                              }
                              // Ítems 4/5 (polaridad sube/baja) en extremo: sube solo ENTREGA
                              // (cola de la flecha al extremo — flujo SALE de ahí); baja solo
                              // RECIBE (cabeza de la flecha al extremo — flujo LLEGA ahí). Se
                              // valida contra el ramal VIVO del engine (el snapshot `ramalEl`
                              // puede estar stale si el flujo cambió tras abrir el menú).
                              if (
                                (val === 'codoSube' ||
                                  val === 'codoBaja' ||
                                  val === 'codo90rmSube' ||
                                  val === 'codo90rmBaja') &&
                                engineRef.current
                              ) {
                                const live = engineRef.current.ramales.find(
                                  (r) => r.id === ramalEl.id,
                                );
                                const target = live || ramalEl;
                                const isVentTee2 =
                                  target.net === 'vent' &&
                                  hasTeeAtPoint(engineRef.current, [ep.x, ep.y], target.net);
                                if (
                                  !isVentTee2 &&
                                  !codoPolarityOk(target, [ep.x, ep.y], val, 0.5)
                                ) {
                                  const isSube = val === 'codoSube' || val === 'codo90rmSube';
                                  engineRef.current.triggerAlert(
                                    'Polaridad de codo incorrecta',
                                    isSube
                                      ? 'El codo 90° sube solo puede entregar flujo: la cola de la flecha debe apuntar al extremo (el flujo sale de ahí hacia el codo).'
                                      : 'El codo 90° baja solo puede recibir flujo: la cabeza de la flecha debe apuntar al extremo (el flujo llega ahí desde el codo).',
                                  );
                                  return;
                                }
                              }
                              // Si este extremo ya tiene un accesorio distinto, se reemplaza
                              // directamente por la nueva selección en lugar de bloquear con alerta.
                            }
                            if (engineRef.current) {
                              const accessoryVal = val as string;
                              // Sifón redirect: si el usuario lo pone en el extremo que RECIBE
                              // flujo (!isStart), redirigir automáticamente al extremo libre.
                              let useFieldAcc = fieldAcc;
                              let useFieldDiam = fieldDiam;
                              let useIsStart = isStart;
                              if (accessoryVal === 'sifon' && ramalEl.net === 'san' && !isStart) {
                                const otherAcc = ramalEl['accesorioInicio'] || '';
                                const otherApp = ramalEl['aparatoInicio'] || '';
                                if (!otherAcc && !otherApp) {
                                  useFieldAcc = 'accesorioInicio';
                                  useFieldDiam = 'diametroInicio';
                                  useIsStart = true;
                                } else {
                                  engineRef.current.triggerAlert(
                                    'Revisar ubicación del sifón',
                                    'El sifón no puede recibir flujo y el extremo opuesto ya está ocupado.',
                                  );
                                  return;
                                }
                              }
                              if (
                                (accessoryVal === 'llaveTerminal' ||
                                  accessoryVal === 'teeLlaveTerminal') &&
                                useIsStart
                              ) {
                                engineRef.current.triggerAlert(
                                  'Revisar ubicación llave terminal',
                                  'La llave terminal debe recibir el flujo.',
                                );
                                return;
                              }
                              const oldVal = ramalEl[useFieldAcc] || '';
                              const updates: Record<string, unknown> = { [useFieldAcc]: val };
                              // El accesorio hereda el diámetro del ramal como valor por defecto:
                              // si el ramal ya tiene diámetro asignado, el accesorio nuevo nace
                              // con ese mismo diámetro (resuelto al valor canónico del selector);
                              // si no, queda "Ninguno".
                              if (val && !oldVal) {
                                const aMatShort =
                                  ramalEl.material || (ramalEl.net === 'san' ? 'PVC-S' : '');
                                const aDiamList =
                                  (ramalEl.net === 'san' && DIAM_BY_MAT['PVC-S']) ||
                                  DIAM_BY_MAT[aMatShort] ||
                                  [];
                                updates[useFieldDiam] = matchDiamOption(
                                  aDiamList,
                                  ramalEl.diametro,
                                );
                              }
                              // Sifón desde el EXTREMO = mismo comportamiento que desde el
                              // cuerpo (orig. usuario): suma el aparato 'sif' y auto-asigna el
                              // diámetro del ramal si está vacío.
                              if (val === 'sifon' && ramalEl.net === 'san' && !ramalEl.diametro) {
                                updates.diametro = '2"';
                              }
                              engineRef.current.updateElementById(ramalEl.id, updates);
                              setContextMenuState((prev) =>
                                prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
                              );
                              if (selElement?.id === ramalEl.id) {
                                setSelElement({ ...selElement, ...updates });
                              }
                              engineRef.current.render();
                              // Mismo orden que ExtremeAccessoryEditor: el sync de conteos debe
                              // correr ANTES del reconcile de _markDirty, o el bump +1 duplica el
                              // accesorio en hidroData (reducción contada dos veces en el resumen).
                              if (val !== oldVal && planosCtx?.plans) {
                                syncExtremeAccessoryToHidroData(
                                  ramalEl.id,
                                  useFieldAcc,
                                  oldVal,
                                  val,
                                  planosCtx.plans,
                                );
                              } else if (val !== oldVal && ramalEl.net === 'san') {
                                // Sin planes confirmados el sync no corre — el bump del aparato
                                // 'sif' se hace directo para no perder la cantidad (orig. usuario).
                                const planId = engineRef.current?._loadedPlanId ?? '';
                                if (val === 'sifon')
                                  bumpAparatoCount('san', ramalEl.id, planId, 'sif', +1);
                                if (oldVal === 'sifon')
                                  bumpAparatoCount('san', ramalEl.id, planId, 'sif', -1);
                              }
                              engineRef.current._markDirty();
                            }
                          }}
                          style={MENU_SELECT_STYLE}
                        >
                          <option value="">Ninguno</option>
                          {accOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Diámetro del accesorio — defaults to ramal's own diameter, validates
                          the chosen value is not smaller than the ramal's. */}
                      {ramalEl[fieldAcc] &&
                        (() => {
                          const matShort =
                            ramalEl.material || (ramalEl.net === 'san' ? 'PVC-S' : '');
                          const diamList =
                            (ramalEl.net === 'san' && DIAM_BY_MAT['PVC-S']) ||
                            DIAM_BY_MAT[matShort] ||
                            [];
                          if (diamList.length === 0) return null;
                          const currentDiam =
                            matchDiamOption(diamList, ramalEl[fieldDiam]) ||
                            matchDiamOption(diamList, ramalEl.diametro) ||
                            '';
                          return (
                            <div style={{ marginTop: 6 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#849495',
                                  marginBottom: 2,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                }}
                              >
                                Diámetro del accesorio
                              </div>
                              <select
                                value={currentDiam}
                                aria-label="Diámetro del accesorio"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v && ramalEl.diametro) {
                                    const inchFrom = (d: string) => {
                                      const q = d.indexOf('"');
                                      return q > 0 ? d.slice(0, q) : d;
                                    };
                                    // Leer el diámetro del ramal fresco del engine — el snapshot
                                    // ramalEl puede estar stale si el ramal se editó desde
                                    // TramoEditor mientras el menú estaba abierto.
                                    const fresh = engineRef.current?.ramales.find(
                                      (x) => x.id === ramalEl.id,
                                    );
                                    const ramalDiam = fresh?.diametro || ramalEl.diametro;
                                    if (
                                      ramalDiam &&
                                      diamPulgFromLabel(inchFrom(v)) >
                                        diamPulgFromLabel(inchFrom(ramalDiam))
                                    ) {
                                      engineRef.current?.triggerAlert(
                                        'Diámetro no permitido',
                                        'El diámetro del accesorio no puede ser mayor al diámetro del ramal.',
                                      );
                                      return;
                                    }
                                  }
                                  const u: Record<string, unknown> = { [fieldDiam]: v };
                                  engineRef.current?.updateElementById(ramalEl.id, u);
                                  setContextMenuState((prev) =>
                                    prev ? { ...prev, element: { ...prev.element, ...u } } : null,
                                  );
                                  if (selElement?.id === ramalEl.id) {
                                    setSelElement({ ...selElement, ...u });
                                  }
                                }}
                                style={MENU_SELECT_STYLE}
                              >
                                <option value="">— Sin diámetro —</option>
                                {diamList.map((d) => {
                                  return (
                                    <option key={d.n} value={d.n}>
                                      {normalizeDnLabel(d.n)}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          );
                        })()}
                    </div>
                  );
                })()}
            </>
          );
        })()}
    </>
  );
}
