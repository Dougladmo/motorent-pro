import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PaymentStatus, Payment } from '../shared';
import { Modal } from '../components/Modal';
import { AlertDialog } from '../components/AlertDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate } from '../shared/utils/formatters';
import { PaymentWeekStats } from '../widgets/payment-filters/PaymentWeekStats';
import { PaymentFiltersBar } from '../widgets/payment-filters/PaymentFiltersBar';
import { PaymentTable } from '../entities/payment/ui/PaymentTable';
import { PaymentEditForm } from '../features/payment-management/ui/PaymentEditForm';
import { BulkActionBar } from '../features/payment-management/ui/BulkActionBar';
import { useReminderQueue } from '../features/payment-management/hooks/useReminderQueue';

type FilterType = PaymentStatus | 'ALL' | 'CURRENT_WEEK' | 'DATE_RANGE';

export const Payments: React.FC = () => {
  const { payments, rentals, motorcycles, loading, markPaymentAsPaid, sendReminder, markPaymentAsUnpaid, updatePayment, deletePayment } = useApp();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({ amount: 0, dueDate: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const reminderQueue = useReminderQueue(sendReminder);

  // Bulk action confirmations
  const [bulkConfirm, setBulkConfirm] = useState<'reminder' | 'paid' | 'delete' | null>(null);

  // Dialogs
  const [alertDialog, setAlertDialog] = useState<{ message: string; variant: 'success' | 'error' | 'warning' | 'info'; title?: string } | null>(null);
  const [undoPaymentId, setUndoPaymentId] = useState<string | null>(null);
  const [undoReason, setUndoReason] = useState('');
  const [isUndoing, setIsUndoing] = useState(false);

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
    } finally {
      setSendingId(null);
    }
  };

  const handleUndoClick = (paymentId: string) => {
    setUndoReason('');
    setUndoPaymentId(paymentId);
  };

  const handleConfirmUndo = async () => {
    if (!undoPaymentId) return;
    setIsUndoing(true);
    try {
      await markPaymentAsUnpaid(undoPaymentId, undoReason.trim() || undefined);
      setUndoPaymentId(null);
      setAlertDialog({ message: 'Pagamento revertido com sucesso!', variant: 'success', title: 'Pagamento Revertido' });
    } catch (error: any) {
      setUndoPaymentId(null);
      setAlertDialog({ message: error.message, variant: 'error' });
    } finally {
      setIsUndoing(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    try {
      await deletePayment(paymentId);
      setAlertDialog({ message: 'Cobrança deletada com sucesso!', variant: 'success', title: 'Cobrança Deletada' });
    } catch (error: any) {
      setAlertDialog({ message: error.message, variant: 'error' });
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
      setAlertDialog({ message: 'Valor deve ser maior que zero.', variant: 'warning' });
      return;
    }

    try {
      await updatePayment(editingPayment.id, {
        amount: editForm.amount,
        dueDate: editForm.dueDate
      });

      setIsModalOpen(false);
      setEditingPayment(null);
      setAlertDialog({ message: 'Pagamento atualizado com sucesso!', variant: 'success', title: 'Pagamento Atualizado' });
    } catch (error: any) {
      setAlertDialog({ message: `Erro ao atualizar pagamento: ${error.message}`, variant: 'error' });
    }
  };

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const filteredIds = sortedPayments.map(p => p.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIds));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Clear selection when filter changes
  useEffect(() => {
    clearSelection();
  }, [filter, searchTerm, dateRange.start, dateRange.end]);

  // Bulk action handlers
  const handleBulkReminder = () => {
    const eligible = sortedPayments.filter(
      p => selectedIds.has(p.id) && (p.status === PaymentStatus.PENDING || p.status === PaymentStatus.OVERDUE)
    );
    if (eligible.length === 0) {
      setAlertDialog({ message: 'Nenhuma cobrança pendente ou atrasada selecionada.', variant: 'warning' });
      return;
    }
    setBulkConfirm('reminder');
  };

  const handleConfirmBulkReminder = () => {
    const eligible = sortedPayments.filter(
      p => selectedIds.has(p.id) && (p.status === PaymentStatus.PENDING || p.status === PaymentStatus.OVERDUE)
    );
    reminderQueue.enqueue(eligible.map(p => p.id));
    clearSelection();
  };

  const handleBulkMarkPaid = () => {
    if (selectedIds.size === 0) return;
    setBulkConfirm('paid');
  };

  const handleConfirmBulkMarkPaid = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await markPaymentAsPaid(id);
      } catch (error: any) {
        console.error(`Erro ao marcar pagamento ${id}:`, error);
      }
    }
    clearSelection();
    setAlertDialog({ message: `${ids.length} pagamento(s) marcado(s) como pago.`, variant: 'success', title: 'Pagamentos Aprovados' });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setBulkConfirm('delete');
  };

  const handleConfirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await deletePayment(id);
      } catch (error: any) {
        console.error(`Erro ao deletar pagamento ${id}:`, error);
      }
    }
    clearSelection();
    setAlertDialog({ message: `${ids.length} cobrança(s) deletada(s).`, variant: 'success', title: 'Cobranças Deletadas' });
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
      <AlertDialog
        isOpen={!!alertDialog}
        message={alertDialog?.message ?? ''}
        variant={alertDialog?.variant}
        title={alertDialog?.title}
        onClose={() => setAlertDialog(null)}
      />

      <ConfirmDialog
        isOpen={!!undoPaymentId}
        title="Reverter Pagamento"
        onConfirm={handleConfirmUndo}
        onClose={() => setUndoPaymentId(null)}
        confirmLabel={isUndoing ? 'Revertendo...' : 'Reverter'}
        confirmDisabled={isUndoing}
        cancelLabel="Cancelar"
        variant="default"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Este pagamento voltará ao status{' '}
            <span className="font-semibold">
              {(() => {
                const p = payments.find(p => p.id === undoPaymentId);
                if (p?.previousStatus && p.previousStatus !== PaymentStatus.PAID) {
                  return p.previousStatus;
                }
                return p && p.dueDate < new Date().toISOString().split('T')[0] ? 'Atrasado' : 'Pendente';
              })()}
            </span>.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Motivo da reversão <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={undoReason}
              onChange={e => setUndoReason(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Ex: Pagamento estornado..."
            />
          </div>
        </div>
      </ConfirmDialog>

       <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-slate-800">Controle de Cobranças</h2>
        <p className="text-slate-500 text-sm">
          Gerencie pagamentos e envie lembretes automáticos.
          {filter === 'CURRENT_WEEK' && (
            <span className="block mt-0.5 text-green-600 font-medium">
              📅 Semana: {formatDate(weekRange.start)} a {formatDate(weekRange.end)}
            </span>
          )}
          {filter === 'DATE_RANGE' && dateRange.start && dateRange.end && (
            <span className="block mt-0.5 text-purple-600 font-medium">
              📅 Período: {formatDate(dateRange.start)} a {formatDate(dateRange.end)}
            </span>
          )}
        </p>
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

      {/* Bulk action confirm dialogs */}
      <ConfirmDialog
        isOpen={bulkConfirm === 'reminder'}
        title="Disparar Lembretes"
        message={`Disparar lembretes para ${sortedPayments.filter(p => selectedIds.has(p.id) && (p.status === PaymentStatus.PENDING || p.status === PaymentStatus.OVERDUE)).length} cobrança(s)? Serão enviados 1 por vez com intervalo de 5 segundos.`}
        onConfirm={handleConfirmBulkReminder}
        onClose={() => setBulkConfirm(null)}
        confirmLabel="Disparar"
        variant="default"
      />
      <ConfirmDialog
        isOpen={bulkConfirm === 'paid'}
        title="Aprovar Pagamentos"
        message={`Confirma ${selectedIds.size} pagamento(s) como recebido(s)?`}
        onConfirm={handleConfirmBulkMarkPaid}
        onClose={() => setBulkConfirm(null)}
        confirmLabel="Aprovar"
        variant="default"
      />
      <ConfirmDialog
        isOpen={bulkConfirm === 'delete'}
        title="Deletar Cobranças"
        message={`Tem certeza que deseja deletar ${selectedIds.size} cobrança(s)? Esta ação não pode ser desfeita.`}
        onConfirm={handleConfirmBulkDelete}
        onClose={() => setBulkConfirm(null)}
        confirmLabel="Deletar"
        variant="danger"
      />

      {/* List */}
      <PaymentTable
        payments={sortedPayments}
        rentals={rentals}
        motorcycles={motorcycles}
        loading={loading}
        onEdit={handleEditClick}
        onSendReminder={handleSendReminder}
        onMarkPaid={markPaymentAsPaid}
        onMarkUnpaid={handleUndoClick}
        onDelete={handleDelete}
        sendingId={sendingId}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
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

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onBulkReminder={handleBulkReminder}
        onBulkMarkPaid={handleBulkMarkPaid}
        onBulkDelete={handleBulkDelete}
        onClearSelection={clearSelection}
        reminderQueue={reminderQueue}
        onCancelQueue={reminderQueue.cancel}
      />
    </div>
  );
};