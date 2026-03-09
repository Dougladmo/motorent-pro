jest.mock('../../config/supabase', () => ({
  getSupabaseClient: () => {
    const { getMockClient } = require('../helpers/sqlite-client');
    return getMockClient();
  }
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
