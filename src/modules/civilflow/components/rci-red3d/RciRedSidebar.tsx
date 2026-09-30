import { COMPONENTS, COMP_DESC, NOTA_NORMATIVA, RCI_MONO } from './rciRedDataHelpers';

// Sidebar izquierdo del visor "Red contra incendio" — clon de RciSidebar con los 14
// componentes de la RED (port del HTML). Mismo patrón: desplegable + descripción + nota.

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

function nombreLegible(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export default function RciRedSidebar({ selectedId, onSelect }: Props): React.JSX.Element {
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
        overflowY: 'auto',
        fontFamily: RCI_MONO,
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderBottom: '1px solid #30363d',
        }}
      >
        <label
          htmlFor="rci-red-componente-select"
          style={{ fontSize: '0.78rem', fontWeight: 600, color: '#388bfd', whiteSpace: 'nowrap' }}
        >
          Componente:
        </label>
        <select
          id="rci-red-componente-select"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value === '' ? null : Number(e.target.value))}
          style={{
            flex: 1,
            fontSize: '0.78rem',
            fontFamily: RCI_MONO,
            color: '#e6edf3',
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: 4,
            padding: '5px 8px',
            cursor: 'pointer',
          }}
        >
          <option value="">— Ninguno —</option>
          {COMPONENTS.map((c) => (
            <option key={c.id} value={c.id}>
              {nombreLegible(c.name)}
            </option>
          ))}
        </select>
      </div>

      {selectedId != null && selDesc && selComp && (
        <div
          style={{
            padding: '10px 12px',
            fontSize: '0.75rem',
            lineHeight: 1.65,
            color: '#7d8590',
            borderBottom: '2px solid #1f6feb',
            background: 'rgba(31,111,235,.06)',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#388bfd',
              marginBottom: 4,
              lineHeight: 1.4,
            }}
          >
            {selComp.id} - {nombreLegible(selComp.name)}
          </div>
          <div style={{ color: '#c9d1d9' }}>{selDesc.body}</div>
          <div style={{ marginTop: 6, color: '#8b949e', fontSize: '0.70rem' }}>
            <span style={{ fontWeight: 600 }}>Referencia normativa: </span>
            {selDesc.norm}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 'auto',
          flexShrink: 0,
          color: '#c9d1d9',
          background: 'rgba(13,17,23,0.97)',
          borderTop: '2px solid #1f6feb',
          fontSize: '0.72rem',
          padding: '10px 12px',
          letterSpacing: '.01em',
          lineHeight: 1.65,
        }}
      >
        <strong style={{ color: '#BF4E14' }}>Nota de diseño:</strong> {NOTA_NORMATIVA}
      </div>
    </div>
  );
}
