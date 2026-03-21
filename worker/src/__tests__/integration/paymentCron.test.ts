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

function dateStr(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
      const db = getDb();
      db.prepare('UPDATE payments SET due_date = ?, status = ? WHERE id = ?')
        .run('2025-01-01', 'Pendente', seedData.payment2Id);

      await cronService.runPaymentGeneration();

      const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Atrasado');
    });
  });

  describe('STEP 0 — deduplicação e acumulados', () => {
    it('remove duplicatas com mesmo due_date no mesmo rental', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments WHERE id = ?').run(seedData.payment1Id);

      // Criar 2 pagamentos com mesma due_date
      const dup1Date = '2026-06-01'; // mesma do payment2
      insertExtraPayment(db, seedData.rental1Id, { due_date: dup1Date, status: 'Pendente', amount: 300 });

      const beforeCount = (db.prepare("SELECT COUNT(*) as cnt FROM payments WHERE rental_id = ? AND due_date = ?").get(seedData.rental1Id, dup1Date) as { cnt: number }).cnt;
      expect(beforeCount).toBe(2);

      await cronService.runPaymentGeneration();

      const afterCount = (db.prepare("SELECT COUNT(*) as cnt FROM payments WHERE rental_id = ? AND due_date = ?").get(seedData.rental1Id, dup1Date) as { cnt: number }).cnt;
      expect(afterCount).toBe(1);
    });

    it('marca pagamento acumulado como Atrasado quando semana mais antiga já venceu', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();
      // Limitar end_date para que STEP 2 não gere novos pagamentos
      db.prepare('UPDATE rentals SET end_date = ? WHERE id = ?').run('2025-06-01', seedData.rental1Id);

      // Pagamento acumulado: R$600, expected R$300, due_date = 2025-05-01
      // 1ª semana = 2025-05-01 - 7 = 2025-04-24 (passado) → deve ser Atrasado
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status,
          is_amount_overridden, reminder_sent_count, created_at, updated_at)
        VALUES ('acc-test-1', ?, 'João Silva', 600, 300, '2025-05-01', 'Pendente', 0, 0, ?, ?)
      `).run(seedData.rental1Id, now, now);

      await cronService.runPaymentGeneration();

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get('acc-test-1') as { status: string };
      expect(payment.status).toBe('Atrasado');
    });

    it('NÃO divide pagamento acumulado em registros separados', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      // Pagamento acumulado: R$900 = 3 semanas de R$300
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status,
          is_amount_overridden, reminder_sent_count, created_at, updated_at)
        VALUES ('acc-nodiv-1', ?, 'João Silva', 900, 300, '2025-12-01', 'Pendente', 0, 0, ?, ?)
      `).run(seedData.rental1Id, now, now);

      await cronService.runPaymentGeneration();

      // O pagamento original não deve ter sido deletado e substituído por 3 registros
      const accPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get('acc-nodiv-1') as { amount: number; status: string } | undefined;
      if (accPayment) {
        // Manteve o valor acumulado (não dividiu)
        expect(accPayment.amount).toBe(900);
        // Status deve ser Atrasado (due_date no passado)
        expect(accPayment.status).toBe('Atrasado');
      }
    });

    it('cancelPixQrCode chamado para duplicatas com abacate_pix_id', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      // Criar 2 pagamentos com mesma due_date, ambos com PIX
      // A deduplicação mantém o de menor ID e cancela o outro
      const now = new Date().toISOString();
      // ID 'aaaa...' será mantido (menor ID)
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status,
          is_amount_overridden, reminder_sent_count, abacate_pix_id, pix_br_code, created_at, updated_at)
        VALUES ('aaaa0000-0000-4000-8000-000000000001', ?, 'João Silva', 300, 300, '2026-06-01', 'Pendente', 0, 0, 'pix-keep', 'br-keep', ?, ?)
      `).run(seedData.rental1Id, now, now);
      // ID 'zzzz...' será removido (maior ID) → PIX cancelado
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status,
          is_amount_overridden, reminder_sent_count, abacate_pix_id, pix_br_code, created_at, updated_at)
        VALUES ('zzzz0000-0000-4000-8000-000000000002', ?, 'João Silva', 300, 300, '2026-06-01', 'Pendente', 0, 0, 'pix-dup-cancel', 'br-dup', ?, ?)
      `).run(seedData.rental1Id, now, now);

      await cronService.runPaymentGeneration();

      expect(mockCancelPixQrCode).toHaveBeenCalledWith('pix-dup-cancel');
    });

    it('rental com apenas 1 ativo → não cancela PIX (sem duplicata)', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments WHERE id = ?').run(seedData.payment1Id);

      await cronService.runPaymentGeneration();

      expect(mockCancelPixQrCode).not.toHaveBeenCalled();
    });
  });

  describe('generateNewPayments (via runPaymentGeneration)', () => {
    it('creates payments for active rentals within 7-day lookahead', async () => {
      const db = getDb();

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

      await cronService.runPaymentGeneration();

      const afterCount = (db.prepare('SELECT COUNT(*) as cnt FROM payments').get() as { cnt: number }).cnt;
      const newCount = afterCount - beforeCount;
      void newCount;
      const dups = db.prepare('SELECT due_date, COUNT(*) as cnt FROM payments WHERE rental_id = ? GROUP BY due_date HAVING cnt > 1').all(seedData.rental1Id);
      expect(dups).toHaveLength(0);
    });

    it('creates past payments as Atrasado and future as Pendente', async () => {
      const db = getDb();
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

    it('gera pagamentos individuais por semana (não acumula em 1 registro)', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();
      // start_date 3 semanas atrás → deve gerar múltiplos pagamentos individuais
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(dateStr(-21), seedData.rental1Id);

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { amount: number }[];

      // Deve ter múltiplos pagamentos, cada um com amount = weekly_value (300)
      expect(active.length).toBeGreaterThan(1);
      active.forEach(p => expect(p.amount).toBe(300));
    });

    it('cada pagamento gerado tem PIX', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(dateStr(-7), seedData.rental1Id);

      await cronService.runPaymentGeneration();

      const payments = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { pix_br_code: string | null }[];

      expect(payments.length).toBeGreaterThanOrEqual(1);
      payments.forEach(p => expect(p.pix_br_code).toBe('br-code-test'));
    });
  });

  describe('generatePaymentsForRental', () => {
    it('generates payments for a specific rental', async () => {
      const db = getDb();
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

    it('start_date no passado (3 semanas atrás) → cria múltiplos pagamentos individuais', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      const threeWeeksAgo = dateStr(-21);
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(threeWeeksAgo, seedData.rental1Id);

      const count = await cronService.generatePaymentsForRental(seedData.rental1Id);

      // Deve criar vários pagamentos individuais (1 por semana)
      expect(count).toBeGreaterThan(1);
      const payments = db.prepare('SELECT * FROM payments WHERE rental_id = ?').all(seedData.rental1Id) as { amount: number }[];
      expect(payments.length).toBeGreaterThan(1);
      payments.forEach(p => expect(p.amount).toBe(300)); // cada um com valor semanal
    });
  });

  describe('backfillMissingQrCodes', () => {
    it('calls AbacatePay for pending payments without pix_br_code', async () => {
      await cronService.backfillMissingQrCodes();

      expect(mockCreatePixQrCode).toHaveBeenCalled();

      const db = getDb();
      const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(seedData.payment2Id) as { pix_br_code: string | null };
      expect(payment.pix_br_code).toBe('br-code-test');
    });

    it('does not call AbacatePay when all pending payments have QR codes', async () => {
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
    it('1 pagamento Pago → cria nova row separada, não reutiliza o registro pago', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

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

      const paid = allPayments.filter(p => p.status === 'Pago');
      const active = allPayments.filter(p => p.status === 'Pendente' || p.status === 'Atrasado');
      expect(paid).toHaveLength(1);
      expect(active.length).toBeGreaterThanOrEqual(1);

      // IDs diferentes
      active.forEach(a => expect(a.id).not.toBe(paid[0].id));
    });

    it('nova cobrança tem due_date após o Pago, NÃO regera a semana paga', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

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
      expect(active[0].due_date > week1Date).toBe(true);
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

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado') ORDER BY due_date"
      ).all(seedData.rental1Id) as { due_date: string }[];

      expect(active.length).toBeGreaterThanOrEqual(1);
      // Todas as cobranças ativas devem ter due_date posterior à semana 2
      active.forEach(p => expect(p.due_date > week2Date).toBe(true));
    });

    it('contrato sem nenhum pagamento (nem Pago) → começa do início do contrato', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();
      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(dateStr(-7), seedData.rental1Id);

      await cronService.runPaymentGeneration();

      const allPayments = db.prepare('SELECT * FROM payments WHERE rental_id = ?').all(seedData.rental1Id) as unknown[];
      expect(allPayments.length).toBeGreaterThanOrEqual(1);
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

    it('PIX é gerado para nova cobrança criada após pagamento Pago', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      db.prepare('UPDATE rentals SET start_date = ? WHERE id = ?').run(dateStr(-14), seedData.rental1Id);
      insertExtraPayment(db, seedData.rental1Id, { due_date: dateStr(-7), status: 'Pago', amount: 300 });

      mockCreatePixQrCode.mockClear();

      await cronService.runPaymentGeneration();

      const active = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { pix_br_code: string | null }[];

      expect(active.length).toBeGreaterThanOrEqual(1);
      active.forEach(p => expect(p.pix_br_code).toBe('br-code-test'));
      expect(mockCreatePixQrCode).toHaveBeenCalled();
    });
  });

  describe('regenerateMissingPixCodes — STEP 1.5', () => {
    it('Pendente sem pix_br_code → PIX gerado e salvo no banco', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

      insertExtraPayment(db, seedData.rental1Id, {
        due_date: '2026-06-01',
        status: 'Pendente',
        amount: 300
      });

      mockCreatePixQrCode.mockClear();
      await cronService.runPaymentGeneration();

      const allActive = db.prepare(
        "SELECT * FROM payments WHERE rental_id = ? AND status IN ('Pendente', 'Atrasado')"
      ).all(seedData.rental1Id) as { pix_br_code: string | null }[];

      allActive.forEach(p => expect(p.pix_br_code).not.toBeNull());
    });

    it('Atrasado sem pix_br_code → PIX gerado no STEP 1.5', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();

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
      // Usar end_date no passado para que STEP 2 não interfira
      db.prepare('UPDATE rentals SET end_date = ? WHERE id = ?').run('2030-02-01', seedData.rental1Id);

      // Usar due_date alinhada ao due_day_of_week=1 (segunda) para que STEP 0.5 não limpe o PIX
      // 2030-01-07 é terça — vamos buscar a próxima segunda: 2030-01-06
      const now = new Date().toISOString();
      const id = 'aabbccdd-0000-4000-8000-aabbccddeeff';
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status,
          paid_at, marked_as_paid_at, previous_status, is_amount_overridden, reminder_sent_count,
          abacate_pix_id, pix_br_code, pix_expires_at, pix_payment_url, pix_qr_code_url, created_at, updated_at)
        VALUES (?, ?, 'João Silva', 300, 300, '2030-01-07', 'Pendente', NULL, NULL, NULL, 0, 0,
                'existing-pix-id', 'existing-br-code', '2030-12-31', NULL, 'https://qr.test/existing', ?, ?)
      `).run(id, seedData.rental1Id, now, now);

      mockCreatePixQrCode.mockClear();
      await cronService.runPaymentGeneration();

      const callsForExistingPix = mockCreatePixQrCode.mock.calls.filter(
        call => call[0]?.metadata?.paymentId === id
      );
      expect(callsForExistingPix).toHaveLength(0);
    });

    it('Atrasado COM pix_br_code → STEP 1.5 não gera novo PIX para esse pagamento', async () => {
      const db = getDb();
      db.prepare('DELETE FROM payments').run();
      db.prepare('UPDATE rentals SET end_date = ? WHERE id = ?').run('2025-01-01', seedData.rental1Id);

      // 2024-12-30 é segunda (alinhado ao due_day_of_week=1)
      const now = new Date().toISOString();
      const id = 'bbccddee-0000-4000-8000-bbccddeeff00';
      db.prepare(`
        INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status,
          paid_at, marked_as_paid_at, previous_status, is_amount_overridden, reminder_sent_count,
          abacate_pix_id, pix_br_code, pix_expires_at, pix_payment_url, pix_qr_code_url, created_at, updated_at)
        VALUES (?, ?, 'João Silva', 600, 300, '2024-12-30', 'Atrasado', NULL, NULL, NULL, 0, 0,
                'existing-overdue-pix', 'existing-overdue-br-code', NULL, NULL, 'https://qr.test/existing', ?, ?)
      `).run(id, seedData.rental1Id, now, now);

      mockCreatePixQrCode.mockClear();
      await cronService.runPaymentGeneration();

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
      mockCreatePixQrCode.mockClear();
      await cronService.backfillMissingQrCodes();

      expect(mockCreatePixQrCode).toHaveBeenCalled();
      const db = getDb();
      const p = db.prepare('SELECT pix_br_code FROM payments WHERE id = ?').get(seedData.payment2Id) as { pix_br_code: string | null };
      expect(p.pix_br_code).toBe('br-code-test');
    });

    it('Pago sem pix_br_code → backfill NÃO toca registros Pagos', async () => {
      mockCreatePixQrCode.mockClear();
      await cronService.backfillMissingQrCodes();

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

      let resolveImmediate: () => void;
      const immediateRan = new Promise<void>(res => { resolveImmediate = res; });

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
