import { Request, Response } from 'express';
import { PaymentRepository } from '../repositories/paymentRepository';
import { PaymentService } from '../services/paymentService';
import { RentalRepository } from '../repositories/rentalRepository';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { NotificationService } from '../services/notificationService';

const paymentRepo = new PaymentRepository();
const rentalRepo = new RentalRepository();
const paymentService = new PaymentService(
  paymentRepo,
  rentalRepo,
  new MotorcycleRepository(),
  new SubscriberRepository(),
  new NotificationService()
);

// AbacatePay billing.paid payload
interface BillingPaidData {
  payment?: { amount: number; fee?: number; method?: string };
  pixQrCode?: {
    id: string;
    amount: number;
    kind?: string;
    status?: string;
    metadata?: { paymentId?: string; rentalId?: string; subscriberId?: string };
    pixPaymentUrl?: string;
    receiptUrl?: string;
    e2eId?: string;
  };
  // legacy pix.paid fields (kept for backward compatibility)
  id?: string;
  amount?: number;
  status?: string;
  pixPaymentUrl?: string;
  receiptUrl?: string;
  e2eId?: string;
  metadata?: { paymentId?: string };
}

export async function handleAbacateWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.ABACATE_PAY_WEBHOOK_SECRET;

  // Validar secret
  if (!secret || req.query.webhookSecret !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Responder imediatamente (Abacate Pay exige resposta rápida)
  res.status(200).json({ received: true });

  // Processar evento de forma assíncrona
  try {
    const { event, data } = req.body as { event: string; devMode?: boolean; data: BillingPaidData };

    // Normalizar estrutura entre billing.paid (data.pixQrCode) e pix.paid legado (data diretamente)
    const pixData = data?.pixQrCode ?? data;
    const pixId = pixData?.id;
    const paidAmountCents = data?.payment?.amount ?? pixData?.amount;
    const metadata = data?.pixQrCode?.metadata ?? data?.metadata;

    console.log(`[Webhook] Evento recebido: ${event} | PIX ID: ${pixId}`);

    if (event === 'billing.paid' || event === 'pix.paid') {
      const paymentId = metadata?.paymentId;
      if (!paymentId) {
        console.warn(`[Webhook] ${event} sem paymentId no metadata, ignorando`);
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

      const paidAmountBRL = (paidAmountCents ?? 0) / 100;
      const expectedAmount = payment.amount;

      // Validação de valor: pago deve ser igual ao esperado (tolerância de R$ 0,01)
      if (Math.abs(paidAmountBRL - expectedAmount) > 0.01) {
        console.warn(
          `[Webhook] Pagamento parcial detectado para ${paymentId}: ` +
          `esperado R$ ${expectedAmount}, recebido R$ ${paidAmountBRL}. ` +
          `Debitando do saldo devedor do aluguel sem marcar como pago.`
        );

        // Pagamento parcial: debitar do saldo devedor do aluguel sem marcar a cobrança como Pago
        const rental = await rentalRepo.findById(payment.rental_id);
        if (rental) {
          const newOutstanding = Math.max(0, (rental.outstanding_balance || 0) - paidAmountBRL);
          await rentalRepo.update(payment.rental_id, {
            outstanding_balance: newOutstanding,
            total_paid: (rental.total_paid || 0) + paidAmountBRL
          });
          console.log(
            `[Webhook] Saldo devedor atualizado para aluguel ${payment.rental_id}: ` +
            `R$ ${rental.outstanding_balance} → R$ ${newOutstanding}`
          );
        }
        return;
      }

      // Pagamento completo: salvar URL do comprovante e marcar como pago
      const proofUrl = pixData?.pixPaymentUrl
        || pixData?.receiptUrl
        || (pixId ? `https://app.abacatepay.com/receipt/${pixId}` : null)
        || (pixData?.e2eId ? `e2e:${pixData.e2eId}` : null);

      if (proofUrl) {
        await paymentRepo.update(paymentId, { pix_payment_url: proofUrl });
      }
      await paymentService.markAsPaid(paymentId, paidAmountBRL);
      console.log(`[Webhook] Pagamento ${paymentId} confirmado. Valor: R$ ${paidAmountBRL}. Comprovante: ${proofUrl}`);
    }

    if (event === 'billing.expired' || event === 'pix.expired') {
      const paymentId = metadata?.paymentId;
      if (!paymentId) return;

      // Limpar campos PIX (cron vai recriar QR Code no próximo ciclo)
      await paymentRepo.update(paymentId, {
        abacate_pix_id: null,
        pix_br_code: null,
        pix_expires_at: null
      });
      console.log(`[Webhook] QR Code PIX expirado para pagamento ${paymentId}, campos limpos`);
    }

    if (event === 'billing.disputed') {
      // Pagamento contestado/reembolsado — reverter para status devedor
      let payment = null;
      const paymentId = metadata?.paymentId;

      if (paymentId) {
        payment = await paymentRepo.findById(paymentId);
      } else if (pixId) {
        payment = await paymentRepo.findByAbacatePixId(pixId);
      }

      if (!payment) {
        console.warn(`[Webhook] billing.disputed: pagamento não encontrado (paymentId=${paymentId}, pixId=${pixId}), ignorando`);
        return;
      }

      if (payment.status !== 'Pago') {
        console.log(`[Webhook] billing.disputed: pagamento ${payment.id} não está Pago (status atual: ${payment.status}), ignorando`);
        return;
      }

      // Reverter para status anterior (Pendente ou Atrasado) e limpar campos PIX
      await paymentService.markAsUnpaid(payment.id, 'Pagamento contestado/reembolsado via AbacatePay');
      await paymentRepo.update(payment.id, {
        abacate_pix_id: null,
        pix_br_code: null,
        pix_expires_at: null,
        pix_payment_url: null
      });

      console.log(`[Webhook] Disputa processada para pagamento ${payment.id}. Status revertido para devedor.`);
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar evento Abacate Pay:', err);
  }
}
