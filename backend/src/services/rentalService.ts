import { RentalRepository } from '../repositories/rentalRepository';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { Database } from '../models/database.types';

type Rental = Database['public']['Tables']['rentals']['Row'];
type RentalInsert = Database['public']['Tables']['rentals']['Insert'];
type RentalUpdate = Database['public']['Tables']['rentals']['Update'];

export class RentalService {
  constructor(
    private rentalRepo: RentalRepository,
    private motorcycleRepo: MotorcycleRepository,
    private subscriberRepo: SubscriberRepository
  ) {}

  async getAllRentals(): Promise<Rental[]> {
    return this.rentalRepo.findAll();
  }

  async getActiveRentals(): Promise<Rental[]> {
    return this.rentalRepo.findAllActive();
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

    // Criar aluguel
    const rental = await this.rentalRepo.create(data);

    // Atualizar status da moto
    await this.motorcycleRepo.update(data.motorcycle_id, {
      status: 'Alugada'
    });

    console.log(`[RentalService] Aluguel ${rental.id} criado. Moto ${motorcycle.plate} agora está alugada.`);

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
}
