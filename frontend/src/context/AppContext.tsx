import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Motorcycle,
  Subscriber,
  Rental,
  Payment,
  DashboardStats,
  PaymentStatus,
  MotorcycleStatus,
  PaymentValidationReport
} from '../shared';
import {
  motorcycleApi,
  subscriberApi,
  subscriberDocumentApi,
  rentalApi,
  paymentApi
} from '../services/api';
import { SubscriberDocument } from '../shared/types/subscriber';
import { useAuth } from './AuthContext';

interface AppContextType {
  motorcycles: Motorcycle[];
  subscribers: Subscriber[];
  rentals: Rental[];
  payments: Payment[];
  stats: DashboardStats;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  addMotorcycle: (moto: Omit<Motorcycle, 'id'>) => Promise<void>;
  updateMotorcycle: (id: string, updates: Partial<Motorcycle>) => Promise<void>;
  updateMotorcycleStatus: (id: string, status: MotorcycleStatus) => Promise<void>;
  addSubscriber: (sub: Omit<Subscriber, 'id'>) => Promise<void>;
  updateSubscriber: (id: string, updates: Partial<Subscriber>) => Promise<void>;
  createRental: (rental: Omit<Rental, 'id'>) => Promise<void>;
  updatePayment: (id: string, updates: { amount?: number; dueDate?: string }) => Promise<void>;
  markPaymentAsPaid: (id: string, verifiedAmount?: number) => Promise<void>;
  sendReminder: (paymentId: string) => Promise<string>;
  deleteMotorcycle: (id: string) => Promise<void>;
  deleteSubscriber: (id: string) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  markPaymentAsUnpaid: (id: string, reason?: string) => Promise<void>;
  terminateRental: (rentalId: string, reason?: string) => Promise<void>;
  validatePaymentIntegrity: () => Promise<PaymentValidationReport>;
  getSubscriberDocuments: (subscriberId: string) => Promise<SubscriberDocument[]>;
  addSubscriberDocument: (subscriberId: string, formData: FormData) => Promise<SubscriberDocument>;
  deleteSubscriberDocument: (subscriberId: string, docId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Função para transformar dados do backend (snake_case) para frontend (camelCase)
const transformMotorcycle = (data: any): Motorcycle => ({
  id: data.id,
  plate: data.plate,
  model: data.model,
  year: data.year,
  status: data.status as MotorcycleStatus,
  imageUrl: data.image_url,
  totalRevenue: data.total_revenue || 0,
  revenueHistory: data.revenue_history || []
});

const transformSubscriber = (data: any): Subscriber => ({
  id: data.id,
  name: data.name,
  phone: data.phone,
  email: data.email ?? undefined,
  document: data.document,
  active: data.active,
  notes: data.notes ?? undefined,
  birthDate: data.birth_date ?? undefined,
  addressZip: data.address_zip ?? undefined,
  addressStreet: data.address_street ?? undefined,
  addressNumber: data.address_number ?? undefined,
  addressComplement: data.address_complement ?? undefined,
  addressNeighborhood: data.address_neighborhood ?? undefined,
  addressCity: data.address_city ?? undefined,
  addressState: data.address_state ?? undefined,
  isRealDriver: data.is_real_driver ?? true,
  realDriverName: data.real_driver_name ?? undefined,
  realDriverDocument: data.real_driver_document ?? undefined,
  realDriverPhone: data.real_driver_phone ?? undefined,
  realDriverRelationship: data.real_driver_relationship ?? undefined,
  realDriverAddressZip: data.real_driver_address_zip ?? undefined,
  realDriverAddressStreet: data.real_driver_address_street ?? undefined,
  realDriverAddressNumber: data.real_driver_address_number ?? undefined,
  realDriverAddressComplement: data.real_driver_address_complement ?? undefined,
  realDriverAddressNeighborhood: data.real_driver_address_neighborhood ?? undefined,
  realDriverAddressCity: data.real_driver_address_city ?? undefined,
  realDriverAddressState: data.real_driver_address_state ?? undefined
});

const transformRental = (data: any): Rental => ({
  id: data.id,
  motorcycleId: data.motorcycle_id,
  subscriberId: data.subscriber_id,
  startDate: data.start_date,
  endDate: data.end_date,
  weeklyValue: data.weekly_value,
  dueDayOfWeek: data.due_day_of_week,
  isActive: data.is_active,
  terminatedAt: data.terminated_at,
  terminationReason: data.termination_reason,
  outstandingBalance: data.outstanding_balance || 0,
  totalContractValue: data.total_contract_value ?? 0,
  totalPaid: data.total_paid ?? 0
});

const transformPayment = (data: any): Payment => ({
  id: data.id,
  rentalId: data.rental_id,
  subscriberName: data.subscriber_name,
  amount: data.amount,
  dueDate: data.due_date,
  status: data.status as PaymentStatus,
  paidAt: data.paid_at,
  reminderSentCount: data.reminder_sent_count || 0,
  previousStatus: data.previous_status,
  markedAsPaidAt: data.marked_as_paid_at,
  expectedAmount: data.expected_amount || data.amount,
  isAmountOverridden: data.is_amount_overridden || false,
  abacatePixId: data.abacate_pix_id ?? undefined,
  pixBrCode: data.pix_br_code ?? undefined,
  pixExpiresAt: data.pix_expires_at ?? undefined,
  pixPaymentUrl: data.pix_payment_url ?? undefined
});

// Função para transformar dados do frontend para backend
const toSnakeCase = (data: any): any => {
  const result: any = {};
  for (const key in data) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = data[key];
  }
  return result;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados na montagem do componente
  const refreshData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [motorcyclesData, subscribersData, rentalsData, paymentsData] = await Promise.all([
        motorcycleApi.getAll(),
        subscriberApi.getAll(),
        rentalApi.getAll(),
        paymentApi.getAll()
      ]);

      const transformedMotorcycles = motorcyclesData.map(transformMotorcycle);
      const transformedSubscribers = subscribersData.map(transformSubscriber);
      const transformedRentals = rentalsData.map(transformRental);
      const transformedPayments = paymentsData.map(transformPayment);

      setMotorcycles(transformedMotorcycles);
      setSubscribers(transformedSubscribers);
      setRentals(transformedRentals);
      setPayments(transformedPayments);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated]);

  // Estatísticas derivadas
  const stats: DashboardStats = {
    totalRevenue: payments
      .filter(p => p.status === PaymentStatus.PAID)
      .reduce((acc, curr) => acc + curr.amount, 0),
    totalPending: payments
      .filter(p => p.status === PaymentStatus.PENDING)
      .reduce((acc, curr) => acc + curr.amount, 0),
    totalOverdue: payments
      .filter(p => p.status === PaymentStatus.OVERDUE)
      .reduce((acc, curr) => acc + curr.amount, 0),
    activeRentals: rentals.filter(r => r.isActive).length,
    availableBikes: motorcycles.filter(m => m.status === MotorcycleStatus.AVAILABLE).length
  };

  // CRUD Methods

  const addMotorcycle = async (moto: Omit<Motorcycle, 'id'>) => {
    try {
      const created = await motorcycleApi.create(toSnakeCase(moto));
      const transformed = transformMotorcycle(created);

      // Adicionar ao estado local E fazer refresh para garantir sincronização
      setMotorcycles(prev => [...prev, transformed]);

      // Refresh completo para garantir que está sincronizado
      setTimeout(() => refreshData(), 500);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const updateMotorcycle = async (id: string, updates: Partial<Motorcycle>) => {
    try {
      const updated = await motorcycleApi.update(id, toSnakeCase(updates));
      const transformed = transformMotorcycle(updated);
      setMotorcycles(prev => prev.map(m => m.id === id ? transformed : m));

      // Refresh para garantir sincronização
      setTimeout(() => refreshData(), 500);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const updateMotorcycleStatus = async (id: string, status: MotorcycleStatus) => {
    try {
      const updated = await motorcycleApi.update(id, { status });
      setMotorcycles(prev => prev.map(m => m.id === id ? transformMotorcycle(updated) : m));
    } catch (error: any) {
      console.error('Erro ao atualizar status da moto:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const deleteMotorcycle = async (id: string) => {
    try {
      await motorcycleApi.delete(id);
      setMotorcycles(prev => prev.filter(m => m.id !== id));
    } catch (error: any) {
      console.error('Erro ao excluir moto:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const addSubscriber = async (sub: Omit<Subscriber, 'id'>) => {
    try {
      const created = await subscriberApi.create(toSnakeCase(sub));
      const transformed = transformSubscriber(created);

      setSubscribers(prev => [...prev, transformed]);

      // Refresh completo
      setTimeout(() => refreshData(), 500);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const updateSubscriber = async (id: string, updates: Partial<Subscriber>) => {
    try {
      const updated = await subscriberApi.update(id, toSnakeCase(updates));
      const transformed = transformSubscriber(updated);
      setSubscribers(prev => prev.map(s => s.id === id ? transformed : s));

      // Refresh para garantir sincronização
      setTimeout(() => refreshData(), 500);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const deleteSubscriber = async (id: string) => {
    try {
      await subscriberApi.delete(id);
      setSubscribers(prev => prev.filter(s => s.id !== id));
    } catch (error: any) {
      console.error('Erro ao excluir assinante:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const createRental = async (rental: Omit<Rental, 'id'>) => {
    try {
      // Remover campos que não existem no schema do banco de dados
      const { contractDurationMonths, ...rentalData } = rental as any;

      const created = await rentalApi.create(toSnakeCase(rentalData));
      const transformed = transformRental(created);

      setRentals(prev => [...prev, transformed]);

      // Refresh completo (atualiza moto, pagamentos, etc)
      await refreshData();
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const terminateRental = async (rentalId: string, reason?: string) => {
    try {
      const rental = rentals.find(r => r.id === rentalId);
      if (!rental) throw new Error('Aluguel não encontrado');

      if (!rental.isActive) {
        throw new Error('Aluguel já está inativo');
      }

      const terminationReason = reason || 'Rescisão de contrato';

      // Usar o endpoint específico de terminate que já cancela pagamentos futuros
      const updated = await rentalApi.terminate(rentalId, terminationReason);

      setRentals(prev => prev.map(r => r.id === rentalId ? transformRental(updated) : r));

      // Refresh para atualizar moto e pagamentos cancelados
      await refreshData();
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const updatePayment = async (id: string, updates: { amount?: number; dueDate?: string }) => {
    try {
      // Usar a API de payments com patch genérico
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/payments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: updates.amount,
          due_date: updates.dueDate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar pagamento');
      }

      const result = await response.json();
      const transformed = transformPayment(result.data);
      setPayments(prev => prev.map(p => p.id === id ? transformed : p));

      // Refresh para garantir sincronização
      setTimeout(() => refreshData(), 500);
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao atualizar pagamento');
    }
  };

  const markPaymentAsPaid = async (id: string, verifiedAmount?: number) => {
    try {
      const payment = payments.find(p => p.id === id);
      if (!payment) throw new Error('Pagamento não encontrado');

      if (payment.status === PaymentStatus.PAID) {
        throw new Error('Pagamento já está marcado como pago');
      }

      const updated = await paymentApi.markAsPaid(id, verifiedAmount);
      setPayments(prev => prev.map(p => p.id === id ? transformPayment(updated) : p));

      // Refresh para atualizar receita da moto
      await refreshData();
    } catch (error: any) {
      console.error('Erro ao marcar pagamento:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const markPaymentAsUnpaid = async (id: string, reason?: string) => {
    try {
      const payment = payments.find(p => p.id === id);
      if (!payment) throw new Error('Pagamento não encontrado');

      if (payment.status !== PaymentStatus.PAID) {
        throw new Error('Apenas pagamentos marcados como "Pago" podem ser revertidos');
      }

      const updated = await paymentApi.markAsUnpaid(id, reason);
      setPayments(prev => prev.map(p => p.id === id ? transformPayment(updated) : p));

      // Refresh para atualizar receita da moto
      await refreshData();
    } catch (error: any) {
      console.error('Erro ao reverter pagamento:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const sendReminder = async (paymentId: string): Promise<string> => {
    try {
      const result = await paymentApi.sendReminder(paymentId);
      return result.jobId;
    } catch (error: any) {
      console.error('Erro ao enviar lembrete:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const deletePayment = async (id: string) => {
    try {
      const payment = payments.find(p => p.id === id);
      if (!payment) throw new Error('Pagamento não encontrado');

      await paymentApi.delete(id);
      setPayments(prev => prev.filter(p => p.id !== id));
    } catch (error: any) {
      console.error('Erro ao deletar pagamento:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const getSubscriberDocuments = async (subscriberId: string): Promise<SubscriberDocument[]> => {
    try {
      return await subscriberDocumentApi.getDocuments(subscriberId);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const addSubscriberDocument = async (subscriberId: string, formData: FormData): Promise<SubscriberDocument> => {
    try {
      return await subscriberDocumentApi.upload(subscriberId, formData);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const deleteSubscriberDocument = async (subscriberId: string, docId: string): Promise<void> => {
    try {
      await subscriberDocumentApi.delete(subscriberId, docId);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const validatePaymentIntegrity = async (): Promise<PaymentValidationReport> => {
    try {
      const result = await paymentApi.validateIntegrity();

      return {
        hasIssues: result.inconsistencies.length > 0,
        issueCount: result.inconsistencies.length,
        issues: result.inconsistencies.map(inc => ({
          type: inc.type as any,
          severity: 'HIGH' as any,
          paymentId: inc.paymentId,
          details: inc.message
        })),
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Erro ao validar integridade:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  return (
    <AppContext.Provider value={{
      motorcycles,
      subscribers,
      rentals,
      payments,
      stats,
      loading,
      error,
      refreshData,
      addMotorcycle,
      updateMotorcycle,
      updateMotorcycleStatus,
      addSubscriber,
      updateSubscriber,
      createRental,
      updatePayment,
      markPaymentAsPaid,
      sendReminder,
      deleteMotorcycle,
      deleteSubscriber,
      deletePayment,
      markPaymentAsUnpaid,
      terminateRental,
      validatePaymentIntegrity,
      getSubscriberDocuments,
      addSubscriberDocument,
      deleteSubscriberDocument
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
