import { useId } from 'react';

interface FormFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  /** Mensaje de validación del campo (ej: "Las contraseñas no coinciden"). Lo anuncia el lector vía aria-invalid + aria-describedby y queda visible bajo el input. */
  error?: string;
}

/** Input con su label asociado (htmlFor + useId) en el estilo oscuro de auth. Ej: <FormField label="Email" type="email" onChange={...}/> en el login. */
function FormField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete,
  error,
}: FormFieldProps) {
  const fieldId = useId();
  const errorId = useId();
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block text-[10px] font-bold tracking-widest uppercase mb-1.5"
        style={{ color: '#8AB4D6', fontFamily: 'Geist, monospace' }}
      >
        {label}
      </label>
      <input
        id={fieldId}
        type={type}
        value={value}
        onChange={onChange}
        className="w-full h-10 px-3 border text-sm focus-visible:outline-2 focus-visible:outline-[#00dce5] transition-colors"
        style={{
          background: '#0a0e14',
          borderColor: error ? '#e5484d' : '#3a494a',
          color: '#e2e2e8',
          fontFamily: 'Geist, monospace',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#00dce5')}
        onBlur={(e) => (e.target.style.borderColor = error ? '#e5484d' : '#3a494a')}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-[12px]"
          style={{ color: '#e5484d', fontFamily: 'Geist, monospace' }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default FormField;
