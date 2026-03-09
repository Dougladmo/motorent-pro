/**
 * Payment domain types
 */

export enum PaymentStatus {
  PENDING = 'Pendente',
  PAID = 'Pago',
  OVERDUE = 'Atrasado',
  CANCELLED = 'Cancelado'
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

  // Audit and rollback
  previousStatus?: PaymentStatus;
  markedAsPaidAt?: string;
  statusHistory?: PaymentStatusChange[];

  // Validation
  expectedAmount: number;
  isAmountOverridden?: boolean;

  // Abacate Pay PIX
  abacatePixId?: string;
  pixBrCode?: string;
  pixQrCodeBase64?: string;
  pixExpiresAt?: string;
  pixPaymentUrl?: string;

  // Comprovante de pagamento
  proofUrl?: string;
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
