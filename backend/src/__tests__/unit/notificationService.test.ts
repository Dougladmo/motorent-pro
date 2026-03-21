const mockEmailsSend = jest.fn().mockResolvedValue({ data: { id: 'email-123' } });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend }
  }))
}));

// Mock global fetch for QR code URL fetching
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import { NotificationService } from '../../services/notificationService';

const BASE_PARAMS = {
  subscriberName: 'João Silva',
  subscriberPhone: '11999999999',
  subscriberEmail: 'joao@test.com',
  paymentAmount: 250,
  paymentDueDate: '2026-03-25',
  totalDebt: 500
};

// PNG 1x1 pixel em base64
const FAKE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const FAKE_BUFFER = Buffer.from(FAKE_BASE64, 'base64');

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'MotoRent Pro <noreply@test.com>';
  // Desabilitar WPP nos testes
  delete process.env.EVOLUTION_API_URL;
  delete process.env.EVOLUTION_API_KEY;
  delete process.env.EVOLUTION_INSTANCE;
});

describe('NotificationService - QR Code no email', () => {
  describe('resolveQrCodeBuffer - prioridade de fallbacks', () => {
    it('usa pixQrCodeBase64 quando disponível (prioridade 1)', async () => {
      const service = new NotificationService();

      await service.sendReminder({
        ...BASE_PARAMS,
        pixBrCode: 'pix-code-123',
        pixQrCodeBase64: FAKE_BASE64,
        pixQrCodeUrl: 'https://storage.example.com/qr.png'
      });

      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      const call = mockEmailsSend.mock.calls[0][0];

      // Deve ter attachment com CID
      expect(call.attachments).toBeDefined();
      expect(call.attachments).toHaveLength(1);
      expect(call.attachments[0].contentId).toBe('qr-code');
      expect(call.attachments[0].filename).toBe('qrcode.png');
      expect(call.attachments[0].contentType).toBe('image/png');
      expect(Buffer.isBuffer(call.attachments[0].content)).toBe(true);

      // HTML deve usar cid:qr-code
      expect(call.html).toContain('src="cid:qr-code"');

      // Não deve ter feito fetch (base64 é prioridade)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('usa pixQrCodeBase64 com prefixo data: (strip automático)', async () => {
      const service = new NotificationService();

      await service.sendReminder({
        ...BASE_PARAMS,
        pixBrCode: 'pix-code-123',
        pixQrCodeBase64: `data:image/png;base64,${FAKE_BASE64}`
      });

      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.attachments).toHaveLength(1);
      expect(Buffer.isBuffer(call.attachments[0].content)).toBe(true);
    });

    it('faz fetch da pixQrCodeUrl quando base64 não disponível (prioridade 2)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(FAKE_BUFFER.buffer.slice(FAKE_BUFFER.byteOffset, FAKE_BUFFER.byteOffset + FAKE_BUFFER.byteLength))
      });

      const service = new NotificationService();

      await service.sendReminder({
        ...BASE_PARAMS,
        pixBrCode: 'pix-code-123',
        pixQrCodeUrl: 'https://storage.supabase.co/qr-codes/qrcode_123.png'
      });

      expect(mockFetch).toHaveBeenCalledWith('https://storage.supabase.co/qr-codes/qrcode_123.png');
      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.attachments).toHaveLength(1);
      expect(call.attachments[0].contentId).toBe('qr-code');
    });

    it('gera QR via qrserver.com quando base64 e URL não disponíveis (prioridade 3 - fallback)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(FAKE_BUFFER.buffer.slice(FAKE_BUFFER.byteOffset, FAKE_BUFFER.byteOffset + FAKE_BUFFER.byteLength))
      });

      const service = new NotificationService();
      const brCode = '00020101021126580014BR.GOV.BCB.PIX';

      await service.sendReminder({
        ...BASE_PARAMS,
        pixBrCode: brCode
        // SEM pixQrCodeBase64, SEM pixQrCodeUrl
      });

      // Deve ter chamado qrserver.com com o brCode
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchedUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchedUrl).toContain('api.qrserver.com');
      expect(fetchedUrl).toContain(encodeURIComponent(brCode));

      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.attachments).toHaveLength(1);
      expect(call.attachments[0].contentId).toBe('qr-code');
    });

    it('envia email sem QR quando todos os fallbacks falham', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const service = new NotificationService();

      await service.sendReminder({
        ...BASE_PARAMS,
        pixBrCode: 'pix-code-123'
        // SEM base64, SEM URL → qrserver vai falhar (mock retorna 500)
      });

      const call = mockEmailsSend.mock.calls[0][0];
      // Deve enviar email mesmo sem QR
      expect(call.attachments).toBeUndefined();
      // HTML não deve ter tag img
      expect(call.html).not.toContain('cid:qr-code');
      // Mas deve ter o código PIX copia-e-cola
      expect(call.html).toContain('pix-code-123');
    });

    it('envia email sem seção PIX quando pixBrCode é undefined', async () => {
      const service = new NotificationService();

      await service.sendReminder({
        ...BASE_PARAMS
        // SEM pixBrCode
      });

      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.attachments).toBeUndefined();
      expect(call.html).not.toContain('Pague via PIX');
      expect(call.html).not.toContain('cid:qr-code');
    });
  });

  describe('CID attachment format', () => {
    it('attachment tem todos os campos obrigatórios para CID inline', async () => {
      const service = new NotificationService();

      await service.sendReminder({
        ...BASE_PARAMS,
        pixBrCode: 'pix-code-123',
        pixQrCodeBase64: FAKE_BASE64
      });

      const attachment = mockEmailsSend.mock.calls[0][0].attachments[0];
      expect(attachment).toEqual({
        filename: 'qrcode.png',
        content: expect.any(Buffer),
        contentId: 'qr-code',
        contentType: 'image/png'
      });
    });

    it('HTML referencia CID corretamente no src da imagem', async () => {
      const service = new NotificationService();

      await service.sendReminder({
        ...BASE_PARAMS,
        pixBrCode: 'pix-code-123',
        pixQrCodeBase64: FAKE_BASE64
      });

      const html = mockEmailsSend.mock.calls[0][0].html as string;
      // Deve usar cid:qr-code, NÃO uma URL externa
      expect(html).toContain('src="cid:qr-code"');
      expect(html).not.toMatch(/src="https?:\/\//);
    });
  });

  describe('fallback URL fetch - cenários de erro', () => {
    it('tenta qrserver quando fetch da URL do Supabase falha', async () => {
      // Primeiro fetch (Supabase URL) falha
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      // Segundo fetch (qrserver.com) sucede
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(FAKE_BUFFER.buffer.slice(FAKE_BUFFER.byteOffset, FAKE_BUFFER.byteOffset + FAKE_BUFFER.byteLength))
      });

      const service = new NotificationService();

      await service.sendReminder({
        ...BASE_PARAMS,
        pixBrCode: 'pix-code-123',
        pixQrCodeUrl: 'https://broken-url.supabase.co/qr.png'
      });

      // Deve ter tentado 2 fetches: Supabase (falhou) + qrserver (sucedeu)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toBe('https://broken-url.supabase.co/qr.png');
      expect((mockFetch.mock.calls[1][0] as string)).toContain('api.qrserver.com');

      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.attachments).toHaveLength(1);
    });

    it('lida com exceção de rede no fetch sem crashar', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const service = new NotificationService();

      await service.sendReminder({
        ...BASE_PARAMS,
        pixBrCode: 'pix-code-123',
        pixQrCodeUrl: 'https://storage.example.com/qr.png'
      });

      // Não deve crashar, email deve ser enviado sem QR
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.attachments).toBeUndefined();
    });
  });

  describe('sendPaymentNotification - mesma lógica de QR', () => {
    it('inclui CID attachment para nova cobrança com base64', async () => {
      const service = new NotificationService();

      await service.sendPaymentNotification({
        ...BASE_PARAMS,
        pixBrCode: 'pix-code-123',
        pixQrCodeBase64: FAKE_BASE64
      });

      const call = mockEmailsSend.mock.calls[0][0];
      expect(call.attachments).toHaveLength(1);
      expect(call.attachments[0].contentId).toBe('qr-code');
      expect(call.html).toContain('Nova Cobrança');
    });
  });
});
