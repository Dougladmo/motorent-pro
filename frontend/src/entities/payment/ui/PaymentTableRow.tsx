import React from 'react';
import { Check, Edit2, RotateCcw, AlertCircle, Trash2 } from 'lucide-react';
import { Payment, PaymentStatus } from '../../../shared';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatCurrency, formatDate } from '../../../shared';

interface PaymentTableRowProps {
  payment: Payment;
  subscriberInfo: { totalDebt: number; hasOverdue: boolean };
  onSendReminder: (id: string) => Promise<void>;
  onMarkPaid: (id: string) => Promise<void>;
  onEdit: (payment: Payment) => void;
  onUndo: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isSending: boolean;
}

export const PaymentTableRow: React.FC<PaymentTableRowProps> = ({
  payment,
  subscriberInfo,
  onSendReminder,
  onMarkPaid,
  onEdit,
  onUndo,
  onDelete,
  isSending
}) => {
  const { totalDebt, hasOverdue } = subscriberInfo;
  const showTotalDebt = hasOverdue && payment.status !== PaymentStatus.PAID;

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-6 py-4 font-medium text-slate-800">{payment.subscriberName}</td>
      <td className="px-6 py-4 text-slate-600">{formatDate(payment.dueDate)}</td>
      <td className="px-6 py-4 text-slate-800 font-medium">
        <div>{formatCurrency(payment.amount)}</div>
        {showTotalDebt && (
          <div
            className="flex items-center gap-1 text-xs text-red-600 font-bold mt-1 bg-red-50 px-2 py-1 rounded w-fit"
            title="Total Acumulado (Atrasado + Pendente)"
          >
            <AlertCircle size={12} />
            <span>Total: {formatCurrency(totalDebt)}</span>
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={payment.status} />
      </td>
      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
        {payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.CANCELLED && (
          <>
            <button
              onClick={() => onEdit(payment)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Editar Pagamento"
            >
              <Edit2 size={18} />
            </button>
            <button
              onClick={() => onSendReminder(payment.id)}
              disabled={isSending}
              className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors relative disabled:opacity-50 disabled:cursor-not-allowed"
              title="Enviar Lembrete WhatsApp"
            >
              {isSending ? (
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  Enviando...
                </span>
              ) : (
                'Enviar lembrete manualmente'
              )}
              {payment.reminderSentCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-green-500 text-white text-[9px] flex items-center justify-center rounded-full">
                  {payment.reminderSentCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onMarkPaid(payment.id)}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Marcar como Pago"
            >
              <Check size={20} />
            </button>
          </>
        )}
        {payment.status === PaymentStatus.PAID && (
          <>
            <button
              onClick={() => onUndo(payment.id)}
              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              title="Reverter Pagamento"
            >
              <RotateCcw size={20} />
            </button>
            {payment.paidAt && (
              <span className="text-xs text-slate-400">Pago em {formatDate(payment.paidAt)}</span>
            )}
          </>
        )}
        {payment.status === PaymentStatus.CANCELLED && (
          <button
            onClick={async () => {
              if (window.confirm('Tem certeza que deseja deletar esta cobrança cancelada permanentemente?')) {
                await onDelete(payment.id);
              }
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Deletar Cobrança Cancelada"
          >
            <Trash2 size={18} />
          </button>
        )}
      </td>
    </tr>
  );
};
