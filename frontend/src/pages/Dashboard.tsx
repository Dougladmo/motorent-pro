import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Calendar } from 'lucide-react';
import { PaymentStatus } from '../shared';
import { DashboardKPIs } from '../widgets/dashboard/DashboardKPIs';
import { DashboardChart } from '../widgets/dashboard/DashboardChart';
import { DashboardActivity } from '../widgets/dashboard/DashboardActivity';

type TimeRange = 'WEEK' | 'FORTNIGHT' | 'MONTH';

export const Dashboard: React.FC = () => {
  const { payments, rentals, motorcycles, loading } = useApp();
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
    { name: 'Recebido', value: filteredStats.totalRevenue, color: '#10b981' },
    { name: 'Pendente', value: filteredStats.totalPending, color: '#F59E0B' },
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
            <p className="text-slate-500 mt-1">Acompanhe o desempenho financeiro da sua frota.</p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <Calendar size={18} className="text-amber-500 ml-2" />
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
      <DashboardKPIs
        totalRevenue={filteredStats.totalRevenue}
        totalPending={filteredStats.totalPending}
        globalOverdue={globalOverdue}
        activeRentals={rentals.filter(r => r.isActive).length}
        availableBikes={motorcycles.filter(m => m.status === 'Disponível').length}
        rangeLabel={getRangeLabel()}
        loading={loading}
      />

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DashboardChart chartData={chartData} rangeLabel={getRangeLabel()} loading={loading} />
        <DashboardActivity recentActivity={recentActivity} loading={loading} />
      </div>
    </div>
  );
};