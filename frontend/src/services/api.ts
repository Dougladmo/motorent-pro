import axios from 'axios';
import { Motorcycle, Subscriber, Rental, Payment } from '../shared';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos
});

// Interceptor de requisição (antes de enviar)
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      config.headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de resposta (após receber)
api.interceptors.response.use(undefined, (error) => {
  if (error.response?.status === 401) {
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

// ============================================
// MOTORCYCLES
// ============================================

export const motorcycleApi = {
  getAll: async (): Promise<Motorcycle[]> => {
    const { data } = await api.get('/motorcycles');
    return data.data;
  },

  getById: async (id: string): Promise<Motorcycle> => {
    const { data } = await api.get(`/motorcycles/${id}`);
    return data.data;
  },

  getByStatus: async (status: string): Promise<Motorcycle[]> => {
    const { data } = await api.get('/motorcycles', { params: { status } });
    return data.data;
  },

  create: async (motorcycle: Partial<Motorcycle>): Promise<Motorcycle> => {
    const { data } = await api.post('/motorcycles', motorcycle);
    return data.data;
  },

  update: async (id: string, updates: Partial<Motorcycle>): Promise<Motorcycle> => {
    const { data } = await api.patch(`/motorcycles/${id}`, updates);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/motorcycles/${id}`);
  },
};

// ============================================
// SUBSCRIBERS
// ============================================

export const subscriberApi = {
  getAll: async (): Promise<Subscriber[]> => {
    const { data } = await api.get('/subscribers');
    return data.data;
  },

  getActive: async (): Promise<Subscriber[]> => {
    const { data } = await api.get('/subscribers/active');
    return data.data;
  },

  getById: async (id: string): Promise<Subscriber> => {
    const { data } = await api.get(`/subscribers/${id}`);
    return data.data;
  },

  create: async (subscriber: Partial<Subscriber>): Promise<Subscriber> => {
    const { data } = await api.post('/subscribers', subscriber);
    return data.data;
  },

  update: async (id: string, updates: Partial<Subscriber>): Promise<Subscriber> => {
    const { data } = await api.patch(`/subscribers/${id}`, updates);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/subscribers/${id}`);
  },
};

// ============================================
// RENTALS
// ============================================

export const rentalApi = {
  getAll: async (): Promise<Rental[]> => {
    const { data } = await api.get('/rentals');
    return data.data;
  },

  getActive: async (): Promise<Rental[]> => {
    const { data } = await api.get('/rentals/active');
    return data.data;
  },

  getById: async (id: string): Promise<Rental> => {
    const { data } = await api.get(`/rentals/${id}`);
    return data.data;
  },

  getByMotorcycleId: async (motorcycleId: string): Promise<Rental[]> => {
    const { data } = await api.get(`/rentals/motorcycle/${motorcycleId}`);
    return data.data;
  },

  getBySubscriberId: async (subscriberId: string): Promise<Rental[]> => {
    const { data } = await api.get(`/rentals/subscriber/${subscriberId}`);
    return data.data;
  },

  create: async (rental: Partial<Rental>): Promise<Rental> => {
    const { data } = await api.post('/rentals', rental);
    return data.data;
  },

  update: async (id: string, updates: Partial<Rental>): Promise<Rental> => {
    const { data } = await api.patch(`/rentals/${id}`, updates);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/rentals/${id}`);
  },

  terminate: async (id: string, reason: string): Promise<Rental> => {
    const { data } = await api.post(`/rentals/${id}/terminate`, { reason });
    return data.data;
  },
};

// ============================================
// PAYMENTS
// ============================================

export const paymentApi = {
  getAll: async (): Promise<Payment[]> => {
    const { data } = await api.get('/payments');
    return data.data;
  },

  getById: async (id: string): Promise<Payment> => {
    const { data } = await api.get(`/payments/${id}`);
    return data.data;
  },

  getByStatus: async (status: string): Promise<Payment[]> => {
    const { data } = await api.get('/payments', { params: { status } });
    return data.data;
  },

  markAsPaid: async (id: string, verifiedAmount?: number): Promise<Payment> => {
    const { data } = await api.patch(`/payments/${id}/mark-paid`, { verifiedAmount });
    return data.data;
  },

  markAsUnpaid: async (id: string, reason?: string): Promise<Payment> => {
    const { data } = await api.patch(`/payments/${id}/mark-unpaid`, { reason });
    return data.data;
  },

  sendReminder: async (id: string): Promise<{ jobId: string }> => {
    const { data } = await api.post(`/payments/${id}/send-reminder`);
    return data;
  },

  getJobStatus: async (jobId: string): Promise<{
    id: string;
    payment_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error: string | null;
    created_at: string;
    updated_at: string;
  }> => {
    const { data } = await api.get(`/payments/jobs/${jobId}`);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/payments/${id}`);
  },

  validateIntegrity: async (): Promise<{
    totalPayments: number;
    inconsistencies: Array<{ type: string; message: string; paymentId: string }>;
  }> => {
    const { data } = await api.get('/payments/validate');
    return data.data;
  },
};

// ============================================
// USERS
// ============================================

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  isSuperAdmin: boolean;
}

export const userApi = {
  getAll: async (): Promise<AdminUser[]> => {
    const { data } = await api.get('/users');
    return data.data;
  },

  create: async (email: string, password: string): Promise<AdminUser> => {
    const { data } = await api.post('/users', { email, password });
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

// ============================================
// HEALTH CHECK
// ============================================

export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  const { data } = await api.get('/health');
  return data;
};

export default api;
