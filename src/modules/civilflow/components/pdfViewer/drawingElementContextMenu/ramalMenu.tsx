import { useState, useEffect } from 'react';
import { bajanteLabel, ramalLabel } from '../../../utils/accessoryAbbreviations';
import { getAccessoryOptions } from '../../../utils/accessoryOptions';
import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import {
  flipRamalFlow,
  ramalFlowDirectionCheck,
  aparatoEnExtremoInvalido,
} from '../../../lib/PlanoEngine/PlanoEngineDrawing';
import { directNeighborRamales } from '../../../utils/flowDirection';
import { allocTributaryNumber, rootTributarioLabel } from '../../../lib/PlanoEngine/PlanoState';
import {
  useDrawingElementContextMenu,
  MENU_GRID_2COL_TALL_STYLE,
  MENU_ACTION_BTN_STYLE,
  MENU_CHECK_ROW_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
} from './context';
import { MidRamalAccessorySelector } from './midRamalAccessorySelector';
import { pointOnRamalBody, ramalHasInterconnections } from './ramalMenuHelpers';
import { BajanteConnectionPanel } from './bajanteConnectionPanel';
import { ElementCodeEditor } from './elementEditor';

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

  const convertToRamal = () => {
    const eng = ctx.engineRef.current;
    if (!eng) return;
    const fresh = eng.ramales.find((r) => r.id === ramalEl.id);
    if (!fresh) return;
    // El flip de la flecha del renderer depende de `tipo`: san/ll/vent solo aplican
    // _tribReversed a TRIBUTARIOS; al pasar a ramal el flip vuelve a 1 y la flecha se
    // invertiría si el tributario traía _tribReversed. Revertir pts + limpiar el flag
    // deja la flecha apuntando igual que antes de la conversión.
    const net = fresh.net;
    if ((net === 'san' || net === 'll' || net === 'vent') && fresh._tribReversed) {
      fresh.pts = [...fresh.pts].reverse();
      fresh._tribReversed = undefined;
    }
    const pfx = (eng as unknown as { _netCounts?: Record<string, { ramal: number }> })
      ? net === 'san'
        ? 'RS'
        : net === 'll'
          ? 'RALL'
          : net === 'af'
            ? 'RAF'
            : net === 'ac'
              ? 'RAC'
              : 'R'
      : 'R';
    // fallback label via allocNetNumber-like: find next free
    const existingLabels = new Set(eng.ramales.map((r) => r.label));
    let n = 1;
    while (existingLabels.has(`${pfx}${n}`)) n++;
    const updates: Record<string, unknown> = {
      tipo: 'ramal',
      padre: null,
      label: `${pfx}${n}`,
      pts: fresh.pts,
      _tribReversed: fresh._tribReversed,
    };
    eng.updateElementById(fresh.id, updates);
    if (ctx.selElement?.id === fresh.id) ctx.setSelElement({ ...ctx.selElement, ...updates });
    eng.render();
    eng._markDirty();
    ctx.setContextMenuState(null);
  };
  return (
    <>
      {ramalEl.tipo === 'tributario' && (
        <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
          <button
            type="button"
            onClick={convertToRamal}
            style={{ ...MENU_ACTION_BTN_STYLE, textAlign: 'left' }}
          >
            Convertir tributario en ramal
          </button>
        </div>
      )}
      <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
        <button
          type="button"
          onClick={() => {
            const eng = ctx.engineRef.current;
            if (!eng) return;
            eng.deleteSelected([ramalEl.id], { noMerge: true });
            ctx.setContextMenuState(null);
          }}
          style={{ ...MENU_ACTION_BTN_STYLE, color: '#ffb4ab' }}
        >
          Borrar trazo
        </button>
      </div>
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
