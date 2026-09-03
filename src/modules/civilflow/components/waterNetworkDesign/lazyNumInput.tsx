import React from 'react';

// Input numérico perezoso: mantiene su propio texto mientras se escribe y solo avisa el cambio
// en blur/Enter, evitando el salto de cursor de los inputs controlados con valores formateados.
// Se re-sincroniza solo cuando el valor externo cambia de verdad (patrón prevVal).
/** Input numérico perezoso: mantiene su texto mientras se escribe y solo avisa el cambio en
 *  blur/Enter, sin el salto de cursor de los inputs controlados con valores formateados. */
export function LazyNumInput({
  val,
  onSave,
  label,
  disabled = false,
}: {
  val: number | string;
  onSave: (v: number | undefined) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [str, setStr] = React.useState(val != null ? val.toString() : '');
  const [prevVal, setPrevVal] = React.useState(val);
  if (val !== prevVal) {
    setPrevVal(val);
    setStr(val != null ? val.toString() : '');
  }
  const blur = () => {
    if (str.trim() === '') return onSave(undefined);
    const n = parseFloat(str);
    if (!isNaN(n)) onSave(n);
    else setStr(val != null ? val.toString() : '');
  };
  return (
    <input
      type="number"
      aria-label={label}
      step="any"
      className="ni"
      disabled={disabled}
      style={{ width: 44, textAlign: 'center', padding: 0, fontSize: 9 }}
      value={str}
      onChange={(e) => setStr(e.target.value)}
      onBlur={blur}
      onKeyDown={(e) => e.key === 'Enter' && blur()}
    />
  );
}
