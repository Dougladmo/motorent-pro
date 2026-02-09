import {
  Motorcycle,
  MotorcycleStatus,
  Payment,
  PaymentStatus,
  Rental,
  Subscriber,
  addDays
} from "./shared";

const today = new Date();

export const MOCK_MOTORCYCLES: Motorcycle[] = [
  { id: '1', plate: 'ABC-1234', model: 'Honda CG 160 Fan', year: 2023, status: MotorcycleStatus.RENTED, totalRevenue: 0, revenueHistory: [] },
  { id: '2', plate: 'XYZ-9876', model: 'Yamaha Fazer 150', year: 2022, status: MotorcycleStatus.AVAILABLE, totalRevenue: 0, revenueHistory: [] },
  { id: '3', plate: 'MOT-5555', model: 'Honda Biz 125', year: 2024, status: MotorcycleStatus.RENTED, totalRevenue: 0, revenueHistory: [] },
  { id: '4', plate: 'RLK-2020', model: 'Honda CG 160 Titan', year: 2021, status: MotorcycleStatus.MAINTENANCE, totalRevenue: 0, revenueHistory: [] },
  { id: '5', plate: 'BKE-1001', model: 'Yamaha Crosser 150', year: 2023, status: MotorcycleStatus.AVAILABLE, totalRevenue: 0, revenueHistory: [] },
];

export const MOCK_SUBSCRIBERS: Subscriber[] = [
  { id: '1', name: 'João Silva', phone: '11999999999', document: '123.456.789-00', active: true },
  { id: '2', name: 'Maria Oliveira', phone: '11988888888', document: '987.654.321-11', active: true },
  { id: '3', name: 'Carlos Souza', phone: '11977777777', document: '456.123.789-22', active: true },
];

export const MOCK_RENTALS: Rental[] = [
  {
    id: '1',
    motorcycleId: '1',
    subscriberId: '1',
    startDate: '2023-12-01',
    weeklyValue: 250,
    dueDayOfWeek: 1, // Monday
    isActive: true,
    outstandingBalance: 0
  },
  {
    id: '2',
    motorcycleId: '3',
    subscriberId: '2',
    startDate: '2024-01-10',
    weeklyValue: 280,
    dueDayOfWeek: 5, // Friday
    isActive: true,
    outstandingBalance: 0
  },
];

export const MOCK_PAYMENTS: Payment[] = [
  {
    id: '101',
    rentalId: '1',
    subscriberName: 'João Silva',
    amount: 250,
    expectedAmount: 250,
    dueDate: addDays(today, -2).toISOString().split('T')[0]!, // 2 days ago
    status: PaymentStatus.OVERDUE,
    reminderSentCount: 1,
    statusHistory: []
  },
  {
    id: '102',
    rentalId: '2',
    subscriberName: 'Maria Oliveira',
    amount: 280,
    expectedAmount: 280,
    dueDate: addDays(today, 1).toISOString().split('T')[0]!, // Tomorrow
    status: PaymentStatus.PENDING,
    reminderSentCount: 0,
    statusHistory: []
  },
  {
    id: '103',
    rentalId: '1',
    subscriberName: 'João Silva',
    amount: 250,
    expectedAmount: 250,
    dueDate: addDays(today, -9).toISOString().split('T')[0]!,
    status: PaymentStatus.PAID,
    paidAt: addDays(today, -9).toISOString().split('T')[0]!,
    reminderSentCount: 0,
    statusHistory: []
  }
];

// Re-export WEEK_DAYS from shared (already defined there)
export { WEEK_DAYS } from "./shared";
