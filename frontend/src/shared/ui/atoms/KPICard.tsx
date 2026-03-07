import React from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon,
  variant = 'default'
}) => {
  const variantStyles = {
    default: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-600' },
    success: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-500' },
    warning: { bg: 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-500' },
    danger: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-500' }
  };

  const { bg, text, border } = variantStyles[variant];

  const valueStr = String(value);
  const valueSizeClass = valueStr.length > 12 ? 'text-lg' : valueStr.length > 8 ? 'text-xl' : 'text-2xl';

  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-4 ${border} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 leading-snug">{title}</p>
        <div className={`p-2 h-10 w-10 flex-shrink-0 flex items-center justify-center ${bg} ${text} rounded-xl`}>
          {icon}
        </div>
      </div>
      <h3 className={`${valueSizeClass} font-bold text-slate-800 leading-tight`}>{value}</h3>
    </div>
  );
};
