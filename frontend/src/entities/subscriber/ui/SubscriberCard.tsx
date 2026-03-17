import React, { useState } from 'react';
import { Edit2, XCircle, TrendingUp, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Subscriber, Rental, Motorcycle, Payment, formatPhone, formatPlate, formatCurrency, capitalizeName } from '../../../shared';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

interface SubscriberCardProps {
  subscriber: Subscriber;
  activeRentals: Rental[];
  motorcycles: Motorcycle[];
  payments: Payment[];
  onEdit: (sub: Subscriber) => Promise<void>;
  onDelete: (id: string) => void;
  onTerminateRental: (rentalId: string, subName: string, bikePlate: string) => void;
}

export const SubscriberCard: React.FC<SubscriberCardProps> = ({
  subscriber,
  activeRentals,
  motorcycles,
  payments: _payments,
  onEdit,
  onDelete,
  onTerminateRental
}) => {
  const [expandedRentals, setExpandedRentals] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  const toggleRental = (rentalId: string) => {
    setExpandedRentals(prev => {
      const next = new Set(prev);
      if (next.has(rentalId)) next.delete(rentalId);
      else next.add(rentalId);
      return next;
    });
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

  // Calcular progresso de faturamento por contrato
  const getContractProgress = (rental: Rental) => {
    let totalContractValue = rental.totalContractValue ?? 0;

    // Se total_contract_value não foi salvo no banco, calcula na hora
    if (totalContractValue === 0 && rental.endDate) {
      const [sy, sm, sd] = rental.startDate.split('-').map(Number);
      const [ey, em, ed] = rental.endDate.split('-').map(Number);
      const startDate = new Date(sy, sm - 1, sd);
      const endDate = new Date(ey, em - 1, ed);
      const totalWeeks = Math.round(
        (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      totalContractValue = totalWeeks * rental.weeklyValue;
    }

    const totalPaid = rental.totalPaid ?? 0;
    const totalPending = Math.max(0, totalContractValue - totalPaid);
    const progress = totalContractValue > 0 ? (totalPaid / totalContractValue) * 100 : 0;

    return {
      totalPaid,
      totalExpected: totalContractValue,
      totalPending,
      progress: Math.min(progress, 100)
    };
  };

  return (
    <>
    <ConfirmDialog
      isOpen={confirmDelete}
      title="Excluir Assinante"
      message={`Tem certeza que deseja excluir ${capitalizeName(subscriber.name)}?`}
      onConfirm={() => onDelete(subscriber.id)}
      onClose={() => setConfirmDelete(false)}
      confirmLabel="Excluir"
      variant="danger"
    />
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-800">{capitalizeName(subscriber.name)}</h3>
          <button
            onClick={() => setConfirmDelete(true)}
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
        <p className="text-sm text-slate-500 mt-1">{formatPhone(subscriber.phone)}</p>

        {/* Botão de editar */}
        <button
          onClick={async () => {
            setIsLoadingEdit(true);
            try {
              await onEdit(subscriber);
            } finally {
              setIsLoadingEdit(false);
            }
          }}
          disabled={isLoadingEdit}
          className="mt-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors text-sm flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoadingEdit ? <Loader2 size={14} className="animate-spin" /> : <Edit2 size={14} />}
          {isLoadingEdit ? 'Carregando...' : 'Ver Dados'}
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
                const progress = getContractProgress(rental);

                return (
                  <li key={rental.id} className="text-sm bg-blue-50 border border-blue-100 px-3 py-3 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-blue-900">
                          {bike?.model} | {formatPlate(bike?.plate || '')}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {formatCurrency(rental.weeklyValue)}/semana{timeRemaining}
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

                    {/* Progresso de Faturamento */}
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <button
                        onClick={() => toggleRental(rental.id)}
                        className="w-full flex items-center justify-between text-xs mb-1 hover:opacity-80 transition-opacity"
                      >
                        <span className="text-blue-600 flex items-center gap-1">
                          <TrendingUp size={12} />
                          Progresso
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-blue-700">
                          {progress.progress.toFixed(0)}%
                          {expandedRentals.has(rental.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </span>
                      </button>

                      {expandedRentals.has(rental.id) && (
                        <>
                          {/* Barra de Progresso */}
                          <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                            <div
                              className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress.progress}%` }}
                            ></div>
                          </div>

                          {/* Valores */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-blue-500">Faturado:</span>
                              <p className="font-bold text-green-700">{formatCurrency(progress.totalPaid)}</p>
                            </div>
                            <div>
                              <span className="text-blue-500">Pendente:</span>
                              <p className="font-bold text-orange-600">{formatCurrency(progress.totalPending)}</p>
                            </div>
                          </div>
                        </>
                      )}
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
    </>
  );
};
