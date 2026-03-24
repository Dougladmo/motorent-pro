/**
 * Motorcycle domain types
 */

export enum MotorcycleStatus {
  AVAILABLE = 'Disponível',
  RENTED = 'Alugada',
  MAINTENANCE = 'Manutenção',
  INACTIVE = 'Inativa'
}

export interface MotorcycleRevenue {
  paymentId: string;
  rentalId: string;
  amount: number;
  date: string;
  subscriberName: string;
}

export interface Motorcycle {
  id: string;
  plate: string;
  chassi: string;
  renavam: string;
  model: string;
  year: number;
  mileage: number;
  status: MotorcycleStatus;
  imageUrl?: string;

  // Revenue tracking
  totalRevenue: number;
  revenueHistory?: MotorcycleRevenue[];
}
