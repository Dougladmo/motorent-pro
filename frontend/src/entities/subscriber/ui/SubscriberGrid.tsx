import React from 'react';
import { Subscriber, Rental, Motorcycle } from '../../../shared';
import { SubscriberCard } from './SubscriberCard';

interface SubscriberGridProps {
  subscribers: Subscriber[];
  rentals: Rental[];
  motorcycles: Motorcycle[];
  onEdit: (sub: Subscriber) => void;
  onDelete: (id: string) => void;
  onTerminateRental: (rentalId: string, subName: string, bikePlate: string) => void;
}

export const SubscriberGrid: React.FC<SubscriberGridProps> = ({
  subscribers,
  rentals,
  motorcycles,
  onEdit,
  onDelete,
  onTerminateRental
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {subscribers.map((sub) => {
        const activeRentals = rentals.filter((r) => r.subscriberId === sub.id && r.isActive);

        return (
          <SubscriberCard
            key={sub.id}
            subscriber={sub}
            activeRentals={activeRentals}
            motorcycles={motorcycles}
            onEdit={onEdit}
            onDelete={onDelete}
            onTerminateRental={onTerminateRental}
          />
        );
      })}
    </div>
  );
};
