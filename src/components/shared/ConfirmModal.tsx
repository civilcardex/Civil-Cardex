import { ModalShell } from './ModalShell.tsx';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  minWidth?: number;
  /** Mensaje más grande pegado al cuerpo (variante del modal de logout). */
  compactMessage?: boolean;
}

/** Modal de confirmación destructiva compartido (borrar proyecto CF/CM, cerrar sesión).
 *  Antes cada página copiaba el mismo overlay inline ~80 líneas por instancia. */
export function ConfirmModal({
  title,
  message,
  onConfirm,
  onClose,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  minWidth = 360,
  compactMessage = false,
}: ConfirmModalProps) {
  return (
    <ModalShell minWidth={minWidth}>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--on-surface, #e2e2e8)',
          margin: compactMessage ? '0 0 6px' : '0 0 4px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: compactMessage ? 13 : 12,
          color: 'var(--on-surface-variant, #9ba8aa)',
          margin: compactMessage ? 0 : '0 0 16px',
        }}
      >
        {message}
      </p>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: compactMessage ? 18 : undefined,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            background: 'transparent',
            border: '1px solid var(--outline-variant, #3a3a44)',
            borderRadius: 4,
            color: 'var(--on-surface, #e2e2e8)',
            cursor: 'pointer',
          }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            background: 'var(--error, #ff4444)',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
