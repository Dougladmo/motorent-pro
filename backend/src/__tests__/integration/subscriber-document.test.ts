const mockUploadSubscriberDocument = jest.fn().mockResolvedValue('http://mock-url/doc.pdf');
const mockDeleteSubscriberDocument = jest.fn().mockResolvedValue(undefined);

jest.mock('../../config/supabase', () => ({
  getSupabaseClient: () => {
    const { getMockClient } = require('../helpers/sqlite-client');
    return getMockClient();
  }
}));

jest.mock('../../services/uploadService', () => ({
  UploadService: jest.fn().mockImplementation(() => ({
    uploadMotorcycleImage: jest.fn().mockResolvedValue('http://mock-url/image.jpg'),
    deleteMotorcycleImage: jest.fn().mockResolvedValue(undefined),
    uploadSubscriberDocument: mockUploadSubscriberDocument,
    deleteSubscriberDocument: mockDeleteSubscriberDocument,
    uploadQrCodeToStorage: jest.fn().mockResolvedValue('http://mock-url/qr.png'),
  }))
}));

import { SubscriberDocumentRepository } from '../../repositories/subscriberDocumentRepository';
import { SubscriberDocumentService } from '../../services/subscriberDocumentService';
import { SubscriberRepository } from '../../repositories/subscriberRepository';
import { SubscriberService } from '../../services/subscriberService';
import { getDb, resetDb } from '../helpers/sqlite-client';
import { SeedData, seedDb } from '../helpers/seed';

let seedData: SeedData;
let docService: SubscriberDocumentService;
let subscriberService: SubscriberService;

beforeEach(() => {
  resetDb();
  seedData = seedDb(getDb());
  mockUploadSubscriberDocument.mockClear();
  mockDeleteSubscriberDocument.mockClear();

  const docRepo = new SubscriberDocumentRepository();
  docService = new SubscriberDocumentService(docRepo);

  const subscriberRepo = new SubscriberRepository();
  subscriberService = new SubscriberService(subscriberRepo);
});

describe('SubscriberDocumentService', () => {
  describe('getDocumentsBySubscriberId', () => {
    it('returns empty list when subscriber has no documents', async () => {
      const docs = await docService.getDocumentsBySubscriberId(seedData.sub2Id);
      expect(docs).toHaveLength(0);
    });

    it('returns documents for the correct subscriber', async () => {
      const docs = await docService.getDocumentsBySubscriberId(seedData.sub1Id);
      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe(seedData.doc1Id);
      expect(docs[0].file_name).toBe('contrato.pdf');
      expect(docs[0].file_type).toBe('contract');
    });

    it('does not mix documents between different subscribers', async () => {
      const docs1 = await docService.getDocumentsBySubscriberId(seedData.sub1Id);
      const docs2 = await docService.getDocumentsBySubscriberId(seedData.sub2Id);

      expect(docs1).toHaveLength(1);
      expect(docs2).toHaveLength(0);

      const ids1 = docs1.map(d => d.id);
      expect(ids1).not.toContain(seedData.sub2Id);
    });
  });

  describe('addDocument', () => {
    it('creates document with all correct fields', async () => {
      const buffer = Buffer.from('fake-pdf-content');
      const doc = await docService.addDocument(
        seedData.sub2Id,
        buffer,
        'application/pdf',
        'cnh.pdf',
        'cnh',
        'Carteira de habilitação'
      );

      expect(doc.id).toBeDefined();
      expect(doc.subscriber_id).toBe(seedData.sub2Id);
      expect(doc.file_name).toBe('cnh.pdf');
      expect(doc.file_type).toBe('cnh');
      expect(doc.description).toBe('Carteira de habilitação');
    });

    it('calls uploadSubscriberDocument with the correct arguments', async () => {
      const buffer = Buffer.from('fake-content');
      await docService.addDocument(
        seedData.sub2Id,
        buffer,
        'image/jpeg',
        'foto.jpg',
        'photo'
      );

      expect(mockUploadSubscriberDocument).toHaveBeenCalledTimes(1);
      expect(mockUploadSubscriberDocument).toHaveBeenCalledWith(buffer, 'image/jpeg', 'foto.jpg');
    });

    it('stores the URL returned by uploadService', async () => {
      mockUploadSubscriberDocument.mockResolvedValueOnce('http://storage/bucket/custom-url.pdf');

      const doc = await docService.addDocument(
        seedData.sub2Id,
        Buffer.from('x'),
        'application/pdf',
        'doc.pdf',
        'other'
      );

      expect(doc.file_url).toBe('http://storage/bucket/custom-url.pdf');
    });

    it('creates document without description (nullable field)', async () => {
      const doc = await docService.addDocument(
        seedData.sub2Id,
        Buffer.from('data'),
        'application/pdf',
        'sem-descricao.pdf',
        'other'
      );

      expect(doc.description).toBeNull();
    });

    it('supports all file_type values', async () => {
      const types: Array<'contract' | 'cnh' | 'photo' | 'other'> = ['contract', 'cnh', 'photo', 'other'];

      for (const fileType of types) {
        const doc = await docService.addDocument(
          seedData.sub2Id,
          Buffer.from('data'),
          'application/pdf',
          `${fileType}.pdf`,
          fileType
        );
        expect(doc.file_type).toBe(fileType);
      }
    });
  });

  describe('deleteDocument', () => {
    it('removes the document from the database and calls deleteSubscriberDocument', async () => {
      await docService.deleteDocument(seedData.doc1Id);

      expect(mockDeleteSubscriberDocument).toHaveBeenCalledTimes(1);
      expect(mockDeleteSubscriberDocument).toHaveBeenCalledWith('http://storage/doc1.pdf');

      const docs = await docService.getDocumentsBySubscriberId(seedData.sub1Id);
      expect(docs).toHaveLength(0);
    });

    it('throws when document does not exist', async () => {
      await expect(docService.deleteDocument('non-existent-doc-id')).rejects.toThrow('não encontrado');
    });
  });

  describe('deleteDocumentsBySubscriberId', () => {
    it('removes all documents and calls deleteSubscriberDocument for each', async () => {
      // Add a second document to sub1
      await docService.addDocument(
        seedData.sub1Id,
        Buffer.from('second'),
        'application/pdf',
        'segundo.pdf',
        'other'
      );

      mockDeleteSubscriberDocument.mockClear();

      await docService.deleteDocumentsBySubscriberId(seedData.sub1Id);

      expect(mockDeleteSubscriberDocument).toHaveBeenCalledTimes(2);

      const docs = await docService.getDocumentsBySubscriberId(seedData.sub1Id);
      expect(docs).toHaveLength(0);
    });

    it('does nothing when subscriber has no documents', async () => {
      await expect(
        docService.deleteDocumentsBySubscriberId(seedData.sub2Id)
      ).resolves.not.toThrow();

      expect(mockDeleteSubscriberDocument).not.toHaveBeenCalled();
    });
  });
});

describe('SubscriberService.deleteSubscriber (document cascade)', () => {
  it('deletes all subscriber documents from storage and database on subscriber deletion', async () => {
    // sub1 has doc1 in seed
    await subscriberService.deleteSubscriber(seedData.sub1Id);

    // Upload service should have been called to delete the document
    expect(mockDeleteSubscriberDocument).toHaveBeenCalledTimes(1);
    expect(mockDeleteSubscriberDocument).toHaveBeenCalledWith('http://storage/doc1.pdf');

    // Subscriber should be gone
    const sub = await subscriberService.getSubscriberById(seedData.sub1Id);
    expect(sub).toBeNull();

    // Documents should be gone
    const db = getDb();
    const docs = db.prepare('SELECT * FROM subscriber_documents WHERE subscriber_id = ?').all(seedData.sub1Id);
    expect(docs).toHaveLength(0);
  });
});
