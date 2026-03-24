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
import { subscriberApi } from '../../services/api';

vi.spyOn(api, 'get').mockImplementation(vi.fn());
vi.spyOn(api, 'post').mockImplementation(vi.fn());
vi.spyOn(api, 'patch').mockImplementation(vi.fn());
vi.spyOn(api, 'delete').mockImplementation(vi.fn());

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockPatch = api.patch as ReturnType<typeof vi.fn>;
const mockDelete = api.delete as ReturnType<typeof vi.fn>;

const fakeSub = {
  id: 'sub-1',
  name: 'João Silva',
  phone: '11999990001',
  email: 'joao@test.com',
  document: '11111111111',
  active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subscriberApi', () => {
  describe('getAll', () => {
    it('chama GET /subscribers e retorna array', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [fakeSub] } });
      const result = await subscriberApi.getAll();
      expect(mockGet).toHaveBeenCalledWith('/subscribers');
      expect(result).toEqual([fakeSub]);
    });
  });

  describe('getActive', () => {
    it('chama GET /subscribers/active', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [fakeSub] } });
      const result = await subscriberApi.getActive();
      expect(mockGet).toHaveBeenCalledWith('/subscribers/active');
      expect(result).toEqual([fakeSub]);
    });
  });

  describe('getById', () => {
    it('chama GET /subscribers/:id e retorna assinante', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: fakeSub } });
      const result = await subscriberApi.getById('sub-1');
      expect(mockGet).toHaveBeenCalledWith('/subscribers/sub-1');
      expect(result).toEqual(fakeSub);
    });

    it('propaga erro 404', async () => {
      mockGet.mockRejectedValueOnce(new Error('Registro não encontrado.'));
      await expect(subscriberApi.getById('inexistente')).rejects.toThrow('não encontrado');
    });
  });

  describe('create', () => {
    it('chama POST /subscribers com dados corretos', async () => {
      const payload = { name: 'Maria', phone: '11999998888', document: '22222222222' };
      mockPost.mockResolvedValueOnce({ data: { data: { id: 'sub-2', ...payload, active: true } } });
      const result = await subscriberApi.create(payload);
      expect(mockPost).toHaveBeenCalledWith('/subscribers', payload);
      expect(result.id).toBe('sub-2');
    });

    it('propaga erro de documento duplicado', async () => {
      mockPost.mockRejectedValueOnce(new Error('11111111111'));
      await expect(subscriberApi.create({ name: 'Test', phone: '119', document: '11111111111' }))
        .rejects.toThrow('11111111111');
    });

    it('propaga erro de telefone duplicado', async () => {
      mockPost.mockRejectedValueOnce(new Error('WhatsApp'));
      await expect(subscriberApi.create({ name: 'Test', phone: '11999990001', document: '33333333333' }))
        .rejects.toThrow('WhatsApp');
    });

    it('propaga erro de email duplicado', async () => {
      mockPost.mockRejectedValueOnce(new Error('joao@test.com'));
      await expect(subscriberApi.create({ name: 'Test', phone: '119', document: '44444444444', email: 'joao@test.com' }))
        .rejects.toThrow('joao@test.com');
    });

    it('envia campos de endereço', async () => {
      const payload = {
        name: 'Test', phone: '119', document: '55555555555',
        address_zip: '01001-000', address_street: 'Rua Test', address_number: '100',
        address_neighborhood: 'Centro', address_city: 'São Paulo', address_state: 'SP',
      };
      mockPost.mockResolvedValueOnce({ data: { data: { id: 'sub-3', ...payload } } });
      const result = await subscriberApi.create(payload);
      expect(mockPost).toHaveBeenCalledWith('/subscribers', expect.objectContaining({ address_zip: '01001-000' }));
      expect(result.id).toBe('sub-3');
    });

    it('envia dados do condutor real quando isRealDriver=false', async () => {
      const payload = {
        name: 'Test', phone: '119', document: '66666666666',
        is_real_driver: false, real_driver_name: 'Condutor', real_driver_document: '77777777777',
      };
      mockPost.mockResolvedValueOnce({ data: { data: { id: 'sub-4', ...payload } } });
      await subscriberApi.create(payload);
      expect(mockPost).toHaveBeenCalledWith('/subscribers', expect.objectContaining({ is_real_driver: false, real_driver_name: 'Condutor' }));
    });
  });

  describe('update', () => {
    it('chama PATCH /subscribers/:id com updates', async () => {
      mockPatch.mockResolvedValueOnce({ data: { data: { ...fakeSub, name: 'João Updated' } } });
      const result = await subscriberApi.update('sub-1', { name: 'João Updated' });
      expect(mockPatch).toHaveBeenCalledWith('/subscribers/sub-1', { name: 'João Updated' });
      expect(result.name).toBe('João Updated');
    });

    it('propaga erro de telefone duplicado', async () => {
      mockPatch.mockRejectedValueOnce(new Error('WhatsApp'));
      await expect(subscriberApi.update('sub-1', { phone: '11999990002' })).rejects.toThrow('WhatsApp');
    });

    it('propaga erro de email duplicado', async () => {
      mockPatch.mockRejectedValueOnce(new Error('maria@test.com'));
      await expect(subscriberApi.update('sub-1', { email: 'maria@test.com' })).rejects.toThrow('maria@test.com');
    });
  });

  describe('delete', () => {
    it('chama DELETE /subscribers/:id', async () => {
      mockDelete.mockResolvedValueOnce({});
      await subscriberApi.delete('sub-1');
      expect(mockDelete).toHaveBeenCalledWith('/subscribers/sub-1');
    });

    it('propaga erro 404', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Registro não encontrado.'));
      await expect(subscriberApi.delete('inexistente')).rejects.toThrow('não encontrado');
    });
  });
});
