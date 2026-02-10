import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MotorcycleStatus, Motorcycle } from '../shared';
import { Plus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { validatePlate, validateYear, formatPlate } from '../shared';
import { MotorcycleGrid } from '../entities/motorcycle/ui/MotorcycleGrid';
import { ImageUploadField } from '../shared/ui/molecules/ImageUploadField';
import { ImageViewer } from '../shared/ui/molecules/ImageViewer';
import { FormInput } from '../shared/ui/atoms/FormInput';
import { FormSelect } from '../shared/ui/atoms/FormSelect';

export const Motorcycles: React.FC = () => {
  const { motorcycles, addMotorcycle, updateMotorcycle, deleteMotorcycle } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMoto, setEditingMoto] = useState<Motorcycle | null>(null);
  const [newMoto, setNewMoto] = useState({ plate: '', model: '', year: 2024 });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [keepCurrentImage, setKeepCurrentImage] = useState(true);

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
      alert('Placa inválida. Use o formato ABC-1234 ou ABC1D23.');
      return;
    }

    if (!validateYear(motoData.year)) {
      alert('Ano inválido.');
      return;
    }

    if (!motoData.model.trim()) {
      alert('Modelo é obrigatório.');
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
          formData.append('model', motoData.model);
          formData.append('year', motoData.year.toString());
          formData.append('status', editingMoto.status);

          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/motorcycles/${editingMoto.id}/image`, {
            method: 'PUT',
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
            model: motoData.model,
            year: motoData.year,
            status: editingMoto.status
          });
        }
      } else {
        // Modo criação
        if (selectedImage) {
          // Criar FormData para enviar com imagem
          const formData = new FormData();
          formData.append('image', selectedImage);
          formData.append('plate', formatPlate(newMoto.plate));
          formData.append('model', newMoto.model);
          formData.append('year', newMoto.year.toString());
          formData.append('status', MotorcycleStatus.AVAILABLE);

          // Enviar para API
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/motorcycles/with-image`, {
            method: 'POST',
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
          addMotorcycle({
            ...newMoto,
            plate: formatPlate(newMoto.plate),
            status: MotorcycleStatus.AVAILABLE,
            totalRevenue: 0,
            revenueHistory: []
          });
        }
      }

      // Reset form
      setIsModalOpen(false);
      setEditingMoto(null);
      setNewMoto({ plate: '', model: '', year: new Date().getFullYear() });
      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Erro ao salvar moto:', error);
      alert(`Erro ao salvar moto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
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
    setNewMoto({ plate: '', model: '', year: new Date().getFullYear() });
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
        onEdit={handleEditClick}
        onDelete={deleteMotorcycle}
        onImageClick={setFullscreenImage}
      />

      {fullscreenImage && <ImageViewer src={fullscreenImage} onClose={() => setFullscreenImage(null)} />}

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
