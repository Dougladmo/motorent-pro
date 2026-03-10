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

jest.mock('../../services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPaymentNotification: jest.fn().mockResolvedValue(undefined),
    sendReminder: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../../services/abacatePayService', () => ({
  AbacatePayService: jest.fn().mockImplementation(() => ({
    createPixQrCode: jest.fn().mockResolvedValue({
      abacatePixId: 'pix-test-123',
      pixBrCode: 'br-code-test',
      pixQrCodeBase64: 'base64-test',
      pixExpiresAt: '2026-12-31',
      pixPaymentUrl: ''
    })
  }))
}));

import { handleAbacateWebhook } from '../../controllers/webhookController';
import { getDb, resetDb } from '../helpers/sqlite-client';
import { seedDb, SeedData } from '../helpers/seed';

// Minimal mock for Express Request/Response
function makeReq(opts: {
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}): Parameters<typeof handleAbacateWebhook>[0] {
  return { body: opts.body ?? {}, query: opts.query ?? {} } as never;
}

function makeRes(): { status: jest.Mock; json: jest.Mock; _status: number; _body: unknown } {
  const res = {
    _status: 200,
    _body: null as unknown,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
  res.status.mockImplementation((code: number) => {
    res._status = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res._body = body;
    return res;
  });
  return res;
}

const WEBHOOK_SECRET = 'test-webhook-secret-123';

let seedData: SeedData;
let db: ReturnType<typeof getDb>;

beforeAll(() => {
  process.env.ABACATE_PAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

beforeEach(() => {
  resetDb();
  db = getDb();
  seedData = seedDb(db);

  // Set rental outstanding_balance to 500 (simulates 2 unpaid payments)
  db.prepare('UPDATE rentals SET outstanding_balance = 500, total_paid = 0 WHERE id = ?')
    .run(seedData.rental1Id);
});

afterAll(() => {
  delete process.env.ABACATE_PAY_WEBHOOK_SECRET;
});

// Helper: build billing.paid payload (AbacatePay real format)
function billingPaidPayload(paymentId: string, amountCents: number, pixId = 'pix_char_TEST123') {
  return {
    event: 'billing.paid',
    devMode: true,
    id: 'log_test',
    data: {
      payment: { amount: amountCents, fee: 80, method: 'PIX' },
      pixQrCode: {
        id: pixId,
        amount: amountCents,
        kind: 'PIX',
        status: 'PAID',
        metadata: { paymentId }
      }
    }
  };
}

describe('handleAbacateWebhook', () => {
  describe('autenticação', () => {
    it('rejeita requisição sem webhookSecret', async () => {
      const req = makeReq({ body: { event: 'billing.paid' }, query: {} });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('rejeita requisição com webhookSecret incorreto', async () => {
      const req = makeReq({ body: { event: 'billing.paid' }, query: { webhookSecret: 'wrong-secret' } });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('aceita requisição com webhookSecret correto', async () => {
      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 300_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      // deve responder 200 antes de processar
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('billing.paid - pagamento completo', () => {
    it('marca pagamento como Pago quando valor pago == valor esperado', async () => {
      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 300_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(seedData.payment2Id) as {
        status: string;
        pix_payment_url: string | null;
      };
      expect(payment.status).toBe('Pago');
    });

    it('salva URL do comprovante no pix_payment_url', async () => {
      const pixId = 'pix_char_RECEIPT456';
      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 300_00, pixId),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT pix_payment_url FROM payments WHERE id = ?').get(seedData.payment2Id) as {
        pix_payment_url: string | null;
      };
      expect(payment.pix_payment_url).toBe(`https://app.abacatepay.com/receipt/${pixId}`);
    });

    it('é idempotente: ignora evento duplicado para pagamento já Pago', async () => {
      // payment1Id já está Pago no seed
      const req = makeReq({
        body: billingPaidPayload(seedData.payment1Id, 300_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      // Deve continuar Pago sem lançar erro
      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment1Id) as { status: string };
      expect(payment.status).toBe('Pago');
    });

    it('ignora evento sem paymentId no metadata', async () => {
      const req = makeReq({
        body: {
          event: 'billing.paid',
          data: {
            payment: { amount: 300_00 },
            pixQrCode: { id: 'pix_NOMETADATA', amount: 300_00, metadata: {} }
          }
        },
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      // Nenhum pagamento deve ser alterado
      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
    });

    it('ignora evento para paymentId inexistente', async () => {
      const req = makeReq({
        body: billingPaidPayload('id-inexistente-uuid', 300_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      // Não deve lançar exceção
      await expect(handleAbacateWebhook(req, res as never)).resolves.not.toThrow();
    });
  });

  describe('billing.paid - pagamento parcial (prevenção de golpe)', () => {
    it('NÃO marca como Pago quando valor pago é menor que o esperado', async () => {
      // payment2 espera R$ 300,00; pagamento parcial de R$ 150,00
      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 150_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
      expect(payment.status).not.toBe('Pago');
    });

    it('NÃO marca como Pago quando valor pago é maior que o esperado', async () => {
      // Proteção contra overpay que poderia ser fraude
      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 999_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
    });

    it('debita o valor parcial do outstanding_balance do aluguel', async () => {
      // Rental outstanding_balance = 500; pagamento parcial de R$ 150,00
      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 150_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const rental = db.prepare('SELECT outstanding_balance, total_paid FROM rentals WHERE id = ?').get(seedData.rental1Id) as {
        outstanding_balance: number;
        total_paid: number;
      };
      expect(rental.outstanding_balance).toBe(350); // 500 - 150
      expect(rental.total_paid).toBe(150);
    });

    it('cenário: deve R$ 750, paga R$ 250 num PIX antigo → deve R$ 500', async () => {
      // Configurar outstanding_balance = 750
      db.prepare('UPDATE rentals SET outstanding_balance = 750, total_paid = 0 WHERE id = ?')
        .run(seedData.rental1Id);

      // Pagamento parcial de R$ 250 num pagamento de R$ 300 (valor diferente → parcial)
      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 250_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      // Status da cobrança permanece inalterado
      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');

      // Saldo devedor reduz de 750 para 500
      const rental = db.prepare('SELECT outstanding_balance FROM rentals WHERE id = ?').get(seedData.rental1Id) as {
        outstanding_balance: number;
      };
      expect(rental.outstanding_balance).toBe(500);
    });

    it('não permite outstanding_balance ficar negativo em pagamento parcial excessivo', async () => {
      // outstanding_balance = 100, pagamento parcial de R$ 200
      db.prepare('UPDATE rentals SET outstanding_balance = 100, total_paid = 0 WHERE id = ?')
        .run(seedData.rental1Id);

      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 200_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const rental = db.prepare('SELECT outstanding_balance FROM rentals WHERE id = ?').get(seedData.rental1Id) as {
        outstanding_balance: number;
      };
      // Math.max(0, 100 - 200) = 0
      expect(rental.outstanding_balance).toBe(0);
    });
  });

  describe('billing.expired / pix.expired', () => {
    it('limpa campos PIX ao receber billing.expired', async () => {
      // Configurar payment com dados PIX
      db.prepare(`
        UPDATE payments SET abacate_pix_id = 'pix-123', pix_br_code = 'br-code', pix_expires_at = '2026-01-01'
        WHERE id = ?
      `).run(seedData.payment2Id);

      const req = makeReq({
        body: {
          event: 'billing.expired',
          data: {
            pixQrCode: {
              id: 'pix-123',
              amount: 300_00,
              metadata: { paymentId: seedData.payment2Id }
            }
          }
        },
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT abacate_pix_id, pix_br_code, pix_expires_at FROM payments WHERE id = ?')
        .get(seedData.payment2Id) as { abacate_pix_id: string | null; pix_br_code: string | null; pix_expires_at: string | null };

      expect(payment.abacate_pix_id).toBeNull();
      expect(payment.pix_br_code).toBeNull();
      expect(payment.pix_expires_at).toBeNull();
    });

    it('limpa campos PIX ao receber pix.expired (evento legado)', async () => {
      db.prepare(`
        UPDATE payments SET abacate_pix_id = 'pix-old', pix_br_code = 'br-old', pix_expires_at = '2026-01-01'
        WHERE id = ?
      `).run(seedData.payment2Id);

      const req = makeReq({
        body: {
          event: 'pix.expired',
          data: { metadata: { paymentId: seedData.payment2Id } }
        },
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT abacate_pix_id FROM payments WHERE id = ?')
        .get(seedData.payment2Id) as { abacate_pix_id: string | null };
      expect(payment.abacate_pix_id).toBeNull();
    });
  });
});
