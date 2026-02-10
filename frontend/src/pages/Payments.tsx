import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PaymentStatus, Payment } from '../shared';
import { Modal } from '../components/Modal';
import { Search } from 'lucide-react';
import { formatDate } from '../shared/utils/formatters';
import { PaymentWeekStats } from '../widgets/payment-filters/PaymentWeekStats';
import { PaymentFiltersBar } from '../widgets/payment-filters/PaymentFiltersBar';
import { PaymentTable } from '../entities/payment/ui/PaymentTable';
import { PaymentEditForm } from '../features/payment-management/ui/PaymentEditForm';

type FilterType = PaymentStatus | 'ALL' | 'CURRENT_WEEK' | 'DATE_RANGE';

export const Payments: React.FC = () => {
  const { payments, rentals, markPaymentAsPaid, sendReminder, markPaymentAsUnpaid, updatePayment } = useApp();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({ amount: 0, dueDate: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleEditClick = (payment: Payment) => {
    setEditingPayment(payment);
    setEditForm({
      amount: payment.amount,
      dueDate: payment.dueDate
    });
    setIsModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingPayment) return;

    if (editForm.amount <= 0) {
      alert('Valor deve ser maior que zero.');
      return;
    }

    try {
      await updatePayment(editingPayment.id, {
        amount: editForm.amount,
        dueDate: editForm.dueDate
      });

      setIsModalOpen(false);
      setEditingPayment(null);
      alert('✅ Pagamento atualizado com sucesso!');
    } catch (error: any) {
      alert(`❌ Erro ao atualizar pagamento: ${error.message}`);
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
      {weekStats && <PaymentWeekStats stats={weekStats} />}

      {/* Filters */}
      <PaymentFiltersBar
        filter={filter}
        onFilterChange={setFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showDatePicker={showDatePicker}
        onToggleDatePicker={() => setShowDatePicker(!showDatePicker)}
        onClearDateRange={() => {
          setDateRange({ start: '', end: '' });
          setFilter('ALL');
          setShowDatePicker(false);
        }}
      />

      {/* List */}
      <PaymentTable
        payments={sortedPayments}
        rentals={rentals}
        onEdit={handleEditClick}
        onSendReminder={handleSendReminder}
        onMarkPaid={markPaymentAsPaid}
        onMarkUnpaid={handleUndo}
        sendingId={sendingId}
      />

      {/* Modal de Edição */}
      {editingPayment && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingPayment(null);
          }}
          title="Editar Pagamento"
        >
          <PaymentEditForm
            payment={editingPayment}
            onSubmit={async (updates) => {
              await updatePayment(editingPayment.id, updates);
              setIsModalOpen(false);
              setEditingPayment(null);
            }}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingPayment(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
};