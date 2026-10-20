import { LazyNum } from './LazyNum';

/** LazyNum con estilo por estado (ped. usuario): apagado = texto plano mono, encendido = input. */
export function LazyNumE({
  edit,
  value,
  onChange,
  ariaLabel,
  style,
  className,
}: {
  edit: boolean;
  value: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const estilo = edit
    ? style
    : {
        ...style,
        border: 'none',
        background: 'transparent',
        fontWeight: 600,
        color: 'var(--txt)',
      };
  return (
    <LazyNum
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      style={estilo}
      className={className}
      disabled={!edit}
    />
  );
}
