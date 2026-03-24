import { getSupabaseClient } from '../config/supabase';
import { Database } from '../models/database.types';

type Motorcycle = Database['public']['Tables']['motorcycles']['Row'];
type MotorcycleInsert = Database['public']['Tables']['motorcycles']['Insert'];
type MotorcycleUpdate = Database['public']['Tables']['motorcycles']['Update'];

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
}
