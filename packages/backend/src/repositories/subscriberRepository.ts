import { getSupabaseClient } from '../config/supabase';
import { Database } from '@motorent/shared';

type Subscriber = Database['public']['Tables']['subscribers']['Row'];
type SubscriberInsert = Database['public']['Tables']['subscribers']['Insert'];
type SubscriberUpdate = Database['public']['Tables']['subscribers']['Update'];

export class SubscriberRepository {
  private supabase = getSupabaseClient();

  async findAll(): Promise<Subscriber[]> {
    const { data, error } = await this.supabase
      .from('subscribers')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch subscribers: ${error.message}`);
    return data || [];
  }

  async findById(id: string): Promise<Subscriber | null> {
    const { data, error } = await this.supabase
      .from('subscribers')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByDocument(document: string): Promise<Subscriber | null> {
    const { data, error } = await this.supabase
      .from('subscribers')
      .select('*')
      .eq('document', document)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findActive(): Promise<Subscriber[]> {
    const { data, error } = await this.supabase
      .from('subscribers')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async create(subscriber: SubscriberInsert): Promise<Subscriber> {
    const { data, error } = await this.supabase
      .from('subscribers')
      // @ts-expect-error - Tipos do Supabase serão gerados após configuração
      .insert(subscriber)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: SubscriberUpdate): Promise<Subscriber> {
    const { data, error } = await this.supabase
      .from('subscribers')
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
      .from('subscribers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
