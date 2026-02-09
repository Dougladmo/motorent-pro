import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PaymentStatus, Payment } from '../types';
import { MessageCircle, Check, AlertTriangle, Filter, Search, AlertCircle, RotateCcw, Calendar, CalendarRange } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../utils/formatters';

type FilterType = PaymentStatus | 'ALL' | 'CURRENT_WEEK' | 'DATE_RANGE';

export const Payments: React.FC = () => {
  const { payments, rentals, markPaymentAsPaid, sendReminder, markPaymentAsUnpaid } = useApp();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Calcula início e fim da semana atual (segunda a domingo)
  const getCurrentWeekRange = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (domingo) a 6 (sábado)

    // Ajustar para segunda-feira ser o início da semana
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return {
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0]
    };
  };

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
    let matchesFilter = true;

    if (filter === 'CURRENT_WEEK') {
      const { start, end } = getCurrentWeekRange();
      matchesFilter = p.dueDate >= start && p.dueDate <= end;
    } else if (filter === 'DATE_RANGE') {
      if (dateRange.start && dateRange.end) {
        matchesFilter = p.dueDate >= dateRange.start && p.dueDate <= dateRange.end;
      } else if (dateRange.start) {
        matchesFilter = p.dueDate >= dateRange.start;
      } else if (dateRange.end) {
        matchesFilter = p.dueDate <= dateRange.end;
      }
    } else if (filter !== 'ALL') {
      matchesFilter = p.status === filter;
    }

    const matchesSearch = p.subscriberName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Sort: Overdue first, then by date
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    if (a.status === PaymentStatus.OVERDUE && b.status !== PaymentStatus.OVERDUE) return -1;
    if (a.status !== PaymentStatus.OVERDUE && b.status === PaymentStatus.OVERDUE) return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const weekRange = getCurrentWeekRange();

  // Estatísticas da semana quando filtro ativo
  const weekStats = useMemo(() => {
    if (filter !== 'CURRENT_WEEK') return null;

    const weekPayments = payments.filter(p => {
      return p.dueDate >= weekRange.start && p.dueDate <= weekRange.end;
    });

    const totalAmount = weekPayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = weekPayments
      .filter(p => p.status === PaymentStatus.PENDING || p.status === PaymentStatus.OVERDUE)
      .reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = weekPayments
      .filter(p => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      total: weekPayments.length,
      totalAmount,
      pendingAmount,
      paidAmount,
      pending: weekPayments.filter(p => p.status === PaymentStatus.PENDING).length,
      overdue: weekPayments.filter(p => p.status === PaymentStatus.OVERDUE).length,
      paid: weekPayments.filter(p => p.status === PaymentStatus.PAID).length
    };
  }, [payments, filter, weekRange]);

  return (
    <div className="space-y-6">
       <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Controle de Cobranças</h2>
            <p className="text-slate-500">
              Gerencie pagamentos e envie lembretes automáticos.
              {filter === 'CURRENT_WEEK' && (
                <span className="ml-2 text-green-600 font-medium">
                  📅 Semana: {formatDate(weekRange.start)} a {formatDate(weekRange.end)}
                </span>
              )}
              {filter === 'DATE_RANGE' && dateRange.start && dateRange.end && (
                <span className="ml-2 text-purple-600 font-medium">
                  📅 Período: {formatDate(dateRange.start)} a {formatDate(dateRange.end)}
                </span>
              )}
            </p>
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

      {/* Estatísticas da Semana Atual */}
      {weekStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
            <p className="text-xs font-medium text-blue-600 mb-1">Total Semana</p>
            <p className="text-2xl font-bold text-blue-900">{weekStats.total}</p>
            <p className="text-sm text-blue-700 mt-1">{formatCurrency(weekStats.totalAmount)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
            <p className="text-xs font-medium text-green-600 mb-1">Pagos</p>
            <p className="text-2xl font-bold text-green-900">{weekStats.paid}</p>
            <p className="text-sm text-green-700 mt-1">{formatCurrency(weekStats.paidAmount)}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
            <p className="text-xs font-medium text-yellow-600 mb-1">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-900">{weekStats.pending}</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
            <p className="text-xs font-medium text-red-600 mb-1">Atrasados</p>
            <p className="text-2xl font-bold text-red-900">{weekStats.overdue}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {/* Filtro especial: Semana Atual */}
          <button
            onClick={() => {
              setFilter('CURRENT_WEEK');
              setShowDatePicker(false);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              filter === 'CURRENT_WEEK'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-green-200 hover:bg-green-50'
            }`}
          >
            <Calendar size={16} />
            Semana Atual
          </button>

          {/* Filtro de período personalizado */}
          <button
            onClick={() => {
              setFilter('DATE_RANGE');
              setShowDatePicker(!showDatePicker);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              filter === 'DATE_RANGE'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-purple-200 hover:bg-purple-50'
            }`}
          >
            <CalendarRange size={16} />
            Período
          </button>

          {/* Filtros de status */}
          {([PaymentStatus.PENDING, PaymentStatus.OVERDUE, PaymentStatus.PAID, PaymentStatus.CANCELLED] as const).map((status) => (
              <button
                  key={status}
                  onClick={() => {
                    setFilter(status);
                    setShowDatePicker(false);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      filter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
              >
                  {status}
              </button>
          ))}
        </div>

        {/* Date Range Picker */}
        {showDatePicker && filter === 'DATE_RANGE' && (
          <div className="bg-white border border-purple-200 rounded-lg p-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">De:</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Até:</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={() => {
                setDateRange({ start: '', end: '' });
                setFilter('ALL');
                setShowDatePicker(false);
              }}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Limpar
            </button>
          </div>
        )}
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
                                        className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors relative disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Enviar Lembrete WhatsApp"
                                    >
                                        {sendingId === payment.id ? (
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