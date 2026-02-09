import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PaymentStatus, Payment } from '../types';
import { MessageCircle, Check, AlertTriangle, Filter, Search, AlertCircle, RotateCcw } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../utils/formatters';

export const Payments: React.FC = () => {
  const { payments, rentals, markPaymentAsPaid, sendReminder, markPaymentAsUnpaid } = useApp();
  const [filter, setFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleSendReminder = async (id: string) => {
    try {
      setSendingId(id);
      await sendReminder(id);
    } catch (error) {
      console.error('Erro ao enviar lembrete:', error);
      alert('Erro ao enviar lembrete. Tente novamente.');
    } finally {
      setSendingId(null);
    }
  };

  const handleUndo = async (paymentId: string) => {
    const reason = window.prompt('Motivo da reversão (opcional):');
    try {
      markPaymentAsUnpaid(paymentId, reason || undefined);
      alert('✅ Pagamento revertido com sucesso!');
    } catch (error: any) {
      alert(`❌ Erro: ${error.message}`);
    }
  };

  const getSubscriberInfo = useMemo(() => {
    return (payment: Payment) => {
      const currentRental = rentals.find(r => r.id === payment.rentalId);
      if (!currentRental) return { totalDebt: 0, hasOverdue: false };

      const subscriberId = currentRental.subscriberId;

      // Find all rentals for this subscriber (could be multiple bikes)
      const subRentalIds = rentals
          .filter(r => r.subscriberId === subscriberId)
          .map(r => r.id);

      // Get all payments for this subscriber
      const subPayments = payments.filter(p => subRentalIds.includes(p.rentalId));

      const totalDebt = subPayments
          .filter(p => p.status === PaymentStatus.OVERDUE || p.status === PaymentStatus.PENDING)
          .reduce((sum, p) => sum + p.amount, 0);

      const hasOverdue = subPayments.some(p => p.status === PaymentStatus.OVERDUE);

      return { totalDebt, hasOverdue };
    };
  }, [rentals, payments]);

  const filteredPayments = payments.filter(p => {
    const matchesFilter = filter === 'ALL' || p.status === filter;
    const matchesSearch = p.subscriberName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Sort: Overdue first, then by date
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    if (a.status === PaymentStatus.OVERDUE && b.status !== PaymentStatus.OVERDUE) return -1;
    if (a.status !== PaymentStatus.OVERDUE && b.status === PaymentStatus.OVERDUE) return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div className="space-y-6">
       <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Controle de Cobranças</h2>
            <p className="text-slate-500">Gerencie pagamentos e envie lembretes automáticos.</p>
        </div>
        <div className="flex gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar assinante..." 
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
      </header>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['ALL', PaymentStatus.PENDING, PaymentStatus.OVERDUE, PaymentStatus.PAID, PaymentStatus.CANCELLED] as const).map((status) => (
            <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
            >
                {status === 'ALL' ? 'Todos' : status}
            </button>
        ))}
      </div>

      {/* List */}
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
                {sortedPayments.map((payment) => {
                    const { totalDebt, hasOverdue } = getSubscriberInfo(payment);
                    const showTotalDebt = hasOverdue && payment.status !== PaymentStatus.PAID;

                    return (
                    <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">{payment.subscriberName}</td>
                        <td className="px-6 py-4 text-slate-600">
                            {formatDate(payment.dueDate)}
                        </td>
                        <td className="px-6 py-4 text-slate-800 font-medium">
                            <div>{formatCurrency(payment.amount)}</div>
                            {showTotalDebt && (
                                <div className="flex items-center gap-1 text-xs text-red-600 font-bold mt-1 bg-red-50 px-2 py-1 rounded w-fit" title="Total Acumulado (Atrasado + Pendente)">
                                    <AlertCircle size={12} />
                                    <span>Total: {formatCurrency(totalDebt)}</span>
                                </div>
                            )}
                        </td>
                        <td className="px-6 py-4">
                            <StatusBadge status={payment.status} />
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                            {payment.status !== PaymentStatus.PAID && (
                                <>
                                    <button 
                                        onClick={() => handleSendReminder(payment.id)}
                                        disabled={sendingId === payment.id}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors relative group"
                                        title="Enviar Lembrete WhatsApp"
                                    >
                                        {sendingId === payment.id ? (
                                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <MessageCircle size={20} />
                                        )}
                                        {payment.reminderSentCount > 0 && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[10px] flex items-center justify-center rounded-full">
                                                {payment.reminderSentCount}
                                            </span>
                                        )}
                                    </button>
                                    <button 
                                        onClick={() => markPaymentAsPaid(payment.id)}
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
                                        onClick={() => handleUndo(payment.id)}
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
                        </td>
                    </tr>
                )})}
                {sortedPayments.length === 0 && (
                    <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                            Nenhum pagamento encontrado.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};