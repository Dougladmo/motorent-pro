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

// Converte due_day_of_week do banco (ISO: 1=Seg..7=Dom) para JS getDay() (0=Dom..6=Sab)
function isoToJsDay(isoDow: number): number {
  return isoDow % 7; // 1→1(Seg), 2→2(Ter), ..., 6→6(Sab), 7→0(Dom)
}

function getFirstDueDate(startDateStr: string, dueDayOfWeek: number): Date {
  const [year, month, day] = startDateStr.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const startDay = start.getDay(); // 0=Dom, 1=Seg, ..., 6=Sab
  const targetDay = isoToJsDay(dueDayOfWeek);
  const daysToAdd = (targetDay - startDay + 7) % 7;
  const firstDue = new Date(start);
  firstDue.setDate(firstDue.getDate() + daysToAdd);
  return firstDue;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildQrCodeUrl(brCode: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(brCode)}&size=300x300&margin=10`;
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
    const todayStr = toDateStr(today);

    try {
      // STEP 0: Migrar cobranças acumuladas → registros individuais semanais
      await this.migrateAccumulatedPayments(today, todayStr);

      // STEP 0.5: Corrigir vencimentos desalinhados ao dia da semana do contrato
      await this.correctMisalignedPayments(todayStr);

      // STEP 1: Atualizar PENDING → OVERDUE
      await this.updateOverduePayments(todayStr);

      // STEP 1.5: Regenerar PIX ausentes (Pendente/Atrasado sem pix_br_code)
      await this.regenerateMissingPixCodes();

      // STEP 1.6: Preencher pix_payment_url ausentes (tem pix_br_code mas sem URL do QR)
      await this.backfillMissingQrUrls();

      // STEP 2: Gerar novos pagamentos individuais por semana
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

  private async migrateAccumulatedPayments(today: Date, todayStr: string): Promise<void> {
    console.log('[CRON] STEP 0: Migrando cobranças acumuladas para registros individuais semanais...');

    const activeRentals = await this.rentalRepo.findAllActive();
    let migrated = 0;

    for (const rental of activeRentals) {
      try {
        const activePayments = await this.paymentRepo.findActiveByRentalId(rental.id);
        if (activePayments.length === 0) continue;

        // 1. Deduplicar: se há 2+ pagamentos com o mesmo due_date, manter o mais antigo
        const byDate = new Map<string, typeof activePayments[0][]>();
        for (const p of activePayments) {
          if (!byDate.has(p.due_date)) byDate.set(p.due_date, []);
          byDate.get(p.due_date)!.push(p);
        }

        for (const [, payments] of byDate) {
          if (payments.length <= 1) continue;
          // Ordenar por id (UUID v4 não tem ordem temporal, mas é consistente)
          const [, ...duplicates] = payments.sort((a, b) => a.id.localeCompare(b.id));
          for (const dup of duplicates) {
            if (dup.abacate_pix_id) {
              await this.abacatePayService.cancelPixQrCode(dup.abacate_pix_id);
            }
            await this.paymentRepo.delete(dup.id);
            console.log(`[CRON] Rental ${rental.id}: removida duplicata ${dup.id} (due_date: ${dup.due_date})`);
          }
        }

        // Re-fetch após deduplicação
        const remainingPayments = await this.paymentRepo.findActiveByRentalId(rental.id);

        // 2. Para cada pagamento acumulado (amount > weekly_value), dividir em semanais
        const subscriber = await this.subscriberRepo.findById(rental.subscriber_id);

        for (const payment of remainingPayments) {
          if (payment.amount <= rental.weekly_value) continue;

          const weeks = Math.round(payment.amount / rental.weekly_value);
          if (weeks <= 1) continue;

          // Gerar datas: de (due_date - (weeks-1)*7) até due_date, a cada 7 dias
          const [dy, dm, dd] = payment.due_date.split('-').map(Number);
          const baseDueDate = new Date(dy, dm - 1, dd);

          const generatedDates: string[] = [];
          for (let i = weeks - 1; i >= 0; i--) {
            const d = new Date(baseDueDate);
            d.setDate(d.getDate() - i * 7);
            generatedDates.push(toDateStr(d));
          }

          console.log(`[CRON] Rental ${rental.id}: dividindo R$${payment.amount} em ${weeks} semanas: [${generatedDates.join(', ')}]`);

          // Cancelar PIX do pagamento acumulado
          if (payment.abacate_pix_id) {
            await this.abacatePayService.cancelPixQrCode(payment.abacate_pix_id);
          }

          // Deletar pagamento acumulado
          await this.paymentRepo.delete(payment.id);

          // Criar pagamentos individuais (STEP 1.5 irá gerar PIX para eles)
          for (const dateStr of generatedDates) {
            const exists = await this.paymentRepo.existsByRentalAndDate(rental.id, dateStr);
            if (!exists) {
              const status = dateStr < todayStr ? 'Atrasado' : 'Pendente';
              await this.paymentRepo.create({
                rental_id: rental.id,
                subscriber_name: subscriber?.name ?? '',
                amount: rental.weekly_value,
                expected_amount: rental.weekly_value,
                due_date: dateStr,
                status,
                reminder_sent_count: 0
              });
              console.log(`[CRON] Rental ${rental.id}: criado R$${rental.weekly_value} (${status}), vence ${dateStr}`);
            }
          }

          migrated++;
        }
      } catch (err) {
        console.error(`[CRON] Erro ao migrar rental ${rental.id}:`, err);
      }
    }

    if (migrated === 0) {
      console.log('[CRON] Nenhuma cobrança acumulada encontrada');
    } else {
      console.log(`[CRON] ${migrated} cobrança(s) acumulada(s) migrada(s) para registros individuais semanais`);
    }
  }

  private async correctMisalignedPayments(todayStr: string): Promise<void> {
    console.log('[CRON] STEP 0.5: Corrigindo vencimentos desalinhados ao dia da semana...');

    const activeRentals = await this.rentalRepo.findAllActive();
    let corrected = 0;

    for (const rental of activeRentals) {
      try {
        const activePayments = await this.paymentRepo.findActiveByRentalId(rental.id);
        if (activePayments.length === 0) continue;

        const targetDay = isoToJsDay(rental.due_day_of_week);

        for (const payment of activePayments) {
          const [ay, am, ad] = payment.due_date.split('-').map(Number);
          const paymentDate = new Date(ay, am - 1, ad);

          if (paymentDate.getDay() === targetDay) continue; // já alinhado

          // Mover para a próxima ocorrência correta do dia da semana
          const daysToFix = (targetDay - paymentDate.getDay() + 7) % 7;
          const correctedDate = new Date(paymentDate);
          correctedDate.setDate(correctedDate.getDate() + daysToFix);
          const correctedStr = toDateStr(correctedDate);

          // Cancelar PIX antigo
          if (payment.abacate_pix_id) {
            await this.abacatePayService.cancelPixQrCode(payment.abacate_pix_id);
          }

          // Corrigir due_date e limpar PIX (STEP 1.5 irá regenerar)
          await this.paymentRepo.update(payment.id, {
            due_date: correctedStr,
            status: correctedStr < todayStr ? 'Atrasado' : 'Pendente',
            abacate_pix_id: null,
            pix_br_code: null,
            pix_expires_at: null,
            pix_qr_code_url: null,
            pix_payment_url: null
          });

          corrected++;
          console.log(`[CRON] Rental ${rental.id}: due_date corrigido ${payment.due_date} → ${correctedStr}`);
        }
      } catch (err) {
        console.error(`[CRON] Erro ao corrigir alignment do rental ${rental.id}:`, err);
      }
    }

    if (corrected === 0) {
      console.log('[CRON] Nenhum vencimento desalinhado encontrado');
    } else {
      console.log(`[CRON] ${corrected} pagamento(s) com data de vencimento corrigida`);
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
    console.log('[CRON] STEP 2: Gerando pagamentos individuais por semana...');

    const activeRentals = await this.rentalRepo.findAllActive();

    if (activeRentals.length === 0) {
      console.log('[CRON] Nenhum aluguel ativo encontrado');
      return;
    }

    console.log(`[CRON] ${activeRentals.length} aluguéis ativos encontrados`);

    let totalCreated = 0;

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

        // Calcular "última data cobrada"
        const activePayments = await this.paymentRepo.findActiveByRentalId(rental.id);
        let lastCoveredDate: Date;

        if (activePayments.length > 0) {
          // Maior due_date entre pagamentos ativos
          const latestDateStr = activePayments.map(p => p.due_date).sort().at(-1)!;
          const [ay, am, ad] = latestDateStr.split('-').map(Number);
          lastCoveredDate = new Date(ay, am - 1, ad);
        } else {
          const paidPayments = await this.paymentRepo.findPaidByRentalId(rental.id);
          if (paidPayments.length > 0) {
            const latestPaid = paidPayments[0]; // já ordenado por due_date desc
            const [py, pm, pd] = latestPaid.due_date.split('-').map(Number);
            lastCoveredDate = new Date(py, pm - 1, pd);
          } else {
            // Contrato sem nenhum pagamento: âncora no primeiro vencimento correto
            const firstDue = getFirstDueDate(rental.start_date, rental.due_day_of_week);
            lastCoveredDate = new Date(firstDue);
            lastCoveredDate.setDate(lastCoveredDate.getDate() - 7);
          }
        }

        // Iterar datas não cobertas, criando 1 pagamento por semana
        const cursor = new Date(lastCoveredDate);
        cursor.setDate(cursor.getDate() + 7);

        while (cursor <= maxDate) {
          const dateStr = toDateStr(cursor);

          const exists = await this.paymentRepo.existsByRentalAndDate(rental.id, dateStr);
          if (!exists) {
            const status = dateStr < todayStr ? 'Atrasado' : 'Pendente';

            const created = await this.paymentRepo.create({
              rental_id: rental.id,
              subscriber_name: subscriber.name,
              amount: rental.weekly_value,
              expected_amount: rental.weekly_value,
              due_date: dateStr,
              status,
              reminder_sent_count: 0
            });

            // Gerar PIX inline para o novo pagamento
            const pixResult = await this.abacatePayService.createPixQrCode({
              amount: rental.weekly_value,
              description: `Aluguel - ${subscriber.name} - ${dateStr}`,
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
              // Garantir URL do QR: upload do Supabase ou qrserver.com como fallback
              const finalQrUrl = qrCodeUrl || buildQrCodeUrl(pixResult.pixBrCode);
              await this.paymentRepo.update(created.id, {
                abacate_pix_id: pixResult.abacatePixId,
                pix_br_code: pixResult.pixBrCode,
                pix_expires_at: pixResult.pixExpiresAt,
                pix_qr_code_url: finalQrUrl
              });

              if (status === 'Pendente') {
                try {
                  await this.notificationService.sendPaymentNotification({
                    subscriberName: subscriber.name,
                    subscriberPhone: subscriber.phone,
                    subscriberEmail: subscriber.email,
                    paymentAmount: rental.weekly_value,
                    paymentDueDate: dateStr,
                    totalDebt: rental.weekly_value,
                    pixBrCode: pixResult.pixBrCode,
                    pixQrCodeUrl: finalQrUrl,
                    pixQrCodeBase64: pixResult.pixQrCodeBase64,
                    pixPaymentUrl: finalQrUrl
                  });
                } catch (err) {
                  console.error(`[CRON] Erro ao notificar pagamento ${created.id}:`, err);
                }
              }
            }

            console.log(`[CRON] Rental ${rental.id}: nova cobrança R$${rental.weekly_value} (${status}), vence ${dateStr}`);
            totalCreated++;
          }

          cursor.setDate(cursor.getDate() + 7);
        }
      } catch (err) {
        console.error(`[CRON] Erro ao processar rental ${rental.id}:`, err);
      }
    }

    if (totalCreated === 0) {
      console.log('[CRON] Nenhum pagamento precisou ser gerado');
    } else {
      console.log(`[CRON] Total de novos pagamentos criados: ${totalCreated}`);
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
            pix_qr_code_url: qrCodeUrl || buildQrCodeUrl(pixResult.pixBrCode)
          });
          console.log(`[CRON] PIX regenerado para pagamento ${payment.id} (${payment.status})`);
        }
      } catch (err) {
        console.error(`[CRON] Erro ao regenerar PIX para ${payment.id}:`, err);
      }
    }
  }

  // Gerar pagamentos para um rental específico (usado ao criar novo contrato)
  // Modelo individual: 1 cobrança por semana
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
    const todayStr = toDateStr(today);

    // Lookahead: até 7 dias no futuro, respeitando end_date
    const lookaheadDate = new Date(today);
    lookaheadDate.setDate(lookaheadDate.getDate() + 7);

    let maxDate = lookaheadDate;
    if (rental.end_date) {
      const endDate = new Date(rental.end_date);
      if (endDate < lookaheadDate) maxDate = endDate;
    }

    // Âncora no primeiro vencimento correto (dia da semana)
    const firstDue = getFirstDueDate(rental.start_date, rental.due_day_of_week);
    console.log(`[PAYMENT GEN] start_date=${rental.start_date} | due_day_of_week=${rental.due_day_of_week} | isoToJsDay=${isoToJsDay(rental.due_day_of_week)} | firstDue=${firstDue.toISOString().split('T')[0]}`);

    const lastCoveredDate = new Date(firstDue);
    lastCoveredDate.setDate(lastCoveredDate.getDate() - 7);

    let created = 0;
    const cursor = new Date(lastCoveredDate);
    cursor.setDate(cursor.getDate() + 7);

    while (cursor <= maxDate) {
      const dateStr = toDateStr(cursor);

      const exists = await this.paymentRepo.existsByRentalAndDate(rental.id, dateStr);
      if (!exists) {
        const status = dateStr < todayStr ? 'Atrasado' : 'Pendente';

        const payment = await this.paymentRepo.create({
          rental_id: rental.id,
          subscriber_name: subscriber.name,
          amount: rental.weekly_value,
          expected_amount: rental.weekly_value,
          due_date: dateStr,
          status,
          reminder_sent_count: 0
        });

        const pixResult = await this.abacatePayService.createPixQrCode({
          amount: rental.weekly_value,
          description: `Aluguel - ${subscriber.name} - ${dateStr}`,
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
              console.warn(`[PAYMENT GEN] Falha ao fazer upload do QR Code para ${payment.id}:`, uploadErr);
            }
          }
          await this.paymentRepo.update(payment.id, {
            abacate_pix_id: pixResult.abacatePixId,
            pix_br_code: pixResult.pixBrCode,
            pix_expires_at: pixResult.pixExpiresAt,
            pix_qr_code_url: qrCodeUrl || buildQrCodeUrl(pixResult.pixBrCode)
          });
        }

        console.log(`[PAYMENT GEN] Cobrança criada: R$${rental.weekly_value} (${status}), vence ${dateStr}`);
        created++;
      }

      cursor.setDate(cursor.getDate() + 7);
    }

    if (created === 0) {
      console.log(`[PAYMENT GEN] Nenhuma data a cobrar para rental ${rentalId}`);
    }

    return created;
  }

  private async backfillMissingQrUrls(): Promise<void> {
    console.log('[CRON] STEP 1.6: Preenchendo pix_payment_url ausentes...');

    const payments = await this.paymentRepo.findActiveWithoutQrUrl();

    if (payments.length === 0) {
      console.log('[CRON] Nenhum pagamento ativo sem URL do QR Code');
      return;
    }

    console.log(`[CRON] ${payments.length} pagamento(s) com pix_br_code mas sem pix_payment_url`);

    for (const payment of payments) {
      try {
        const qrUrl = buildQrCodeUrl(payment.pix_br_code!);
        await this.paymentRepo.update(payment.id, { pix_qr_code_url: qrUrl });
        console.log(`[CRON] pix_qr_code_url preenchida para pagamento ${payment.id}`);
      } catch (err) {
        console.error(`[CRON] Erro ao preencher QR URL para ${payment.id}:`, err);
      }
    }
  }

  async sendUpcomingPaymentReminders(): Promise<void> {
    const reminderDaysBefore = parseInt(process.env.REMINDER_DAYS_BEFORE || '1');
    console.log(`[CRON] STEP 3: Enviando lembretes de vencimento (${reminderDaysBefore} dia(s) antes)...`);

    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + reminderDaysBefore);
    const targetDate = toDateStr(target);

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
          pixQrCodeUrl: payment.pix_qr_code_url ?? undefined,
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
            pix_qr_code_url: qrCodeUrl || buildQrCodeUrl(pixResult.pixBrCode)
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
