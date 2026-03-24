import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, TooltipProps } from 'recharts';
import { Skeleton } from '../../shared/ui/atoms/Skeleton';

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

interface DashboardChartProps {
  chartData: ChartDataItem[];
  rangeLabel: string;
  loading?: boolean;
}

// Componente customizado para o Tooltip
const CustomTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
        <p className="font-semibold text-slate-800">{data.payload.name}</p>
        <p className="text-slate-600">
          <span className="font-medium">Valor:</span> R$ {(data.value as number).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

export const DashboardChart: React.FC<DashboardChartProps> = ({ chartData, rangeLabel, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="h-64 flex flex-col justify-around">
          {['w-3/4', 'w-1/2', 'w-2/3'].map((w, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className={`h-8 ${w} rounded`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
      <div className="flex items-center gap-3 mb-6">
        <h3 className="text-lg font-bold text-slate-800">Balanço</h3>
        <span className="bg-amber-50 text-amber-600 text-xs font-medium px-2 py-0.5 rounded-full">{rangeLabel}</span>
      </div>
      <div className="h-48 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={72} tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
