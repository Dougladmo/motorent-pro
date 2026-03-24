import React from 'react';

interface FormSelectOption {
  value: string | number;
  label: string;
}

interface FormSelectProps {
  id: string;
  label: string;
  required?: boolean;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: FormSelectOption[];
  disabled?: boolean;
  className?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  id,
  label,
  required,
  value,
  onChange,
  options,
  disabled,
  className = ''
}) => {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <select
        id={id}
        required={required}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
