import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Motorcycle,
  Subscriber,
  Rental,
  Payment,
  DashboardStats,
  PaymentStatus,
  MotorcycleStatus,
  PaymentStatusChange,
  MotorcycleRevenue,
  PaymentValidationReport
} from '../types';
import { MOCK_MOTORCYCLES, MOCK_PAYMENTS, MOCK_RENTALS, MOCK_SUBSCRIBERS } from '../constants';
import { storage, STORAGE_KEYS_EXPORT } from '../utils/storage';

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
  markPaymentAsPaid: (id: string, verifiedAmount?: number) => void;
  sendReminder: (paymentId: string) => Promise<boolean>;
  deleteMotorcycle: (id: string) => void;
  deleteSubscriber: (id: string) => void;

  // NOVOS MÉTODOS
  markPaymentAsUnpaid: (id: string, reason?: string) => void;
  terminateRental: (rentalId: string, reason?: string) => void;
  validatePaymentIntegrity: () => PaymentValidationReport;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Ref to prevent double-execution of cron logic in StrictMode
  const hasRunCron = useRef(false);

  // CARREGAR DADOS DO LOCALSTORAGE NA MONTAGEM
  useEffect(() => {
    const savedMotorcycles = storage.load(STORAGE_KEYS_EXPORT.MOTORCYCLES, MOCK_MOTORCYCLES);
    const savedSubscribers = storage.load(STORAGE_KEYS_EXPORT.SUBSCRIBERS, MOCK_SUBSCRIBERS);
    const savedRentals = storage.load(STORAGE_KEYS_EXPORT.RENTALS, MOCK_RENTALS);
    const savedPayments = storage.load(STORAGE_KEYS_EXPORT.PAYMENTS, MOCK_PAYMENTS);

    setMotorcycles(savedMotorcycles);
    setSubscribers(savedSubscribers);
    setRentals(savedRentals);
    setPayments(savedPayments);

    console.log('[STORAGE] Dados carregados do localStorage');
  }, []);

  // SALVAR AUTOMATICAMENTE QUANDO ESTADOS MUDAREM
  useEffect(() => {
    if (motorcycles.length > 0) {
      storage.save(STORAGE_KEYS_EXPORT.MOTORCYCLES, motorcycles);
    }
  }, [motorcycles]);

  useEffect(() => {
    if (subscribers.length > 0) {
      storage.save(STORAGE_KEYS_EXPORT.SUBSCRIBERS, subscribers);
    }
  }, [subscribers]);

  useEffect(() => {
    if (rentals.length > 0) {
      storage.save(STORAGE_KEYS_EXPORT.RENTALS, rentals);
    }
  }, [rentals]);

  useEffect(() => {
    if (payments.length > 0) {
      storage.save(STORAGE_KEYS_EXPORT.PAYMENTS, payments);
    }
  }, [payments]);

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
                // NOVO: Adicionar ao histórico de auditoria
                const statusChange: PaymentStatusChange = {
                  id: Math.random().toString(36).substring(2, 11),
                  timestamp: new Date().toISOString(),
                  fromStatus: PaymentStatus.PENDING,
                  toStatus: PaymentStatus.OVERDUE,
                  reason: 'Vencimento automático (CRON)'
                };

                return {
                  ...p,
                  status: PaymentStatus.OVERDUE,
                  previousStatus: PaymentStatus.PENDING,
                  statusHistory: [...(p.statusHistory || []), statusChange]
                };
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
                expectedAmount: rental.weeklyValue, // NOVO: armazenar valor esperado
                dueDate: dateStr,
                status: status,
                reminderSentCount: 0,
                // NOVO: Histórico inicial
                statusHistory: [{
                  id: Math.random().toString(36).substring(2, 11),
                  timestamp: new Date().toISOString(),
                  fromStatus: status,
                  toStatus: status,
                  reason: 'Criado automaticamente (CRON)'
                }]
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

      const newRental = { ...rental, id: Math.random().toString(36).substring(2, 11), outstandingBalance: 0 };
      setRentals(prev => [...prev, newRental]);
      updateMotorcycleStatus(rental.motorcycleId, MotorcycleStatus.RENTED);
      hasRunCron.current = false; // Force cron check on next render to generate initial payment
    } catch (error) {
      console.error('Erro ao criar aluguel:', error);
      throw error;
    }
  };

  const terminateRental = (rentalId: string, reason?: string): void => {
    try {
      const rental = rentals.find(r => r.id === rentalId);
      if (!rental) throw new Error('Aluguel não encontrado');
      if (!rental.isActive) throw new Error('Aluguel já está inativo');

      const today = new Date().toISOString().split('T')[0];

      // CALCULAR SALDO DEVEDOR
      const rentalPayments = payments.filter(p => p.rentalId === rentalId);
      const totalPaid = rentalPayments
        .filter(p => p.status === PaymentStatus.PAID)
        .reduce((sum, p) => sum + p.amount, 0);

      const totalExpected = rentalPayments
        .filter(p => p.status !== PaymentStatus.CANCELLED)
        .reduce((sum, p) => sum + p.amount, 0);

      const outstandingBalance = totalExpected - totalPaid;

      // ALERTAR SE HÁ DÍVIDA
      if (outstandingBalance > 0) {
        const confirmed = window.confirm(
          `ATENÇÃO: Saldo devedor de R$ ${outstandingBalance.toFixed(2)}.\n` +
          `Deseja continuar com o encerramento?`
        );
        if (!confirmed) return;
      }

      // ATUALIZAR ALUGUEL
      setRentals(prev => prev.map(r => {
        if (r.id === rentalId) {
          return {
            ...r,
            isActive: false,
            endDate: today,
            terminatedAt: new Date().toISOString(),
            terminationReason: reason,
            outstandingBalance
          };
        }
        return r;
      }));

      // LIBERAR MOTO
      updateMotorcycleStatus(rental.motorcycleId, MotorcycleStatus.AVAILABLE);

      // CANCELAR PAGAMENTOS FUTUROS PENDENTES
      setPayments(prev => prev.map(p => {
        if (p.rentalId === rentalId &&
            p.status === PaymentStatus.PENDING &&
            p.dueDate > today) {
          return {
            ...p,
            status: PaymentStatus.CANCELLED,
            statusHistory: [
              ...(p.statusHistory || []),
              {
                id: Math.random().toString(36).substring(2, 11),
                timestamp: new Date().toISOString(),
                fromStatus: PaymentStatus.PENDING,
                toStatus: PaymentStatus.CANCELLED,
                reason: `Aluguel encerrado: ${reason || 'sem motivo especificado'}`
              }
            ]
          };
        }
        return p;
      }));

      console.log(`[RENTAL] Aluguel ${rentalId} encerrado. Saldo: R$ ${outstandingBalance.toFixed(2)}`);
    } catch (error) {
      console.error('Erro ao encerrar aluguel:', error);
      throw error;
    }
  };

  const markPaymentAsPaid = (id: string, verifiedAmount?: number): void => {
    try {
      const payment = payments.find(p => p.id === id);
      if (!payment) throw new Error('Pagamento não encontrado');

      // VALIDAÇÃO 1: Prevenir dupla marcação
      if (payment.status === PaymentStatus.PAID) {
        throw new Error('Pagamento já está marcado como pago');
      }

      // VALIDAÇÃO 2: Verificar se valor difere do esperado
      if (verifiedAmount && verifiedAmount !== payment.expectedAmount) {
        const confirmed = window.confirm(
          `ATENÇÃO: Valor esperado R$ ${payment.expectedAmount.toFixed(2)}, ` +
          `mas você está marcando R$ ${verifiedAmount.toFixed(2)}. Continuar?`
        );
        if (!confirmed) return;
      }

      // VALIDAÇÃO 3: Verificar se aluguel ainda está ativo
      const rental = rentals.find(r => r.id === payment.rentalId);
      if (rental && !rental.isActive) {
        const confirmed = window.confirm(
          'ATENÇÃO: Este aluguel está inativo. Confirma pagamento?'
        );
        if (!confirmed) return;
      }

      const now = new Date().toISOString();
      const nowDate = now.split('T')[0];

      // Criar registro de auditoria
      const statusChange: PaymentStatusChange = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: now,
        fromStatus: payment.status,
        toStatus: PaymentStatus.PAID,
        reason: 'Marcado como pago manualmente'
      };

      // Atualizar pagamento
      setPayments(prev => prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            status: PaymentStatus.PAID,
            previousStatus: p.status,
            paidAt: nowDate,
            markedAsPaidAt: now,
            amount: verifiedAmount || p.amount,
            isAmountOverridden: !!verifiedAmount && verifiedAmount !== p.expectedAmount,
            statusHistory: [...(p.statusHistory || []), statusChange]
          };
        }
        return p;
      }));

      // ATUALIZAR RECEITA DA MOTO (incrementar)
      if (rental) {
        const revenueEntry: MotorcycleRevenue = {
          paymentId: payment.id,
          rentalId: payment.rentalId,
          amount: verifiedAmount || payment.amount,
          date: nowDate,
          subscriberName: payment.subscriberName
        };

        setMotorcycles(prev => prev.map(m => {
          if (m.id === rental.motorcycleId) {
            return {
              ...m,
              totalRevenue: (m.totalRevenue || 0) + (verifiedAmount || payment.amount),
              revenueHistory: [...(m.revenueHistory || []), revenueEntry]
            };
          }
          return m;
        }));
      }

      console.log(`[PAYMENT] Pagamento ${id} marcado como pago. Valor: R$ ${(verifiedAmount || payment.amount).toFixed(2)}`);
    } catch (error) {
      console.error('Erro ao marcar pagamento:', error);
      throw error;
    }
  };

  const markPaymentAsUnpaid = (id: string, reason?: string): void => {
    try {
      const payment = payments.find(p => p.id === id);
      if (!payment) throw new Error('Pagamento não encontrado');

      // VALIDAÇÃO: Apenas pagamentos PAID podem ser revertidos
      if (payment.status !== PaymentStatus.PAID) {
        throw new Error('Apenas pagamentos marcados como "Pago" podem ser revertidos');
      }

      // Calcular novo status baseado na data atual
      const today = new Date().toISOString().split('T')[0];
      const newStatus = payment.dueDate < today
        ? PaymentStatus.OVERDUE
        : PaymentStatus.PENDING;

      // Criar registro de auditoria
      const statusChange: PaymentStatusChange = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        fromStatus: PaymentStatus.PAID,
        toStatus: newStatus,
        reason: reason || 'Revertido manualmente'
      };

      // Atualizar pagamento
      setPayments(prev => prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            status: newStatus,
            previousStatus: PaymentStatus.PAID,
            paidAt: undefined,
            markedAsPaidAt: undefined,
            statusHistory: [...(p.statusHistory || []), statusChange]
          };
        }
        return p;
      }));

      // ATUALIZAR RECEITA DA MOTO (decrementar)
      const rental = rentals.find(r => r.id === payment.rentalId);
      if (rental) {
        setMotorcycles(prev => prev.map(m => {
          if (m.id === rental.motorcycleId) {
            return {
              ...m,
              totalRevenue: (m.totalRevenue || 0) - payment.amount,
              revenueHistory: (m.revenueHistory || []).filter(
                r => r.paymentId !== payment.id
              )
            };
          }
          return m;
        }));
      }

      console.log(`[ROLLBACK] Pagamento ${id} revertido para ${newStatus}`);
    } catch (error) {
      console.error('Erro ao reverter pagamento:', error);
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

  const validatePaymentIntegrity = (): PaymentValidationReport => {
    const issues: any[] = [];

    rentals.forEach(rental => {
      const subscriber = subscribers.find(s => s.id === rental.subscriberId);

      // VERIFICAR PAGAMENTOS FALTANTES
      if (rental.isActive) {
        const [y, m, d] = rental.startDate.split('-').map(Number);
        let checkDate = new Date(y, m - 1, d);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expectedWeeks: string[] = [];
        while (checkDate <= today) {
          expectedWeeks.push(checkDate.toISOString().split('T')[0]);
          checkDate.setDate(checkDate.getDate() + 7);
        }

        const actualPaymentDates = payments
          .filter(p => p.rentalId === rental.id)
          .map(p => p.dueDate);

        const missingWeeks = expectedWeeks.filter(
          week => !actualPaymentDates.includes(week)
        );

        if (missingWeeks.length > 0) {
          issues.push({
            type: 'MISSING_PAYMENT',
            severity: 'HIGH',
            rentalId: rental.id,
            subscriberName: subscriber?.name,
            details: `Faltam ${missingWeeks.length} semanas de pagamento`,
            missingDates: missingWeeks
          });
        }
      }

      // VERIFICAR VALORES DIVERGENTES
      payments
        .filter(p => p.rentalId === rental.id && !p.isAmountOverridden)
        .forEach(payment => {
          if (payment.amount !== rental.weeklyValue) {
            issues.push({
              type: 'AMOUNT_MISMATCH',
              severity: 'MEDIUM',
              paymentId: payment.id,
              details: `Valor esperado: R$ ${rental.weeklyValue}, registrado: R$ ${payment.amount}`,
              expected: rental.weeklyValue,
              actual: payment.amount
            });
          }
        });

      // VERIFICAR PAGAMENTOS ÓRFÃOS
      if (!rental.isActive) {
        const orphanedPayments = payments.filter(
          p => p.rentalId === rental.id &&
          p.status !== PaymentStatus.PAID &&
          p.status !== PaymentStatus.CANCELLED
        );

        if (orphanedPayments.length > 0) {
          issues.push({
            type: 'ORPHANED_PAYMENT',
            severity: 'HIGH',
            rentalId: rental.id,
            subscriberName: subscriber?.name,
            details: `${orphanedPayments.length} pagamentos pendentes em aluguel inativo`,
            paymentIds: orphanedPayments.map(p => p.id)
          });
        }
      }
    });

    return {
      hasIssues: issues.length > 0,
      issueCount: issues.length,
      issues,
      timestamp: new Date().toISOString()
    };
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
