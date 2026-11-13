/**
 * Fila "Llenado (R)" + "Área" del menú del bajante: relación de llenado hidráulica (7/24 o 1/4)
 * y el área servida (m²) que carga el aparato sanitario conectado a este bajante.
 * Ej: BAN1 con llenado 7/24 y área del baño 4.5 m² alimenta el cálculo Hunter de la montante.
 */
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type PlanoEngine from '../../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoBajante, PlanoElement } from '../../../../lib/PlanoEngine/PlanoState.ts';
import { type ContextMenuState } from '../context.ts';

/** Fila de selects "Llenado (R)" y "Área" del bajante. */
export function FillAreaSection({
  element,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
}: {
  element: PlanoBajante;
  engineRef: MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: Dispatch<SetStateAction<ContextMenuState | null>>;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 8px 4px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="dcm-section-label-row">Llenado (R)</div>
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
              setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
            if (selElement?.id === element.id) {
              setSelElement({ ...selElement, bajR: valNum });
            }
          }}
          className="dcm-select"
        >
          <option value="7/24">7/24</option>
          <option value="1/4">1/4</option>
        </select>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="dcm-section-label-row">Área</div>
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
          className="dcm-select"
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
  );
}
