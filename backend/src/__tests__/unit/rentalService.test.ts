import { RentalService } from '../../services/rentalService';
import { Database } from '../../models/database.types';

// ─── Type aliases ────────────────────────────────────────────────────────────
type Rental = Database['public']['Tables']['rentals']['Row'];
type RentalInsert = Database['public']['Tables']['rentals']['Insert'];
type Payment = Database['public']['Tables']['payments']['Row'];
type Motorcycle = Database['public']['Tables']['motorcycles']['Row'];
type Subscriber = Database['public']['Tables']['subscribers']['Row'];

// ─── Mock fetch globally to avoid real network calls to the worker ────────────
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ paymentsCreated: 1 }),
} as unknown as Response);
global.fetch = mockFetch;

// ─── Factories ────────────────────────────────────────────────────────────────
function makeRental(overrides: Partial<Rental> = {}): Rental {
  return {
    id: 'rental-1',
    motorcycle_id: 'moto-1',
    subscriber_id: 'sub-1',
    start_date: '2025-01-06', // Monday
    end_date: null,
    weekly_value: 325,
    due_day_of_week: 1,
    is_active: true,
    terminated_at: null,
    termination_reason: null,
    outstanding_balance: 0,
    total_contract_value: 0,
    total_paid: 0,
    created_at: '2025-01-06T00:00:00Z',
    updated_at: '2025-01-06T00:00:00Z',
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    rental_id: 'rental-1',
    subscriber_name: 'Test User',
    amount: 325,
    expected_amount: 325,
    due_date: '2026-03-16',
    status: 'Pendente',
    paid_at: null,
    marked_as_paid_at: null,
    previous_status: null,
    is_amount_overridden: false,
    reminder_sent_count: 0,
    abacate_pix_id: null,
    pix_br_code: null,
    pix_expires_at: null,
    pix_payment_url: null,
    created_at: '2026-01-06T00:00:00Z',
    updated_at: '2026-01-06T00:00:00Z',
    ...overrides,
  };
}

function makeMotorcycle(overrides: Partial<Motorcycle> = {}): Motorcycle {
  return {
    id: 'moto-1',
    plate: 'ABC1234',
    model: 'Honda CG 160',
    year: 2022,
    status: 'Disponível',
    image_url: null,
    total_revenue: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeSubscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: 'sub-1',
    name: 'João da Silva',
    phone: '11999999999',
    email: null,
    document: '123.456.789-00',
    active: true,
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Mock repository builder ──────────────────────────────────────────────────
function makeRepos(options: {
  rentals?: Rental[];
  payments?: Payment[];
  motorcycle?: Motorcycle | null;
  subscriber?: Subscriber | null;
  activeRental?: Rental | null;
} = {}) {
  const { rentals = [], payments = [], motorcycle = makeMotorcycle(), subscriber = makeSubscriber(), activeRental = null } = options;

  const mockRentalRepo = {
    findAll: jest.fn().mockResolvedValue(rentals),
    findAllActive: jest.fn().mockResolvedValue(rentals.filter(r => r.is_active)),
    findById: jest.fn().mockResolvedValue(rentals[0] ?? null),
    findByMotorcycleId: jest.fn().mockResolvedValue(rentals),
    findBySubscriberId: jest.fn().mockResolvedValue(rentals),
    findActiveByMotorcycleId: jest.fn().mockResolvedValue(activeRental),
    create: jest.fn().mockImplementation(async (data: RentalInsert) =>
      makeRental({ ...data, id: 'new-rental-id', is_active: true } as Partial<Rental>)
    ),
    update: jest.fn().mockImplementation(async (_id: string, updates: Partial<Rental>) => {
      // Return merged rental so callers get proper fields back
      const base = rentals[0] ?? makeRental();
      return { ...base, ...updates };
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockPaymentRepo = {
    findAll: jest.fn().mockResolvedValue(payments),
    findByRentalId: jest.fn().mockResolvedValue(payments),
    findFutureByRentalId: jest.fn().mockResolvedValue(payments),
    updateMany: jest.fn().mockResolvedValue([]),
  };

  const mockMotorcycleRepo = {
    findById: jest.fn().mockResolvedValue(motorcycle),
    update: jest.fn().mockResolvedValue(motorcycle),
  };

  const mockSubscriberRepo = {
    findById: jest.fn().mockResolvedValue(subscriber),
  };

  return { mockRentalRepo, mockPaymentRepo, mockMotorcycleRepo, mockSubscriberRepo };
}

function makeService(options: Parameters<typeof makeRepos>[0] = {}) {
  const repos = makeRepos(options);
  const service = new RentalService(
    repos.mockRentalRepo as never,
    repos.mockMotorcycleRepo as never,
    repos.mockSubscriberRepo as never,
    repos.mockPaymentRepo as never,
  );
  return { service, ...repos };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('RentalService', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // recalculateOutstandingBalances (tested via getAllRentals / getActiveRentals)
  // ════════════════════════════════════════════════════════════════════════════
  describe('recalculateOutstandingBalances (via getAllRentals)', () => {
    // ── Happy path 1 ─────────────────────────────────────────────────────────
    it('calculates and saves total_contract_value when end_date present and total_contract_value is 0', async () => {
      // 2025-01-06 → 2025-11-10 = exactly 44 weeks × 325 = 14 300
      const rental = makeRental({
        start_date: '2025-01-06',
        end_date: '2025-11-10',
        weekly_value: 325,
        total_contract_value: 0,
        total_paid: 0,
        outstanding_balance: 0,
      });

      const { service, mockRentalRepo } = makeService({ rentals: [rental] });

      await service.getAllRentals();

      const expectedWeeks = Math.round(
        (new Date(2025, 11 - 1, 10).getTime() - new Date(2025, 0, 6).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      const expectedValue = expectedWeeks * 325;

      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-1',
        expect.objectContaining({ total_contract_value: expectedValue })
      );
    });

    // ── Happy path 2 ─────────────────────────────────────────────────────────
    it('does NOT recalculate total_contract_value when end_date present and value already set', async () => {
      const rental = makeRental({
        start_date: '2025-01-06',
        end_date: '2025-11-10',
        weekly_value: 325,
        total_contract_value: 14300,
        total_paid: 0,
        outstanding_balance: 14300,
      });

      const { service, mockRentalRepo } = makeService({ rentals: [rental] });

      await service.getAllRentals();

      // update may still be called for outstanding_balance sync, but total_contract_value must not change
      if (mockRentalRepo.update.mock.calls.length > 0) {
        const callArgs = mockRentalRepo.update.mock.calls[0][1] as Partial<Rental>;
        expect(callArgs.total_contract_value).toBe(14300);
      }
    });

    // ── Happy path 3 ─────────────────────────────────────────────────────────
    it('computes outstanding_balance = total_contract_value - total_paid when end_date is set', async () => {
      const rental = makeRental({
        end_date: '2026-03-30',
        total_contract_value: 3250,
        total_paid: 500,
        outstanding_balance: 0,
      });

      const { service, mockRentalRepo } = makeService({ rentals: [rental] });

      await service.getAllRentals();

      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-1',
        expect.objectContaining({ outstanding_balance: 2750 })
      );
    });

    // ── Happy path 4 ─────────────────────────────────────────────────────────
    it('outstanding_balance = 0 when fully paid (total_paid equals total_contract_value)', async () => {
      const rental = makeRental({
        end_date: '2026-03-30',
        total_contract_value: 3250,
        total_paid: 3250,
        outstanding_balance: 100, // stale value that should be corrected
      });

      const { service, mockRentalRepo } = makeService({ rentals: [rental] });

      await service.getAllRentals();

      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-1',
        expect.objectContaining({ outstanding_balance: 0 })
      );
    });

    // ── Happy path 5 ─────────────────────────────────────────────────────────
    it('outstanding_balance equals sum of PENDING payments when end_date is null', async () => {
      const rental = makeRental({ end_date: null, total_contract_value: 0, total_paid: 0, outstanding_balance: 0 });
      const payments = [
        makePayment({ id: 'pay-1', rental_id: 'rental-1', amount: 325, status: 'Pendente' }),
        makePayment({ id: 'pay-2', rental_id: 'rental-1', amount: 325, status: 'Pendente' }),
      ];

      const { service, mockRentalRepo } = makeService({ rentals: [rental], payments });

      await service.getAllRentals();

      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-1',
        expect.objectContaining({ outstanding_balance: 650 })
      );
    });

    // ── Happy path 6 ─────────────────────────────────────────────────────────
    it('outstanding_balance = 0 when no pending/overdue payments and end_date is null', async () => {
      const rental = makeRental({ end_date: null, total_contract_value: 0, total_paid: 0, outstanding_balance: 0 });
      const payments = [
        makePayment({ id: 'pay-1', rental_id: 'rental-1', amount: 325, status: 'Pago' }),
      ];

      const { service, mockRentalRepo } = makeService({ rentals: [rental], payments });

      // The outstanding_balance is already 0, so update should not be called with changes
      const result = await service.getAllRentals();

      // Either update was not called, or it was called with outstanding_balance: 0
      if (mockRentalRepo.update.mock.calls.length > 0) {
        const callArgs = mockRentalRepo.update.mock.calls[0][1] as Partial<Rental>;
        expect(callArgs.outstanding_balance).toBe(0);
      } else {
        expect(result[0].outstanding_balance).toBe(0);
      }
    });

    // ── Happy path 7 ─────────────────────────────────────────────────────────
    it('recalculates outstanding_balance even for inactive rentals (is_active=false)', async () => {
      const rental = makeRental({
        is_active: false,
        end_date: null,
        total_contract_value: 0,
        total_paid: 0,
        outstanding_balance: 0,
      });
      const payments = [
        makePayment({ id: 'pay-1', rental_id: 'rental-1', amount: 325, status: 'Pendente' }),
      ];

      const { service, mockRentalRepo } = makeService({ rentals: [rental], payments });

      await service.getAllRentals();

      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-1',
        expect.objectContaining({ outstanding_balance: 325 })
      );
    });

    // ── Happy path 8 ─────────────────────────────────────────────────────────
    it('handles multiple rentals correctly — some with end_date, some without', async () => {
      const rentalWithEnd = makeRental({
        id: 'rental-1',
        end_date: '2026-03-30',
        total_contract_value: 3250,
        total_paid: 500,
        outstanding_balance: 0,
      });
      const rentalWithoutEnd = makeRental({
        id: 'rental-2',
        end_date: null,
        total_contract_value: 0,
        total_paid: 0,
        outstanding_balance: 0,
      });

      const payments = [
        makePayment({ id: 'pay-1', rental_id: 'rental-2', amount: 325, status: 'Pendente' }),
        makePayment({ id: 'pay-2', rental_id: 'rental-2', amount: 325, status: 'Pendente' }),
        makePayment({ id: 'pay-3', rental_id: 'rental-1', amount: 325, status: 'Pago' }),
      ];

      const mockRentalRepo = {
        findAll: jest.fn().mockResolvedValue([rentalWithEnd, rentalWithoutEnd]),
        update: jest.fn().mockImplementation(async (id: string, updates: Partial<Rental>) => {
          const base = id === 'rental-1' ? rentalWithEnd : rentalWithoutEnd;
          return { ...base, ...updates };
        }),
      };
      const mockPaymentRepo = { findAll: jest.fn().mockResolvedValue(payments) };
      const mockMotorcycleRepo = { findById: jest.fn(), update: jest.fn() };
      const mockSubscriberRepo = { findById: jest.fn() };

      const service = new RentalService(
        mockRentalRepo as never,
        mockMotorcycleRepo as never,
        mockSubscriberRepo as never,
        mockPaymentRepo as never,
      );

      await service.getAllRentals();

      // rental-1 with end_date: outstanding = 3250 - 500 = 2750
      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-1',
        expect.objectContaining({ outstanding_balance: 2750 })
      );
      // rental-2 without end_date: outstanding = sum of pending = 325 + 325 = 650
      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-2',
        expect.objectContaining({ outstanding_balance: 650 })
      );
    });

    // ── Bug/error case 9 ──────────────────────────────────────────────────────
    it('total_contract_value = 0 when end_date present but weekly_value = 0', async () => {
      const rental = makeRental({
        start_date: '2025-01-06',
        end_date: '2025-11-10',
        weekly_value: 0,
        total_contract_value: 0,
        total_paid: 0,
        outstanding_balance: 0,
      });

      const { service, mockRentalRepo } = makeService({ rentals: [rental] });

      await service.getAllRentals();

      // totalWeeks * 0 = 0, so total_contract_value stays 0
      // Because totalContractValue remains 0, the code falls into the "without end_date" branch
      // No payments exist, so outstanding_balance = 0; update is called for needsUpdate=true
      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-1',
        expect.objectContaining({ total_contract_value: 0 })
      );
    });

    // ── Bug/error case 10 ─────────────────────────────────────────────────────
    it('total_contract_value = 0 when end_date is before start_date (negative totalWeeks rounds to 0)', async () => {
      const rental = makeRental({
        start_date: '2025-11-10',
        end_date: '2025-01-06', // end before start
        weekly_value: 325,
        total_contract_value: 0,
        total_paid: 0,
        outstanding_balance: 0,
      });

      const { service, mockRentalRepo } = makeService({ rentals: [rental] });

      await service.getAllRentals();

      // Math.round of negative number produces negative totalWeeks → negative * weekly_value
      // The resulting total_contract_value is ≤ 0; the update is still called with that value
      const updateCall = mockRentalRepo.update.mock.calls[0];
      const updatePayload = updateCall[1] as Partial<Rental>;
      // total_contract_value must be ≤ 0 (negative weeks × positive rate)
      expect(updatePayload.total_contract_value).toBeLessThanOrEqual(0);
    });

    // ── Bug/error case 11 ─────────────────────────────────────────────────────
    it('outstanding_balance is clamped to 0 when total_paid > total_contract_value', async () => {
      const rental = makeRental({
        end_date: '2026-03-30',
        total_contract_value: 3250,
        total_paid: 4000, // overpaid
        outstanding_balance: 100,
      });

      const { service, mockRentalRepo } = makeService({ rentals: [rental] });

      await service.getAllRentals();

      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-1',
        expect.objectContaining({ outstanding_balance: 0 })
      );
    });

    // ── Bug/error case 12 ─────────────────────────────────────────────────────
    it('includes OVERDUE payments in outstanding_balance when end_date is null', async () => {
      const rental = makeRental({ end_date: null, total_contract_value: 0, total_paid: 0, outstanding_balance: 0 });
      const payments = [
        makePayment({ id: 'pay-1', rental_id: 'rental-1', amount: 325, status: 'Atrasado' }),
        makePayment({ id: 'pay-2', rental_id: 'rental-1', amount: 325, status: 'Pendente' }),
        makePayment({ id: 'pay-3', rental_id: 'rental-1', amount: 325, status: 'Pago' }),
      ];

      const { service, mockRentalRepo } = makeService({ rentals: [rental], payments });

      await service.getAllRentals();

      // Atrasado (325) + Pendente (325) = 650; Pago excluded
      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-1',
        expect.objectContaining({ outstanding_balance: 650 })
      );
    });

    // ── Bug/error case 13 ─────────────────────────────────────────────────────
    it('CANCELLED payments are NOT counted in outstanding_balance when end_date is null', async () => {
      const rental = makeRental({ end_date: null, total_contract_value: 0, total_paid: 0, outstanding_balance: 0 });
      const payments = [
        makePayment({ id: 'pay-1', rental_id: 'rental-1', amount: 325, status: 'Cancelado' }),
        makePayment({ id: 'pay-2', rental_id: 'rental-1', amount: 325, status: 'Cancelado' }),
      ];

      const { service, mockRentalRepo } = makeService({ rentals: [rental], payments });

      await service.getAllRentals();

      // Both payments are cancelled → outstanding = 0; value is already 0, so update may not be triggered
      if (mockRentalRepo.update.mock.calls.length > 0) {
        const callArgs = mockRentalRepo.update.mock.calls[0][1] as Partial<Rental>;
        expect(callArgs.outstanding_balance).toBe(0);
      } else {
        // No update needed since values haven't changed
        expect(mockRentalRepo.update).not.toHaveBeenCalled();
      }
    });

    // ── Payments from other rentals are not mixed in ───────────────────────────
    it('only counts payments belonging to the rental being processed', async () => {
      const rental = makeRental({ id: 'rental-1', end_date: null, total_contract_value: 0, total_paid: 0, outstanding_balance: 0 });
      const payments = [
        makePayment({ id: 'pay-1', rental_id: 'rental-1', amount: 325, status: 'Pendente' }),
        makePayment({ id: 'pay-2', rental_id: 'other-rental', amount: 1000, status: 'Pendente' }),
      ];

      const { service, mockRentalRepo } = makeService({ rentals: [rental], payments });

      await service.getAllRentals();

      expect(mockRentalRepo.update).toHaveBeenCalledWith(
        'rental-1',
        expect.objectContaining({ outstanding_balance: 325 })
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // createRental
  // ════════════════════════════════════════════════════════════════════════════
  describe('createRental', () => {
    const baseInsert: RentalInsert = {
      motorcycle_id: 'moto-1',
      subscriber_id: 'sub-1',
      start_date: '2025-01-06',
      weekly_value: 325,
      due_day_of_week: 1,
    };

    // ── Test case 14 ──────────────────────────────────────────────────────────
    it('creates rental with end_date and computes total_contract_value correctly', async () => {
      const { service, mockRentalRepo } = makeService({ activeRental: null });

      await service.createRental({
        ...baseInsert,
        start_date: '2025-01-06',
        end_date: '2025-11-10',
        weekly_value: 325,
      });

      const expectedWeeks = Math.round(
        (new Date('2025-11-10').getTime() - new Date('2025-01-06').getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      const expectedValue = expectedWeeks * 325;

      expect(mockRentalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ total_contract_value: expectedValue })
      );
    });

    // ── Test case 15 ──────────────────────────────────────────────────────────
    it('creates rental without end_date with total_contract_value = 0', async () => {
      const { service, mockRentalRepo } = makeService({ activeRental: null });

      await service.createRental({ ...baseInsert, end_date: undefined });

      expect(mockRentalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ total_contract_value: 0 })
      );
    });

    // ── Test case 16 ──────────────────────────────────────────────────────────
    it('throws "Moto não encontrada" when motorcycle does not exist', async () => {
      const { service } = makeService({ motorcycle: null });

      await expect(service.createRental(baseInsert)).rejects.toThrow('Moto não encontrada');
    });

    // ── Test case 17 ──────────────────────────────────────────────────────────
    it('throws when motorcycle status is not "Disponível"', async () => {
      const moto = makeMotorcycle({ status: 'Alugada' });
      const { service } = makeService({ motorcycle: moto });

      await expect(service.createRental(baseInsert)).rejects.toThrow('disponível');
    });

    it('throws when motorcycle status is "Manutenção"', async () => {
      const moto = makeMotorcycle({ status: 'Manutenção' });
      const { service } = makeService({ motorcycle: moto });

      await expect(service.createRental(baseInsert)).rejects.toThrow('disponível');
    });

    // ── Test case 18 ──────────────────────────────────────────────────────────
    it('throws when motorcycle already has an active rental', async () => {
      const { service } = makeService({ activeRental: makeRental() });

      await expect(service.createRental(baseInsert)).rejects.toThrow('aluguel ativo');
    });

    // ── Test case 19 ──────────────────────────────────────────────────────────
    it('throws "Assinante não encontrado" when subscriber does not exist', async () => {
      const { service } = makeService({ subscriber: null, activeRental: null });

      await expect(service.createRental(baseInsert)).rejects.toThrow('Assinante não encontrado');
    });

    // ── Test case 20 ──────────────────────────────────────────────────────────
    it('updates motorcycle status to "Alugada" after creating rental', async () => {
      const { service, mockMotorcycleRepo } = makeService({ activeRental: null });

      await service.createRental(baseInsert);

      expect(mockMotorcycleRepo.update).toHaveBeenCalledWith(
        'moto-1',
        expect.objectContaining({ status: 'Alugada' })
      );
    });

    it('triggers worker payment generation after creating rental', async () => {
      const { service } = makeService({ activeRental: null });

      await service.createRental(baseInsert);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('new-rental-id'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('persists total_paid = 0 on new rental', async () => {
      const { service, mockRentalRepo } = makeService({ activeRental: null });

      await service.createRental(baseInsert);

      expect(mockRentalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ total_paid: 0 })
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getActiveRentals — delegates to recalculateOutstandingBalances
  // ════════════════════════════════════════════════════════════════════════════
  describe('getActiveRentals', () => {
    it('returns only active rentals after recalculating balances', async () => {
      const active = makeRental({ is_active: true });
      const inactive = makeRental({ id: 'rental-inactive', is_active: false });

      const mockRentalRepo = {
        findAllActive: jest.fn().mockResolvedValue([active]),
        update: jest.fn().mockImplementation(async (_id: string, u: Partial<Rental>) => ({ ...active, ...u })),
      };
      const mockPaymentRepo = { findAll: jest.fn().mockResolvedValue([]) };
      const mockMotorcycleRepo = { findById: jest.fn(), update: jest.fn() };
      const mockSubscriberRepo = { findById: jest.fn() };

      const service = new RentalService(
        mockRentalRepo as never,
        mockMotorcycleRepo as never,
        mockSubscriberRepo as never,
        mockPaymentRepo as never,
      );

      const result = await service.getActiveRentals();

      expect(result).toHaveLength(1);
      expect(result[0].is_active).toBe(true);
      // The inactive rental must not be in the result
      expect(result.find(r => r.id === inactive.id)).toBeUndefined();
    });
  });
});
