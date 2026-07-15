import { useState, type InputHTMLAttributes } from 'react';
import { fmt, parseNum } from '../calc';

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
  placeholder?: string;
}

export function NumInput({ value, onChange, decimals, format, placeholder, ...rest }: Props) {
  const [raw, setRaw] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const isEmpty = !focused && raw === null && (value === 0 || value === null || value === undefined || value === '');
  const displayVal =
    raw !== null
      ? raw
      : focused
        ? String(value)
        : format
          ? fmt(Number(value), typeof decimals === 'number' ? decimals : 2)
          : typeof decimals === 'number'
            ? Number(value).toFixed(decimals)
            : numVal(value, true);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nv = e.target.value;
    const parsedRaw = nv.replace(/,/g, '.');
    const isIncomplete = /[.,-]$/.test(nv) || nv === '-' || nv === '+' || nv === '';
    if (isIncomplete) {
      setRaw(nv);
      return;
    }
    const n = parseNum(parsedRaw);
    setRaw(null);
    onChange(n);
  }

  function handleBlur() { setRaw(null); setFocused(false); }
  function handleFocus(e: React.FocusEvent<HTMLInputElement>) { setFocused(true); e.target.select(); }

  if (placeholder) {
    return (
      <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
        <input className="cm-ni" value={isEmpty ? '' : displayVal} onChange={handleChange} onBlur={handleBlur} onFocus={handleFocus} {...rest} />
        {isEmpty && <span className="cm-ni-placeholder">{placeholder}</span>}
      </div>
    );
  }

  return <input className="cm-ni" value={displayVal} onChange={handleChange} onBlur={handleBlur} onFocus={handleFocus} {...rest} />;
}
