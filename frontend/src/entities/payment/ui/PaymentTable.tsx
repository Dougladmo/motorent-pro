import React from 'react';
import { Payment, Rental, PaymentStatus } from '../../../shared';
import { PaymentTableRow } from './PaymentTableRow';
import { Skeleton } from '../../../shared/ui/atoms/Skeleton';

interface PaymentTableProps {
  payments: Payment[];
  rentals: Rental[];
  loading?: boolean;
  onEdit: (payment: Payment) => void;
  onSendReminder: (id: string) => Promise<void>;
  onMarkPaid: (id: string) => Promise<void>;
  onMarkUnpaid: (id: string) => void | Promise<void>;
  onDelete: (id: string) => Promise<void>;
  sendingId: string | null;
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
  loading = false,
  onEdit,
  onSendReminder,
  onMarkPaid,
  onMarkUnpaid,
  onDelete,
  sendingId
}) => {
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
      <table className="w-full text-left border-collapse">
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
