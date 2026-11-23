import { useRef, useState, type KeyboardEvent } from 'react';
import { fmtMoneda, parseNumInput } from '../calc.ts';
import { NumInput } from './NumInput.tsx';
import { useEditable } from './EditLock.tsx';

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
  /** Acción para editar la fila con toque, clic o teclado. Ej.: ctx.editRow de CrudTable. */
  onOpenEdit?: () => void;
  /** Enter/Escape de navegación de la fila (handleKeyDown de useCrudTable ya enlazado al índice visible); se llama después de confirmar/cancelar la celda. */
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}

/** Celda editable declarativa del CRUD (crear, leer, actualizar y borrar) de civilmanager: sin editar muestra el valor como texto y al editar monta el control según tipo — texto, número, moneda o select. El borrador local confirma con Enter o al salir del campo (blur), y Escape lo devuelve al valor guardado, así el dato cambia al terminar de escribir y no en cada tecla. Ej: <EditableCell editing={edit} value={p.nombre} onCommit={(v) => ctx.upd(p.id, 'nombre', v)} onOpenEdit={ctx.editRow} onKeyDown={ctx.handleKeyDown} title="Nombre" />. */
export function EditableCell({
  editing: rowEditing,
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
  const editable = useEditable() && !readOnly;
  const editing = rowEditing && editable;
  const [draft, setDraft] = useState(value);
  const focusAfterOpen = useRef(false);
  const canceled = useRef(false);
  function focusEditor(el: HTMLElement | null) {
    if (!el || !focusAfterOpen.current) return;
    focusAfterOpen.current = false;
    el.focus();
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  // Al (re)entrar en edición el borrador parte del valor guardado, no del que quedó de una
  // sesión anterior de la misma celda (ajuste en render, mismo patrón de useCrudTable).
  const [prevEditing, setPrevEditing] = useState(editing);
  if (prevEditing !== editing) {
    setPrevEditing(editing);
    setDraft(value);
  }

  /** Confirma el borrador solo si cambió respecto al valor guardado (evita upd con el mismo dato). */
  function commitDraft() {
    if (!canceled.current && draft !== value) onCommit(draft);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if ((e.target as HTMLElement).getAttribute('aria-invalid') === 'true') return;
      commitDraft();
    } else if (e.key === 'Escape') {
      canceled.current = true;
      setDraft(value);
    }
    onKeyDown?.(e);
  }

  // Alineación via data-align (la leen las clases [data-align] del CSS del módulo).
  const alignData = align ? { 'data-align': align } : undefined;
  const a11y = { title, 'aria-label': title };

  if (!editing) {
    const text = tipo === 'moneda' ? fmtMoneda(Number(value) || 0) : value;
    if (onOpenEdit && editable) {
      return (
        <button
          type="button"
          className="cm-cell-edit"
          onClick={() => {
            focusAfterOpen.current = true;
            canceled.current = false;
            onOpenEdit();
          }}
          title={title}
        >
          {text || 'Editar'}
        </button>
      );
    }
    return <span title={title}>{text}</span>;
  }

  if (tipo === 'select') {
    return (
      <select
        ref={focusEditor}
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
    /* Rechazo VISIBLE (H-04): un importe ambiguo ('850.000') ya no se revierte en silencio
     *  al salir del campo — se conserva lo tecleado, el borde rojo y el aviso indican el
     *  formato esperado hasta que el usuario lo corrija o Escape devuelva el valor viejo. */
    const errorNum =
      draft !== '' && parseNumInput(draft) === null
        ? 'Valor no reconocido: escriba 850000 o 850.000,00 (punto = millares, coma = decimales).'
        : null;
    return (
      // El onBlur de React burbujea: este div recibe el blur del NumInput sin pisar el
      // handleBlur interno que NumInput necesita para reiniciar su estado de formato.
      <div
        ref={(container) => focusEditor(container?.querySelector('input') ?? null)}
        onBlur={(e) => {
          if (canceled.current) return;
          if (!(e.target instanceof HTMLInputElement)) return;
          const parsed = parseNumInput(e.target.value);
          if (parsed === null) setDraft(e.target.value);
          else if (String(parsed) !== value) onCommit(String(parsed));
        }}
      >
        <NumInput
          value={draft}
          onChange={(n) => {
            canceled.current = false;
            setDraft(String(n));
          }}
          format={tipo === 'moneda'}
          moneda={tipo === 'moneda'}
          placeholder={placeholder}
          readOnly={readOnly}
          error={errorNum}
          {...alignData}
          onKeyDown={handleKeyDown}
          {...a11y}
        />
      </div>
    );
  }

  return (
    <input
      ref={focusEditor}
      className="cm-ni"
      value={draft}
      placeholder={placeholder}
      readOnly={readOnly}
      {...alignData}
      onChange={(e) => {
        canceled.current = false;
        setDraft(e.target.value);
      }}
      onBlur={commitDraft}
      onKeyDown={handleKeyDown}
      {...a11y}
    />
  );
}
