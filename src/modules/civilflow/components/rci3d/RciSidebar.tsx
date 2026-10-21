import { COMPONENTS, COMP_DESC, RCI_MONO } from './rci3dData.ts';
import { NormaLink, NormaTxt } from '../shared/standardsLinks.tsx';
import { usePerfilIso } from '../shared/notaNormativaIso';
import ViewerSidebar, { nombreLegible } from '../shared/ViewerSidebar.tsx';

// Sidebar izquierdo del visor 3D RCI — mismo patrón que AparatosSidebar (orig. usuario):
// desplegable "Componente:" arriba, descripción del seleccionado debajo y nota normativa fija
// abajo-izquierda. Geist + mismos tamaños/colores.
// Links de la nota: cada norma a SU fuente oficial via NORMA_URLS (verificados 2026-10-09).
// La lista colectiva «NFPA 20/13/14/22/25/72» queda plana (familia, sin objetivo único).

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

/** Nota de diseño normativa con links — compartida por RciSidebar y RciRedSidebar (mismo texto/links; ambos visores RCI (Red Contra Incendio)).
 * NFPA 20 es internacional; la adaptación nacional (NSR (Norma Sismo Resistente)-10, Norma Sismo Resistente, Título J en Colombia) sigue al país del proyecto (pedido del cliente). */
export function NotaDisenoRci() {
  const perfil = usePerfilIso();
  if (perfil.id !== 'CO') {
    return (
      <>
        <strong style={{ color: '#BF4E14' }}>Nota de diseño:</strong> El presente detalle es una
        representación técnica de referencia elaborada con base en la norma internacional{' '}
        <NormaLink nombre="NFPA 20">NFPA 20:2025</NormaLink> y su adaptación para {perfil.nombre}:{' '}
        <NormaTxt texto={perfil.norma.rci} />. Las descripciones provienen de la revisión de la base
        normativa internacional (NFPA 20/13/14/22/25/72 con sus numerales). Es responsabilidad del
        diseñador revisar y hacer los ajustes según la respectiva norma vigente. El presente esquema
        y sus descripciones NO sustituyen las normas oficiales; su propósito es servir de guía para
        robustecer las descripciones del visor CIVILCARDEX.
      </>
    );
  }
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

export default function RciSidebar({ selectedId, onSelect }: Props): React.JSX.Element {
  const selDesc = selectedId != null ? COMP_DESC[selectedId] : undefined;
  const selComp = selectedId != null ? COMPONENTS.find((c) => c.id === selectedId) : undefined;

  return (
    <ViewerSidebar
      mono={RCI_MONO}
      selectId="rci-componente-select"
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
    />
  );
}
