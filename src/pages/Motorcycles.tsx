import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MotorcycleStatus } from '../types';
import { Plus, Bike, MoreVertical, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { validatePlate, validateYear } from '../utils/validators';
import { formatPlate } from '../utils/formatters';

export const Motorcycles: React.FC = () => {
  const { motorcycles, addMotorcycle, deleteMotorcycle } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMoto, setNewMoto] = useState({ plate: '', model: '', year: 2024 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!validatePlate(newMoto.plate)) {
      alert('Placa inválida. Use o formato ABC-1234 ou ABC1D23.');
      return;
    }

    if (!validateYear(newMoto.year)) {
      alert('Ano inválido.');
      return;
    }

    if (!newMoto.model.trim()) {
      alert('Modelo é obrigatório.');
      return;
    }

    try {
      addMotorcycle({
          ...newMoto,
          plate: formatPlate(newMoto.plate),
          status: MotorcycleStatus.AVAILABLE
      });
      setIsModalOpen(false);
      setNewMoto({ plate: '', model: '', year: new Date().getFullYear() });
    } catch (error) {
      console.error('Erro ao adicionar moto:', error);
      alert('Erro ao adicionar moto. Tente novamente.');
    }
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
            <div className="h-32 bg-slate-100 flex items-center justify-center relative">
                <Bike size={48} className="text-slate-300" />
                <div className="absolute top-4 right-4">
                    <StatusBadge status={moto.status} className="uppercase font-bold" />
                </div>
            </div>
            <div className="p-5">
                <h3 className="text-lg font-bold text-slate-800">{moto.model}</h3>
                <div className="flex items-center justify-between mt-2 text-sm text-slate-500">
                    <span>{moto.plate}</span>
                    <span>{moto.year}</span>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-end">
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Adicionar Nova Moto">
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="model" className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                <input
                    id="model"
                    required
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={newMoto.model}
                    onChange={e => setNewMoto({...newMoto, model: e.target.value})}
                    placeholder="Ex: Honda CG 160 Fan"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="plate" className="block text-sm font-medium text-slate-700 mb-1">Placa</label>
                    <input
                        id="plate"
                        required
                        type="text"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                        value={newMoto.plate}
                        onChange={e => setNewMoto({...newMoto, plate: formatPlate(e.target.value)})}
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
                        value={newMoto.year}
                        onChange={e => setNewMoto({...newMoto, year: parseInt(e.target.value) || new Date().getFullYear()})}
                        min={1900}
                        max={new Date().getFullYear() + 1}
                    />
                </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
                <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                    Salvar
                </button>
            </div>
        </form>
      </Modal>
    </div>
  );
};
