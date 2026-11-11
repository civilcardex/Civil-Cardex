/** Modal «Ver ayuda» compartido por las tablas RCI (Red Contra Incendio): overlay + tarjeta
 *  limpia con encabezado acentuado y cuerpo tipografiado (clases .rci-help de index.css).
 *  Unifica el mini-modal que cada tabla duplicaba (Pisos del edificio, Ramales del piso).
 *  Ej: <RciHelpModal titulo="Conecta en: nudos y tramos" onClose={cerrar}>{contenido}</RciHelpModal>. */
import type { ReactNode } from 'react';
import { ModalOverlay } from '../../../../components/shared/ModalShell.tsx';

/** Tarjeta de ayuda con cierre por ✕, clic fuera y Escape. `titulo` es el aria-label del diálogo. */
export function RciHelpModal({
  titulo,
  onClose,
  children,
}: {
  /** Título visible y nombre accesible del diálogo. */
  titulo: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ModalOverlay onClose={onClose} zIndex={60} ariaLabel={titulo}>
      <div className="rci-help">
        <header className="rci-help-h">
          <span className="rci-help-badge" aria-hidden="true">
            ?
          </span>
          <div className="rci-help-tt">
            <span className="rci-help-eyebrow">Ayuda RCI</span>
            <b>{titulo}</b>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar ayuda" className="rci-help-x">
            ✕
          </button>
        </header>
        <div className="rci-help-body">{children}</div>
      </div>
    </ModalOverlay>
  );
}

export default RciHelpModal;
