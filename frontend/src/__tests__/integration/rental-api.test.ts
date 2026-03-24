import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}));

vi.stubGlobal('window', { location: { href: '' } });

import api from '../../services/api';
import { rentalApi } from '../../services/api';

vi.spyOn(api, 'get').mockImplementation(vi.fn());
vi.spyOn(api, 'post').mockImplementation(vi.fn());
vi.spyOn(api, 'patch').mockImplementation(vi.fn());
vi.spyOn(api, 'delete').mockImplementation(vi.fn());

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockDelete = api.delete as ReturnType<typeof vi.fn>;

const fakeRental = {
  id: 'rental-1',
  motorcycle_id: 'moto-1',
  subscriber_id: 'sub-1',
  start_date: '2026-01-01',
  end_date: '2026-07-01',
  weekly_value: 300,
  due_day_of_week: 1,
  is_active: true,
  outstanding_balance: 0,
  total_contract_value: 7800,
  total_paid: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rentalApi', () => {
  describe('getAll', () => {
    it('chama GET /rentals e retorna array', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [fakeRental] } });
      const result = await rentalApi.getAll();
      expect(mockGet).toHaveBeenCalledWith('/rentals');
      expect(result).toEqual([fakeRental]);
    });
  });

  describe('getActive', () => {
    it('chama GET /rentals/active', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [fakeRental] } });
      const result = await rentalApi.getActive();
      expect(mockGet).toHaveBeenCalledWith('/rentals/active');
      expect(result).toEqual([fakeRental]);
    });
  });

  describe('getById', () => {
    it('chama GET /rentals/:id e retorna aluguel', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: fakeRental } });
      const result = await rentalApi.getById('rental-1');
      expect(mockGet).toHaveBeenCalledWith('/rentals/rental-1');
      expect(result).toEqual(fakeRental);
    });

    it('propaga erro 404', async () => {
      mockGet.mockRejectedValueOnce(new Error('Registro não encontrado.'));
      await expect(rentalApi.getById('inexistente')).rejects.toThrow('não encontrado');
    });
  });

  describe('getByMotorcycleId', () => {
    it('chama GET /rentals/motorcycle/:id', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [fakeRental] } });
      const result = await rentalApi.getByMotorcycleId('moto-1');
      expect(mockGet).toHaveBeenCalledWith('/rentals/motorcycle/moto-1');
      expect(result).toEqual([fakeRental]);
    });
  });

  describe('create', () => {
    it('chama POST /rentals com dados corretos', async () => {
      const payload = {
        motorcycle_id: 'moto-1',
        subscriber_id: 'sub-1',
        start_date: '2026-01-01',
        weekly_value: 300,
        due_day_of_week: 1,
      };
      mockPost.mockResolvedValueOnce({ data: { data: { id: 'rental-2', ...payload, is_active: true } } });
      const result = await rentalApi.create(payload);
      expect(mockPost).toHaveBeenCalledWith('/rentals', payload);
      expect(result.id).toBe('rental-2');
    });

    it('propaga erro moto não disponível', async () => {
      mockPost.mockRejectedValueOnce(new Error('Moto não está disponível'));
      await expect(rentalApi.create({ motorcycle_id: 'moto-rented' } as any))
        .rejects.toThrow('não está disponível');
    });

    it('propaga erro moto inexistente', async () => {
      mockPost.mockRejectedValueOnce(new Error('Moto não encontrada'));
      await expect(rentalApi.create({ motorcycle_id: 'inexistente' } as any))
        .rejects.toThrow('não encontrada');
    });

    it('propaga erro assinante inexistente', async () => {
      mockPost.mockRejectedValueOnce(new Error('Assinante não encontrado'));
      await expect(rentalApi.create({ subscriber_id: 'inexistente' } as any))
        .rejects.toThrow('não encontrado');
    });
  });

  describe('terminate', () => {
    it('chama POST /rentals/:id/terminate com reason', async () => {
      const terminated = { ...fakeRental, is_active: false, terminated_at: '2026-03-24', termination_reason: 'Devolução' };
      mockPost.mockResolvedValueOnce({ data: { data: terminated } });
      const result = await rentalApi.terminate('rental-1', 'Devolução');
      expect(mockPost).toHaveBeenCalledWith('/rentals/rental-1/terminate', { reason: 'Devolução' });
      expect(result.is_active).toBe(false);
    });

    it('propaga erro aluguel já inativo', async () => {
      mockPost.mockRejectedValueOnce(new Error('Aluguel já está inativo'));
      await expect(rentalApi.terminate('rental-1', 'Test')).rejects.toThrow('já está inativo');
    });

    it('propaga erro aluguel inexistente', async () => {
      mockPost.mockRejectedValueOnce(new Error('Aluguel não encontrado'));
      await expect(rentalApi.terminate('inexistente', 'Test')).rejects.toThrow('não encontrado');
    });
  });

  describe('delete', () => {
    it('chama DELETE /rentals/:id', async () => {
      mockDelete.mockResolvedValueOnce({});
      await rentalApi.delete('rental-1');
      expect(mockDelete).toHaveBeenCalledWith('/rentals/rental-1');
    });
  });
});
