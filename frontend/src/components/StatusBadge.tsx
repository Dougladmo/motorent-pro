import React from 'react';
import { PaymentStatus, MotorcycleStatus } from '../shared';

interface StatusBadgeProps {
  status: PaymentStatus | MotorcycleStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusStyles = () => {
    // Payment statuses
    if (status === PaymentStatus.PAID) {
      return 'bg-green-100 text-green-800';
    }
    if (status === PaymentStatus.OVERDUE) {
      return 'bg-red-100 text-red-800';
    }
    if (status === PaymentStatus.PENDING) {
      return 'bg-yellow-100 text-yellow-800';
    }

    // Motorcycle statuses
    if (status === MotorcycleStatus.AVAILABLE) {
      return 'bg-green-100 text-green-700';
    }
    if (status === MotorcycleStatus.RENTED) {
      return 'bg-blue-100 text-blue-700';
    }
    if (status === MotorcycleStatus.MAINTENANCE || status === MotorcycleStatus.INACTIVE) {
      return 'bg-slate-200 text-slate-600';
    }

    return 'bg-gray-100 text-gray-800';
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyles()} ${className}`}
      role="status"
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
};
