import React from 'react';
import { Subscriber, Rental, Motorcycle, Payment } from '../../../shared';
import { SubscriberCard } from './SubscriberCard';
import { Skeleton } from '../../../shared/ui/atoms/Skeleton';

interface SubscriberGridProps {
  subscribers: Subscriber[];
  rentals: Rental[];
  motorcycles: Motorcycle[];
  payments: Payment[];
  loading?: boolean;
  onEdit: (sub: Subscriber) => void;
  onDelete: (id: string) => void;
  onTerminateRental: (rentalId: string, subName: string, bikePlate: string) => void;
}

const SubscriberCardSkeleton: React.FC = () => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
    <div className="flex items-start justify-between">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-5 w-5 rounded" />
    </div>
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-8 w-28 rounded-lg" />
    <div className="pt-4 border-t border-slate-50 space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  </div>
);

export const SubscriberGrid: React.FC<SubscriberGridProps> = ({
  subscribers,
  rentals,
  motorcycles,
  payments,
  loading = false,
  onEdit,
  onDelete,
  onTerminateRental
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SubscriberCardSkeleton key={i} />
        ))}
      </div>
    );
  }

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
            payments={payments}
            onEdit={onEdit}
            onDelete={onDelete}
            onTerminateRental={onTerminateRental}
          />
        );
      })}
    </div>
  );
};
