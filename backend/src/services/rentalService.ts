import { RentalRepository } from '../repositories/rentalRepository';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { PaymentRepository } from '../repositories/paymentRepository';
import { Database } from '../models/database.types';

type Rental = Database['public']['Tables']['rentals']['Row'];
type RentalInsert = Database['public']['Tables']['rentals']['Insert'];
type RentalUpdate = Database['public']['Tables']['rentals']['Update'];

export class RentalService {
  constructor(
    private rentalRepo: RentalRepository,
    private motorcycleRepo: MotorcycleRepository,
    private subscriberRepo: SubscriberRepository,
    private paymentRepo: PaymentRepository
  ) {}

  private async triggerWorkerPaymentGeneration(rentalId: string): Promise<void> {
    const workerUrl = process.env.WORKER_URL || 'http://localhost:3002';
    try {
      const response = await fetch(`${workerUrl}/trigger/rental/${rentalId}`, {
        method: 'POST'
      });
      if (response.ok) {
        const json = await response.json() as { paymentsCreated?: number };
        console.log(`[RentalService] Worker gerou ${json.paymentsCreated ?? 0} pagamentos para o contrato ${rentalId}`);
      } else {
        console.warn(`[RentalService] Worker retornou status ${response.status} para rental ${rentalId}`);
      }
    } catch (err) {
      console.warn(`[RentalService] Worker indisponível para rental ${rentalId}, pagamentos serão gerados no próximo ciclo do cron:`, err);
    }
  }

  async getAllRentals(): Promise<Rental[]> {
    const rentals = await this.rentalRepo.findAll();
    return this.recalculateOutstandingBalances(rentals);
  }

  async getActiveRentals(): Promise<Rental[]> {
    const rentals = await this.rentalRepo.findAllActive();
    return this.recalculateOutstandingBalances(rentals);
  }

  private async recalculateOutstandingBalances(rentals: Rental[]): Promise<Rental[]> {
    const result: Rental[] = [];
    const allPayments = await this.paymentRepo.findAll();

    for (const rental of rentals) {
      let totalContractValue = rental.total_contract_value ?? 0;
      let needsUpdate = false;

      // Calcular total_contract_value se não estiver salvo e houver end_date
      if (totalContractValue === 0 && rental.end_date) {
        const [sy, sm, sd] = rental.start_date.split('-').map(Number);
        const [ey, em, ed] = rental.end_date.split('-').map(Number);
        const startDate = new Date(sy, sm - 1, sd);
        const endDate = new Date(ey, em - 1, ed);
        const totalWeeks = Math.round(
          (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        totalContractValue = totalWeeks * rental.weekly_value;
        needsUpdate = true;
        console.log(`[RentalService] rental ${rental.id}: calculated total_contract_value=${totalContractValue} (${totalWeeks} weeks)`);
      }

      const totalPaid = rental.total_paid ?? 0;
      let computedOutstanding: number;

      if (totalContractValue > 0) {
        // Contrato com prazo definido: pendente = total do contrato - pago
        computedOutstanding = Math.max(0, totalContractValue - totalPaid);
      } else {
        // Contrato sem prazo (end_date null): pendente = pagamentos PENDENTE/ATRASADO no BD
        const rentalPayments = allPayments.filter(p => p.rental_id === rental.id);
        computedOutstanding = rentalPayments
          .filter(p => p.status === 'Pendente' || p.status === 'Atrasado')
          .reduce((sum, p) => sum + p.amount, 0);
      }

      if (needsUpdate || computedOutstanding !== (rental.outstanding_balance ?? 0)) {
        const updated = await this.rentalRepo.update(rental.id, {
          total_contract_value: totalContractValue,
          outstanding_balance: computedOutstanding
        });
        result.push(updated);
      } else {
        result.push(rental);
      }
    }

    return result;
  }

  async getRentalById(id: string): Promise<Rental | null> {
    return this.rentalRepo.findById(id);
  }

  async getRentalsByMotorcycleId(motorcycleId: string): Promise<Rental[]> {
    return this.rentalRepo.findByMotorcycleId(motorcycleId);
  }

  async getRentalsBySubscriberId(subscriberId: string): Promise<Rental[]> {
    return this.rentalRepo.findBySubscriberId(subscriberId);
  }

  async createRental(data: RentalInsert): Promise<Rental> {
    // Validar se moto existe e está disponível
    const motorcycle = await this.motorcycleRepo.findById(data.motorcycle_id);
    if (!motorcycle) {
      throw new Error('Moto não encontrada');
    }

    if (motorcycle.status !== 'Disponível') {
      throw new Error(`Moto não está disponível. Status atual: ${motorcycle.status}`);
    }

    // Verificar se já existe aluguel ativo para esta moto
    const activeRental = await this.rentalRepo.findActiveByMotorcycleId(data.motorcycle_id);
    if (activeRental) {
      throw new Error('Esta moto já possui um aluguel ativo');
    }

    // Validar se assinante existe
    const subscriber = await this.subscriberRepo.findById(data.subscriber_id);
    if (!subscriber) {
      throw new Error('Assinante não encontrado');
    }

    // Calcular valor total do contrato
    const startDate = new Date(data.start_date);
    const endDate = data.end_date ? new Date(data.end_date) : null;
    const totalWeeks = endDate
      ? Math.round((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 0;
    const totalContractValue = totalWeeks * data.weekly_value;

    // Criar aluguel
    const rental = await this.rentalRepo.create({
      ...data,
      total_contract_value: totalContractValue,
      total_paid: 0
    });

    // Atualizar status da moto
    await this.motorcycleRepo.update(data.motorcycle_id, {
      status: 'Alugada'
    });

    console.log(`[RentalService] Aluguel ${rental.id} criado. Moto ${motorcycle.plate} agora está alugada.`);

    // Disparar geração de pagamentos no worker (não-bloqueante)
    await this.triggerWorkerPaymentGeneration(rental.id);

    return rental;
  }

  async updateRental(id: string, updates: RentalUpdate): Promise<Rental> {
    const rental = await this.rentalRepo.findById(id);
    if (!rental) {
      throw new Error('Aluguel não encontrado');
    }

    // Se estiver finalizando o aluguel, liberar a moto
    if (updates.is_active === false && rental.is_active === true) {
      await this.motorcycleRepo.update(rental.motorcycle_id, {
        status: 'Disponível'
      });
      console.log(`[RentalService] Aluguel ${id} finalizado. Moto liberada.`);
    }

    return this.rentalRepo.update(id, updates);
  }

  async deleteRental(id: string): Promise<void> {
    const rental = await this.rentalRepo.findById(id);
    if (!rental) {
      throw new Error('Aluguel não encontrado');
    }

    // Liberar moto se estava alugada
    if (rental.is_active) {
      await this.motorcycleRepo.update(rental.motorcycle_id, {
        status: 'Disponível'
      });
    }

    return this.rentalRepo.delete(id);
  }

  async terminateRental(id: string, reason: string): Promise<Rental> {
    const rental = await this.rentalRepo.findById(id);
    if (!rental) {
      throw new Error('Aluguel não encontrado');
    }

    if (!rental.is_active) {
      throw new Error('Aluguel já está inativo');
    }

    const now = new Date().toISOString();

    // 1. Marcar aluguel como inativo
    const updatedRental = await this.rentalRepo.update(id, {
      is_active: false,
      terminated_at: now,
      termination_reason: reason,
      end_date: now.split('T')[0] // Data de hoje como data de término
    });

    // 2. Liberar moto
    await this.motorcycleRepo.update(rental.motorcycle_id, {
      status: 'Disponível'
    });

    // 3. Cancelar todos os pagamentos futuros (Pendente ou Atrasado)
    const futurePayments = await this.paymentRepo.findFutureByRentalId(id);
    const paymentIds = futurePayments
      .filter(p => p.status === 'Pendente' || p.status === 'Atrasado')
      .map(p => p.id);

    if (paymentIds.length > 0) {
      await this.paymentRepo.updateMany(paymentIds, { status: 'Cancelado' });
      console.log(`[RentalService] ${paymentIds.length} pagamentos futuros cancelados`);
    }

    console.log(`[RentalService] Aluguel ${id} rescindido. Motivo: ${reason}`);

    return updatedRental;
  }
}
