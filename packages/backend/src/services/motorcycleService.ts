import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { Database } from '@motorent/shared';

type Motorcycle = Database['public']['Tables']['motorcycles']['Row'];
type MotorcycleInsert = Database['public']['Tables']['motorcycles']['Insert'];
type MotorcycleUpdate = Database['public']['Tables']['motorcycles']['Update'];

export class MotorcycleService {
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
    // Validar se placa já existe
    if (data.plate) {
      const existing = await this.motorcycleRepo.findByPlate(data.plate);
      if (existing) {
        throw new Error(`Já existe uma moto com a placa ${data.plate}`);
      }
    }

    return this.motorcycleRepo.create(data);
  }

  async updateMotorcycle(id: string, updates: MotorcycleUpdate): Promise<Motorcycle> {
    const motorcycle = await this.motorcycleRepo.findById(id);
    if (!motorcycle) {
      throw new Error('Moto não encontrada');
    }

    // Validar se nova placa já está em uso
    if (updates.plate && updates.plate !== motorcycle.plate) {
      const existing = await this.motorcycleRepo.findByPlate(updates.plate);
      if (existing) {
        throw new Error(`Já existe uma moto com a placa ${updates.plate}`);
      }
    }

    return this.motorcycleRepo.update(id, updates);
  }

  async deleteMotorcycle(id: string): Promise<void> {
    const motorcycle = await this.motorcycleRepo.findById(id);
    if (!motorcycle) {
      throw new Error('Moto não encontrada');
    }

    // Verificar se está alugada
    if (motorcycle.status === 'Alugada') {
      throw new Error('Não é possível deletar uma moto que está alugada');
    }

    return this.motorcycleRepo.delete(id);
  }
}
