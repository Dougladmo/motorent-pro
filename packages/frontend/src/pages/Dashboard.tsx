import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, AlertCircle, CheckCircle, Bike, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PaymentStatus } from '../types';
import { formatCurrency } from '../utils/formatters';

type TimeRange = 'WEEK' | 'FORTNIGHT' | 'MONTH';

export const Dashboard: React.FC = () => {
  const { payments, rentals, motorcycles } = useApp();
  const [timeRange, setTimeRange] = useState<TimeRange>('MONTH');

  // Filter logic
  const filteredStats = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const startDate = new Date(today);
    
    if (timeRange === 'WEEK') {
        startDate.setDate(today.getDate() - 7);
    } else if (timeRange === 'FORTNIGHT') {
        startDate.setDate(today.getDate() - 15);
    } else {
        startDate.setDate(1); // Start of current month
    }

    const relevantPayments = payments.filter(p => {
        const d = new Date(p.dueDate);
        return d >= startDate && d <= today;
    });

    const totalRevenue = relevantPayments
        .filter(p => p.status === PaymentStatus.PAID)
        .reduce((acc, curr) => acc + curr.amount, 0);

    const totalPending = relevantPayments
        .filter(p => p.status === PaymentStatus.PENDING)
        .reduce((acc, curr) => acc + curr.amount, 0);

    const totalOverdue = payments // Overdue considers ALL time usually, but let's stick to the filter for "Revenue Analysis"
        .filter(p => p.status === PaymentStatus.OVERDUE)
        .reduce((acc, curr) => acc + curr.amount, 0); // Keep overdue global or scoped? Usually global overdue is more important. Let's keep global for Overdue to not hide debts.

    // Correction: User asked for "Filtro de receita". So Revenue and Pending should follow the filter. Overdue usually implies "Current Debts", so global is better, but consistent UI might want filtered.
    // Let's filter Revenue and Pending by range. Keep Overdue Global for the KPI card to be useful (Alert).
    
    return {
        totalRevenue,
        totalPending,
        totalOverdue, // This is global derived in next step if we want, or we mix. 
        // Let's keep Overdue global for the Alert Card, but Revenue/Pending filtered.
    };
  }, [payments, timeRange]);

  // Global overdue (not filtered by time, because debt is debt)
  const globalOverdue = payments
    .filter(p => p.status === PaymentStatus.OVERDUE)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const chartData = [
    { name: 'Recebido', value: filteredStats.totalRevenue, color: '#22c55e' },
    { name: 'Pendente', value: filteredStats.totalPending, color: '#eab308' },
    { name: 'Atrasado', value: globalOverdue, color: '#ef4444' },
  ];

  const recentActivity = payments
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
    .slice(0, 5)
    .map(p => ({
    ...p,
    label: p.status === PaymentStatus.PAID ? 'Pagamento Recebido' : p.status === PaymentStatus.OVERDUE ? 'Atraso Detectado' : 'Cobrança Gerada'
  }));

  const getRangeLabel = () => {
    switch(timeRange) {
        case 'WEEK': return 'Últimos 7 dias';
        case 'FORTNIGHT': return 'Últimos 15 dias';
        case 'MONTH': return 'Este Mês';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Visão Geral</h2>
            <p className="text-slate-500">Acompanhe o desempenho financeiro da sua frota.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <Calendar size={18} className="text-slate-400 ml-2" />
            <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer py-1.5 pr-8"
            >
                <option value="WEEK">Semana</option>
                <option value="FORTNIGHT">15 Dias</option>
                <option value="MONTH">Mês</option>
            </select>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Receita ({getRangeLabel()})</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">
              {formatCurrency(filteredStats.totalRevenue)}
            </h3>
          </div>
          <div className="p-3 bg-green-100 text-green-600 rounded-lg">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Em Atraso (Total)</p>
            <h3 className="text-2xl font-bold text-red-600 mt-2">
              {formatCurrency(globalOverdue)}
            </h3>
          </div>
          <div className="p-3 bg-red-100 text-red-600 rounded-lg">
            <AlertCircle size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Aluguéis Ativos</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">
              {rentals.filter(r => r.isActive).length}
            </h3>
          </div>
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <CheckCircle size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Motos Disponíveis</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">
              {motorcycles.filter(m => m.status === 'Disponível').length}
            </h3>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
            <Bike size={24} />
          </div>
        </div>
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Balanço ({getRangeLabel()})</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip 
                    cursor={{fill: 'transparent'}}
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

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Atividade Recente</h3>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                <div className={`mt-1 w-2 h-2 rounded-full ${
                    activity.status === PaymentStatus.PAID ? 'bg-green-500' :
                    activity.status === PaymentStatus.OVERDUE ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <div>
                  <p className="text-sm font-medium text-slate-800">{activity.label}</p>
                  <p className="text-xs text-slate-500">{activity.subscriberName} - R$ {activity.amount}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(activity.dueDate).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
                <p className="text-sm text-slate-400">Nenhuma atividade recente.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};