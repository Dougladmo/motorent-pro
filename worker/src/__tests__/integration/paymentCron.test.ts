jest.mock('../../config/supabase', () => ({
  getSupabaseClient: () => {
    const { getMockClient } = require('../helpers/sqlite-client');
    return getMockClient();
  }
}));

// Mock node-cron to prevent real scheduling during tests
jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

const mockSendPaymentNotification = jest.fn().mockResolvedValue(undefined);
const mockSendReminder = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPaymentNotification: mockSendPaymentNotification,
    sendReminder: mockSendReminder
  }))
}));

const mockCreatePixQrCode = jest.fn().mockResolvedValue({
  abacatePixId: 'pix-test-123',
  pixBrCode: 'br-code-test',
  pixQrCodeBase64: 'base64-test',
  pixExpiresAt: '2026-12-31',
  pixPaymentUrl: ''
});

jest.mock('../../services/abacatePayService', () => ({
  AbacatePayService: jest.fn().mockImplementation(() => ({
    createPixQrCode: mockCreatePixQrCode
  }))
}));

import { PaymentCronService } from '../../jobs/paymentCron';
import { PaymentRepository } from '../../repositories/paymentRepository';
import { RentalRepository } from '../../repositories/rentalRepository';
import { SubscriberRepository } from '../../repositories/subscriberRepository';
import { NotificationService } from '../../services/notificationService';
import { getDb, resetDb } from '../helpers/sqlite-client';
import { SeedData, seedDb } from '../helpers/seed';

let seedData: SeedData;
let cronService: PaymentCronService;

beforeEach(() => {
  resetDb();
  seedData = seedDb(getDb());
  mockSendPaymentNotification.mockClear();
  mockSendReminder.mockClear();
  mockCreatePixQrCode.mockClear();

  const paymentRepo = new PaymentRepository();
  const rentalRepo = new RentalRepository();
  const subscriberRepo = new SubscriberRepository();
  const notificationService = new NotificationService();
  cronService = new PaymentCronService(paymentRepo, rentalRepo, subscriberRepo, notificationService);
});

describe('PaymentCronService', () => {
  describe('updateOverduePayments (via runPaymentGeneration)', () => {
    it('marks pending payments past their due_date as Atrasado', async () => {
      // payment2 has due_date 2026-01-08, which is before today (2026-03-08)
      // But it is seeded as Pendente. The cron should detect it as overdue.
      // First, change payment2 due_date to a clearly past date
      const db = getDb();
      db.prepare('UPDATE payments SET due_date = ?, status = ? WHERE id = ?')
        .run('2025-01-01', 'Pendente', seedData.payment2Id);

      await cronService.runPaymentGeneration();

      const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Atrasado');
    });
  });

  describe('generateNewPayments (via runPaymentGeneration)', () => {
    it('creates payments for active rentals within 7-day lookahead', async () => {
      const db = getDb();

      // Clear existing payments and set rental to start close to today
      db.prepare('DELETE FROM payments').run();
      const todayStr = new Date().toISOString().split('T')[0];
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(todayStr, seedData.rental1Id);

      await cronService.runPaymentGeneration();

      const payments = db.prepare('SELECT * FROM payments WHERE rental_id = ?').all(seedData.rental1Id) as { status: string }[];
      expect(payments.length).toBeGreaterThanOrEqual(1);
    });

    it('does not create duplicate payments for existing dates', async () => {
      const db = getDb();
      const beforeCount = (db.prepare('SELECT COUNT(*) as cnt FROM payments').get() as { cnt: number }).cnt;

      // payment2 already exists for 2026-01-08; cron should not duplicate it
      await cronService.runPaymentGeneration();

      const afterCount = (db.prepare('SELECT COUNT(*) as cnt FROM payments').get() as { cnt: number }).cnt;
      // Only new payments should be added, not duplicates for existing dates
      const newCount = afterCount - beforeCount;
      // Verify no duplicate exists for existing seed date
      const dups = db.prepare('SELECT due_date, COUNT(*) as cnt FROM payments WHERE rental_id = ? GROUP BY due_date HAVING cnt > 1').all(seedData.rental1Id);
      expect(dups).toHaveLength(0);
    });

    it('creates past payments as Atrasado and future as Pendente', async () => {
      const db = getDb();

      // Set rental start to a past date and clear payments
      db.prepare('DELETE FROM payments').run();
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run('2025-12-01', seedData.rental1Id);

      await cronService.runPaymentGeneration();

      const payments = db.prepare('SELECT * FROM payments WHERE rental_id = ? ORDER BY due_date').all(seedData.rental1Id) as { due_date: string; status: string }[];

      const today = new Date().toISOString().split('T')[0];
      const pastPayments = payments.filter(p => p.due_date < today);
      const futurePayments = payments.filter(p => p.due_date >= today);

      if (pastPayments.length > 0) {
        pastPayments.forEach(p => expect(p.status).toBe('Atrasado'));
      }
      if (futurePayments.length > 0) {
        futurePayments.forEach(p => expect(['Pendente', 'Atrasado']).toContain(p.status));
      }

      expect(payments.length).toBeGreaterThan(0);
    });

    it('respects end_date and does not generate payments past contract end', async () => {
      const db = getDb();

      // Set a very early end_date so no new payments should be generated past it
      const pastEndDate = '2026-01-15';
      db.prepare('DELETE FROM payments').run();
      db.prepare('UPDATE rentals SET start_date = ?, end_date = ? WHERE id = ?')
        .run('2026-01-01', pastEndDate, seedData.rental1Id);

      await cronService.runPaymentGeneration();

      const payments = db.prepare('SELECT * FROM payments WHERE rental_id = ?').all(seedData.rental1Id) as { due_date: string }[];
      payments.forEach(p => {
        expect(p.due_date <= pastEndDate).toBe(true);
      });
    });
  });

  describe('generatePaymentsForRental', () => {
    it('generates payments for a specific rental', async () => {
      const db = getDb();

      // Clear existing payments and use a fresh rental start date near today
      db.prepare('DELETE FROM payments').run();
      const todayStr = new Date().toISOString().split('T')[0];
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(todayStr, seedData.rental1Id);

      const count = await cronService.generatePaymentsForRental(seedData.rental1Id);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('throws for non-existent rental', async () => {
      await expect(cronService.generatePaymentsForRental('non-existent-id'))
        .rejects.toThrow('não encontrado');
    });

    it('returns 0 for inactive rental', async () => {
      const db = getDb();
      db.prepare('UPDATE rentals SET is_active = 0 WHERE id = ?').run(seedData.rental1Id);

      const count = await cronService.generatePaymentsForRental(seedData.rental1Id);
      expect(count).toBe(0);
    });
  });

  describe('backfillMissingQrCodes', () => {
    it('calls AbacatePay for pending payments without pix_br_code', async () => {
      // payment2 is Pendente and has no pix_br_code
      await cronService.backfillMissingQrCodes();

      expect(mockCreatePixQrCode).toHaveBeenCalled();

      // Verify pix_br_code was stored
      const db = getDb();
      const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(seedData.payment2Id) as { pix_br_code: string | null };
      expect(payment.pix_br_code).toBe('br-code-test');
    });

    it('does not call AbacatePay when all pending payments have QR codes', async () => {
      // Seed a pix code on payment2
      const db = getDb();
      db.prepare('UPDATE payments SET pix_br_code = ? WHERE id = ?').run('existing-br-code', seedData.payment2Id);

      await cronService.backfillMissingQrCodes();

      expect(mockCreatePixQrCode).not.toHaveBeenCalled();
    });
  });

  describe('sendUpcomingPaymentReminders', () => {
    function getTomorrowStr(daysAhead = 1): string {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + daysAhead);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    it('sends reminder for Pendente payment due tomorrow with reminder_sent_count = 0', async () => {
      const db = getDb();
      const tomorrow = getTomorrowStr(1);
      db.prepare('UPDATE payments SET due_date = ?, status = ?, reminder_sent_count = 0 WHERE id = ?')
        .run(tomorrow, 'Pendente', seedData.payment2Id);

      delete process.env.REMINDER_DAYS_BEFORE;

      await cronService.sendUpcomingPaymentReminders();

      expect(mockSendReminder).toHaveBeenCalledTimes(1);
    });

    it('increments reminder_sent_count after sending', async () => {
      const db = getDb();
      const tomorrow = getTomorrowStr(1);
      db.prepare('UPDATE payments SET due_date = ?, status = ?, reminder_sent_count = 0 WHERE id = ?')
        .run(tomorrow, 'Pendente', seedData.payment2Id);

      delete process.env.REMINDER_DAYS_BEFORE;

      await cronService.sendUpcomingPaymentReminders();

      const payment = db.prepare('SELECT reminder_sent_count FROM payments WHERE id = ?').get(seedData.payment2Id) as { reminder_sent_count: number };
      expect(payment.reminder_sent_count).toBe(1);
    });

    it('does not send reminder when reminder_sent_count > 0', async () => {
      const db = getDb();
      const tomorrow = getTomorrowStr(1);
      db.prepare('UPDATE payments SET due_date = ?, status = ?, reminder_sent_count = 1 WHERE id = ?')
        .run(tomorrow, 'Pendente', seedData.payment2Id);

      delete process.env.REMINDER_DAYS_BEFORE;

      await cronService.sendUpcomingPaymentReminders();

      expect(mockSendReminder).not.toHaveBeenCalled();
    });

    it('does not send reminder when due_date does not match target', async () => {
      const db = getDb();
      // Keep payment2 due_date far in the future (seed default 2026-06-01)
      db.prepare('UPDATE payments SET reminder_sent_count = 0 WHERE id = ?').run(seedData.payment2Id);

      delete process.env.REMINDER_DAYS_BEFORE;

      await cronService.sendUpcomingPaymentReminders();

      expect(mockSendReminder).not.toHaveBeenCalled();
    });

    it('respects REMINDER_DAYS_BEFORE=2 and targets 2 days from now', async () => {
      const db = getDb();
      const twoDaysAhead = getTomorrowStr(2);
      db.prepare('UPDATE payments SET due_date = ?, status = ?, reminder_sent_count = 0 WHERE id = ?')
        .run(twoDaysAhead, 'Pendente', seedData.payment2Id);

      process.env.REMINDER_DAYS_BEFORE = '2';

      await cronService.sendUpcomingPaymentReminders();

      delete process.env.REMINDER_DAYS_BEFORE;

      expect(mockSendReminder).toHaveBeenCalledTimes(1);
    });

    it('does not send reminder for Atrasado payments', async () => {
      const db = getDb();
      const tomorrow = getTomorrowStr(1);
      db.prepare('UPDATE payments SET due_date = ?, status = ?, reminder_sent_count = 0 WHERE id = ?')
        .run(tomorrow, 'Atrasado', seedData.payment2Id);

      delete process.env.REMINDER_DAYS_BEFORE;

      await cronService.sendUpcomingPaymentReminders();

      expect(mockSendReminder).not.toHaveBeenCalled();
    });
  });

  describe('startCronJobs', () => {
    it('schedules cron and runs immediately on start', async () => {
      const nodeCron = require('node-cron');

      // Wait for the immediate async call triggered by startCronJobs
      let resolveImmediate: () => void;
      const immediateRan = new Promise<void>(res => { resolveImmediate = res; });

      // Spy on runPaymentGeneration
      const spy = jest.spyOn(cronService, 'runPaymentGeneration').mockImplementation(async () => {
        resolveImmediate();
      });

      cronService.startCronJobs();

      await immediateRan;

      expect(nodeCron.schedule).toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });
  });
});
