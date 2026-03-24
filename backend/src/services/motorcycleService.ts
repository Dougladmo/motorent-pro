import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { PaymentRepository } from '../repositories/paymentRepository';
import { Database } from '../models/database.types';

type Motorcycle = Database['public']['Tables']['motorcycles']['Row'];
type MotorcycleInsert = Database['public']['Tables']['motorcycles']['Insert'];
type MotorcycleUpdate = Database['public']['Tables']['motorcycles']['Update'];

export class MotorcycleService {
  private rentalRepo = new RentalRepository();
  private paymentRepo = new PaymentRepository();

  constructor(private motorcycleRepo: MotorcycleRepository) {}

  async getAllMotorcycles(): Promise<Motorcycle[]> {
    return this.motorcycleRepo.findAll();
  }

  async getMotorcycleById(id: string): Promise<Motorcycle | null> {
    return this.motorcycleRepo.findById(id);
  }

  async getMotorcyclesByStatus(status: string): Promise<Motorcycle[]> {
    return this.motorcycleRepo.findByStatus(status);
  }

  async createMotorcycle(data: MotorcycleInsert): Promise<Motorcycle> {
    if (!data.plate) throw new Error('Placa da moto é obrigatória.');
    if (!data.model) throw new Error('Modelo da moto é obrigatório.');

    const existing = await this.motorcycleRepo.findByPlate(data.plate);
    if (existing) {
      throw new Error(`Placa "${data.plate}" já está cadastrada para outra moto (${existing.model}).`);
    }

    return this.motorcycleRepo.create(data);
  }

  async updateMotorcycle(id: string, updates: MotorcycleUpdate): Promise<Motorcycle> {
    const motorcycle = await this.motorcycleRepo.findById(id);
    if (!motorcycle) {
      throw new Error('Moto não encontrada.');
    }

    if (updates.plate && updates.plate !== motorcycle.plate) {
      const existing = await this.motorcycleRepo.findByPlate(updates.plate);
      if (existing) {
        throw new Error(`Placa "${updates.plate}" já está cadastrada para outra moto (${existing.model}).`);
      }
    }

    return this.motorcycleRepo.update(id, updates);
  }

  async deleteMotorcycle(id: string): Promise<void> {
    const motorcycle = await this.motorcycleRepo.findById(id);
    if (!motorcycle) {
      throw new Error('Moto não encontrada.');
    }

    // Deleção em cascata: pagamentos → aluguéis → moto
    const rentals = await this.rentalRepo.findByMotorcycleId(id);
    for (const rental of rentals) {
      await this.paymentRepo.deleteByRentalId(rental.id);
    }
    for (const rental of rentals) {
      await this.rentalRepo.delete(rental.id);
    }

    return this.motorcycleRepo.delete(id);
  }
}
