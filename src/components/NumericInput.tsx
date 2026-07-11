import { LazyDecimalInput } from "./shared/LazyDecimalInput";
const NumericInput_S1: React.CSSProperties = { display: 'inline-block', textAlign: 'center', fontSize: 12, color: '#3a494a', fontFamily: "'Geist',monospace", padding: '2px 4px', border: '1px solid transparent', cursor: 'not-allowed' };


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
  return n.toFixed(decimals);
}

export function NumericInput({ value, onCommit, decimals = 2, width = 52, disabled, color, inputStyle, onFocus }: NumericInputProps) {
  if (disabled) {
    return (
      <span style={{ ...NumericInput_S1, width }}>
        {formatVal(value || 0, decimals)}
      </span>
    );
  }

  return (
    <LazyDecimalInput
      value={formatVal(value, decimals)}
      onCommit={(raw) => {
        const n = parseFloat(raw);
        onCommit(Number.isFinite(n) ? n : 0);
      }}
      ariaLabel={decimals === 0 ? 'Valor entero' : 'Valor numérico'}
      className="ni"
      style={{ width, padding: '2px 4px', fontSize: 12, textAlign: 'center', color: color || 'var(--txt)', ...(inputStyle as React.CSSProperties || {}) }}
      onFocus={onFocus}
      selectOnFocus
      commitOnEnter
    />
  );
}
