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

  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-4 ${border} flex items-start justify-between`}>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-2">{value}</h3>
      </div>
      <div className={`p-3 h-12 w-12 flex items-center justify-center ${bg} ${text} rounded-xl`}>
        {icon}
      </div>
    </div>
  );
};
