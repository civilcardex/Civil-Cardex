/**
 * Sección "Origen (piso superior)" del menú del bajante: conecta este bajante con el que continúa
 * en el piso de arriba (asociación entrepisos). Si no están alineados, ofrece crear el fantasma
 * y el ramal de desvío. La lista de candidatos se relee del storage del piso superior en vivo.
 * Ej: BAN1 piso 2 con origen BAN1 piso 3 — el agua baja de la montante del piso de arriba.
 */
import { useState, useEffect } from 'react';
import { pisoLbl, pisoCorto, buildBajanteVisualLabel, compararPorCodigo } from '../../../../constants';
import { loadFromStorage } from '../../../../services/storageService.ts';
import { TRAZOS_PREFIX } from '../../../../constants/storage-keys.ts';
import { writeBajantePropToDrawing } from '../../../../utils/writeDiameterToDrawing.ts';
import {
  applyBajanteAssociation,
  clearBajanteAssociation,
  areEndpointsAligned,
  type AssocEndpoint,
} from '../../../../utils/bajanteAssociation';
import { splitPtr } from '../../../../utils/keys.ts';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type PlanoEngine from '../../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoBajante, PlanoElement } from '../../../../lib/PlanoEngine/PlanoState.ts';
import type { PlanItem } from '../../../../context/PlansContext.tsx';
import {
  MENU_SELECT_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
  type ContextMenuState,
  type LowerFloorRamales,
} from '../context.ts';

/** Bloque "Origen (piso superior)": asociar/desasociar el bajante con el del piso inmediatamente superior. */
export function OriginSection({
  element,
  selectedNivel,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  planosCtx,
  upperFloorGroup,
  triggerConfirm,
}: {
  element: PlanoBajante;
  selectedNivel: number | null;
  engineRef: MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: Dispatch<SetStateAction<ContextMenuState | null>>;
  planosCtx: { plans: PlanItem[] };
  upperFloorGroup: LowerFloorRamales;
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => void;
}) {
  // Sincronización en tiempo real del desplegable "Origen (piso superior)": `upperFloorGroup`
  // es estado de PdfViewer que solo vuelve a leer su piso objetivo cuando cambia la SELECCIÓN —
  // una asociación creada o eliminada aquí (o desde el panel BajanteAssociation, o desde el menú
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

  // Espejo del onChange de "Destino" (más abajo) pero para el selector "Origen" del piso
  // inmediatamente superior - misma lógica que associateOrigin en BajanteAssociation.tsx,
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
        const [prevPlanId, prevBajId] = splitPtr(prevOrigen, '');
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

    const [originPlanId, originBajanteId] = splitPtr(v, '');
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
        const [prevPlanId, prevBajId] = splitPtr(prevOrigen, '');
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
          const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : upperFloorGroup.planName;
          const bajantesToShow = (freshUpperBajantes ?? (upperFloorGroup.bajantes || []))
            .slice()
            .sort((a, b) => compararPorCodigo(a, b));
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
  );
}
