import React from 'react';
import { User, Edit2, XCircle } from 'lucide-react';
import { Subscriber, Rental, Motorcycle } from '../../../shared';

interface SubscriberCardProps {
  subscriber: Subscriber;
  activeRentals: Rental[];
  motorcycles: Motorcycle[];
  onEdit: (sub: Subscriber) => void;
  onDelete: (id: string) => void;
  onTerminateRental: (rentalId: string, subName: string, bikePlate: string) => void;
}

export const SubscriberCard: React.FC<SubscriberCardProps> = ({
  subscriber,
  activeRentals,
  motorcycles,
  onEdit,
  onDelete,
  onTerminateRental
}) => {
  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja excluir ${subscriber.name}?`)) {
      onDelete(subscriber.id);
    }
  };

  const getTimeRemaining = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    if (diffDays < 0) {
      return ' • Contrato vencido';
    } else if (diffMonths > 0) {
      return ` • ${diffMonths} ${diffMonths === 1 ? 'mês' : 'meses'} restantes`;
    } else {
      return ` • ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} restantes`;
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
            <User size={24} />
          </div>
          <button
            onClick={handleDelete}
            className="text-slate-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={activeRentals.length > 0}
            title={
              activeRentals.length > 0
                ? 'Não é possível excluir assinante com aluguéis ativos'
                : 'Excluir assinante'
            }
            aria-label="Excluir assinante"
          >
            &times;
          </button>
        </div>
        <h3 className="text-lg font-bold text-slate-800">{subscriber.name}</h3>
        <p className="text-sm text-slate-500 mt-1">{subscriber.phone}</p>

        {/* Botão de editar */}
        <button
          onClick={() => onEdit(subscriber)}
          className="mt-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors text-sm flex items-center gap-1.5"
        >
          <Edit2 size={14} />
          Editar Dados
        </button>

        <div className="mt-4 pt-4 border-t border-slate-50">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Motos Alugadas
          </p>
          {activeRentals.length > 0 ? (
            <ul className="space-y-2">
              {activeRentals.map((rental) => {
                const bike = motorcycles.find((m) => m.id === rental.motorcycleId);
                const timeRemaining = rental.endDate ? getTimeRemaining(rental.endDate) : '';

                return (
                  <li key={rental.id} className="text-sm bg-blue-50 border border-blue-100 px-3 py-3 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-blue-900">
                          {bike?.model} | {bike?.plate}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          R$ {rental.weeklyValue.toFixed(2)}/semana{timeRemaining}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          onTerminateRental(rental.id, subscriber.name, bike?.plate || '')
                        }
                        className="ml-2 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title="Rescindir Contrato"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 italic">Nenhum aluguel ativo.</p>
          )}
        </div>
      </div>
    </div>
  );
};
