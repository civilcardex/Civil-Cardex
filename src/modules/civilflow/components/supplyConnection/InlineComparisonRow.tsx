import { LazyNum } from './LazyNum';
import { fmt } from '../../utils/formatUtils';
import { estiloPlano } from './styles';

export function FilaComparativaInline(props: {
  valor: number;
  cumple: boolean;
  op: string;
  ariaLabel: string;
  value: number;
  onChange: (v: number) => void;
  unidad: string;
  disabled?: boolean;
}) {
  const { valor, cumple, op, ariaLabel, value, onChange, unidad, disabled = false } = props;
  return (
    <>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontWeight: 700,
          color: cumple ? 'var(--succ)' : 'var(--err)',
        }}
      >
        {fmt(valor)}
      </span>
      <span style={{ fontSize: 12, color: 'var(--txt3)' }}>{op}</span>
      <LazyNum
        disabled={disabled}
        style={
          disabled
            ? estiloPlano
            : {
                width: '44px',
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 700,
                padding: '2px',
              }
        }
        ariaLabel={ariaLabel}
        value={value}
        onChange={onChange}
        className="ni"
      />
      <span style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>{unidad}</span>
    </>
  );
}
