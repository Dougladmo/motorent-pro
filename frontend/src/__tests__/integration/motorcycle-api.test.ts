import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing api
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}));

// Mock import.meta.env
vi.stubGlobal('window', { location: { href: '' } });

import api from '../../services/api';
import { motorcycleApi } from '../../services/api';

// Mock the axios instance methods
vi.spyOn(api, 'get').mockImplementation(vi.fn());
vi.spyOn(api, 'post').mockImplementation(vi.fn());
vi.spyOn(api, 'patch').mockImplementation(vi.fn());
vi.spyOn(api, 'delete').mockImplementation(vi.fn());

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockPatch = api.patch as ReturnType<typeof vi.fn>;
const mockDelete = api.delete as ReturnType<typeof vi.fn>;

const fakeMoto = {
  id: 'moto-1',
  plate: 'ABC-1234',
  chassi: '9BWZZZ377VT004251',
  renavam: '12345678901',
  model: 'Honda CG 160',
  year: 2023,
  mileage: 15000,
  status: 'Disponível',
  image_url: null,
  total_revenue: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('motorcycleApi', () => {
  describe('getAll', () => {
    it('chama GET /motorcycles e retorna array', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [fakeMoto] } });
      const result = await motorcycleApi.getAll();
      expect(mockGet).toHaveBeenCalledWith('/motorcycles');
      expect(result).toEqual([fakeMoto]);
    });
  });

  describe('getById', () => {
    it('chama GET /motorcycles/:id e retorna moto', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: fakeMoto } });
      const result = await motorcycleApi.getById('moto-1');
      expect(mockGet).toHaveBeenCalledWith('/motorcycles/moto-1');
      expect(result).toEqual(fakeMoto);
    });

    it('propaga erro 404 para moto inexistente', async () => {
      mockGet.mockRejectedValueOnce(new Error('Registro não encontrado.'));
      await expect(motorcycleApi.getById('inexistente')).rejects.toThrow('não encontrado');
    });
  });

  describe('getByStatus', () => {
    it('chama GET /motorcycles com param status=Disponível', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [fakeMoto] } });
      const result = await motorcycleApi.getByStatus('Disponível');
      expect(mockGet).toHaveBeenCalledWith('/motorcycles', { params: { status: 'Disponível' } });
      expect(result).toEqual([fakeMoto]);
    });
  });

  describe('create', () => {
    it('chama POST /motorcycles com dados corretos', async () => {
      const payload = { plate: 'NEW-1234', model: 'Yamaha Factor', year: 2024 };
      mockPost.mockResolvedValueOnce({ data: { data: { id: 'moto-2', ...payload } } });
      const result = await motorcycleApi.create(payload);
      expect(mockPost).toHaveBeenCalledWith('/motorcycles', payload);
      expect(result.id).toBe('moto-2');
    });

    it('propaga erro de placa duplicada', async () => {
      mockPost.mockRejectedValueOnce(new Error('Placa "ABC-1234" já está cadastrada'));
      await expect(motorcycleApi.create({ plate: 'ABC-1234', model: 'Test', year: 2024 }))
        .rejects.toThrow('já está cadastrada');
    });

    it('propaga erro sem placa', async () => {
      mockPost.mockRejectedValueOnce(new Error('Placa da moto é obrigatória.'));
      await expect(motorcycleApi.create({ plate: '', model: 'Test', year: 2024 }))
        .rejects.toThrow('obrigatória');
    });

    it('propaga erro sem modelo', async () => {
      mockPost.mockRejectedValueOnce(new Error('Modelo da moto é obrigatório.'));
      await expect(motorcycleApi.create({ plate: 'ABC-1234', model: '', year: 2024 }))
        .rejects.toThrow('obrigatório');
    });

    it('envia chassi e renavam quando fornecidos', async () => {
      const payload = { plate: 'NEW-1234', model: 'Test', year: 2024, chassi: '9BWZZZ377VT004251', renavam: '12345678901' };
      mockPost.mockResolvedValueOnce({ data: { data: { id: 'moto-3', ...payload } } });
      await motorcycleApi.create(payload);
      expect(mockPost).toHaveBeenCalledWith('/motorcycles', expect.objectContaining({ chassi: '9BWZZZ377VT004251', renavam: '12345678901' }));
    });

    it('funciona sem chassi e renavam (opcionais)', async () => {
      const payload = { plate: 'NEW-5678', model: 'Test', year: 2024 };
      mockPost.mockResolvedValueOnce({ data: { data: { id: 'moto-4', ...payload } } });
      const result = await motorcycleApi.create(payload);
      expect(result.id).toBe('moto-4');
      const callPayload = mockPost.mock.calls[0][1];
      expect(callPayload.chassi).toBeUndefined();
      expect(callPayload.renavam).toBeUndefined();
    });
  });

  describe('update', () => {
    it('chama PATCH /motorcycles/:id com updates', async () => {
      const updates = { model: 'Honda Biz 125', year: 2025 };
      mockPatch.mockResolvedValueOnce({ data: { data: { ...fakeMoto, ...updates } } });
      const result = await motorcycleApi.update('moto-1', updates);
      expect(mockPatch).toHaveBeenCalledWith('/motorcycles/moto-1', updates);
      expect(result.model).toBe('Honda Biz 125');
    });

    it('propaga erro 404 para moto inexistente', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Moto não encontrada.'));
      await expect(motorcycleApi.update('inexistente', { model: 'Test' })).rejects.toThrow('não encontrada');
    });

    it('propaga erro de placa duplicada ao atualizar', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Placa "XYZ-9E87" já está cadastrada'));
      await expect(motorcycleApi.update('moto-1', { plate: 'XYZ-9E87' })).rejects.toThrow('já está cadastrada');
    });
  });

  describe('delete', () => {
    it('chama DELETE /motorcycles/:id', async () => {
      mockDelete.mockResolvedValueOnce({});
      await motorcycleApi.delete('moto-1');
      expect(mockDelete).toHaveBeenCalledWith('/motorcycles/moto-1');
    });

    it('propaga erro 404 para moto inexistente', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Moto não encontrada.'));
      await expect(motorcycleApi.delete('inexistente')).rejects.toThrow('não encontrada');
    });
  });
});
