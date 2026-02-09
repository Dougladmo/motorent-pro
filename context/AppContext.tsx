import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Motorcycle, Subscriber, Rental, Payment, DashboardStats, PaymentStatus, MotorcycleStatus } from '../types';
import { MOCK_MOTORCYCLES, MOCK_PAYMENTS, MOCK_RENTALS, MOCK_SUBSCRIBERS } from '../constants';

interface AppContextType {
  motorcycles: Motorcycle[];
  subscribers: Subscriber[];
  rentals: Rental[];
  payments: Payment[];
  stats: DashboardStats;
  addMotorcycle: (moto: Omit<Motorcycle, 'id'>) => void;
  updateMotorcycleStatus: (id: string, status: MotorcycleStatus) => void;
  addSubscriber: (sub: Omit<Subscriber, 'id'>) => void;
  createRental: (rental: Omit<Rental, 'id'>) => void;
  markPaymentAsPaid: (id: string) => void;
  sendReminder: (paymentId: string) => Promise<boolean>;
  deleteMotorcycle: (id: string) => void;
  deleteSubscriber: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>(MOCK_MOTORCYCLES);
  const [subscribers, setSubscribers] = useState<Subscriber[]>(MOCK_SUBSCRIBERS);
  const [rentals, setRentals] = useState<Rental[]>(MOCK_RENTALS);
  const [payments, setPayments] = useState<Payment[]>(MOCK_PAYMENTS);
  
  // Ref to prevent double-execution of cron logic in StrictMode
  const hasRunCron = useRef(false);

  // Frontend "Cron Job" to generate weekly payments
  useEffect(() => {
    if (hasRunCron.current) return;
    hasRunCron.current = true;

    const runFrontendCron = () => {
      console.log('[CRON] Verificando cobranças recorrentes...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      setPayments(currentPayments => {
        // STEP 1: Update existing PENDING payments to OVERDUE if they are past due
        // If today is Thursday and due date was Wednesday, it should be OVERDUE.
        const updatedPayments = currentPayments.map(p => {
            if (p.status === PaymentStatus.PENDING && p.dueDate < todayStr) {
                return { ...p, status: PaymentStatus.OVERDUE };
            }
            return p;
        });

        const newPayments: Payment[] = [];

        rentals.forEach(rental => {
          if (!rental.isActive) return;

          const subscriber = subscribers.find(s => s.id === rental.subscriberId);
          if (!subscriber) return;

          // Parse start date (YYYY-MM-DD)
          const [y, m, d] = rental.startDate.split('-').map(Number);
          let nextDueDate = new Date(y, m - 1, d);
          
          // Safety: Don't generate payments older than 3 months
          const limitDate = new Date();
          limitDate.setMonth(limitDate.getMonth() - 3);
          if (nextDueDate < limitDate) nextDueDate = limitDate;

          // Generate payments up to today + 7 days (lookahead)
          const lookaheadDate = new Date(today);
          lookaheadDate.setDate(lookaheadDate.getDate() + 7);

          while (nextDueDate <= lookaheadDate) {
            const dateStr = nextDueDate.toISOString().split('T')[0];

            // Check if payment already exists in updated list or new list
            const exists = updatedPayments.some(p => p.rentalId === rental.id && p.dueDate === dateStr) ||
                           newPayments.some(p => p.rentalId === rental.id && p.dueDate === dateStr);

            if (!exists) {
              const isPast = dateStr < todayStr;
              
              // Status Logic: 
              // Past dates = OVERDUE
              // Today or Future = PENDING
              const status = isPast ? PaymentStatus.OVERDUE : PaymentStatus.PENDING;
              
              const newPayment: Payment = {
                id: Math.random().toString(36).substring(2, 11),
                rentalId: rental.id,
                subscriberName: subscriber.name,
                amount: rental.weeklyValue,
                dueDate: dateStr,
                status: status,
                reminderSentCount: 0
              };

              newPayments.push(newPayment);

              // Simulating the "Auto-call to WhatsApp Microservice" for today's payments
              if (dateStr === todayStr) {
                // Calculate total debt for this subscriber to include in the message
                const subscriberRentals = rentals.filter(r => r.subscriberId === subscriber.id).map(r => r.id);
                const existingDebt = updatedPayments
                    .filter(p => subscriberRentals.includes(p.rentalId) && p.status !== PaymentStatus.PAID)
                    .reduce((sum, p) => sum + p.amount, 0);
                
                const totalDue = existingDebt + newPayment.amount;

                console.log(`[CRON - WPP SERVICE] Disparando notificação automática para ${subscriber.name}.`);
                console.log(`[WPP MSG] Olá ${subscriber.name}! Nova fatura gerada.`);
                console.log(`[WPP MSG] Total acumulado a pagar: R$ ${totalDue.toFixed(2)}`);
                
                newPayment.reminderSentCount = 1; // Mark as sent
              }
            }

            // Next week
            nextDueDate.setDate(nextDueDate.getDate() + 7);
          }
        });

        // Only update state if changes occurred
        const hasUpdates = JSON.stringify(updatedPayments) !== JSON.stringify(currentPayments);
        if (newPayments.length > 0 || hasUpdates) {
          console.log(`[CRON] Sincronização concluída. ${newPayments.length} novos, status atualizados.`);
          return [...newPayments, ...updatedPayments];
        }
        
        return currentPayments;
      });
    };

    runFrontendCron();
  }, [rentals, subscribers]); // Re-run if rentals change

  // Derived state for dashboard
  const stats: DashboardStats = {
    totalRevenue: payments.filter(p => p.status === PaymentStatus.PAID).reduce((acc, curr) => acc + curr.amount, 0),
    totalPending: payments.filter(p => p.status === PaymentStatus.PENDING).reduce((acc, curr) => acc + curr.amount, 0),
    totalOverdue: payments.filter(p => p.status === PaymentStatus.OVERDUE).reduce((acc, curr) => acc + curr.amount, 0),
    activeRentals: rentals.filter(r => r.isActive).length,
    availableBikes: motorcycles.filter(m => m.status === MotorcycleStatus.AVAILABLE).length
  };

  const addMotorcycle = (moto: Omit<Motorcycle, 'id'>) => {
    try {
      const newMoto = { ...moto, id: Math.random().toString(36).substring(2, 11) };
      setMotorcycles(prev => [...prev, newMoto]);
    } catch (error) {
      console.error('Erro ao adicionar moto:', error);
      throw error;
    }
  };

  const updateMotorcycleStatus = (id: string, status: MotorcycleStatus) => {
    try {
      setMotorcycles(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    } catch (error) {
      console.error('Erro ao atualizar status da moto:', error);
      throw error;
    }
  };

  const deleteMotorcycle = (id: string) => {
    try {
      const moto = motorcycles.find(m => m.id === id);
      if (moto?.status === MotorcycleStatus.RENTED) {
        throw new Error('Não é possível excluir moto alugada');
      }
      setMotorcycles(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('Erro ao excluir moto:', error);
      throw error;
    }
  };

  const addSubscriber = (sub: Omit<Subscriber, 'id'>) => {
    try {
      const newSub = { ...sub, id: Math.random().toString(36).substring(2, 11) };
      setSubscribers(prev => [...prev, newSub]);
    } catch (error) {
      console.error('Erro ao adicionar assinante:', error);
      throw error;
    }
  };

  const deleteSubscriber = (id: string) => {
    try {
      const activeRentalsCount = rentals.filter(r => r.subscriberId === id && r.isActive).length;
      if (activeRentalsCount > 0) {
        throw new Error('Não é possível excluir assinante com aluguéis ativos');
      }
      setSubscribers(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Erro ao excluir assinante:', error);
      throw error;
    }
  }

  const createRental = (rental: Omit<Rental, 'id'>) => {
    try {
      const moto = motorcycles.find(m => m.id === rental.motorcycleId);
      if (moto?.status !== MotorcycleStatus.AVAILABLE) {
        throw new Error('Moto não está disponível para aluguel');
      }

      const subscriber = subscribers.find(s => s.id === rental.subscriberId);
      if (!subscriber) {
        throw new Error('Assinante não encontrado');
      }

      const newRental = { ...rental, id: Math.random().toString(36).substring(2, 11) };
      setRentals(prev => [...prev, newRental]);
      updateMotorcycleStatus(rental.motorcycleId, MotorcycleStatus.RENTED);
      hasRunCron.current = false; // Force cron check on next render to generate initial payment
    } catch (error) {
      console.error('Erro ao criar aluguel:', error);
      throw error;
    }
  };

  const markPaymentAsPaid = (id: string) => {
    try {
      const payment = payments.find(p => p.id === id);
      if (!payment) {
        throw new Error('Pagamento não encontrado');
      }

      setPayments(prev => prev.map(p =>
        p.id === id ? { ...p, status: PaymentStatus.PAID, paidAt: new Date().toISOString().split('T')[0] } : p
      ));
    } catch (error) {
      console.error('Erro ao marcar pagamento como pago:', error);
      throw error;
    }
  };

  const sendReminder = async (paymentId: string): Promise<boolean> => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return false;

    // Aggregating Debt Logic
    const rental = rentals.find(r => r.id === payment.rentalId);
    let totalDebt = payment.amount;
    let debtCount = 1;

    if (rental) {
        const subId = rental.subscriberId;
        // Find all active rentals for this subscriber
        const subRentals = rentals.filter(r => r.subscriberId === subId).map(r => r.id);
        
        // Find all unpaid payments
        const debtPayments = payments.filter(p => 
            subRentals.includes(p.rentalId) && 
            (p.status === PaymentStatus.PENDING || p.status === PaymentStatus.OVERDUE)
        );
        
        totalDebt = debtPayments.reduce((acc, curr) => acc + curr.amount, 0);
        debtCount = debtPayments.length;
    }

    // Simulate API call to WhatsApp Microservice
    console.log(`[API] Calling WhatsApp Microservice for payment ${paymentId}...`);
    console.log(`[WPP] Enviando para: ${payment.subscriberName} (${payment.status})`);
    console.log(`[WPP] Corpo da Mensagem:`);
    console.log(`"Olá ${payment.subscriberName},`);
    if (debtCount > 1) {
        console.log(`Consta um total de ${debtCount} faturas em aberto no valor de R$ ${totalDebt.toFixed(2)}.`);
    } else {
        console.log(`Lembrete de pagamento no valor de R$ ${totalDebt.toFixed(2)}.`);
    }
    console.log(`Fatura atual vence em: ${payment.dueDate}"`);

    return new Promise((resolve) => {
      setTimeout(() => {
        setPayments(prev => prev.map(p => 
          p.id === paymentId ? { ...p, reminderSentCount: p.reminderSentCount + 1 } : p
        ));
        resolve(true);
      }, 1000);
    });
  };

  return (
    <AppContext.Provider value={{
      motorcycles,
      subscribers,
      rentals,
      payments,
      stats,
      addMotorcycle,
      updateMotorcycleStatus,
      addSubscriber,
      createRental,
      markPaymentAsPaid,
      sendReminder,
      deleteMotorcycle,
      deleteSubscriber
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
