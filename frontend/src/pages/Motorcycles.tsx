import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MotorcycleStatus, Motorcycle } from '../shared';
import { supabase } from '../lib/supabase';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../components/Modal';
import { validatePlate, validateYear, validateChassi, validateRenavam, formatPlate } from '../shared';
import { MotorcycleGrid } from '../entities/motorcycle/ui/MotorcycleGrid';
import { ImageUploadField } from '../shared/ui/molecules/ImageUploadField';
import { ImageViewer } from '../shared/ui/molecules/ImageViewer';
import { FormInput } from '../shared/ui/atoms/FormInput';
import { FormSelect } from '../shared/ui/atoms/FormSelect';
import { WEEK_DAYS } from '../shared/constants/weekDays';

export const Motorcycles: React.FC = () => {
  const { motorcycles, subscribers, loading, addMotorcycle, updateMotorcycle, deleteMotorcycle, createRental } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMoto, setEditingMoto] = useState<Motorcycle | null>(null);
  const [newMoto, setNewMoto] = useState({ plate: '', chassi: '', renavam: '', model: '', year: 2024, mileage: 0 });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [keepCurrentImage, setKeepCurrentImage] = useState(true);

  // Novo Aluguel
  const [rentalMoto, setRentalMoto] = useState<Motorcycle | null>(null);
  const [rentalForm, setRentalForm] = useState({
    subscriberId: '',
    startDate: new Date().toISOString().split('T')[0],
    weeklyValue: '',
    dueDayOfWeek: new Date().getDay() || 7,
    contractDurationMonths: 12,
    customDuration: false
  });
  const [isCreatingRental, setIsCreatingRental] = useState(false);

  const handleOpenRentalModal = (moto: Motorcycle) => {
    setRentalMoto(moto);
    setRentalForm({
      subscriberId: '',
      startDate: new Date().toISOString().split('T')[0],
      weeklyValue: '',
      dueDayOfWeek: new Date().getDay() || 7,
      contractDurationMonths: 12,
      customDuration: false
    });
  };

  const handleCloseRentalModal = () => {
    setRentalMoto(null);
  };

  const handleRentalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentalMoto || !rentalForm.subscriberId || !rentalForm.weeklyValue) return;

    setIsCreatingRental(true);
    try {
      const startDate = new Date(rentalForm.startDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + rentalForm.contractDurationMonths);
      const endDateStr = endDate.toISOString().split('T')[0];

      await createRental({
        motorcycleId: rentalMoto.id,
        subscriberId: rentalForm.subscriberId,
        startDate: rentalForm.startDate,
        endDate: endDateStr,
        weeklyValue: parseFloat(rentalForm.weeklyValue),
        dueDayOfWeek: rentalForm.dueDayOfWeek,
        isActive: true,
        outstandingBalance: 0
      });
      handleCloseRentalModal();
      toast.success('Aluguel criado com sucesso!');
    } catch (error) {
      toast.error(`Erro ao criar aluguel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsCreatingRental(false);
    }
  };

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);

    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (editingMoto) {
      setKeepCurrentImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const motoData = editingMoto || newMoto;

    // Validate inputs
    if (!validatePlate(motoData.plate)) {
      toast.error('Placa inválida. Use o formato ABC-1234 ou ABC1D23.');
      return;
    }

    if (!validateYear(motoData.year)) {
      toast.error('Ano inválido.');
      return;
    }

    if (!motoData.model.trim()) {
      toast.error('Modelo é obrigatório.');
      return;
    }

    if (motoData.chassi && !validateChassi(motoData.chassi)) {
      toast.error('Chassi inválido. Deve conter 17 caracteres alfanuméricos.');
      return;
    }

    if (motoData.renavam && !validateRenavam(motoData.renavam)) {
      toast.error('RENAVAM inválido. Deve conter 11 dígitos.');
      return;
    }

    setIsUploading(true);

    try {
      if (editingMoto) {
        // Modo edição
        if (selectedImage) {
          // Atualizar com nova imagem
          const formData = new FormData();
          formData.append('image', selectedImage);
          formData.append('plate', formatPlate(motoData.plate));
          formData.append('chassi', motoData.chassi.toUpperCase());
          formData.append('renavam', motoData.renavam.replace(/\D/g, ''));
          formData.append('model', motoData.model);
          formData.append('year', motoData.year.toString());
          formData.append('mileage', motoData.mileage.toString());
          formData.append('status', editingMoto.status);

          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/motorcycles/${editingMoto.id}/image`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${session?.access_token}` },
            body: formData
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar moto');
          }

          const result = await response.json();
          updateMotorcycle(editingMoto.id, result.data);
        } else {
          // Atualizar sem mudar imagem
          await updateMotorcycle(editingMoto.id, {
            plate: formatPlate(motoData.plate),
            chassi: motoData.chassi.toUpperCase(),
            renavam: motoData.renavam.replace(/\D/g, ''),
            model: motoData.model,
            year: motoData.year,
            mileage: motoData.mileage,
            status: editingMoto.status
          });
        }
        toast.success('Moto atualizada com sucesso!');
      } else {
        // Modo criação
        if (selectedImage) {
          // Criar FormData para enviar com imagem
          const formData = new FormData();
          formData.append('image', selectedImage);
          formData.append('plate', formatPlate(newMoto.plate));
          formData.append('chassi', newMoto.chassi.toUpperCase());
          formData.append('renavam', newMoto.renavam.replace(/\D/g, ''));
          formData.append('model', newMoto.model);
          formData.append('year', newMoto.year.toString());
          formData.append('mileage', newMoto.mileage.toString());
          formData.append('status', MotorcycleStatus.AVAILABLE);

          // Enviar para API
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/motorcycles/with-image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session?.access_token}` },
            body: formData
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao criar moto');
          }

          const result = await response.json();

          // Adicionar moto ao estado global
          addMotorcycle(result.data);
        } else {
          // Criar sem imagem (comportamento original)
          await addMotorcycle({
            ...newMoto,
            plate: formatPlate(newMoto.plate),
            chassi: newMoto.chassi.toUpperCase(),
            renavam: newMoto.renavam.replace(/\D/g, ''),
            status: MotorcycleStatus.AVAILABLE,
            totalRevenue: 0,
            revenueHistory: []
          });
        }
        toast.success('Moto cadastrada com sucesso!');
      }

      // Reset form
      setIsModalOpen(false);
      setEditingMoto(null);
      setNewMoto({ plate: '', chassi: '', renavam: '', model: '', year: new Date().getFullYear(), mileage: 0 });
      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Erro ao salvar moto:', error);
      toast.error(`Erro ao salvar moto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditClick = (moto: Motorcycle) => {
    setEditingMoto(moto);
    setKeepCurrentImage(true);
    setImagePreview(moto.imageUrl || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMoto(null);
    setNewMoto({ plate: '', chassi: '', renavam: '', model: '', year: new Date().getFullYear(), mileage: 0 });
    setSelectedImage(null);
    setImagePreview(null);
    setKeepCurrentImage(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Motos</h2>
          <p className="text-slate-500">Gerencie sua frota.</p>
        </div>
        <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-blue-900/20"
        >
          <Plus size={20} />
          Nova Moto
        </button>
      </header>

      <MotorcycleGrid
        motorcycles={motorcycles}
        loading={loading}
        onEdit={handleEditClick}
        onDelete={deleteMotorcycle}
        onImageClick={setFullscreenImage}
        onNewRental={handleOpenRentalModal}
      />

      {fullscreenImage && <ImageViewer src={fullscreenImage} onClose={() => setFullscreenImage(null)} />}

      <Modal isOpen={!!rentalMoto} onClose={handleCloseRentalModal} title={`Novo Aluguel — ${rentalMoto?.model ?? ''}`}>
        <form onSubmit={handleRentalSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente <span className="text-red-500">*</span></label>
            <select
              required
              value={rentalForm.subscriberId}
              onChange={e => setRentalForm(f => ({ ...f, subscriberId: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um cliente</option>
              {subscribers.filter(s => s.active).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <FormInput
            id="rental-start-date"
            label="Data de Início"
            type="date"
            required
            value={rentalForm.startDate}
            onChange={e => setRentalForm(f => ({ ...f, startDate: e.target.value }))}
          />

          <FormInput
            id="rental-weekly-value"
            label="Valor Semanal (R$)"
            type="number"
            required
            min={0}
            step={0.01}
            value={rentalForm.weeklyValue}
            onChange={e => setRentalForm(f => ({ ...f, weeklyValue: e.target.value }))}
            placeholder="Ex: 300"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dia de Vencimento</label>
            <select
              value={rentalForm.dueDayOfWeek}
              onChange={e => setRentalForm(f => ({ ...f, dueDayOfWeek: parseInt(e.target.value) }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {WEEK_DAYS.map((day, i) => (
                <option key={i} value={i + 1}>{day}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duração do Contrato (em meses)</label>
            {!rentalForm.customDuration ? (
              <select
                value={rentalForm.contractDurationMonths}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setRentalForm(f => ({ ...f, customDuration: true, contractDurationMonths: 1 }));
                  } else {
                    setRentalForm(f => ({ ...f, contractDurationMonths: parseInt(val) }));
                  }
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
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
                  type="number"
                  min={1}
                  max={120}
                  value={rentalForm.contractDurationMonths}
                  onChange={e => setRentalForm(f => ({ ...f, contractDurationMonths: parseInt(e.target.value) || 1 }))}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 8 meses"
                />
                <button
                  type="button"
                  onClick={() => setRentalForm(f => ({ ...f, customDuration: false, contractDurationMonths: 12 }))}
                  className="px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200"
                >
                  Voltar
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleCloseRentalModal}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              disabled={isCreatingRental}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isCreatingRental}
            >
              {isCreatingRental ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Criando...
                </>
              ) : 'Criar Aluguel'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingMoto ? 'Editar Moto' : 'Adicionar Nova Moto'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              id="model"
              label="Modelo"
              required
              value={editingMoto?.model || newMoto.model}
              onChange={e => editingMoto
                ? setEditingMoto({...editingMoto, model: e.target.value})
                : setNewMoto({...newMoto, model: e.target.value})}
              placeholder="Ex: Honda CG 160 Fan"
            />

            <ImageUploadField
              label={editingMoto ? 'Alterar Foto da Moto' : 'Foto da Moto'}
              imagePreview={imagePreview}
              onImageSelect={handleImageSelect}
              onImageRemove={handleRemoveImage}
              onError={(msg) => toast.error(msg)}
              editMode={!!editingMoto}
              hasNewImage={!!selectedImage}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormInput
                  id="plate"
                  label="Placa"
                  required
                  maxLength={8}
                  value={editingMoto?.plate || newMoto.plate}
                  onChange={e => editingMoto
                    ? setEditingMoto({...editingMoto, plate: formatPlate(e.target.value)})
                    : setNewMoto({...newMoto, plate: formatPlate(e.target.value)})}
                  placeholder="ABC-1234"
                  className="uppercase"
                />
                <FormInput
                  id="year"
                  label="Ano"
                  type="number"
                  required
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  value={editingMoto?.year || newMoto.year}
                  onChange={e => editingMoto
                    ? setEditingMoto({...editingMoto, year: parseInt(e.target.value) || new Date().getFullYear()})
                    : setNewMoto({...newMoto, year: parseInt(e.target.value) || new Date().getFullYear()})}
                />
            </div>

            <FormInput
              id="chassi"
              label="Chassi"
              maxLength={17}
              value={editingMoto?.chassi || newMoto.chassi}
              onChange={e => editingMoto
                ? setEditingMoto({...editingMoto, chassi: e.target.value.toUpperCase()})
                : setNewMoto({...newMoto, chassi: e.target.value.toUpperCase()})}
              placeholder="9BWZZZ377VT004251"
              className="uppercase font-mono"
            />

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                id="renavam"
                label="RENAVAM"
                maxLength={11}
                value={editingMoto?.renavam || newMoto.renavam}
                onChange={e => editingMoto
                  ? setEditingMoto({...editingMoto, renavam: e.target.value.replace(/\D/g, '')})
                  : setNewMoto({...newMoto, renavam: e.target.value.replace(/\D/g, '')})}
                placeholder="00000000000"
                className="font-mono"
              />
              <FormInput
                id="mileage"
                label="Quilometragem (km)"
                type="number"
                required
                min={0}
                value={editingMoto?.mileage ?? newMoto.mileage}
                onChange={e => editingMoto
                  ? setEditingMoto({...editingMoto, mileage: parseInt(e.target.value) || 0})
                  : setNewMoto({...newMoto, mileage: parseInt(e.target.value) || 0})}
                placeholder="0"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
                <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                    disabled={isUploading}
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            {editingMoto ? 'Atualizando...' : 'Salvando...'}
                        </>
                    ) : (
                        editingMoto ? 'Atualizar' : 'Salvar'
                    )}
                </button>
            </div>
        </form>
      </Modal>
    </div>
  );
};
