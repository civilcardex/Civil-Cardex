import { LazyNum } from './LazyNum';
import { estiloPlano } from './styles';

export function FilaParamNum(props: {
  label: string;
  ariaLabel: string;
  value: number;
  onChange: (v: number) => void;
  unidad: string;
  disabled?: boolean;
}) {
  const { label, ariaLabel, value, onChange, unidad, disabled = false } = props;
  return (
    <tr>
      <td style={{ fontWeight: 600, padding: '3px 4px', textAlign: 'left' }}>{label}</td>
      <td style={{ textAlign: 'right', padding: '2px 4px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            justifyContent: 'flex-end',
            width: '100%',
          }}
        >
          <LazyNum
            disabled={disabled}
            style={disabled ? estiloPlano : undefined}
            ariaLabel={ariaLabel}
            value={value}
            onChange={onChange}
            className="ni"
          />
          <span style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>
            {unidad}
          </span>
        </div>
      </td>
    </tr>
  );
}
