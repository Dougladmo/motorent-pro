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
    uploadSubscriberDocument: jest.fn().mockResolvedValue('http://mock-url/doc.pdf'),
    deleteSubscriberDocument: jest.fn().mockResolvedValue(undefined),
    uploadQrCodeToStorage: jest.fn().mockResolvedValue('http://mock-url/qr.png'),
  }))
}));

import { SubscriberRepository } from '../../repositories/subscriberRepository';
import { SubscriberService } from '../../services/subscriberService';
import { getDb, resetDb } from '../helpers/sqlite-client';
import { SeedData, seedDb } from '../helpers/seed';

let seedData: SeedData;
let service: SubscriberService;

beforeEach(() => {
  resetDb();
  seedData = seedDb(getDb());
  const repo = new SubscriberRepository();
  service = new SubscriberService(repo);
});

describe('SubscriberService', () => {
  describe('getAllSubscribers', () => {
    it('returns all subscribers', async () => {
      const subs = await service.getAllSubscribers();
      expect(subs).toHaveLength(2);
    });
  });

  describe('getActiveSubscribers', () => {
    it('returns only active subscribers', async () => {
      // Mark sub2 as inactive directly in DB
      const db = getDb();
      db.prepare('UPDATE subscribers SET active = 0 WHERE id = ?').run(seedData.sub2Id);

      const active = await service.getActiveSubscribers();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(seedData.sub1Id);
    });

    it('returns all when all are active', async () => {
      const active = await service.getActiveSubscribers();
      expect(active).toHaveLength(2);
      active.forEach(s => expect(s.active).toBe(true));
    });
  });

  describe('getSubscriberById', () => {
    it('returns subscriber when found', async () => {
      const sub = await service.getSubscriberById(seedData.sub1Id);
      expect(sub).not.toBeNull();
      expect(sub!.name).toBe('João Silva');
      expect(sub!.active).toBe(true);
    });

    it('returns null for non-existent id', async () => {
      const sub = await service.getSubscriberById('non-existent-id');
      expect(sub).toBeNull();
    });
  });

  describe('createSubscriber', () => {
    it('creates a new subscriber successfully', async () => {
      const created = await service.createSubscriber({
        name: 'Pedro Costa',
        phone: '11999990003',
        email: 'pedro@test.com',
        document: '33333333333'
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Pedro Costa');
      expect(created.document).toBe('33333333333');
      expect(created.active).toBe(true);
    });

    it('throws when document already exists', async () => {
      await expect(
        service.createSubscriber({
          name: 'Outro João',
          phone: '11999990099',
          document: '11111111111'
        })
      ).rejects.toThrow('11111111111');
    });

    it('throws when phone already exists', async () => {
      await expect(
        service.createSubscriber({
          name: 'Novo Assinante',
          phone: '11999990001',
          document: '99999999999'
        })
      ).rejects.toThrow('WhatsApp');
    });

    it('throws when email already exists', async () => {
      await expect(
        service.createSubscriber({
          name: 'Novo Assinante',
          phone: '11999990099',
          email: 'joao@test.com',
          document: '99999999999'
        })
      ).rejects.toThrow('joao@test.com');
    });

    it('creates subscriber with full address fields', async () => {
      const created = await service.createSubscriber({
        name: 'Carlos Rua',
        phone: '11999990005',
        document: '55555555555',
        address_zip: '01310-100',
        address_street: 'Av. Paulista',
        address_number: '1000',
        address_complement: 'Apto 10',
        address_neighborhood: 'Bela Vista',
        address_city: 'São Paulo',
        address_state: 'SP'
      });

      expect(created.address_zip).toBe('01310-100');
      expect(created.address_street).toBe('Av. Paulista');
      expect(created.address_city).toBe('São Paulo');
      expect(created.address_state).toBe('SP');
    });

    it('creates subscriber with is_real_driver false and real driver data', async () => {
      const created = await service.createSubscriber({
        name: 'Locatário Empresa',
        phone: '11999990006',
        document: '66666666666',
        is_real_driver: false,
        real_driver_name: 'Motorista Real',
        real_driver_document: '77777777777',
        real_driver_phone: '11999990007',
        real_driver_relationship: 'Funcionário'
      });

      expect(created.is_real_driver).toBe(false);
      expect(created.real_driver_name).toBe('Motorista Real');
      expect(created.real_driver_document).toBe('77777777777');
      expect(created.real_driver_relationship).toBe('Funcionário');
    });
  });

  describe('updateSubscriber', () => {
    it('updates subscriber fields', async () => {
      const updated = await service.updateSubscriber(seedData.sub1Id, {
        name: 'João Silva Atualizado',
        phone: '11988880001'
      });
      expect(updated.name).toBe('João Silva Atualizado');
      expect(updated.phone).toBe('11988880001');
    });

    it('throws when subscriber does not exist', async () => {
      await expect(
        service.updateSubscriber('non-existent-id', { name: 'Test' })
      ).rejects.toThrow('não encontrado');
    });

    it('throws when updating to a duplicate document', async () => {
      await expect(
        service.updateSubscriber(seedData.sub1Id, { document: '22222222222' })
      ).rejects.toThrow('22222222222');
    });

    it('updates address fields correctly', async () => {
      const updated = await service.updateSubscriber(seedData.sub1Id, {
        address_zip: '04001-001',
        address_street: 'Rua das Flores',
        address_city: 'São Paulo',
        address_state: 'SP'
      });
      expect(updated.address_zip).toBe('04001-001');
      expect(updated.address_street).toBe('Rua das Flores');
      expect(updated.address_city).toBe('São Paulo');
    });

    it('throws when updating to a phone already owned by another subscriber', async () => {
      await expect(
        service.updateSubscriber(seedData.sub1Id, { phone: '11999990002' })
      ).rejects.toThrow('WhatsApp');
    });

    it('throws when updating to an email already owned by another subscriber', async () => {
      await expect(
        service.updateSubscriber(seedData.sub1Id, { email: 'maria@test.com' })
      ).rejects.toThrow('maria@test.com');
    });

    it('does not throw when updating with own phone', async () => {
      const updated = await service.updateSubscriber(seedData.sub1Id, {
        phone: '11999990001',
        name: 'João Mesmo Fone'
      });
      expect(updated.phone).toBe('11999990001');
      expect(updated.name).toBe('João Mesmo Fone');
    });

    it('does not throw when updating with own email', async () => {
      const updated = await service.updateSubscriber(seedData.sub1Id, {
        email: 'joao@test.com',
        name: 'João Mesmo Email'
      });
      expect(updated.email).toBe('joao@test.com');
      expect(updated.name).toBe('João Mesmo Email');
    });
  });

  describe('deleteSubscriber', () => {
    it('cascades and deletes rentals and payments with subscriber', async () => {
      // sub1 has rental1 and payments
      await service.deleteSubscriber(seedData.sub1Id);

      const sub = await service.getSubscriberById(seedData.sub1Id);
      expect(sub).toBeNull();

      const db = getDb();
      const rentals = db.prepare('SELECT * FROM rentals WHERE subscriber_id = ?').all(seedData.sub1Id);
      expect(rentals).toHaveLength(0);

      const payments = db.prepare('SELECT * FROM payments WHERE rental_id = ?').all(seedData.rental1Id);
      expect(payments).toHaveLength(0);
    });

    it('throws when subscriber does not exist', async () => {
      await expect(service.deleteSubscriber('non-existent-id')).rejects.toThrow('não encontrado');
    });
  });
});
