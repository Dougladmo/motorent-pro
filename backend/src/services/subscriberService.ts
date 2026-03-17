import { SubscriberRepository } from '../repositories/subscriberRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { PaymentRepository } from '../repositories/paymentRepository';
import { SubscriberDocumentRepository } from '../repositories/subscriberDocumentRepository';
import { UploadService } from './uploadService';
import { Database } from '../models/database.types';

type Subscriber = Database['public']['Tables']['subscribers']['Row'];
type SubscriberInsert = Database['public']['Tables']['subscribers']['Insert'];
type SubscriberUpdate = Database['public']['Tables']['subscribers']['Update'];

export class SubscriberService {
  private rentalRepo = new RentalRepository();
  private paymentRepo = new PaymentRepository();
  private documentRepo = new SubscriberDocumentRepository();
  private uploadService = new UploadService();

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

    // Deleção em cascata: documentos do storage → pagamentos → aluguéis → assinante
    const documents = await this.documentRepo.findBySubscriberId(id);
    for (const doc of documents) {
      await this.uploadService.deleteSubscriberDocument(doc.file_url);
    }

    const rentals = await this.rentalRepo.findBySubscriberId(id);
    for (const rental of rentals) {
      await this.paymentRepo.deleteByRentalId(rental.id);
    }
    for (const rental of rentals) {
      await this.rentalRepo.delete(rental.id);
    }

    return this.subscriberRepo.delete(id);
  }
}
