import { COMPONENTS, COMP_DESC } from './rciRedDatos.ts';
import { RCI_MONO } from '../rci3d/rci3dDatos.ts';
import { NotaDisenoRci } from '../rci3d/RciLateral.tsx';
import { NormaTxt } from '../shared/normasLinks.tsx';
import ViewerSidebar, { nombreLegible } from '../shared/ViewerLateral.tsx';

// Sidebar izquierdo del visor "Red contra incendio" — clon de RciSidebar con los 14
// componentes de la RED (port del HTML). Mismo patrón: desplegable + descripción + nota.
// La nota de diseño (con links) se comparte con RciSidebar — NotaDisenoRci.

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export default function RciRedSidebar({ selectedId, onSelect }: Props): React.JSX.Element {
  const selDesc = selectedId != null ? COMP_DESC[selectedId] : undefined;
  const selComp = selectedId != null ? COMPONENTS.find((c) => c.id === selectedId) : undefined;

  return (
    <ViewerSidebar
      mono={RCI_MONO}
      selectId="rci-red-componente-select"
      selectLabel="Componente:"
      items={COMPONENTS}
      muestraNombre={nombreLegible}
      selectedId={selectedId}
      onSelect={onSelect}
      descripcion={
        selectedId != null && selDesc && selComp ? (
          <>
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
              <NormaTxt texto={selDesc.norm} />
            </div>
          </>
        ) : null
      }
      nota={<NotaDisenoRci />}
      notaAlFondo
    />
  );
}
