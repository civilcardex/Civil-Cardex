import { COMPONENTS, COMP_DESC, NOTA_NORMATIVA } from './aparatos3dData';
import { MONO_3D } from '../shared/config3d';

// Sidebar izquierdo del visor 3D de aparatos (orig. usuario): desplegable "Aparato:" arriba,
// descripción del seleccionado debajo y nota normativa fija abajo. Sin listado (el desplegable
// es el único selector). Texto agrandado (orig. usuario).

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

/** Texto descriptivo SIN el nombre del aparato (todo hasta el primer ":") y con mayúscula
 *  inicial (orig. usuario). */
function cuerpoDe(body: string): string {
  const sinTitulo = body.slice(body.indexOf(':') + 1).trim();
  return sinTitulo.charAt(0).toUpperCase() + sinTitulo.slice(1);
}

export default function AparatosSidebar({ selectedId, onSelect }: Props): React.JSX.Element {
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
        fontFamily: MONO_3D,
        zIndex: 10,
      }}
    >
      {/* Desplegable de aparato (orig. usuario): etiqueta a la izquierda + select arriba */}
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
          htmlFor="aparato-select"
          style={{ fontSize: '0.78rem', fontWeight: 600, color: '#388bfd', whiteSpace: 'nowrap' }}
        >
          Aparato:
        </label>
        <select
          id="aparato-select"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value === '' ? null : Number(e.target.value))}
          style={{
            flex: 1,
            fontSize: '0.78rem',
            fontFamily: MONO_3D,
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
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Descripción del aparato seleccionado, debajo del desplegable */}
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
          <div style={{ color: '#c9d1d9' }}>{cuerpoDe(selDesc.body)}</div>
          <div style={{ marginTop: 6, color: '#8b949e', fontSize: '0.70rem' }}>
            <span style={{ fontWeight: 600 }}>Referencia normativa: </span>
            {selDesc.norm}
          </div>
        </div>
      )}

      {/* Nota normativa — inmediatamente debajo de la descripción (orig. usuario): sin
          espaciador flex, el sidebar entero scrollea si no cabe. */}
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
        <strong style={{ color: '#BF4E14' }}>Nota normativa:</strong>{' '}
        {NOTA_NORMATIVA.replace(/^⚠ Nota normativa:\s*/, '')}
      </div>
    </div>
  );
}
