import React from 'react';
import { writeBajantePropToDrawing } from '../../utils/writeDiameterToDrawing';
import {
  applyBajanteAssociation,
  clearBajanteAssociation,
  areEndpointsAligned,
  type AssocEndpoint,
} from '../../utils/bajanteAssociation';
import { pisoCorto, buildBajanteVisualLabel } from '../../constants';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { PlanoBajante, PlanoElement } from '../../lib/PlanoEngine/PlanoState';
import type { PlanItem } from '../../context/PlansContext';
import type { LowerFloorRamales } from './drawingElementContextMenu/context';
const BajanteAsociacion_S1: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
  boxSizing: 'border-box',
};

interface BajanteAsociacionProps {
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  selectedNivel: number | null;
  pisoLbl: (n: number) => string;
  lowerFloorsRamales: LowerFloorRamales[];
  upperFloorGroup: LowerFloorRamales | null;
  planosCtx: { plans: PlanItem[] };
  engineRef: React.RefObject<PlanoEngine | null>;
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => void;
}

export default function BajanteAsociacion({
  selElement: rawSelElement,
  setSelElement,
  selectedNivel,
  pisoLbl,
  lowerFloorsRamales,
  upperFloorGroup,
  planosCtx,
  engineRef,
  triggerConfirm,
}: BajanteAsociacionProps) {
  if (
    !(
      rawSelElement &&
      ((rawSelElement as { tipo?: string }).tipo === 'bajante' ||
        (rawSelElement as { tipo?: string }).tipo === 'montante') &&
      !engineRef.current?._isGhostSel
    )
  ) {
    return null;
  }
  const selElement = rawSelElement as PlanoBajante;

  const currentPlanId = String(engineRef.current?._loadedPlanId ?? '');
  const currentEndpoint = (): AssocEndpoint => ({
    planId: currentPlanId,
    id: selElement.id,
    x: selElement.x,
    y: selElement.y,
    net: selElement.net || 'san',
    dNominal: selElement.dNominal || '',
    code: selElement.code || selElement.id,
    nivelN: selectedNivel ?? 0,
    npt: Number(engineRef.current?.nivelActual?.npt ?? 0),
  });

  const associate = (v: string | null) => {
    if (!engineRef.current) return;
    const eng = engineRef.current;
    const prevV = selElement.descargaEnId;

    if (!v) {
      if (prevV)
        clearBajanteAssociation(
          eng,
          currentPlanId,
          selElement.id,
          selElement.net || 'san',
          prevV,
          planosCtx.plans,
        );
      eng.updateElementById(selElement.id, { descargaEnId: null });
      setSelElement({ ...selElement, descargaEnId: null });
      writeBajantePropToDrawing(
        `${selElement.id}-${currentPlanId}`,
        selElement.net || 'san',
        'descargaEnId',
        null,
        planosCtx.plans,
      );
      eng.render();
      return;
    }

    const [targetPlanId, targetBajanteId] = v.split('|');
    const targetGroup = lowerFloorsRamales.find((g) => String(g.planId) === targetPlanId);
    const targetBaj = targetGroup?.bajantes.find((b) => b.id === targetBajanteId);
    if (!targetBaj || targetBaj.x == null || targetBaj.y == null) return;
    const targetPlan = planosCtx.plans.find((pl) => String(pl.id) === targetPlanId);
    const source = currentEndpoint();
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
          selElement.id,
          selElement.net || 'san',
          prevV,
          planosCtx.plans,
        );
      applyBajanteAssociation(eng, source, target, planosCtx.plans);
      setSelElement({
        ...selElement,
        descargaEnId: v,
        direccion: target.npt < source.npt ? 'baja' : 'sube',
      });
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
  };

  // Espejo de associate() de arriba, pero para el selector "Origen" del piso inmediato superior:
  // desde el punto de vista del modelo compartido de asociación es la misma operación con
  // source/target intercambiados: el bajante ORIGEN (piso superior) pasa a ser la fuente (se le
  // asigna su descargaEnId) y el bajante seleccionado pasa a ser el destino (recibe el puntero
  // inverso origenId).
  const associateOrigin = (v: string | null) => {
    if (!engineRef.current) return;
    const eng = engineRef.current;
    const target = currentEndpoint();
    const prevOrigen = selElement.origenId;

    if (!v) {
      if (prevOrigen) {
        const [prevPlanId, prevBajId] = prevOrigen.split('|');
        if (prevPlanId && prevBajId)
          clearBajanteAssociation(
            eng,
            prevPlanId,
            prevBajId,
            selElement.net || 'san',
            `${currentPlanId}|${selElement.id}`,
            planosCtx.plans,
          );
      }
      eng.updateElementById(selElement.id, { origenId: null });
      setSelElement({ ...selElement, origenId: null });
      writeBajantePropToDrawing(
        `${selElement.id}-${currentPlanId}`,
        selElement.net || 'san',
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
      // Antes se retornaba en silencio: el desplegable parecía aceptar la selección (origenId se
      // escribía igualmente arriba) pero nunca aparecía el fantasma/Ldesvio, sin ningún indicio
      // de que algo fallara. Ahora se muestra el error en lugar de fallar de forma invisible.
      engineRef.current.triggerAlert(
        'No se pudo asociar',
        `No se encontró el bajante de origen (${originBajanteId}) en el piso superior. Intenta reabrir el panel o recargar el piso.`,
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
            selElement.net || 'san',
            `${currentPlanId}|${selElement.id}`,
            planosCtx.plans,
          );
      }
      applyBajanteAssociation(eng, source, target, planosCtx.plans);
      setSelElement({ ...selElement, origenId: v });
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
    <div
      style={{
        padding: '10px 12px 8px',
        borderBottom: '1px solid #3a494a',
        opacity: 1,
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          fontFamily: "'Geist',monospace",
          fontSize: 12,
          color: '#849495',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Asociación de bajante
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              color: '#6b8cae',
              fontFamily: "'Geist',monospace",
              marginBottom: 2,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Origen (piso actual)
          </div>
          <div
            style={{
              padding: '4px 6px',
              background: '#1e2024',
              border: '1px solid #3a494a',
              borderRadius: 3,
              color: '#6b8cae',
              fontSize: 12,
              fontFamily: "'Geist',monospace",
            }}
          >
            {selectedNivel !== null ? pisoLbl(selectedNivel) : '—'}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              color: '#6b8cae',
              fontFamily: "'Geist',monospace",
              marginBottom: 2,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Destino
          </div>
          <div style={{ position: 'relative', width: '100%' }}>
            <select
              aria-label="Seleccionar destino de descarga"
              value={selElement.descargaEnId || ''}
              onChange={(e) => associate(e.target.value || null)}
              style={{
                ...BajanteAsociacion_S1,
                paddingRight: selElement.descargaEnId ? 26 : undefined,
              }}
            >
              <option value="">Sin destino</option>
              {lowerFloorsRamales.map((group) => {
                const plano = planosCtx.plans.find(
                  (pl) => (pl.id as unknown as string) === group.planId,
                );
                const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
                const bajantesToShow = group.isCurrent
                  ? (group.bajantes || []).filter((b) => b.id !== selElement.id)
                  : group.bajantes || [];
                const hasBajantes = bajantesToShow.length > 0;
                return (
                  <optgroup key={group.planId} label={pLabel}>
                    {hasBajantes &&
                      bajantesToShow.map((b) => (
                        <option key={`${group.planId}|${b.id}`} value={`${group.planId}|${b.id}`}>
                          Bajante: {b.code || b.id}
                        </option>
                      ))}
                    {!hasBajantes && (
                      <option value="" disabled>
                        — Sin elementos disponibles —
                      </option>
                    )}
                  </optgroup>
                );
              })}
            </select>
            {selElement.descargaEnId && (
              <button
                type="button"
                aria-label="Quitar asociación"
                onClick={() => associate(null)}
                style={{
                  position: 'absolute',
                  right: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '1px 5px',
                  background: '#1e2024',
                  border: '1px solid var(--line)',
                  borderRadius: 2,
                  color: 'var(--txt3)',
                  cursor: 'pointer',
                  fontSize: 11,
                  lineHeight: 1.2,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {upperFloorGroup && (
          <div>
            <div
              style={{
                fontSize: 12,
                color: '#6b8cae',
                fontFamily: "'Geist',monospace",
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Origen (piso superior)
            </div>
            <div style={{ position: 'relative', width: '100%' }}>
              <select
                aria-label="Seleccionar origen de descarga"
                value={selElement.origenId || ''}
                onChange={(e) => associateOrigin(e.target.value || null)}
                style={{
                  ...BajanteAsociacion_S1,
                  paddingRight: selElement.origenId ? 26 : undefined,
                }}
              >
                <option value="">Sin origen</option>
                {(() => {
                  const plano = planosCtx.plans.find(
                    (pl) => (pl.id as unknown as string) === upperFloorGroup.planId,
                  );
                  const pLabel =
                    plano?.nivel != null ? pisoLbl(plano.nivel) : upperFloorGroup.planName;
                  const bajantesToShow = upperFloorGroup.bajantes || [];
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
                          — Sin elementos disponibles —
                        </option>
                      )}
                    </optgroup>
                  );
                })()}
              </select>
              {selElement.origenId && (
                <button
                  type="button"
                  aria-label="Quitar origen"
                  onClick={() => associateOrigin(null)}
                  style={{
                    position: 'absolute',
                    right: 4,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '1px 5px',
                    background: '#1e2024',
                    border: '1px solid var(--line)',
                    borderRadius: 2,
                    color: 'var(--txt3)',
                    cursor: 'pointer',
                    fontSize: 11,
                    lineHeight: 1.2,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
