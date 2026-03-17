import React, { useState } from 'react';
import { Bike, Edit2, Trash2, DollarSign, KeyRound } from 'lucide-react';
import { Motorcycle, MotorcycleStatus, formatPlate, formatCurrency } from '../../../shared';
import { StatusBadge } from '../../../components/StatusBadge';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

interface MotorcycleCardProps {
  motorcycle: Motorcycle;
  onEdit: (moto: Motorcycle) => void;
  onDelete: (id: string) => void;
  onImageClick: (url: string) => void;
  onNewRental?: (moto: Motorcycle) => void;
}

export const MotorcycleCard: React.FC<MotorcycleCardProps> = ({
  motorcycle,
  onEdit,
  onDelete,
  onImageClick,
  onNewRental
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  return (
    <>
    <ConfirmDialog
      isOpen={confirmDelete}
      title="Excluir Moto"
      message={`Tem certeza que deseja excluir ${motorcycle.model} (${formatPlate(motorcycle.plate)})?`}
      onConfirm={() => onDelete(motorcycle.id)}
      onClose={() => setConfirmDelete(false)}
      confirmLabel="Excluir"
      variant="danger"
    />
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden group">
      <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
        {motorcycle.imageUrl && !imageError ? (
          <>
            {/* Skeleton Loading */}
            {imageLoading && (
              <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-slate-300 border-t-slate-400 rounded-full animate-spin"></div>
              </div>
            )}

            {/* Imagem Real */}
            <img
              src={motorcycle.imageUrl}
              alt={motorcycle.model}
              className={`w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300 ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onClick={() => onImageClick(motorcycle.imageUrl!)}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </>
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
          <span className="font-mono font-semibold">Placa: {formatPlate(motorcycle.plate)}</span>
          <span>Ano: {motorcycle.year}</span>
        </div>


        <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center gap-2">
          {motorcycle.status === MotorcycleStatus.AVAILABLE && onNewRental ? (
            <button
              onClick={() => onNewRental(motorcycle)}
              className="text-green-600 hover:text-green-800 hover:bg-green-50 p-2 rounded-lg transition-colors text-sm flex items-center gap-1"
              title="Novo Aluguel"
            >
              <KeyRound size={16} />
              Novo Aluguel
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(motorcycle)}
              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors text-sm flex items-center gap-1"
              title="Editar moto"
            >
              <Edit2 size={16} />
              Editar
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
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
    </div>
    </>
  );
};
