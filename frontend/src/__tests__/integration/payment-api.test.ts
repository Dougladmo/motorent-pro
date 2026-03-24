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
import { paymentApi } from '../../services/api';

vi.spyOn(api, 'get').mockImplementation(vi.fn());
vi.spyOn(api, 'post').mockImplementation(vi.fn());
vi.spyOn(api, 'patch').mockImplementation(vi.fn());
vi.spyOn(api, 'delete').mockImplementation(vi.fn());

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockPatch = api.patch as ReturnType<typeof vi.fn>;
const mockDelete = api.delete as ReturnType<typeof vi.fn>;

const fakePayment = {
  id: 'pay-1',
  rental_id: 'rental-1',
  subscriber_name: 'João Silva',
  amount: 300,
  expected_amount: 300,
  due_date: '2026-01-06',
  status: 'Pendente',
  paid_at: null,
  reminder_sent_count: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('paymentApi', () => {
  describe('getAll', () => {
    it('chama GET /payments e retorna array', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [fakePayment] } });
      const result = await paymentApi.getAll();
      expect(mockGet).toHaveBeenCalledWith('/payments');
      expect(result).toEqual([fakePayment]);
    });
  });

  describe('getById', () => {
    it('chama GET /payments/:id e retorna pagamento', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: fakePayment } });
      const result = await paymentApi.getById('pay-1');
      expect(mockGet).toHaveBeenCalledWith('/payments/pay-1');
      expect(result).toEqual(fakePayment);
    });

    it('propaga erro 404', async () => {
      mockGet.mockRejectedValueOnce(new Error('Registro não encontrado.'));
      await expect(paymentApi.getById('inexistente')).rejects.toThrow('não encontrado');
    });
  });

  describe('getByStatus', () => {
    it('chama GET /payments com param status=Pendente', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [fakePayment] } });
      const result = await paymentApi.getByStatus('Pendente');
      expect(mockGet).toHaveBeenCalledWith('/payments', { params: { status: 'Pendente' } });
      expect(result).toEqual([fakePayment]);
    });
  });

  describe('markAsPaid', () => {
    it('chama PATCH /payments/:id/mark-paid sem verifiedAmount', async () => {
      const paid = { ...fakePayment, status: 'Pago', paid_at: '2026-01-06T10:00:00Z' };
      mockPatch.mockResolvedValueOnce({ data: { data: paid } });
      const result = await paymentApi.markAsPaid('pay-1');
      expect(mockPatch).toHaveBeenCalledWith('/payments/pay-1/mark-paid', { verifiedAmount: undefined });
      expect(result.status).toBe('Pago');
    });

    it('chama PATCH /payments/:id/mark-paid com verifiedAmount', async () => {
      const paid = { ...fakePayment, status: 'Pago' };
      mockPatch.mockResolvedValueOnce({ data: { data: paid } });
      await paymentApi.markAsPaid('pay-1', 300);
      expect(mockPatch).toHaveBeenCalledWith('/payments/pay-1/mark-paid', { verifiedAmount: 300 });
    });

    it('propaga erro pagamento já pago', async () => {
      mockPatch.mockRejectedValueOnce(new Error('já está marcado como pago'));
      await expect(paymentApi.markAsPaid('pay-1')).rejects.toThrow('já está marcado como pago');
    });

    it('propaga erro pagamento inexistente', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Pagamento não encontrado'));
      await expect(paymentApi.markAsPaid('inexistente')).rejects.toThrow('não encontrado');
    });
  });

  describe('markAsUnpaid', () => {
    it('chama PATCH /payments/:id/mark-unpaid com reason', async () => {
      const reverted = { ...fakePayment, status: 'Pendente', previous_status: 'Pago' };
      mockPatch.mockResolvedValueOnce({ data: { data: reverted } });
      const result = await paymentApi.markAsUnpaid('pay-1', 'Estorno');
      expect(mockPatch).toHaveBeenCalledWith('/payments/pay-1/mark-unpaid', { reason: 'Estorno' });
      expect(result.status).toBe('Pendente');
    });

    it('propaga erro para pagamento não pago', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Apenas pagamentos marcados como "Pago" podem ser revertidos'));
      await expect(paymentApi.markAsUnpaid('pay-1')).rejects.toThrow('Pago');
    });
  });

  describe('delete', () => {
    it('chama DELETE /payments/:id', async () => {
      mockDelete.mockResolvedValueOnce({});
      await paymentApi.delete('pay-1');
      expect(mockDelete).toHaveBeenCalledWith('/payments/pay-1');
    });
  });

  describe('sendReminder', () => {
    it('chama POST /payments/:id/send-reminder e retorna jobId', async () => {
      mockPost.mockResolvedValueOnce({ data: { jobId: 'job-123' } });
      const result = await paymentApi.sendReminder('pay-1');
      expect(mockPost).toHaveBeenCalledWith('/payments/pay-1/send-reminder');
      expect(result.jobId).toBe('job-123');
    });
  });

  describe('sendConsolidatedReminder', () => {
    it('chama POST /payments/consolidated-reminder/:subscriberId', async () => {
      mockPost.mockResolvedValueOnce({});
      await paymentApi.sendConsolidatedReminder('sub-1');
      expect(mockPost).toHaveBeenCalledWith('/payments/consolidated-reminder/sub-1');
    });
  });

  describe('validateIntegrity', () => {
    it('chama GET /payments/validate e retorna relatório', async () => {
      const report = { totalPayments: 10, inconsistencies: [] };
      mockGet.mockResolvedValueOnce({ data: { data: report } });
      const result = await paymentApi.validateIntegrity();
      expect(mockGet).toHaveBeenCalledWith('/payments/validate');
      expect(result.totalPayments).toBe(10);
      expect(result.inconsistencies).toEqual([]);
    });
  });

  describe('getJobStatus', () => {
    it('chama GET /payments/jobs/:id e retorna status', async () => {
      const job = { id: 'job-1', payment_id: 'pay-1', status: 'completed', error: null, created_at: '', updated_at: '' };
      mockGet.mockResolvedValueOnce({ data: { data: job } });
      const result = await paymentApi.getJobStatus('job-1');
      expect(mockGet).toHaveBeenCalledWith('/payments/jobs/job-1');
      expect(result.status).toBe('completed');
    });
  });
});
