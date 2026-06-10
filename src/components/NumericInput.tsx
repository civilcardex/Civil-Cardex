interface NumericInputProps {
  val: number;
  onChange: (v: number) => void;
  cls?: string;
  w?: number;
  step?: number;
  min?: number;
  inputStyle?: Record<string, unknown>;
}

export function NumericInput({ val, onChange, cls = '', w = 52, step = 0.01, min = 0, inputStyle }: NumericInputProps) {
  return <input type="number" className={`ni ${cls}`} style={{ width: w, ...inputStyle }}
    value={val === 0 ? '' : val} step={step} min={min}
    onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} />;
}
