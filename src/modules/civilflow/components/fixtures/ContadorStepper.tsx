/**
 * Fila −/valor/+ del tile de aparato o accesorio (FixtureGrid y AccessoriesSection): mismo
 * look en ambos paneles — borde y fondo acentuados cuando hay conteo, steppers grises y sin
 * clic sin tramo asignado. Ej: {activo} {bloqueado=false} children=3 → [−][ 3 ][+] con borde
 * del color del acento.
 * @param activo - conteo > 0: acentúa borde/fondo del bloque central.
 * @param bloqueado - sin tramo asignado (targetId null): steppers deshabilitados y grises.
 * @param puedeDec - false deshabilita solo el − (conteo en 0); default true.
 * @param paddingY - '1px 0' (accesorios) o '2px 0' (aparatos): píxel exacto de cada panel.
 * @param conLineHeight - los accesorios fijan lineHeight 1 en los botones.
 * @param children - contenido de la caja central (el número, con o sin unidad).
 */
export function ContadorStepper(props: {
  activo: boolean;
  bloqueado: boolean;
  puedeDec?: boolean;
  accent: string;
  paddingY?: string;
  conLineHeight?: boolean;
  onDec: () => void;
  onInc: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const {
    activo,
    bloqueado,
    puedeDec = true,
    accent,
    paddingY = '1px 0',
    conLineHeight = false,
    onDec,
    onInc,
    children,
  } = props;
  const borde = `1px solid ${activo ? accent + '55' : 'var(--bg4)'}`;
  const btn: React.CSSProperties = {
    flex: 1,
    padding: paddingY,
    border: 'none',
    background: 'transparent',
    fontSize: 12,
    fontWeight: 800,
    lineHeight: conLineHeight ? 1 : undefined,
    fontFamily: "'Geist',monospace",
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderTop: borde,
        background: activo ? 'rgba(37,99,235,.06)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!bloqueado) onDec();
        }}
        disabled={bloqueado || !puedeDec}
        style={{
          ...btn,
          borderRight: borde,
          color: !puedeDec || bloqueado ? 'var(--line)' : '#ffb4ab',
          cursor: !puedeDec || bloqueado ? 'not-allowed' : 'pointer',
        }}
      >
        −
      </button>
      <div
        style={{
          flex: 1.2,
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 800,
          lineHeight: '14px',
          color: activo ? accent : 'var(--txt2)',
          fontFamily: "'Geist',monospace",
          background: activo ? 'rgba(37,99,235,.18)' : 'transparent',
        }}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!bloqueado) onInc();
        }}
        disabled={bloqueado}
        style={{
          ...btn,
          borderLeft: borde,
          color: bloqueado ? 'var(--line)' : accent,
          cursor: bloqueado ? 'not-allowed' : 'pointer',
        }}
      >
        +
      </button>
    </div>
  );
}
