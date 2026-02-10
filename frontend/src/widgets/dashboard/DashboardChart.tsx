import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

interface DashboardChartProps {
  chartData: ChartDataItem[];
  rangeLabel: string;
}

export const DashboardChart: React.FC<DashboardChartProps> = ({ chartData, rangeLabel }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
      <h3 className="text-lg font-bold text-slate-800 mb-6">Balanço ({rangeLabel})</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
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
