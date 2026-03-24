import React from 'react';
import { formatCurrency } from '../../shared';

interface PaymentWeekStatsProps {
  stats: {
    total: number;
    totalAmount: number;
    pendingAmount: number;
    paidAmount: number;
    pending: number;
    overdue: number;
    paid: number;
  };
}

export const PaymentWeekStats: React.FC<PaymentWeekStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
        <p className="text-xs font-medium text-red-700 mb-1">Total Semana</p>
        <p className="text-2xl font-bold text-red-950">{stats.total}</p>
        <p className="text-sm text-red-800 mt-1">{formatCurrency(stats.totalAmount)}</p>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
        <p className="text-xs font-medium text-green-600 mb-1">Pagos</p>
        <p className="text-2xl font-bold text-green-900">{stats.paid}</p>
        <p className="text-sm text-green-700 mt-1">{formatCurrency(stats.paidAmount)}</p>
      </div>
      <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
        <p className="text-xs font-medium text-yellow-600 mb-1">Pendentes</p>
        <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
      </div>
      <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
        <p className="text-xs font-medium text-red-600 mb-1">Atrasados</p>
        <p className="text-2xl font-bold text-red-900">{stats.overdue}</p>
      </div>
    </div>
  );
};
