import React from 'react';
import { writeBajantePropToDrawing } from '../../utils/writeDiameterToDrawing';
import {
  writeCrossFloorGhost,
  removeCrossFloorGhost,
  type CrossFloorGhost,
} from '../../utils/associateBajanteAcrossFloors';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { PlanoBajante, PlanoElement } from '../../lib/PlanoEngine/PlanoState';
import type { PlanItem } from '../../context/PlansContext';
import type { LowerFloorRamales } from './DrawingElementContextMenu';
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

  const clearGhostFor = (destino: string | null) => {
    if (!destino || !engineRef.current) return;
    const [prevPlanId] = destino.split('|');
    if (prevPlanId)
      removeCrossFloorGhost(prevPlanId, String(engineRef.current.planId ?? ''), selElement.id);
  };

  const associate = (v: string | null) => {
    if (!engineRef.current) return;
    const prevV = selElement.descargaEnId;
    clearGhostFor(prevV ?? null);

    engineRef.current.updateSelected({ descargaEnId: v });
    setSelElement({ ...selElement, descargaEnId: v });
    const sourcePlanId = String(engineRef.current.planId ?? '');
    const bKey = `${selElement.id}-${sourcePlanId}`;
    writeBajantePropToDrawing(bKey, selElement.net || 'san', 'descargaEnId', v, planosCtx.plans);

    if (!v) return;
    const [targetPlanId, targetBajanteId] = v.split('|');
    const targetGroup = lowerFloorsRamales.find((g) => String(g.planId) === targetPlanId);
    const targetBaj = targetGroup?.bajantes.find((b) => b.id === targetBajanteId);
    if (!targetBaj || targetBaj.x == null || targetBaj.y == null) return;
    const samePos =
      Math.abs(targetBaj.x - selElement.x) < 0.5 && Math.abs(targetBaj.y - selElement.y) < 0.5;
    if (samePos) return;

    triggerConfirm(
      'Crear fantasma de asociación',
      `${selElement.code || selElement.id} y ${targetBaj.code || targetBajanteId} no están alineados. Se creará un bajante fantasma en el piso de ${targetBaj.code || targetBajanteId}, en la posición de ${selElement.code || selElement.id}. ¿Continuar?`,
      () => {
        const eng = engineRef.current;
        if (!eng) return;
        const curNpt = Number(eng.nivelActual?.npt ?? 0);
        const targetNpt = Number(targetGroup?.npt ?? 0);
        const targetIsBelow = targetNpt < curNpt;
        const sourceDireccion: 'sube' | 'baja' = targetIsBelow ? 'baja' : 'sube';
        const ghostDireccion: 'sube' | 'baja' = targetIsBelow ? 'sube' : 'baja';

        const ghost: CrossFloorGhost = {
          id: `XFG_${selElement.id}_${sourcePlanId}`,
          net: selElement.net || 'san',
          code: selElement.code || selElement.id,
          x: selElement.x,
          y: selElement.y,
          dNominal: selElement.dNominal || '',
          direccion: ghostDireccion,
          sourcePlanId,
          sourceBajanteId: selElement.id,
        };
        writeCrossFloorGhost(targetPlanId, ghost);

        eng.updateSelected({ direccion: sourceDireccion });
        setSelElement({ ...selElement, descargaEnId: v, direccion: sourceDireccion });
        writeBajantePropToDrawing(
          bKey,
          selElement.net || 'san',
          'direccion',
          sourceDireccion,
          planosCtx.plans,
        );
      },
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
      </div>
    </div>
  );
}
