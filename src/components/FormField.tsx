import React, { useId } from 'react';

interface FormFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
}

function FormField({ label, type = 'text', value, onChange, placeholder, required }: FormFieldProps) {
  const fieldId = useId();
  return (
    <div>
      <label htmlFor={fieldId} className="block text-[10px] font-bold tracking-widest uppercase mb-1.5"
        style={{ color: '#6b8cae', fontFamily: 'Geist, monospace' }}>{label}</label>
      <input id={fieldId} type={type} value={value} onChange={onChange}
        className="w-full h-10 px-3 border text-sm focus:outline-none transition-colors"
        style={{ background: '#0a0e14', borderColor: '#3a494a', color: '#e2e2e8', fontFamily: 'Geist, monospace' }}
        onFocus={(e) => e.target.style.borderColor = '#00dce5'}
        onBlur={(e) => e.target.style.borderColor = '#3a494a'}
        placeholder={placeholder}
        required={required} />
    </div>
  );
}

export default FormField;
