import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MotorcycleStatus, Motorcycle } from '../shared';
import { Plus, Bike, MoreVertical, Trash2, Upload, X, Edit2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { validatePlate, validateYear } from '../shared';
import { formatPlate } from '../shared';

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Tipo de arquivo não permitido. Use JPEG, JPG, PNG ou WEBP.');
        return;
      }

      // Validar tamanho (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Arquivo muito grande. Tamanho máximo: 5MB');
        return;
      }

      setSelectedImage(file);

      // Criar preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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

          const response = await fetch(`http://localhost:3001/api/motorcycles/${editingMoto.id}/image`, {
            method: 'PATCH',
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
          const response = await fetch('http://localhost:3001/api/motorcycles/with-image', {
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {motorcycles.map((moto) => (
          <div key={moto.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden group">
            <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                {moto.imageUrl ? (
                    <img
                        src={moto.imageUrl}
                        alt={moto.model}
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                        onClick={() => setFullscreenImage(moto.imageUrl!)}
                    />
                ) : (
                    <Bike size={48} className="text-slate-300" />
                )}
                <div className="absolute top-4 right-4">
                    <StatusBadge status={moto.status} className="uppercase font-bold shadow-sm" />
                </div>
            </div>
            <div className="p-5">
                <h3 className="text-lg font-bold text-slate-800">{moto.model}</h3>
                <div className="flex items-center justify-between mt-2 text-sm text-slate-500">
                    <span>{moto.plate}</span>
                    <span>{moto.year}</span>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-end gap-2">
                    <button
                        onClick={() => handleEditClick(moto)}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors text-sm flex items-center gap-1"
                        title="Editar moto"
                    >
                        <Edit2 size={16} />
                        Editar
                    </button>
                    <button
                        onClick={() => {
                          if (window.confirm('Tem certeza que deseja excluir esta moto?')) {
                            deleteMotorcycle(moto.id);
                          }
                        }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={moto.status === MotorcycleStatus.RENTED}
                        title={moto.status === MotorcycleStatus.RENTED ? 'Não é possível excluir moto alugada' : 'Excluir moto'}
                    >
                        <Trash2 size={16} />
                        Excluir
                    </button>
                </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Visualização Fullscreen */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            title="Fechar"
          >
            <X size={32} />
          </button>
          <img
            src={fullscreenImage}
            alt="Visualização"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingMoto ? 'Editar Moto' : 'Adicionar Nova Moto'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="model" className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                <input
                    id="model"
                    required
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={editingMoto?.model || newMoto.model}
                    onChange={e => editingMoto
                      ? setEditingMoto({...editingMoto, model: e.target.value})
                      : setNewMoto({...newMoto, model: e.target.value})}
                    placeholder="Ex: Honda CG 160 Fan"
                />
            </div>

            {/* Upload de Imagem */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    {editingMoto ? 'Alterar Foto da Moto' : 'Foto da Moto'}
                </label>

                {imagePreview ? (
                    <div className="relative">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-lg border-2 border-slate-200"
                        />
                        <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors"
                            title="Remover imagem"
                        >
                            <X size={16} />
                        </button>
                        {editingMoto && selectedImage && (
                            <div className="absolute bottom-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                                Nova imagem selecionada
                            </div>
                        )}
                    </div>
                ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <Upload className="text-slate-400 mb-2" size={32} />
                        <span className="text-sm text-slate-500">
                            {editingMoto ? 'Clique para alterar a foto' : 'Clique para selecionar uma foto'}
                        </span>
                        <span className="text-xs text-slate-400 mt-1">JPEG, PNG ou WEBP (máx. 5MB)</span>
                        <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handleImageSelect}
                            className="hidden"
                        />
                    </label>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="plate" className="block text-sm font-medium text-slate-700 mb-1">Placa</label>
                    <input
                        id="plate"
                        required
                        type="text"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                        value={editingMoto?.plate || newMoto.plate}
                        onChange={e => editingMoto
                          ? setEditingMoto({...editingMoto, plate: formatPlate(e.target.value)})
                          : setNewMoto({...newMoto, plate: formatPlate(e.target.value)})}
                        placeholder="ABC-1234"
                        maxLength={8}
                    />
                </div>
                <div>
                    <label htmlFor="year" className="block text-sm font-medium text-slate-700 mb-1">Ano</label>
                    <input
                        id="year"
                        required
                        type="number"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={editingMoto?.year || newMoto.year}
                        onChange={e => editingMoto
                          ? setEditingMoto({...editingMoto, year: parseInt(e.target.value) || new Date().getFullYear()})
                          : setNewMoto({...newMoto, year: parseInt(e.target.value) || new Date().getFullYear()})}
                        min={1900}
                        max={new Date().getFullYear() + 1}
                    />
                </div>
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
