/**
 * Menú contextual de un ramal: accesorios (codo, tee…), dirección de flujo, asociación a bajante/montante y canales asociados — el mismo estado que escribe el panel de aparatos (camposAsocManual).
 * Ej: marcar "asociar a BAN1" añade el ramal a recibeDeIds del bajante; desmarcar lo limpia.
 */
import { useState, useEffect } from 'react';
import { bajanteLabel, ramalLabel } from '../../../utils/accessoryAbbreviations.ts';
import { getAccessoryOptions } from '../../../utils/accessoryOptions.ts';
import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import {
  flipRamalFlow,
  ramalFlowDirectionCheck,
  aparatoEnExtremoInvalido,
} from '../../../lib/PlanoEngine/PlanoEngineDrawing.ts';
import { directNeighborRamales } from '../../../utils/flowDirection.ts';
import { puedeConectarRamalABajante, esCaja } from '../../../lib/PlanoEngine/bajanteRules.ts';
import {
  useDrawingElementContextMenu,
  MENU_GRID_2COL_TALL_STYLE,
  MENU_ACTION_BTN_STYLE,
  MENU_CHECK_ROW_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  MENU_SELECT_STYLE,
} from './context.ts';
import { moverAsociacionCanal } from '../../../lib/PlanoEngine/channelAssociation';
import { camposAsocManual } from '../../../lib/PlanoEngine/PlanoEngineSelectionEdit.ts';
import {
  ASSOC_CHECKBOX_STYLE,
  ASSOC_ROW_STYLE,
  CanalesAsociadosRamalSection,
  MontantesAsociadosSection,
  refrescarMenu,
} from './associatedChannels';
import { MidRamalAccessorySelector } from './midRamalAccessorySelector.tsx';
import { ramalHasInterconnections } from './ramalMenuHelpers.ts';
import { convertirARamal, convertirATributario, tribCandidatesDe } from './ramalMenuConvert.ts';
import { BajanteConnectionPanel } from './bajanteConnectionPanel.tsx';
import { ElementCodeEditor } from './elementEditor.tsx';
import { guardarMallas } from '../../../lib/PlanoEngine/nodos';

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
  // — es decir, accMedIdx = segmentIdx + 1, misma convención que usa handleCreateMontanteMidBody.
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

  // Ítem 8: candidatos a padre y conversiones — lógica en ramalMenuConvert.ts (testeable
  // sin menú montado). tribCandidatesDe acepta null (guard propio).
  const tribCandidates = tribCandidatesDe(engineRef.current, ramalEl);

  const convertToTributario = (padreId: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    convertirATributario(ctx, eng, ramalEl, padreId);
  };

  const convertToRamal = () => {
    const eng = engineRef.current;
    if (!eng) return;
    convertirARamal(ctx, eng, ramalEl, (t, m) => eng.triggerAlert(t, m));
  };
  return (
    <>
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
            style={MENU_ACTION_BTN_STYLE}
          >
            ⇄ Invertir dirección del flujo
          </button>
        )}
        {['af', 'ac', 'gas', 'rci'].includes(ramalEl.net || '') && (
          <button
            type="button"
            onClick={() => {
              const net = ramalEl.net || '';
              const mallas = engineRef.current?.mallasDeclaradas ?? new Set<string>();
              const ya = mallas.has(net);
              if (ya) mallas.delete(net);
              else mallas.add(net);
              if (engineRef.current) {
                engineRef.current.mallasDeclaradas = mallas;
                guardarMallas(engineRef.current._loadedPlanId, mallas);
              }
              engineRef.current?.triggerAlert(
                ya ? 'Malla retirada' : 'Malla declarada',
                ya
                  ? `La red ${net.toUpperCase()} vuelve a chequearse como red ramificada.`
                  : `La red ${net.toUpperCase()} quedó exenta del chequeo de ciclos (malla/recirculación intencional).`,
              );
              ctx.setContextMenuState(null);
            }}
            style={MENU_ACTION_BTN_STYLE}
          >
            {engineRef.current?.mallasDeclaradas?.has(ramalEl.net || '')
              ? '↺ Quitar declaración de malla'
              : '◉ Declarar malla / recirculación'}
          </button>
        )}
        {ramalHasInterconnections(engineRef.current, ramalEl) &&
          ['af', 'ac', 'gas'].includes(ramalEl.net) && (
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
      {ramalEl.tipo === 'tributario' && (
        <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
          <button type="button" onClick={convertToRamal} style={MENU_ACTION_BTN_STYLE}>
            Convertir tributario en ramal
          </button>
        </div>
      )}
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
            style={{ ...MENU_ACTION_BTN_STYLE, whiteSpace: 'normal', lineHeight: 1.3 }}
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
      {/* Segmento libre de la tee RETIRADO (orig. usuario 2026-10-29): sin stub de 300mm ni
          selector +Tapón/+Llave. La llave terminal en cuerpo va por el desplegable de accesorios
          (teeLlaveTerminal, glifo autocontenido en el mismo vértice). */}
      {/* Orig. usuario "primero botones": el panel de conexión (acciones) va con los demás
          botones; los desplegables (canal, aparatos/accesorios, etiqueta) quedan al final. */}
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
      {ramalEl.esCanalId && (
        <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
          <div style={MENU_SECTION_LABEL_ROW_STYLE}>Ramal de canal</div>
          <div style={{ fontSize: 11, color: 'var(--txt2)', fontFamily: 'var(--mono)' }}>
            Canal:{' '}
            {engineRef.current?.bajantes.find((c) => c.id === ramalEl.esCanalId)?.code ||
              ramalEl.esCanalId}
          </div>
          <select
            value={
              (engineRef.current?.bajantes || []).find((b) => b.recibeDeIds?.includes(ramalEl.id))
                ?.id || ''
            }
            aria-label="Bajante asociado"
            onChange={(e) => {
              const eng = engineRef.current;
              if (!eng) return;
              moverAsociacionCanal(eng, ramalEl.id, e.target.value || null);
              ctx.setContextMenuState((prev) => (prev ? { ...prev } : null));
              engineRef.current?.render();
            }}
            style={MENU_SELECT_STYLE}
          >
            <option value="">— Sin bajante —</option>
            {(engineRef.current?.bajantes || [])
              .filter((b) => b.net === 'll' && b.tipo === 'bajante')
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code || b.id}
                </option>
              ))}
          </select>
        </div>
      )}
      {/* Aparatos/accesorios del trazo — también al clicar un EXTREMO (orig. usuario): con
          extremo se sintetiza el hit en esa punta para que la preferencia de extremo del
          selector apunte ahí. */}
      {(() => {
        const hit =
          contextMenuState.midRamalHit ||
          (contextMenuState.ramalEndpoint
            ? {
                segmentIdx:
                  contextMenuState.ramalEndpoint.idx === 0
                    ? 0
                    : contextMenuState.ramalEndpoint.idx - 1,
                x: contextMenuState.ramalEndpoint.x,
                y: contextMenuState.ramalEndpoint.y,
              }
            : null);
        if (!hit) return null;
        if (!['san', 'll'].includes(ramalEl.net) && getAccessoryOptions(ramalEl.net).length > 0) {
          return (
            <MidRamalAccessorySelector
              element={ramalEl}
              midRamalHit={hit}
              engineRef={ctx.engineRef}
              selElement={ctx.selElement}
              setSelElement={ctx.setSelElement}
              setContextMenuState={ctx.setContextMenuState}
              planosCtx={ctx.planosCtx}
            />
          );
        }
        if (ramalEl.net === 'san') {
          return (
            <MidRamalAccessorySelector
              element={ramalEl}
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
      })()}
      <ElementCodeEditor
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
      <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
        <div style={MENU_SECTION_LABEL_ROW_STYLE}>Modificar etiqueta</div>
        <div
          style={{
            fontSize: 11,
            color: '#6b7280',
            fontFamily: "'Geist',monospace",
            marginBottom: 6,
            lineHeight: 1.3,
          }}
        >
          Elige qué información mostrar en la etiqueta del tramo
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '4px 8px',
          }}
        >
          {[
            {
              key: 'showFlowDir' as const,
              label: 'Dirección de flujo',
              checked: (ramalEl as unknown as Record<string, unknown>).showFlowDir !== false,
            },
            {
              key: 'showMatDiamPend' as const,
              label: 'Material, diámetro y pendiente',
              checked: (ramalEl as unknown as Record<string, unknown>).showMatDiamPend !== false,
            },
            {
              key: 'showLength' as const,
              label: 'Longitud',
              checked: ramalEl.showLength !== false,
            },
            { key: 'showName' as const, label: 'Nombre', checked: ramalEl.showName !== false },
            { key: 'showGuide' as const, label: 'Guía', checked: ramalEl.showGuide !== false },
          ].map(({ key, label, checked }) => (
            <label
              key={key}
              style={{
                ...MENU_CHECK_ROW_STYLE,
                padding: '4px 6px',
                background: '#1e2024',
                border: 'none',
                borderRadius: 3,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const val = e.target.checked;
                  if (engineRef.current) {
                    engineRef.current.updateElementById(ramalEl.id, { [key]: val });
                    if (selElement?.id === ramalEl.id) {
                      setSelElement({ ...selElement, [key]: val } as unknown as PlanoRamal);
                    }
                    engineRef.current.render();
                    engineRef.current._markDirty();
                  }
                }}
                style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
              />
              <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {label}
              </span>
            </label>
          ))}
        </div>
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
                (b) =>
                  b.net === ramalEl.net &&
                  b.id !== ramalEl.id &&
                  b.tipo !== 'tributario' &&
                  // Los canales no se asocian a ramales (orig. usuario): la conexión vive en
                  // los ramales de canal — y las cajas tienen su sección "Cajas asociadas".
                  b.tipo !== 'canal' &&
                  !esCaja(b),
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
                // Igual que "Cajas asociadas": el checkbox refleja AMBAS direcciones —
                // llegada (recibeDeIds) O salida (alimentaIds) — y el desmarque limpia la
                // que esté. Antes solo miraba recibeDeIds y la salida nunca se marcaba.
                const isRecibe = (b.recibeDeIds || []).includes(currentId);
                const isAlimenta = (b.alimentaIds || []).includes(currentId);
                const isAssociated = isRecibe || isAlimenta;
                return (
                  <label key={b.id} style={ASSOC_ROW_STYLE}>
                    <input
                      type="checkbox"
                      checked={isAssociated}
                      onChange={(e) => {
                        // Regla central (ítem 1.2): tope de asociaciones validado ANTES de escribir.
                        if (e.target.checked) {
                          const check = puedeConectarRamalABajante(b, ramalEl);
                          if (!check.ok) {
                            if (check.title && check.msg)
                              engineRef.current?.triggerAlert(check.title, check.msg);
                            e.preventDefault();
                            return;
                          }
                        }
                        const extraFields: Record<string, unknown> = camposAsocManual(
                          b,
                          currentId,
                          e.target.checked,
                        );
                        if (e.target.checked) {
                          extraFields.descargaEnId = currentId;
                        } else if (
                          b.descargaEnId === currentId ||
                          b.descargaEnId?.endsWith('|' + currentId)
                        ) {
                          extraFields.descargaEnId = null;
                        }
                        engineRef.current?.updateElementById(b.id, extraFields);
                        if (!e.target.checked) {
                          // Desmarcar una salida también limpia el ini/fin del ramal si apunta
                          // al código del bajante (igual que "Cajas asociadas").
                          const code = b.code || b.id;
                          const ramalUpdates: Record<string, unknown> = {};
                          if (ramalEl.fin === code) ramalUpdates.fin = '';
                          if ((ramalEl as unknown as { ini?: string }).ini === code)
                            ramalUpdates.ini = '';
                          if (Object.keys(ramalUpdates).length)
                            engineRef.current?.updateElementById(ramalEl.id, ramalUpdates);
                          if (selElement?.id === ramalEl.id) {
                            setSelElement({ ...selElement, ...ramalUpdates });
                          }
                        } else if (selElement?.id === b.id) {
                          setSelElement({ ...selElement, ...extraFields });
                        }
                        refrescarMenu(ctx.setContextMenuState);
                      }}
                      style={ASSOC_CHECKBOX_STYLE}
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
          <div style={MENU_SECTION_LABEL_ROW_STYLE}>Cajas asociadas</div>
          <div style={MENU_GRID_2COL_TALL_STYLE}>
            {(() => {
              const currentId = ramalEl.id;
              const cajas = (engineRef.current?.bajantes || []).filter(
                (b) => b.net === ramalEl.net && esCaja(b),
              );
              if (cajas.length === 0)
                return (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b8cae',
                      fontFamily: "'Geist',monospace",
                      gridColumn: 'span 4',
                    }}
                  >
                    Sin cajas
                  </div>
                );
              return cajas.map((c) => {
                // Asociación lógica = la que crea finishRamal: llegada (recibeDeIds + fin del
                // ramal = código de la caja) O salida (alimentaIds + ini del ramal) — el
                // checkbox refleja AMBAS y el desmarque limpia la que esté.
                const isRecibe = (c.recibeDeIds || []).includes(currentId);
                const isAlimenta = (c.alimentaIds || []).includes(currentId);
                const isAssociated = isRecibe || isAlimenta;
                return (
                  <label key={c.id} style={ASSOC_ROW_STYLE}>
                    <input
                      type="checkbox"
                      checked={isAssociated}
                      onChange={(e) => {
                        // Regla central: la caja admite N entradas de ramales/tributarios —
                        // la guard valida red y dirección antes de escribir.
                        if (e.target.checked) {
                          const check = puedeConectarRamalABajante(c, ramalEl, 'recibe');
                          if (!check.ok) {
                            if (check.title && check.msg)
                              engineRef.current?.triggerAlert(check.title, check.msg);
                            e.preventDefault();
                            return;
                          }
                        }
                        const code = c.code || c.id;
                        if (e.target.checked) {
                          // Marcar = asociar como LLEGADA (nueva asociación, manual: la poda
                          // de stale no la toca).
                          const updates: Record<string, unknown> = {
                            ...camposAsocManual(c, currentId, true),
                          };
                          engineRef.current?.updateElementById(c.id, updates);
                          engineRef.current?.updateElementById(ramalEl.id, { fin: code });
                          if (selElement?.id === ramalEl.id) {
                            setSelElement({ ...selElement, fin: code } as unknown as PlanoRamal);
                          }
                        } else {
                          // Desmarcar = quitar la relación que tenga: llegada y/o salida.
                          const updates: Record<string, unknown> = camposAsocManual(
                            c,
                            currentId,
                            false,
                          );
                          engineRef.current?.updateElementById(c.id, updates);
                          const ramalUpdates: Record<string, unknown> = {};
                          if (ramalEl.fin === code) ramalUpdates.fin = '';
                          if ((ramalEl as unknown as { ini?: string }).ini === code)
                            ramalUpdates.ini = '';
                          if (Object.keys(ramalUpdates).length)
                            engineRef.current?.updateElementById(ramalEl.id, ramalUpdates);
                          if (selElement?.id === ramalEl.id) {
                            setSelElement({
                              ...selElement,
                              ...ramalUpdates,
                            } as unknown as PlanoRamal);
                          }
                        }
                        engineRef.current?.render();
                        engineRef.current?._markDirty();
                        refrescarMenu(ctx.setContextMenuState);
                      }}
                      style={ASSOC_CHECKBOX_STYLE}
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
      {ctx.activeNet === 'll' && <CanalesAsociadosRamalSection ctx={ctx} ramal={ramalEl} />}
      {/* gas incluido: la herencia entre pisos de montantes lo trata como presión (af/ac/gas). */}
      {(ctx.activeNet === 'af' || ctx.activeNet === 'ac' || ctx.activeNet === 'gas') && (
        <MontantesAsociadosSection ctx={ctx} ramal={ramalEl} />
      )}
    </>
  );
}
