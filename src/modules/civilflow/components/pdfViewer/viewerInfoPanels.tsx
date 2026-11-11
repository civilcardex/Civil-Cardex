/**
 * Paneles de información de escala del visor: la etiqueta "1:N" de la barra de redes y la
 * tarjeta del plano asociado al piso (nombre + escala calibrada). Solo presentación — los
 * datos llegan por props. Extraído verbatim de PdfViewer.
 * Ej: piso con lámina calibrada 1:200 muestra "1:200" aunque scaleM valga 0.5.
 */
import { useMemo } from 'react';
import type { PlanItem } from '../../context/PlansContext.tsx';

/** Etiqueta de escala: la de la lámina calibrada del piso manda; si no, el map de scaleM. */
export function ScaleText({
  selectedNivel,
  planos,
  scaleM,
}: {
  selectedNivel: number | null;
  planos: PlanItem[];
  scaleM: string;
}): React.ReactElement {
  return useMemo(() => {
    const planoAsoc = planos.find((p) => p.nivel === selectedNivel && p.status === 'confirmed');
    if (planoAsoc && planoAsoc.scale) return <span>1:{Math.round(planoAsoc.scale)}</span>;
    const map: Record<string, string> = {
      '0.5': '1:50',
      '0.75': '1:75',
      '1.0': '1:100',
      '1.25': '1:125',
      '2.0': '1:200',
    };
    return <span>{map[scaleM] || '1:100'}</span>;
  }, [selectedNivel, planos, scaleM]);
}

/** Tarjeta "📄 nombre · Escala 1:N" del plano confirmado asociado al piso; null sin piso. */
export function PlanoAsocInfo({
  selectedNivel,
  planos,
}: {
  selectedNivel: number | null;
  planos: PlanItem[];
}): React.ReactElement | null {
  return useMemo(() => {
    if (selectedNivel === null) return null;
    const planoAsoc = planos.find((p) => p.nivel === selectedNivel && p.status === 'confirmed');
    if (!planoAsoc) return null;
    return (
      <div
        style={{
          marginTop: 8,
          padding: '6px 10px',
          background: '#1e2024',
          borderRadius: 3,
          border: '1px solid rgba(0,220,229,.2)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: '#00dce5',
            fontFamily: "'Geist',monospace",
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          📄 {planoAsoc.name}
        </div>
        <div
          style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", marginTop: 2 }}
        >
          Escala 1:{Math.round(planoAsoc.scale)}
        </div>
      </div>
    );
  }, [selectedNivel, planos]);
}
