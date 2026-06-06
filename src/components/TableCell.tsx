import type { CSSProperties, ReactNode } from 'react';

const monoStyle: CSSProperties = { fontFamily: 'var(--mono)', fontSize: 11, padding: '0 1px' };

export function TdMono({ children, style, className, colSpan, bold, color, bg }: {
  children?: ReactNode; style?: CSSProperties; className?: string; colSpan?: number;
  bold?: boolean; color?: string; bg?: string;
}) {
  return (
    <td className={className ? `c ${className}` : 'c'} colSpan={colSpan} style={{
      ...monoStyle,
      ...(bold ? { fontWeight: 700 } : {}),
      ...(color ? { color } : {}),
      ...(bg ? { background: bg } : {}),
      ...style,
    }}>
      {children}
    </td>
  );
}

export function NumInput({ value, onChange, w = 44, step = 0.01 }: {
  value: number; onChange: (v: number) => void; w?: number; step?: number;
}) {
  return (
    <td className="c" style={{ padding: '0 1px' }}>
      <input type="number" className="ni" step={step}
        style={{ width: w, textAlign: 'center', padding: 0, fontSize: 11, fontFamily: 'var(--mono)' }}
        value={value === 0 ? '' : value}
        onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} />
    </td>
  );
}
