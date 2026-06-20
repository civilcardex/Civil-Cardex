import { useId } from 'react';

interface FormFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}

function FormField({ label, type = 'text', value, onChange, placeholder, required, autoComplete }: FormFieldProps) {
  const fieldId = useId();
  return (
    <div>
      <label htmlFor={fieldId} className="block text-[10px] font-bold tracking-widest uppercase mb-1.5"
        style={{ color: '#8AB4D6', fontFamily: 'Geist, monospace' }}>{label}</label>
      <input id={fieldId} type={type} value={value} onChange={onChange}
        className="w-full h-10 px-3 border text-sm focus-visible:outline-2 focus-visible:outline-[#00dce5] transition-colors"
        style={{ background: '#0a0e14', borderColor: '#3a494a', color: '#e2e2e8', fontFamily: 'Geist, monospace' }}
        onFocus={(e) => e.target.style.borderColor = '#00dce5'}
        onBlur={(e) => e.target.style.borderColor = '#3a494a'}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete} />
    </div>
  );
}

export default FormField;