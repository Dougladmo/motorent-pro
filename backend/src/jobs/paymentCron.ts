import cron from 'node-cron';
import { PaymentRepository } from '../repositories/paymentRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { Database } from '../models/database.types';

type PaymentInsert = Database['public']['Tables']['payments']['Insert'];

export class PaymentCronService {
  constructor(
    private paymentRepo: PaymentRepository,
    private rentalRepo: RentalRepository,
    private subscriberRepo: SubscriberRepository
  ) {}

  async runPaymentGeneration(): Promise<void> {
    console.log('[CRON] ========================================');
    console.log('[CRON] Iniciando geração de pagamentos...');
    console.log('[CRON] Timestamp:', new Date().toISOString());

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    try {
      // STEP 1: Atualizar PENDING → OVERDUE
      await this.updateOverduePayments(todayStr);

      // STEP 2: Gerar novos pagamentos
      await this.generateNewPayments(today, todayStr);

      console.log('[CRON] Geração concluída com sucesso');
    } catch (error) {
      console.error('[CRON ERROR]', error);
      throw error;
    }

    console.log('[CRON] ========================================');
  }

  private async updateOverduePayments(todayStr: string): Promise<void> {
    console.log('[CRON] STEP 1: Atualizando pagamentos atrasados...');

    const overduePayments = await this.paymentRepo.findOverduePayments();

    if (overduePayments.length === 0) {
      console.log('[CRON] Nenhum pagamento pendente atrasado encontrado');
      return;
    }

    console.log(`[CRON] Encontrados ${overduePayments.length} pagamentos atrasados`);

    const ids = overduePayments.map(p => p.id);
    await this.paymentRepo.updateMany(ids, { status: 'Atrasado' });

    console.log(`[CRON] ${ids.length} pagamentos atualizados para status "Atrasado"`);
  }

  private async generateNewPayments(today: Date, todayStr: string): Promise<void> {
    console.log('[CRON] STEP 2: Gerando novos pagamentos...');

    const activeRentals = await this.rentalRepo.findAllActive();

    if (activeRentals.length === 0) {
      console.log('[CRON] Nenhum aluguel ativo encontrado');
      return;
    }

    console.log(`[CRON] ${activeRentals.length} aluguéis ativos encontrados`);

    let totalNewPayments = 0;

    for (const rental of activeRentals) {
      const subscriber = await this.subscriberRepo.findById(rental.subscriber_id);
      if (!subscriber) {
        console.warn(`[CRON] Assinante ${rental.subscriber_id} não encontrado, pulando`);
        continue;
      }

      // Parse start date
      const [y, m, d] = rental.start_date.split('-').map(Number);
      let nextDueDate = new Date(y, m - 1, d);

      // Lookahead: gerar até 7 dias no futuro
      const lookaheadDate = new Date(today);
      lookaheadDate.setDate(lookaheadDate.getDate() + 7);

      // IMPORTANTE: Respeitar data de término do contrato
      let maxDate = lookaheadDate;
      if (rental.end_date) {
        const endDate = new Date(rental.end_date);
        if (endDate < lookaheadDate) {
          maxDate = endDate;
          console.log(`[CRON] Contrato ${rental.id} termina em ${rental.end_date}, limitando geração`);
        }
      }

      const newPayments: PaymentInsert[] = [];

      while (nextDueDate <= maxDate) {
        const dateStr = nextDueDate.toISOString().split('T')[0];

        // Verificar se já existe
        const exists = await this.paymentRepo.existsByRentalAndDate(rental.id, dateStr);

        if (!exists) {
          const isPast = dateStr < todayStr;
          newPayments.push({
            rental_id: rental.id,
            subscriber_name: subscriber.name,
            amount: rental.weekly_value,
            expected_amount: rental.weekly_value,
            due_date: dateStr,
            status: isPast ? 'Atrasado' : 'Pendente',
            reminder_sent_count: 0
          });
        }

        // Próximo pagamento: +7 dias
        nextDueDate.setDate(nextDueDate.getDate() + 7);
      }

      if (newPayments.length > 0) {
        await this.paymentRepo.bulkCreate(newPayments);
        totalNewPayments += newPayments.length;
        console.log(`[CRON] Aluguel ${rental.id}: ${newPayments.length} novos pagamentos criados`);
      }
    }

    if (totalNewPayments === 0) {
      console.log('[CRON] Nenhum novo pagamento precisou ser gerado');
    } else {
      console.log(`[CRON] Total de novos pagamentos criados: ${totalNewPayments}`);
    }
  }

  // Gerar pagamentos para um rental específico (usado ao criar novo contrato)
  async generatePaymentsForRental(rentalId: string): Promise<number> {
    console.log(`[PAYMENT GEN] Gerando pagamentos para rental ${rentalId}...`);

    const rental = await this.rentalRepo.findById(rentalId);
    if (!rental) {
      throw new Error('Rental não encontrado');
    }

    if (!rental.is_active) {
      console.log(`[PAYMENT GEN] Rental ${rentalId} está inativo, pulando geração`);
      return 0;
    }

    const subscriber = await this.subscriberRepo.findById(rental.subscriber_id);
    if (!subscriber) {
      throw new Error('Assinante não encontrado');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Parse start date
    const [y, m, d] = rental.start_date.split('-').map(Number);
    let nextDueDate = new Date(y, m - 1, d);

    // Lookahead: gerar até 7 dias no futuro
    const lookaheadDate = new Date(today);
    lookaheadDate.setDate(lookaheadDate.getDate() + 7);

    // Respeitar data de término do contrato
    let maxDate = lookaheadDate;
    if (rental.end_date) {
      const endDate = new Date(rental.end_date);
      if (endDate < lookaheadDate) {
        maxDate = endDate;
      }
    }

    const newPayments: PaymentInsert[] = [];

    while (nextDueDate <= maxDate) {
      const dateStr = nextDueDate.toISOString().split('T')[0];

      // Verificar se já existe
      const exists = await this.paymentRepo.existsByRentalAndDate(rental.id, dateStr);

      if (!exists) {
        const isPast = dateStr < todayStr;
        newPayments.push({
          rental_id: rental.id,
          subscriber_name: subscriber.name,
          amount: rental.weekly_value,
          expected_amount: rental.weekly_value,
          due_date: dateStr,
          status: isPast ? 'Atrasado' : 'Pendente',
          reminder_sent_count: 0
        });
      }

      // Próximo pagamento: +7 dias
      nextDueDate.setDate(nextDueDate.getDate() + 7);
    }

    if (newPayments.length > 0) {
      await this.paymentRepo.bulkCreate(newPayments);
      console.log(`[PAYMENT GEN] ${newPayments.length} pagamentos criados para rental ${rentalId}`);
    }

    return newPayments.length;
  }

  startCronJobs(): void {
    const cronExpression = process.env.CRON_PAYMENT_GENERATION || '0 */6 * * *';

    cron.schedule(cronExpression, async () => {
      try {
        await this.runPaymentGeneration();
      } catch (error) {
        console.error('[CRON SCHEDULE ERROR]', error);
      }
    });

    console.log(`[CRON] Job agendado com expressão: ${cronExpression}`);
    console.log('[CRON] Próxima execução automática em 6 horas');

    // Executar imediatamente na inicialização
    console.log('[CRON] Executando primeira rodada ao iniciar...');
    this.runPaymentGeneration().catch(err => {
      console.error('[CRON INIT ERROR]', err);
    });
  }
}
