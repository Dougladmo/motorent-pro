jest.mock('../../config/supabase', () => ({
  getSupabaseClient: () => {
    const { getMockClient } = require('../helpers/sqlite-client');
    return getMockClient();
  }
}));

// Mock fetch globally to prevent real network calls to the worker
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ paymentsCreated: 1 })
} as unknown as Response);
global.fetch = mockFetch;

import { RentalRepository } from '../../repositories/rentalRepository';
import { MotorcycleRepository } from '../../repositories/motorcycleRepository';
import { SubscriberRepository } from '../../repositories/subscriberRepository';
import { PaymentRepository } from '../../repositories/paymentRepository';
import { RentalService } from '../../services/rentalService';
import { getDb, resetDb } from '../helpers/sqlite-client';
import { SeedData, seedDb } from '../helpers/seed';

let seedData: SeedData;
let service: RentalService;

beforeEach(() => {
  resetDb();
  seedData = seedDb(getDb());
  mockFetch.mockClear();

  const rentalRepo = new RentalRepository();
  const motorcycleRepo = new MotorcycleRepository();
  const subscriberRepo = new SubscriberRepository();
  const paymentRepo = new PaymentRepository();
  service = new RentalService(rentalRepo, motorcycleRepo, subscriberRepo, paymentRepo);
});

describe('RentalService', () => {
  describe('getAllRentals', () => {
    it('returns all rentals', async () => {
      const rentals = await service.getAllRentals();
      expect(rentals).toHaveLength(1);
    });
  });

  describe('getActiveRentals', () => {
    it('returns only active rentals', async () => {
      const active = await service.getActiveRentals();
      expect(active).toHaveLength(1);
      expect(active[0].is_active).toBe(true);
    });

    it('returns empty when no active rentals', async () => {
      const db = getDb();
      db.prepare('UPDATE rentals SET is_active = 0').run();
      const active = await service.getActiveRentals();
      expect(active).toHaveLength(0);
    });
  });

  describe('getRentalById', () => {
    it('returns rental when found', async () => {
      const rental = await service.getRentalById(seedData.rental1Id);
      expect(rental).not.toBeNull();
      expect(rental!.is_active).toBe(true);
      expect(rental!.weekly_value).toBe(300);
    });

    it('returns null for non-existent id', async () => {
      const rental = await service.getRentalById('non-existent-id');
      expect(rental).toBeNull();
    });
  });

  describe('createRental', () => {
    it('creates a rental, sets motorcycle status to Alugada, calls worker trigger', async () => {
      const rental = await service.createRental({
        motorcycle_id: seedData.moto1Id,
        subscriber_id: seedData.sub2Id,
        start_date: '2026-03-01',
        weekly_value: 250,
        due_day_of_week: 3
      });

      expect(rental.id).toBeDefined();
      expect(rental.motorcycle_id).toBe(seedData.moto1Id);
      expect(rental.subscriber_id).toBe(seedData.sub2Id);
      expect(rental.is_active).toBe(true);

      // Motorcycle status must be updated to Alugada
      const db = getDb();
      const moto = db.prepare('SELECT * FROM motorcycles WHERE id = ?').get(seedData.moto1Id) as { status: string } | undefined;
      expect(moto?.status).toBe('Alugada');

      // Worker fetch should have been called
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(rental.id),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('sets total_contract_value to 0 when no end_date is provided', async () => {
      const rental = await service.createRental({
        motorcycle_id: seedData.moto1Id,
        subscriber_id: seedData.sub2Id,
        start_date: '2026-03-01',
        weekly_value: 250,
        due_day_of_week: 3
        // no end_date
      });

      expect(rental.total_contract_value).toBe(0);
    });

    it('sets total_contract_value correctly when end_date is provided', async () => {
      // 4 weeks = 4 * 250 = 1000
      const rental = await service.createRental({
        motorcycle_id: seedData.moto1Id,
        subscriber_id: seedData.sub2Id,
        start_date: '2026-03-01',
        end_date: '2026-03-29',
        weekly_value: 250,
        due_day_of_week: 3
      });

      expect(rental.total_contract_value).toBe(1000);
    });

    it('throws when motorcycle does not exist', async () => {
      await expect(
        service.createRental({
          motorcycle_id: 'non-existent-id',
          subscriber_id: seedData.sub2Id,
          start_date: '2026-03-01',
          weekly_value: 250,
          due_day_of_week: 3
        })
      ).rejects.toThrow('não encontrada');
    });

    it('throws when motorcycle is not available', async () => {
      // moto2 is already Alugada
      await expect(
        service.createRental({
          motorcycle_id: seedData.moto2Id,
          subscriber_id: seedData.sub2Id,
          start_date: '2026-03-01',
          weekly_value: 300,
          due_day_of_week: 1
        })
      ).rejects.toThrow('disponível');
    });

    it('throws when subscriber does not exist', async () => {
      await expect(
        service.createRental({
          motorcycle_id: seedData.moto1Id,
          subscriber_id: 'non-existent-subscriber',
          start_date: '2026-03-01',
          weekly_value: 250,
          due_day_of_week: 3
        })
      ).rejects.toThrow('Assinante');
    });
  });

  describe('updateRental', () => {
    it('updates rental fields', async () => {
      const updated = await service.updateRental(seedData.rental1Id, {
        weekly_value: 350
      });
      expect(updated.weekly_value).toBe(350);
    });

    it('sets motorcycle to Disponivel when deactivating rental', async () => {
      await service.updateRental(seedData.rental1Id, { is_active: false });

      const db = getDb();
      const moto = db.prepare('SELECT * FROM motorcycles WHERE id = ?').get(seedData.moto2Id) as { status: string } | undefined;
      expect(moto?.status).toBe('Disponível');
    });
  });

  describe('deleteRental', () => {
    it('deletes rental and frees motorcycle', async () => {
      await service.deleteRental(seedData.rental1Id);

      const rental = await service.getRentalById(seedData.rental1Id);
      expect(rental).toBeNull();

      // Motorcycle freed
      const db = getDb();
      const moto = db.prepare('SELECT * FROM motorcycles WHERE id = ?').get(seedData.moto2Id) as { status: string } | undefined;
      expect(moto?.status).toBe('Disponível');
    });
  });

  describe('terminateRental', () => {
    it('marks rental inactive, frees motorcycle, cancels future payments', async () => {
      // payment1 is Pago (past), payment2 is Pendente (future)
      const terminated = await service.terminateRental(seedData.rental1Id, 'Teste de rescisão');

      expect(terminated.is_active).toBe(false);
      expect(terminated.termination_reason).toBe('Teste de rescisão');
      expect(terminated.terminated_at).toBeDefined();

      // Motorcycle should be freed
      const db = getDb();
      const moto = db.prepare('SELECT * FROM motorcycles WHERE id = ?').get(seedData.moto2Id) as { status: string } | undefined;
      expect(moto?.status).toBe('Disponível');

      // payment2 (Pendente) should be cancelled
      const p2 = db.prepare('SELECT * FROM payments WHERE id = ?').get(seedData.payment2Id) as { status: string } | undefined;
      expect(p2?.status).toBe('Cancelado');
    });

    it('throws when rental is already inactive', async () => {
      const db = getDb();
      db.prepare('UPDATE rentals SET is_active = 0 WHERE id = ?').run(seedData.rental1Id);

      await expect(
        service.terminateRental(seedData.rental1Id, 'motivo')
      ).rejects.toThrow('inativo');
    });

    it('throws when rental does not exist', async () => {
      await expect(
        service.terminateRental('non-existent-id', 'motivo')
      ).rejects.toThrow('não encontrado');
    });
  });
});
