import cron from 'node-cron';
import { PaymentRepository } from '../repositories/paymentRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { NotificationService } from '../services/notificationService';
import { AbacatePayService } from '../services/abacatePayService';
import { createStorage } from 'formdata-io/storage';

function getQrStorage() {
  return createStorage({
    provider: 'supabase',
    bucket: 'qr-codes',
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    publicBucket: true
  });
}

async function uploadQrCodeToStorage(base64: string, paymentId: string): Promise<string> {
  const dataUri = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  const result = await getQrStorage().upload(dataUri, { filename: `qrcode_${paymentId}.png` });
  return result.url;
}

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
      // STEP 0: Consolidar cobranças duplicadas (múltiplos ativos → 1 por rental)
      await this.consolidateExistingDuplicates(today, todayStr);

      // STEP 1: Atualizar PENDING → OVERDUE
      await this.updateOverduePayments(todayStr);

      // STEP 1.5: Regenerar PIX ausentes (Pendente/Atrasado sem pix_br_code)
      await this.regenerateMissingPixCodes();

      // STEP 2: Gerar/atualizar pagamentos (lógica consolidada)
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

  private async consolidateExistingDuplicates(today: Date, todayStr: string): Promise<void> {
    console.log('[CRON] STEP 0: Consolidando cobranças duplicadas...');

    const activeRentals = await this.rentalRepo.findAllActive();
    let consolidated = 0;

    for (const rental of activeRentals) {
      try {
        const activePayments = await this.paymentRepo.findActiveByRentalId(rental.id);

        if (activePayments.length <= 1) continue;

        console.log(`[CRON] Rental ${rental.id}: ${activePayments.length} cobranças ativas → consolidando`);

        const subscriber = await this.subscriberRepo.findById(rental.subscriber_id);

        // Soma de todos os valores
        const totalAmount = activePayments.reduce((sum, p) => sum + p.amount, 0);

        // due_date = maior data entre todos
        const latestDueDate = activePayments
          .map(p => p.due_date)
          .sort()
          .at(-1)!;

        // status = Atrasado se qualquer um for Atrasado OU se a maior data já passou
        const hasOverdue = activePayments.some(p => p.status === 'Atrasado');
        const newStatus = (hasOverdue || latestDueDate < todayStr) ? 'Atrasado' : 'Pendente';

        // Cancelar PIX de todos
        for (const p of activePayments) {
          if (p.abacate_pix_id) {
            await this.abacatePayService.cancelPixQrCode(p.abacate_pix_id);
          }
        }

        // Manter primeiro registro (atualizar), deletar os demais
        const [keep, ...rest] = activePayments;
        await this.paymentRepo.update(keep.id, {
          amount: totalAmount,
          due_date: latestDueDate,
          status: newStatus,
          abacate_pix_id: null,
          pix_br_code: null,
          pix_expires_at: null,
          pix_payment_url: null
        });

        for (const p of rest) {
          await this.paymentRepo.delete(p.id);
        }

        // Criar novo PIX para o registro consolidado (apenas se tiver subscriber com CPF)
        if (subscriber) {
          const pixResult = await this.abacatePayService.createPixQrCode({
            amount: totalAmount,
            description: `Aluguel - ${subscriber.name} - ${latestDueDate}`,
            expiresIn: 604800,
            customer: {
              name: subscriber.name,
              cellphone: subscriber.phone,
              email: subscriber.email,
              taxId: subscriber.document
            },
            metadata: {
              paymentId: keep.id,
              rentalId: rental.id,
              subscriberId: rental.subscriber_id
            }
          });

          if (pixResult) {
            let qrCodeUrl: string | null = null;
            if (pixResult.pixQrCodeBase64) {
              try {
                qrCodeUrl = await uploadQrCodeToStorage(pixResult.pixQrCodeBase64, keep.id);
              } catch (uploadErr) {
                console.warn(`[CRON] Falha ao fazer upload do QR Code para ${keep.id}:`, uploadErr);
              }
            }
            await this.paymentRepo.update(keep.id, {
              abacate_pix_id: pixResult.abacatePixId,
              pix_br_code: pixResult.pixBrCode,
              pix_expires_at: pixResult.pixExpiresAt,
              pix_payment_url: qrCodeUrl || pixResult.pixPaymentUrl || null
            });
          }
        }

        consolidated++;
        console.log(`[CRON] Rental ${rental.id}: consolidado em R$${totalAmount} (${newStatus}), ${rest.length} registros removidos`);
      } catch (err) {
        console.error(`[CRON] Erro ao consolidar rental ${rental.id}:`, err);
      }
    }

    if (consolidated === 0) {
      console.log('[CRON] Nenhuma duplicata encontrada');
    } else {
      console.log(`[CRON] ${consolidated} rental(s) consolidados`);
    }
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
    console.log('[CRON] STEP 2: Gerando/atualizando pagamentos...');

    const activeRentals = await this.rentalRepo.findAllActive();

    if (activeRentals.length === 0) {
      console.log('[CRON] Nenhum aluguel ativo encontrado');
      return;
    }

    console.log(`[CRON] ${activeRentals.length} aluguéis ativos encontrados`);

    let totalProcessed = 0;

    for (const rental of activeRentals) {
      try {
        const subscriber = await this.subscriberRepo.findById(rental.subscriber_id);
        if (!subscriber) {
          console.warn(`[CRON] Assinante ${rental.subscriber_id} não encontrado, pulando`);
          continue;
        }

        // Lookahead: até 7 dias no futuro, respeitando end_date
        const lookaheadDate = new Date(today);
        lookaheadDate.setDate(lookaheadDate.getDate() + 7);

        let maxDate = lookaheadDate;
        if (rental.end_date) {
          const endDate = new Date(rental.end_date);
          if (endDate < lookaheadDate) {
            maxDate = endDate;
            console.log(`[CRON] Contrato ${rental.id} termina em ${rental.end_date}, limitando geração`);
          }
        }

        // Buscar cobrança ativa existente (após STEP 0 deve ser no máximo 1)
        const activePayments = await this.paymentRepo.findActiveByRentalId(rental.id);
        const activePayment = activePayments[0] ?? null;

        // Calcular "última data cobrada"
        let lastCoveredDate: Date;
        if (activePayment) {
          const [ay, am, ad] = activePayment.due_date.split('-').map(Number);
          lastCoveredDate = new Date(ay, am - 1, ad);
        } else {
          // Nenhuma cobrança ativa: verificar se há pagamentos já pagos
          const paidPayments = await this.paymentRepo.findPaidByRentalId(rental.id);
          if (paidPayments.length > 0) {
            // Continuar a partir do último pagamento pago
            const latestPaid = paidPayments[0]; // já ordenado por due_date desc
            const [py, pm, pd] = latestPaid.due_date.split('-').map(Number);
            lastCoveredDate = new Date(py, pm - 1, pd);
          } else {
            // Contrato sem nenhum pagamento: começa do início
            const [sy, sm, sd] = rental.start_date.split('-').map(Number);
            lastCoveredDate = new Date(sy, sm - 1, sd);
            lastCoveredDate.setDate(lastCoveredDate.getDate() - 7);
          }
        }

        // Calcular datas não cobertas
        const uncoveredDates: string[] = [];
        const cursor = new Date(lastCoveredDate);
        cursor.setDate(cursor.getDate() + 7);

        while (cursor <= maxDate) {
          const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
          uncoveredDates.push(dateStr);
          cursor.setDate(cursor.getDate() + 7);
        }

        if (uncoveredDates.length === 0) continue;

        const newDueDate = uncoveredDates.at(-1)!;
        const anyUncoveredPast = uncoveredDates.some(d => d < todayStr);

        if (activePayment) {
          // Acumular no pagamento existente
          const newAmount = activePayment.amount + uncoveredDates.length * rental.weekly_value;
          const currentOverdue = activePayment.status === 'Atrasado';
          const newStatus = (currentOverdue || anyUncoveredPast || newDueDate < todayStr) ? 'Atrasado' : 'Pendente';

          // Cancelar PIX antigo
          if (activePayment.abacate_pix_id) {
            await this.abacatePayService.cancelPixQrCode(activePayment.abacate_pix_id);
          }

          await this.paymentRepo.update(activePayment.id, {
            amount: newAmount,
            due_date: newDueDate,
            status: newStatus,
            abacate_pix_id: null,
            pix_br_code: null,
            pix_expires_at: null,
            pix_payment_url: null
          });

          // Criar novo PIX com valor acumulado
          const pixResult = await this.abacatePayService.createPixQrCode({
            amount: newAmount,
            description: `Aluguel - ${subscriber.name} - ${newDueDate}`,
            expiresIn: 604800,
            customer: {
              name: subscriber.name,
              cellphone: subscriber.phone,
              email: subscriber.email,
              taxId: subscriber.document
            },
            metadata: {
              paymentId: activePayment.id,
              rentalId: rental.id,
              subscriberId: rental.subscriber_id
            }
          });

          if (pixResult) {
            let qrCodeUrl: string | null = null;
            if (pixResult.pixQrCodeBase64) {
              try {
                qrCodeUrl = await uploadQrCodeToStorage(pixResult.pixQrCodeBase64, activePayment.id);
              } catch (uploadErr) {
                console.warn(`[CRON] Falha ao fazer upload do QR Code para ${activePayment.id}:`, uploadErr);
              }
            }
            await this.paymentRepo.update(activePayment.id, {
              abacate_pix_id: pixResult.abacatePixId,
              pix_br_code: pixResult.pixBrCode,
              pix_expires_at: pixResult.pixExpiresAt,
              pix_payment_url: qrCodeUrl || pixResult.pixPaymentUrl || null
            });
          }

          console.log(`[CRON] Rental ${rental.id}: cobrança atualizada para R$${newAmount} (${newStatus}), vence ${newDueDate}`);
        } else {
          // Criar nova cobrança consolidada
          const totalAmount = uncoveredDates.length * rental.weekly_value;
          const newStatus = anyUncoveredPast ? 'Atrasado' : 'Pendente';

          const created = await this.paymentRepo.create({
            rental_id: rental.id,
            subscriber_name: subscriber.name,
            amount: totalAmount,
            expected_amount: totalAmount,
            due_date: newDueDate,
            status: newStatus,
            reminder_sent_count: 0
          });

          const pixResult = await this.abacatePayService.createPixQrCode({
            amount: totalAmount,
            description: `Aluguel - ${subscriber.name} - ${newDueDate}`,
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
            let qrCodeUrl: string | null = null;
            if (pixResult.pixQrCodeBase64) {
              try {
                qrCodeUrl = await uploadQrCodeToStorage(pixResult.pixQrCodeBase64, created.id);
              } catch (uploadErr) {
                console.warn(`[CRON] Falha ao fazer upload do QR Code para ${created.id}:`, uploadErr);
              }
            }
            await this.paymentRepo.update(created.id, {
              abacate_pix_id: pixResult.abacatePixId,
              pix_br_code: pixResult.pixBrCode,
              pix_expires_at: pixResult.pixExpiresAt,
              pix_payment_url: qrCodeUrl || pixResult.pixPaymentUrl || null
            });

            if (newStatus === 'Pendente') {
              try {
                await this.notificationService.sendPaymentNotification({
                  subscriberName: subscriber.name,
                  subscriberPhone: subscriber.phone,
                  subscriberEmail: subscriber.email,
                  paymentAmount: totalAmount,
                  paymentDueDate: newDueDate,
                  totalDebt: totalAmount,
                  pixBrCode: pixResult.pixBrCode,
                  pixQrCodeUrl: qrCodeUrl ?? undefined,
                  pixPaymentUrl: qrCodeUrl || pixResult.pixPaymentUrl || undefined
                });
              } catch (err) {
                console.error(`[CRON] Erro ao notificar pagamento ${created.id}:`, err);
              }
            }
          }

          console.log(`[CRON] Rental ${rental.id}: nova cobrança R$${totalAmount} (${newStatus}), vence ${newDueDate}`);
        }

        totalProcessed++;
      } catch (err) {
        console.error(`[CRON] Erro ao processar rental ${rental.id}:`, err);
      }
    }

    if (totalProcessed === 0) {
      console.log('[CRON] Nenhum pagamento precisou ser gerado/atualizado');
    } else {
      console.log(`[CRON] Total de rentals processados: ${totalProcessed}`);
    }
  }

  private async regenerateMissingPixCodes(): Promise<void> {
    console.log('[CRON] STEP 1.5: Regenerando PIX para pagamentos sem código...');

    const paymentsWithoutPix = await this.paymentRepo.findActiveWithoutPix();

    if (paymentsWithoutPix.length === 0) {
      console.log('[CRON] Nenhum pagamento ativo sem PIX encontrado');
      return;
    }

    console.log(`[CRON] ${paymentsWithoutPix.length} pagamento(s) sem PIX`);

    for (const payment of paymentsWithoutPix) {
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
          let qrCodeUrl: string | null = null;
          if (pixResult.pixQrCodeBase64) {
            try {
              qrCodeUrl = await uploadQrCodeToStorage(pixResult.pixQrCodeBase64, payment.id);
            } catch (uploadErr) {
              console.warn(`[CRON] Falha ao fazer upload do QR Code para ${payment.id}:`, uploadErr);
            }
          }
          await this.paymentRepo.update(payment.id, {
            abacate_pix_id: pixResult.abacatePixId,
            pix_br_code: pixResult.pixBrCode,
            pix_expires_at: pixResult.pixExpiresAt,
            pix_payment_url: qrCodeUrl || pixResult.pixPaymentUrl || null
          });
          console.log(`[CRON] PIX regenerado para pagamento ${payment.id} (${payment.status})`);
        }
      } catch (err) {
        console.error(`[CRON] Erro ao regenerar PIX para ${payment.id}:`, err);
      }
    }
  }

  // Gerar pagamento para um rental específico (usado ao criar novo contrato)
  // Lógica consolidada: no máximo 1 cobrança ativa por rental
  async generatePaymentsForRental(rentalId: string): Promise<number> {
    console.log(`[PAYMENT GEN] Gerando pagamento para rental ${rentalId}...`);

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

    // Lookahead: até 7 dias no futuro, respeitando end_date
    const lookaheadDate = new Date(today);
    lookaheadDate.setDate(lookaheadDate.getDate() + 7);

    let maxDate = lookaheadDate;
    if (rental.end_date) {
      const endDate = new Date(rental.end_date);
      if (endDate < lookaheadDate) {
        maxDate = endDate;
      }
    }

    // Para novo contrato: começa do início do contrato menos 7 dias
    const [sy, sm, sd] = rental.start_date.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, sd);
    const lastCoveredDate = new Date(startDate);
    lastCoveredDate.setDate(lastCoveredDate.getDate() - 7);

    // Calcular datas não cobertas
    const uncoveredDates: string[] = [];
    const cursor = new Date(lastCoveredDate);
    cursor.setDate(cursor.getDate() + 7);

    while (cursor <= maxDate) {
      const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      uncoveredDates.push(dateStr);
      cursor.setDate(cursor.getDate() + 7);
    }

    if (uncoveredDates.length === 0) {
      console.log(`[PAYMENT GEN] Nenhuma data a cobrar para rental ${rentalId}`);
      return 0;
    }

    const totalAmount = uncoveredDates.length * rental.weekly_value;
    const newDueDate = uncoveredDates.at(-1)!;
    const anyPast = uncoveredDates.some(d => d < todayStr);
    const newStatus = anyPast ? 'Atrasado' : 'Pendente';

    const created = await this.paymentRepo.create({
      rental_id: rental.id,
      subscriber_name: subscriber.name,
      amount: totalAmount,
      expected_amount: totalAmount,
      due_date: newDueDate,
      status: newStatus,
      reminder_sent_count: 0
    });

    const pixResult = await this.abacatePayService.createPixQrCode({
      amount: totalAmount,
      description: `Aluguel - ${subscriber.name} - ${newDueDate}`,
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
      let qrCodeUrl: string | null = null;
      if (pixResult.pixQrCodeBase64) {
        try {
          qrCodeUrl = await uploadQrCodeToStorage(pixResult.pixQrCodeBase64, created.id);
        } catch (uploadErr) {
          console.warn(`[PAYMENT GEN] Falha ao fazer upload do QR Code para ${created.id}:`, uploadErr);
        }
      }
      await this.paymentRepo.update(created.id, {
        abacate_pix_id: pixResult.abacatePixId,
        pix_br_code: pixResult.pixBrCode,
        pix_expires_at: pixResult.pixExpiresAt,
        pix_payment_url: qrCodeUrl || pixResult.pixPaymentUrl || null
      });
    }

    console.log(`[PAYMENT GEN] Cobrança criada: R$${totalAmount} (${newStatus}), vence ${newDueDate}`);
    return 1;
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
          pixQrCodeUrl: payment.pix_payment_url ?? undefined,
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

    const pending = await this.paymentRepo.findActiveWithoutPix();
    if (pending.length === 0) {
      console.log('[CRON] Nenhum pagamento ativo sem QR Code encontrado');
      return;
    }

    console.log(`[CRON] ${pending.length} pagamentos ativos sem QR Code`);

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
          let qrCodeUrl: string | null = null;
          if (pixResult.pixQrCodeBase64) {
            try {
              qrCodeUrl = await uploadQrCodeToStorage(pixResult.pixQrCodeBase64, payment.id);
            } catch (uploadErr) {
              console.warn(`[CRON] Falha ao fazer upload do QR Code para ${payment.id}:`, uploadErr);
            }
          }
          await this.paymentRepo.update(payment.id, {
            abacate_pix_id: pixResult.abacatePixId,
            pix_br_code: pixResult.pixBrCode,
            pix_expires_at: pixResult.pixExpiresAt,
            pix_payment_url: qrCodeUrl || pixResult.pixPaymentUrl || null
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
