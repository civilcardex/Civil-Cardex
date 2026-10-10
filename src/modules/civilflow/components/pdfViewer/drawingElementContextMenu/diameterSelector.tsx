// BajanteDiameterSelector: diámetros disponibles/sugeridos, UPS, base de NPT y wizard de
// bomba. Extraído verbatim de bajanteMenu (des-monolitización 2026-10-06).
import { useState, useEffect } from 'react';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import {
  pisoLbl,
  pisoCorto,
  buildBajanteVisualLabel,
  DIAM_BAN,
  DIAM_BAN_LL,
  DIAM_BAN_SAN,
  DIAM_VENT,
} from '../../../constants';
import { loadFromStorage } from '../../../services/storageService';
import { TRAZOS_PREFIX } from '../../../constants/storage-keys';
import { writeBajantePropToDrawing } from '../../../utils/writeDiameterToDrawing';
import {
  applyBajanteAssociation,
  clearBajanteAssociation,
  areEndpointsAligned,
  type AssocEndpoint,
} from '../../../utils/bajanteAssociation';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import { validarDiametroEntrePisos } from '../../../utils/drawingWrites/diametros';
import { avisarDiametroInvalido } from '../../../utils/diametroValidation';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoBajante, PlanoElement } from '../../../lib/PlanoEngine/PlanoState';
import type { PlanItem } from '../../../context/PlansContext';
import {
  MENU_SELECT_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  type ContextMenuState,
  type LowerFloorRamales,
} from './context';

/** Selectores del bajante: destino (piso inferior), diámetro con validación contra los ramales
 *  conectados, origen (piso superior), llenado (R) y área servida. */
export function BajanteDiameterSelector({
  element,
  isGhostClick = false,
  selectedNivel,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  lowerFloorsRamales,
  upperFloorGroup,
  planosCtx,
  triggerConfirm,
}: {
  element: PlanoBajante;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  lowerFloorsRamales: LowerFloorRamales[];
  upperFloorGroup: LowerFloorRamales | null;
  planosCtx: { plans: PlanItem[] };
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => void;
}) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';

  // Sincronización en tiempo real del desplegable "Origen (piso superior)": `upperFloorGroup`
  // es estado de PdfViewer que solo vuelve a leer su piso objetivo cuando cambia la SELECCIÓN —
  // una asociación creada o eliminada aquí (o desde el panel BajanteAsociacion, o desde el menú
  // "Destino" del otro piso) nunca toca esas dependencias, así que la lista de opciones quedaría
  // desactualizada. Se vuelve a leer el storage del piso superior cada vez que cambian el
  // elemento de este menú o sus punteros entre pisos (writeBajantePropToDrawing persiste en
  // TRAZOS_PREFIX + planId, por lo que la relectura ve los datos recién guardados).
  const [freshUpperBajantes, setFreshUpperBajantes] = useState<PlanoBajante[] | null>(null);
  useEffect(() => {
    if (!upperFloorGroup || upperFloorGroup.isCurrent) {
      setFreshUpperBajantes(null);
      return;
    }
    const isRiser = (b: PlanoBajante) =>
      b.tipo !== 'contador' &&
      b.tipo !== 'calentador' &&
      b.tipo !== 'red_publica' &&
      b.tipo !== 'canal'; // canales FUERA de Destino/Origen (solo bajantes, orig. usuario)
    const data = loadFromStorage<{ bajantes?: PlanoBajante[] } | null>(
      TRAZOS_PREFIX + upperFloorGroup.planId,
      null,
    );
    setFreshUpperBajantes(
      (data?.bajantes || []).filter((b) => b.net === (element.net || '') && isRiser(b)) || null,
    );
  }, [upperFloorGroup, element.id, element.origenId, element.descargaEnId, element.net]);

  const updateGhostField = (field: string, val: string) => {
    if (!engineRef.current) return;
    const gd2 = { ...(element.ghostData || {}) };
    const cd = { ...(gd2[currentGhostLabel] || {}) };
    (cd as Record<string, string>)[field] = val;
    gd2[currentGhostLabel] = cd;
    engineRef.current.updateElementById(element.id, { ghostData: gd2 });
    const fresh = engineRef.current.bajantes.find((b) => b.id === element.id);
    if (fresh) {
      setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
      if (selElement?.id === element.id) {
        setSelElement({ ...selElement, ghostData: gd2 });
      }
    }
  };

  // Espejo del onChange de "Destino" (más abajo) pero para el selector "Origen" del piso
  // inmediatamente superior — misma lógica que associateOrigin en BajanteAsociacion.tsx,
  // duplicada aquí (no compartida) porque esta versión lee/escribe `element` (lo que se haya
  // clicado con botón derecho, no necesariamente selElement) y sincroniza contextMenuState
  // igual que el resto de handlers de este componente.
  const associateOrigin = (v: string | null) => {
    if (!engineRef.current) return;
    const eng = engineRef.current;
    const currentPlanId = String(eng._loadedPlanId ?? '');
    const target: AssocEndpoint = {
      planId: currentPlanId,
      id: element.id,
      x: element.x,
      y: element.y,
      net: element.net || 'san',
      dNominal: element.dNominal || '',
      code: element.code || element.id,
      nivelN: Number(eng.nivelActual?.n ?? 0),
      npt: Number(eng.nivelActual?.npt ?? 0),
      tipo: element.tipo,
    };
    const prevOrigen = element.origenId;
    const syncLocal = () => {
      const fresh = eng.bajantes.find((b) => b.id === element.id);
      if (fresh) setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
    };

    if (!v) {
      if (prevOrigen) {
        const [prevPlanId, prevBajId] = prevOrigen.split('|');
        if (prevPlanId && prevBajId)
          clearBajanteAssociation(
            eng,
            prevPlanId,
            prevBajId,
            element.net || 'san',
            `${currentPlanId}|${element.id}`,
            planosCtx.plans,
          );
      }
      eng.updateElementById(element.id, { origenId: null });
      syncLocal();
      if (selElement?.id === element.id) setSelElement({ ...selElement, origenId: null });
      writeBajantePropToDrawing(
        `${element.id}-${currentPlanId}`,
        element.net || 'san',
        'origenId',
        null,
        planosCtx.plans,
      );
      eng.render();
      return;
    }

    const [originPlanId, originBajanteId] = v.split('|');
    const originBaj = upperFloorGroup?.bajantes.find((b) => b.id === originBajanteId);
    if (!originBaj || originBaj.x == null || originBaj.y == null) {
      const originPlan = planosCtx.plans.find((pl) => String(pl.id) === originPlanId);
      eng.triggerAlert(
        'No se pudo asociar',
        `No se encontró el bajante ${buildBajanteVisualLabel(
          { code: originBajanteId },
          originPlan?.nivel != null ? pisoCorto(originPlan.nivel) : undefined,
        )} en el piso superior. Intenta reabrir el panel o recargar el piso.`,
      );
      return;
    }
    const originPlan = planosCtx.plans.find((pl) => String(pl.id) === originPlanId);
    const source: AssocEndpoint = {
      planId: originPlanId,
      id: originBajanteId,
      x: originBaj.x,
      y: originBaj.y,
      net: target.net,
      dNominal: originBaj.dNominal || '',
      code: originBaj.code || originBajanteId,
      nivelN: originPlan?.nivel ?? 0,
      npt: Number(upperFloorGroup?.npt ?? 0),
      tipo: (originBaj as { tipo?: string }).tipo,
    };

    const commit = () => {
      if (prevOrigen) {
        const [prevPlanId, prevBajId] = prevOrigen.split('|');
        if (prevPlanId && prevBajId)
          clearBajanteAssociation(
            eng,
            prevPlanId,
            prevBajId,
            element.net || 'san',
            `${currentPlanId}|${element.id}`,
            planosCtx.plans,
          );
      }
      applyBajanteAssociation(eng, source, target, planosCtx.plans);
      syncLocal();
      if (selElement?.id === element.id) setSelElement({ ...selElement, origenId: v });
    };

    if (areEndpointsAligned(source, target)) {
      commit();
      return;
    }
    const srcLabel = buildBajanteVisualLabel(
      { code: source.code },
      originPlan?.nivel != null ? pisoCorto(originPlan.nivel) : undefined,
    );
    const tgtLabel = buildBajanteVisualLabel(
      { code: target.code },
      selectedNivel !== null ? pisoCorto(selectedNivel) : undefined,
    );
    triggerConfirm(
      'Crear fantasma de asociación',
      `${srcLabel} y ${tgtLabel} no están alineados. Se creará un bajante fantasma y un ramal de desvío en este piso, en la posición de ${srcLabel}. ¿Continuar?`,
      commit,
      'Aceptar',
    );
  };

  return (
    <>
      {!isGhostClick ? (
        <>
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: '4px 8px',
              borderTop: '1px solid #3a494a',
              marginTop: 4,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={MENU_SECTION_LABEL_ROW_STYLE}>Destino</div>
              <select
                value={element.descargaEnId || ''}
                aria-label="Destino"
                onChange={(e) => {
                  const v = e.target.value || null;
                  const eng = engineRef.current;
                  if (!eng) return;
                  const currentPlanId = String(eng._loadedPlanId ?? '');
                  const prevV = element.descargaEnId;
                  const syncLocal = () => {
                    const fresh = eng.bajantes.find((b) => b.id === element.id);
                    if (fresh)
                      setContextMenuState((prev) =>
                        prev ? { ...prev, element: { ...fresh } } : null,
                      );
                  };

                  if (!v) {
                    if (prevV)
                      clearBajanteAssociation(
                        eng,
                        currentPlanId,
                        element.id,
                        element.net || 'san',
                        prevV,
                        planosCtx.plans,
                      );
                    eng.updateElementById(element.id, { descargaEnId: null });
                    syncLocal();
                    if (selElement?.id === element.id)
                      setSelElement({ ...selElement, descargaEnId: null });
                    writeBajantePropToDrawing(
                      `${element.id}-${currentPlanId}`,
                      element.net || 'san',
                      'descargaEnId',
                      null,
                      planosCtx.plans,
                    );
                    eng.render();
                    return;
                  }

                  const [targetPlanId, targetBajanteId] = v.split('|');
                  const targetGroup = lowerFloorsRamales.find(
                    (g) => String(g.planId) === targetPlanId,
                  );
                  const targetBaj = targetGroup?.bajantes.find((b) => b.id === targetBajanteId);
                  if (!targetBaj || targetBaj.x == null || targetBaj.y == null) return;
                  const targetPlan = planosCtx.plans.find((pl) => String(pl.id) === targetPlanId);
                  const source: AssocEndpoint = {
                    planId: currentPlanId,
                    id: element.id,
                    x: element.x,
                    y: element.y,
                    net: element.net || 'san',
                    dNominal: element.dNominal || '',
                    code: element.code || element.id,
                    nivelN: Number(eng.nivelActual?.n ?? 0),
                    npt: Number(eng.nivelActual?.npt ?? 0),
                    tipo: element.tipo,
                  };
                  const target: AssocEndpoint = {
                    planId: targetPlanId,
                    id: targetBajanteId,
                    x: targetBaj.x,
                    y: targetBaj.y,
                    net: source.net,
                    dNominal: targetBaj.dNominal || '',
                    code: targetBaj.code || targetBajanteId,
                    nivelN: targetPlan?.nivel ?? 0,
                    npt: Number(targetGroup?.npt ?? 0),
                    tipo: (targetBaj as { tipo?: string }).tipo,
                  };

                  const commit = () => {
                    if (prevV)
                      clearBajanteAssociation(
                        eng,
                        currentPlanId,
                        element.id,
                        element.net || 'san',
                        prevV,
                        planosCtx.plans,
                      );
                    applyBajanteAssociation(eng, source, target, planosCtx.plans);
                    syncLocal();
                    if (selElement?.id === element.id) {
                      setSelElement({
                        ...selElement,
                        descargaEnId: v,
                        direccion: target.npt < source.npt ? 'baja' : 'sube',
                      });
                    }
                  };

                  if (areEndpointsAligned(source, target)) {
                    commit();
                    return;
                  }
                  const srcLabel = buildBajanteVisualLabel(
                    { code: source.code },
                    selectedNivel !== null ? pisoCorto(selectedNivel) : undefined,
                  );
                  const tgtLabel = buildBajanteVisualLabel(
                    { code: target.code },
                    targetPlan?.nivel != null ? pisoCorto(targetPlan.nivel) : undefined,
                  );
                  triggerConfirm(
                    'Crear fantasma de asociación',
                    `${srcLabel} y ${tgtLabel} no están alineados. Se creará un bajante fantasma y un ramal de desvío en el piso de origen, en la posición de ${srcLabel}. ¿Continuar?`,
                    commit,
                    'Aceptar',
                  );
                }}
                style={{ ...MENU_SELECT_STYLE, width: '100%' }}
              >
                <option value="">Sin destino</option>
                {lowerFloorsRamales.map((group) => {
                  const plano = planosCtx.plans.find(
                    (pl) => (pl.id as unknown as string) === group.planId,
                  );
                  const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
                  // Ascendente por código (orig. usuario) y sin piso tras el guion — el piso
                  // ya se ve en el optgroup.
                  const bajantesToShow = (
                    group.isCurrent
                      ? (group.bajantes || []).filter((b) => b.id !== element.id)
                      : group.bajantes || []
                  )
                    .slice()
                    .sort((a, b) =>
                      (a.code || a.id).localeCompare(b.code || b.id, undefined, { numeric: true }),
                    );
                  const hasBajantes = bajantesToShow.length > 0;
                  return (
                    <optgroup key={group.planId} label={pLabel}>
                      {hasBajantes &&
                        bajantesToShow.map((b) => (
                          <option key={`${group.planId}|${b.id}`} value={`${group.planId}|${b.id}`}>
                            {b.code || b.id}
                          </option>
                        ))}
                      {!hasBajantes && (
                        <option value="" disabled>
                          Sin elementos disponibles
                        </option>
                      )}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={MENU_SECTION_LABEL_ROW_STYLE}>Diámetro</div>
              <select
                value={(() => {
                  const gd = element.ghostData?.[currentGhostLabel];
                  return isGhostClick
                    ? gd && gd.dNominal !== undefined
                      ? gd.dNominal
                      : element.dNominal || ''
                    : element.dNominal || '';
                })()}
                aria-label="Diámetro"
                onChange={(e) => {
                  const val = e.target.value;
                  if (isGhostClick) {
                    updateGhostField('dNominal', val);
                  } else {
                    // Validación: el diámetro del bajante no puede ser menor que el de los
                    // ramales conectados
                    if (val && element.recibeDeIds?.length && engineRef.current) {
                      const bajIn = diamPulgFromLabel(val.replace(/-/g, ' '));
                      if (bajIn > 0) {
                        for (const rid of element.recibeDeIds) {
                          const ram = engineRef.current.ramales.find((r) => r.id === rid);
                          if (!ram || !ram.diametro) continue;
                          const ramIn = diamPulgFromLabel(ram.diametro.replace(/-/g, ' '));
                          if (ramIn > 0 && ramIn > bajIn) {
                            engineRef.current?.triggerAlert(
                              'Diámetro no permitido',
                              `Diámetro del bajante no puede ser menor al del ramal conectado (${ram.diametro})`,
                            );
                            e.target.value = element.dNominal || '';
                            // Select controlado: sin re-render, el DOM seguía mostrando el
                            // valor rechazado (React no sabía del cambio directo).
                            setContextMenuState((prev) =>
                              prev ? { ...prev, element: { ...prev.element } } : null,
                            );
                            return;
                          }
                        }
                      }
                    }
                    // Regla entre pisos: el inferior no puede quedar con menor diámetro.
                    if (val && engineRef.current) {
                      const pid = String(engineRef.current._loadedPlanId ?? '');
                      const v = validarDiametroEntrePisos(pid, element.id, val);
                      if (!v.ok) {
                        avisarDiametroInvalido(v.mensaje, v.titulo);
                        e.target.value = element.dNominal || '';
                        setContextMenuState((prev) =>
                          prev ? { ...prev, element: { ...prev.element } } : null,
                        );
                        return;
                      }
                    }
                    const fields = { dNominal: val };
                    engineRef.current?.updateElementById(element.id, fields);
                    const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                    if (fresh) {
                      setContextMenuState((prev) =>
                        prev ? { ...prev, element: { ...fresh } } : null,
                      );
                      if (selElement?.id === element.id) {
                        setSelElement({ ...selElement, dNominal: fields.dNominal });
                      }
                    }
                  }
                }}
                style={MENU_SELECT_STYLE}
              >
                <option value="">—</option>
                {(element.net === 'vent'
                  ? DIAM_VENT
                  : element.net === 'san'
                    ? DIAM_BAN_SAN
                    : element.net === 'll'
                      ? DIAM_BAN_LL
                      : DIAM_BAN
                ).map((d) => (
                  <option key={d.pulg} value={d.nom}>
                    {normalizeDnLabel(d.nom)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {upperFloorGroup && (
            <div style={{ padding: '0 8px 4px' }}>
              <div style={MENU_SECTION_LABEL_ROW_STYLE}>Origen (piso superior)</div>
              <select
                value={element.origenId || ''}
                aria-label="Origen"
                onChange={(e) => associateOrigin(e.target.value || null)}
                style={MENU_SELECT_STYLE}
              >
                <option value="">Sin origen</option>
                {(() => {
                  const plano = planosCtx.plans.find(
                    (pl) => (pl.id as unknown as string) === upperFloorGroup.planId,
                  );
                  const pLabel =
                    plano?.nivel != null ? pisoLbl(plano.nivel) : upperFloorGroup.planName;
                  const bajantesToShow = (freshUpperBajantes ?? (upperFloorGroup.bajantes || []))
                    .slice()
                    .sort((a, b) =>
                      (a.code || a.id).localeCompare(b.code || b.id, undefined, { numeric: true }),
                    );
                  const hasBajantes = bajantesToShow.length > 0;
                  return (
                    <optgroup label={pLabel}>
                      {hasBajantes &&
                        bajantesToShow.map((b) => (
                          <option
                            key={`${upperFloorGroup.planId}|${b.id}`}
                            value={`${upperFloorGroup.planId}|${b.id}`}
                          >
                            {b.code || b.id}
                          </option>
                        ))}
                      {!hasBajantes && (
                        <option value="" disabled>
                          Sin elementos disponibles
                        </option>
                      )}
                    </optgroup>
                  );
                })()}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, padding: '0 8px 4px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={MENU_SECTION_LABEL_ROW_STYLE}>Llenado (R)</div>
              <select
                value={
                  element.bajR != null
                    ? Math.abs(element.bajR - 7 / 24) < 0.001
                      ? '7/24'
                      : '1/4'
                    : '7/24'
                }
                aria-label="Llenado (R)"
                onChange={(e) => {
                  const val = e.target.value;
                  const valNum = val === '7/24' ? 7 / 24 : 0.25;
                  engineRef.current?.updateElementById(element.id, { bajR: valNum });
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh)
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...fresh } } : null,
                    );
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, bajR: valNum });
                  }
                }}
                style={MENU_SELECT_STYLE}
              >
                <option value="7/24">7/24</option>
                <option value="1/4">1/4</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={MENU_SECTION_LABEL_ROW_STYLE}>Área</div>
              <select
                value={element.area_m2 || ''}
                aria-label="Área"
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  engineRef.current?.updateElementById(element.id, { area_m2: val });
                  setContextMenuState((prev) =>
                    prev ? { ...prev, element: { ...prev.element, area_m2: val } } : null,
                  );
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, area_m2: val });
                  }
                }}
                style={MENU_SELECT_STYLE}
              >
                <option value="">Sin área</option>
                {(engineRef.current?.areas || [])
                  .filter((a) => a.net === element.net)
                  .map((a) => (
                    <option key={a.id} value={a.areaM2}>
                      {a.label} · {a.areaM2} m²
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 4, padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
          <div style={MENU_SECTION_LABEL_ROW_STYLE}>Diámetro</div>
          <select
            value={(() => {
              const gd = element.ghostData?.[currentGhostLabel];
              return isGhostClick
                ? gd && gd.dNominal !== undefined
                  ? gd.dNominal
                  : element.dNominal || ''
                : element.dNominal || '';
            })()}
            aria-label="Diámetro"
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                if (isGhostClick) {
                  updateGhostField('dNominal', val);
                } else {
                  // Validación: el diámetro del bajante no puede ser menor que el de los
                  // ramales conectados
                  if (val && element.recibeDeIds?.length) {
                    const bajIn = diamPulgFromLabel(val.replace(/-/g, ' '));
                    if (bajIn > 0) {
                      for (const rid of element.recibeDeIds) {
                        const ram = engineRef.current.ramales.find((r) => r.id === rid);
                        if (!ram || !ram.diametro) continue;
                        const ramIn = diamPulgFromLabel(ram.diametro.replace(/-/g, ' '));
                        if (ramIn > 0 && ramIn > bajIn) {
                          engineRef.current?.triggerAlert(
                            'Diámetro no permitido',
                            `Diámetro del bajante no puede ser menor al del ramal conectado (${ram.diametro})`,
                          );
                          e.target.value = element.dNominal || '';
                          // Select controlado: sin re-render, el DOM seguía mostrando el
                          // valor rechazado (React no sabía del cambio directo).
                          setContextMenuState((prev) =>
                            prev ? { ...prev, element: { ...prev.element } } : null,
                          );
                          return;
                        }
                      }
                    }
                  }
                  // Regla entre pisos: el inferior no puede quedar con menor diámetro.
                  if (val && engineRef.current) {
                    const pid = String(engineRef.current._loadedPlanId ?? '');
                    const v = validarDiametroEntrePisos(pid, element.id, val);
                    if (!v.ok) {
                      avisarDiametroInvalido(v.mensaje, v.titulo);
                      e.target.value = element.dNominal || '';
                      setContextMenuState((prev) =>
                        prev ? { ...prev, element: { ...prev.element } } : null,
                      );
                      return;
                    }
                  }
                  const fields = { dNominal: val };
                  engineRef.current?.updateElementById(element.id, fields);
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh) {
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...fresh } } : null,
                    );
                    if (selElement?.id === element.id) {
                      setSelElement({ ...selElement, dNominal: fields.dNominal });
                    }
                  }
                }
              }
            }}
            style={MENU_SELECT_STYLE}
          >
            <option value="">—</option>
            {(element.net === 'vent'
              ? DIAM_VENT
              : element.net === 'san'
                ? DIAM_BAN_SAN
                : element.net === 'll'
                  ? DIAM_BAN_LL
                  : DIAM_BAN
            ).map((d) => (
              <option key={d.pulg} value={d.nom}>
                {normalizeDnLabel(d.nom)}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
