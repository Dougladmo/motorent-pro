import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Bike, Clock } from 'lucide-react';
import { KPICard } from '../../shared/ui/atoms/KPICard';
import { formatCurrency } from '../../shared';

interface DashboardKPIsProps {
  totalRevenue: number;
  totalPending: number;
  globalOverdue: number;
  activeRentals: number;
  availableBikes: number;
  rangeLabel: string;
}

export const DashboardKPIs: React.FC<DashboardKPIsProps> = ({
  totalRevenue,
  totalPending,
  globalOverdue,
  activeRentals,
  availableBikes,
  rangeLabel
}) => {
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
