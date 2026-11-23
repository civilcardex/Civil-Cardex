import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { fmt, fmtMoneda, parseNumInput } from '../calc.ts';

function numVal(v: unknown, format?: boolean): string {
  const s = String(v ?? '').replace(/,/g, '.');
  if (s === '' || s === '.' || s === '-') return s;
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  return format ? n.toLocaleString('en-US') : String(v);
}

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string;
  onChange: (v: number) => void;
  decimals?: number;
  format?: boolean;
  /** Muestra el símbolo de la moneda activa (campos de dinero). */
  moneda?: boolean;
  placeholder?: string;
  /** Mensaje de validación ajeno al tecleo en curso (H-04): borda el campo y se anuncia con
   *  role="alert" hasta que el llamador lo quita. Ej: «Escribe 850000 o 850.000,00». */
  error?: string | null;
}

/** Input numérico de los catálogos: acepta coma o punto decimal y notifica números (nunca strings). Con format/moneda muestra separador de miles y símbolo al estar sin foco. Ej: el usuario escribe "1,5" -> onChange(1.5). */
export function NumInput({
  value,
  onChange,
  decimals,
  format,
  moneda,
  placeholder,
  error,
  ...rest
}: Props) {
  const [raw, setRaw] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const invalid = (raw !== null && raw !== '' && parseNumInput(raw) === null) || Boolean(error);
  useLayoutEffect(() => {
    if (focused && input.current === document.activeElement) input.current?.select();
  }, [focused]);

  const isEmpty =
    !focused &&
    raw === null &&
    (value === 0 || value === null || value === undefined || value === '');
  const displayVal =
    raw !== null
      ? raw
      : focused
        ? String(value)
        : format
          ? moneda
            ? fmtMoneda(Number(value), typeof decimals === 'number' ? decimals : 2)
            : fmt(Number(value), typeof decimals === 'number' ? decimals : 2)
          : typeof decimals === 'number'
            ? Number(value).toFixed(decimals)
            : numVal(value, true);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nv = e.target.value;
    setRaw(nv);
    const n = parseNumInput(nv);
    if (n !== null) onChange(n);
  }

  function handleBlur() {
    setRaw(null);
    setFocused(false);
  }
  function handleFocus() {
    setFocused(true);
  }

  const campo = (
    <input
      ref={input}
      className="cm-ni"
      inputMode="decimal"
      aria-invalid={invalid || undefined}
      aria-describedby={error ? 'cm-num-error' : undefined}
      {...rest}
      /* Borde rojo del rechazo (H-04): antes el importe ambiguo se descartaba sin señal.
       *  Va DESPUÉS del spread: gana al style del llamador solo cuando hay error. */
      style={{
        ...(rest.style as React.CSSProperties | undefined),
        ...(invalid
          ? {
              borderColor: 'var(--err, #F04545)',
              outline: '1px solid var(--err, #F04545)',
            }
          : null),
      }}
      value={isEmpty && !error ? '' : displayVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  );

  return (
    <div className="cm-num-wrap">
      {campo}
      {isEmpty && !error && placeholder ? (
        <span className="cm-ni-placeholder">{placeholder}</span>
      ) : null}
      {error ? (
        <span id="cm-num-error" role="alert" className="cm-num-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
