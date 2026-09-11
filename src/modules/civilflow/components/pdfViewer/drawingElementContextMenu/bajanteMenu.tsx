import { useState, useEffect } from 'react';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import {
  pisoLbl,
  pisoCorto,
  buildBajanteVisualLabel,
  DIAM_BAN,
  DIAM_BAN_SAN,
  DIAM_VENT,
} from '../../../constants';
import { loadFromStorage } from '../../../services/storageService';
import { APARATOS_BY_TRAMO_KEY } from '../../../constants/storage-keys';
import { handleCreateBomba } from '../../../lib/PlanoEngine/drawingCreations';
import {
  asociarBomba,
  quitarBomba,
  bombsImmediateLowerFloor,
} from '../../../utils/bombaAssociation';
import { TRAZOS_PREFIX } from '../../../constants/storage-keys';
import { codoPolarityOk, codoNivelPermitidoEn } from '../../../lib/PlanoEngine/PlanoEngineDrawing';
import { hasTeeAtPoint } from '../../../lib/PlanoEngine/ventCodoTeeFix';
import { writeBajantePropToDrawing } from '../../../utils/writeDiameterToDrawing';
import {
  applyBajanteAssociation,
  clearBajanteAssociation,
  areEndpointsAligned,
  type AssocEndpoint,
} from '../../../utils/bajanteAssociation';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoBajante, PlanoElement } from '../../../lib/PlanoEngine/PlanoState';
import type { Piso } from '../../../lib/shared/projectTypes';
import type { PlanItem } from '../../../context/PlansContext';
import {
  useDrawingElementContextMenu,
  MENU_SELECT_STYLE,
  MENU_DIR_BTN_STYLE,
  MENU_FANTASMA_BTN_STYLE,
  MENU_SECTION_LABEL_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  MENU_ACTION_BTN_STYLE,
  MENU_CHECK_ROW_STYLE,
  type ContextMenuState,
  type LowerFloorRamales,
} from './context';
import { BajanteConnectionPanel } from './bajanteConnectionPanel';

/** Selector de dirección de flujo del bajante/montante (Sube/Baja/Continua) con validaciones
 *  de coherencia contra los ramales conectados, y botón para activar o quitar el desplazamiento
 *  fantasma. */
export function BajanteDirectionSelector({
  element,
  isGhostClick = false,
  selectedNivel,
  pisos,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
}: {
  element: PlanoBajante;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  pisos: Piso[];
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
}) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
  const gd = element.ghostData?.[currentGhostLabel];
  const oppositeParentDir =
    element.direccion === 'sube'
      ? 'baja'
      : element.direccion === 'baja'
        ? 'sube'
        : element.direccion;
  const ghostDir = isGhostClick
    ? gd && gd.direccion !== undefined
      ? gd.direccion
      : oppositeParentDir
    : element.direccion;

  const updateGhostField = (field: string, val: string) => {
    if (!engineRef.current) return;
    const gd2 = { ...(element.ghostData || {}) };
    const cd = { ...(gd2[currentGhostLabel] || {}) };
    (cd as Record<string, string>)[field] = val;
    gd2[currentGhostLabel] = cd;
    engineRef.current?.updateElementById(element.id, { ghostData: gd2 });
    const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
    if (fresh) {
      setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
      if (selElement?.id === element.id) {
        setSelElement({ ...selElement, ghostData: gd2 });
      }
    }
  };

  return (
    <>
      <div style={MENU_SECTION_LABEL_STYLE}>Dirección de flujo</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 3,
          padding: '0 6px 4px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {['Sube', 'Baja', 'Continua'].map((opt) => {
          const isActive = ghostDir === opt.toLowerCase();
          return (
            <button
              type="button"
              key={opt}
              onClick={() => {
                if (!engineRef.current) return;
                if (isGhostClick) {
                  updateGhostField('direccion', opt.toLowerCase());
                  engineRef.current?.render();
                  return;
                }
                const currentNpt = pisos.find((p) => p.n === selectedNivel)?.npt || 0;
                const allNpts = pisos.map((p) => p.npt).sort((a, b) => Number(a) - Number(b));
                const maxNpt = allNpts[allNpts.length - 1] || 0;
                const minNpt = allNpts[0] || 0;
                let updates: Record<string, unknown> = {};

                if (opt === 'Sube') {
                  // Ventilación: sin validación de dirección de flujo (usuario pide desactivarla).
                  // Bajantes asociados entre pisos: tampoco — el Ldesvio llega al padre original,
                  // la dirección la manda la asociación.
                  const isAsociado = !!(element.origenId || element.descargaEnId);
                  if (element.net !== 'vent' && !isAsociado) {
                    const bajCode = element.code || element.id;
                    const arrivingRamal = (element.recibeDeIds || [])
                      .map((rid) => engineRef.current?.ramales.find((r) => r.id === rid))
                      .find((ram) => ram && ram.net === element.net && ram.fin === bajCode);
                    if (arrivingRamal) {
                      engineRef.current?.triggerAlert(
                        'Dirección de flujo inconsistente',
                        `El ramal ${arrivingRamal.label || arrivingRamal.id} llega a este bajante (está conectado por su extremo final). Un bajante con dirección "sube" solo puede entregar flujo — desconecta o invierte ese ramal antes de cambiar la dirección.`,
                      );
                      return;
                    }
                  }
                  updates = {
                    direccion: 'sube',
                    nptBase: currentNpt,
                    nptCima: maxNpt,
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                } else if (opt === 'Baja') {
                  // Asociados entre pisos sin validación: el Ldesvio llega al padre original y
                  // la dirección la manda la asociación (orig. usuario).
                  const isAsociadoBaja = !!(element.origenId || element.descargaEnId);
                  if (element.net !== 'vent' && !isAsociadoBaja) {
                    const bajCode = element.code || element.id;
                    const emittingRamal = (element.recibeDeIds || [])
                      .map((rid) => engineRef.current?.ramales.find((r) => r.id === rid))
                      .find((ram) => ram && ram.net === element.net && ram.ini === bajCode);
                    if (emittingRamal) {
                      engineRef.current?.triggerAlert(
                        'Dirección de flujo inconsistente',
                        `El ramal ${emittingRamal.label || emittingRamal.id} sale de este bajante (está conectado por su extremo inicial). Un bajante con dirección "baja" solo puede recibir flujo — desconecta o invierte ese ramal antes de cambiar la dirección.`,
                      );
                      return;
                    }
                  }
                  updates = {
                    direccion: 'baja',
                    nptBase: minNpt,
                    nptCima: currentNpt,
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                } else if (opt === 'Continua') {
                  updates = {
                    direccion: 'continua',
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                }
                if (Object.keys(updates).length > 0) {
                  engineRef.current?.updateElementById(element.id, updates);
                  // El accesorio de un montante (codo90rmSube/Baja en extremo de ramal, o
                  // teeSube/Baja en división a mitad de cuerpo) se escribió una sola vez al
                  // crearse y nunca se resincronizó al cambiar la dirección después — siempre se
                  // quedaba con el valor inicial. Aquí se recalcula a partir de la dirección
                  // ACTUAL, localizando el punto exacto por posición (extremo → codo, vértice
                  // interior → tee) en lugar de asumir que siempre es un extremo.
                  if (
                    element.tipo === 'montante' &&
                    (updates.direccion === 'sube' || updates.direccion === 'baja')
                  ) {
                    const isSube = updates.direccion === 'sube';
                    const codoId = isSube ? 'codo90rmSube' : 'codo90rmBaja';
                    const teeId = isSube ? 'teeSube' : 'teeBaja';
                    const TOL = 0.5;
                    // Ítems 12/13: validar la polaridad del codo contra el flujo del ramal ANTES
                    // de escribir — codoSube exige que el flujo LLEGUE al punto, codoBaja que
                    // SALGA. Sin esto, cambiar la dirección del montante podía escribir un codo
                    // contradictorio con la flecha del ramal.
                    for (const rid of element.recibeDeIds || []) {
                      const ram = engineRef.current?.ramales.find((r) => r.id === rid);
                      if (!ram || !ram.pts?.length) continue;
                      const idx = ram.pts.findIndex(
                        ([px, py]) => Math.hypot(px - element.x, py - element.y) < TOL,
                      );
                      if (idx === -1) continue;
                      const pt = ram.pts[idx];
                      if (idx === 0 || idx === ram.pts.length - 1) {
                        // Ítem 5: codos de nivel prohibidos en intersecciones entre ramales (tee)
                        const isVentTeeBaj =
                          ram.net === 'vent' && hasTeeAtPoint(engineRef.current!, pt, ram.net);
                        if (
                          !isVentTeeBaj &&
                          engineRef.current &&
                          !codoNivelPermitidoEn(engineRef.current, ram.id, pt)
                        ) {
                          engineRef.current?.triggerAlert(
                            'Codo de nivel no permitido aquí',
                            'Los codos sube/baja solo pueden ubicarse entre el cuerpo del ramal y sus extremos, no en intersecciones entre ramales.',
                          );
                          return;
                        }
                        if (!isVentTeeBaj && !codoPolarityOk(ram, pt, codoId, TOL)) {
                          engineRef.current?.triggerAlert(
                            'Polaridad de codo incorrecta',
                            isSube
                              ? 'El codo 90° sube exige que la cola de la flecha apunte a este punto (el flujo debe salir de aquí hacia el codo). Invierte la dirección del ramal o usa "baja".'
                              : 'El codo 90° baja exige que la cabeza de la flecha apunte a este punto (el flujo debe llegar aquí desde el codo). Invierte la dirección del ramal o usa "sube".',
                          );
                          return;
                        }
                      }
                    }
                    for (const rid of element.recibeDeIds || []) {
                      const ram = engineRef.current?.ramales.find((r) => r.id === rid);
                      if (!ram || !ram.pts?.length) continue;
                      const idx = ram.pts.findIndex(
                        ([px, py]) => Math.hypot(px - element.x, py - element.y) < TOL,
                      );
                      if (idx === -1) continue;
                      if (idx === 0)
                        engineRef.current?.updateElementById(ram.id, { accesorioInicio: codoId });
                      else if (idx === ram.pts.length - 1)
                        engineRef.current?.updateElementById(ram.id, { accesorioFin: codoId });
                      else
                        engineRef.current?.updateElementById(ram.id, {
                          accMed: { ...(ram.accMed || {}), [`accMed${idx}`]: teeId },
                        });
                    }
                  }
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh) {
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...fresh } } : null,
                    );
                  }
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, ...updates });
                  }
                }
              }}
              style={{
                ...MENU_DIR_BTN_STYLE,
                background: isActive ? 'rgba(37,99,235,0.15)' : '#1e2024',
                border: `1px solid ${isActive ? '#2563eb' : '#3a494a'}`,
                color: isActive ? '#3b82f6' : '#e2e2e8',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = '#2563eb33';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = '#1e2024';
              }}
            >
              <div
                style={{
                  color: opt === 'Sube' ? '#00dce5' : opt === 'Baja' ? '#F04545' : '#FFEB3B',
                  flexShrink: 0,
                }}
              >
                {opt === 'Sube' ? '\u2B06' : opt === 'Baja' ? '\u2B07' : '\u279C'}
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {opt}
              </span>
            </button>
          );
        })}
      </div>
      {!isGhostClick && (
        <button
          type="button"
          onClick={() => {
            if (!engineRef.current) return;
            const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
            const isFantasma = element.isFantasma;
            // Un bajante que ya tiene un ramal/tributario conectado no puede convertirse en
            // fantasma — el desplazamiento lo separaría visualmente de lo que realmente está
            // alimentando, así que se bloquea la activación con una advertencia explícita.
            if (!isFantasma && (element.recibeDeIds?.length ?? 0) > 0) {
              engineRef.current.triggerAlert(
                'No se puede activar fantasma',
                'Este bajante ya tiene un ramal o tributario conectado. Desconéctalo antes de activar el desplazamiento.',
              );
              return;
            }
            const updates: Record<string, unknown> = { isFantasma: !isFantasma };
            if (!isFantasma && lvl) {
              const currentDesp = { ...(element.desplazamientos || {}) };
              if (!currentDesp[lvl]) {
                currentDesp[lvl] = { dx: 2, dy: 0 };
                updates.desplazamientos = currentDesp;
              }
            }
            engineRef.current?.updateElementById(element.id, updates);
            setTimeout(() => {
              const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
              if (fresh) {
                setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
                if (selElement?.id === element.id) {
                  setSelElement({ ...selElement, ...updates });
                }
              }
            }, 50);
            engineRef.current?.render();
          }}
          style={{
            ...MENU_FANTASMA_BTN_STYLE,
            background: element.isFantasma ? 'rgba(245,166,35,0.12)' : 'transparent',
            color: element.isFantasma ? '#F5A623' : '#e2e2e8',
          }}
          onMouseEnter={(e) => {
            if (!element.isFantasma) e.currentTarget.style.background = '#2563eb33';
          }}
          onMouseLeave={(e) => {
            if (!element.isFantasma)
              e.currentTarget.style.background = element.isFantasma
                ? 'rgba(245,166,35,0.12)'
                : 'transparent';
          }}
        >
          {element.isFantasma
            ? 'Desactivar desplazamiento del bajante'
            : 'Activar desplazamiento del bajante'}
        </button>
      )}
    </>
  );
}

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
      b.tipo !== 'contador' && b.tipo !== 'calentador' && b.tipo !== 'red_publica';
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
                  const bajantesToShow = group.isCurrent
                    ? (group.bajantes || []).filter((b) => b.id !== element.id)
                    : group.bajantes || [];
                  const hasBajantes = bajantesToShow.length > 0;
                  return (
                    <optgroup key={group.planId} label={pLabel}>
                      {hasBajantes &&
                        bajantesToShow.map((b) => (
                          <option key={`${group.planId}|${b.id}`} value={`${group.planId}|${b.id}`}>
                            {buildBajanteVisualLabel(
                              b,
                              plano?.nivel != null ? pisoCorto(plano.nivel) : undefined,
                            )}
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
                            return;
                          }
                        }
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
                  const bajantesToShow = freshUpperBajantes ?? (upperFloorGroup.bajantes || []);
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
                          return;
                        }
                      }
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
/** Menú contextual de un bajante/montante: compone el selector de dirección, el de diámetro y
 *  destino, y el panel de conexiones para redes sanitarias y de lluvias. */
/** Sección BOMBA para cajas AN/LL: "Crear bomba" (una por caja) o, si ya existe,
 *  "Bomba asociada" con nomenclatura, nivel, caja de origen, UDs y bajante asociado. */
function CajaBombaSection({
  ctx,
  caja,
}: {
  ctx: ReturnType<typeof useDrawingElementContextMenu>;
  caja: PlanoBajante;
}) {
  const eng = ctx.engineRef.current;
  const bomba = eng?.bajantes.find((b) => b.tipo === 'bomba' && b.cajaOrigenId === caja.id);
  if (!bomba) {
    return (
      <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
        <div style={MENU_SECTION_LABEL_ROW_STYLE}>Bomba</div>
        <button
          type="button"
          style={MENU_ACTION_BTN_STYLE}
          onClick={() => {
            if (!eng) return;
            handleCreateBomba(eng, caja);
            ctx.setContextMenuState((prev) =>
              prev ? { ...prev, element: { ...prev.element } } : null,
            );
          }}
        >
          + Crear bomba
        </button>
      </div>
    );
  }
  // Bomba asociada: info de solo lectura.
  const planId = String(eng?._loadedPlanId ?? '');
  const counts = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
  const udMap = counts[`${bomba.net}_${bomba.id}_${planId}`] || {};
  const uds = Object.values(udMap).reduce((a, b) => a + b, 0);
  // Bajante asociado: algún piso tiene un bajante con bombaEnId → "<este plan>|<esta bomba>".
  let bajInfo = '—';
  for (const pl of ctx.planosCtx?.plans || []) {
    if (pl.status !== 'confirmed') continue;
    const t = loadFromStorage<{
      bajantes?: Array<{ id: string; code?: string; bombaEnId?: string | null }>;
    } | null>(TRAZOS_PREFIX + String(pl.id), null);
    const dst = t?.bajantes?.find((b) => b.bombaEnId === `${planId}|${bomba.id}`);
    if (dst) {
      bajInfo = `${dst.code || dst.id} (${pl.nivel != null ? pisoLbl(Number(pl.nivel)) : pl.id})`;
      break;
    }
  }
  return (
    <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
      <div style={MENU_SECTION_LABEL_ROW_STYLE}>Bomba asociada</div>
      <div
        style={{ fontSize: 12, color: '#b9caca', fontFamily: "'Geist',monospace", lineHeight: 1.5 }}
      >
        <div>
          Nomenclatura: <b>{bomba.code || bomba.id}</b>
        </div>
        <div>Nivel: {bomba.pisoBase || '—'}</div>
        <div>Caja de origen: {caja.code || caja.id}</div>
        <div>Unidades de descarga: {uds}</div>
        <div>Bajante asociado: {bajInfo}</div>
      </div>
    </div>
  );
}

/** Sección "Asociar bomba del piso inferior": CHECKBOX con las bombas del piso
 *  inmediatamente inferior (orig. usuario) — marcada refleja la asociación vía `bombaEnId`;
 *  al marcar, el bajante recibe las MISMAS UDs de la bomba (herencia hacia arriba del efecto
 *  de FixturesPanel) y la dirección pasa a SUBE. */
function AsociarBombaSection({
  ctx,
  bajEl,
}: {
  ctx: ReturnType<typeof useDrawingElementContextMenu>;
  bajEl: PlanoBajante;
}) {
  const eng = ctx.engineRef.current;
  const plans = ctx.planosCtx?.plans || [];
  const currentPlanId = String(eng?._loadedPlanId ?? '');
  const bombas = bombsImmediateLowerFloor(plans, currentPlanId);

  return (
    <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
      <div style={MENU_SECTION_LABEL_ROW_STYLE}>Asociar bomba del piso inferior</div>
      {bombas.length === 0 && (
        <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace" }}>
          Sin bombas en el piso inmediatamente inferior
        </div>
      )}
      {bombas.map((row) => {
        const checked = bajEl.bombaEnId === `${row.planId}|${row.id}`;
        return (
          <label key={row.planId + '|' + row.id} style={MENU_CHECK_ROW_STYLE}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                if (!eng) return;
                if (e.target.checked) asociarBomba(eng, bajEl, currentPlanId, row, plans);
                else quitarBomba(eng, bajEl, currentPlanId, plans);
                ctx.setContextMenuState((st) =>
                  st ? { ...st, element: { ...st.element } } : null,
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

export function BajanteMenu() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState, element } = ctx;
  const bajEl = element as PlanoBajante;
  const isGhostClick = contextMenuState.isGhostClick || false;
  const isSanOrLl = !isGhostClick && ['san', 'll'].includes(ctx.activeNet);
  const esCajaMenu = bajEl.tipo === 'caja_san' || bajEl.tipo === 'caja_ll';

  return (
    <>
      {esCajaMenu && !isGhostClick && <CajaBombaSection ctx={ctx} caja={bajEl} />}
      <BajanteDirectionSelector
        element={bajEl}
        isGhostClick={isGhostClick}
        selectedNivel={ctx.selectedNivel}
        pisos={ctx.pisos}
        engineRef={ctx.engineRef}
        selElement={ctx.selElement}
        setSelElement={ctx.setSelElement}
        setContextMenuState={ctx.setContextMenuState}
      />
      <BajanteDiameterSelector
        element={bajEl}
        isGhostClick={isGhostClick}
        selectedNivel={ctx.selectedNivel}
        engineRef={ctx.engineRef}
        selElement={ctx.selElement}
        setSelElement={ctx.setSelElement}
        setContextMenuState={ctx.setContextMenuState}
        lowerFloorsRamales={ctx.lowerFloorsRamales}
        upperFloorGroup={ctx.upperFloorGroup}
        planosCtx={ctx.planosCtx}
        triggerConfirm={ctx.triggerConfirm}
      />
      {bajEl.tipo === 'bajante' && isSanOrLl && <AsociarBombaSection ctx={ctx} bajEl={bajEl} />}
      {isSanOrLl && (
        <BajanteConnectionPanel
          element={bajEl}
          isGhostClick={isGhostClick}
          ramalEndpoint={null}
          engineRef={ctx.engineRef}
          selElement={ctx.selElement}
          setSelElement={ctx.setSelElement}
          setContextMenuState={ctx.setContextMenuState}
          activeNet={ctx.activeNet}
          planosCtx={ctx.planosCtx}
        />
      )}
    </>
  );
}
