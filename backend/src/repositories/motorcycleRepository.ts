import { getSupabaseClient } from '../config/supabase';
import { Database } from '../shared';

type Motorcycle = Database['public']['Tables']['motorcycles']['Row'];
type MotorcycleInsert = Database['public']['Tables']['motorcycles']['Insert'];
type MotorcycleUpdate = Database['public']['Tables']['motorcycles']['Update'];
type MotorcycleRevenueInsert = Database['public']['Tables']['motorcycle_revenue']['Insert'];

export class MotorcycleRepository {
  private supabase = getSupabaseClient();

  async findAll(): Promise<Motorcycle[]> {
    const { data, error } = await this.supabase
      .from('motorcycles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch motorcycles: ${error.message}`);
    return data || [];
  }

  async findById(id: string): Promise<Motorcycle | null> {
    const { data, error } = await this.supabase
      .from('motorcycles')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByPlate(plate: string): Promise<Motorcycle | null> {
    const { data, error } = await this.supabase
      .from('motorcycles')
      .select('*')
      .eq('plate', plate)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByStatus(status: string): Promise<Motorcycle[]> {
    const { data, error } = await this.supabase
      .from('motorcycles')
      .select('*')
      .eq('status', status);

    if (error) throw error;
    return data || [];
  }

  async create(motorcycle: MotorcycleInsert): Promise<Motorcycle> {
    const { data, error } = await this.supabase
      .from('motorcycles')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .insert(motorcycle)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: MotorcycleUpdate): Promise<Motorcycle> {
    const { data, error } = await this.supabase
      .from('motorcycles')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('motorcycles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async incrementRevenue(
    motorcycleId: string,
    amount: number,
    revenueData: {
      payment_id: string;
      rental_id: string;
      subscriber_name: string;
      date: string;
    }
  ): Promise<void> {
    // Incrementar total_revenue
    const { error: updateError } = await (this.supabase as any).rpc(
      'increment_motorcycle_revenue',
      { motorcycle_id: motorcycleId, amount_to_add: amount }
    );

    if (updateError) {
      // Fallback: fazer manualmente se a função RPC não existir
      const motorcycle = await this.findById(motorcycleId);
      if (motorcycle) {
        await this.update(motorcycleId, {
          total_revenue: motorcycle.total_revenue + amount
        });
      }
    }

    // Registrar histórico
    const revenueRecord: MotorcycleRevenueInsert = {
      motorcycle_id: motorcycleId,
      amount,
      ...revenueData
    };

    const { error: insertError } = await (this.supabase as any)
      .from('motorcycle_revenue')
      .insert(revenueRecord);

    if (insertError) throw insertError;
  }

  async decrementRevenue(
    motorcycleId: string,
    amount: number,
    paymentId: string
  ): Promise<void> {
    // Decrementar total_revenue
    const motorcycle = await this.findById(motorcycleId);
    if (motorcycle) {
      await this.update(motorcycleId, {
        total_revenue: Math.max(0, motorcycle.total_revenue - amount)
      });
    }

    // Remover registro de histórico
    const { error } = await this.supabase
      .from('motorcycle_revenue')
      .delete()
      .eq('payment_id', paymentId);

    if (error) throw error;
  }
}
