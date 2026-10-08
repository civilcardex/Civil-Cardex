// Secciones de editor: bajante (con panel de bomba) y ramal. Extraídas verbatim de variants.
import { bajanteLabel } from '../../../utils/accessoryAbbreviations';
import ExtremeAccessoryEditor from '../ExtremeAccessoryEditor';
import type { PlanoBajante, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import { puedeConectarRamalABajante, esCaja } from '../../../lib/PlanoEngine/bajanteRules';
import {
  asociarBomba,
  quitarBomba,
  bombsImmediateLowerFloor,
} from '../../../utils/bombaAssociation';
import {
  useTramoEditorContext,
  CHECK_GRID_STYLE,
  CHECK_ROW_STYLE,
  type ProbedElement,
} from './context';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import { BajanteEditor, RamalEditor } from './legacyEditors';

export function BajanteEditorSection() {
  const ctx = useTramoEditorContext();
  const { engineRef, activeNet } = ctx;
  const selElement = ctx.selElement as ProbedElement | null;
  const lvl = engineRef.current?.nivelActual?.label ?? '';

  const isGhostSel =
    (selElement &&
      (selElement.tipo === 'bajante' || selElement.tipo === 'montante') &&
      engineRef.current?._isGhostSel) ||
    false;

  const esBajSanLl =
    (selElement as PlanoBajante | null)?.tipo === 'bajante' &&
    ['san', 'll'].includes(activeNet) &&
    !isGhostSel;

  return (
    <>
      <BajanteEditor
        selElement={selElement as PlanoBajante}
        activeNet={activeNet}
        engineRef={engineRef}
        setSelElement={ctx.setSelElement}
        handleUpdateSel={ctx.handleUpdateSel}
        isGhostSel={isGhostSel}
        lvl={lvl}
      />
      {esBajSanLl && (
        <AsociarBombaPanel
          selElement={selElement as PlanoBajante}
          engineRef={engineRef}
          setSelElement={ctx.setSelElement}
          plans={ctx.plans || []}
          triggerConfirm={ctx.triggerConfirm}
        />
      )}
    </>
  );
}

/** Panel derecho — "Asociar bomba del piso inferior": mismos checkboxes que el menú
 *  contextual (solo bombas del piso INMEDIATAMENTE inferior); al marcar, el bajante recibe
 *  las MISMAS UDs de la bomba (herencia hacia arriba vía `bombaEnId` + libro ucAplicado). */
function AsociarBombaPanel({
  selElement,
  engineRef,
  setSelElement,
  plans,
  triggerConfirm,
}: {
  selElement: PlanoBajante;
  engineRef: React.MutableRefObject<import('../../../lib/PlanoEngine/PlanoEngine').default | null>;
  setSelElement: (el: PlanoBajante) => void;
  plans: { id: string | number; nivel: number | null; status?: string }[];
  triggerConfirm?: (title: string, message: string, onOk: () => void, okLabel?: string) => void;
}) {
  const currentPlanId = String(engineRef.current?._loadedPlanId ?? '');
  const bombas = bombsImmediateLowerFloor(plans as never, currentPlanId);
  return (
    <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
      <div
        style={{
          fontSize: 12,
          color: '#9BA8AA',
          fontFamily: "'Geist',monospace",
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Asociar bomba del piso inferior
      </div>
      {bombas.length === 0 && (
        <div style={{ fontSize: 12, color: '#8AB4D6', fontFamily: "'Geist',monospace" }}>
          Sin bombas en el piso inmediatamente inferior
        </div>
      )}
      {bombas.map((row) => {
        const checked = selElement.bombaEnId === `${row.planId}|${row.id}`;
        return (
          <label key={row.planId + '|' + row.id} style={CHECK_ROW_STYLE}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                const eng = engineRef.current;
                if (!eng) return;
                // Capturar el booleano YA (checkbox controlado: el modal re-renderiza y
                // resetea el DOM antes de que Aceptar ejecute el commit).
                const checked = e.target.checked;
                const commit = () => {
                  if (checked) asociarBomba(eng, selElement, currentPlanId, row, plans as never);
                  else quitarBomba(eng, selElement, currentPlanId, plans as never);
                  setSelElement({
                    ...selElement,
                    bombaEnId: checked ? `${row.planId}|${row.id}` : null,
                  } as PlanoBajante);
                };
                // Mismo aviso que la asociación entre pisos (ids correctos): al marcar con la
                // bomba desalineada se creará un ramal de desvío en el piso de la bomba.
                const aligned =
                  Math.abs((selElement.x ?? 0) - row.x) < 0.5 &&
                  Math.abs((selElement.y ?? 0) - row.y) < 0.5;
                if (aligned || !checked) {
                  commit();
                  return;
                }
                triggerConfirm?.(
                  'Crear fantasma de asociación',
                  `${selElement.code || selElement.id} y ${row.code} no están alineados. Se creará un ramal de desvío en el piso de la bomba, desde la posición de ${row.code}. ¿Continuar?`,
                  commit,
                  'Aceptar',
                );
              }}
              style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
            />
            <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {row.code}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function RamalEditorSection() {
  const ctx = useTramoEditorContext();
  const {
    engineRef,
    setSelElement,
    activeNet,
    plans,
    diamSel,
    gasMatSel,
    pendSel,
    pendInput,
    mats,
    matLongName,
    setDiamSel,
    setGasMatSel,
    setPendSel,
    setPendInput,
  } = ctx;
  const selElement = ctx.selElement as ProbedElement | null;
  const isSelActiveNet = selElement && selElement.net === activeNet;

  return (
    <>
      <RamalEditor
        selElement={selElement as PlanoRamal | null}
        activeNet={activeNet}
        engineRef={engineRef}
        setSelElement={setSelElement}
        isSelActiveNet={isSelActiveNet}
        diamSel={diamSel}
        gasMatSel={gasMatSel}
        pendSel={pendSel}
        pendInput={pendInput}
        mats={mats}
        matLongName={matLongName}
        setDiamSel={setDiamSel}
        setGasMatSel={setGasMatSel}
        setPendSel={setPendSel}
        setPendInput={setPendInput}
      />
      {selElement && ['tributario', 'ramal'].includes(selElement.tipo ?? '') && (
        <ExtremeAccessoryEditor
          selElement={selElement as PlanoRamal}
          engineRef={engineRef}
          setSelElement={(el) => setSelElement(el)}
          activeNet={activeNet}
          plans={plans}
        />
      )}
      {selElement?.pts &&
        (engineRef.current?.bajantes?.length ?? 0) > 0 &&
        ['san', 'll'].includes(activeNet) && (
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Bajantes asociados
            </div>
            <div style={CHECK_GRID_STYLE}>
              {(() => {
                const netBajs = (engineRef.current?.bajantes || []).filter(
                  (b) => b.net === activeNet && b.tipo !== 'tributario' && !esCaja(b),
                );
                if (netBajs.length === 0)
                  return (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#8AB4D6',
                        fontFamily: "'Geist',monospace",
                        padding: '4px',
                        gridColumn: 'span 2',
                      }}
                    >
                      Sin bajantes en esta red
                    </div>
                  );
                return netBajs.map((b) => {
                  // Igual que "Cajas asociadas": el checkbox refleja AMBAS direcciones —
                  // llegada (recibeDeIds) O salida (alimentaIds) — y el desmarque limpia la
                  // que esté. Antes solo miraba recibeDeIds y la salida nunca se marcaba.
                  const isRecibe = (b.recibeDeIds || []).includes(selElement.id);
                  const isAlimenta = (b.alimentaIds || []).includes(selElement.id);
                  // LDesvio (LD_<upperId>, orig. usuario): su bajante asociado es el del
                  // `origenId` — se muestra CHECKEADO (solo lectura; el enlace se gestiona
                  // desde el menú del bajante).
                  const esLd = String(selElement.id || '').startsWith('LD_');
                  const esSuAsociado =
                    esLd &&
                    String((b as unknown as { origenId?: string }).origenId || '').split('|')[1] ===
                      String(selElement.id).slice(3);
                  const isAssoc = isRecibe || isAlimenta || esSuAsociado;
                  return (
                    <label key={b.id} style={CHECK_ROW_STYLE}>
                      <input
                        type="checkbox"
                        checked={isAssoc}
                        disabled={esSuAsociado && !isRecibe && !isAlimenta}
                        onChange={(e) => {
                          // Regla central (ítem 1.2): tope de asociaciones ANTES de escribir.
                          if (e.target.checked && !isAssoc) {
                            const check = puedeConectarRamalABajante(b, selElement);
                            if (!check.ok) {
                              if (check.title && check.msg)
                                engineRef.current?.triggerAlert(check.title, check.msg);
                              e.preventDefault();
                              return;
                            }
                          }
                          if (e.target.checked && !isAssoc && b.recibeDeIds.length === 1) {
                            const existing = (engineRef.current?.ramales || []).find(
                              (x) => x.id === b.recibeDeIds[0],
                            ) as unknown as { diametro?: string } | undefined;
                            const cur = selElement as unknown as { diametro?: string };
                            if (existing && existing.diametro && cur.diametro) {
                              const p1 = diamPulgFromLabel(existing.diametro);
                              const p2 = diamPulgFromLabel(cur.diametro);
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
                          const newRecibe = e.target.checked
                            ? b.recibeDeIds.includes(selElement.id)
                              ? b.recibeDeIds
                              : [...b.recibeDeIds, selElement.id]
                            : b.recibeDeIds.filter((id: string) => id !== selElement.id);
                          const newAlimenta = e.target.checked
                            ? b.alimentaIds || []
                            : (b.alimentaIds || []).filter((id: string) => id !== selElement.id);
                          engineRef.current?.updateElementById(b.id, {
                            recibeDeIds: newRecibe,
                            alimentaIds: newAlimenta,
                          });
                          if (!e.target.checked) {
                            // Desmarcar una salida también limpia el ini/fin del ramal si apunta
                            // al código del bajante (igual que "Cajas asociadas").
                            const code = b.code || b.id;
                            const ramalUpdates: Record<string, unknown> = {};
                            if ((selElement as unknown as { fin?: string }).fin === code)
                              ramalUpdates.fin = '';
                            if ((selElement as unknown as { ini?: string }).ini === code)
                              ramalUpdates.ini = '';
                            if (Object.keys(ramalUpdates).length)
                              engineRef.current?.updateElementById(selElement.id, ramalUpdates);
                            if (selElement) setSelElement({ ...selElement, ...ramalUpdates });
                          }
                          engineRef.current?.render();
                          engineRef.current?._markDirty();
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
      {selElement?.pts && ['san', 'll'].includes(activeNet) && (
        <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
          <div
            style={{
              fontSize: 12,
              color: '#9BA8AA',
              fontFamily: "'Geist',monospace",
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Cajas asociadas
          </div>
          <div style={CHECK_GRID_STYLE}>
            {(() => {
              const cajas = (engineRef.current?.bajantes || []).filter(
                (b) => b.net === activeNet && esCaja(b),
              );
              if (cajas.length === 0)
                return (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#8AB4D6',
                      fontFamily: "'Geist',monospace",
                      padding: '4px',
                      gridColumn: 'span 2',
                    }}
                  >
                    Sin cajas en esta red
                  </div>
                );
              return cajas.map((c) => {
                // Asociación lógica = la que crea finishRamal: llegada (recibeDeIds + fin del
                // ramal = código de la caja) O salida (alimentaIds + ini) — el checkbox refleja
                // AMBAS direcciones y el desmarque limpia la que esté.
                const isRecibe = (c.recibeDeIds || []).includes(selElement.id);
                const isAlimenta = (c.alimentaIds || []).includes(selElement.id);
                const isAssoc = isRecibe || isAlimenta;
                return (
                  <label key={c.id} style={CHECK_ROW_STYLE}>
                    <input
                      type="checkbox"
                      checked={isAssoc}
                      onChange={(e) => {
                        const code = c.code || c.id;
                        if (e.target.checked) {
                          // Regla central: la caja admite N entradas de ramales/tributarios —
                          // la guard valida red y dirección antes de escribir.
                          const check = puedeConectarRamalABajante(c, selElement, 'recibe');
                          if (!check.ok) {
                            if (check.title && check.msg)
                              engineRef.current?.triggerAlert(check.title, check.msg);
                            e.preventDefault();
                            return;
                          }
                          engineRef.current?.updateElementById(c.id, {
                            recibeDeIds: [...(c.recibeDeIds || []), selElement.id],
                          });
                          engineRef.current?.updateElementById(selElement.id, { fin: code });
                          if (selElement) setSelElement({ ...selElement, fin: code });
                        } else {
                          // Desmarcar = quitar la relación que tenga: llegada y/o salida.
                          engineRef.current?.updateElementById(c.id, {
                            recibeDeIds: (c.recibeDeIds || []).filter((id) => id !== selElement.id),
                            alimentaIds: (c.alimentaIds || []).filter((id) => id !== selElement.id),
                          });
                          const ramalUpdates: Record<string, unknown> = {};
                          if ((selElement as unknown as { fin?: string }).fin === code)
                            ramalUpdates.fin = '';
                          if ((selElement as unknown as { ini?: string }).ini === code)
                            ramalUpdates.ini = '';
                          if (Object.keys(ramalUpdates).length)
                            engineRef.current?.updateElementById(selElement.id, ramalUpdates);
                          if (selElement) setSelElement({ ...selElement, ...ramalUpdates });
                        }
                        engineRef.current?.render();
                        engineRef.current?._markDirty();
                      }}
                      style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {bajanteLabel(c, engineRef.current?.nivelActual?.label)}
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
