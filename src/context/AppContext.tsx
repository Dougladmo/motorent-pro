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
} from '../types';
import {
  motorcycleApi,
  subscriberApi,
  rentalApi,
  paymentApi
} from '../services/api';

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
  updateMotorcycleStatus: (id: string, status: MotorcycleStatus) => Promise<void>;
  addSubscriber: (sub: Omit<Subscriber, 'id'>) => Promise<void>;
  createRental: (rental: Omit<Rental, 'id'>) => Promise<void>;
  markPaymentAsPaid: (id: string, verifiedAmount?: number) => Promise<void>;
  sendReminder: (paymentId: string) => Promise<boolean>;
  deleteMotorcycle: (id: string) => Promise<void>;
  deleteSubscriber: (id: string) => Promise<void>;
  markPaymentAsUnpaid: (id: string, reason?: string) => Promise<void>;
  terminateRental: (rentalId: string, reason?: string) => Promise<void>;
  validatePaymentIntegrity: () => Promise<PaymentValidationReport>;
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
  document: data.document,
  active: data.active,
  notes: data.notes
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
  outstandingBalance: data.outstanding_balance || 0
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
  isAmountOverridden: data.is_amount_overridden || false
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
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados na montagem do componente
  const refreshData = async () => {
    try {
      console.log('🔄 [REFRESH] Iniciando refresh de dados...');
      setLoading(true);
      setError(null);

      const [motorcyclesData, subscribersData, rentalsData, paymentsData] = await Promise.all([
        motorcycleApi.getAll(),
        subscriberApi.getAll(),
        rentalApi.getAll(),
        paymentApi.getAll()
      ]);

      console.log('📊 [REFRESH] Dados recebidos:', {
        motorcycles: motorcyclesData.length,
        subscribers: subscribersData.length,
        rentals: rentalsData.length,
        payments: paymentsData.length
      });

      const transformedMotorcycles = motorcyclesData.map(transformMotorcycle);
      const transformedSubscribers = subscribersData.map(transformSubscriber);
      const transformedRentals = rentalsData.map(transformRental);
      const transformedPayments = paymentsData.map(transformPayment);

      console.log('🔄 [REFRESH] Dados transformados:', {
        motorcycles: transformedMotorcycles.length,
        subscribers: transformedSubscribers.length,
        rentals: transformedRentals.length,
        payments: transformedPayments.length
      });

      setMotorcycles(transformedMotorcycles);
      setSubscribers(transformedSubscribers);
      setRentals(transformedRentals);
      setPayments(transformedPayments);

      console.log('✅ [REFRESH] Dados carregados e atualizados com sucesso');
    } catch (err: any) {
      console.error('❌ [REFRESH] Erro ao carregar dados:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

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
      console.log('🏍️ [CREATE MOTO] Enviando:', toSnakeCase(moto));
      const created = await motorcycleApi.create(toSnakeCase(moto));
      console.log('✅ [CREATE MOTO] Recebido do backend:', created);

      const transformed = transformMotorcycle(created);
      console.log('🔄 [CREATE MOTO] Transformado para frontend:', transformed);

      // Adicionar ao estado local E fazer refresh para garantir sincronização
      setMotorcycles(prev => [...prev, transformed]);

      // Refresh completo para garantir que está sincronizado
      setTimeout(() => refreshData(), 500);
    } catch (error: any) {
      console.error('❌ [CREATE MOTO] Erro:', error);
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
      console.log('👤 [CREATE SUBSCRIBER] Enviando:', toSnakeCase(sub));
      const created = await subscriberApi.create(toSnakeCase(sub));
      console.log('✅ [CREATE SUBSCRIBER] Recebido:', created);

      const transformed = transformSubscriber(created);
      console.log('🔄 [CREATE SUBSCRIBER] Transformado:', transformed);

      setSubscribers(prev => [...prev, transformed]);

      // Refresh completo
      setTimeout(() => refreshData(), 500);
    } catch (error: any) {
      console.error('❌ [CREATE SUBSCRIBER] Erro:', error);
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
      console.log('📝 [CREATE RENTAL] Enviando:', toSnakeCase(rental));
      const created = await rentalApi.create(toSnakeCase(rental));
      console.log('✅ [CREATE RENTAL] Recebido:', created);

      const transformed = transformRental(created);
      console.log('🔄 [CREATE RENTAL] Transformado:', transformed);

      setRentals(prev => [...prev, transformed]);

      // Refresh completo (atualiza moto, pagamentos, etc)
      await refreshData();
    } catch (error: any) {
      console.error('❌ [CREATE RENTAL] Erro:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const terminateRental = async (rentalId: string, reason?: string) => {
    try {
      const rental = rentals.find(r => r.id === rentalId);
      if (!rental) throw new Error('Aluguel não encontrado');

      // Calcular saldo devedor
      const rentalPayments = payments.filter(p => p.rentalId === rentalId);
      const totalPaid = rentalPayments
        .filter(p => p.status === PaymentStatus.PAID)
        .reduce((sum, p) => sum + p.amount, 0);
      const totalExpected = rentalPayments
        .filter(p => p.status !== PaymentStatus.CANCELLED)
        .reduce((sum, p) => sum + p.amount, 0);
      const outstandingBalance = totalExpected - totalPaid;

      if (outstandingBalance > 0) {
        const confirmed = window.confirm(
          `ATENÇÃO: Saldo devedor de R$ ${outstandingBalance.toFixed(2)}.\n` +
          `Deseja continuar com o encerramento?`
        );
        if (!confirmed) return;
      }

      const today = new Date().toISOString().split('T')[0];
      const updated = await rentalApi.update(rentalId, {
        is_active: false,
        end_date: today,
        terminated_at: new Date().toISOString(),
        termination_reason: reason,
        outstanding_balance: outstandingBalance
      });

      setRentals(prev => prev.map(r => r.id === rentalId ? transformRental(updated) : r));

      // Refresh para atualizar moto e pagamentos
      await refreshData();
    } catch (error: any) {
      console.error('Erro ao encerrar aluguel:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  const markPaymentAsPaid = async (id: string, verifiedAmount?: number) => {
    try {
      const payment = payments.find(p => p.id === id);
      if (!payment) throw new Error('Pagamento não encontrado');

      if (payment.status === PaymentStatus.PAID) {
        throw new Error('Pagamento já está marcado como pago');
      }

      if (verifiedAmount && verifiedAmount !== payment.expectedAmount) {
        const confirmed = window.confirm(
          `ATENÇÃO: Valor esperado R$ ${payment.expectedAmount.toFixed(2)}, ` +
          `mas você está marcando R$ ${verifiedAmount.toFixed(2)}. Continuar?`
        );
        if (!confirmed) return;
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

  const sendReminder = async (paymentId: string): Promise<boolean> => {
    try {
      await paymentApi.sendReminder(paymentId);

      // Atualizar contador localmente
      setPayments(prev => prev.map(p =>
        p.id === paymentId ? { ...p, reminderSentCount: p.reminderSentCount + 1 } : p
      ));

      return true;
    } catch (error: any) {
      console.error('Erro ao enviar lembrete:', error);
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
      updateMotorcycleStatus,
      addSubscriber,
      createRental,
      markPaymentAsPaid,
      sendReminder,
      deleteMotorcycle,
      deleteSubscriber,
      markPaymentAsUnpaid,
      terminateRental,
      validatePaymentIntegrity
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
