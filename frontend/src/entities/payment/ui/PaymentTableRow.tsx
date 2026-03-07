import React, { useState } from 'react';
import { Check, Edit2, RotateCcw, AlertCircle, Trash2, QrCode, Copy, X } from 'lucide-react';
import { Payment, PaymentStatus } from '../../../shared';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatCurrency, formatDate } from '../../../shared';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

interface PaymentTableRowProps {
  payment: Payment;
  subscriberInfo: { totalDebt: number; hasOverdue: boolean };
  onSendReminder: (id: string) => Promise<void>;
  onMarkPaid: (id: string) => Promise<void>;
  onEdit: (payment: Payment) => void;
  onUndo: (id: string) => void | Promise<void>;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const { totalDebt, hasOverdue } = subscriberInfo;
  const showTotalDebt = hasOverdue && payment.status !== PaymentStatus.PAID;

  const hasPix = !!payment.pixBrCode && (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.OVERDUE);

  function handleCopyPix() {
    if (!payment.pixBrCode) return;
    navigator.clipboard.writeText(payment.pixBrCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
    <ConfirmDialog
      isOpen={confirmDelete}
      title="Deletar Cobrança"
      message="Tem certeza que deseja deletar esta cobrança permanentemente? Esta ação não pode ser desfeita."
      onConfirm={() => onDelete(payment.id)}
      onClose={() => setConfirmDelete(false)}
      confirmLabel="Deletar"
      variant="danger"
    />

    {showPixModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPixModal(false)}>
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">QR Code PIX</h3>
            <button onClick={() => setShowPixModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-1">{payment.subscriberName}</p>
          <p className="text-lg font-bold text-slate-800 mb-4">{formatCurrency(payment.amount)} — Vence {formatDate(payment.dueDate)}</p>
          {payment.pixQrCodeBase64 && (
            <img src={payment.pixQrCodeBase64} alt="QR Code PIX" className="w-48 h-48 mx-auto mb-4 rounded-lg border border-slate-200" />
          )}
          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-slate-500 mb-1">Código PIX copia-e-cola:</p>
            <p className="text-xs text-slate-700 font-mono break-all">{payment.pixBrCode}</p>
          </div>
          <button
            onClick={handleCopyPix}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Copy size={16} />
            {copied ? 'Copiado!' : 'Copiar código PIX'}
          </button>
          {payment.pixExpiresAt && (
            <p className="text-xs text-slate-400 text-center mt-3">
              Válido até {formatDate(payment.pixExpiresAt.split('T')[0])}
            </p>
          )}
        </div>
      </div>
    )}
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
            {hasPix && (
              <button
                onClick={() => setShowPixModal(true)}
                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Ver QR Code PIX"
              >
                <QrCode size={18} />
              </button>
            )}
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
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Deletar Cobrança"
        >
          <Trash2 size={18} />
        </button>
      </td>
    </tr>
    </>
  );
};
