import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { subscriberApi } from '../services/api';
import { MotorcycleStatus, Subscriber, PaymentStatus } from '../shared';
import { Plus, Check, AlertTriangle, Pencil } from 'lucide-react';
import { WEEK_DAYS } from '../shared';
import { validatePhone, validateCPF, validatePositiveNumber } from '../shared';
import { formatCPF, formatCurrency, capitalizeName } from '../shared';
import { SubscriberGrid } from '../entities/subscriber/ui/SubscriberGrid';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { SubscriberDocument } from '../shared/types/subscriber';

import { SubFormState, emptySubForm, fetchCep, buildSubscriberPayload } from './subscribers/types';
import { SubscriberView } from './subscribers/SubscriberView';
import { SubscriberForm } from './subscribers/SubscriberForm';

export const Subscribers: React.FC = () => {
  const {
    subscribers, motorcycles, loading, addSubscriber, updateSubscriber,
    createRental, rentals, payments, deleteSubscriber, terminateRental,
    getSubscriberDocuments, addSubscriberDocument, deleteSubscriberDocument
  } = useApp();

  const [view, setView] = useState<'LIST' | 'NEW_RENTAL'>('LIST');
  const [isNewSubModalOpen, setIsNewSubModalOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [subForm, setSubForm] = useState<SubFormState>(emptySubForm());
  const [rentalForm, setRentalForm] = useState({
    subscriberId: '',
    motorcycleId: '',
    weeklyValue: 250,
    dueDayOfWeek: 1,
    contractDurationMonths: 12,
    customDuration: false
  });

  const [documents, setDocuments] = useState<SubscriberDocument[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const [terminatingRental, setTerminatingRental] = useState<{ rentalId: string; subscriberName: string; bikePlate: string; outstandingBalance: number } | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [isTerminating, setIsTerminating] = useState(false);

  // ─── CEP lookup ────────────────────────────────────────────────────────────
  const handleCepBlur = async () => {
    const cep = subForm.addressZip;
    if (!cep || cep.replace(/\D/g, '').length !== 8) return;
    const data = await fetchCep(cep);
    if (!data) return;
    setSubForm(f => ({
      ...f,
      addressStreet: data.logradouro || f.addressStreet,
      addressNeighborhood: data.bairro || f.addressNeighborhood,
      addressCity: data.localidade || f.addressCity,
      addressState: data.uf || f.addressState
    }));
  };

  const handleRealDriverCepBlur = async () => {
    const cep = subForm.realDriverAddressZip;
    if (!cep || cep.replace(/\D/g, '').length !== 8) return;
    const data = await fetchCep(cep);
    if (!data) return;
    setSubForm(f => ({
      ...f,
      realDriverAddressStreet: data.logradouro || f.realDriverAddressStreet,
      realDriverAddressNeighborhood: data.bairro || f.realDriverAddressNeighborhood,
      realDriverAddressCity: data.localidade || f.realDriverAddressCity,
      realDriverAddressState: data.uf || f.realDriverAddressState
    }));
  };

  // ─── Create / Update subscriber ─────────────────────────────────────────────
  const handleCreateSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subForm.name.trim()) { toast.error('Nome é obrigatório.'); return; }
    if (!validatePhone(subForm.phone)) { toast.error('Telefone inválido. Use o formato (00) 00000-0000.'); return; }
    if (subForm.document && !validateCPF(subForm.document)) { toast.error('CPF inválido.'); return; }

    try {
      const payload = buildSubscriberPayload({ ...subForm, name: capitalizeName(subForm.name) });
      if (editingSubscriber) {
        await updateSubscriber(editingSubscriber.id, payload as any);
        handleCloseModal();
        toast.success('Assinante atualizado com sucesso!');
      } else {
        await addSubscriber(payload as any);
        setIsNewSubModalOpen(false);
        setSubForm(emptySubForm());
        toast.success('Assinante cadastrado com sucesso!');
      }
    } catch (error: any) {
      toast.error(error.message ?? 'Erro ao salvar assinante. Tente novamente.');
    }
  };

  // ─── Open edit modal ─────────────────────────────────────────────────────────
  const handleEditClick = async (subscriber: Subscriber) => {
    try {
      const fresh = await subscriberApi.getById(subscriber.id) as any;
      setEditingSubscriber(subscriber);
      setSubForm({
        name: fresh.name ?? subscriber.name,
        phone: fresh.phone ?? subscriber.phone,
        document: fresh.document ?? subscriber.document,
        email: fresh.email ?? subscriber.email ?? '',
        notes: fresh.notes ?? subscriber.notes ?? '',
        birthDate: fresh.birth_date ?? subscriber.birthDate ?? '',
        addressZip: fresh.address_zip ?? subscriber.addressZip ?? '',
        addressStreet: fresh.address_street ?? subscriber.addressStreet ?? '',
        addressNumber: fresh.address_number ?? subscriber.addressNumber ?? '',
        addressComplement: fresh.address_complement ?? subscriber.addressComplement ?? '',
        addressNeighborhood: fresh.address_neighborhood ?? subscriber.addressNeighborhood ?? '',
        addressCity: fresh.address_city ?? subscriber.addressCity ?? '',
        addressState: fresh.address_state ?? subscriber.addressState ?? '',
        isRealDriver: fresh.is_real_driver ?? subscriber.isRealDriver ?? true,
        realDriverName: fresh.real_driver_name ?? subscriber.realDriverName ?? '',
        realDriverDocument: fresh.real_driver_document ?? subscriber.realDriverDocument ?? '',
        realDriverPhone: fresh.real_driver_phone ?? subscriber.realDriverPhone ?? '',
        realDriverRelationship: fresh.real_driver_relationship ?? subscriber.realDriverRelationship ?? '',
        realDriverAddressZip: fresh.real_driver_address_zip ?? subscriber.realDriverAddressZip ?? '',
        realDriverAddressStreet: fresh.real_driver_address_street ?? subscriber.realDriverAddressStreet ?? '',
        realDriverAddressNumber: fresh.real_driver_address_number ?? subscriber.realDriverAddressNumber ?? '',
        realDriverAddressComplement: fresh.real_driver_address_complement ?? subscriber.realDriverAddressComplement ?? '',
        realDriverAddressNeighborhood: fresh.real_driver_address_neighborhood ?? subscriber.realDriverAddressNeighborhood ?? '',
        realDriverAddressCity: fresh.real_driver_address_city ?? subscriber.realDriverAddressCity ?? '',
        realDriverAddressState: fresh.real_driver_address_state ?? subscriber.realDriverAddressState ?? '',
        autoRemindersEnabled: fresh.auto_reminders_enabled ?? subscriber.autoRemindersEnabled ?? true
      });
      const docs = await getSubscriberDocuments(subscriber.id);
      setDocuments(docs);
    } catch {
      setEditingSubscriber(subscriber);
      setSubForm({ ...emptySubForm(), name: subscriber.name, phone: subscriber.phone, document: subscriber.document, email: subscriber.email ?? '', isRealDriver: subscriber.isRealDriver ?? true, autoRemindersEnabled: subscriber.autoRemindersEnabled ?? true });
      setDocuments([]);
    }
    setIsViewModalOpen(true);
    setIsEditing(false);
  };

  const handleCloseModal = () => {
    setIsViewModalOpen(false);
    setIsEditing(false);
    setEditingSubscriber(null);
    setSubForm(emptySubForm());
    setDocuments([]);
  };

  // ─── Document handlers ────────────────────────────────────────────────────────
  const handleDocumentUpload = async (formData: FormData) => {
    if (!editingSubscriber) return;
    setUploadLoading(true);
    try {
      const doc = await addSubscriberDocument(editingSubscriber.id, formData);
      setDocuments(prev => [doc, ...prev]);
      toast.success('Documento adicionado com sucesso!');
    } catch (error: any) {
      toast.error(`Erro ao enviar documento: ${error.message}`);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDocumentDelete = async (docId: string) => {
    if (!editingSubscriber) return;
    setDeletingDocId(docId);
    try {
      await deleteSubscriberDocument(editingSubscriber.id, docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      toast.success('Documento removido com sucesso!');
    } catch (error: any) {
      toast.error(`Erro ao remover documento: ${error.message}`);
    } finally {
      setDeletingDocId(null);
    }
  };

  // ─── Rental ────────────────────────────────────────────────────────────────
  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentalForm.subscriberId) { toast.error('Selecione um assinante.'); return; }
    if (!rentalForm.motorcycleId) { toast.error('Selecione uma moto.'); return; }
    if (!validatePositiveNumber(rentalForm.weeklyValue)) { toast.error('Valor semanal deve ser maior que zero.'); return; }

    try {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + rentalForm.contractDurationMonths);
      const { contractDurationMonths, customDuration, ...rentalData } = rentalForm;
      await createRental({ ...rentalData, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], isActive: true, outstandingBalance: 0 });
      setView('LIST');
      setRentalForm({ subscriberId: '', motorcycleId: '', weeklyValue: 250, dueDayOfWeek: 1, contractDurationMonths: 12, customDuration: false });
      toast.success('Aluguel criado com sucesso!');
    } catch (error: any) {
      toast.error(error.message ?? 'Erro ao criar aluguel. Tente novamente.');
    }
  };

  const availableBikes = motorcycles.filter(m => m.status === MotorcycleStatus.AVAILABLE);

  const handleDeleteSubscriber = async (id: string) => {
    try {
      await deleteSubscriber(id);
    } catch (error: any) {
      toast.error(`Erro ao excluir assinante: ${error.message}`);
    }
  };

  const handleTerminateRental = (rentalId: string, subscriberName: string, bikePlate: string) => {
    const rentalPayments = payments.filter(p => p.rentalId === rentalId);
    const totalPaid = rentalPayments.filter(p => p.status === PaymentStatus.PAID).reduce((sum, p) => sum + p.amount, 0);
    const totalExpected = rentalPayments.filter(p => p.status !== PaymentStatus.CANCELLED).reduce((sum, p) => sum + p.amount, 0);
    setTerminateReason('');
    setTerminatingRental({ rentalId, subscriberName, bikePlate, outstandingBalance: totalExpected - totalPaid });
  };

  const handleConfirmTerminate = async () => {
    if (!terminatingRental) return;
    setIsTerminating(true);
    try {
      await terminateRental(terminatingRental.rentalId, terminateReason.trim() || 'Rescisão de contrato');
      setTerminatingRental(null);
      toast.success('Contrato rescindido com sucesso! A moto foi liberada e os pagamentos futuros foram cancelados.');
    } catch (error: any) {
      setTerminatingRental(null);
      toast.error(`Erro ao rescindir contrato: ${error.message}`);
    } finally {
      setIsTerminating(false);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        isOpen={!!terminatingRental}
        title="Rescindir Contrato"
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
                <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">
                  <span className="font-semibold">Saldo devedor: {formatCurrency(terminatingRental.outstandingBalance)}</span>. Este valor continuará registrado após a rescisão.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da rescisão <span className="text-slate-400 font-normal">(opcional)</span></label>
              <textarea value={terminateReason} onChange={e => setTerminateReason(e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                placeholder="Ex: Devolução antecipada, inadimplência..." />
            </div>
          </div>
        )}
      </ConfirmDialog>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Assinantes</h2>
          <p className="text-slate-500">Gestão de clientes e contratos.</p>
        </div>
        <button
          onClick={() => setIsNewSubModalOpen(true)}
          className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-red-950/20"
        >
          <Plus size={18} /> Novo Assinante
        </button>
      </header>

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

      {/* New subscriber modal */}
      <Modal
        isOpen={isNewSubModalOpen}
        onClose={() => { setIsNewSubModalOpen(false); setSubForm(emptySubForm()); }}
        title="Cadastrar Assinante"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateSubscriber} className="space-y-3">
          <SubscriberForm form={subForm} onChange={setSubForm} onCepBlur={handleCepBlur} onRealDriverCepBlur={handleRealDriverCepBlur} />
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => { setIsNewSubModalOpen(false); setSubForm(emptySubForm()); }} className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">
              Cancelar
            </button>
            <button type="submit" className="px-6 py-2 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800">
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      {/* View / Edit subscriber modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={handleCloseModal}
        title={isEditing ? 'Editar Assinante' : 'Dados do Assinante'}
        maxWidth="2xl"
        headerAction={
          !isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Pencil size={14} /> Editar
            </button>
          ) : undefined
        }
      >
        {isEditing ? (
          <form onSubmit={handleCreateSubscriber} className="space-y-3">
            <SubscriberForm
              form={subForm}
              onChange={setSubForm}
              onCepBlur={handleCepBlur}
              onRealDriverCepBlur={handleRealDriverCepBlur}
              isEdit
              subscriberId={editingSubscriber?.id}
              documents={documents}
              onDocumentUpload={handleDocumentUpload}
              onDocumentDelete={handleDocumentDelete}
              uploadLoading={uploadLoading}
              deletingDocId={deletingDocId}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800">
                Atualizar
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <SubscriberView
              form={subForm}
              documents={documents}
              onDocumentDelete={handleDocumentDelete}
              onDocumentUpload={handleDocumentUpload}
              uploadLoading={uploadLoading}
              deletingDocId={deletingDocId}
              subscriberId={editingSubscriber?.id}
              onToggleReminders={async (enabled) => {
                if (!editingSubscriber) return;
                try {
                  await subscriberApi.update(editingSubscriber.id, { auto_reminders_enabled: enabled } as any);
                  setSubForm(f => ({ ...f, autoRemindersEnabled: enabled }));
                  toast.success(enabled ? 'Lembretes automáticos ativados' : 'Lembretes automáticos desativados');
                } catch {
                  toast.error('Erro ao atualizar configuração de lembretes');
                }
              }}
            />
            <div className="flex justify-end pt-2">
              <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* New rental form */}
      {view === 'NEW_RENTAL' && (
        <div className="bg-white max-w-2xl mx-auto p-4 md:p-8 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Novo Contrato de Aluguel</h3>
          <form onSubmit={handleCreateRental} className="space-y-5">
            <div>
              <label htmlFor="subscriber" className="block text-sm font-medium text-slate-700 mb-1">Assinante</label>
              <select id="subscriber" required value={rentalForm.subscriberId} onChange={e => setRentalForm({ ...rentalForm, subscriberId: e.target.value })} className="w-full border border-slate-300 rounded-lg p-3 bg-white">
                <option value="">Selecione...</option>
                {subscribers.map(s => <option key={s.id} value={s.id}>{s.name} ({formatCPF(s.document)})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="motorcycle" className="block text-sm font-medium text-slate-700 mb-1">Moto Disponível</label>
              <select id="motorcycle" required value={rentalForm.motorcycleId} onChange={e => setRentalForm({ ...rentalForm, motorcycleId: e.target.value })} className="w-full border border-slate-300 rounded-lg p-3 bg-white">
                <option value="">Selecione...</option>
                {availableBikes.map(m => <option key={m.id} value={m.id}>{m.model} - {m.plate}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="weeklyValue" className="block text-sm font-medium text-slate-700 mb-1">Valor Semanal (R$)</label>
                <input id="weeklyValue" required type="number" value={rentalForm.weeklyValue} onChange={e => setRentalForm({ ...rentalForm, weeklyValue: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg p-3" min={0} step={0.01} />
              </div>
              <div>
                <label htmlFor="dueDay" className="block text-sm font-medium text-slate-700 mb-1">Dia de Vencimento</label>
                <select id="dueDay" required value={rentalForm.dueDayOfWeek} onChange={e => setRentalForm({ ...rentalForm, dueDayOfWeek: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg p-3 bg-white">
                  {WEEK_DAYS.map((day, idx) => <option key={idx} value={idx + 1}>{day}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-1">Duração do Contrato (em meses)</label>
              {!rentalForm.customDuration ? (
                <select id="duration" required value={rentalForm.contractDurationMonths} onChange={e => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setRentalForm({ ...rentalForm, customDuration: true, contractDurationMonths: 1 });
                  } else {
                    setRentalForm({ ...rentalForm, contractDurationMonths: Number(val) });
                  }
                }} className="w-full border border-slate-300 rounded-lg p-3 bg-white">
                  <option value={6}>6 meses</option>
                  <option value={12}>1 ano (12 meses)</option>
                  <option value={18}>18 meses</option>
                  <option value={24}>2 anos (24 meses)</option>
                  <option value={36}>3 anos (36 meses)</option>
                  <option value="custom">Personalizado...</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number" min={1} max={120}
                    value={rentalForm.contractDurationMonths}
                    onChange={e => setRentalForm({ ...rentalForm, contractDurationMonths: parseInt(e.target.value) || 1 })}
                    className="flex-1 border border-slate-300 rounded-lg p-3 bg-white text-sm"
                    placeholder="Ex: 8 meses"
                  />
                  <button
                    type="button"
                    onClick={() => setRentalForm({ ...rentalForm, customDuration: false, contractDurationMonths: 12 })}
                    className="px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-300"
                  >
                    Voltar
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="bg-red-50 p-4 rounded-lg flex gap-3 text-sm text-red-900">
                <Check className="shrink-0" size={20} />
                <p>Ao salvar, uma cobrança inicial será gerada automaticamente e o status da moto mudará para "Alugada".</p>
              </div>
              {rentalForm.weeklyValue > 0 && rentalForm.contractDurationMonths > 0 && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-sm font-semibold text-slate-700 mb-2">📊 Resumo do Contrato</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-slate-500">Valor semanal:</span><p className="font-bold text-slate-800">R$ {rentalForm.weeklyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                    <div><span className="text-slate-500">Valor mensal (aprox.):</span><p className="font-bold text-slate-800">R$ {(rentalForm.weeklyValue * 4.33).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                    <div><span className="text-slate-500">Duração:</span><p className="font-bold text-slate-800">{rentalForm.contractDurationMonths} meses</p></div>
                    <div><span className="text-slate-500">Total estimado:</span><p className="font-bold text-green-600">R$ {(rentalForm.weeklyValue * 4.33 * rentalForm.contractDurationMonths).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setView('LIST')} className="px-6 py-2 text-slate-600 font-medium">Cancelar</button>
              <button type="submit" className="px-6 py-2 bg-red-700 text-white rounded-lg font-medium">Criar Aluguel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
