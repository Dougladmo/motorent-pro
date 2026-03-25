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

  // Reset NODE_ENV to test (não production) para os testes normais
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  delete process.env.ABACATE_PAY_WEBHOOK_SECRET;
});

// Helper: build billing.paid payload (AbacatePay real format)
function billingPaidPayload(paymentId: string, amountCents: number, pixId = 'pix_char_TEST123') {
  return {
    event: 'billing.paid',
    devMode: false,
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
  describe('autenticacao', () => {
    it('rejeita requisicao sem webhookSecret', async () => {
      const req = makeReq({ body: { event: 'billing.paid' }, query: {} });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('rejeita requisicao com webhookSecret incorreto', async () => {
      const req = makeReq({ body: { event: 'billing.paid' }, query: { webhookSecret: 'wrong-secret' } });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('aceita requisicao com webhookSecret correto', async () => {
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

    it('e idempotente: ignora evento duplicado para pagamento ja Pago', async () => {
      // payment1Id ja esta Pago no seed
      const req = makeReq({
        body: billingPaidPayload(seedData.payment1Id, 300_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      // Deve continuar Pago sem lancar erro
      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment1Id) as { status: string };
      expect(payment.status).toBe('Pago');
    });

    it('ignora evento sem paymentId no metadata', async () => {
      const req = makeReq({
        body: {
          event: 'billing.paid',
          devMode: false,
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

      // Nao deve lancar excecao
      await expect(handleAbacateWebhook(req, res as never)).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // SEGURANCA: Testes criticos para prevenir marcacao falsa como Pago
  // Bug corrigido: webhook aceitava pixData.amount como fallback quando
  // data.payment.amount estava ausente, permitindo marcar como pago sem
  // confirmacao real do gateway.
  // =========================================================================
  describe('billing.paid - SEGURANCA: rejeitar payload sem data.payment.amount', () => {
    it('REJEITA billing.paid quando data.payment esta ausente (campo obrigatorio)', async () => {
      const req = makeReq({
        body: {
          event: 'billing.paid',
          devMode: false,
          data: {
            // SEM data.payment — apenas pixQrCode com amount (valor solicitado, NAO pago)
            pixQrCode: {
              id: 'pix_char_FAKE',
              amount: 300_00,
              kind: 'PIX',
              status: 'PAID',
              metadata: { paymentId: seedData.payment2Id }
            }
          }
        },
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      // Pagamento DEVE permanecer Pendente — NAO pode virar Pago
      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
    });

    it('REJEITA billing.paid quando data.payment.amount e undefined', async () => {
      const req = makeReq({
        body: {
          event: 'billing.paid',
          devMode: false,
          data: {
            payment: { fee: 80, method: 'PIX' }, // amount ausente/undefined
            pixQrCode: {
              id: 'pix_char_NOVAL',
              amount: 300_00,
              metadata: { paymentId: seedData.payment2Id }
            }
          }
        },
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
    });

    it('REJEITA billing.paid quando data.payment.amount e null', async () => {
      const req = makeReq({
        body: {
          event: 'billing.paid',
          devMode: false,
          data: {
            payment: { amount: null, fee: 80, method: 'PIX' },
            pixQrCode: {
              id: 'pix_char_NULL',
              amount: 300_00,
              metadata: { paymentId: seedData.payment2Id }
            }
          }
        },
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
    });

    it('REJEITA billing.paid quando data.payment.amount e zero', async () => {
      const req = makeReq({
        body: {
          event: 'billing.paid',
          devMode: false,
          data: {
            payment: { amount: 0, fee: 0, method: 'PIX' },
            pixQrCode: {
              id: 'pix_char_ZERO',
              amount: 300_00,
              metadata: { paymentId: seedData.payment2Id }
            }
          }
        },
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
    });

    it('REJEITA billing.paid quando data.payment.amount e negativo', async () => {
      const req = makeReq({
        body: {
          event: 'billing.paid',
          devMode: false,
          data: {
            payment: { amount: -300_00, fee: 0, method: 'PIX' },
            pixQrCode: {
              id: 'pix_char_NEG',
              amount: 300_00,
              metadata: { paymentId: seedData.payment2Id }
            }
          }
        },
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
    });

    it('REJEITA billing.paid quando data.payment.amount e string (tipo invalido)', async () => {
      const req = makeReq({
        body: {
          event: 'billing.paid',
          devMode: false,
          data: {
            payment: { amount: '30000' as unknown, fee: 80, method: 'PIX' },
            pixQrCode: {
              id: 'pix_char_STR',
              amount: 300_00,
              metadata: { paymentId: seedData.payment2Id }
            }
          }
        },
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
    });

    it('REJEITA formato legado pix.paid sem data.payment (apenas data no nivel raiz)', async () => {
      const req = makeReq({
        body: {
          event: 'pix.paid',
          devMode: false,
          data: {
            // Formato legado: campos diretamente em data, sem data.payment
            id: 'pix_LEGACY',
            amount: 300_00,
            status: 'PAID',
            metadata: { paymentId: seedData.payment2Id }
          }
        },
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
    });
  });

  describe('billing.paid - SEGURANCA: validacao de PIX ID (cross-reference)', () => {
    it('REJEITA quando pixId do webhook nao bate com abacate_pix_id do pagamento', async () => {
      // Configurar pagamento com um abacate_pix_id especifico
      db.prepare('UPDATE payments SET abacate_pix_id = ? WHERE id = ?')
        .run('pix_char_ORIGINAL', seedData.payment2Id);

      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 300_00, 'pix_char_DIFERENTE'),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');
    });

    it('ACEITA quando pixId do webhook bate com abacate_pix_id do pagamento', async () => {
      const pixId = 'pix_char_MATCH';
      db.prepare('UPDATE payments SET abacate_pix_id = ? WHERE id = ?')
        .run(pixId, seedData.payment2Id);

      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 300_00, pixId),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pago');
    });

    it('ACEITA quando pagamento nao tem abacate_pix_id (PIX novo/regenerado)', async () => {
      // Pagamento sem abacate_pix_id (null) — aceita qualquer pixId
      db.prepare('UPDATE payments SET abacate_pix_id = NULL WHERE id = ?')
        .run(seedData.payment2Id);

      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 300_00, 'pix_char_QUALQUER'),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pago');
    });
  });

  describe('billing.paid - SEGURANCA: rejeitar devMode em producao', () => {
    it('REJEITA evento devMode=true quando NODE_ENV=production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const payload = billingPaidPayload(seedData.payment2Id, 300_00);
      payload.devMode = true;

      const req = makeReq({
        body: payload,
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');

      process.env.NODE_ENV = originalEnv;
    });

    it('ACEITA evento devMode=true quando NODE_ENV != production (ambiente de teste)', async () => {
      process.env.NODE_ENV = 'test';

      const payload = billingPaidPayload(seedData.payment2Id, 300_00);
      payload.devMode = true;

      const req = makeReq({
        body: payload,
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pago');
    });

    it('ACEITA evento devMode=false em producao normalmente', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 300_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pago');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('billing.paid - pagamento parcial (prevencao de golpe)', () => {
    it('NAO marca como Pago quando valor pago e menor que o esperado', async () => {
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

    it('NAO marca como Pago quando valor pago e maior que o esperado', async () => {
      // Protecao contra overpay que poderia ser fraude
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

    it('cenario: deve R$ 750, paga R$ 250 num PIX antigo -> deve R$ 500', async () => {
      // Configurar outstanding_balance = 750
      db.prepare('UPDATE rentals SET outstanding_balance = 750, total_paid = 0 WHERE id = ?')
        .run(seedData.rental1Id);

      // Pagamento parcial de R$ 250 num pagamento de R$ 300 (valor diferente -> parcial)
      const req = makeReq({
        body: billingPaidPayload(seedData.payment2Id, 250_00),
        query: { webhookSecret: WEBHOOK_SECRET }
      });
      const res = makeRes();

      await handleAbacateWebhook(req, res as never);

      // Status da cobranca permanece inalterado
      const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string };
      expect(payment.status).toBe('Pendente');

      // Saldo devedor reduz de 750 para 500
      const rental = db.prepare('SELECT outstanding_balance FROM rentals WHERE id = ?').get(seedData.rental1Id) as {
        outstanding_balance: number;
      };
      expect(rental.outstanding_balance).toBe(500);
    });

    it('nao permite outstanding_balance ficar negativo em pagamento parcial excessivo', async () => {
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
