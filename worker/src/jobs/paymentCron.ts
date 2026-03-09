import cron from 'node-cron';
import { PaymentRepository } from '../repositories/paymentRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { NotificationService } from '../services/notificationService';
import { AbacatePayService } from '../services/abacatePayService';
import { Database } from '../models/database.types';

type PaymentInsert = Database['public']['Tables']['payments']['Insert'];

export class PaymentCronService {
  private abacatePayService: AbacatePayService;

  constructor(
    private paymentRepo: PaymentRepository,
    private rentalRepo: RentalRepository,
    private subscriberRepo: SubscriberRepository,
    private notificationService: NotificationService
  ) {
    this.abacatePayService = new AbacatePayService();
  }

  async runPaymentGeneration(): Promise<void> {
    console.log('[CRON] ========================================');
    console.log('[CRON] Iniciando geração de pagamentos...');
    console.log('[CRON] Timestamp:', new Date().toISOString());

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    try {
      // STEP 1: Atualizar PENDING → OVERDUE
      await this.updateOverduePayments(todayStr);

      // STEP 2: Gerar novos pagamentos
      await this.generateNewPayments(today, todayStr);

      // STEP 3: Enviar lembretes de vencimento próximo
      await this.sendUpcomingPaymentReminders();

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
      try {
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
        const dateStr = `${nextDueDate.getFullYear()}-${String(nextDueDate.getMonth() + 1).padStart(2, '0')}-${String(nextDueDate.getDate()).padStart(2, '0')}`;

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
        const createdPayments = await this.paymentRepo.bulkCreate(newPayments);
        totalNewPayments += newPayments.length;
        console.log(`[CRON] Aluguel ${rental.id}: ${newPayments.length} novos pagamentos criados`);

        // Gerar QR Code PIX e notificar apenas pagamentos Pendentes (não retroativos)
        for (const created of createdPayments) {
          if (created.status !== 'Pendente') continue;

          // Tentar gerar QR Code PIX (degradação graciosa em caso de falha)
          const pixResult = await this.abacatePayService.createPixQrCode({
            amount: created.amount,
            description: `Aluguel - ${subscriber.name} - ${created.due_date}`,
            expiresIn: 604800,
            customer: {
              name: subscriber.name,
              cellphone: subscriber.phone,
              email: subscriber.email,
              taxId: subscriber.document
            },
            metadata: {
              paymentId: created.id,
              rentalId: rental.id,
              subscriberId: rental.subscriber_id
            }
          });

          if (pixResult) {
            await this.paymentRepo.update(created.id, {
              abacate_pix_id: pixResult.abacatePixId,
              pix_br_code: pixResult.pixBrCode,
              pix_qr_code_base64: pixResult.pixQrCodeBase64,
              pix_expires_at: pixResult.pixExpiresAt,
              pix_payment_url: pixResult.pixPaymentUrl || null
            });
          }

          try {
            await this.notificationService.sendPaymentNotification({
              subscriberName: subscriber.name,
              subscriberPhone: subscriber.phone,
              subscriberEmail: subscriber.email,
              paymentAmount: created.amount,
              paymentDueDate: created.due_date,
              totalDebt: created.amount,
              pixBrCode: pixResult?.pixBrCode,
              pixQrCodeBase64: pixResult?.pixQrCodeBase64,
              pixPaymentUrl: pixResult?.pixPaymentUrl
            });
          } catch (err) {
            console.error(`[CRON] Erro ao notificar pagamento ${created.id}:`, err);
          }
        }
      }
      } catch (err) {
        console.error(`[CRON] Erro ao processar rental ${rental.id}:`, err);
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
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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

  async sendUpcomingPaymentReminders(): Promise<void> {
    const reminderDaysBefore = parseInt(process.env.REMINDER_DAYS_BEFORE || '1');
    console.log(`[CRON] STEP 3: Enviando lembretes de vencimento (${reminderDaysBefore} dia(s) antes)...`);

    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + reminderDaysBefore);
    const targetDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;

    const payments = await this.paymentRepo.findPendingByDueDateAndNoReminder(targetDate);

    if (payments.length === 0) {
      console.log('[CRON] Nenhum pagamento pendente para lembrete hoje');
      return;
    }

    console.log(`[CRON] ${payments.length} pagamento(s) para lembrete com vencimento em ${targetDate}`);

    for (const payment of payments) {
      try {
        const rental = await this.rentalRepo.findById(payment.rental_id);
        if (!rental) {
          console.warn(`[CRON] Rental ${payment.rental_id} não encontrado para pagamento ${payment.id}`);
          continue;
        }

        const subscriber = await this.subscriberRepo.findById(rental.subscriber_id);
        if (!subscriber) {
          console.warn(`[CRON] Assinante ${rental.subscriber_id} não encontrado para pagamento ${payment.id}`);
          continue;
        }

        // Calcular dívida total: pagamentos Pendente + Atrasado de todos os aluguéis ativos do assinante
        const allRentals = await this.rentalRepo.findAllActive();
        const subscriberRentals = allRentals.filter(r => r.subscriber_id === rental.subscriber_id);
        let totalDebt = 0;
        for (const r of subscriberRentals) {
          const rPayments = await this.paymentRepo.findByRentalId(r.id);
          for (const p of rPayments) {
            if (p.status === 'Pendente' || p.status === 'Atrasado') {
              totalDebt += p.amount;
            }
          }
        }

        await this.notificationService.sendReminder({
          subscriberName: subscriber.name,
          subscriberPhone: subscriber.phone,
          subscriberEmail: subscriber.email,
          paymentAmount: payment.amount,
          paymentDueDate: payment.due_date,
          totalDebt,
          pixBrCode: payment.pix_br_code ?? undefined,
          pixQrCodeBase64: payment.pix_qr_code_base64 ?? undefined,
          pixPaymentUrl: payment.pix_payment_url ?? undefined
        });

        await this.paymentRepo.update(payment.id, {
          reminder_sent_count: (payment.reminder_sent_count ?? 0) + 1
        });

        console.log(`[CRON] Lembrete enviado para ${subscriber.name} (pagamento ${payment.id})`);
      } catch (err) {
        console.error(`[CRON] Erro ao enviar lembrete para pagamento ${payment.id}:`, err);
      }
    }
  }

  async backfillMissingQrCodes(): Promise<void> {
    console.log('[CRON] STEP 3: Backfill de QR Codes ausentes...');

    const pending = await this.paymentRepo.findPendingWithoutPix();
    if (pending.length === 0) {
      console.log('[CRON] Nenhum pagamento pendente sem QR Code encontrado');
      return;
    }

    console.log(`[CRON] ${pending.length} pagamentos pendentes sem QR Code`);

    for (const payment of pending) {
      try {
        const rental = await this.rentalRepo.findById(payment.rental_id);
        if (!rental) continue;

        const subscriber = await this.subscriberRepo.findById(rental.subscriber_id);
        if (!subscriber) continue;

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
            rentalId: rental.id,
            subscriberId: rental.subscriber_id
          }
        });

        if (pixResult) {
          await this.paymentRepo.update(payment.id, {
            abacate_pix_id: pixResult.abacatePixId,
            pix_br_code: pixResult.pixBrCode,
            pix_qr_code_base64: pixResult.pixQrCodeBase64,
            pix_expires_at: pixResult.pixExpiresAt,
            pix_payment_url: pixResult.pixPaymentUrl || null
          });
          console.log(`[CRON] QR Code gerado para pagamento ${payment.id}`);
        }
      } catch (err) {
        console.error(`[CRON] Erro ao backfill pagamento ${payment.id}:`, err);
      }
    }
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
    this.runPaymentGeneration()
      .then(() => this.backfillMissingQrCodes())
      .catch(err => {
        console.error('[CRON INIT ERROR]', err);
      });
  }
}
