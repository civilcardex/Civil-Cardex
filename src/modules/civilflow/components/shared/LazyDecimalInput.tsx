import React, { useState, useRef, useEffect } from "react";

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

export function LazyDecimalInput({ value, onCommit, ariaLabel, disabled, style, className, onFocus, selectOnFocus, commitOnEnter }: LazyDecimalInputProps) {
  const [val, setVal] = useState(value);
  const isDirty = useRef(false);

  useEffect(() => {
    if (!isDirty.current) setVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirty.current = true;
    const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setVal(v);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isDirty.current = true;
    if (selectOnFocus) e.target.select();
    onFocus?.(e);
  };

  const handleBlur = () => {
    isDirty.current = false;
    onCommit(val);
  };

  const handleKeyDown = commitOnEnter
    ? (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }
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
