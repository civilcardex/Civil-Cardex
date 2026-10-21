import React from 'react';
import { LazyDecimalInput } from '../shared/LazyDecimalInput.tsx';

/** Input numérico perezoso: solo avisa el cambio al salir del campo (blur/Enter), para no pelear con el valor formateado mientras se escribe. */
export function LazyNum({
  value,
  onChange,
  ariaLabel,
  style,
  className,
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <LazyDecimalInput
      value={value?.toString() ?? ''}
      onCommit={(raw) => {
        const p = parseFloat(raw);
        onChange(Number.isFinite(p) ? p : 0);
      }}
      ariaLabel={ariaLabel}
      style={style}
      className={className}
      disabled={disabled}
    />
  );
}
