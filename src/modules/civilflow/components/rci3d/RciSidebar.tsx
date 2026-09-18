import { COMPONENTS, COMP_DESC, NOTA_NORMATIVA } from './rci3dData';

// Sidebar izquierdo del visor 3D RCI — mismo patrón que AparatosSidebar (orig. usuario):
// desplegable "Componente:" arriba, descripción del seleccionado debajo y nota normativa fija
// abajo-izquierda. Geist + mismos tamaños/colores.

const MONO = "'Geist', monospace";

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

/** Nombres en castellano correcto (orig. usuario): solo la PRIMERA letra de la PRIMERA
 *  palabra en mayúscula — "Bomba Principal 4x4" → "Bomba principal 4x4". */
function nombreLegible(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export default function RciSidebar({ selectedId, onSelect }: Props): React.JSX.Element {
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
        fontFamily: MONO,
        zIndex: 10,
      }}
    >
      {/* Desplegable de componente (mismo patrón que "Aparato:") */}
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
          htmlFor="rci-componente-select"
          style={{ fontSize: '0.78rem', fontWeight: 600, color: '#388bfd', whiteSpace: 'nowrap' }}
        >
          Componente:
        </label>
        <select
          id="rci-componente-select"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value === '' ? null : Number(e.target.value))}
          style={{
            flex: 1,
            fontSize: '0.78rem',
            fontFamily: MONO,
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

      {/* Descripción del componente seleccionado, debajo del desplegable (posición del HTML:
          título "n - nombre", cuerpo, referencia normativa) */}
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

      {/* Nota normativa — fija abajo-izquierda del sidebar (igual que aparatos) */}
      <div
        style={{
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
