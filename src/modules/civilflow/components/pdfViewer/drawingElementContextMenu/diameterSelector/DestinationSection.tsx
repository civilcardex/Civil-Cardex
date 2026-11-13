/**
 * Sección "Destino" del menú del bajante: elige el bajante de un piso inferior al que descarga
 * este (asociación entrepisos); si origen y destino no están alineados ofrece crear el fantasma.
 * Ej: BAN1 (piso 2) con destino BAN1 (piso 1) — la misma bajante continúa en el piso de abajo.
 */
import {
  pisoLbl,
  pisoCorto,
  buildBajanteVisualLabel,
  compararPorCodigo,
} from '../../../../constants';
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
import { type ContextMenuState, type LowerFloorRamales } from '../context.ts';

/** Selector "Destino" (piso inferior): asociar/desasociar la descarga del bajante con otro piso. */
export function DestinationSection({
  element,
  selectedNivel,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  lowerFloorsRamales,
  planosCtx,
  triggerConfirm,
}: {
  element: PlanoBajante;
  selectedNivel: number | null;
  engineRef: MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: Dispatch<SetStateAction<ContextMenuState | null>>;
  lowerFloorsRamales: LowerFloorRamales[];
  planosCtx: { plans: PlanItem[] };
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="dcm-section-label-row">Destino</div>
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
              setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
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
            if (selElement?.id === element.id) setSelElement({ ...selElement, descargaEnId: null });
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

          const [targetPlanId, targetBajanteId] = splitPtr(v, '');
          const targetGroup = lowerFloorsRamales.find((g) => String(g.planId) === targetPlanId);
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
        className="dcm-select"
      >
        <option value="">Sin destino</option>
        {lowerFloorsRamales.map((group) => {
          const plano = planosCtx.plans.find((pl) => (pl.id as unknown as string) === group.planId);
          const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
          // Ascendente por código (orig. usuario) y sin piso tras el guion — el piso
          // ya se ve en el optgroup.
          const bajantesToShow = (
            group.isCurrent
              ? (group.bajantes || []).filter((b) => b.id !== element.id)
              : group.bajantes || []
          )
            .slice()
            .sort((a, b) => compararPorCodigo(a, b));
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
  );
}
