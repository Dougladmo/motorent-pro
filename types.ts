export enum MotorcycleStatus {
  AVAILABLE = 'Disponível',
  RENTED = 'Alugada',
  MAINTENANCE = 'Manutenção',
  INACTIVE = 'Inativa'
}

export interface Motorcycle {
  id: string;
  plate: string;
  model: string;
  year: number;
  status: MotorcycleStatus;
  imageUrl?: string;
}

export interface Subscriber {
  id: string;
  name: string;
  phone: string;
  document: string;
  active: boolean;
  notes?: string;
}

export interface Rental {
  id: string;
  motorcycleId: string;
  subscriberId: string;
  startDate: string;
  endDate?: string;
  weeklyValue: number;
  dueDayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  isActive: boolean;
}

export enum PaymentStatus {
  PENDING = 'Pendente',
  PAID = 'Pago',
  OVERDUE = 'Atrasado'
}

export interface Payment {
  id: string;
  rentalId: string;
  subscriberName: string; // Denormalized for easier display
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  paidAt?: string;
  reminderSentCount: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalPending: number;
  totalOverdue: number;
  activeRentals: number;
  availableBikes: number;
}