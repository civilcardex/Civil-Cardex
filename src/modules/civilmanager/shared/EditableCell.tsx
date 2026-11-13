import { useState, type KeyboardEvent } from 'react';
import { fmtMoneda } from '../calc.ts';
import { NumInput } from './NumInput.tsx';

/** Qué control monta la celda al editar: 'texto' input libre, 'numero' NumInput, 'moneda' NumInput con formato y símbolo de la moneda, 'select' lista de opciones. */
export type TipoCelda = 'texto' | 'numero' | 'select' | 'moneda';

interface EditableCellProps {
  /** true monta el control de edición; false muestra el valor como texto (doble clic abre la fila). */
  editing: boolean;
  /** Valor guardado del campo; para campos numéricos pase String(valor). */
  value: string;
  /** Recibe el valor confirmado (Enter, blur o cambio de select). Ej: (v) => upd(id, 'nombre', v); para números convierta con parseNum. */
  onCommit: (v: string) => void;
  tipo?: TipoCelda;
  /** Solo para tipo 'select': opciones del listado (value es lo que se guarda, label lo que se ve). */
  opciones?: { value: string; label: string }[];
  placeholder?: string;
  /** Tooltip de la celda y nombre accesible (aria-label) del control en edición. */
  title?: string;
  /** Alineación del control en edición (el texto sin editar hereda la alineación del td). */
  align?: 'left' | 'center' | 'right';
  /** Campo de solo lectura: el control se muestra pero no admite cambios. */
  readOnly?: boolean;
  /** Doble clic en la celda sin editar: abre la edición de la fila (setEditIdx del tab). Ej: ctx.editRow de CrudTable. */
  onOpenEdit?: () => void;
  /** Enter/Escape de navegación de la fila (handleKeyDown de useCrudTable ya enlazado al índice visible); se llama después de confirmar/cancelar la celda. */
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}

/** Celda editable declarativa del CRUD (crear, leer, actualizar y borrar) de civilmanager: sin editar muestra el valor como texto y al editar monta el control según tipo — texto, número, moneda o select. El borrador local confirma con Enter o al salir del campo (blur), y Escape lo devuelve al valor guardado, así el dato cambia al terminar de escribir y no en cada tecla. Ej: <EditableCell editing={edit} value={p.nombre} onCommit={(v) => ctx.upd(p.id, 'nombre', v)} onOpenEdit={ctx.editRow} onKeyDown={ctx.handleKeyDown} title="Nombre" />. */
export function EditableCell({
  editing,
  value,
  onCommit,
  tipo = 'texto',
  opciones,
  placeholder,
  title,
  align,
  readOnly,
  onOpenEdit,
  onKeyDown,
}: EditableCellProps) {
  const [draft, setDraft] = useState(value);
  // Al (re)entrar en edición el borrador parte del valor guardado, no del que quedó de una
  // sesión anterior de la misma celda (ajuste en render, mismo patrón de useCrudTable).
  const [prevEditing, setPrevEditing] = useState(editing);
  if (prevEditing !== editing) {
    setPrevEditing(editing);
    setDraft(value);
  }

  /** Confirma el borrador solo si cambió respecto al valor guardado (evita upd con el mismo dato). */
  function commitDraft() {
    if (draft !== value) onCommit(draft);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Escape') {
      setDraft(value);
    }
    onKeyDown?.(e);
  }

  // Alineación via data-align (la leen las clases [data-align] del CSS del módulo).
  const alignData = align ? { 'data-align': align } : undefined;
  const a11y = { title, 'aria-label': title };

  if (!editing) {
    return (
      <span onDoubleClick={onOpenEdit} title={title}>
        {tipo === 'moneda' ? fmtMoneda(Number(value) || 0) : value}
      </span>
    );
  }

  if (tipo === 'select') {
    return (
      <select
        className="cm-sel"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onCommit(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        disabled={readOnly}
        {...alignData}
        {...a11y}
      >
        {(opciones ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (tipo === 'numero' || tipo === 'moneda') {
    return (
      // El onBlur de React burbujea: este div recibe el blur del NumInput sin pisar el
      // handleBlur interno que NumInput necesita para reiniciar su estado de formato.
      <div onBlur={commitDraft}>
        <NumInput
          value={draft}
          onChange={(n) => setDraft(String(n))}
          format={tipo === 'moneda'}
          moneda={tipo === 'moneda'}
          placeholder={placeholder}
          readOnly={readOnly}
          {...alignData}
          onKeyDown={handleKeyDown}
          {...a11y}
        />
      </div>
    );
  }

  return (
    <input
      className="cm-ni"
      value={draft}
      placeholder={placeholder}
      readOnly={readOnly}
      {...alignData}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitDraft}
      onKeyDown={handleKeyDown}
      {...a11y}
    />
  );
}
