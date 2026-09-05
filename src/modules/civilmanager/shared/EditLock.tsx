import { createContext, useContext, useState, type ReactNode } from 'react';

/**
 * Modo edición por pestaña: false = solo lectura, true = editable.
 * El default `true` mantiene el comportamiento actual en superficies sin provider.
 *
 * Reglas del patrón (todas las superficies editables deben cumplirlas):
 * 1. useCrudTable se autoblinda: sus mutadores (add/del/setEditIdx) nunca confían
 *    en el call-site para respetar el modo edición.
 * 2. El fieldset disabled es red de seguridad obligatoria en todo panel con inputs
 *    siempre visibles (fieldset disabled solo afecta controles de formulario).
 */
const EditLockCtx = createContext(true);

/** Botón EDITAR/LISTO arriba a la derecha + provider con el estado del modo edición. */
export function EditableSection({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  return (
    <EditLockCtx.Provider value={editing}>
      <div className="cm-edit-bar">
        <span className="cm-flex-1" />
        <button
          type="button"
          className={editing ? 'cm-btn cm-btn-ok' : 'cm-btn cm-btn-primary'}
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? 'Listo' : 'Editar'}
        </button>
      </div>
      {children}
    </EditLockCtx.Provider>
  );
}

/** true si la pestaña actual está en modo edición. */
export function useEditable() {
  return useContext(EditLockCtx);
}
