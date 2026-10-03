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
interface EditCtxVal {
  editing: boolean;
  setEditing: (v: boolean) => void;
}
const EditLockCtx = createContext<EditCtxVal | null>(null);

/** Provider del modo edición de una pestaña. dim: opaca el contenido en solo lectura.
 *  El botón EDITAR/LISTO lo pinta cada tabla (TableHeader → EditToggleBtn) — sin barra
 *  general fuera de las tablas (orig. usuario). */
export function EditableSection({ children, dim = true }: { children: ReactNode; dim?: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <EditLockCtx.Provider value={{ editing, setEditing }}>
      {dim ? (
        <div style={{ opacity: editing ? 1 : 0.7, transition: 'opacity .2s' }}>{children}</div>
      ) : (
        children
      )}
    </EditLockCtx.Provider>
  );
}

/** true si la pestaña actual está en modo edición. */
export function useEditable(): boolean {
  return useContext(EditLockCtx)?.editing ?? true;
}

/** Botón EDITAR/LISTO; vive dentro de un EditableSection (usa su estado). */
export function EditToggleBtn(): React.JSX.Element {
  const ctx = useContext(EditLockCtx);
  if (!ctx) return <></>;
  return (
    <button
      type="button"
      className={ctx.editing ? 'cm-btn cm-btn-ok' : 'cm-btn cm-btn-primary'}
      onClick={() => ctx.setEditing(!ctx.editing)}
    >
      {ctx.editing ? 'Listo' : 'Editar'}
    </button>
  );
}

/** Envoltorio que opaca su contenido en solo lectura (para sub-paneles). */
export function DimEnLectura({ children }: { children: ReactNode }) {
  const editable = useEditable();
  return <div style={{ opacity: editable ? 1 : 0.7, transition: 'opacity .2s' }}>{children}</div>;
}

/** Header de tabla con icono (patrón civilflow) + EDITAR/LISTO a la derecha — un botón por tabla. */
export function TableHeader({ title, icon }: { title: string; icon?: string }) {
  return (
    <div className="cm-modal-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 15,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {icon && (
          <img
            src={'/iconos_civilmanager/' + icon + '.webp'}
            alt=""
            width={30}
            height={30}
            style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }}
            loading="lazy"
          />
        )}
        {title}
      </span>
      <EditToggleBtn />
    </div>
  );
}
