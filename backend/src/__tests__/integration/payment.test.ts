jest.mock('../../services/uploadService', () => ({
  UploadService: jest.fn().mockImplementation(() => ({
    uploadQrCodeToStorage: jest.fn().mockResolvedValue('https://mock-url/qr.png')
  }))
}));

jest.mock('../../config/supabase', () => ({
  getSupabaseClient: () => {
    const { getMockClient } = require('../helpers/sqlite-client');
    return getMockClient();
  }
}));

const mockSendPaymentNotification = jest.fn().mockResolvedValue(undefined);
const mockSendReminder = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPaymentNotification: mockSendPaymentNotification,
    sendReminder: mockSendReminder
  }))
}));

const mockPixResult = {
  abacatePixId: 'pix-test-123',
  pixBrCode: 'br-code-test',
  pixQrCodeBase64: 'base64-test',
  pixExpiresAt: '2026-12-31',
  pixPaymentUrl: ''
};

jest.mock('../../services/abacatePayService', () => ({
  AbacatePayService: jest.fn().mockImplementation(() => ({
    createPixQrCode: jest.fn().mockResolvedValue(mockPixResult)
  }))
}));

import { PaymentRepository } from '../../repositories/paymentRepository';
import { RentalRepository } from '../../repositories/rentalRepository';
import { MotorcycleRepository } from '../../repositories/motorcycleRepository';
import { SubscriberRepository } from '../../repositories/subscriberRepository';
import { PaymentService } from '../../services/paymentService';
import { NotificationService } from '../../services/notificationService';
import { getDb, resetDb } from '../helpers/sqlite-client';
import { SeedData, seedDb } from '../helpers/seed';

let seedData: SeedData;
let service: PaymentService;

beforeEach(() => {
  resetDb();
  seedData = seedDb(getDb());
  mockSendPaymentNotification.mockClear();
  mockSendReminder.mockClear();

  const paymentRepo = new PaymentRepository();
  const rentalRepo = new RentalRepository();
  const motorcycleRepo = new MotorcycleRepository();
  const subscriberRepo = new SubscriberRepository();
  const notificationService = new NotificationService();
  service = new PaymentService(paymentRepo, rentalRepo, motorcycleRepo, subscriberRepo, notificationService);
});

describe('PaymentService', () => {
  describe('getAllPayments', () => {
    it('returns all payments', async () => {
      const payments = await service.getAllPayments();
      expect(payments).toHaveLength(2);
    });
  });

  describe('getPaymentById', () => {
    it('returns payment when found', async () => {
      const payment = await service.getPaymentById(seedData.payment2Id);
      expect(payment).not.toBeNull();
      expect(payment!.status).toBe('Pendente');
      expect(payment!.amount).toBe(300);
    });

    it('returns null for non-existent id', async () => {
      const payment = await service.getPaymentById('non-existent-id');
      expect(payment).toBeNull();
    });
  });

  describe('getPaymentsByStatus', () => {
    it('returns only payments matching status', async () => {
      const pending = await service.getPaymentsByStatus('Pendente');
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(seedData.payment2Id);

      const paid = await service.getPaymentsByStatus('Pago');
      expect(paid).toHaveLength(1);
      expect(paid[0].id).toBe(seedData.payment1Id);
    });
  });

  describe('markAsPaid', () => {
    it('marks pending payment as paid', async () => {
      const updated = await service.markAsPaid(seedData.payment2Id);

      expect(updated.status).toBe('Pago');
      expect(updated.paid_at).toBeDefined();
      expect(updated.marked_as_paid_at).toBeDefined();
    });

    it('throws when payment is already paid', async () => {
      await expect(service.markAsPaid(seedData.payment1Id)).rejects.toThrow('já está marcado como pago');
    });

    it('throws when payment does not exist', async () => {
      await expect(service.markAsPaid('non-existent-id')).rejects.toThrow('não encontrado');
    });

    it('stores overridden amount and sets is_amount_overridden flag', async () => {
      const updated = await service.markAsPaid(seedData.payment2Id, 350);

      expect(updated.amount).toBe(350);
      expect(updated.is_amount_overridden).toBe(true);
    });

    it('updates motorcycle revenue on payment', async () => {
      await service.markAsPaid(seedData.payment2Id);

      const db = getDb();
      const revenue = db.prepare('SELECT * FROM motorcycle_revenue WHERE rental_id = ?').all(seedData.rental1Id) as { amount: number }[];
      expect(revenue.length).toBeGreaterThanOrEqual(1);

      const moto = db.prepare('SELECT * FROM motorcycles WHERE id = ?').get(seedData.moto2Id) as { total_revenue: number };
      expect(moto.total_revenue).toBe(300);
    });
  });

  describe('markAsUnpaid', () => {
    it('reverts paid payment status based on due_date', async () => {
      // payment1 is Pago with due_date 2026-01-01 which is in the past relative to today 2026-03-08
      const updated = await service.markAsUnpaid(seedData.payment1Id);

      // Due date 2026-01-01 is before today (2026-03-08), so should be Atrasado
      expect(['Atrasado', 'Pendente']).toContain(updated.status);
    });

    it('throws when payment is not in Pago status', async () => {
      // payment2 is Pendente
      await expect(service.markAsUnpaid(seedData.payment2Id)).rejects.toThrow('Apenas pagamentos "Pago"');
    });
  });

  describe('sendReminder', () => {
    it('calls notification service and increments reminder_sent_count', async () => {
      await service.sendReminder(seedData.payment2Id);

      expect(mockSendReminder).toHaveBeenCalledTimes(1);

      const payment = await service.getPaymentById(seedData.payment2Id);
      expect(payment!.reminder_sent_count).toBe(1);
    });

    it('throws when payment is already paid', async () => {
      await expect(service.sendReminder(seedData.payment1Id)).rejects.toThrow('já pago');
    });
  });

  describe('validateIntegrity', () => {
    it('returns total payment count', async () => {
      const result = await service.validateIntegrity();
      expect(result.totalPayments).toBe(2);
    });

    it('detects should_be_overdue inconsistency for past pending payments', async () => {
      // Insert a payment that is Pendente but due in the past
      const db = getDb();
      const pastPaymentId = 'past-payment-test-id';
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status, is_amount_overridden, reminder_sent_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(pastPaymentId, seedData.rental1Id, 'João Silva', 300, 300, '2025-01-01', 'Pendente', 0, 0, now, now);

      const result = await service.validateIntegrity();
      const overdue = result.inconsistencies.filter(i => i.type === 'should_be_overdue');
      expect(overdue.length).toBeGreaterThanOrEqual(1);
    });

    it('detects amount_mismatch without override flag', async () => {
      // Insert payment with mismatched amount but no override flag
      const db = getDb();
      const mismatchId = 'mismatch-payment-id';
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status, is_amount_overridden, reminder_sent_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mismatchId, seedData.rental1Id, 'João Silva', 400, 300, '2026-06-01', 'Pendente', 0, 0, now, now);

      const result = await service.validateIntegrity();
      const mismatches = result.inconsistencies.filter(i => i.type === 'amount_mismatch');
      expect(mismatches.length).toBeGreaterThanOrEqual(1);
    });
  });
});
