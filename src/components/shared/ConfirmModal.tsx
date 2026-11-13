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
      <h3 className={`dialog-title${compactMessage ? ' dialog-title-compact' : ''}`}>{title}</h3>
      <p className={`dialog-lead${compactMessage ? ' dialog-lead-compact' : ''}`}>{message}</p>
      <div className={`dialog-actions${compactMessage ? ' dialog-actions-compact' : ''}`}>
        <button type="button" onClick={onClose} className="dialog-btn dialog-btn-ghost">
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} className="dialog-btn dialog-btn-danger">
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
