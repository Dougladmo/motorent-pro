interface CreatePixQrCodeParams {
  amount: number; // em reais (será convertido para centavos)
  description: string;
  expiresIn?: number; // segundos (default: 604800 = 7 dias)
  customer: {
    name: string;
    cellphone: string;
    email?: string | null;
    taxId: string; // CPF
  };
  metadata: {
    paymentId: string;
    rentalId: string;
    subscriberId: string;
  };
}

export interface PixQrCodeResult {
  abacatePixId: string;
  pixBrCode: string;
  pixQrCodeBase64: string;
  pixExpiresAt: string;
  pixPaymentUrl: string;
}

export class AbacatePayService {
  private readonly baseUrl = 'https://api.abacatepay.com/v1';
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.ABACATE_PAY_API_KEY || '';
  }

  async cancelPixQrCode(pixId: string): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.baseUrl}/pixQrCode/${pixId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10_000)
      });
      if (!res.ok) {
        console.warn(`[AbacatePay] Falha ao cancelar PIX ${pixId}: ${res.status}`);
        return false;
      }
      console.log(`[AbacatePay] PIX ${pixId} cancelado`);
      return true;
    } catch (err) {
      console.error(`[AbacatePay] Erro ao cancelar PIX ${pixId}:`, err);
      return false;
    }
  }

  async createPixQrCode(params: CreatePixQrCodeParams): Promise<PixQrCodeResult | null> {
    if (!this.apiKey) {
      console.warn('[AbacatePay] ABACATE_PAY_API_KEY não configurada, pulando geração de QR Code');
      return null;
    }

    if (!params.customer.taxId) {
      console.warn('[AbacatePay] CPF do assinante não informado, pulando geração de QR Code');
      return null;
    }

    const sanitizedTaxId = params.customer.taxId.replace(/\D/g, '');

    const body = {
      amount: Math.round(params.amount * 100), // reais → centavos
      expiresIn: params.expiresIn ?? 604800,
      description: params.description,
      customer: {
        name: params.customer.name,
        cellphone: params.customer.cellphone,
        email: params.customer.email || `cpf.${sanitizedTaxId}@sem-email.motorentpro.com`,
        taxId: sanitizedTaxId
      },
      metadata: params.metadata
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${this.baseUrl}/pixQrCode/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[AbacatePay] Erro ao criar QR Code PIX: ${response.status} ${errorBody}`);
        return null;
      }

      const json = await response.json() as { data?: { id?: string; brCode?: string; brCodeBase64?: string; expiresAt?: string; devMode?: boolean } };
      const data = json.data;

      if (!data || !data.id || !data.brCode) {
        console.error('[AbacatePay] Resposta inesperada da API:', JSON.stringify(json));
        return null;
      }

      console.log(`[AbacatePay] QR Code PIX criado: ${data.id}${data.devMode ? ' (devMode)' : ''}`);

      return {
        abacatePixId: data.id!,
        pixBrCode: data.brCode!,
        pixQrCodeBase64: data.brCodeBase64 || '',
        pixExpiresAt: data.expiresAt ?? '',
        pixPaymentUrl: '' // Abacate Pay não retorna URL de pagamento neste endpoint
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        console.error('[AbacatePay] Timeout ao criar QR Code PIX (10s)');
      } else {
        console.error('[AbacatePay] Falha ao criar QR Code PIX:', err);
      }
      return null;
    }
  }
}
