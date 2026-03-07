import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MotorcycleStatus, Subscriber, PaymentStatus } from '../shared';
import { Plus, Check, AlertTriangle } from 'lucide-react';
import { WEEK_DAYS } from '../shared';
import { validatePhone, validateCPF, validatePositiveNumber } from '../shared';
import { formatPhone, formatCPF, formatCurrency } from '../shared';
import { SubscriberGrid } from '../entities/subscriber/ui/SubscriberGrid';
import { FormInput } from '../shared/ui/atoms/FormInput';
import { FormSelect } from '../shared/ui/atoms/FormSelect';
import { AlertDialog } from '../components/AlertDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const Subscribers: React.FC = () => {
  const { subscribers, motorcycles, loading, addSubscriber, updateSubscriber, createRental, rentals, payments, deleteSubscriber, terminateRental } = useApp();
  const [view, setView] = useState<'LIST' | 'NEW_SUB' | 'EDIT_SUB' | 'NEW_RENTAL'>('LIST');
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);

  // Forms state
  const [subForm, setSubForm] = useState({ name: '', phone: '', document: '', email: '' });
  const [rentalForm, setRentalForm] = useState({
    subscriberId: '',
    motorcycleId: '',
    weeklyValue: 250,
    dueDayOfWeek: 1,
    contractDurationMonths: 12
  });

  // Dialogs
  const [alertDialog, setAlertDialog] = useState<{ message: string; variant: 'success' | 'error' | 'warning' | 'info'; title?: string } | null>(null);
  const [terminatingRental, setTerminatingRental] = useState<{ rentalId: string; subscriberName: string; bikePlate: string; outstandingBalance: number } | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [isTerminating, setIsTerminating] = useState(false);

  const handleCreateSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!subForm.name.trim()) {
      setAlertDialog({ message: 'Nome é obrigatório.', variant: 'warning' });
      return;
    }

    if (!validatePhone(subForm.phone)) {
      setAlertDialog({ message: 'Telefone inválido. Use o formato (00) 00000-0000.', variant: 'warning' });
      return;
    }

    if (subForm.document && !validateCPF(subForm.document)) {
      setAlertDialog({ message: 'CPF inválido.', variant: 'warning' });
      return;
    }

    try {
      if (editingSubscriber) {
        await updateSubscriber(editingSubscriber.id, {
          name: subForm.name,
          phone: subForm.phone,
          document: subForm.document,
          email: subForm.email || undefined,
          active: true
        });
      } else {
        await addSubscriber({ ...subForm, email: subForm.email || undefined, active: true });
      }

      setView('LIST');
      setEditingSubscriber(null);
      setSubForm({ name: '', phone: '', document: '', email: '' });
    } catch (error) {
      console.error('Erro ao salvar assinante:', error);
      setAlertDialog({ message: 'Erro ao salvar assinante. Tente novamente.', variant: 'error' });
    }
  };

  const handleEditClick = (subscriber: Subscriber) => {
    setEditingSubscriber(subscriber);
    setSubForm({
      name: subscriber.name,
      phone: subscriber.phone,
      document: subscriber.document,
      email: subscriber.email || ''
    });
    setView('EDIT_SUB');
  };

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!rentalForm.subscriberId) {
      setAlertDialog({ message: 'Selecione um assinante.', variant: 'warning' });
      return;
    }

    if (!rentalForm.motorcycleId) {
      setAlertDialog({ message: 'Selecione uma moto.', variant: 'warning' });
      return;
    }

    if (!validatePositiveNumber(rentalForm.weeklyValue)) {
      setAlertDialog({ message: 'Valor semanal deve ser maior que zero.', variant: 'warning' });
      return;
    }

    try {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + rentalForm.contractDurationMonths);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const { contractDurationMonths, ...rentalData } = rentalForm;

      await createRental({
          ...rentalData,
          startDate: startDateStr,
          endDate: endDateStr,
          isActive: true,
          outstandingBalance: 0
      });

      setView('LIST');
      setRentalForm({ subscriberId: '', motorcycleId: '', weeklyValue: 250, dueDayOfWeek: 1, contractDurationMonths: 12 });
    } catch (error) {
      console.error('Erro ao criar aluguel:', error);
      setAlertDialog({ message: 'Erro ao criar aluguel. Tente novamente.', variant: 'error' });
    }
  };

  const availableBikes = motorcycles.filter(m => m.status === MotorcycleStatus.AVAILABLE);

  const handleDeleteSubscriber = async (id: string) => {
    try {
      await deleteSubscriber(id);
    } catch (error: any) {
      setAlertDialog({ message: `Erro ao excluir assinante: ${error.message}`, variant: 'error', title: 'Erro ao excluir' });
    }
  };

  const handleTerminateRental = (rentalId: string, subscriberName: string, bikePlate: string) => {
    const rentalPayments = payments.filter(p => p.rentalId === rentalId);
    const totalPaid = rentalPayments.filter(p => p.status === PaymentStatus.PAID).reduce((sum, p) => sum + p.amount, 0);
    const totalExpected = rentalPayments.filter(p => p.status !== PaymentStatus.CANCELLED).reduce((sum, p) => sum + p.amount, 0);
    const outstandingBalance = totalExpected - totalPaid;

    setTerminateReason('');
    setTerminatingRental({ rentalId, subscriberName, bikePlate, outstandingBalance });
  };

  const handleConfirmTerminate = async () => {
    if (!terminatingRental) return;
    setIsTerminating(true);
    try {
      await terminateRental(terminatingRental.rentalId, terminateReason.trim() || 'Rescisão de contrato');
      setTerminatingRental(null);
      setAlertDialog({ message: 'Contrato rescindido com sucesso! A moto foi liberada e os pagamentos futuros foram cancelados.', variant: 'success', title: 'Contrato Rescindido' });
    } catch (error: any) {
      setTerminatingRental(null);
      setAlertDialog({ message: `Erro ao rescindir contrato: ${error.message}`, variant: 'error' });
    } finally {
      setIsTerminating(false);
    }
  };

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
        isOpen={!!terminatingRental}
        title={`Rescindir Contrato`}
        onConfirm={handleConfirmTerminate}
        onClose={() => setTerminatingRental(null)}
        confirmLabel={isTerminating ? 'Rescindindo...' : 'Rescindir'}
        confirmDisabled={isTerminating}
        cancelLabel="Cancelar"
        variant="danger"
      >
        {terminatingRental && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Rescindir contrato de <span className="font-semibold">{terminatingRental.subscriberName}</span> ({terminatingRental.bikePlate}).
            </p>
            {terminatingRental.outstandingBalance > 0 && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">
                  <span className="font-semibold">Saldo devedor: {formatCurrency(terminatingRental.outstandingBalance)}</span>. Este valor continuará registrado após a rescisão.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motivo da rescisão <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={terminateReason}
                onChange={e => setTerminateReason(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                placeholder="Ex: Devolução antecipada, inadimplência..."
              />
            </div>
          </div>
        )}
      </ConfirmDialog>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Assinantes</h2>
          <p className="text-slate-500">Gestão de clientes e contratos.</p>
        </div>
        <div className="flex gap-3">
            <button
                onClick={() => setView('NEW_SUB')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-blue-900/20"
            >
                <Plus size={18} />
                Novo Assinante
            </button>
        </div>
      </header>

      {/* Main Content */}
      {view === 'LIST' && (
        <SubscriberGrid
          subscribers={subscribers}
          rentals={rentals}
          motorcycles={motorcycles}
          payments={payments}
          loading={loading}
          onEdit={handleEditClick}
          onDelete={handleDeleteSubscriber}
          onTerminateRental={handleTerminateRental}
        />
      )}

      {(view === 'NEW_SUB' || view === 'EDIT_SUB') && (
         <div className="bg-white max-w-2xl mx-auto p-8 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
             <h3 className="text-xl font-bold text-slate-800 mb-6">
                {editingSubscriber ? 'Editar Assinante' : 'Cadastrar Assinante'}
             </h3>
             <form onSubmit={handleCreateSubscriber} className="space-y-5">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                    <input
                        id="name"
                        required
                        type="text"
                        value={subForm.name}
                        onChange={e => setSubForm({...subForm, name: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg p-3"
                        placeholder="Ex: João Silva"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                        <input
                            id="phone"
                            required
                            type="tel"
                            placeholder="(00) 00000-0000"
                            value={formatPhone(subForm.phone)}
                            onChange={e => setSubForm({...subForm, phone: e.target.value.replace(/\D/g, '')})}
                            className="w-full border border-slate-300 rounded-lg p-3"
                        />
                    </div>
                    <div>
                        <label htmlFor="document" className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                        <input
                            id="document"
                            type="text"
                            value={formatCPF(subForm.document)}
                            onChange={e => setSubForm({...subForm, document: e.target.value.replace(/\D/g, '')})}
                            className="w-full border border-slate-300 rounded-lg p-3"
                            placeholder="000.000.000-00"
                            maxLength={14}
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-slate-400 font-normal">(opcional)</span></label>
                    <input
                        id="email"
                        type="email"
                        value={subForm.email}
                        onChange={e => setSubForm({...subForm, email: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg p-3"
                        placeholder="exemplo@email.com"
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={() => {
                            setView('LIST');
                            setEditingSubscriber(null);
                            setSubForm({ name: '', phone: '', document: '', email: '' });
                        }}
                        className="px-6 py-2 text-slate-600 font-medium"
                    >
                        Cancelar
                    </button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium">
                        {editingSubscriber ? 'Atualizar' : 'Salvar'}
                    </button>
                </div>
             </form>
         </div>
      )}

      {view === 'NEW_RENTAL' && (
         <div className="bg-white max-w-2xl mx-auto p-8 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
             <h3 className="text-xl font-bold text-slate-800 mb-6">Novo Contrato de Aluguel</h3>
             <form onSubmit={handleCreateRental} className="space-y-5">
                <div>
                    <label htmlFor="subscriber" className="block text-sm font-medium text-slate-700 mb-1">Assinante</label>
                    <select
                        id="subscriber"
                        required
                        value={rentalForm.subscriberId}
                        onChange={e => setRentalForm({...rentalForm, subscriberId: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg p-3 bg-white"
                    >
                        <option value="">Selecione...</option>
                        {subscribers.map(s => <option key={s.id} value={s.id}>{s.name} ({formatCPF(s.document)})</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="motorcycle" className="block text-sm font-medium text-slate-700 mb-1">Moto Disponível</label>
                    <select
                        id="motorcycle"
                        required
                        value={rentalForm.motorcycleId}
                        onChange={e => setRentalForm({...rentalForm, motorcycleId: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg p-3 bg-white"
                    >
                        <option value="">Selecione...</option>
                        {availableBikes.map(m => <option key={m.id} value={m.id}>{m.model} - {m.plate}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label htmlFor="weeklyValue" className="block text-sm font-medium text-slate-700 mb-1">Valor Semanal (R$)</label>
                        <input
                            id="weeklyValue"
                            required
                            type="number"
                            value={rentalForm.weeklyValue}
                            onChange={e => setRentalForm({...rentalForm, weeklyValue: Number(e.target.value)})}
                            className="w-full border border-slate-300 rounded-lg p-3"
                            min={0}
                            step={0.01}
                        />
                    </div>
                    <div>
                        <label htmlFor="dueDay" className="block text-sm font-medium text-slate-700 mb-1">Dia de Vencimento</label>
                        <select
                            id="dueDay"
                            required
                            value={rentalForm.dueDayOfWeek}
                            onChange={e => setRentalForm({...rentalForm, dueDayOfWeek: Number(e.target.value)})}
                            className="w-full border border-slate-300 rounded-lg p-3 bg-white"
                        >
                            {WEEK_DAYS.map((day, idx) => <option key={idx} value={idx}>{day}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-1">Duração do Contrato</label>
                    <select
                        id="duration"
                        required
                        value={rentalForm.contractDurationMonths}
                        onChange={e => setRentalForm({...rentalForm, contractDurationMonths: Number(e.target.value)})}
                        className="w-full border border-slate-300 rounded-lg p-3 bg-white"
                    >
                        <option value={6}>6 meses</option>
                        <option value={12}>1 ano (12 meses)</option>
                        <option value={18}>18 meses</option>
                        <option value={24}>2 anos (24 meses)</option>
                        <option value={36}>3 anos (36 meses)</option>
                    </select>
                </div>
                <div className="space-y-3">
                    <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-sm text-blue-800">
                        <Check className="shrink-0" size={20} />
                        <p>Ao salvar, uma cobrança inicial será gerada automaticamente e o status da moto mudará para "Alugada".</p>
                    </div>
                    {rentalForm.weeklyValue > 0 && rentalForm.contractDurationMonths > 0 && (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <p className="text-sm font-semibold text-slate-700 mb-2">📊 Resumo do Contrato</p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-slate-500">Valor semanal:</span>
                                    <p className="font-bold text-slate-800">R$ {rentalForm.weeklyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Valor mensal (aprox.):</span>
                                    <p className="font-bold text-slate-800">R$ {(rentalForm.weeklyValue * 4.33).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Duração:</span>
                                    <p className="font-bold text-slate-800">{rentalForm.contractDurationMonths} meses</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Total estimado:</span>
                                    <p className="font-bold text-green-600">R$ {(rentalForm.weeklyValue * 4.33 * rentalForm.contractDurationMonths).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => setView('LIST')} className="px-6 py-2 text-slate-600 font-medium">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium">Criar Aluguel</button>
                </div>
             </form>
         </div>
      )}
    </div>
  );
};
