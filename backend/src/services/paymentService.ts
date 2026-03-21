import { PaymentRepository } from '../repositories/paymentRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { NotificationService } from './notificationService';
import { AbacatePayService } from './abacatePayService';
import { UploadService } from './uploadService';
import { Database } from '../models/database.types';

type Payment = Database['public']['Tables']['payments']['Row'];

export class PaymentService {
  private abacatePayService: AbacatePayService;
  private uploadService: UploadService;

  constructor(
    private paymentRepo: PaymentRepository,
    private rentalRepo: RentalRepository,
    private motorcycleRepo: MotorcycleRepository,
    private subscriberRepo: SubscriberRepository,
    private notificationService: NotificationService
  ) {
    this.abacatePayService = new AbacatePayService();
    this.uploadService = new UploadService();
  }

  async getAllPayments(): Promise<Payment[]> {
    return this.paymentRepo.findAll();
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    return this.paymentRepo.findById(id);
  }

  async getPaymentsByStatus(status: string): Promise<Payment[]> {
    return this.paymentRepo.findByStatus(status);
  }

  async markAsPaid(paymentId: string, verifiedAmount?: number): Promise<Payment> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new Error('Pagamento não encontrado');
    }

    // VALIDAÇÃO 1: Prevenir dupla marcação
    if (payment.status === 'Pago') {
      throw new Error('Pagamento já está marcado como pago');
    }

    // VALIDAÇÃO 2: Pagamento parcial — atualiza amount mas não marca como pago
    if (verifiedAmount !== undefined && verifiedAmount < payment.expected_amount) {
      console.warn(
        `[PaymentService] Pagamento parcial: esperado ${payment.expected_amount}, recebido ${verifiedAmount}. Cobrança não será quitada.`
      );
      const updated = await this.paymentRepo.update(paymentId, {
        amount: verifiedAmount,
        is_amount_overridden: true
      });
      return updated;
    }

    const finalAmount = verifiedAmount || payment.amount;

    // Atualizar pagamento
    const updated = await this.paymentRepo.update(paymentId, {
      status: 'Pago',
      previous_status: payment.status,
      paid_at: new Date().toISOString().split('T')[0],
      marked_as_paid_at: new Date().toISOString(),
      amount: finalAmount,
      is_amount_overridden: verifiedAmount !== undefined && verifiedAmount !== payment.expected_amount
    });

    // Atualizar receita da moto e saldo devedor do aluguel
    const rental = await this.rentalRepo.findById(payment.rental_id);
    if (rental) {
      await this.motorcycleRepo.incrementRevenue(rental.motorcycle_id, finalAmount, {
        payment_id: paymentId,
        rental_id: payment.rental_id,
        subscriber_name: payment.subscriber_name,
        date: new Date().toISOString().split('T')[0]
      });

      // Recalcular saldo devedor com base nos pagamentos restantes
      const allPayments = await this.paymentRepo.findByRentalId(payment.rental_id);
      const newOutstandingBalance = allPayments
        .filter(p => p.id !== paymentId && (p.status === 'Pendente' || p.status === 'Atrasado'))
        .reduce((sum, p) => sum + p.amount, 0);
      await this.rentalRepo.update(payment.rental_id, {
        outstanding_balance: newOutstandingBalance,
        total_paid: (rental.total_paid || 0) + finalAmount
      });
    }

    console.log(`[PaymentService] Pagamento ${paymentId} marcado como pago. Valor: ${finalAmount}`);

    return updated;
  }

  async markAsUnpaid(paymentId: string, reason?: string): Promise<Payment> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new Error('Pagamento não encontrado');
    }

    if (payment.status !== 'Pago') {
      throw new Error('Apenas pagamentos "Pago" podem ser revertidos');
    }

    const today = new Date().toISOString().split('T')[0];
    const newStatus = (payment.previous_status && payment.previous_status !== 'Pago')
      ? payment.previous_status
      : (payment.due_date < today ? 'Atrasado' : 'Pendente');

    const updated = await this.paymentRepo.update(paymentId, {
      status: newStatus,
      previous_status: 'Pago',
      paid_at: null,
      marked_as_paid_at: null
    });

    // Decrementar receita da moto e recalcular saldo devedor
    const rental = await this.rentalRepo.findById(payment.rental_id);
    if (rental) {
      await this.motorcycleRepo.decrementRevenue(rental.motorcycle_id, payment.amount, paymentId);

      // Recalcular saldo devedor incluindo o pagamento que acaba de ser revertido
      const allPayments = await this.paymentRepo.findByRentalId(payment.rental_id);
      const newOutstandingBalance = allPayments
        .filter(p => p.id !== paymentId && (p.status === 'Pendente' || p.status === 'Atrasado'))
        .reduce((sum, p) => sum + p.amount, 0) + payment.amount;
      await this.rentalRepo.update(payment.rental_id, {
        outstanding_balance: newOutstandingBalance,
        total_paid: Math.max(0, (rental.total_paid || 0) - payment.amount)
      });
    }

    console.log(`[PaymentService] Pagamento ${paymentId} revertido para ${newStatus}. Motivo: ${reason || 'N/A'}`);

    return updated;
  }

  async sendReminder(paymentId: string): Promise<void> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new Error('Pagamento não encontrado');
    }

    if (payment.status === 'Pago') {
      throw new Error('Não é possível enviar lembrete para pagamento já pago');
    }

    // Buscar rental e subscriber para calcular dívida total
    const rental = await this.rentalRepo.findById(payment.rental_id);
    if (!rental) {
      throw new Error('Aluguel não encontrado');
    }

    const subscriber = await this.subscriberRepo.findById(rental.subscriber_id);
    if (!subscriber) {
      throw new Error('Assinante não encontrado');
    }

    // Detectar pagamento acumulado (amount > expected_amount = múltiplas semanas)
    const weeks = Math.round(payment.amount / payment.expected_amount);
    const isAccumulated = weeks > 1 && !payment.is_amount_overridden;

    if (isAccumulated) {
      // Pagamento acumulado: gerar N PIX codes (um por semana) e enviar consolidado
      console.log(`[PaymentService] Pagamento acumulado ${paymentId}: R$${payment.amount} = ${weeks}x R$${payment.expected_amount}`);

      const consolidatedPayments: Array<{
        amount: number;
        dueDate: string;
        pixBrCode?: string;
        pixQrCodeUrl?: string;
        pixQrCodeBase64?: string;
      }> = [];

      // Gerar datas retroativas para cada semana acumulada
      const [dy, dm, dd] = payment.due_date.split('-').map(Number);
      const baseDueDate = new Date(dy, dm - 1, dd);

      for (let i = weeks - 1; i >= 0; i--) {
        const d = new Date(baseDueDate);
        d.setDate(d.getDate() - i * 7);
        const dateStr = d.toISOString().split('T')[0];

        // Gerar PIX individual para cada semana
        const pixResult = await this.abacatePayService.createPixQrCode({
          amount: payment.expected_amount,
          description: `Aluguel - ${subscriber.name} - Semana ${weeks - i}/${weeks} - ${dateStr}`,
          expiresIn: 604800,
          customer: {
            name: subscriber.name,
            cellphone: subscriber.phone,
            email: subscriber.email,
            taxId: subscriber.document
          },
          metadata: {
            paymentId: payment.id,
            rentalId: payment.rental_id,
            subscriberId: rental.subscriber_id
          }
        });

        let pixQrCodeUrl: string | undefined;
        if (pixResult?.pixQrCodeBase64) {
          try {
            pixQrCodeUrl = await this.uploadService.uploadQrCodeToStorage(pixResult.pixQrCodeBase64, `${paymentId}-week-${weeks - i}`);
          } catch (err) {
            console.warn(`[PaymentService] Falha ao fazer upload do QR Code semana ${weeks - i}:`, err);
          }
        }

        consolidatedPayments.push({
          amount: payment.expected_amount,
          dueDate: dateStr,
          pixBrCode: pixResult?.pixBrCode,
          pixQrCodeUrl,
          pixQrCodeBase64: pixResult?.pixQrCodeBase64
        });
      }

      await this.notificationService.sendConsolidatedReminder({
        subscriberName: subscriber.name,
        subscriberPhone: subscriber.phone,
        subscriberEmail: subscriber.email,
        payments: consolidatedPayments,
        totalOverdue: payment.amount
      });

      // Incrementar contador de lembretes
      await this.paymentRepo.update(paymentId, {
        reminder_sent_count: payment.reminder_sent_count + 1
      });

      console.log(`[PaymentService] Cobrança acumulada enviada para pagamento ${paymentId}: ${weeks} seções`);
      return;
    }

    // Pagamento normal (não acumulado): fluxo padrão
    // Calcular dívida total do assinante
    const allRentals = await this.rentalRepo.findBySubscriberId(rental.subscriber_id);
    let totalDebt = 0;

    for (const r of allRentals) {
      if (!r.is_active) continue;

      const payments = await this.paymentRepo.findByRentalId(r.id);
      const unpaidPayments = payments.filter(p => p.status === 'Pendente' || p.status === 'Atrasado');
      totalDebt += unpaidPayments.reduce((sum, p) => sum + p.amount, 0);
    }

    // Garantir QR Code PIX: reutilizar existente ou criar novo
    let pixBrCode = payment.pix_br_code ?? undefined;
    let pixQrCodeBase64: string | undefined;
    let pixPaymentUrl = payment.pix_payment_url ?? undefined;

    if (!pixBrCode) {
      console.log(`[PaymentService] Pagamento ${paymentId} sem QR Code PIX, criando...`);
      const pixResult = await this.abacatePayService.createPixQrCode({
        amount: payment.amount,
        description: `Aluguel - ${subscriber.name} - ${payment.due_date}`,
        expiresIn: 604800,
        customer: {
          name: subscriber.name,
          cellphone: subscriber.phone,
          email: subscriber.email,
          taxId: subscriber.document
        },
        metadata: {
          paymentId: payment.id,
          rentalId: payment.rental_id,
          subscriberId: rental.subscriber_id
        }
      });

      if (pixResult) {
        await this.paymentRepo.update(paymentId, {
          abacate_pix_id: pixResult.abacatePixId,
          pix_br_code: pixResult.pixBrCode,
          pix_expires_at: pixResult.pixExpiresAt,
          pix_payment_url: pixResult.pixPaymentUrl || null
        });
        pixBrCode = pixResult.pixBrCode;
        pixQrCodeBase64 = pixResult.pixQrCodeBase64;
        pixPaymentUrl = pixResult.pixPaymentUrl || undefined;
        console.log(`[PaymentService] QR Code PIX criado para pagamento ${paymentId}: ${pixResult.abacatePixId}`);
      }
    } else {
      console.log(`[PaymentService] Reutilizando QR Code PIX existente para pagamento ${paymentId}`);
    }

    // Fazer upload do QR Code para URL pública
    let pixQrCodeUrl: string | undefined;
    if (pixQrCodeBase64) {
      try {
        pixQrCodeUrl = await this.uploadService.uploadQrCodeToStorage(pixQrCodeBase64, paymentId);
        console.log(`[PaymentService] QR Code enviado para storage: ${pixQrCodeUrl}`);
      } catch (err) {
        console.warn(`[PaymentService] Falha ao fazer upload do QR Code:`, err);
      }
    }

    // Fallback: ler URL do QR Code do banco quando não houve novo upload
    if (!pixQrCodeUrl) {
      pixQrCodeUrl = payment.pix_qr_code_url ?? undefined;
    }

    await this.notificationService.sendReminder({
      subscriberName: subscriber.name,
      subscriberPhone: subscriber.phone,
      subscriberEmail: subscriber.email,
      paymentAmount: payment.amount,
      paymentDueDate: payment.due_date,
      totalDebt,
      pixBrCode,
      pixQrCodeUrl,
      pixQrCodeBase64,
      pixPaymentUrl
    });

    // Incrementar contador de lembretes
    await this.paymentRepo.update(paymentId, {
      reminder_sent_count: payment.reminder_sent_count + 1
    });

    console.log(`[PaymentService] Lembrete enviado para pagamento ${paymentId}`);
  }

  async sendConsolidatedReminder(subscriberId: string): Promise<void> {
    const subscriber = await this.subscriberRepo.findById(subscriberId);
    if (!subscriber) {
      throw new Error('Assinante não encontrado');
    }

    // Buscar todos os aluguéis ativos do assinante
    const allRentals = await this.rentalRepo.findBySubscriberId(subscriberId);
    const activeRentals = allRentals.filter(r => r.is_active);

    if (activeRentals.length === 0) {
      throw new Error('Nenhum aluguel ativo encontrado para este assinante');
    }

    // Buscar todos os pagamentos atrasados
    const overduePayments: Payment[] = [];
    for (const rental of activeRentals) {
      const payments = await this.paymentRepo.findByRentalId(rental.id);
      const overdue = payments.filter(p => p.status === 'Atrasado');
      overduePayments.push(...overdue);
    }

    if (overduePayments.length === 0) {
      throw new Error('Nenhum pagamento atrasado encontrado para este assinante');
    }

    // Ordenar por data de vencimento (mais antigo primeiro)
    overduePayments.sort((a, b) => a.due_date.localeCompare(b.due_date));

    const totalOverdue = overduePayments.reduce((sum, p) => sum + p.amount, 0);

    // Garantir QR Code PIX para cada pagamento
    const consolidatedPayments: Array<{
      amount: number;
      dueDate: string;
      pixBrCode?: string;
      pixQrCodeUrl?: string;
      pixQrCodeBase64?: string;
    }> = [];

    for (const payment of overduePayments) {
      let pixBrCode = payment.pix_br_code ?? undefined;
      let pixQrCodeBase64: string | undefined;
      let pixQrCodeUrl = payment.pix_qr_code_url ?? undefined;

      if (!pixBrCode) {
        console.log(`[PaymentService] Pagamento ${payment.id} sem QR Code PIX, criando para cobrança consolidada...`);
        const rental = activeRentals.find(r => r.id === payment.rental_id);
        const pixResult = await this.abacatePayService.createPixQrCode({
          amount: payment.amount,
          description: `Aluguel - ${subscriber.name} - ${payment.due_date}`,
          expiresIn: 604800,
          customer: {
            name: subscriber.name,
            cellphone: subscriber.phone,
            email: subscriber.email,
            taxId: subscriber.document
          },
          metadata: {
            paymentId: payment.id,
            rentalId: payment.rental_id,
            subscriberId
          }
        });

        if (pixResult) {
          await this.paymentRepo.update(payment.id, {
            abacate_pix_id: pixResult.abacatePixId,
            pix_br_code: pixResult.pixBrCode,
            pix_expires_at: pixResult.pixExpiresAt,
            pix_payment_url: pixResult.pixPaymentUrl || null
          });
          pixBrCode = pixResult.pixBrCode;
          pixQrCodeBase64 = pixResult.pixQrCodeBase64;

          // Upload QR Code
          if (pixQrCodeBase64) {
            try {
              pixQrCodeUrl = await this.uploadService.uploadQrCodeToStorage(pixQrCodeBase64, payment.id);
            } catch (err) {
              console.warn(`[PaymentService] Falha ao fazer upload do QR Code para pagamento ${payment.id}:`, err);
            }
          }
        }
      }

      consolidatedPayments.push({
        amount: payment.amount,
        dueDate: payment.due_date,
        pixBrCode,
        pixQrCodeUrl,
        pixQrCodeBase64
      });
    }

    // Enviar notificação consolidada
    await this.notificationService.sendConsolidatedReminder({
      subscriberName: subscriber.name,
      subscriberPhone: subscriber.phone,
      subscriberEmail: subscriber.email,
      payments: consolidatedPayments,
      totalOverdue
    });

    // Incrementar contador de lembretes de cada pagamento
    for (const payment of overduePayments) {
      await this.paymentRepo.update(payment.id, {
        reminder_sent_count: payment.reminder_sent_count + 1
      });
    }

    console.log(`[PaymentService] Cobrança consolidada enviada para ${subscriber.name} | ${overduePayments.length} pagamentos | total: R$ ${totalOverdue.toFixed(2)}`);
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment> {
    const payment = await this.paymentRepo.findById(id);
    if (!payment) {
      throw new Error('Pagamento não encontrado');
    }

    return this.paymentRepo.update(id, updates);
  }

  async deletePayment(paymentId: string): Promise<void> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new Error('Pagamento não encontrado');
    }

    await this.paymentRepo.delete(paymentId);
    console.log(`[PaymentService] Cobrança ${paymentId} deletada permanentemente`);
  }

  async validateIntegrity(): Promise<{
    totalPayments: number;
    inconsistencies: Array<{ type: string; message: string; paymentId: string }>;
  }> {
    const allPayments = await this.paymentRepo.findAll();
    const inconsistencies: Array<{ type: string; message: string; paymentId: string }> = [];

    for (const payment of allPayments) {
      // Verificar se rental existe
      const rental = await this.rentalRepo.findById(payment.rental_id);
      if (!rental) {
        inconsistencies.push({
          type: 'missing_rental',
          message: `Pagamento ${payment.id} referencia aluguel inexistente ${payment.rental_id}`,
          paymentId: payment.id
        });
        continue;
      }

      // Verificar status OVERDUE
      const today = new Date().toISOString().split('T')[0];
      if (payment.status === 'Pendente' && payment.due_date < today) {
        inconsistencies.push({
          type: 'should_be_overdue',
          message: `Pagamento ${payment.id} vencido (${payment.due_date}) mas com status Pendente`,
          paymentId: payment.id
        });
      }

      // Verificar valores
      if (payment.amount !== payment.expected_amount && !payment.is_amount_overridden) {
        inconsistencies.push({
          type: 'amount_mismatch',
          message: `Pagamento ${payment.id} com valor divergente sem flag de override`,
          paymentId: payment.id
        });
      }
    }

    return {
      totalPayments: allPayments.length,
      inconsistencies
    };
  }
}
