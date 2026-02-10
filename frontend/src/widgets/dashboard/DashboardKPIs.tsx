import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Bike } from 'lucide-react';
import { KPICard } from '../../shared/ui/atoms/KPICard';
import { formatCurrency } from '../../shared';

interface DashboardKPIsProps {
  totalRevenue: number;
  globalOverdue: number;
  activeRentals: number;
  availableBikes: number;
  rangeLabel: string;
}

export const DashboardKPIs: React.FC<DashboardKPIsProps> = ({
  totalRevenue,
  globalOverdue,
  activeRentals,
  availableBikes,
  rangeLabel
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KPICard
        title={`Receita (${rangeLabel})`}
        value={formatCurrency(totalRevenue)}
        icon={<TrendingUp size={24} />}
        variant="success"
      />
      <KPICard
        title="Em Atraso (Total)"
        value={formatCurrency(globalOverdue)}
        icon={<AlertCircle size={24} />}
        variant="danger"
      />
      <KPICard
        title="Aluguéis Ativos"
        value={activeRentals}
        icon={<CheckCircle size={24} />}
        variant="default"
      />
      <KPICard
        title="Motos Disponíveis"
        value={availableBikes}
        icon={<Bike size={24} />}
        variant="default"
      />
    </div>
  );
};
