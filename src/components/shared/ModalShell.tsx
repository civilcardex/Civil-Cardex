import { useEffect } from 'react';

/** Solo la CAPA de overlay (fixed a pantalla completa, backdrop oscuro, contenido centrado)
 *  — para modales con card propia (rci, workarea: sus anchos/bordes son distintos). Ej:
 *  <ModalOverlay onClose={() => setAbierta(false)}><div style={...}>...</div></ModalOverlay>. */
export function ModalOverlay(props: {
  /** Cerrar al hacer clic en el backdrop (fuera del children). Omitir = sin cierre por clic. */
  onClose?: () => void;
  /** Capa z. Los visores usan 9999/99999; los tabs rci 60. */
  zIndex?: number;
  children: React.ReactNode;
}): React.ReactElement {
  const { onClose, zIndex = 9999, children } = props;
  return (
    // Backdrop con cierre por click-fuera: patrón estándar de modal (el Escape lo maneja
    // useEscapeKey en el consumidor; el dialog interior es el interactivo).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.6)',
        padding: 20,
      }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

/** Escape ejecuta `alEscapar` (cierres de modal a nivel documento, patrón HelpPanel). */
export function useEscapeKey(alEscapar: () => void, activo = true): void {
  useEffect(() => {
    if (!activo) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') alEscapar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [alEscapar, activo]);
}

/**
 * Overlay + card compartidos por los modales de la app: fixed a pantalla completa con
 * backdrop oscuro y card centrada con la superficie estándar. Ej:
 * <ModalShell ariaLabel="Checkout de pago">...contenido...</ModalShell>.
 */
export function ModalShell(props: {
  minWidth?: number;
  ariaLabel?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { minWidth = 360, ariaLabel, children } = props;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
    >
      <div
        role={ariaLabel ? 'dialog' : undefined}
        aria-modal={ariaLabel ? true : undefined}
        aria-label={ariaLabel}
        style={{
          background: 'var(--surface-container, #1e1e24)',
          border: '1px solid var(--outline-variant, #3a3a44)',
          borderRadius: 8,
          padding: 24,
          minWidth,
          maxWidth: 420,
          boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
