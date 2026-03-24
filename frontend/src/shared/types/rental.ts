/**
 * Rental domain types
 */

export interface Rental {
  id: string;
  motorcycleId: string;
  subscriberId: string;
  startDate: string;
  endDate?: string;
  weeklyValue: number;
  dueDayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  isActive: boolean;

  // Termination management
  terminatedAt?: string;
  terminationReason?: string;
  outstandingBalance: number;

  // Financial tracking (calculated by backend)
  totalContractValue?: number;
  totalPaid?: number;
}
