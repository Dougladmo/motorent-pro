import React from 'react';
import { Bike, Edit2, Trash2 } from 'lucide-react';
import { Motorcycle, MotorcycleStatus } from '../../../shared';
import { StatusBadge } from '../../../components/StatusBadge';

interface MotorcycleCardProps {
  motorcycle: Motorcycle;
  onEdit: (moto: Motorcycle) => void;
  onDelete: (id: string) => void;
  onImageClick: (url: string) => void;
}

export const MotorcycleCard: React.FC<MotorcycleCardProps> = ({
  motorcycle,
  onEdit,
  onDelete,
  onImageClick
}) => {
  const handleDelete = () => {
    if (window.confirm('Tem certeza que deseja excluir esta moto?')) {
      onDelete(motorcycle.id);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden group">
      <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
        {motorcycle.imageUrl ? (
          <img
            src={motorcycle.imageUrl}
            alt={motorcycle.model}
            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
            onClick={() => onImageClick(motorcycle.imageUrl!)}
          />
        ) : (
          <Bike size={48} className="text-slate-300" />
        )}
        <div className="absolute top-4 right-4">
          <StatusBadge status={motorcycle.status} className="uppercase font-bold shadow-sm" />
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold text-slate-800">{motorcycle.model}</h3>
        <div className="flex items-center justify-between mt-2 text-sm text-slate-500">
          <span>{motorcycle.plate}</span>
          <span>{motorcycle.year}</span>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-50 flex justify-end gap-2">
          <button
            onClick={() => onEdit(motorcycle)}
            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors text-sm flex items-center gap-1"
            title="Editar moto"
          >
            <Edit2 size={16} />
            Editar
          </button>
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={motorcycle.status === MotorcycleStatus.RENTED}
            title={motorcycle.status === MotorcycleStatus.RENTED ? 'Não é possível excluir moto alugada' : 'Excluir moto'}
          >
            <Trash2 size={16} />
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};
