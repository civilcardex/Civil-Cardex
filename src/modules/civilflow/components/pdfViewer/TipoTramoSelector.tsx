import React, { useState } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { ElementItem } from '../../lib/PlanoEngine/PlanoEngine';

const TIPOS_TRAMO = [
  { id: 'ramal', label: 'Ramal' },
  { id: 'tributario', label: 'Tributario' },
];

const TipoTramoSelector_btn: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: '3px',
  cursor: 'pointer',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  alignItems: 'flex-start',
  transition: 'all .12s',
};
const TipoTramoSelector_select: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: '#1a1c20',
  border: '1px solid #3a494a',
  borderRadius: 3,
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
};

interface TipoTramoSelectorProps {
  tipoTramo: string;
  setTipoTramo: (v: string) => void;
  padreTributarioId: string | null;
  setPadreTributarioId: (v: string | null) => void;
  drawnElements: ElementItem[];
  engineRef: React.RefObject<PlanoEngine | null>;
}

export default function TipoTramoSelector({
  tipoTramo,
  setTipoTramo,
  padreTributarioId,
  setPadreTributarioId,
  drawnElements,
  engineRef,
}: TipoTramoSelectorProps) {
  const [padreFilter, setPadreFilter] = useState<'ramal' | 'tributario'>('ramal');
  return (
    <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
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
        ¿Qué voy a dibujar?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TIPOS_TRAMO.map((tp) => (
          <button
            type="button"
            key={tp.id}
            onClick={() => setTipoTramo(tp.id)}
            style={{
              ...TipoTramoSelector_btn,
              background: tipoTramo === tp.id ? '#2563EB22' : '#1e2024',
              border: `1px solid ${tipoTramo === tp.id ? '#2563EB' : '#3a494a'}`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: tipoTramo === tp.id ? '#2563EB' : '#b9caca',
                fontFamily: "'Geist',monospace",
              }}
            >
              {tp.id === 'ramal'
                ? '📏 Ramal principal'
                : tp.id === 'tributario'
                  ? '🔀 Tributario'
                  : tp.label}
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#6b8cae',
                fontFamily: "'Geist',monospace",
                textAlign: 'left',
              }}
            >
              {tp.id === 'ramal'
                ? 'Trazos principales de la red activa'
                : tp.id === 'tributario'
                  ? 'Ramificaciones que conectan al ramal principal'
                  : ''}
            </div>
          </button>
        ))}
      </div>
      {tipoTramo === 'tributario' && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            background: padreTributarioId ? 'rgba(37,99,235,.12)' : '#1e2024',
            border: `1px solid ${padreTributarioId ? '#2563EB' : '#3a494a'}`,
            borderRadius: 3,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: '#849495',
              fontFamily: "'Geist',monospace",
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            Padre (ramal o tributario asignado)
          </div>
          {/* Ítem: filtro ramal/tributario — la lista de padres deja de ser un revoltijo
              de ambos tipos y se muestra solo la clase elegida. */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {(
              [
                { id: 'ramal', label: 'Ramales' },
                { id: 'tributario', label: 'Tributarios' },
              ] as const
            ).map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => setPadreFilter(f.id)}
                aria-pressed={padreFilter === f.id}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  fontSize: 11,
                  fontFamily: "'Geist',monospace",
                  cursor: 'pointer',
                  borderRadius: 3,
                  background: padreFilter === f.id ? '#2563EB22' : '#1e2024',
                  border: `1px solid ${padreFilter === f.id ? '#2563EB' : '#3a494a'}`,
                  color: padreFilter === f.id ? '#2563EB' : '#849495',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            aria-label="Seleccionar ramal padre tributario"
            value={padreTributarioId || ''}
            onChange={(e) => {
              const v = e.target.value || null;
              setPadreTributarioId(v);
              if (engineRef.current) engineRef.current.setPadreTributario(v);
            }}
            style={{
              ...TipoTramoSelector_select,
              color: padreTributarioId ? '#2563EB' : '#6b8cae',
            }}
          >
            <option value="">— Seleccionar ramal o tributario padre —</option>
            {/* Ítem 10: candidatos = TODOS los ramales de la red (principales y tributarios),
                para permitir tributarios anidados. */}
            {(() => {
              // Filtrado por clase elegida; el padre YA asignado se ancla al tope aunque no
              // coincida con el filtro activo (si no, el select perdería su valor visible).
              const filtered = drawnElements.filter(
                (el) => el.type === 'ramal' && el.tipo === padreFilter,
              );
              const ids = new Set(filtered.map((f) => f.id));
              const pinned = drawnElements.find((el) => el.id === padreTributarioId);
              const list = pinned && !ids.has(pinned.id) ? [pinned, ...filtered] : filtered;
              return list.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.label}
                  {el.totalL
                    ? ` · ${typeof el.totalL === 'number' ? el.totalL.toFixed(2) : el.totalL}m`
                    : ''}
                </option>
              ));
            })()}
          </select>
          {drawnElements.filter((el) => el.type === 'ramal' && el.tipo === padreFilter).length ===
            0 && (
            <div
              style={{
                fontSize: 12,
                color: '#ffb4ab',
                fontFamily: "'Geist',monospace",
                marginTop: 6,
                lineHeight: 1.4,
              }}
            >
              {padreFilter === 'ramal'
                ? 'No hay ramales en esta red. Dibuja primero un ramal antes de crear tributarios.'
                : 'No hay tributarios en esta red todavía. Convierte un ramal o crea uno para poder asignarlo como padre anidado.'}
            </div>
          )}
          {padreTributarioId && (
            <div
              style={{
                fontSize: 12,
                color: '#6b8cae',
                fontFamily: "'Geist',monospace",
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              El primer punto se conectará automáticamente al ramal seleccionado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
