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
  model: string;
  year: number;
  status: MotorcycleStatus;
  imageUrl?: string;

  // NOVOS CAMPOS - Tracking de Receita
  totalRevenue: number;                // Receita total acumulada
  revenueHistory?: MotorcycleRevenue[]; // Histórico de pagamentos recebidos
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

  // NOVOS CAMPOS - Gestão de Encerramento
  terminatedAt?: string;        // Quando foi encerrado
  terminationReason?: string;   // Motivo do encerramento
  outstandingBalance: number;   // Saldo devedor no encerramento
}

export enum PaymentStatus {
  PENDING = 'Pendente',
  PAID = 'Pago',
  OVERDUE = 'Atrasado',
  CANCELLED = 'Cancelado'  // NOVO - para pagamentos de contratos encerrados
}

export interface PaymentStatusChange {
  id: string;
  timestamp: string;
  fromStatus: PaymentStatus;
  toStatus: PaymentStatus;
  reason?: string;
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

  // NOVOS CAMPOS - Auditoria e Rollback
  previousStatus?: PaymentStatus;      // Status anterior (para rollback)
  markedAsPaidAt?: string;             // Timestamp quando marcado como pago
  statusHistory?: PaymentStatusChange[]; // Histórico completo de mudanças

  // NOVOS CAMPOS - Validação
  expectedAmount: number;              // Valor original do rental.weeklyValue
  isAmountOverridden?: boolean;        // Flag se valor foi ajustado manualmente
}

export interface DashboardStats {
  totalRevenue: number;
  totalPending: number;
  totalOverdue: number;
  activeRentals: number;
  availableBikes: number;
}

export interface PaymentIssue {
  type: 'MISSING_PAYMENT' | 'AMOUNT_MISMATCH' | 'ORPHANED_PAYMENT';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  rentalId?: string;
  paymentId?: string;
  subscriberName?: string;
  details: string;
  missingDates?: string[];
  paymentIds?: string[];
  expected?: number;
  actual?: number;
}

export interface PaymentValidationReport {
  hasIssues: boolean;
  issueCount: number;
  issues: PaymentIssue[];
  timestamp: string;
}