import React, { useState, useRef, useEffect } from 'react';
import { sanitizarInputDecimal } from '../../utils/parseDecimal';

export interface LazyDecimalInputProps {
  value: string;
  onCommit: (v: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  selectOnFocus?: boolean;
  commitOnEnter?: boolean;
}

export function LazyDecimalInput({
  value,
  onCommit,
  ariaLabel,
  disabled,
  style,
  className,
  onFocus,
  selectOnFocus,
  commitOnEnter,
}: LazyDecimalInputProps) {
  const [val, setVal] = useState(value);
  const isDirty = useRef(false);

  useEffect(() => {
    if (!isDirty.current) setVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirty.current = true;
    // sanitizarInputDecimal: coma → punto ANTES del filtro (inputMode="decimal" emite
    // coma en teclado es-locale; filtrarla convertía "2,5" en "25", auditoría A-1).
    const v = sanitizarInputDecimal(e.target.value).replace(/(\..*)\./g, '$1');
    setVal(v);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (selectOnFocus) e.target.select();
    onFocus?.(e);
  };

  const handleBlur = () => {
    isDirty.current = false;
    // Solo comitea si el texto cambió: foco+blur sin teclear ya no escribe overrides
    // "sticky" con el display redondeado (p. ej. presIniEdit piniando el tramo, A-6).
    if (val !== value) onCommit(val);
  };

  const handleKeyDown = commitOnEnter
    ? (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }
    : undefined;

  return (
    <input
      type="text"
      disabled={disabled}
      inputMode="decimal"
      aria-label={ariaLabel}
      className={className}
      value={val}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={style}
    />
  );
}
