import { SubscriberDocumentRepository } from '../repositories/subscriberDocumentRepository';
import { UploadService } from './uploadService';
import { Database } from '../models/database.types';

type SubscriberDocument = Database['public']['Tables']['subscriber_documents']['Row'];

export class SubscriberDocumentService {
  private uploadService = new UploadService();

  constructor(private documentRepo: SubscriberDocumentRepository) {}

  async getDocumentsBySubscriberId(subscriberId: string): Promise<SubscriberDocument[]> {
    return this.documentRepo.findBySubscriberId(subscriberId);
  }

  async addDocument(
    subscriberId: string,
    file: Buffer,
    mimeType: string,
    originalName: string,
    fileType: 'contract' | 'cnh' | 'photo' | 'other',
    description?: string
  ): Promise<SubscriberDocument> {
    const fileUrl = await this.uploadService.uploadSubscriberDocument(file, mimeType, originalName);

    return this.documentRepo.create({
      subscriber_id: subscriberId,
      file_name: originalName,
      file_url: fileUrl,
      file_type: fileType,
      description: description ?? null
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    const doc = await this.documentRepo.findById(documentId);
    if (!doc) throw new Error('Documento não encontrado');

    await this.uploadService.deleteSubscriberDocument(doc.file_url);
    await this.documentRepo.delete(documentId);
  }

  async deleteDocumentsBySubscriberId(subscriberId: string): Promise<void> {
    const docs = await this.documentRepo.findBySubscriberId(subscriberId);
    for (const doc of docs) {
      await this.uploadService.deleteSubscriberDocument(doc.file_url);
      await this.documentRepo.delete(doc.id);
    }
  }
}
