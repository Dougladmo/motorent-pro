import React from 'react';
import { Payment, PaymentStatus } from '../../shared';
import { Skeleton } from '../../shared/ui/atoms/Skeleton';

interface ActivityPayment extends Payment {
  label: string;
}

interface DashboardActivityProps {
  recentActivity: ActivityPayment[];
  loading?: boolean;
}

export const DashboardActivity: React.FC<DashboardActivityProps> = ({ recentActivity, loading = false }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-bold text-slate-800">Atividade Recente</h3>
        <span className="text-xs bg-amber-50 text-amber-500 px-2 py-0.5 rounded-full font-medium">Recente</span>
      </div>
      <div className="space-y-4">
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
            <Skeleton className="mt-1 w-2 h-2 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
        {!loading && recentActivity.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0"
          >
            <div
              className={`mt-1 w-2 h-2 rounded-full ${
                activity.status === PaymentStatus.PAID
                  ? 'bg-emerald-500'
                  : activity.status === PaymentStatus.OVERDUE
                  ? 'bg-red-500'
                  : 'bg-amber-500'
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
        {!loading && recentActivity.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma atividade recente.</p>
        )}
      </div>
    </div>
  );
};
