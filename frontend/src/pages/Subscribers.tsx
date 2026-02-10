import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MotorcycleStatus, Subscriber } from '../shared';
import { Plus, Key, Check } from 'lucide-react';
import { WEEK_DAYS } from '../shared';
import { validatePhone, validateCPF, validatePositiveNumber } from '../shared';
import { formatPhone, formatCPF } from '../shared';
import { SubscriberGrid } from '../entities/subscriber/ui/SubscriberGrid';
import { FormInput } from '../shared/ui/atoms/FormInput';
import { FormSelect } from '../shared/ui/atoms/FormSelect';

export const Subscribers: React.FC = () => {
  const { subscribers, motorcycles, addSubscriber, updateSubscriber, createRental, rentals, deleteSubscriber, terminateRental } = useApp();
  const [view, setView] = useState<'LIST' | 'NEW_SUB' | 'EDIT_SUB' | 'NEW_RENTAL'>('LIST');
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);

  // Log para debug
  console.log('👥 [SUBSCRIBERS PAGE] Renderizando com:', {
    subscribers: subscribers.length,
    motorcycles: motorcycles.length,
    rentals: rentals.length,
    activeRentals: rentals.filter(r => r.isActive).length
  });
  
  // Forms state
  const [subForm, setSubForm] = useState({ name: '', phone: '', document: '' });
  const [rentalForm, setRentalForm] = useState({
    subscriberId: '',
    motorcycleId: '',
    weeklyValue: 250,
    dueDayOfWeek: 1,
    contractDurationMonths: 12 // Duração padrão: 1 ano
  });

  const handleCreateSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!subForm.name.trim()) {
      alert('Nome é obrigatório.');
      return;
    }

    if (!validatePhone(subForm.phone)) {
      alert('Telefone inválido. Use o formato (00) 00000-0000.');
      return;
    }

    if (subForm.document && !validateCPF(subForm.document)) {
      alert('CPF inválido.');
      return;
    }

    try {
      if (editingSubscriber) {
        // Modo edição
        await updateSubscriber(editingSubscriber.id, {
          name: subForm.name,
          phone: subForm.phone,
          document: subForm.document,
          active: true
        });
      } else {
        // Modo criação
        await addSubscriber({ ...subForm, active: true });
      }

      setView('LIST');
      setEditingSubscriber(null);
      setSubForm({ name: '', phone: '', document: '' });
    } catch (error) {
      console.error('Erro ao salvar assinante:', error);
      alert('Erro ao salvar assinante. Tente novamente.');
    }
  };

  const handleEditClick = (subscriber: Subscriber) => {
    setEditingSubscriber(subscriber);
    setSubForm({
      name: subscriber.name,
      phone: subscriber.phone,
      document: subscriber.document
    });
    setView('EDIT_SUB');
  };

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!rentalForm.subscriberId) {
      alert('Selecione um assinante.');
      return;
    }

    if (!rentalForm.motorcycleId) {
      alert('Selecione uma moto.');
      return;
    }

    if (!validatePositiveNumber(rentalForm.weeklyValue)) {
      alert('Valor semanal deve ser maior que zero.');
      return;
    }

    try {
      // Calcular data de término (data início + duração em meses)
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + rentalForm.contractDurationMonths);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log('📅 [CONTRACT] Duração do contrato:', {
        startDate: startDateStr,
        endDate: endDateStr,
        durationMonths: rentalForm.contractDurationMonths,
        durationDays: Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      });

      await createRental({
          ...rentalForm,
          startDate: startDateStr,
          endDate: endDateStr,
          isActive: true,
          outstandingBalance: 0
      });

      console.log('✅ [RENTAL CREATED] Aluguel criado com sucesso');
      setView('LIST');
      setRentalForm({ subscriberId: '', motorcycleId: '', weeklyValue: 250, dueDayOfWeek: 1, contractDurationMonths: 12 });
    } catch (error) {
      console.error('Erro ao criar aluguel:', error);
      alert('Erro ao criar aluguel. Tente novamente.');
    }
  };

  const availableBikes = motorcycles.filter(m => m.status === MotorcycleStatus.AVAILABLE);

  const handleTerminateRental = async (rentalId: string, subscriberName: string, bikePlate: string) => {
    const reason = window.prompt(
      `Rescindir contrato de ${subscriberName} (${bikePlate}).\n\n` +
      `Informe o motivo da rescisão:`
    );

    if (!reason || reason.trim() === '') {
      return; // Usuário cancelou
    }

    try {
      await terminateRental(rentalId, reason.trim());
      alert('✅ Contrato rescindido com sucesso!\n\nA moto foi liberada e os pagamentos futuros foram cancelados.');
    } catch (error: any) {
      alert(`❌ Erro ao rescindir contrato: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Assinantes</h2>
          <p className="text-slate-500">Gestão de clientes e contratos.</p>
        </div>
        <div className="flex gap-3">
             <button 
                onClick={() => setView('NEW_RENTAL')}
                disabled={availableBikes.length === 0}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg flex items-center gap-2 font-medium disabled:opacity-50"
            >
                <Key size={18} />
                Novo Aluguel
            </button>
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
          onEdit={handleEditClick}
          onDelete={deleteSubscriber}
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
                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={() => {
                            setView('LIST');
                            setEditingSubscriber(null);
                            setSubForm({ name: '', phone: '', document: '' });
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
                                    <p className="font-bold text-slate-800">R$ {rentalForm.weeklyValue.toFixed(2)}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Valor mensal (aprox.):</span>
                                    <p className="font-bold text-slate-800">R$ {(rentalForm.weeklyValue * 4.33).toFixed(2)}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Duração:</span>
                                    <p className="font-bold text-slate-800">{rentalForm.contractDurationMonths} meses</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Total estimado:</span>
                                    <p className="font-bold text-green-600">R$ {(rentalForm.weeklyValue * 4.33 * rentalForm.contractDurationMonths).toFixed(2)}</p>
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
