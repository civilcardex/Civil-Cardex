import FormField from '../../components/FormField.tsx';

interface PwdFieldProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  /** Compartido entre campos de la misma página (mostrar/ocultar ambos a la vez). */
  show: boolean;
  onToggle: () => void;
}

/** FormField de contraseña + botón ojo para mostrar/ocultar. El estado `show` lo posee la
 *  página (Reset alterna password y confirmación juntos con un solo estado). */
export default function PwdField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder = '••••••••',
  required,
  minLength,
  show,
  onToggle,
}: PwdFieldProps): React.JSX.Element {
  return (
    <div style={{ position: 'relative' }}>
      <FormField
        label={label}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={show}
        className="absolute right-2 bottom-[12px] text-base opacity-50 hover:opacity-90 transition-opacity"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#8AB4D6',
          padding: 0,
          lineHeight: 1,
        }}
      >
        {show ? '⬡' : '👁'}
      </button>
    </div>
  );
}
