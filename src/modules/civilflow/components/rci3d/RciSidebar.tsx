import { COMPONENTS, COMP_DESC, RCI_MONO } from './rci3dData';
import { NormaLink } from '../shared/normasLinks';

// Sidebar izquierdo del visor 3D RCI — mismo patrón que AparatosSidebar (orig. usuario):
// desplegable "Componente:" arriba, descripción del seleccionado debajo y nota normativa fija
// abajo-izquierda. Geist + mismos tamaños/colores.
// Links de la nota: cada norma a SU fuente oficial via NORMA_URLS (verificados 2026-09-30).
// La lista colectiva «NFPA 20/13/14/22/25/72» queda plana (familia, sin objetivo único).

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

/** Nota de diseño normativa con links — compartida por RciSidebar y RciRedSidebar (mismo
 *  texto/links; ambos visores RCI). */
export function NotaDisenoRci() {
  return (
    <>
      <strong style={{ color: '#BF4E14' }}>Nota de diseño:</strong> El presente detalle es una
      representación técnica de referencia elaborada con base en las normas{' '}
      <NormaLink nombre="NFPA 20">NFPA 20:2025</NormaLink> y{' '}
      <NormaLink nombre="NSR-10">NSR-10 Título J</NormaLink> (Colombia). Las descripciones provienen
      de la revisión de la base normativa internacional (NFPA 20/13/14/22/25/72 con sus numerales) y
      de su adaptación nacional (
      <NormaLink nombre="NTC 1669" />, <NormaLink nombre="NTC 2301" />,{' '}
      <NormaLink nombre="NTC 2050" />, <NormaLink nombre="RETIE" />,{' '}
      <NormaLink nombre="Decreto 0926/2010" />
      ). Es responsabilidad del diseñador revisar y hacer los ajustes según la respectiva norma
      vigente. El presente esquema y sus descripciones NO sustituyen las normas oficiales; su
      propósito es servir de guía para robustecer las descripciones del visor CIVILCARDEX.
    </>
  );
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
        fontFamily: RCI_MONO,
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
        <NotaDisenoRci />
      </div>
    </div>
  );
}
