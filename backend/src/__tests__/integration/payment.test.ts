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
    it('marks pending payment as paid when no verifiedAmount is provided', async () => {
      const updated = await service.markAsPaid(seedData.payment2Id);

      expect(updated.status).toBe('Pago');
      expect(updated.paid_at).toBeDefined();
      expect(updated.marked_as_paid_at).toBeDefined();
    });

    it('marks paid when verifiedAmount equals expected_amount', async () => {
      // payment2 has expected_amount = 300
      const updated = await service.markAsPaid(seedData.payment2Id, 300);

      expect(updated.status).toBe('Pago');
      expect(updated.amount).toBe(300);
      expect(updated.is_amount_overridden).toBe(false);
    });

    it('marks paid when verifiedAmount is greater than expected_amount', async () => {
      const updated = await service.markAsPaid(seedData.payment2Id, 350);

      expect(updated.status).toBe('Pago');
      expect(updated.amount).toBe(350);
      expect(updated.is_amount_overridden).toBe(true);
    });

    it('does NOT mark as paid when verifiedAmount is less than expected_amount (pagamento parcial)', async () => {
      // payment2 has expected_amount = 300; paying only 150
      const updated = await service.markAsPaid(seedData.payment2Id, 150);

      expect(updated.status).toBe('Pendente');
      expect(updated.amount).toBe(150);
      expect(updated.is_amount_overridden).toBe(true);
      expect(updated.paid_at).toBeNull();
      expect(updated.marked_as_paid_at).toBeNull();
    });

    it('does not update motorcycle revenue on partial payment', async () => {
      await service.markAsPaid(seedData.payment2Id, 150);

      const db = getDb();
      const revenue = db.prepare('SELECT * FROM motorcycle_revenue WHERE rental_id = ?').all(seedData.rental1Id) as { amount: number }[];
      expect(revenue).toHaveLength(0);

      const moto = db.prepare('SELECT * FROM motorcycles WHERE id = ?').get(seedData.moto2Id) as { total_revenue: number };
      expect(moto.total_revenue).toBe(0);
    });

    it('throws when payment is already paid', async () => {
      await expect(service.markAsPaid(seedData.payment1Id)).rejects.toThrow('já está marcado como pago');
    });

    it('throws when payment does not exist', async () => {
      await expect(service.markAsPaid('non-existent-id')).rejects.toThrow('não encontrado');
    });

    it('updates motorcycle revenue on full payment', async () => {
      await service.markAsPaid(seedData.payment2Id);

      const db = getDb();
      const revenue = db.prepare('SELECT * FROM motorcycle_revenue WHERE rental_id = ?').all(seedData.rental1Id) as { amount: number }[];
      expect(revenue.length).toBeGreaterThanOrEqual(1);

      const moto = db.prepare('SELECT * FROM motorcycles WHERE id = ?').get(seedData.moto2Id) as { total_revenue: number };
      expect(moto.total_revenue).toBe(300);
    });

    it('updates total_paid of rental on full payment', async () => {
      const db = getDb();
      const rentalBefore = db.prepare('SELECT total_paid FROM rentals WHERE id = ?').get(seedData.rental1Id) as { total_paid: number };
      expect(rentalBefore.total_paid).toBe(0);

      await service.markAsPaid(seedData.payment2Id);

      const rentalAfter = db.prepare('SELECT total_paid FROM rentals WHERE id = ?').get(seedData.rental1Id) as { total_paid: number };
      expect(rentalAfter.total_paid).toBe(300);
    });

    it('recalculates outstanding_balance to 0 when all payments are paid', async () => {
      // seed: payment1=Pago, payment2=Pendente (300). Paying payment2 leaves no Pendente/Atrasado.
      await service.markAsPaid(seedData.payment2Id);

      const db = getDb();
      const rental = db.prepare('SELECT outstanding_balance FROM rentals WHERE id = ?').get(seedData.rental1Id) as { outstanding_balance: number };
      expect(rental.outstanding_balance).toBe(0);
    });
  });

  describe('deletePayment', () => {
    it('deletes an existing payment successfully', async () => {
      await service.deletePayment(seedData.payment2Id);

      const payment = await service.getPaymentById(seedData.payment2Id);
      expect(payment).toBeNull();
    });

    it('throws when payment does not exist', async () => {
      await expect(service.deletePayment('non-existent-id')).rejects.toThrow('não encontrado');
    });
  });

  describe('updatePayment', () => {
    it('updates amount and due_date correctly', async () => {
      const updated = await service.updatePayment(seedData.payment2Id, {
        amount: 350,
        due_date: '2026-07-01'
      });

      expect(updated.amount).toBe(350);
      expect(updated.due_date).toBe('2026-07-01');
    });

    it('throws when payment does not exist', async () => {
      await expect(
        service.updatePayment('non-existent-id', { amount: 100 })
      ).rejects.toThrow('não encontrado');
    });
  });

  describe('markAsUnpaid', () => {
    it('reverts paid payment to previous_status when previous_status is set and not Pago', async () => {
      // payment1 has previous_status='Pendente' in seed; service returns previous_status when it's not 'Pago'
      const updated = await service.markAsUnpaid(seedData.payment1Id);
      expect(updated.status).toBe('Pendente');
    });

    it('throws when payment is not in Pago status', async () => {
      // payment2 is Pendente
      await expect(service.markAsUnpaid(seedData.payment2Id)).rejects.toThrow('Apenas pagamentos "Pago"');
    });

    it('decrements total_paid of rental', async () => {
      // First mark payment2 as paid so rental has total_paid > 0
      await service.markAsPaid(seedData.payment2Id);

      const db = getDb();
      const rentalAfterPay = db.prepare('SELECT total_paid FROM rentals WHERE id = ?').get(seedData.rental1Id) as { total_paid: number };
      expect(rentalAfterPay.total_paid).toBeGreaterThan(0);

      // Now mark payment2 as unpaid
      await service.markAsUnpaid(seedData.payment2Id);

      const rentalAfterUnpay = db.prepare('SELECT total_paid FROM rentals WHERE id = ?').get(seedData.rental1Id) as { total_paid: number };
      expect(rentalAfterUnpay.total_paid).toBe(0);
    });

    it('decrements total_revenue of motorcycle', async () => {
      // First mark payment2 as paid so motorcycle has revenue
      await service.markAsPaid(seedData.payment2Id);

      const db = getDb();
      const motoAfterPay = db.prepare('SELECT total_revenue FROM motorcycles WHERE id = ?').get(seedData.moto2Id) as { total_revenue: number };
      expect(motoAfterPay.total_revenue).toBeGreaterThan(0);

      // Now revert payment1 (Pago) to test that motorcycle revenue is decremented
      await service.markAsUnpaid(seedData.payment1Id);

      const motoAfterUnpay = db.prepare('SELECT total_revenue FROM motorcycles WHERE id = ?').get(seedData.moto2Id) as { total_revenue: number };
      // payment1 had amount 300, so after decrement from the markAsPaid(payment2) revenue, it should decrease
      expect(motoAfterUnpay.total_revenue).toBeLessThan(motoAfterPay.total_revenue);
    });

    it('recalculates outstanding_balance to include the reverted payment amount', async () => {
      // First: mark payment2 as paid so outstanding_balance = 0
      await service.markAsPaid(seedData.payment2Id);
      const db = getDb();
      const rentalAfterPay = db.prepare('SELECT outstanding_balance FROM rentals WHERE id = ?').get(seedData.rental1Id) as { outstanding_balance: number };
      expect(rentalAfterPay.outstanding_balance).toBe(0);

      // Now: revert payment2 → outstanding_balance should be 300 again
      await service.markAsUnpaid(seedData.payment2Id);
      const rentalAfterUnpay = db.prepare('SELECT outstanding_balance FROM rentals WHERE id = ?').get(seedData.rental1Id) as { outstanding_balance: number };
      expect(rentalAfterUnpay.outstanding_balance).toBe(300);
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

    it('passa pixQrCodeUrl do banco quando pagamento já tem pix_qr_code_url', async () => {
      // Simular pagamento que já tem PIX gerado e URL salva no banco
      const db = getDb();
      const storedUrl = 'https://supabase.co/storage/qr-codes/qrcode_test.png';
      db.prepare('UPDATE payments SET pix_br_code = ?, pix_qr_code_url = ? WHERE id = ?')
        .run('00020101021126580014BR.GOV.BCB.PIX', storedUrl, seedData.payment2Id);

      await service.sendReminder(seedData.payment2Id);

      expect(mockSendReminder).toHaveBeenCalledTimes(1);
      const params = mockSendReminder.mock.calls[0][0];
      expect(params.pixBrCode).toBe('00020101021126580014BR.GOV.BCB.PIX');
      expect(params.pixQrCodeUrl).toBe(storedUrl);
    });

    it('passa pixQrCodeUrl do banco mesmo sem pixQrCodeBase64', async () => {
      // Cenário do bug original: pagamento tem pix_br_code e pix_qr_code_url no banco,
      // mas sendReminder não passava a URL porque não gerava novo PIX
      const db = getDb();
      const storedUrl = 'https://supabase.co/storage/qr-codes/existing.png';
      db.prepare('UPDATE payments SET pix_br_code = ?, pix_qr_code_url = ?, abacate_pix_id = ? WHERE id = ?')
        .run('pix-br-code-existing', storedUrl, 'pix-id-existing', seedData.payment2Id);

      await service.sendReminder(seedData.payment2Id);

      const params = mockSendReminder.mock.calls[0][0];
      // A URL do banco DEVE ser passada (este era o bug que causava QR ausente no email)
      expect(params.pixQrCodeUrl).toBe(storedUrl);
      // pixQrCodeBase64 não deve existir (PIX já existia, não foi criado agora)
      expect(params.pixQrCodeBase64).toBeUndefined();
    });

    it('gera novo PIX e passa base64 quando pagamento não tem pix_br_code', async () => {
      // Pagamento sem PIX → sendReminder deve criar um novo
      const db = getDb();
      db.prepare('UPDATE payments SET pix_br_code = NULL, abacate_pix_id = NULL WHERE id = ?')
        .run(seedData.payment2Id);

      await service.sendReminder(seedData.payment2Id);

      const params = mockSendReminder.mock.calls[0][0];
      // Deve ter gerado novo PIX via AbacatePayService mock
      expect(params.pixBrCode).toBe('br-code-test');
      expect(params.pixQrCodeBase64).toBe('base64-test');
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
