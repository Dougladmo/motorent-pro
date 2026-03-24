jest.mock('../../config/supabase', () => ({
  getSupabaseClient: () => {
    const { getMockClient } = require('../helpers/sqlite-client');
    return getMockClient();
  }
}));

import { MotorcycleRepository } from '../../repositories/motorcycleRepository';
import { MotorcycleService } from '../../services/motorcycleService';
import { getDb, resetDb } from '../helpers/sqlite-client';
import { SeedData, seedDb } from '../helpers/seed';

let seedData: SeedData;
let service: MotorcycleService;

beforeEach(() => {
  resetDb();
  seedData = seedDb(getDb());
  const repo = new MotorcycleRepository();
  service = new MotorcycleService(repo);
});

describe('MotorcycleService', () => {
  describe('getAllMotorcycles', () => {
    it('returns all motorcycles from seed', async () => {
      const motos = await service.getAllMotorcycles();
      expect(motos).toHaveLength(3);
      const plates = motos.map(m => m.plate);
      expect(plates).toContain('ABC1D23');
      expect(plates).toContain('XYZ9E87');
      expect(plates).toContain('QQQ3F33');
    });
  });

  describe('getMotorcycleById', () => {
    it('returns the motorcycle when found', async () => {
      const moto = await service.getMotorcycleById(seedData.moto1Id);
      expect(moto).not.toBeNull();
      expect(moto!.plate).toBe('ABC1D23');
      expect(moto!.model).toBe('Honda CG 160');
    });

    it('returns null for non-existent id', async () => {
      const moto = await service.getMotorcycleById('non-existent-id');
      expect(moto).toBeNull();
    });
  });

  describe('getMotorcyclesByStatus', () => {
    it('returns only disponivel motorcycles', async () => {
      const motos = await service.getMotorcyclesByStatus('Disponível');
      expect(motos).toHaveLength(2);
      motos.forEach(m => expect(m.status).toBe('Disponível'));
    });

    it('returns only alugada motorcycles', async () => {
      const motos = await service.getMotorcyclesByStatus('Alugada');
      expect(motos).toHaveLength(1);
      expect(motos[0].plate).toBe('XYZ9E87');
    });
  });

  describe('createMotorcycle', () => {
    it('creates a new motorcycle successfully', async () => {
      const created = await service.createMotorcycle({
        plate: 'NEW1A11',
        chassi: '9BWZZZ377VT999999',
        renavam: '99999999999',
        model: 'Honda Pop 110',
        year: 2023,
        status: 'Disponível'
      });

      expect(created.id).toBeDefined();
      expect(created.plate).toBe('NEW1A11');
      expect(created.model).toBe('Honda Pop 110');
    });

    it('throws when plate already exists', async () => {
      await expect(
        service.createMotorcycle({
          plate: 'ABC1D23',
          chassi: '9BWZZZ377VT888888',
          renavam: '88888888888',
          model: 'Honda CG 160',
          year: 2022
        })
      ).rejects.toThrow('ABC1D23');
    });

    it('throws when plate is not provided', async () => {
      await expect(
        service.createMotorcycle({
          plate: '',
          chassi: '9BWZZZ377VT777777',
          renavam: '77777777777',
          model: 'Honda Pop 110',
          year: 2023
        })
      ).rejects.toThrow('obrigatória');
    });

    it('throws when model is not provided', async () => {
      await expect(
        service.createMotorcycle({
          plate: 'ZZZ9Z99',
          chassi: '9BWZZZ377VT666666',
          renavam: '66666666666',
          model: '',
          year: 2023
        })
      ).rejects.toThrow('obrigatório');
    });
  });

  describe('updateMotorcycle', () => {
    it('updates motorcycle fields', async () => {
      const updated = await service.updateMotorcycle(seedData.moto1Id, {
        model: 'Honda CG 160 Titan',
        year: 2023
      });
      expect(updated.model).toBe('Honda CG 160 Titan');
      expect(updated.year).toBe(2023);
      expect(updated.plate).toBe('ABC1D23');
    });

    it('throws when motorcycle does not exist', async () => {
      await expect(
        service.updateMotorcycle('non-existent-id', { model: 'Test' })
      ).rejects.toThrow('não encontrada');
    });

    it('throws when updating to a duplicate plate', async () => {
      await expect(
        service.updateMotorcycle(seedData.moto1Id, { plate: 'XYZ9E87' })
      ).rejects.toThrow('XYZ9E87');
    });

    it('does not throw when updating with own plate', async () => {
      const updated = await service.updateMotorcycle(seedData.moto1Id, {
        plate: 'ABC1D23',
        model: 'Honda CG 160 Atualizada'
      });
      expect(updated.plate).toBe('ABC1D23');
      expect(updated.model).toBe('Honda CG 160 Atualizada');
    });
  });

  describe('deleteMotorcycle', () => {
    it('deletes motorcycle and cascades to rentals and payments', async () => {
      // moto2 has rental1 which has payment1 and payment2
      await service.deleteMotorcycle(seedData.moto2Id);

      // Verify motorcycle is gone
      const moto = await service.getMotorcycleById(seedData.moto2Id);
      expect(moto).toBeNull();

      // Verify rentals were deleted (check via raw DB)
      const db = getDb();
      const rentals = db.prepare('SELECT * FROM rentals WHERE id = ?').all(seedData.rental1Id);
      expect(rentals).toHaveLength(0);

      // Verify payments were deleted
      const payments = db.prepare('SELECT * FROM payments WHERE rental_id = ?').all(seedData.rental1Id);
      expect(payments).toHaveLength(0);
    });

    it('throws when motorcycle does not exist', async () => {
      await expect(service.deleteMotorcycle('non-existent-id')).rejects.toThrow('não encontrada');
    });

    it('does not delete subscribers when cascading', async () => {
      // moto2 has rental1 linked to sub1; after deleting moto2, both sub1 and sub2 must still exist
      await service.deleteMotorcycle(seedData.moto2Id);

      const db = getDb();
      const subs = db.prepare('SELECT id FROM subscribers').all() as { id: string }[];
      const subIds = subs.map(s => s.id);
      expect(subIds).toContain(seedData.sub1Id);
      expect(subIds).toContain(seedData.sub2Id);
    });
  });
});
