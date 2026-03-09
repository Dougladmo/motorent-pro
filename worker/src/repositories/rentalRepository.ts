import { getSupabaseClient } from '../config/supabase';
import { Database } from '../models/database.types';

type Rental = Database['public']['Tables']['rentals']['Row'];
type RentalInsert = Database['public']['Tables']['rentals']['Insert'];
type RentalUpdate = Database['public']['Tables']['rentals']['Update'];

export class RentalRepository {
  private supabase = getSupabaseClient();

  async findAll(): Promise<Rental[]> {
    const { data, error } = await this.supabase
      .from('rentals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch rentals: ${error.message}`);
    return data || [];
  }

  async findAllActive(): Promise<Rental[]> {
    const { data, error } = await this.supabase
      .from('rentals')
      .select('*')
      .eq('is_active', true)
      .order('start_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findById(id: string): Promise<Rental | null> {
    const { data, error } = await this.supabase
      .from('rentals')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByMotorcycleId(motorcycleId: string): Promise<Rental[]> {
    const { data, error } = await this.supabase
      .from('rentals')
      .select('*')
      .eq('motorcycle_id', motorcycleId)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findBySubscriberId(subscriberId: string): Promise<Rental[]> {
    const { data, error } = await this.supabase
      .from('rentals')
      .select('*')
      .eq('subscriber_id', subscriberId)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findActiveByMotorcycleId(motorcycleId: string): Promise<Rental | null> {
    const { data, error } = await this.supabase
      .from('rentals')
      .select('*')
      .eq('motorcycle_id', motorcycleId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async create(rental: RentalInsert): Promise<Rental> {
    const { data, error } = await this.supabase
      .from('rentals')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .insert(rental)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: RentalUpdate): Promise<Rental> {
    const { data, error } = await this.supabase
      .from('rentals')
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
      .from('rentals')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
