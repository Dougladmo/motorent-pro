import { getSupabaseClient } from '../config/supabase';
import { Database } from '../models/database.types';

type SubscriberDocument = Database['public']['Tables']['subscriber_documents']['Row'];
type SubscriberDocumentInsert = Database['public']['Tables']['subscriber_documents']['Insert'];

export class SubscriberDocumentRepository {
  private supabase = getSupabaseClient();

  async findBySubscriberId(subscriberId: string): Promise<SubscriberDocument[]> {
    const { data, error } = await this.supabase
      .from('subscriber_documents' as any)
      .select('*')
      .eq('subscriber_id', subscriberId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as SubscriberDocument[];
  }

  async findById(id: string): Promise<SubscriberDocument | null> {
    const { data, error } = await this.supabase
      .from('subscriber_documents' as any)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return data as SubscriberDocument;
  }

  async create(doc: SubscriberDocumentInsert): Promise<SubscriberDocument> {
    const { data, error } = await this.supabase
      .from('subscriber_documents' as any)
      // @ts-expect-error - Nova tabela, tipos serão gerados após migração SQL
      .insert(doc)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as SubscriberDocument;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('subscriber_documents' as any)
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }
}
