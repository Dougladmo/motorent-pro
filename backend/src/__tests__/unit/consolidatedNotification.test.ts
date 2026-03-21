const mockEmailsSend = jest.fn().mockResolvedValue({ data: { id: 'email-123' } });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend }
  }))
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import { NotificationService } from '../../services/notificationService';

const FAKE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'MotoRent Pro <noreply@test.com>';
  delete process.env.EVOLUTION_API_URL;
  delete process.env.EVOLUTION_API_KEY;
  delete process.env.EVOLUTION_INSTANCE;
});

describe('NotificationService - Cobrança Consolidada', () => {
  describe('sendConsolidatedReminder - email', () => {
    it('envia email com N seções PIX e N QR codes', async () => {
      const service = new NotificationService();

      await service.sendConsolidatedReminder({
        subscriberName: 'Douglas',
        subscriberPhone: '11999999999',
        subscriberEmail: 'douglas@test.com',
        totalOverdue: 500,
        payments: [
          { amount: 250, dueDate: '2026-03-18', pixBrCode: 'pix-1', pixQrCodeBase64: FAKE_BASE64 },
          { amount: 250, dueDate: '2026-03-25', pixBrCode: 'pix-2', pixQrCodeBase64: FAKE_BASE64 }
        ]
      });

      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      const call = mockEmailsSend.mock.calls[0][0];

      // Subject deve mencionar quantidade e total
      expect(call.subject).toContain('2 cobranças atrasadas');
      expect(call.subject).toContain('500.00');

      // HTML deve conter seções para cada cobrança
      expect(call.html).toContain('Cobrança 1');
      expect(call.html).toContain('Cobrança 2');
      expect(call.html).toContain('R$ 250.00');

      // Deve ter 2 QR code attachments com CIDs separados
      expect(call.attachments).toHaveLength(2);
      expect(call.attachments[0].contentId).toBe('qr-code-0');
      expect(call.attachments[1].contentId).toBe('qr-code-1');
      expect(call.attachments[0].filename).toBe('qrcode-0.png');
      expect(call.attachments[1].filename).toBe('qrcode-1.png');

      // HTML deve referenciar ambos CIDs
      expect(call.html).toContain('cid:qr-code-0');
      expect(call.html).toContain('cid:qr-code-1');

      // Ambos PIX codes devem estar no HTML
      expect(call.html).toContain('pix-1');
      expect(call.html).toContain('pix-2');
    });

    it('envia email com 3 cobranças atrasadas', async () => {
      const service = new NotificationService();

      await service.sendConsolidatedReminder({
        subscriberName: 'Douglas',
        subscriberPhone: '11999999999',
        subscriberEmail: 'douglas@test.com',
        totalOverdue: 750,
        payments: [
          { amount: 250, dueDate: '2026-03-11', pixBrCode: 'pix-1', pixQrCodeBase64: FAKE_BASE64 },
          { amount: 250, dueDate: '2026-03-18', pixBrCode: 'pix-2', pixQrCodeBase64: FAKE_BASE64 },
          { amount: 250, dueDate: '2026-03-25', pixBrCode: 'pix-3', pixQrCodeBase64: FAKE_BASE64 }
        ]
      });

      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.subject).toContain('3 cobranças atrasadas');
      expect(call.attachments).toHaveLength(3);
      expect(call.html).toContain('Cobrança 3');
      expect(call.html).toContain('pix-3');
    });

    it('singular quando tem apenas 1 cobrança', async () => {
      const service = new NotificationService();

      await service.sendConsolidatedReminder({
        subscriberName: 'Douglas',
        subscriberPhone: '11999999999',
        subscriberEmail: 'douglas@test.com',
        totalOverdue: 250,
        payments: [
          { amount: 250, dueDate: '2026-03-18', pixBrCode: 'pix-1', pixQrCodeBase64: FAKE_BASE64 }
        ]
      });

      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.subject).toContain('1 cobrança atrasada');
    });

    it('envia email sem QR quando pixBrCode não disponível', async () => {
      const service = new NotificationService();

      await service.sendConsolidatedReminder({
        subscriberName: 'Douglas',
        subscriberPhone: '11999999999',
        subscriberEmail: 'douglas@test.com',
        totalOverdue: 500,
        payments: [
          { amount: 250, dueDate: '2026-03-18' },
          { amount: 250, dueDate: '2026-03-25' }
        ]
      });

      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.attachments).toBeUndefined();
      expect(call.html).toContain('Aguardando geração do PIX');
    });

    it('não envia email quando subscriberEmail é null', async () => {
      const service = new NotificationService();

      await service.sendConsolidatedReminder({
        subscriberName: 'Douglas',
        subscriberPhone: '11999999999',
        subscriberEmail: null,
        totalOverdue: 500,
        payments: [
          { amount: 250, dueDate: '2026-03-18', pixBrCode: 'pix-1' }
        ]
      });

      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it('mostra total em atraso no corpo do email', async () => {
      const service = new NotificationService();

      await service.sendConsolidatedReminder({
        subscriberName: 'Douglas',
        subscriberPhone: '11999999999',
        subscriberEmail: 'douglas@test.com',
        totalOverdue: 750,
        payments: [
          { amount: 250, dueDate: '2026-03-11', pixBrCode: 'pix-1', pixQrCodeBase64: FAKE_BASE64 },
          { amount: 250, dueDate: '2026-03-18', pixBrCode: 'pix-2', pixQrCodeBase64: FAKE_BASE64 },
          { amount: 250, dueDate: '2026-03-25', pixBrCode: 'pix-3', pixQrCodeBase64: FAKE_BASE64 }
        ]
      });

      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.html).toContain('750.00');
      expect(call.html).toContain('Total em atraso');
    });
  });

  describe('sendConsolidatedReminder - WhatsApp', () => {
    it('envia mensagens WPP quando Evolution API configurada', async () => {
      process.env.EVOLUTION_API_URL = 'https://evolution.test';
      process.env.EVOLUTION_API_KEY = 'test-key';
      process.env.EVOLUTION_INSTANCE = 'test-instance';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ key: { id: 'msg-123' } })
      });

      const service = new NotificationService();

      await service.sendConsolidatedReminder({
        subscriberName: 'Douglas',
        subscriberPhone: '11999999999',
        subscriberEmail: null,
        totalOverdue: 500,
        payments: [
          { amount: 250, dueDate: '2026-03-18', pixBrCode: 'pix-code-1' },
          { amount: 250, dueDate: '2026-03-25', pixBrCode: 'pix-code-2' }
        ]
      });

      // 1 intro + 2 PIX messages = 3 total
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verificar intro
      const introBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(introBody.text).toContain('2 pagamentos atrasados');
      expect(introBody.text).toContain('500.00');

      // Verificar PIX messages
      const pix1Body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(pix1Body.text).toContain('pix-code-1');
      expect(pix1Body.text).toContain('Cobrança 1');

      const pix2Body = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(pix2Body.text).toContain('pix-code-2');
      expect(pix2Body.text).toContain('Cobrança 2');
    });

    it('não envia WPP quando Evolution API não configurada', async () => {
      const service = new NotificationService();

      await service.sendConsolidatedReminder({
        subscriberName: 'Douglas',
        subscriberPhone: '11999999999',
        subscriberEmail: 'douglas@test.com',
        totalOverdue: 500,
        payments: [
          { amount: 250, dueDate: '2026-03-18', pixBrCode: 'pix-1', pixQrCodeBase64: FAKE_BASE64 }
        ]
      });

      // fetch só deve ser chamado se WPP estivesse configurado (não está)
      // email send é via resend SDK (não fetch)
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
