// Chrome móvil del visor: banner "modo consulta", nombre del plano y cluster de zoom táctil
// (⤢ ajustar / + / −). Solo se monta bajo los breakpoints que corresponden — cero lógica de
// dibujo; el zoom delega en el engine via onZoomStep.

interface ViewerMobileChromeProps {
  isMobile: boolean;
  isNarrow: boolean;
  currentFile: File | null;
  onFit: () => void;
  onZoomStep: (factor: number) => void;
}

const BOTON_ZOOM_STYLE = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  border: '1px solid #3a494a',
  background: 'rgba(14,20,28,0.92)',
  color: '#e2e2e8',
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
} as const;

/** Banner + nombre de plano (solo móvil) y botones flotantes de zoom (móvil y tablet). */
export function ViewerMobileChrome({
  isMobile,
  isNarrow,
  currentFile,
  onFit,
  onZoomStep,
}: ViewerMobileChromeProps): React.JSX.Element | null {
  if (!isMobile && !isNarrow) return null;
  return (
    <>
      {isMobile && (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            padding: '6px 12px',
            background: 'rgba(14,20,28,0.92)',
            borderBottom: '1px solid #3a494a',
            color: '#849495',
            fontSize: 11,
            fontFamily: 'var(--body)',
          }}
        >
          Modo consulta — el dibujo requiere tablet o PC.
        </div>
      )}
      {isMobile && currentFile && (
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 0,
            right: 0,
            zIndex: 10,
            textAlign: 'center',
            color: '#849495',
            fontSize: 10,
            fontFamily: 'var(--body)',
            pointerEvents: 'none',
            padding: '0 12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentFile.name}
        </div>
      )}
      {/* Zoom táctil: también en tablet (768-1023), donde no hay botones de la toolbar de
          escritorio a mano y el pinch es el único zoom alternativo. */}
      {isNarrow && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 18,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {[
            { label: '⤢', aria: 'Ajustar a pantalla', run: onFit },
            { label: '+', aria: 'Acercar', run: () => onZoomStep(1.2) },
            { label: '−', aria: 'Alejar', run: () => onZoomStep(1 / 1.2) },
          ].map((z) => (
            <button
              key={z.label}
              type="button"
              aria-label={z.aria}
              onClick={z.run}
              style={BOTON_ZOOM_STYLE}
            >
              {z.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
