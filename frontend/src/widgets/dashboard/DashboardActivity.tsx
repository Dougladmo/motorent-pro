import React from 'react';
import { Payment, PaymentStatus } from '../../shared';

interface ActivityPayment extends Payment {
  label: string;
}

interface DashboardActivityProps {
  recentActivity: ActivityPayment[];
}

export const DashboardActivity: React.FC<DashboardActivityProps> = ({ recentActivity }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Atividade Recente</h3>
      <div className="space-y-4">
        {recentActivity.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0"
          >
            <div
              className={`mt-1 w-2 h-2 rounded-full ${
                activity.status === PaymentStatus.PAID
                  ? 'bg-green-500'
                  : activity.status === PaymentStatus.OVERDUE
                  ? 'bg-red-500'
                  : 'bg-yellow-500'
              }`}
            />
            <div>
              <p className="text-sm font-medium text-slate-800">{activity.label}</p>
              <p className="text-xs text-slate-500">
                {activity.subscriberName} - R$ {activity.amount}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(activity.dueDate).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
        {recentActivity.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma atividade recente.</p>
        )}
      </div>
    </div>
  );
};
