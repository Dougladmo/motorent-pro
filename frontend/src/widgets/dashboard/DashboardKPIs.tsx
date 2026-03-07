import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Bike, Clock } from 'lucide-react';
import { KPICard } from '../../shared/ui/atoms/KPICard';
import { Skeleton } from '../../shared/ui/atoms/Skeleton';
import { formatCurrency } from '../../shared';

interface DashboardKPIsProps {
  totalRevenue: number;
  totalPending: number;
  globalOverdue: number;
  activeRentals: number;
  availableBikes: number;
  rangeLabel: string;
  loading?: boolean;
}

const KPICardSkeleton: React.FC = () => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-slate-200 flex flex-col gap-3">
    <div className="flex items-start justify-between gap-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-10 rounded-xl" />
    </div>
    <Skeleton className="h-8 w-32" />
  </div>
);

export const DashboardKPIs: React.FC<DashboardKPIsProps> = ({
  totalRevenue,
  totalPending,
  globalOverdue,
  activeRentals,
  availableBikes,
  rangeLabel,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      <KPICard
        title={`Receita`}
        value={formatCurrency(totalRevenue)}
        icon={<TrendingUp size={18} />}
        variant="success"
      />
      <KPICard
        title={`Pendente`}
        value={formatCurrency(totalPending)}
        icon={<Clock size={18} />}
        variant="warning"
      />
      <KPICard
        title="Em Atraso"
        value={formatCurrency(globalOverdue)}
        icon={<AlertCircle size={18} />}
        variant="danger"
      />
      <KPICard
        title="Aluguéis Ativos"
        value={activeRentals}
        icon={<CheckCircle size={18} />}
        variant="default"
      />
      <KPICard
        title="Motos Disponíveis"
        value={availableBikes}
        icon={<Bike size={18} />}
        variant="default"
      />
    </div>
  );
};
