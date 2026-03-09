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

const mockCancelPixQrCode = jest.fn().mockResolvedValue(true);

jest.mock('../../services/abacatePayService', () => ({
  AbacatePayService: jest.fn().mockImplementation(() => ({
    createPixQrCode: mockCreatePixQrCode,
    cancelPixQrCode: mockCancelPixQrCode
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

// Helper to insert an extra payment directly into the DB
function insertExtraPayment(
  db: ReturnType<typeof getDb>,
  rentalId: string,
  overrides: {
    amount?: number;
    due_date?: string;
    status?: string;
    abacate_pix_id?: string | null;
  } = {}
): string {
  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status,
      paid_at, marked_as_paid_at, previous_status, is_amount_overridden, reminder_sent_count,
      abacate_pix_id, pix_br_code, pix_qr_code_base64, pix_expires_at, pix_payment_url, created_at, updated_at)
    VALUES (?, ?, 'João Silva', ?, 300, ?, ?, NULL, NULL, NULL, 0, 0, ?, NULL, NULL, NULL, NULL, ?, ?)
  `).run(
    id, rentalId,
    overrides.amount ?? 300,
    overrides.due_date ?? '2026-06-01',
    overrides.status ?? 'Pendente',
    overrides.abacate_pix_id ?? null,
    now, now
  );
  return id;
}

beforeEach(() => {
  resetDb();
  seedData = seedDb(getDb());
  mockSendPaymentNotification.mockClear();
  mockSendReminder.mockClear();
  mockCreatePixQrCode.mockClear();
  mockCancelPixQrCode.mockClear();

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

  describe('consolidateExistingDuplicates (via runPaymentGeneration)', () => {
    it('2 Pendente no mesmo rental → consolida em 1, amount = soma, status = Pendente', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments WHERE id = ?').run(seedData.payment1Id);
      // payment2Id: Pendente, due_date='2026-06-01', amount=300
      // Add a second Pendente payment with a future date
      insertExtraPayment(db, seedData.rental1Id, { due_date: '2026-07-01', status: 'Pendente', amount: 300 });

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { amount: number; status: string }[];
      expect(active).toHaveLength(1);
      expect(active[0].amount).toBe(600);
      expect(active[0].status).toBe('Pendente');
    });

    it('1 Pendente + 1 Atrasado → status consolidado = Atrasado', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments WHERE id = ?').run(seedData.payment1Id);
      // payment2Id: Pendente, due_date='2026-06-01'
      // Add an Atrasado payment
      insertExtraPayment(db, seedData.rental1Id, { due_date: '2026-05-01', status: 'Atrasado', amount: 300 });

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { status: string }[];
      expect(active).toHaveLength(1);
      expect(active[0].status).toBe('Atrasado');
    });

    it('2 Pendente com latest due_date < today → status consolidado = Atrasado', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();
      // Both past dates (well before any reasonable "today")
      insertExtraPayment(db, seedData.rental1Id, { due_date: '2025-11-01', status: 'Pendente', amount: 300 });
      insertExtraPayment(db, seedData.rental1Id, { due_date: '2025-12-01', status: 'Pendente', amount: 300 });

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { status: string }[];
      expect(active).toHaveLength(1);
      expect(active[0].status).toBe('Atrasado');
    });

    it('cancelPixQrCode chamado para cada pagamento com abacate_pix_id', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments WHERE id = ?').run(seedData.payment1Id);
      // Give payment2 a PIX id
      db.prepare("UPDATE payments SET abacate_pix_id = 'pix-cancel-1' WHERE id = ?").run(seedData.payment2Id);
      // Add another active payment with a PIX id (far future → STEP 2 won't retrigger)
      insertExtraPayment(db, seedData.rental1Id, {
        due_date: '2026-07-01',
        status: 'Pendente',
        amount: 300,
        abacate_pix_id: 'pix-cancel-2'
      });

      await cronService.runPaymentGeneration();

      expect(mockCancelPixQrCode).toHaveBeenCalledWith('pix-cancel-1');
      expect(mockCancelPixQrCode).toHaveBeenCalledWith('pix-cancel-2');
    });

    it('após consolidação, apenas 1 registro ativo no banco', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments WHERE id = ?').run(seedData.payment1Id);
      // Add 2 more to create 3 total active payments
      insertExtraPayment(db, seedData.rental1Id, { due_date: '2026-07-01', status: 'Pendente', amount: 300 });
      insertExtraPayment(db, seedData.rental1Id, { due_date: '2026-08-01', status: 'Atrasado', amount: 300 });

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as unknown[];
      expect(active).toHaveLength(1);
    });

    it('novo PIX criado para o registro consolidado com valor total', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments WHERE id = ?').run(seedData.payment1Id);
      // payment2Id: amount=300 + one more = total 600
      insertExtraPayment(db, seedData.rental1Id, { due_date: '2026-07-01', status: 'Pendente', amount: 300 });

      await cronService.runPaymentGeneration();

      expect(mockCreatePixQrCode).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 600 })
      );
    });

    it('rental com apenas 1 ativo → não consolida (cancelPixQrCode não chamado)', async () => {
      const db = getDb();
      // Remove payment1 (Pago), leaving only payment2 (1 active)
      db.prepare('DELETE FROM payments WHERE id = ?').run(seedData.payment1Id);

      await cronService.runPaymentGeneration();

      expect(mockCancelPixQrCode).not.toHaveBeenCalled();
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
      void newCount;
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

    it('atualiza pagamento existente quando nova semana é detectada (não cria novo)', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Active payment with due_date = today; lookahead will find today+7 as uncovered
      const existingId = insertExtraPayment(db, seedData.rental1Id, {
        due_date: todayStr,
        status: 'Pendente',
        amount: 300
      });

      await cronService.runPaymentGeneration();

      const afterActive = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { id: string; amount: number }[];

      // Still exactly 1 active (updated, not duplicated)
      expect(afterActive).toHaveLength(1);
      // Same payment ID — updated in place, not replaced
      expect(afterActive[0].id).toBe(existingId);
      // Amount accumulated (today+7 was added)
      expect(afterActive[0].amount).toBeGreaterThan(300);
    });

    it('acumulação: ativo de R$300 + 2 semanas → amount = R$900', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      // Active payment with due_date = 7 days ago
      // STEP 2 will find: cursor=today, cursor=today+7 → 2 uncovered weeks
      insertExtraPayment(db, seedData.rental1Id, {
        due_date: sevenDaysAgoStr,
        status: 'Pendente',
        amount: 300
      });

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { amount: number }[];

      expect(active).toHaveLength(1);
      expect(active[0].amount).toBe(900); // 300 + 2 * 300
    });

    it('atualização cancela PIX antigo do pagamento ativo', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Active payment with a PIX id; STEP 2 will update it and cancel the old PIX
      insertExtraPayment(db, seedData.rental1Id, {
        due_date: todayStr,
        status: 'Pendente',
        amount: 300,
        abacate_pix_id: 'old-pix-to-cancel'
      });

      await cronService.runPaymentGeneration();

      expect(mockCancelPixQrCode).toHaveBeenCalledWith('old-pix-to-cancel');
    });

    it('novo PIX gerado com valor acumulado após atualização', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      insertExtraPayment(db, seedData.rental1Id, {
        due_date: todayStr,
        status: 'Pendente',
        amount: 300
      });

      await cronService.runPaymentGeneration();

      // createPixQrCode should have been called with an amount > original 300
      const calls = mockCreatePixQrCode.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const lastCallAmount = calls[calls.length - 1][0].amount;
      expect(lastCallAmount).toBeGreaterThan(300);
    });

    it('rental sem ativo → cria exatamente 1 pagamento consolidado', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run('2026-01-01', seedData.rental1Id);

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as unknown[];
      expect(active).toHaveLength(1);
    });

    it('após runPaymentGeneration, no máximo 1 pagamento ativo por rental', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      // Insert 3 active payments to simulate bad state
      insertExtraPayment(db, seedData.rental1Id, { due_date: '2026-05-01', status: 'Pendente', amount: 300 });
      insertExtraPayment(db, seedData.rental1Id, { due_date: '2026-06-01', status: 'Pendente', amount: 300 });
      insertExtraPayment(db, seedData.rental1Id, { due_date: '2026-07-01', status: 'Atrasado', amount: 300 });

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as unknown[];
      expect(active).toHaveLength(1);
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

    it('contrato novo com start_date = hoje → cria exatamente 1 pagamento', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const todayStr = new Date().toISOString().split('T')[0];
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(todayStr, seedData.rental1Id);

      const count = await cronService.generatePaymentsForRental(seedData.rental1Id);

      expect(count).toBe(1);
      const payments = db.prepare('SELECT * FROM payments WHERE rental_id = ?').all(seedData.rental1Id) as unknown[];
      expect(payments).toHaveLength(1);
    });

    it('start_date no passado (3 semanas atrás) → 1 pagamento consolidado com amount >= 3 × weekly_value', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const threeWeeksAgo = new Date(today);
      threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
      const threeWeeksAgoStr = threeWeeksAgo.toISOString().split('T')[0];
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(threeWeeksAgoStr, seedData.rental1Id);

      const count = await cronService.generatePaymentsForRental(seedData.rental1Id);

      expect(count).toBe(1);
      const payments = db.prepare('SELECT * FROM payments WHERE rental_id = ?').all(seedData.rental1Id) as { amount: number }[];
      expect(payments).toHaveLength(1);
      expect(payments[0].amount).toBeGreaterThanOrEqual(300 * 3);
    });

    it('sempre retorna 1, independente do número de semanas consolidadas', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      // Rental starting many weeks ago → many uncovered weeks, but still returns 1
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run('2026-01-01', seedData.rental1Id);

      const count = await cronService.generatePaymentsForRental(seedData.rental1Id);
      expect(count).toBe(1);
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
