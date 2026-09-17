import { COMPONENTES, COMP_DESC } from './epc3dData';

// Sidebar izquierdo del visor 3D del EPC — mismo patrón que AparatosSidebar (orig. usuario):
// desplegable "Componente:" arriba, descripción debajo y nota normativa fija abajo.
// Fuente Geist igual que la isometría de aparatos.

const MONO = "'Geist', monospace";

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

/** Texto descriptivo SIN el prefijo hasta el primer ":" (igual que aparatos). */
function cuerpoDe(body: string): string {
  const sinTitulo = body.slice(body.indexOf(':') + 1).trim();
  return sinTitulo.charAt(0).toUpperCase() + sinTitulo.slice(1);
}

export default function EpcSidebar({ selectedId, onSelect }: Props): React.JSX.Element {
  const desc = selectedId != null ? COMP_DESC[String(selectedId)] : undefined;
  const comp = selectedId != null ? COMPONENTES.find((c) => c.id === selectedId) : undefined;

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
      {/* Desplegable de componente (igual posición/estilo que el de aparatos) */}
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
          htmlFor="epc-select"
          style={{ fontSize: '0.78rem', fontWeight: 600, color: '#388bfd', whiteSpace: 'nowrap' }}
        >
          Componente:
        </label>
        <select
          id="epc-select"
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
          {COMPONENTES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Descripción del componente seleccionado, debajo del desplegable */}
      {selectedId != null && desc && comp && (
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
          <div style={{ color: '#c9d1d9' }}>{cuerpoDe(desc.body)}</div>
          {desc.norm && (
            <div style={{ marginTop: 6, color: '#8b949e', fontSize: '0.70rem' }}>
              <span style={{ fontWeight: 600 }}>Referencia normativa: </span>
              {desc.norm}
            </div>
          )}
        </div>
      )}

      {/* Nota normativa — misma posición que en aparatos (última caja fija del sidebar) */}
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
        <p style={{ margin: 0 }}>
          <strong style={{ color: '#BF4E14' }}>⚠ Nota: </strong>
          El presente detalle es una representación técnica de referencia elaborada con base en las
          normas{' '}
          <a
            href="https://www.minvivienda.gov.co"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#58a6ff' }}
          >
            RAS 2000
          </a>{' '}
          /{' '}
          <a
            href="https://www.icontec.org"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#58a6ff' }}
          >
            NTC 1500
          </a>{' '}
          y{' '}
          <a
            href="https://www.minenergia.gov.co"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#58a6ff' }}
          >
            RETIE / NTC 1500
          </a>{' '}
          vigentes a la fecha de publicación. Los criterios de diseño, dimensionamiento hidráulico,
          selección y ubicación de los equipos deben ser verificados y ajustados por un ingeniero
          competente conforme a las ediciones vigentes de cada norma en el momento de la ejecución
          del proyecto, así como a los catálogos de los respectivos fabricantes. CIVILCARDEX no
          asume responsabilidad por aplicaciones que no hayan sido validadas por el profesional
          responsable de la obra. Se deben aplicar normas y criterios de cada país.
        </p>
        <p style={{ margin: '8px 0 0' }}>
          <strong style={{ color: '#BF4E14' }}>🔥 Nota: </strong>
          Si el equipo no corresponde a abastecimiento hidrosanitario convencional sino a un sistema
          de protección contra incendios, deben aplicarse los requisitos específicos del sistema y
          las normas del proyecto, incluyendo NFPA 20 cuando corresponda.
        </p>
      </div>
    </div>
  );
}
