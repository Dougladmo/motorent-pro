import React from 'react';

interface FormInputProps {
  id: string;
  label: string;
  type?: 'text' | 'number' | 'tel' | 'date' | 'email';
  required?: boolean;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  className?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  id,
  label,
  type = 'text',
  required,
  value,
  onChange,
  placeholder,
  disabled,
  min,
  max,
  step,
  maxLength,
  className = ''
}) => {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  );
};
