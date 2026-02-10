import React from 'react';
import { Motorcycle } from '../../../shared';
import { MotorcycleCard } from './MotorcycleCard';

interface MotorcycleGridProps {
  motorcycles: Motorcycle[];
  onEdit: (moto: Motorcycle) => void;
  onDelete: (id: string) => void;
  onImageClick: (url: string) => void;
}

export const MotorcycleGrid: React.FC<MotorcycleGridProps> = ({
  motorcycles,
  onEdit,
  onDelete,
  onImageClick
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {motorcycles.map((moto) => (
        <MotorcycleCard
          key={moto.id}
          motorcycle={moto}
          onEdit={onEdit}
          onDelete={onDelete}
          onImageClick={onImageClick}
        />
      ))}
    </div>
  );
};
