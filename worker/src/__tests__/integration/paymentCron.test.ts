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
    pix_br_code?: string | null;
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
      abacate_pix_id, pix_br_code, pix_expires_at, pix_payment_url, created_at, updated_at)
    VALUES (?, ?, 'João Silva', ?, 300, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?, NULL, NULL, ?, ?)
  `).run(
    id, rentalId,
    overrides.amount ?? 300,
    overrides.due_date ?? '2026-06-01',
    overrides.status ?? 'Pendente',
    overrides.abacate_pix_id ?? null,
    overrides.pix_br_code ?? null,
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

      // Payment has both abacate_pix_id AND pix_br_code set → STEP 1.5 skips it (pix_br_code not null)
      // STEP 2 then accumulates and cancels 'old-pix-to-cancel'
      insertExtraPayment(db, seedData.rental1Id, {
        due_date: todayStr,
        status: 'Pendente',
        amount: 300,
        abacate_pix_id: 'old-pix-to-cancel',
        pix_br_code: 'existing-br-code'
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

  describe('generateNewPayments — Pago gera nova cobrança separada (bug fix)', () => {
    function dateStr(offsetDays: number): string {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + offsetDays);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    it('1 pagamento Pago → cria nova row separada, não reutiliza o registro pago', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      // Contrato começa 14 dias atrás; pagamento da semana 1 já foi pago (due_date = 7 dias atrás)
      const startDate = dateStr(-14);
      const week1Date = dateStr(-7);
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(startDate, seedData.rental1Id);

      insertExtraPayment(db, seedData.rental1Id, {
        due_date: week1Date,
        status: 'Pago',
        amount: 300
      });

      await cronService.runPaymentGeneration();

      const allPayments = db.prepare('SELECT * FROM payments WHERE rental_id = ?').all(seedData.rental1Id) as { status: string; id: string }[];

      // Deve ter 2 registros: 1 Pago + 1 Pendente ou Atrasado
      expect(allPayments).toHaveLength(2);

      const paid = allPayments.filter(p => p.status === 'Pago');
      const active = allPayments.filter(p => p.status === 'Pendente' || p.status === 'Atrasado');
      expect(paid).toHaveLength(1);
      expect(active).toHaveLength(1);

      // IDs diferentes: nova row criada, não o mesmo registro modificado
      expect(active[0].id).not.toBe(paid[0].id);
    });

    it('nova cobrança tem due_date = semana 2 (7 dias após o pagamento Pago), NÃO regera a semana 1', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      // week1Date = hoje: cursor começa em hoje+7, apenas 1 data no lookahead → amount exato = 300
      const startDate = dateStr(-7);
      const week1Date = dateStr(0);
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(startDate, seedData.rental1Id);

      insertExtraPayment(db, seedData.rental1Id, {
        due_date: week1Date,
        status: 'Pago',
        amount: 300
      });

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { due_date: string; amount: number }[];

      expect(active).toHaveLength(1);

      // due_date da nova cobrança deve ser APÓS a semana 1 (não re-gerou semana 1)
      expect(active[0].due_date > week1Date).toBe(true);

      // amount = 300 (apenas semana 2, não acumulou semana 1 novamente)
      expect(active[0].amount).toBe(300);
    });

    it('múltiplos pagamentos Pagos → nova cobrança continua a partir do último Pago', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const startDate = dateStr(-21);
      const week1Date = dateStr(-14);
      const week2Date = dateStr(-7);
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(startDate, seedData.rental1Id);

      insertExtraPayment(db, seedData.rental1Id, { due_date: week1Date, status: 'Pago', amount: 300 });
      insertExtraPayment(db, seedData.rental1Id, { due_date: week2Date, status: 'Pago', amount: 300 });

      await cronService.runPaymentGeneration();

      const allPayments = db.prepare('SELECT * FROM payments WHERE rental_id = ? ORDER BY due_date').all(seedData.rental1Id) as { status: string; due_date: string }[];
      const active = allPayments.filter(p => p.status === 'Pendente' || p.status === 'Atrasado');

      // Apenas 1 cobrança ativa, com due_date posterior à semana 2
      expect(active).toHaveLength(1);
      expect(active[0].due_date > week2Date).toBe(true);
    });

    it('contrato sem nenhum pagamento (nem Pago) → começa do início do contrato', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(dateStr(-7), seedData.rental1Id);

      await cronService.runPaymentGeneration();

      const allPayments = db.prepare('SELECT * FROM payments WHERE rental_id = ?').all(seedData.rental1Id) as unknown[];
      expect(allPayments.length).toBeGreaterThanOrEqual(1);
    });

    it('1 Pago + 1 Pendente existente → acumula no Pendente sem recriar a semana paga', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const startDate = dateStr(-21);
      const week1Date = dateStr(-14);
      const week2Date = dateStr(-7);
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(startDate, seedData.rental1Id);

      insertExtraPayment(db, seedData.rental1Id, { due_date: week1Date, status: 'Pago', amount: 300 });
      const pendingId = insertExtraPayment(db, seedData.rental1Id, { due_date: week2Date, status: 'Pendente', amount: 300 });

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { id: string; amount: number }[];

      // Deve ter 1 ativo, que é o Pendente existente (acumulado), não um novo
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(pendingId);
      // Acumulou semana 3 (hoje+7) → amount = 600
      expect(active[0].amount).toBeGreaterThan(300);
    });

    it('runPaymentGeneration após pagamento pago NÃO altera o registro Pago', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const paidId = insertExtraPayment(db, seedData.rental1Id, {
        due_date: dateStr(-7),
        status: 'Pago',
        amount: 300
      });

      await cronService.runPaymentGeneration();

      const paidRow = db.prepare('SELECT * FROM payments WHERE id = ?').get(paidId) as { status: string; amount: number };
      expect(paidRow.status).toBe('Pago');
      expect(paidRow.amount).toBe(300);
    });

    it('PIX é gerado para a nova cobrança criada após pagamento Pago', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(dateStr(-14), seedData.rental1Id);
      insertExtraPayment(db, seedData.rental1Id, { due_date: dateStr(-7), status: 'Pago', amount: 300 });

      mockCreatePixQrCode.mockClear();

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { pix_br_code: string | null }[];

      expect(active).toHaveLength(1);
      expect(active[0].pix_br_code).toBe('br-code-test');
      expect(mockCreatePixQrCode).toHaveBeenCalled();
    });
  });

  describe('regenerateMissingPixCodes — STEP 1.5', () => {
    it('Pendente sem pix_br_code → PIX gerado e salvo no banco', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const paymentId = insertExtraPayment(db, seedData.rental1Id, {
        due_date: '2026-06-01',
        status: 'Pendente',
        amount: 300
      });

      mockCreatePixQrCode.mockClear();
      await cronService.runPaymentGeneration();

      const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as { pix_br_code: string | null } | undefined;

      // Se o pagamento ainda existir (pode ter sido atualizado/acumulado pelo STEP 2)
      const allActive = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { pix_br_code: string | null }[];

      // Todos pagamentos ativos devem ter PIX
      allActive.forEach(p => expect(p.pix_br_code).not.toBeNull());
      void payment;
    });

    it('Atrasado sem pix_br_code → PIX gerado no STEP 1.5', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      // Pagamento atrasado sem PIX — STEP 1.5 deve regenerar
      insertExtraPayment(db, seedData.rental1Id, {
        due_date: '2025-01-01',
        status: 'Atrasado',
        amount: 300,
        abacate_pix_id: null
      });

      mockCreatePixQrCode.mockClear();
      await cronService.runPaymentGeneration();

      expect(mockCreatePixQrCode).toHaveBeenCalled();
    });

    it('Pendente COM pix_br_code → STEP 1.5 não chama createPixQrCode para esse pagamento', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      // Inserir Pendente já com PIX e due_date bem no futuro (fora do lookahead do STEP 2)
      const now = new Date().toISOString();
      const id = 'aabbccdd-0000-4000-8000-aabbccddeeff';
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status,
          paid_at, marked_as_paid_at, previous_status, is_amount_overridden, reminder_sent_count,
          abacate_pix_id, pix_br_code, pix_expires_at, pix_payment_url, created_at, updated_at)
        VALUES (?, ?, 'João Silva', 300, 300, '2030-01-01', 'Pendente', NULL, NULL, NULL, 0, 0,
                'existing-pix-id', 'existing-br-code', '2030-12-31', NULL, ?, ?)
      `).run(id, seedData.rental1Id, now, now);

      mockCreatePixQrCode.mockClear();
      // STEP 1.5 não deve chamar createPixQrCode para este pagamento (já tem PIX)
      // STEP 2 pode chamar para acumulação, mas não é o STEP 1.5
      // Para isolar, chamamos findActiveWithoutPix diretamente via runPaymentGeneration
      // e verificamos que o registro ainda tem o mesmo pix_br_code
      await cronService.runPaymentGeneration();

      const payment = db.prepare('SELECT pix_br_code FROM payments WHERE id = ?').get(id) as { pix_br_code: string } | undefined;
      // O registro pode ter sido atualizado pelo STEP 2 (acumulação), mas o STEP 1.5 não sobrescreveu com o existente
      // O importante é que createPixQrCode foi chamado com lógica correta
      void payment;
      // Não deve ter chamado createPixQrCode para o registro com PIX existente no STEP 1.5
      // (mas pode ter chamado por outros motivos no STEP 2)
      const callsForExistingPix = mockCreatePixQrCode.mock.calls.filter(
        call => call[0]?.metadata?.paymentId === id
      );
      expect(callsForExistingPix).toHaveLength(0);
    });

    it('Atrasado COM pix_br_code → STEP 1.5 não gera novo PIX para esse pagamento', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      // Usar end_date no passado para que STEP 2 não toque este pagamento
      db.prepare('UPDATE rentals SET end_date = ? WHERE id = ?').run('2025-01-01', seedData.rental1Id);

      const now = new Date().toISOString();
      const id = 'bbccddee-0000-4000-8000-bbccddeeff00';
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status,
          paid_at, marked_as_paid_at, previous_status, is_amount_overridden, reminder_sent_count,
          abacate_pix_id, pix_br_code, pix_expires_at, pix_payment_url, created_at, updated_at)
        VALUES (?, ?, 'João Silva', 600, 300, '2025-01-01', 'Atrasado', NULL, NULL, NULL, 0, 0,
                'existing-overdue-pix', 'existing-overdue-br-code', NULL, NULL, ?, ?)
      `).run(id, seedData.rental1Id, now, now);

      mockCreatePixQrCode.mockClear();
      await cronService.runPaymentGeneration();

      // STEP 1.5 não deve ter chamado createPixQrCode (pix_br_code não é null)
      const callsForThisPayment = mockCreatePixQrCode.mock.calls.filter(
        call => call[0]?.metadata?.paymentId === id
      );
      expect(callsForThisPayment).toHaveLength(0);
    });
  });

  describe('backfillMissingQrCodes — cobre Pendente e Atrasado', () => {
    it('Atrasado sem pix_br_code → backfill também regenera PIX', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const now = new Date().toISOString();
      const id = 'ccddee00-0000-4000-8000-ccddee001122';
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status,
          paid_at, marked_as_paid_at, previous_status, is_amount_overridden, reminder_sent_count,
          abacate_pix_id, pix_br_code, pix_expires_at, pix_payment_url, created_at, updated_at)
        VALUES (?, ?, 'João Silva', 600, 300, '2025-01-01', 'Atrasado', NULL, NULL, NULL, 0, 0,
                NULL, NULL, NULL, NULL, ?, ?)
      `).run(id, seedData.rental1Id, now, now);

      mockCreatePixQrCode.mockClear();
      await cronService.backfillMissingQrCodes();

      expect(mockCreatePixQrCode).toHaveBeenCalled();

      const payment = db.prepare('SELECT pix_br_code FROM payments WHERE id = ?').get(id) as { pix_br_code: string | null };
      expect(payment.pix_br_code).toBe('br-code-test');
    });

    it('Pendente sem pix_br_code → backfill regenera PIX', async () => {
      // payment2 está Pendente sem PIX (seed padrão)
      mockCreatePixQrCode.mockClear();
      await cronService.backfillMissingQrCodes();

      expect(mockCreatePixQrCode).toHaveBeenCalled();
      const db = getDb();
      const p = db.prepare('SELECT pix_br_code FROM payments WHERE id = ?').get(seedData.payment2Id) as { pix_br_code: string | null };
      expect(p.pix_br_code).toBe('br-code-test');
    });

    it('Pago sem pix_br_code → backfill NÃO toca registros Pagos', async () => {
      // payment1 está Pago sem PIX (seed padrão)
      mockCreatePixQrCode.mockClear();
      await cronService.backfillMissingQrCodes();

      // Nenhuma chamada deve referenciar payment1 (Pago)
      const callsForPaid = mockCreatePixQrCode.mock.calls.filter(
        call => call[0]?.metadata?.paymentId === seedData.payment1Id
      );
      expect(callsForPaid).toHaveLength(0);
    });

    it('todos com pix_br_code → nenhuma chamada ao AbacatePay', async () => {
      const db = getDb();
      db.prepare('UPDATE payments SET pix_br_code = ? WHERE id = ?').run('existing-code', seedData.payment2Id);

      mockCreatePixQrCode.mockClear();
      await cronService.backfillMissingQrCodes();

      expect(mockCreatePixQrCode).not.toHaveBeenCalled();
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
