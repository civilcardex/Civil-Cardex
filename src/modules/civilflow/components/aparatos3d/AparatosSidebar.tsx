import { useState } from 'react';
import { COMPONENTS, COMP_DESC, NOTA_NORMATIVA } from './aparatos3dData';

// Sidebar izquierdo del original (370px): panel descriptivo del aparato seleccionado, header
// colapsable "APARATOS" con el listado (tooltip de norma al hover) y la nota normativa fija
// abajo. Transcripciones literales de aparatos3dData.ts.

const MONO = "'Geist', monospace";

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

/** Parte del body anterior al primer ":" — se pinta en color aparato (regla del original). */
function tituloDe(body: string): string {
  return body.split(':')[0] || '';
}

export default function AparatosSidebar({ selectedId, onSelect }: Props): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const selDesc = selectedId != null ? COMP_DESC[selectedId] : undefined;
  const selComp = selectedId != null ? COMPONENTS.find((c) => c.id === selectedId) : undefined;

  return (
    <div
      style={{
        width: 370,
        flexShrink: 0,
        background: '#161b22',
        borderRight: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: MONO,
        zIndex: 10,
      }}
    >
      {/* Panel descriptivo */}
      {selectedId != null && selDesc && selComp && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: '0.60rem',
            lineHeight: 1.6,
            color: '#7d8590',
            borderBottom: '2px solid #1f6feb',
            background: 'rgba(31,111,235,.06)',
            overflowY: 'auto',
            flexShrink: 0,
            maxHeight: 220,
          }}
        >
          <div style={{ fontSize: '0.63rem', fontWeight: 600, color: '#388bfd', marginBottom: 4 }}>
            {selComp.id} — {selComp.name}
          </div>
          <div style={{ color: '#c9d1d9' }}>
            <span style={{ color: '#BF4E14', fontWeight: 600 }}>{tituloDe(selDesc.body)}</span>
            {selDesc.body.slice(tituloDe(selDesc.body).length)}
          </div>
          <div style={{ marginTop: 4, color: '#555555', fontSize: '0.57rem' }}>
            <span style={{ fontWeight: 600 }}>Referencia normativa: </span>
            {selDesc.norm}
          </div>
        </div>
      )}

      {/* Header colapsable (el original lo llamaba sin definirlo — aquí sí funciona) */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #30363d',
          fontSize: '0.62rem',
          fontWeight: 600,
          color: '#388bfd',
          letterSpacing: '.05em',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          textAlign: 'left',
          fontFamily: MONO,
          userSelect: 'none',
          transition: 'background .12s',
        }}
      >
        <span>APARATOS</span>
        <span
          style={{
            fontSize: '0.70rem',
            transform: collapsed ? 'rotate(-90deg)' : 'none',
            transition: 'transform .2s',
            display: 'inline-block',
          }}
        >
          ▼
        </span>
      </button>

      {/* Listado */}
      {!collapsed && (
        <div style={{ overflowY: 'auto', flexShrink: 0 }}>
          {COMPONENTS.map((c, i) => {
            const active = selectedId === c.id;
            return (
              <div
                key={c.id}
                role="option"
                aria-selected={active}
                tabIndex={0}
                onClick={() => onSelect(active ? null : c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(active ? null : c.id);
                  }
                }}
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    text: COMP_DESC[c.id]?.norm || '',
                    x: r.right + 8,
                    y: r.top + r.height / 2 - 10,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: active ? '7px 10px' : '7px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(48,54,61,.4)',
                  borderLeft: active ? '2px solid #1f6feb' : '2px solid transparent',
                  background: active ? 'rgba(31,111,235,.18)' : 'transparent',
                  fontSize: '0.62rem',
                  lineHeight: 1.4,
                  color: '#e6edf3',
                  outline: 'none',
                }}
              >
                <span style={{ fontSize: '0.58rem', color: '#7d8590', width: 16, flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: c.color,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Nota normativa */}
      <div
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          flexShrink: 0,
          color: '#c9d1d9',
          background: 'rgba(13,17,23,0.97)',
          borderTop: '2px solid #1f6feb',
          fontSize: '0.60rem',
          padding: '8px 12px',
          letterSpacing: '.01em',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: '#BF4E14' }}>Nota normativa:</strong>{' '}
        {NOTA_NORMATIVA.replace(/^⚠ Nota normativa:\s*/, '')}
      </div>

      {/* Tooltip de norma */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            display: 'block',
            background: '#0d1117',
            border: '1px solid #1f6feb',
            color: '#388bfd',
            fontSize: '0.57rem',
            padding: '4px 8px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 9999,
            left: tooltip.x,
            top: tooltip.y,
            fontFamily: MONO,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
