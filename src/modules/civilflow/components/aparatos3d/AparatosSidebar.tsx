import { COMPONENTS, COMP_DESC } from './aparatos3dData.ts';
import { MONO_3D } from '../shared/config3d';
import { NormaLink, NormaTxt } from '../shared/standardsLinks.tsx';
import { usePerfilIso } from '../shared/isoStandardsNote';
import ViewerSidebar, { cuerpoDe } from '../shared/ViewerSidebar.tsx';

// Sidebar izquierdo del visor 3D de aparatos (orig. usuario): desplegable "Aparato:" arriba,
// descripción del seleccionado debajo y nota normativa fija abajo. Sin listado (el desplegable
// es el único selector). Texto agrandado (orig. usuario).
// Links de la nota: cada norma a SU fuente oficial via NORMA_URLS (verificados 2026-10-09).

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export default function AparatosSidebar({ selectedId, onSelect }: Props): React.JSX.Element {
  const selDesc = selectedId != null ? COMP_DESC[selectedId] : undefined;
  const selComp = selectedId != null ? COMPONENTS.find((c) => c.id === selectedId) : undefined;
  const perfil = usePerfilIso();

  const CIERRE = (
    <>
      vigentes a la fecha de publicación. Los criterios de diseño, dimensionamiento hidráulico,
      selección y ubicación de aparatos deben ser verificados y ajustados por un ingeniero
      competente conforme a las ediciones vigentes de cada norma en el momento de la ejecución del
      proyecto, así como a los catálogos de los respectivos fabricantes. CIVILCARDEX no asume
      responsabilidad por aplicaciones que no hayan sido validadas por el profesional responsable de
      la obra.
    </>
  );
  const nota =
    perfil.id === 'CO' ? (
      <>
        <strong style={{ color: '#BF4E14' }}>Nota normativa:</strong> El presente detalle es una
        representación técnica de referencia elaborada con base en las normas{' '}
        <NormaLink nombre="RAS 2000">RAS 2000 Tít.D</NormaLink> /{' '}
        <NormaLink nombre="Resolución 0330 de 2017" />,{' '}
        <NormaLink nombre="NTC 1500">NTC 1500:2023</NormaLink>,{' '}
        <NormaLink nombre="NSR-10">NSR-10 Tít.J</NormaLink> y <NormaLink nombre="NTC 3631" />,{' '}
        {CIERRE}
      </>
    ) : (
      <>
        <strong style={{ color: '#BF4E14' }}>Nota normativa:</strong> El presente detalle es una
        representación técnica de referencia elaborada con base en la normativa de {perfil.nombre}:{' '}
        <NormaTxt texto={perfil.norma.san} />, {CIERRE}
      </>
    );

  return (
    <ViewerSidebar
      mono={MONO_3D}
      selectId="aparato-select"
      selectLabel="Aparato:"
      items={COMPONENTS}
      selectedId={selectedId}
      onSelect={onSelect}
      descripcion={
        selectedId != null && selDesc && selComp ? (
          <>
            <div style={{ color: '#c9d1d9' }}>{cuerpoDe(selDesc.body)}</div>
            <div style={{ marginTop: 6, color: '#8b949e', fontSize: '0.70rem' }}>
              <span style={{ fontWeight: 600 }}>Referencia normativa: </span>
              <NormaTxt texto={selDesc.norm} />
            </div>
          </>
        ) : null
      }
      nota={nota}
    />
  );
}
