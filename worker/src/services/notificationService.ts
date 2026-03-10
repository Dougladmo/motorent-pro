import { Resend } from 'resend';

function formatBrDate(dateStr: string): { dateBr: string; weekDay: string } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekDays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  return {
    weekDay: weekDays[date.getDay()],
    dateBr: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  };
}

interface NotificationParams {
  subscriberName: string;
  subscriberPhone: string;
  subscriberEmail?: string | null;
  paymentAmount: number;
  paymentDueDate: string;
  totalDebt: number;
  pixBrCode?: string;
  pixQrCodeUrl?: string;
  pixPaymentUrl?: string;
}

export class NotificationService {
  private resend: Resend;
  private appName: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.appName = process.env.APP_NAME || 'MotoRent Pro';
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
    if (!evolutionUrl || !evolutionKey || !evolutionInstance) {
      console.warn('[NotificationService] Evolution API não configurada, pulando WPP');
      return;
    }

    // Garantir prefixo 55 (Brasil) sem duplicar
    const phone = params.subscriberPhone.replace(/\D/g, '');
    const phoneE164 = phone.startsWith('55') ? phone : `55${phone}`;

    console.log(`[WPP] Enviando para ${params.subscriberName} | fone original: ${params.subscriberPhone} → enviando: ${phoneE164} | instância: ${evolutionInstance}`);

    const { dateBr, weekDay } = formatBrDate(params.paymentDueDate);

    const intro = [
      `🏍️ *${this.appName}*`,
      ``,
      `Olá *${params.subscriberName}*! Você tem uma cobrança pendente.`,
      ``,
      `💰 *Valor:* R$ ${params.paymentAmount.toFixed(2)}`,
      `📅 *Vencimento:* ${weekDay}, ${dateBr}`,
      `📊 *Dívida total:* R$ ${params.totalDebt.toFixed(2)}`,
      ``,
      `Para pagar, copie o código PIX abaixo 👇`
    ].join('\n');

    const messages = [
      { text: intro, delay: 0 },
      { text: params.pixBrCode ?? 'Aguardando geração do PIX.', delay: 1500 }
    ];

    let wppOk = 0;
    let wppFail = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const label = `msg[${i + 1}] texto`;

      try {
        const endpoint = `${evolutionUrl}/message/sendText/${evolutionInstance}`;
        const body = { number: phoneE164, text: msg.text, delay: msg.delay };

        console.log(`[WPP] → ${label} | endpoint: ${endpoint}`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          const respJson = await response.json().catch(() => ({}));
          console.log(`[WPP] ✓ ${label} enviado | status: ${response.status} | key: ${(respJson as { key?: { id?: string } }).key?.id ?? 'n/a'}`);
          wppOk++;
        } else {
          const respBody = await response.text();
          console.error(`[WPP] ✗ ${label} falhou | status: ${response.status} | body: ${respBody}`);
          wppFail++;
        }
      } catch (err) {
        console.error(`[WPP] ✗ ${label} exceção:`, err);
        wppFail++;
      }
    }

    console.log(`[WPP] Concluído para ${params.subscriberName} | ✓ ${wppOk} ok | ✗ ${wppFail} falhas`);
  }

  private async sendEmail(params: NotificationParams, tipo: string): Promise<void> {
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!fromEmail) {
      console.warn('[NotificationService] RESEND_FROM_EMAIL não configurado, pulando email');
      return;
    }

    const { dateBr, weekDay } = formatBrDate(params.paymentDueDate);
    const subject = `Cobrança ${this.appName} - R$ ${params.paymentAmount.toFixed(2)} - Vence ${dateBr}`;

    const pixSection = params.pixBrCode
      ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 12px 0; font-weight: bold; color: #1d4ed8;">Pague via PIX:</p>
          ${params.pixQrCodeUrl ? `<img src="${params.pixQrCodeUrl}" alt="QR Code PIX" style="display: block; width: 200px; height: 200px; margin: 0 auto 16px auto;" />` : ''}
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #64748b;">Código PIX copia-e-cola:</p>
          <p style="margin: 0; font-size: 13px; color: #1e293b; font-family: monospace; word-break: break-all; background: #f1f5f9; padding: 8px; border-radius: 4px;">${params.pixBrCode}</p>
        </div>`
      : ``;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1e293b;">${this.appName} — ${tipo === 'lembrete' ? 'Lembrete de Pagamento' : 'Nova Cobrança'}</h2>
        <p>Olá <strong>${params.subscriberName}</strong>,</p>
        <p>${tipo === 'lembrete' ? 'Lembramos que você possui uma cobrança pendente.' : 'Uma nova cobrança foi gerada para você.'}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Valor</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">R$ ${params.paymentAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Vencimento</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${weekDay}, ${dateBr}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Dívida total</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">R$ ${params.totalDebt.toFixed(2)}</td>
          </tr>
        </table>
        ${pixSection}
        <p style="color: #64748b; font-size: 14px;">O pagamento será confirmado automaticamente.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">${this.appName}</p>
      </div>
    `;

    console.log(`[EMAIL] Enviando para ${params.subscriberEmail} | assunto: "${subject}" | de: ${fromEmail} | qrcode: ${params.pixQrCodeUrl ? 'sim (url)' : 'não'}`);

    try {
      const result = await this.resend.emails.send({
        from: fromEmail,
        to: [params.subscriberEmail!],
        subject,
        html
      });
      console.log(`[EMAIL] ✓ Enviado para ${params.subscriberEmail} | id: ${result.data?.id ?? 'n/a'}`);
    } catch (err) {
      console.error(`[EMAIL] ✗ Falha ao enviar para ${params.subscriberEmail}:`, err);
    }
  }
}
