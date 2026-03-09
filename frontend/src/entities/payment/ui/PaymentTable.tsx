import React from 'react';
import { Payment, Rental, PaymentStatus, Motorcycle } from '../../../shared';
import { PaymentTableRow } from './PaymentTableRow';
import { Skeleton } from '../../../shared/ui/atoms/Skeleton';

interface PaymentTableProps {
  payments: Payment[];
  rentals: Rental[];
  motorcycles: Motorcycle[];
  loading?: boolean;
  onEdit: (payment: Payment) => void;
  onSendReminder: (id: string) => Promise<void>;
  onMarkPaid: (id: string) => Promise<void>;
  onMarkUnpaid: (id: string) => void | Promise<void>;
  onDelete: (id: string) => Promise<void>;
  sendingId: string | null;
}

function getWeeksOverdue(payment: Payment): number {
  if (payment.status !== PaymentStatus.OVERDUE) return 0;
  if (payment.isAmountOverridden) return 0;
  const totalWeeks = Math.round(payment.amount / payment.expectedAmount);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  return payment.dueDate < todayStr ? totalWeeks : Math.max(0, totalWeeks - 1);
}

const PaymentRowSkeleton: React.FC = () => (
  <tr>
    <td className="px-6 py-4">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-3 w-24 mt-1" />
    </td>
    <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
    <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
    <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
    <td className="px-6 py-4 text-right">
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </td>
  </tr>
);

export const PaymentTable: React.FC<PaymentTableProps> = ({
  payments,
  rentals,
  motorcycles,
  loading = false,
  onEdit,
  onSendReminder,
  onMarkPaid,
  onMarkUnpaid,
  onDelete,
  sendingId
}) => {
  const getMotorcycle = (payment: Payment): Motorcycle | undefined => {
    const rental = rentals.find(r => r.id === payment.rentalId);
    if (!rental) return undefined;
    return motorcycles.find(m => m.id === rental.motorcycleId);
  };

  const getSubscriberInfo = (payment: Payment) => {
    const rental = rentals.find(r => r.id === payment.rentalId);
    if (!rental) return { totalDebt: payment.amount, hasOverdue: false };

    const allPaymentsForSubscriber = payments.filter(
      p => rentals.find(r => r.id === p.rentalId)?.subscriberId === rental.subscriberId
    );

    const totalDebt = allPaymentsForSubscriber
      .filter(p => p.status === PaymentStatus.OVERDUE || p.status === PaymentStatus.PENDING)
      .reduce((acc, p) => acc + p.amount, 0);

    const hasOverdue = allPaymentsForSubscriber.some(p => p.status === PaymentStatus.OVERDUE);

    return { totalDebt, hasOverdue };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Mobile card view */}
      <div className="md:hidden divide-y divide-slate-100">
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-end gap-1">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
        {!loading && payments.map((payment) => (
          <PaymentTableRow
            key={payment.id}
            payment={payment}
            subscriberInfo={getSubscriberInfo(payment)}
            motorcycle={getMotorcycle(payment)}
            weeksOverdue={getWeeksOverdue(payment)}
            onSendReminder={onSendReminder}
            onMarkPaid={onMarkPaid}
            onEdit={onEdit}
            onUndo={onMarkUnpaid}
            onDelete={onDelete}
            isSending={sendingId === payment.id}
            isMobile={true}
          />
        ))}
        {!loading && payments.length === 0 && (
          <p className="px-6 py-8 text-center text-slate-400">Nenhum pagamento encontrado.</p>
        )}
      </div>

      {/* Desktop table view */}
      <table className="hidden md:table w-full text-left border-collapse">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
          <tr>
            <th className="px-6 py-4">Assinante</th>
            <th className="px-6 py-4">Vencimento</th>
            <th className="px-6 py-4">Valor</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <PaymentRowSkeleton key={i} />
          ))}
          {!loading && payments.map((payment) => (
            <PaymentTableRow
              key={payment.id}
              payment={payment}
              subscriberInfo={getSubscriberInfo(payment)}
              motorcycle={getMotorcycle(payment)}
              weeksOverdue={getWeeksOverdue(payment)}
              onSendReminder={onSendReminder}
              onMarkPaid={onMarkPaid}
              onEdit={onEdit}
              onUndo={onMarkUnpaid}
              onDelete={onDelete}
              isSending={sendingId === payment.id}
            />
          ))}
          {!loading && payments.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                Nenhum pagamento encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
