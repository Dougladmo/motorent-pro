import axios from 'axios';
import { Motorcycle, Subscriber, Rental, Payment } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

console.log('🔧 [API CONFIG]', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_URL,
  baseURL: `${API_URL}/api`
});

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos
});

// Interceptor de requisição (antes de enviar)
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 [API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
      params: config.params,
      data: config.data
    });
    return config;
  },
  (error) => {
    console.error('❌ [API REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

// Interceptor de resposta (após receber)
api.interceptors.response.use(
  (response) => {
    console.log(`✅ [API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`, {
      data: response.data
    });
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ [API TIMEOUT]', error.message);
    } else if (error.code === 'ERR_NETWORK') {
      console.error('🌐 [NETWORK ERROR] Backend não está acessível. Verifique se está rodando em', API_URL);
    } else if (error.response) {
      console.error(`❌ [API ERROR] ${error.response.status}`, {
        url: error.config?.url,
        error: error.response.data?.error || error.message
      });
    } else {
      console.error('❌ [API ERROR]', error.message);
    }
    return Promise.reject(error);
  }
);

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

  sendReminder: async (id: string): Promise<void> => {
    await api.post(`/payments/${id}/send-reminder`);
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
// HEALTH CHECK
// ============================================

export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  const { data } = await api.get('/health');
  return data;
};

export default api;
