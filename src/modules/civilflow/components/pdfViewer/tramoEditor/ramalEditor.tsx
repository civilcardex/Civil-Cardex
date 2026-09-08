import { DIAM_BY_MAT } from '../../../constants';
import { VENTILACION, NETS_WITH_MULTIPLE_MATERIALS } from '../../../pages/catalog/catalogData';
import { GAS } from '../../../constants/engineeringDataGas';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import {
  INODORO_APP_ID,
  sanDiamLabelAllowedForApparatus,
  SAN_INODORO_MIN_MSG,
} from '../../../utils/sanitaryDiamCompat';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import {
  INPUT_CENTER_STYLE,
  READONLY_CENTER_STYLE,
  SELECT_CENTER_STYLE,
  MAT_ROW_STYLE,
  MAT_NAME_STYLE,
  ramalHasCodoReventilado,
} from './context';
import { CaudalField } from './caudalField';

/** Editor del ramal seleccionado: material, diámetro, pendiente, desnivel vertical y número
 *  de descargas en simultáneo. */
export function RamalEditor({
  selElement,
  activeNet,
  engineRef,
  setSelElement,
  isSelActiveNet,
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
}: {
  selElement: PlanoRamal | null;
  activeNet: string;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>;
  isSelActiveNet: boolean | null;
  diamSel: Record<string, string>;
  gasMatSel: Record<string, string>;
  pendSel: Record<string, number>;
  pendInput: string;
  mats: Record<string, Array<{ val: string }>> | null;
  matLongName: (short: string) => string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setPendInput: React.Dispatch<React.SetStateAction<string>>;
}) {
  const isGas = activeNet === 'gas';
  const isVen = activeNet === 'vent';
  // El ramal seleccionado puede pertenecer legítimamente a una red distinta de la activa en la barra
  // (p. ej. sigue seleccionado tras cambiar de pestaña de red) — su material debe tomarse siempre
  // del catálogo de SU propia red, no de la red que la barra esté mostrando en ese momento.
  const matNet = selElement?.net || activeNet;
  const matList = mats?.[matNet] || [];
  const matShort = matList[0]?.val || '—';
  const matName = matLongName(matShort);
  let diamList: Array<{ n: string }> = [];
  if (isVen) {
    diamList = VENTILACION[0]?.rows.map((r) => ({ n: r.dn })) || [];
  } else {
    diamList = DIAM_BY_MAT[matShort] || [];
  }
  let currentDiam: string = '',
    currentMat: string = '';
  if (isGas) {
    // Gas tiene varias opciones reales de material — no debe asumir silenciosamente GAS[0]; el usuario
    // elige explícitamente, igual que en cualquier otra red con varios materiales.
    currentMat = (isSelActiveNet && selElement?.material) || gasMatSel[activeNet] || '';
    currentDiam =
      isSelActiveNet && selElement ? selElement.diametro || '' : diamSel[activeNet] || '';
  } else {
    // Un ramal seleccionado SIN diámetro debe mostrar "Sin diámetro", no el default de la
    // red (diamSel) — asignar el diámetro a un ramal hacía que el SIGUIENTE ramal sin
    // diámetro que se seleccionaba apareciera con el mismo valor (default de la red).
    currentDiam =
      isSelActiveNet && selElement ? selElement.diametro || '' : diamSel[activeNet] || '';
  }
  const showPend = activeNet === 'san' || activeNet === 'll';
  const showDeltaZ = activeNet === 'af' || activeNet === 'ac' || activeNet === 'gas';
  const showDescargas = activeNet === 'af' || activeNet === 'ac' || activeNet === 'san';
  const showCaudal = activeNet === 'll';

  // Ítems 5+6: la propagación aguas abajo la hacen updateSelected/updateElementById vía
  // recomputeDownstreamDiameters — un solo snapshot por cambio, sin llamadas extra aquí.
  return (
    <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
      <div
        style={{
          fontFamily: "'Geist',monospace",
          fontSize: 12,
          color: '#9BA8AA',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Datos específicos
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isGas ? (
          <div>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Material
            </div>
            <select
              value={currentMat}
              aria-label="Material"
              onChange={(e) => {
                const mat = e.target.value;
                const g = GAS.find((x) => x.mat === mat);
                const dn = g ? g.rows[0]?.dn || '' : '';
                setGasMatSel((prev) => ({ ...prev, [activeNet]: mat }));
                setDiamSel((prev) => ({ ...prev, [activeNet]: dn }));
                if (engineRef.current && selElement) {
                  engineRef.current.updateSelected({ material: mat, diametro: dn });
                  setSelElement({ ...selElement, material: mat, diametro: dn });
                }
              }}
              style={SELECT_CENTER_STYLE}
            >
              <option value="">— Sin material —</option>
              {GAS.map((g) => (
                <option key={g.mat} value={g.mat}>
                  {g.mat}
                </option>
              ))}
            </select>
          </div>
        ) : NETS_WITH_MULTIPLE_MATERIALS.has(matNet) ? (
          <div>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Material
            </div>
            <select
              value={(isSelActiveNet && selElement?.material) || matShort}
              aria-label="Material"
              onChange={(e) => {
                const mat = e.target.value;
                if (!engineRef.current || !selElement) return;
                const updates: Record<string, unknown> = { material: mat };
                const nd = DIAM_BY_MAT[mat] || [];
                const curD = selElement.diametro || '';
                if (curD && !nd.some((d) => d.n === curD)) {
                  updates.diametro = '';
                  updates.diametroInicio = '';
                  updates.diametroFin = '';
                }
                engineRef.current.updateSelected(updates);
                setSelElement({ ...selElement, ...updates });
                setDiamSel((prev) => ({ ...prev, [activeNet]: '' }));
              }}
              style={SELECT_CENTER_STYLE}
            >
              {matList.map((m) => (
                <option key={m.val} value={m.val}>
                  {matLongName(m.val)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div style={MAT_ROW_STYLE}>
            <span
              style={{
                fontSize: 12,
                color: '#8AB4D6',
                fontFamily: "'Geist',monospace",
                textTransform: 'uppercase',
                letterSpacing: 1,
                flexShrink: 0,
              }}
            >
              Material
            </span>
            <span style={MAT_NAME_STYLE} title={matName}>
              {matName}
            </span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: showPend ? '1fr 1fr' : '1fr', gap: 6 }}>
          <div>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Diámetro
            </div>
            {isGas ? (
              <select
                value={currentDiam}
                aria-label="Diámetro"
                onChange={(e) => {
                  const dn = e.target.value;
                  // Invariante: ramal.diam >= accesorio.diam, igual que en el menú contextual.
                  const inchFrom = (d: string) => {
                    const q = d.indexOf('"');
                    return q > 0 ? d.slice(0, q) : d;
                  };
                  // Leer datos frescos del engine — el snapshot selElement puede estar stale
                  // si el usuario cambió el diámetro desde otro componente.
                  const fresh = engineRef.current
                    ? selElement
                      ? engineRef.current.ramales.find((r) => r.id === selElement.id)
                      : [...engineRef.current.ramales]
                          .reverse()
                          .find((r) => r.net === activeNet && !r.mergesFrom)
                    : null;
                  const aI = (fresh?.diametroInicio as string) || '';
                  const aF = (fresh?.diametroFin as string) || '';
                  const aNum = Math.max(
                    aI ? diamPulgFromLabel(inchFrom(aI)) : 0,
                    aF ? diamPulgFromLabel(inchFrom(aF)) : 0,
                  );
                  if (dn && aNum > 0 && diamPulgFromLabel(inchFrom(dn)) < aNum) {
                    const aINum = aI ? diamPulgFromLabel(inchFrom(aI)) : 0;
                    const aFNum = aF ? diamPulgFromLabel(inchFrom(aF)) : 0;
                    const blockEnd = aINum >= aFNum ? 'INICIO' : 'FIN';
                    const blockDiam = aINum >= aFNum ? aI : aF;
                    engineRef.current?.triggerAlert(
                      'Diámetro no permitido',
                      `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${blockEnd} (${blockDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
                    );
                    return;
                  }
                  setDiamSel((prev) => ({ ...prev, [activeNet]: dn }));
                  // NO sobrescribir diametroInicio/Fin: el accesorio tiene su propio selector de
                  // diámetro (ExtremeAccessoryEditor) y la invariante ramal >= accesorio permite
                  // accesorios más angostos que el ramal. Forzarlos al diámetro del ramal hacía
                  // que el segundo cambio de diámetro alertara siempre: el accesorio quedaba con
                  // el valor anterior del ramal y bloqueaba cualquier reducción posterior.
                  if (engineRef.current && selElement) {
                    engineRef.current.updateSelected({ diametro: dn });
                    setSelElement({ ...selElement, diametro: dn });
                  } else if (engineRef.current && !selElement) {
                    const eng = engineRef.current;
                    const lastRamal = [...eng.ramales]
                      .reverse()
                      .find((r) => r.net === activeNet && !r.mergesFrom);
                    if (lastRamal) {
                      eng.selId = lastRamal.id;
                      eng.updateSelected({ diametro: dn });
                      const { _labelBox, ...rest } = lastRamal;
                      setSelElement({ ...rest, diametro: dn });
                    }
                  }
                }}
                style={SELECT_CENTER_STYLE}
              >
                {(() => {
                  const gasMat = GAS.find((g) => g.mat === currentMat);
                  return gasMat ? (
                    gasMat.rows.map((r) => (
                      <option key={r.dn} value={r.dn}>
                        {normalizeDnLabel(r.dn)}
                      </option>
                    ))
                  ) : (
                    <option value="">—</option>
                  );
                })()}
              </select>
            ) : diamList.length > 0 ? (
              <select
                value={currentDiam}
                aria-label="Diámetro"
                onChange={(e) => {
                  const v = e.target.value;
                  const targetRamal =
                    selElement ||
                    (engineRef.current &&
                      [...engineRef.current.ramales]
                        .reverse()
                        .find((r) => r.net === activeNet && !r.mergesFrom));
                  // Ítem 6/7/8: regla central (inodoro → 4" mínimo)
                  if (
                    activeNet === 'san' &&
                    diamPulgFromLabel(v) > 0 &&
                    !sanDiamLabelAllowedForApparatus(v, INODORO_APP_ID)
                  ) {
                    const checkId =
                      targetRamal?.id || (selElement as unknown as { id?: string })?.id;
                    if (checkId) {
                      const planId =
                        (engineRef.current as unknown as { _loadedPlanId?: string })
                          ?._loadedPlanId ?? '';
                      const key = `san_${checkId}_${planId || ''}`;
                      try {
                        const counts = JSON.parse(
                          localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '{}',
                        );
                        if ((counts[key]?.['san'] || 0) > 0) {
                          engineRef.current?.triggerAlert(
                            'Diámetro no permitido',
                            SAN_INODORO_MIN_MSG,
                          );
                          return;
                        }
                      } catch (_e) {
                        void _e;
                      }
                    }
                  }
                  if (
                    activeNet === 'san' &&
                    (diamPulgFromLabel(v) < 3 || diamPulgFromLabel(v) > 4) &&
                    targetRamal?.tipo === 'ramal' &&
                    ramalHasCodoReventilado(targetRamal)
                  ) {
                    engineRef.current?.triggerAlert(
                      'Diámetro no permitido',
                      'La tubería principal sanitaria con codo reventilado solo admite diámetro de 3" o 4".',
                    );
                    return;
                  }
                  // Invariante: ramal.diam >= accesorio.diam, igual que en el menú contextual.
                  {
                    const inchFrom = (d: string) => {
                      const q = d.indexOf('"');
                      return q > 0 ? d.slice(0, q) : d;
                    };
                    // Leer datos frescos del engine — el snapshot selElement puede estar stale.
                    const fresh = engineRef.current
                      ? selElement
                        ? engineRef.current.ramales.find((r) => r.id === selElement.id)
                        : [...engineRef.current.ramales]
                            .reverse()
                            .find((r) => r.net === activeNet && !r.mergesFrom)
                      : null;
                    const aI = (fresh?.diametroInicio as string) || '';
                    const aF = (fresh?.diametroFin as string) || '';
                    const aNum = Math.max(
                      aI ? diamPulgFromLabel(inchFrom(aI)) : 0,
                      aF ? diamPulgFromLabel(inchFrom(aF)) : 0,
                    );
                    if (v && aNum > 0 && diamPulgFromLabel(inchFrom(v)) < aNum) {
                      const aINum = aI ? diamPulgFromLabel(inchFrom(aI)) : 0;
                      const aFNum = aF ? diamPulgFromLabel(inchFrom(aF)) : 0;
                      const blockEnd = aINum >= aFNum ? 'INICIO' : 'FIN';
                      const blockDiam = aINum >= aFNum ? aI : aF;
                      engineRef.current?.triggerAlert(
                        'Diámetro no permitido',
                        `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${blockEnd} (${blockDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
                      );
                      return;
                    }
                  }
                  setDiamSel((prev) => ({ ...prev, [activeNet]: v }));
                  // NO sobrescribir diametroInicio/Fin — ver comentario en la rama GAS.
                  if (engineRef.current && selElement) {
                    engineRef.current.updateSelected({ diametro: v });
                    setSelElement({ ...selElement, diametro: v });
                  } else if (engineRef.current && !selElement) {
                    const eng = engineRef.current;
                    const lastRamal = [...eng.ramales]
                      .reverse()
                      .find((r) => r.net === activeNet && !r.mergesFrom);
                    if (lastRamal) {
                      eng.selId = lastRamal.id;
                      eng.updateSelected({ diametro: v });
                      const { _labelBox, ...rest } = lastRamal;
                      setSelElement({ ...rest, diametro: v });
                    }
                  }
                }}
                style={SELECT_CENTER_STYLE}
              >
                <option value="">Sin diámetro</option>
                {diamList.map((d) => {
                  return (
                    <option key={d.n} value={d.n}>
                      {normalizeDnLabel(d.n)}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div
                style={{
                  padding: '4px 6px',
                  background: '#1e2024',
                  border: '1px solid #3a494a',
                  borderRadius: 3,
                  color: '#8AB4D6',
                  fontSize: 12,
                  fontFamily: "'Geist',monospace",
                }}
              >
                — Sin opciones —
              </div>
            )}
          </div>
          {showPend ? (
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: '#9BA8AA',
                  fontFamily: "'Geist',monospace",
                  marginBottom: 2,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                Pendiente %
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={pendInput}
                aria-label="Pendiente (%)"
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                  setPendInput(raw);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value.replace(/,/g, '.')) || 0;
                  setPendInput(v > 0 ? String(v) : '');
                  setPendSel((prev) => ({ ...prev, [activeNet]: v }));
                  if (engineRef.current && selElement) {
                    engineRef.current.updateSelected({ pendiente: v });
                    setSelElement({ ...selElement, pendiente: v });
                  } else if (engineRef.current && !selElement) {
                    const eng = engineRef.current;
                    const lastRamal = [...eng.ramales]
                      .reverse()
                      .find((r) => r.net === activeNet && !r.mergesFrom);
                    if (lastRamal) {
                      eng.selId = lastRamal.id;
                      eng.updateSelected({ pendiente: v });
                      const { _labelBox, ...rest } = lastRamal;
                      setSelElement({ ...rest, pendiente: v });
                    }
                  }
                }}
                onFocus={() => {
                  const current =
                    isSelActiveNet && selElement?.pendiente !== undefined
                      ? selElement.pendiente
                      : pendSel[activeNet] !== undefined
                        ? pendSel[activeNet]
                        : 2.0;
                  setPendInput(current > 0 ? String(current) : '');
                }}
                style={INPUT_CENTER_STYLE}
              />
            </div>
          ) : null}
        </div>
        {showCaudal && <CaudalField selElement={selElement} />}
        {(showDeltaZ || showDescargas) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showDeltaZ || showDescargas ? '1fr 1fr' : '1fr',
              gap: 6,
            }}
          >
            {showDeltaZ && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#9BA8AA',
                    fontFamily: "'Geist',monospace",
                    marginBottom: 2,
                    textTransform: 'uppercase',
                    letterSpacing: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Altura (m)
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={selElement?.dz ?? ''}
                  placeholder="0.00"
                  aria-label="Delta Z o longitud vertical (m)"
                  onChange={(e) => {
                    if (engineRef.current) {
                      const v = e.target.value;
                      engineRef.current.updateSelected({ dz: v, lvert: v });
                      setSelElement({ ...selElement, dz: v, lvert: v } as PlanoRamal);
                    }
                  }}
                  style={READONLY_CENTER_STYLE}
                />
              </div>
            )}
            {showDescargas && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#9BA8AA',
                    fontFamily: "'Geist',monospace",
                    marginBottom: 2,
                    textTransform: 'uppercase',
                    letterSpacing: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Descargas
                </div>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={selElement?.nSalidas ?? 1}
                  placeholder="1"
                  aria-label="Número de descargas en simultáneo"
                  onChange={(e) => {
                    if (engineRef.current) {
                      const v = parseInt(e.target.value) || 1;
                      engineRef.current.updateSelected({ nSalidas: v });
                      setSelElement({ ...selElement, nSalidas: v } as PlanoRamal);
                    }
                  }}
                  style={READONLY_CENTER_STYLE}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
