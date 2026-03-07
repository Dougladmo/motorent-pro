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
}

export class AbacatePayService {
  private readonly baseUrl = 'https://api.abacatepay.com/v1';
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.ABACATE_PAY_API_KEY || '';
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

    const body = {
      amount: Math.round(params.amount * 100), // reais → centavos
      expiresIn: params.expiresIn ?? 604800,
      description: params.description,
      customer: {
        name: params.customer.name,
        cellphone: params.customer.cellphone,
        ...(params.customer.email ? { email: params.customer.email } : {}),
        taxId: params.customer.taxId
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

      const json = await response.json();
      const data = json.data;

      if (!data || !data.id || !data.brCode) {
        console.error('[AbacatePay] Resposta inesperada da API:', JSON.stringify(json));
        return null;
      }

      console.log(`[AbacatePay] QR Code PIX criado: ${data.id}${data.devMode ? ' (devMode)' : ''}`);

      return {
        abacatePixId: data.id,
        pixBrCode: data.brCode,
        pixQrCodeBase64: data.brCodeBase64 || '',
        pixExpiresAt: data.expiresAt
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
