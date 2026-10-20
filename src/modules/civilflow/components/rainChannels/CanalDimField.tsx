import React from 'react';
import { fmt } from '../../utils/formatUtils';
import { dec, sanitizarInputDecimal } from '../../utils/parseDecimal';

const CANAL_FIELD_LABELS: Record<
  | 'b'
  | 'h'
  | 'pendiente'
  | 'longitud'
  | 'areaOtras'
  | 'intensidad'
  | 'muroVertical'
  | 'bordeLibreCm',
  string
> = {
  b: 'Base (cm)',
  h: 'Altura (cm)',
  pendiente: 'Pendiente (%)',
  longitud: 'Longitud (cm)',
  areaOtras: 'Área otras',
  intensidad: 'Intensidad (mm/hr)',
  muroVertical: 'Muro vertical (m²)',
  bordeLibreCm: 'Borde libre (cm)',
};

export const CanalDimField = React.memo(function CanalDimField({
  id,
  field,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  field:
    | 'b'
    | 'h'
    | 'pendiente'
    | 'longitud'
    | 'areaOtras'
    | 'intensidad'
    | 'muroVertical'
    | 'bordeLibreCm';
  value: number;
  onChange: (id: string, field: string, val: number) => void;
  /** Edición habilitada solo con el botón EDITAR de la tabla (en LISTO es solo lectura). */
  disabled?: boolean;
}) {
  const [text, setText] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  // Otras (orig. usuario): nunca vacía — muestra 0 cuando el valor es 0.
  const display =
    field === 'areaOtras'
      ? editing
        ? text
        : fmt(value ?? 0, 2)
      : editing
        ? text
        : field === 'intensidad'
          ? value > 0
            ? String(Math.round(value))
            : ''
          : value > 0
            ? fmt(value, 2)
            : '';
  // Patrón sanitaria (orig. usuario): con EDITAR apagado la celda es TEXTO PLANO (sin
  // borde ni fondo); al activar toma el estilo de input.
  if (disabled) {
    return (
      <span
        style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600 }}
        title={CANAL_FIELD_LABELS[field]}
      >
        {display === '' ? '—' : display}
      </span>
    );
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder="0"
      aria-label={CANAL_FIELD_LABELS[field]}
      onFocus={() => {
        setEditing(true);
        // Otras en 0 arranca VACÍA al enfocar (orig. usuario: no había que "quitar el 0").
        const vaciar = field === 'areaOtras' && !(value > 0);
        setText(vaciar ? '' : display);
      }}
      onChange={(e) => {
        const raw = sanitizarInputDecimal(e.target.value);
        setText(raw);
      }}
      onKeyDown={(e) => {
        // Enter commitea el cambio (mismo comportamiento que el resto de campos numéricos)
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={() => {
        setEditing(false);
        // Dimensión física (b/h/longitud/pendiente): negativo = basura de tipeo, no dato.
        const v = Math.max(0, dec(text));
        onChange(id, field, text === '' ? 0 : v);
      }}
      style={{
        textAlign: 'center',
        fontSize: 10,
        opacity: disabled ? 0.6 : 1,
        padding: '2px 4px',
        width: 38,
        fontFamily: 'var(--mono)',
        background: 'var(--bg2)',
        border: '1px solid var(--line)',
        borderRadius: 2,
        color: 'var(--txt)',
      }}
    />
  );
});
