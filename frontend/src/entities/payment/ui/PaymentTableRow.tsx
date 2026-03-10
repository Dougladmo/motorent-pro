import React, { useState, useEffect, useCallback } from 'react';
import { Check, Edit2, RotateCcw, AlertCircle, Trash2, QrCode, Copy, X, Bike } from 'lucide-react';
import { Payment, PaymentStatus, Motorcycle } from '../../../shared';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatCurrency, formatDate } from '../../../shared';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

// Cooldown progressivo: 1ª vez → 1min, 2ª → 5min, 3ª → 15min, 4ª+ → 30min
const COOLDOWN_LEVELS = [1 * 60, 5 * 60, 15 * 60, 30 * 60]; // segundos

function getCooldownSeconds(reminderCount: number): number {
  const idx = Math.min(reminderCount, COOLDOWN_LEVELS.length - 1);
  return COOLDOWN_LEVELS[idx];
}

function formatCountdown(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${seconds}s`;
}

function useCooldown(paymentId: string) {
  const storageKey = `reminder_cd_${paymentId}`;

  const getRemainingSeconds = useCallback((): number => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return 0;
    const { lockedUntil } = JSON.parse(raw) as { lockedUntil: number };
    return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  }, [storageKey]);

  const [remaining, setRemaining] = useState<number>(getRemainingSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      const r = getRemainingSeconds();
      setRemaining(r);
      if (r <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [remaining, getRemainingSeconds]);

  const lock = useCallback((reminderCount: number) => {
    const secs = getCooldownSeconds(reminderCount);
    localStorage.setItem(storageKey, JSON.stringify({ lockedUntil: Date.now() + secs * 1000 }));
    setRemaining(secs);
  }, [storageKey]);

  return { remaining, lock };
}

interface PaymentTableRowProps {
  payment: Payment;
  subscriberInfo: { totalDebt: number; hasOverdue: boolean };
  motorcycle?: Motorcycle;
  weeksOverdue: number;
  onSendReminder: (id: string) => Promise<void>;
  onMarkPaid: (id: string) => Promise<void>;
  onEdit: (payment: Payment) => void;
  onUndo: (id: string) => void | Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isSending: boolean;
  isMobile?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const PaymentTableRow: React.FC<PaymentTableRowProps> = ({
  payment,
  subscriberInfo,
  motorcycle,
  weeksOverdue,
  onSendReminder,
  onMarkPaid,
  onEdit,
  onUndo,
  onDelete,
  isSending,
  isMobile = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmMarkPaid, setConfirmMarkPaid] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const { remaining, lock } = useCooldown(payment.id);

  const inCooldown = remaining > 0;

  async function handleSendReminder() {
    if (inCooldown || isSending) return;
    await onSendReminder(payment.id);
    lock(payment.reminderSentCount); // bloqueia com base no envio atual
  }
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

  const dialogs = (
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

      <ConfirmDialog
        isOpen={confirmMarkPaid}
        title="Confirmar Pagamento"
        onConfirm={() => { setConfirmMarkPaid(false); onMarkPaid(payment.id); }}
        onClose={() => setConfirmMarkPaid(false)}
        confirmLabel="Confirmar Pagamento"
        variant="default"
      >
        <p className="text-sm text-slate-600">
          Confirma que o pagamento de <span className="font-semibold capitalize">{payment.subscriberName}</span> no valor de{' '}
          <span className="font-semibold">{formatCurrency(payment.amount)}</span> foi recebido?
        </p>
      </ConfirmDialog>

      {showPixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPixModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">QR Code PIX</h3>
              <button onClick={() => setShowPixModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-1 capitalize">{payment.subscriberName}</p>
            <p className="text-lg font-bold text-slate-800 mb-4">{formatCurrency(payment.amount)} — Vence {formatDate(payment.dueDate)}</p>
            {payment.pixPaymentUrl && payment.status !== 'Pago' && (
              <img src={payment.pixPaymentUrl} alt="QR Code PIX" className="w-48 h-48 mx-auto mb-4 rounded-lg border border-slate-200" />
            )}
            {payment.pixPaymentUrl && (
              <a
                href={payment.pixPaymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium mb-3"
              >
                Pagar agora
              </a>
            )}
            <div className="bg-slate-50 rounded-lg p-3 mb-3">
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
    </>
  );

  const actionButtons = (
    <>
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
            onClick={handleSendReminder}
            disabled={isSending || inCooldown}
            className="p-2 rounded-lg transition-colors relative disabled:cursor-not-allowed
              text-blue-600 hover:bg-blue-50
              disabled:text-slate-400 disabled:hover:bg-transparent"
            title={inCooldown ? `Aguarde ${formatCountdown(remaining)} para enviar novamente` : 'Enviar Lembrete WhatsApp'}
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : inCooldown ? (
              <span className="flex items-center gap-1 text-xs">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {formatCountdown(remaining)}
              </span>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            )}
            {payment.reminderSentCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[9px] flex items-center justify-center rounded-full">
                {payment.reminderSentCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setConfirmMarkPaid(true)}
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
          {!isMobile && payment.paidAt && (
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
    </>
  );

  if (isMobile) {
    return (
      <>
        {dialogs}
        <div className="p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(payment.id)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 flex-shrink-0 cursor-pointer"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 truncate capitalize">{payment.subscriberName}</p>
              {motorcycle && (
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <Bike size={11} />
                  {motorcycle.model} • {motorcycle.plate}
                </p>
              )}
              <p className="text-sm text-slate-500 mt-0.5">{formatDate(payment.dueDate)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={payment.status} className="flex-shrink-0" />
              {weeksOverdue > 0 && (
                <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                  {weeksOverdue} {weeksOverdue === 1 ? 'sem.' : 'sem.'} atraso
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-800">{formatCurrency(payment.amount)}</span>
              {showTotalDebt && (
                <div className="flex items-center gap-1 text-xs text-red-600 font-bold mt-1 bg-red-50 px-2 py-0.5 rounded w-fit">
                  <AlertCircle size={11} />
                  <span>Total: {formatCurrency(totalDebt)}</span>
                </div>
              )}
              {payment.status === PaymentStatus.PAID && payment.paidAt && (
                <p className="text-xs text-slate-400 mt-0.5">Pago em {formatDate(payment.paidAt)}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {actionButtons}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    {dialogs}
    <tr className="hover:bg-slate-50 transition-colors">
      {onToggleSelect && (
        <td className="px-3 py-4 w-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(payment.id)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </td>
      )}
      <td className="px-6 py-4">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-800 capitalize">{payment.subscriberName}</span>
          {motorcycle && (
            <div className="group relative inline-flex items-center">
              <Bike size={14} className="text-slate-400 cursor-default hover:text-slate-600 transition-colors" />
              <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-20 hidden group-hover:block bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                <span className="font-medium">{motorcycle.model}</span>
                <span className="text-slate-300 mx-1">•</span>
                <span>{motorcycle.plate}</span>
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800" />
              </div>
            </div>
          )}
        </div>
      </td>
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
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={payment.status} />
          {weeksOverdue > 0 && (
            <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 whitespace-nowrap">
              {weeksOverdue} {weeksOverdue === 1 ? 'semana' : 'semanas'} em atraso
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {actionButtons}
        </div>
      </td>
    </tr>
    </>
  );
};
