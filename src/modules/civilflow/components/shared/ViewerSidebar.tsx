import type { ReactNode } from 'react';

// Cáscara común de los sidebars izquierdos de los visores 3D (aparatos, EPC, RCI, red RCI):
// desplegable arriba, descripción del seleccionado debajo y nota normativa fija abajo.
// Lo único propio de cada visor es el catálogo, la nota y cómo se muestra cada nombre.

/** Texto descriptivo SIN el prefijo hasta el primer ":" (igual que aparatos). */
export function cuerpoDe(body: string): string {
  const sinTitulo = body.slice(body.indexOf(':') + 1).trim();
  return sinTitulo.charAt(0).toUpperCase() + sinTitulo.slice(1);
}

/** Nombres en castellano correcto (pedido del cliente): solo la PRIMERA letra de la PRIMERA
 *  palabra en mayúscula — "Bomba Principal 4x4" → "Bomba principal 4x4". */
export function nombreLegible(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export interface ViewerSidebarItem {
  id: number;
  name: string;
}

interface Props {
  mono: string;
  selectId: string;
  selectLabel: string;
  items: ViewerSidebarItem[];
  muestraNombre?: (name: string) => string;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  descripcion: ReactNode | null;
  nota: ReactNode;
  notaAlFondo?: boolean;
}

/** Sidebar izquierdo de visor 3D: desplegable + descripción + nota. Ej: con el catálogo de
 *  aparatos y su nota RAS/NTC, pinta el sidebar del detalle de aparatos. */
export default function ViewerSidebar({
  mono,
  selectId,
  selectLabel,
  items,
  muestraNombre,
  selectedId,
  onSelect,
  descripcion,
  nota,
  notaAlFondo,
}: Props): React.JSX.Element {
  const verNombre = muestraNombre ?? ((n: string) => n);
  return (
    <div
      data-tour="iso-viewer-sidebar"
      style={{
        width: 370,
        flexShrink: 0,
        background: '#161b22',
        borderRight: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        fontFamily: mono,
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
          htmlFor={selectId}
          style={{ fontSize: '0.78rem', fontWeight: 600, color: '#388bfd', whiteSpace: 'nowrap' }}
        >
          {selectLabel}
        </label>
        <select
          id={selectId}
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value === '' ? null : Number(e.target.value))}
          style={{
            flex: 1,
            fontSize: '0.78rem',
            fontFamily: mono,
            color: '#e6edf3',
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: 4,
            padding: '5px 8px',
            cursor: 'pointer',
          }}
        >
          <option value="">— Ninguno —</option>
          {items.map((c) => (
            <option key={c.id} value={c.id}>
              {verNombre(c.name)}
            </option>
          ))}
        </select>
      </div>

      {descripcion && (
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
          {descripcion}
        </div>
      )}

      <div
        style={{
          ...(notaAlFondo ? { marginTop: 'auto' } : null),
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
        {nota}
      </div>
    </div>
  );
}
