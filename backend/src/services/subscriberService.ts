import { SubscriberRepository } from '../repositories/subscriberRepository';
import { Database } from '../shared';

type Subscriber = Database['public']['Tables']['subscribers']['Row'];
type SubscriberInsert = Database['public']['Tables']['subscribers']['Insert'];
type SubscriberUpdate = Database['public']['Tables']['subscribers']['Update'];

export class SubscriberService {
  constructor(private subscriberRepo: SubscriberRepository) {}

  async getAllSubscribers(): Promise<Subscriber[]> {
    return this.subscriberRepo.findAll();
  }

  async getActiveSubscribers(): Promise<Subscriber[]> {
    return this.subscriberRepo.findActive();
  }

  async getSubscriberById(id: string): Promise<Subscriber | null> {
    return this.subscriberRepo.findById(id);
  }

  async createSubscriber(data: SubscriberInsert): Promise<Subscriber> {
    // Validar se CPF/CNPJ já existe
    if (data.document) {
      const existing = await this.subscriberRepo.findByDocument(data.document);
      if (existing) {
        throw new Error(`Já existe um assinante com o documento ${data.document}`);
      }
    }

    return this.subscriberRepo.create(data);
  }

  async updateSubscriber(id: string, updates: SubscriberUpdate): Promise<Subscriber> {
    const subscriber = await this.subscriberRepo.findById(id);
    if (!subscriber) {
      throw new Error('Assinante não encontrado');
    }

    // Validar se novo documento já está em uso
    if (updates.document && updates.document !== subscriber.document) {
      const existing = await this.subscriberRepo.findByDocument(updates.document);
      if (existing) {
        throw new Error(`Já existe um assinante com o documento ${updates.document}`);
      }
    }

    return this.subscriberRepo.update(id, updates);
  }

  async deleteSubscriber(id: string): Promise<void> {
    const subscriber = await this.subscriberRepo.findById(id);
    if (!subscriber) {
      throw new Error('Assinante não encontrado');
    }

    // Nota: validação de aluguéis ativos deve ser feita via constraint no banco
    return this.subscriberRepo.delete(id);
  }
}
