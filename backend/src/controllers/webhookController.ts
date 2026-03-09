import { Request, Response } from 'express';
import { PaymentRepository } from '../repositories/paymentRepository';
import { PaymentService } from '../services/paymentService';
import { RentalRepository } from '../repositories/rentalRepository';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { NotificationService } from '../services/notificationService';

const paymentRepo = new PaymentRepository();
const paymentService = new PaymentService(
  paymentRepo,
  new RentalRepository(),
  new MotorcycleRepository(),
  new SubscriberRepository(),
  new NotificationService()
);

export async function handleAbacateWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.ABACATE_PAY_WEBHOOK_SECRET;

  // Validar secret
  if (!secret || req.query.secret !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Responder imediatamente (Abacate Pay exige resposta rápida)
  res.status(200).json({ received: true });

  // Processar evento de forma assíncrona
  try {
    const { event, data } = req.body as {
      event: string;
      devMode?: boolean;
      data: {
        id: string;
        amount: number;
        status: string;
        metadata?: { paymentId?: string };
      };
    };

    console.log(`[Webhook] Evento recebido: ${event} | PIX ID: ${data?.id}`);

    if (event === 'pix.paid') {
      const paymentId = data?.metadata?.paymentId;
      if (!paymentId) {
        console.warn('[Webhook] pix.paid sem paymentId no metadata, ignorando');
        return;
      }

      // Verificar idempotência
      const payment = await paymentRepo.findById(paymentId);
      if (!payment) {
        console.warn(`[Webhook] Pagamento ${paymentId} não encontrado, ignorando`);
        return;
      }

      if (payment.status === 'Pago') {
        console.log(`[Webhook] Pagamento ${paymentId} já está Pago (idempotência), ignorando`);
        return;
      }

      await paymentService.markAsPaid(paymentId, data.amount / 100);
      console.log(`[Webhook] Pagamento ${paymentId} confirmado via Abacate Pay PIX ${data.id}`);
    }

    if (event === 'pix.expired') {
      const paymentId = data?.metadata?.paymentId;
      if (!paymentId) return;

      // Limpar campos PIX (cron vai recriar QR Code no próximo ciclo)
      await paymentRepo.update(paymentId, {
        abacate_pix_id: null,
        pix_br_code: null,
        pix_qr_code_base64: null,
        pix_expires_at: null
      });
      console.log(`[Webhook] QR Code PIX expirado para pagamento ${paymentId}, campos limpos`);
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar evento Abacate Pay:', err);
  }
}
