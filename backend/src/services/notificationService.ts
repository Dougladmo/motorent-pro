import { Resend } from 'resend';

interface NotificationParams {
  subscriberName: string;
  subscriberPhone: string;
  subscriberEmail?: string | null;
  paymentAmount: number;
  paymentDueDate: string;
  totalDebt: number;
  pixBrCode?: string;
  pixQrCodeBase64?: string;
  pixPaymentUrl?: string;
}

export class NotificationService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendPaymentNotification(params: NotificationParams): Promise<void> {
    await this.sendWhatsApp(params);
    if (params.subscriberEmail) {
      await this.sendEmail(params, 'nova cobrança');
    } else {
      console.log(`[NotificationService] Assinante ${params.subscriberName} sem email, enviando apenas WPP`);
    }
  }

  async sendReminder(params: NotificationParams): Promise<void> {
    await this.sendWhatsApp(params);
    if (params.subscriberEmail) {
      await this.sendEmail(params, 'lembrete');
    } else {
      console.log(`[NotificationService] Assinante ${params.subscriberName} sem email, enviando apenas WPP`);
    }
  }

  private async sendWhatsApp(params: NotificationParams): Promise<void> {
    const evolutionUrl = process.env.EVOLUTION_API_URL;
    const evolutionKey = process.env.EVOLUTION_API_KEY;
    const evolutionInstance = process.env.EVOLUTION_INSTANCE;
    const pixKey = process.env.PIX_KEY;

    if (!evolutionUrl || !evolutionKey || !evolutionInstance) {
      console.warn('[NotificationService] Evolution API não configurada, pulando WPP');
      return;
    }

    let pixPaymentText: string;
    if (params.pixBrCode) {
      const parts = [`Para pagar, use o PIX copia-e-cola abaixo:\n\n${params.pixBrCode}`];
      if (params.pixPaymentUrl) {
        parts.push(`\nOu acesse o link de pagamento:\n${params.pixPaymentUrl}`);
      }
      parts.push('\nApós o pagamento, envie o comprovante.');
      pixPaymentText = parts.join('');
    } else {
      pixPaymentText = `Para pagar, use a chave PIX:\n${pixKey}\n\nApós o pagamento, envie o comprovante.`;
    }

    const messages: Array<{ text?: string; imageBase64?: string; caption?: string; delay: number }> = [
      {
        text: `Olá ${params.subscriberName}! Você tem uma cobrança no MotoRent Pro.`,
        delay: 0
      },
      {
        text: `Valor: R$ ${params.paymentAmount.toFixed(2)} | Vencimento: ${params.paymentDueDate}\nDívida total: R$ ${params.totalDebt.toFixed(2)}`,
        delay: 1500
      },
      {
        text: pixPaymentText,
        delay: 3000
      }
    ];

    // Se tem QR Code, enviar como imagem
    if (params.pixQrCodeBase64) {
      messages.push({
        imageBase64: params.pixQrCodeBase64,
        caption: 'QR Code PIX para pagamento',
        delay: 4500
      });
    }

    for (const msg of messages) {
      try {
        const isImage = !!msg.imageBase64;
        const endpoint = isImage
          ? `${evolutionUrl}/message/sendMedia/${evolutionInstance}`
          : `${evolutionUrl}/message/sendText/${evolutionInstance}`;

        const body = isImage
          ? {
              number: params.subscriberPhone,
              mediatype: 'image',
              media: msg.imageBase64,
              caption: msg.caption,
              delay: msg.delay
            }
          : {
              number: params.subscriberPhone,
              text: msg.text,
              delay: msg.delay
            };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: evolutionKey
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const respBody = await response.text();
          console.error(`[NotificationService] Erro WPP msg (delay ${msg.delay}): ${response.status} ${respBody}`);
        }
      } catch (err) {
        console.error(`[NotificationService] Falha ao enviar WPP para ${params.subscriberPhone}:`, err);
      }
    }

    console.log(`[NotificationService] WPP enviado para ${params.subscriberName} (${params.subscriberPhone})`);
  }

  private async sendEmail(params: NotificationParams, tipo: string): Promise<void> {
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!fromEmail) {
      console.warn('[NotificationService] RESEND_FROM_EMAIL não configurado, pulando email');
      return;
    }

    const subject = `Cobrança MotoRent Pro - R$ ${params.paymentAmount.toFixed(2)} - Vence ${params.paymentDueDate}`;
    const pixKey = process.env.PIX_KEY || '';

    const pixSection = params.pixBrCode
      ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 12px 0; font-weight: bold; color: #1d4ed8;">Pague via PIX:</p>
          ${params.pixQrCodeBase64 ? `<img src="${params.pixQrCodeBase64}" alt="QR Code PIX" style="display: block; width: 200px; height: 200px; margin: 0 auto 16px auto;" />` : ''}
          ${params.pixPaymentUrl ? `<div style="text-align: center; margin-bottom: 16px;"><a href="${params.pixPaymentUrl}" style="display: inline-block; background: #1d4ed8; color: #fff; font-weight: bold; font-size: 15px; padding: 10px 24px; border-radius: 6px; text-decoration: none;">Pagar agora</a></div>` : ''}
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #64748b;">Código PIX copia-e-cola:</p>
          <p style="margin: 0; font-size: 13px; color: #1e293b; font-family: monospace; word-break: break-all; background: #f1f5f9; padding: 8px; border-radius: 4px;">${params.pixBrCode}</p>
        </div>`
      : `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0; font-weight: bold; color: #1d4ed8;">Chave PIX para pagamento:</p>
          <p style="margin: 0; font-size: 18px; color: #1e293b; font-family: monospace;">${pixKey}</p>
        </div>`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1e293b;">MotoRent Pro — ${tipo === 'lembrete' ? 'Lembrete de Pagamento' : 'Nova Cobrança'}</h2>
        <p>Olá <strong>${params.subscriberName}</strong>,</p>
        <p>${tipo === 'lembrete' ? 'Lembramos que você possui uma cobrança pendente.' : 'Uma nova cobrança foi gerada para você.'}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Valor</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">R$ ${params.paymentAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Vencimento</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${params.paymentDueDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Dívida total</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">R$ ${params.totalDebt.toFixed(2)}</td>
          </tr>
        </table>
        ${pixSection}
        <p style="color: #64748b; font-size: 14px;">Após o pagamento, envie o comprovante para confirmar.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">MotoRent Pro — Sistema de Gestão de Motos</p>
      </div>
    `;

    try {
      await this.resend.emails.send({
        from: fromEmail,
        to: [params.subscriberEmail!],
        subject,
        html
      });
      console.log(`[NotificationService] Email enviado para ${params.subscriberEmail}`);
    } catch (err) {
      console.error(`[NotificationService] Falha ao enviar email para ${params.subscriberEmail}:`, err);
    }
  }
}
