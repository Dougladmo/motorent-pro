import { getSupabaseClient } from '../config/supabase';
import { Database } from '@motorent/shared';

type Payment = Database['public']['Tables']['payments']['Row'];
type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
type PaymentUpdate = Database['public']['Tables']['payments']['Update'];

export class PaymentRepository {
  private supabase = getSupabaseClient();

  async findAll(): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .order('due_date', { ascending: false });

    if (error) throw new Error(`Failed to fetch payments: ${error.message}`);
    return data || [];
  }

  async findById(id: string): Promise<Payment | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByStatus(status: string): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('status', status)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByRentalId(rentalId: string): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('rental_id', rentalId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findFutureByRentalId(rentalId: string): Promise<Payment[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('rental_id', rentalId)
      .gte('due_date', today)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findOverduePayments(): Promise<Payment[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('status', 'Pendente')
      .lt('due_date', today);

    if (error) throw error;
    return data || [];
  }

  async create(payment: PaymentInsert): Promise<Payment> {
    const { data, error } = await this.supabase
      .from('payments')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .insert(payment)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async bulkCreate(payments: PaymentInsert[]): Promise<Payment[]> {
    if (payments.length === 0) return [];

    const { data, error } = await this.supabase
      .from('payments')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .insert(payments)
      .select();

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: PaymentUpdate): Promise<Payment> {
    const { data, error } = await this.supabase
      .from('payments')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateMany(ids: string[], updates: PaymentUpdate): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .update(updates)
      .in('id', ids)
      .select();

    if (error) throw error;
    return data || [];
  }

  async existsByRentalAndDate(rentalId: string, dueDate: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('payments')
      .select('id')
      .eq('rental_id', rentalId)
      .eq('due_date', dueDate)
      .limit(1);

    return (data?.length || 0) > 0;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
