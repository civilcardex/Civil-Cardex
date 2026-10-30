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
