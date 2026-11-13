import { createContext, useContext, useState, type ReactNode } from 'react';

/** Modo edición por pestaña: false = solo lectura, true = editable. */
interface EditCtxVal {
  editing: boolean;
  setEditing: (v: boolean) => void;
}
const EditLockCtx = createContext<EditCtxVal | null>(null);

/** Provider del modo edición de una pestaña. dim: opaca el contenido en solo lectura. */
export function EditableSection({ children, dim = true }: { children: ReactNode; dim?: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <EditLockCtx.Provider value={{ editing, setEditing }}>
      {dim ? (
        <div className="cm-dim" data-on={editing ? 'true' : 'false'}>
          {children}
        </div>
      ) : (
        children
      )}
    </EditLockCtx.Provider>
  );
}

/** Lee el modo edición de la pestaña (true si no hay provider — fuera de una tabla todo es editable). Ej: una celda se deshabilita cuando useEditable() es false. */
export function useEditable(): boolean {
  return useContext(EditLockCtx)?.editing ?? true;
}

/** Botón EDITAR/LISTO; vive dentro de un EditableSection (usa su estado). */
function EditToggleBtn(): React.JSX.Element {
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
  return (
    <div className="cm-dim" data-on={editable ? 'true' : 'false'}>
      {children}
    </div>
  );
}

/** Header de tabla con icono (patrón civilflow) + EDITAR/LISTO a la derecha — un botón por tabla. */
export function TableHeader({ title, icon }: { title: string; icon?: string }) {
  return (
    <div className="cm-modal-head cm-head-row">
      <span className="cm-head-title">
        {icon && (
          <img
            src={'/iconos_civilmanager/' + icon + '.webp'}
            alt=""
            width={30}
            height={30}
            className="cm-head-icon"
            loading="lazy"
          />
        )}
        {title}
      </span>
      <EditToggleBtn />
    </div>
  );
}
