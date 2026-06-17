import { useState, useEffect, useRef } from "react";

interface NumericInputProps {
  value: number;
  onCommit: (v: number) => void;
  decimals?: number;
  width?: number;
  disabled?: boolean;
  color?: string;
  inputStyle?: Record<string, unknown>;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

function formatVal(v: number, decimals: number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return (0).toFixed(decimals);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(decimals);
}

export function NumericInput({ value, onCommit, decimals = 2, width = 52, disabled, color, inputStyle, onFocus }: NumericInputProps) {
  const [text, setText] = useState(() => formatVal(value, decimals));
  const [focused, setFocused] = useState(false);
  const lastExtRef = useRef(value);

  useEffect(() => {
    if (focused) return;
    if (value !== lastExtRef.current) {
      lastExtRef.current = value;
      setText(formatVal(value, decimals));
    }
  }, [value, focused, decimals]);

  if (disabled) {
    return (
      <span style={{ width, display: 'inline-block', textAlign: 'center', fontSize: 11, color: '#3a494a', fontFamily: "'Geist',monospace", padding: '2px 4px', border: '1px solid transparent', cursor: 'not-allowed' }}>
        {formatVal(value || 0, decimals)}
      </span>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    const safe = firstDot < 0
      ? cleaned
      : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    setText(safe);
  };

  const commit = () => {
    const n = parseFloat(text);
    const finalVal = Number.isFinite(n) ? n : 0;
    lastExtRef.current = finalVal;
    onCommit(finalVal);
    setText(formatVal(finalVal, decimals));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className="ni"
      aria-label={decimals === 0 ? 'Valor entero' : 'Valor numérico'}
      style={{ width, padding: '2px 4px', fontSize: 11, textAlign: 'center', color: color || 'var(--txt)', ...(inputStyle as React.CSSProperties || {}) }}
      value={text}
      onChange={handleChange}
      onFocus={(e: React.FocusEvent<HTMLInputElement>) => { setFocused(true); e.target.select(); onFocus?.(e); }}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}
