import { COMPONENTES, COMP_DESC } from './epc3dData.ts';
import { MONO_3D } from '../shared/config3d';
import { NormaLink, NormaTxt } from '../shared/standardsLinks.tsx';
import { usePerfilIso } from '../shared/isoStandardsNote';
import ViewerSidebar, { cuerpoDe } from '../shared/ViewerSidebar.tsx';

// Sidebar izquierdo del visor 3D del EPC — mismo patrón que AparatosSidebar (orig. usuario):
// desplegable "Componente:" arriba, descripción debajo y nota normativa fija abajo.
// Fuente Geist igual que la isometría de aparatos.
// Links de la nota: cada norma a SU fuente oficial via NORMA_URLS (verificados 2026-09-30).

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export default function EpcSidebar({ selectedId, onSelect }: Props): React.JSX.Element {
  const desc = selectedId != null ? COMP_DESC[String(selectedId)] : undefined;
  const comp = selectedId != null ? COMPONENTES.find((c) => c.id === selectedId) : undefined;
  const perfil = usePerfilIso();

  return (
    <ViewerSidebar
      mono={MONO_3D}
      selectId="epc-select"
      selectLabel="Componente:"
      items={COMPONENTES}
      selectedId={selectedId}
      onSelect={onSelect}
      descripcion={
        selectedId != null && desc && comp ? (
          <>
            <div style={{ color: '#c9d1d9' }}>{cuerpoDe(desc.body)}</div>
            {desc.norm && (
              <div style={{ marginTop: 6, color: '#8b949e', fontSize: '0.70rem' }}>
                <span style={{ fontWeight: 600 }}>Referencia normativa: </span>
                <NormaTxt texto={desc.norm} />
              </div>
            )}
          </>
        ) : null
      }
      nota={
        <>
          <p style={{ margin: 0 }}>
            <strong style={{ color: '#BF4E14' }}>⚠ Nota: </strong>
            El presente detalle es una representación técnica de referencia elaborada con base en{' '}
            {perfil.id === 'CO' ? (
              <>
                las normas <NormaLink nombre="RAS 2000">RAS 2000</NormaLink> /{' '}
                <NormaLink nombre="NTC 1500">NTC 1500</NormaLink> y{' '}
                <NormaLink nombre="RETIE">RETIE</NormaLink> /{' '}
                <NormaLink nombre="NTC 1500">NTC 1500</NormaLink>
              </>
            ) : (
              <>
                la normativa de {perfil.nombre}: <NormaTxt texto={perfil.norma.san} />
              </>
            )}{' '}
            vigentes a la fecha de publicación. Los criterios de diseño, dimensionamiento
            hidráulico, selección y ubicación de los equipos deben ser verificados y ajustados por
            un ingeniero competente conforme a las ediciones vigentes de cada norma en el momento de
            la ejecución del proyecto, así como a los catálogos de los respectivos fabricantes.
            CIVILCARDEX no asume responsabilidad por aplicaciones que no hayan sido validadas por el
            profesional responsable de la obra. Se deben aplicar normas y criterios de cada país.
          </p>
          <p style={{ margin: '8px 0 0' }}>
            <strong style={{ color: '#BF4E14' }}>🔥 Nota: </strong>
            Si el equipo no corresponde a abastecimiento hidrosanitario convencional sino a un
            sistema de protección contra incendios, deben aplicarse los requisitos específicos del
            sistema y las normas del proyecto, incluyendo{' '}
            <NormaLink nombre="NFPA 20">NFPA 20</NormaLink> cuando corresponda.
          </p>
        </>
      }
    />
  );
}
