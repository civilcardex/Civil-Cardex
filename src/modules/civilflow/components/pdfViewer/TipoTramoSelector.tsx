import React from 'react';

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

interface TipoTramoSelectorProps {
  tipoTramo: string;
  setTipoTramo: (v: string) => void;
}

export default function TipoTramoSelector({ tipoTramo, setTipoTramo }: TipoTramoSelectorProps) {
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
    </div>
  );
}
