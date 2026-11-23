import { useState } from 'react';
import { ModalShell } from './ModalShell.tsx';

/** Pide el nombre del proyecto y deja la creación al módulo que abrió el diálogo.
 * Ej.: « Obra norte » llega como «Obra norte» a la función que crea el proyecto. */
export function NombreProyectoDialog(props: {
  open: boolean;
  titulo: string;
  ariaLabel?: string;
  creating?: boolean;
  onCreate: (nombre: string) => void;
  onClose: () => void;
}): React.ReactElement | null {
  const { open, titulo, ariaLabel, creating, onCreate, onClose } = props;
  const [name, setName] = useState('');
  const trimmedName = name.trim();

  if (!open) return null;
  const cancelar = (): void => {
    onClose();
    setName('');
  };
  return (
    <ModalShell
      ariaLabel={ariaLabel ?? 'Nuevo proyecto'}
      onClose={cancelar}
      dismissOnBackdrop={false}
      nativeInitialFocus
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmedName && !creating) onCreate(trimmedName);
        }}
      >
        <h3 className="dialog-title">{titulo}</h3>
        <p className="dialog-lead">
          Ingresa el nombre del proyecto. Se generará un código automático.
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del proyecto"
          aria-label="Nombre del proyecto"
          className="project-create-dialog-input"
        />
        <div className="dialog-actions">
          <button type="button" onClick={cancelar} className="dialog-btn dialog-btn-ghost">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!trimmedName || creating}
            className="dialog-btn dialog-btn-primary"
          >
            {creating ? 'Creando...' : 'Crear Proyecto'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
