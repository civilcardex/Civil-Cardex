/** Overlay sin selección (port literal del original). */
export default function SinSeleccionOverlay(): React.JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: '3rem', opacity: 0.18, marginBottom: 16 }}>⊙</div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.85rem',
          color: '#7d8590',
          letterSpacing: '.08em',
          textAlign: 'center',
          lineHeight: 1.8,
        }}
      >
        Seleccione un aparato
        <br />
        para visualizar su detalle de instalación
      </div>
      <div
        style={{
          fontSize: '0.62rem',
          color: '#7d8590',
          opacity: 0.6,
          marginTop: 6,
          letterSpacing: '.05em',
        }}
      >
        ← use el listado de la izquierda
      </div>
    </div>
  );
}
