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
    default: { bg: 'bg-slate-100', text: 'text-slate-600' },
    success: { bg: 'bg-green-100', text: 'text-green-600' },
    warning: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
    danger: { bg: 'bg-red-100', text: 'text-red-600' }
  };

  const { bg, text } = variantStyles[variant];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-2">{value}</h3>
      </div>
      <div className={`p-2.5 ${bg} ${text} rounded-lg`}>
        {icon}
      </div>
    </div>
  );
};
