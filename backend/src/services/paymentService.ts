import { PaymentRepository } from '../repositories/paymentRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { Database } from '../models/database.types';

type Payment = Database['public']['Tables']['payments']['Row'];

export class PaymentService {
  constructor(
    private paymentRepo: PaymentRepository,
    private rentalRepo: RentalRepository,
    private motorcycleRepo: MotorcycleRepository,
    private subscriberRepo: SubscriberRepository
  ) {}

  async getAllPayments(): Promise<Payment[]> {
    return this.paymentRepo.findAll();
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    return this.paymentRepo.findById(id);
  }

  async getPaymentsByStatus(status: string): Promise<Payment[]> {
    return this.paymentRepo.findByStatus(status);
  }

  async updatePayment(
    paymentId: string,
    updates: { amount?: number; due_date?: string }
  ): Promise<Payment> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new Error('Pagamento não encontrado');
    }

    // Validação: não permitir edição de pagamentos pagos ou cancelados
    if (payment.status === 'Pago') {
      throw new Error('Não é possível editar pagamento já marcado como pago');
    }

    if (payment.status === 'Cancelado') {
      throw new Error('Não é possível editar pagamento cancelado');
    }

    // Atualizar apenas os campos fornecidos
    const dataToUpdate: Partial<Payment> = {};

    if (updates.amount !== undefined) {
      dataToUpdate.amount = updates.amount;
      dataToUpdate.is_amount_overridden = updates.amount !== payment.expected_amount;
    }

    if (updates.due_date !== undefined) {
      dataToUpdate.due_date = updates.due_date;

      // Recalcular status baseado na nova data
      const today = new Date().toISOString().split('T')[0];
      if (updates.due_date < today && payment.status !== 'Atrasado') {
        dataToUpdate.status = 'Atrasado';
      } else if (updates.due_date >= today && payment.status === 'Atrasado') {
        dataToUpdate.status = 'Pendente';
      }
    }

    const updated = await this.paymentRepo.update(paymentId, dataToUpdate);

    console.log(`[PaymentService] Pagamento ${paymentId} atualizado:`, dataToUpdate);

    return updated;
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

    // VALIDAÇÃO 2: Verificar valor divergente
    if (verifiedAmount && verifiedAmount !== payment.expected_amount) {
      console.warn(
        `[PaymentService] Valor divergente: esperado ${payment.expected_amount}, recebido ${verifiedAmount}`
      );
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

    // Atualizar receita da moto
    const rental = await this.rentalRepo.findById(payment.rental_id);
    if (rental) {
      await this.motorcycleRepo.incrementRevenue(rental.motorcycle_id, finalAmount, {
        payment_id: paymentId,
        rental_id: payment.rental_id,
        subscriber_name: payment.subscriber_name,
        date: new Date().toISOString().split('T')[0]
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
    const newStatus = payment.due_date < today ? 'Atrasado' : 'Pendente';

    const updated = await this.paymentRepo.update(paymentId, {
      status: newStatus,
      previous_status: 'Pago',
      paid_at: null,
      marked_as_paid_at: null
    });

    // Decrementar receita da moto
    const rental = await this.rentalRepo.findById(payment.rental_id);
    if (rental) {
      await this.motorcycleRepo.decrementRevenue(rental.motorcycle_id, payment.amount, paymentId);
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

    // Calcular dívida total do assinante
    const allRentals = await this.rentalRepo.findBySubscriberId(rental.subscriber_id);
    let totalDebt = 0;

    for (const r of allRentals) {
      if (!r.is_active) continue;

      const payments = await this.paymentRepo.findByRentalId(r.id);
      const unpaidPayments = payments.filter(p => p.status === 'Pendente' || p.status === 'Atrasado');
      totalDebt += unpaidPayments.reduce((sum, p) => sum + p.amount, 0);
    }

    // Simular envio de WhatsApp (substituir por integração real)
    console.log(`[WhatsApp Simulado] Enviando lembrete para ${subscriber.name} (${subscriber.phone})`);
    console.log(`  - Pagamento: R$ ${payment.amount.toFixed(2)}`);
    console.log(`  - Vencimento: ${payment.due_date}`);
    console.log(`  - Dívida total: R$ ${totalDebt.toFixed(2)}`);

    // Incrementar contador de lembretes
    await this.paymentRepo.update(paymentId, {
      reminder_sent_count: payment.reminder_sent_count + 1
    });

    console.log(`[PaymentService] Lembrete enviado para pagamento ${paymentId}`);
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
