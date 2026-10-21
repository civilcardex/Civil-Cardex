import { useEffect, useState } from 'react';
import { normalizeDnLabel } from '../../../utils/formatUtils.ts';
import { matFullName, DIAM_BY_MAT, GAS_DN_LABELS } from '../../../constants';
import { GAS, CAT_GAS } from '../../../constants/engineeringDataGas.ts';
import {
  VENTILACION,
  CONTADORES as CONTADORES_CAT,
  NETS_WITH_MULTIPLE_MATERIALS,
} from '../../../pages/catalog/catalogData.ts';
import { DIAMETROS_AF } from '../../../constants/hydraulicsData.ts';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel.ts';
import {
  writeAcoDiamToDrawing,
  writeContadorDiamToDrawing,
} from '../../../utils/writeDiameterToDrawing.ts';
import {
  INODORO_APP_ID,
  sanDiamLabelAllowedForApparatus,
  SAN_INODORO_MIN_MSG,
} from '../../../utils/sanitaryDiamCompat.ts';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type {
  PlanoBajante,
  PlanoArea,
  PlanoElement,
  PlanoRamal,
} from '../../../lib/PlanoEngine/PlanoState.ts';
import type { PlanItem } from '../../../context/PlansContext.tsx';
import type { MaterialItem } from '../../../context/ProjectContext.tsx';
import {
  MENU_SELECT_STYLE,
  MENU_SECTION_LABEL_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  type ContextMenuState,
  type ProbedElement,
} from './context.ts';

/** Editor multi-tipo del menú contextual: material y diámetro de ramales, asociación de
 *  bajante en áreas, diámetro de contadores y capacidad de calentadores. */
export function ElementCodeEditor({
  element,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  mats,
  activeNet,
  setDiamSel,
  planosCtx,
}: {
  element: PlanoElement;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  mats: Record<string, MaterialItem[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  planosCtx: { plans: PlanItem[] };
}) {
  const probed = element as ProbedElement;
  const isArea = probed.id?.startsWith('AR');
  const hasPts = !!probed.pts;
  const tipo = probed.tipo;

  if (isArea) {
    const areaEl = element as PlanoArea;
    return (
      <>
        <div style={MENU_SECTION_LABEL_STYLE}>Asociar Bajante</div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={
              (engineRef.current?.bajantes || []).find((b) => b.area_m2 === areaEl.areaM2)?.id || ''
            }
            aria-label="Asociar Bajante"
            onChange={(e) => {
              const bajanteId = e.target.value;
              (engineRef.current?.bajantes || []).forEach((b) => {
                if (b.area_m2 === areaEl.areaM2) {
                  engineRef.current?.updateElementById(b.id, { area_m2: 0 });
                }
              });
              if (bajanteId) {
                engineRef.current?.updateElementById(bajanteId, { area_m2: areaEl.areaM2 });
              }
              engineRef.current?.render();
              setContextMenuState(null);
            }}
            style={MENU_SELECT_STYLE}
          >
            <option value="">— Sin bajante —</option>
            {(engineRef.current?.bajantes || [])
              .filter((b) => b.net === areaEl.net && b.tipo !== 'canal')
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code || b.id}
                </option>
              ))}
          </select>
        </div>
      </>
    );
  }

  if (hasPts) {
    const ramalEl = element as PlanoRamal;
    const isGas = ramalEl.net === 'gas';
    const isVen = ramalEl.net === 'vent';
    const matList = mats?.[ramalEl.net] || [];
    const matShort = ramalEl.material || matList[0]?.val || '—';
    let diamList: Array<{ n: string }> = [];
    if (isVen) {
      diamList = VENTILACION[0]?.rows.map((r) => ({ n: r.dn })) || [];
    } else if (isGas) {
      diamList = GAS[0]?.rows.map((r) => ({ n: r.dn })) || [];
    } else {
      diamList = DIAM_BY_MAT[matShort] || [];
    }

    return (
      <>
        {NETS_WITH_MULTIPLE_MATERIALS.has(ramalEl.net) && (
          <>
            <div style={MENU_SECTION_LABEL_STYLE}>Material de ramal</div>
            <div style={{ padding: '0 8px 8px' }}>
              <select
                value={ramalEl.material || ''}
                aria-label="Material de ramal"
                onChange={(e) => {
                  const val = e.target.value;
                  const eng = engineRef.current;
                  if (!eng) return;
                  eng.updateElementById(ramalEl.id, { material: val });
                  const fresh = eng.ramales.find((x) => x.id === ramalEl.id);
                  if (fresh) {
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...fresh } } : null,
                    );
                  }
                  // La lista de diámetros depende del material (DIAM_BY_MAT): si el diámetro
                  // actual ya no existe para el material nuevo, se resetea (junto con los
                  // diámetros de accesorio espejados) para que el ramal nunca conserve un
                  // diametro obsoleto.
                  const updates: Record<string, string> = { material: val };
                  if (!isVen && !isGas) {
                    const nd = DIAM_BY_MAT[val] || [];
                    const cur = ramalEl.diametro || '';
                    if (cur && !nd.some((d) => d.n === cur)) {
                      updates.diametro = '';
                      updates.diametroInicio = '';
                      updates.diametroFin = '';
                    }
                  }
                  if (Object.keys(updates).length > 1 || updates.material !== ramalEl.material) {
                    eng.updateElementById(ramalEl.id, updates);
                  }
                  if (selElement?.id === ramalEl.id) {
                    setSelElement({ ...selElement, ...updates });
                  }
                  if (activeNet === ramalEl.net) {
                    setDiamSel((prev) => ({ ...prev, [activeNet]: '' }));
                  }
                  eng.render();
                }}
                style={MENU_SELECT_STYLE}
              >
                <option value="">— Sin material —</option>
                {matList.map((m) => (
                  <option key={m.id} value={m.val}>
                    {matFullName(m.val)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '0 8px 8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...MENU_SECTION_LABEL_STYLE, padding: 0 }}>
              Diámetro de ramal/tributario
            </div>
            <select
              style={{ ...MENU_SELECT_STYLE, width: '100%' }}
              value={
                engineRef.current?.ramales.find((r) => r.id === ramalEl.id)?.diametro ??
                ramalEl.diametro ??
                ''
              }
              aria-label="Diámetro de ramal/tributario"
              onChange={(e) => {
                const val = e.target.value;
                if (engineRef.current) {
                  // Ítem 7/8: regla central inodoro → 4" mínimo, misma que TramoEditor (única fuente)
                  if (
                    ramalEl.net === 'san' &&
                    val &&
                    !sanDiamLabelAllowedForApparatus(val, INODORO_APP_ID)
                  ) {
                    const checkId = ramalEl.id;
                    const planId =
                      (engineRef.current as unknown as { _loadedPlanId?: string })?._loadedPlanId ??
                      '';
                    const key = `san_${checkId}_${planId || ''}`;
                    try {
                      const counts = JSON.parse(
                        localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '{}',
                      );
                      if ((counts[key]?.['san'] || 0) > 0) {
                        engineRef.current.triggerAlert(
                          'Diámetro no permitido',
                          SAN_INODORO_MIN_MSG,
                        );
                        return;
                      }
                    } catch (_e) {
                      void _e;
                    }
                  }
                  // Invariante única: ramal.diam >= accesorio.diam, impuesta aquí del lado del
                  // RAMAL (no en los selectores de accesorio, que dejan elegir cualquier
                  // diámetro libremente) — un ramal nunca puede reducirse por debajo del
                  // diámetro del accesorio que ya tiene conectado.
                  const inchFrom = (d: string) => {
                    const q = d.indexOf('"');
                    return q > 0 ? d.slice(0, q) : d;
                  };
                  // Leer datos frescos del engine — el snapshot ramalEl puede estar stale
                  // si el usuario cambió el diámetro desde TramoEditor mientras el menú estaba abierto.
                  const fresh = engineRef.current?.ramales.find((x) => x.id === ramalEl.id);
                  const liveAccDiamI =
                    (fresh?.diametroInicio as string) || ramalEl.diametroInicio || '';
                  const liveAccDiamF = (fresh?.diametroFin as string) || ramalEl.diametroFin || '';
                  const accDiamNum = Math.max(
                    liveAccDiamI ? diamPulgFromLabel(inchFrom(liveAccDiamI)) : 0,
                    liveAccDiamF ? diamPulgFromLabel(inchFrom(liveAccDiamF)) : 0,
                  );
                  if (val && accDiamNum > 0 && diamPulgFromLabel(inchFrom(val)) < accDiamNum) {
                    const accINum = liveAccDiamI ? diamPulgFromLabel(inchFrom(liveAccDiamI)) : 0;
                    const accFNum = liveAccDiamF ? diamPulgFromLabel(inchFrom(liveAccDiamF)) : 0;
                    const blockEnd = accINum >= accFNum ? 'INICIO' : 'FIN';
                    const blockDiam = accINum >= accFNum ? liveAccDiamI : liveAccDiamF;
                    engineRef.current.triggerAlert(
                      'Diámetro no permitido',
                      `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${blockEnd} (${blockDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
                    );
                    return;
                  }
                  // NO sobrescribir diametroInicio/Fin: el accesorio conserva su propio diámetro
                  // (la invariante permite accesorios más angostos que el ramal). Forzarlos al
                  // diámetro del ramal hacía que el siguiente cambio de diámetro alertara siempre:
                  // el accesorio quedaba con el valor anterior del ramal y bloqueaba cualquier
                  // reducción posterior, aunque el accesorio real fuera menor.
                  const updates = { diametro: val };
                  engineRef.current.updateElementById(ramalEl.id, updates);
                  setContextMenuState((prev) =>
                    prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
                  );
                  if (selElement?.id === ramalEl.id) {
                    setSelElement({ ...selElement, ...updates });
                  }
                  if (activeNet === ramalEl.net) {
                    setDiamSel((prev) => ({ ...prev, [activeNet]: val }));
                  }
                  // Ítems 5+6: la propagación aguas abajo (mergesFrom + receptores
                  // geométricos) la hace updateElementById vía recomputeDownstreamDiameters —
                  // un solo snapshot para toda la operación.
                  engineRef.current.render();
                }
              }}
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
          {/* Pendiente (orig. usuario): al lado del diámetro 50-50 — solo redes por gravedad. */}
          {['san', 'll', 'vent'].includes(ramalEl.net) && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...MENU_SECTION_LABEL_STYLE, padding: 0 }}>Pendiente %</div>
              <PendienteRamalInput
                ramalEl={ramalEl}
                engineRef={engineRef}
                selElement={selElement}
                setSelElement={setSelElement}
                setContextMenuState={setContextMenuState}
              />
            </div>
          )}
        </div>
      </>
    );
  }

  if (tipo === 'contador') {
    const bajEl = element as PlanoBajante;
    return (
      <>
        <div style={MENU_SECTION_LABEL_STYLE}>Contador: {bajEl.code || bajEl.id}</div>
        <div
          style={{
            fontSize: 12,
            color: '#849495',
            padding: '4px 8px 0',
            fontFamily: "'Geist',monospace",
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Diámetro del Contador
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={bajEl.dNominal ? bajEl.dNominal.replace(/"/g, '').trim() : ''}
            aria-label="Diámetro del Contador"
            onChange={(e) => {
              const val = e.target.value;
              const dNom = val ? `${val}"` : '';
              if (engineRef.current) {
                const fields = { dNominal: dNom };
                engineRef.current?.updateElementById(bajEl.id, fields);
                const fresh = engineRef.current?.bajantes.find((b) => b.id === bajEl.id);
                if (fresh) {
                  setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
                  if (selElement?.id === bajEl.id) {
                    setSelElement({ ...selElement, dNominal: fields.dNominal });
                  }
                }
                engineRef.current?.render();
                writeContadorDiamToDrawing(dNom, planosCtx.plans, bajEl.net || 'af');
              }
            }}
            style={MENU_SELECT_STYLE}
          >
            <option value="">— Sin diámetro —</option>
            {CONTADORES_CAT.map((c) => (
              <option key={c.dn} value={c.dn}>
                {normalizeDnLabel(c.dn)}"
              </option>
            ))}
          </select>
        </div>
        {(bajEl.net === 'af' || bajEl.net === 'gas') && (
          <div style={{ borderTop: '1px solid #3a494a', marginTop: 4 }}>
            <div
              style={{
                fontSize: 12,
                color: '#22D3EE',
                padding: '4px 8px',
                fontFamily: "'Geist',monospace",
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {bajEl.net === 'gas' ? 'Conexión (Red → Contador)' : 'AC-01 (Red Pública → Contador)'}
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <div style={MENU_SECTION_LABEL_ROW_STYLE}>Diámetro</div>
              <select
                value={bajEl.acoDiam || ''}
                aria-label="Diámetro"
                onChange={(e) => {
                  const val = e.target.value;
                  if (engineRef.current) {
                    engineRef.current?.updateElementById(bajEl.id, { acoDiam: val });
                    const fresh = engineRef.current?.bajantes.find((b) => b.id === bajEl.id);
                    if (fresh) {
                      setContextMenuState((prev) =>
                        prev ? { ...prev, element: { ...fresh } } : null,
                      );
                    }
                    engineRef.current?.render();
                    writeAcoDiamToDrawing(val, planosCtx.plans, bajEl.net || 'af');
                  }
                }}
                style={MENU_SELECT_STYLE}
              >
                <option value="">— Sin diámetro —</option>
                {(bajEl.net === 'gas' ? GAS_DN_LABELS : DIAMETROS_AF.map((d) => d.nominal)).map(
                  (d) => (
                    <option key={d} value={d}>
                      {normalizeDnLabel(d)}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
        )}
      </>
    );
  }

  if (tipo === 'calentador') {
    const bajEl = element as PlanoBajante;
    return (
      <>
        <div style={MENU_SECTION_LABEL_STYLE}>Calentador: {bajEl.code || bajEl.id}</div>
        <div style={MENU_SECTION_LABEL_STYLE}>Equipo (Capacidad)</div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={bajEl.capacidad || ''}
            aria-label="Equipo (Capacidad)"
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                const fields = { capacidad: val };
                engineRef.current?.updateElementById(bajEl.id, fields);
                const fresh = engineRef.current?.bajantes.find((b) => b.id === bajEl.id);
                if (fresh) {
                  setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
                  if (selElement?.id === bajEl.id) {
                    setSelElement({ ...selElement, capacidad: val });
                  }
                }
                engineRef.current?.render();
              }
            }}
            style={MENU_SELECT_STYLE}
          >
            <option value="">— Seleccionar —</option>
            {CAT_GAS.filter((g) => g.id.startsWith('cal')).map((g) => (
              <option key={g.id} value={g.id}>
                {g.n}
              </option>
            ))}
          </select>
        </div>
      </>
    );
  }

  return null;
}

/** Input de pendiente del ramal (san (Sanitaria)/ll (Lluvias)/vent (Ventilacion), orig. usuario): commit en blur/Enter, rango físico 0 < v ≤ 15
 * (mismo criterio del canal) — fuera de rango alerta y conserva. */
function PendienteRamalInput({
  ramalEl,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
}: {
  ramalEl: PlanoRamal;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
}) {
  const leePend = (): string => {
    const vivo = engineRef.current?.ramales.find((x) => x.id === ramalEl.id);
    const p = vivo?.pendiente ?? ramalEl.pendiente ?? 0;
    return p > 0 ? String(p) : '';
  };
  const [val, setVal] = useState<string>(leePend);
  // En vivo (orig. usuario): si el valor cambia desde otro lado (panel/tablas) con el menú
  // abierto, el input lo refleja — el elemento del menú se re-sincroniza por identidad.
  useEffect(() => {
    setVal(leePend);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ramalEl]);
  const commit = (): void => {
    const eng = engineRef.current;
    if (!eng) return;
    const t = val.trim().replace(',', '.');
    if (t === '') return;
    const v = parseFloat(t);
    if (!Number.isFinite(v) || v <= 0 || v > 15) {
      eng.triggerAlert(
        'Pendiente no permitida',
        'La pendiente debe ser mayor que 0% y hasta 15%. Se conserva el valor anterior.',
      );
      setVal(leePend());
      return;
    }
    const updates = { pendiente: v };
    eng.updateElementById(ramalEl.id, updates);
    // En vivo (orig. usuario): panel derecho y menú ven el cambio SIN re-seleccionar.
    setContextMenuState((prev) =>
      prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
    );
    if (selElement?.id === ramalEl.id) {
      setSelElement({ ...selElement, ...updates });
    }
    eng.render();
    eng._markDirty();
  };
  return (
    <input
      value={val}
      aria-label="Pendiente del ramal"
      inputMode="decimal"
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      style={{ ...MENU_SELECT_STYLE, textAlign: 'center', padding: '3px 4px' }}
      placeholder="—"
    />
  );
}
