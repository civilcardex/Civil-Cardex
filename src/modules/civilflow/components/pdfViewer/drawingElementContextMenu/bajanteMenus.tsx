import { useState, useEffect } from 'react';
import { ramalLabel } from '../../../utils/accessoryAbbreviations';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import {
  pisoLbl,
  pisoCorto,
  buildBajanteVisualLabel,
  matFullName,
  DIAM_BAN,
  DIAM_VENT,
  DIAM_BY_MAT,
  GAS_DN_LABELS,
} from '../../../constants';
import { loadFromStorage } from '../../../services/storageService';
import { TRAZOS_PREFIX } from '../../../constants/storage-keys';
import { getAccessoryOptions } from '../../../utils/accessoryOptions';
import { NETS, type PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
import { BAJANTE_NETS, MONTANTE_NETS } from '../../../lib/PlanoEngine/drawingCreations';
import {
  maxDiametroLabel,
  codoPolarityOk,
  flowEndsAt,
} from '../../../lib/PlanoEngine/PlanoEngineDrawing';
import {
  writeBajantePropToDrawing,
  writeAcoDiamToDrawing,
  writeContadorDiamToDrawing,
} from '../../../utils/writeDiameterToDrawing';
import {
  applyBajanteAssociation,
  clearBajanteAssociation,
  areEndpointsAligned,
  type AssocEndpoint,
} from '../../../utils/bajanteAssociation';
import { syncExtremeAccessoryToHidroData } from '../../../utils/syncExtremeAccessory';
import { GAS, CAT_GAS } from '../../../constants/engineeringDataGas';
import {
  VENTILACION,
  CONTADORES as CONTADORES_CAT,
  NETS_WITH_MULTIPLE_MATERIALS,
} from '../../../pages/catalog/catalogData';
import { DIAMETROS_AF } from '../../../constants/hydraulicData';
import { diamPulgFromLabel } from '../../../utils/diamPulgFromLabel';
import { matchDiamOption } from '../../../utils/diamOptionMatch';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement, PlanoRamal, PlanoArea } from '../../../lib/PlanoEngine/PlanoState';
import type { Piso } from '../../../lib/shared/projectTypes';
import type { PlanItem } from '../../../context/PlansContext';
import type { MaterialItem } from '../../../context/ProjectContext';
import {
  useDrawingElementContextMenu,
  MENU_SELECT_STYLE,
  MENU_DIR_BTN_STYLE,
  MENU_FANTASMA_BTN_STYLE,
  MENU_GRID_2COL_STYLE,
  MENU_CHECK_LABEL_STYLE,
  MENU_ACTION_BTN_STYLE,
  MENU_SECTION_LABEL_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  type ContextMenuState,
  type LowerFloorRamales,
  type ProbedElement,
} from './context';

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
                  // Guarda de dirección de flujo, espejo de la rama 'Baja' de abajo: un bajante
                  // "sube" solo debe ENTREGAR flujo. Si ya llega un ramal a este bajante
                  // (conectado por su FIN), marcarlo "sube" haría que recibiera flujo que solo
                  // debería emitir — se bloquea el cambio en lugar de producir en silencio una
                  // contradicción entre la dirección del bajante y sus conexiones.
                  const bajCode = element.code || element.id;
                  const arrivingRamal = (element.recibeDeIds || [])
                    .map((rid) => engineRef.current?.ramales.find((r) => r.id === rid))
                    .find((ram) => ram && ram.fin === bajCode);
                  if (arrivingRamal) {
                    engineRef.current?.triggerAlert(
                      'Dirección de flujo inconsistente',
                      `El ramal ${arrivingRamal.label || arrivingRamal.id} llega a este bajante (está conectado por su extremo final). Un bajante con dirección "sube" solo puede entregar flujo — desconecta o invierte ese ramal antes de cambiar la dirección.`,
                    );
                    return;
                  }
                  updates = {
                    direccion: 'sube',
                    nptBase: currentNpt,
                    nptCima: maxNpt,
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                } else if (opt === 'Baja') {
                  // Guarda de dirección de flujo, segunda parte: isRamalBajanteConnectionAllowed
                  // (en flowDirection.ts) solo se dispara cuando un extremo de ramal se conecta
                  // POR PRIMERA VEZ a un bajante. Nunca revalida las conexiones existentes cuando
                  // después se cambia la dirección del propio bajante — que es el orden mucho más
                  // común en la práctica (dibujar la geometría y luego fijar "Baja" aquí). Sin
                  // esta comprobación, un bajante que ya recibe un ramal por su INICIO (es decir,
                  // el ramal nace DEL bajante, no entra a él) podría marcarse "baja" en silencio
                  // aunque entonces estaría emitiendo flujo en lugar de solo recibirlo.
                  const bajCode = element.code || element.id;
                  const emittingRamal = (element.recibeDeIds || [])
                    .map((rid) => engineRef.current?.ramales.find((r) => r.id === rid))
                    .find((ram) => ram && ram.ini === bajCode);
                  if (emittingRamal) {
                    engineRef.current?.triggerAlert(
                      'Dirección de flujo inconsistente',
                      `El ramal ${emittingRamal.label || emittingRamal.id} sale de este bajante (está conectado por su extremo inicial). Un bajante con dirección "baja" solo puede recibir flujo — desconecta o invierte ese ramal antes de cambiar la dirección.`,
                    );
                    return;
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
                        if (!codoPolarityOk(ram, pt, codoId, TOL)) {
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
      `${srcLabel} y ${tgtLabel} no están alineados. Se creará un bajante fantasma en este piso, en la posición de ${srcLabel}. ¿Continuar?`,
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
                    `${srcLabel} y ${tgtLabel} no están alineados. Se creará un bajante fantasma en el piso de origen, en la posición de ${srcLabel}. ¿Continuar?`,
                    commit,
                    'Aceptar',
                  );
                }}
                style={{ ...MENU_SELECT_STYLE, width: '85%' }}
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
                {(element.net === 'vent' ? DIAM_VENT : DIAM_BAN).map((d) => (
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
            {(element.net === 'vent' ? DIAM_VENT : DIAM_BAN).map((d) => (
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
                return bajRamales.map((r) => {
                  const isAssociated = recibidos.includes(r.id);
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
                          const newRecibe = checked
                            ? [...liveRecibe, r.id]
                            : liveRecibe.filter((id: string) => id !== r.id);
                          engineRef.current?.updateElementById(bajEl.id, {
                            recibeDeIds: newRecibe,
                          });
                          setContextMenuState((prev) =>
                            prev
                              ? { ...prev, element: { ...prev.element, recibeDeIds: newRecibe } }
                              : null,
                          );
                          if (selElement?.id === bajEl.id) {
                            setSelElement({ ...selElement, recibeDeIds: newRecibe });
                          }
                          const bajCode = bajEl.code || bajEl.id;
                          const currentIni = r.ini || '';
                          const currentFin = r.fin || '';
                          if (isAtStart) {
                            const newIni = checked
                              ? bajCode
                              : currentIni === bajCode
                                ? ''
                                : currentIni;
                            engineRef.current?.updateElementById(r.id, { ini: newIni });
                          } else {
                            const newFin = checked
                              ? bajCode
                              : currentFin === bajCode
                                ? ''
                                : currentFin;
                            engineRef.current?.updateElementById(r.id, { fin: newFin });
                          }
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
                          eng.bajantes.push({
                            id,
                            net: ramalEl.net,
                            tipo: bmLabel,
                            code: code,
                            // Sin dirección por defecto — una dirección vacía no puede violar
                            // la regla de flujo ('sube' solo emite, 'baja' solo recibe). La
                            // dirección se asigna después mediante las opciones Sube/Baja, que
                            // validan las conexiones del ramal antes de aplicarla.
                            direccion: undefined,
                            x: ep.x,
                            y: ep.y,
                            pisoBase: nl?.label ?? '',
                            pisoCima: nl?.label ?? '',
                            nptBase: nl?.npt ?? 0,
                            nptCima: nl?.npt ?? 0,
                            hVert: 0,
                            dNominal: '0',
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
                                if (!codoPolarityOk(target, [ep.x, ep.y], val, 0.5)) {
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
                              if (accessoryVal === 'sifon' && ramalEl.net === 'san' && !isStart) {
                                engineRef.current.triggerAlert(
                                  'Revisar ubicación del sifón',
                                  'El sifón no puede recibir flujo.',
                                );
                                return;
                              }
                              if (
                                (accessoryVal === 'llaveTerminal' ||
                                  accessoryVal === 'teeLlaveTerminal') &&
                                isStart
                              ) {
                                engineRef.current.triggerAlert(
                                  'Revisar ubicación llave terminal',
                                  'La llave terminal debe recibir el flujo.',
                                );
                                return;
                              }
                              const oldVal = ramalEl[fieldAcc] || '';
                              const updates: Record<string, unknown> = { [fieldAcc]: val };
                              // El accesorio hereda el diámetro del ramal como valor por defecto:
                              // si el ramal ya tiene diámetro asignado, el accesorio nuevo nace
                              // con ese mismo diámetro (resuelto al valor canónico del selector);
                              // si no, queda "Ninguno".
                              if (val && !oldVal) {
                                const aMatShort =
                                  ramalEl.material || (ramalEl.net === 'san' ? 'PVC' : '');
                                const aDiamList =
                                  (ramalEl.net === 'san' && DIAM_BY_MAT['PVC']) ||
                                  DIAM_BY_MAT[aMatShort] ||
                                  [];
                                updates[fieldDiam] = matchDiamOption(aDiamList, ramalEl.diametro);
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
                                  fieldAcc,
                                  oldVal,
                                  val,
                                  planosCtx.plans,
                                );
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
                          const matShort = ramalEl.material || (ramalEl.net === 'san' ? 'PVC' : '');
                          const diamList =
                            (ramalEl.net === 'san' && DIAM_BY_MAT['PVC']) ||
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
                                  const idx = d.n.indexOf(' — ');
                                  const lbl = idx > 0 ? d.n.slice(0, idx) : d.n;
                                  return (
                                    <option key={d.n} value={d.n}>
                                      {lbl}
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

export function BajanteCodeEditor({
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
                    const cur = ramalEl.diametro ? ramalEl.diametro.split(' — ')[0].trim() : '';
                    if (cur && !nd.some((d) => d.n.split(' — ')[0].trim() === cur)) {
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
        <div style={MENU_SECTION_LABEL_STYLE}>Diámetro de ramal</div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={ramalEl.diametro ? ramalEl.diametro.split(' — ')[0].trim() : ''}
            aria-label="Diámetro de ramal"
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
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
                // Propagar a cualquier ramal aguas abajo auto-creado por una fusión de división
                // en tee DESDE este — mergesFrom guarda los ids de los padres [aguas arriba,
                // entrante] en el momento de la división (PlanoEngineDrawing.ts), y el diametro
                // de ese hijo solo se calculó una vez, al crearlo. Sin esto, cambiar el
                // diámetro de un padre después nunca llega al ramal fusionado/auto-creado ya
                // existente. Aplica a todas las redes: el hijo siempre sigue al mayor (max).
                const eng = engineRef.current;
                for (const child of eng.ramales) {
                  if (!child.mergesFrom || !child.mergesFrom.includes(ramalEl.id)) continue;
                  const [pid1, pid2] = child.mergesFrom;
                  const d1 =
                    pid1 === ramalEl.id
                      ? val
                      : eng.ramales.find((r) => r.id === pid1)?.diametro || '';
                  const d2 =
                    pid2 === ramalEl.id
                      ? val
                      : eng.ramales.find((r) => r.id === pid2)?.diametro || '';
                  const newChildDiam = maxDiametroLabel(d1, d2);
                  if (newChildDiam && newChildDiam !== child.diametro) {
                    eng.updateElementById(child.id, {
                      diametro: newChildDiam,
                      diametroInicio: newChildDiam,
                      diametroFin: newChildDiam,
                    });
                  }
                }
                eng.render();
              }
            }}
            style={MENU_SELECT_STYLE}
          >
            <option value="">— Sin diámetro —</option>
            {diamList.map((d) => {
              const valClean = d.n.split(' — ')[0].trim();
              return (
                <option key={d.n} value={valClean}>
                  {normalizeDnLabel(valClean)}
                </option>
              );
            })}
          </select>
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

export function BajanteMenu() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState, element } = ctx;
  const bajEl = element as PlanoBajante;
  const isGhostClick = contextMenuState.isGhostClick || false;
  const isSanOrLl = !isGhostClick && ['san', 'll'].includes(ctx.activeNet);

  return (
    <>
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
