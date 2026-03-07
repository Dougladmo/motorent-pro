import React from 'react';
import { Motorcycle } from '../../../shared';
import { MotorcycleCard } from './MotorcycleCard';
import { Skeleton } from '../../../shared/ui/atoms/Skeleton';
import { Bike } from 'lucide-react';

interface MotorcycleGridProps {
  motorcycles: Motorcycle[];
  loading?: boolean;
  onEdit: (moto: Motorcycle) => void;
  onDelete: (id: string) => void;
  onImageClick: (url: string) => void;
  onNewRental?: (moto: Motorcycle) => void;
}

const MotorcycleCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
    <Skeleton className="h-48 rounded-none" />
    <div className="p-5 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="flex justify-between pt-2 border-t border-slate-50 mt-4">
        <Skeleton className="h-8 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  </div>
);

export const MotorcycleGrid: React.FC<MotorcycleGridProps> = ({
  motorcycles,
  loading = false,
  onEdit,
  onDelete,
  onImageClick,
  onNewRental
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <MotorcycleCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!loading && motorcycles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Bike size={48} className="mb-3 opacity-40" />
        <p className="text-sm">Nenhuma moto cadastrada.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {motorcycles.map((moto) => (
        <MotorcycleCard
          key={moto.id}
          motorcycle={moto}
          onEdit={onEdit}
          onDelete={onDelete}
          onImageClick={onImageClick}
          onNewRental={onNewRental}
        />
      ))}
    </div>
  );
};
